/* global Request, Response */

import assert from 'node:assert/strict';
import test from 'node:test';
import worker from './index.js';

function bindingWith(response, capture) {
  return {
    async fetch(request) {
      capture.request = request;
      return response;
    },
  };
}

test('routes only the command-tools scan to its bound private service', async () => {
  const capture = {};
  const env = {
    COMMAND_TOOLS: bindingWith(
      Response.json({ tool: 'nmap' }, { status: 200 }),
      capture,
    ),
  };
  const request = new Request(
    'https://bridge.example.workers.dev/command-tools/api/v1/scan',
    {
      method: 'POST',
      headers: {
        authorization: 'Bearer gateway-token',
        'content-type': 'application/json',
        'cf-access-client-id': 'access-id',
        'cf-access-client-secret': 'access-secret',
      },
    },
  );

  const response = await worker.fetch(request, env);

  assert.equal(response.status, 200);
  assert.equal(capture.request.url, 'http://127.0.0.1:18080/api/v1/scan');
  assert.equal(
    capture.request.headers.get('authorization'),
    'Bearer gateway-token',
  );
  assert.equal(capture.request.headers.get('cf-access-client-id'), null);
  assert.equal(capture.request.headers.get('cf-access-client-secret'), null);
  assert.equal(response.headers.get('cache-control'), 'no-store, private');
  assert.deepEqual(await response.json(), { tool: 'nmap' });
});

test('routes PhoneInfoga and GHunt only to their fixed loopback ports', async () => {
  const capture = {};
  const env = {
    PHONEINFOGA: bindingWith(new Response(null, { status: 204 }), capture),
    GHUNT: bindingWith(new Response(null, { status: 204 }), capture),
  };

  const phone = await worker.fetch(
    new Request(
      'https://bridge.example.workers.dev/phoneinfoga/api/v2/scanners/local/run',
      { method: 'POST', headers: { 'content-type': 'application/json' } },
    ),
    env,
  );
  assert.equal(phone.status, 204);
  assert.equal(
    capture.request.url,
    'http://127.0.0.1:18082/api/v2/scanners/local/run',
  );

  const ghunt = await worker.fetch(
    new Request('https://bridge.example.workers.dev/ghunt/api/v2/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    }),
    env,
  );
  assert.equal(ghunt.status, 204);
  assert.equal(capture.request.url, 'http://127.0.0.1:18083/api/v2/email');
});

test('rejects unknown paths, query strings, and unsupported methods without upstream calls', async () => {
  const capture = {};
  const env = {
    GHUNT: bindingWith(new Response(null, { status: 204 }), capture),
  };

  const unknown = await worker.fetch(
    new Request('https://bridge.example.workers.dev/ghunt/api/v2/profile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    }),
    env,
  );
  const query = await worker.fetch(
    new Request('https://bridge.example.workers.dev/ghunt/api/v2/email?x=1', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    }),
    env,
  );
  const unsupported = await worker.fetch(
    new Request('https://bridge.example.workers.dev/ghunt/api/v2/email'),
    env,
  );

  assert.equal(unknown.status, 404);
  assert.equal(query.status, 404);
  assert.equal(unsupported.status, 405);
  assert.equal(capture.request, undefined);
});

test('does not follow redirects and returns a generic error if the binding fails', async () => {
  const redirectCapture = {};
  const redirect = await worker.fetch(
    new Request('https://bridge.example.workers.dev/ghunt/api/v2/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    }),
    {
      GHUNT: bindingWith(
        new Response(null, {
          status: 302,
          headers: { location: 'https://example.com/' },
        }),
        redirectCapture,
      ),
    },
  );
  assert.equal(redirect.status, 302);
  assert.equal(redirect.headers.get('location'), 'https://example.com/');

  const unavailable = await worker.fetch(
    new Request('https://bridge.example.workers.dev/ghunt/api/v2/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    }),
    {
      GHUNT: {
        fetch: async () => Promise.reject(new Error('private details')),
      },
    },
  );

  assert.equal(unavailable.status, 503);
  assert.doesNotMatch(await unavailable.text(), /private details/);
});

test('refuses non-JSON payloads and missing VPC bindings', async () => {
  const contentType = await worker.fetch(
    new Request('https://bridge.example.workers.dev/ghunt/api/v2/email', {
      method: 'POST',
    }),
    { GHUNT: { fetch: async () => Response.json({}) } },
  );
  const unconfigured = await worker.fetch(
    new Request('https://bridge.example.workers.dev/ghunt/api/v2/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    }),
    {},
  );

  assert.equal(contentType.status, 415);
  assert.equal(unconfigured.status, 503);
});
