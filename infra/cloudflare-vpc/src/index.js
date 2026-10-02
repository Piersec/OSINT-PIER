/* global Headers, Request, Response, URL, Uint8Array, console */

const MAX_BODY_BYTES = 32 * 1024;

const routes = [
  {
    prefix: '/command-tools',
    binding: 'COMMAND_TOOLS',
    service: 'command-tools',
    port: 18080,
    accepts: (path) => path === '/api/v1/scan',
  },
  {
    prefix: '/phoneinfoga',
    binding: 'PHONEINFOGA',
    service: 'phoneinfoga',
    port: 18082,
    accepts: (path) =>
      path === '/api/v2/numbers' ||
      /^\/api\/v2\/scanners\/(local|googlesearch|ovh|numverify|googlecse)\/run$/.test(
        path,
      ),
  },
];

function jsonError(status, error, extraHeaders = {}) {
  return Response.json(
    { error },
    {
      status,
      headers: {
        'cache-control': 'no-store, private',
        'x-content-type-options': 'nosniff',
        ...extraHeaders,
      },
    },
  );
}

function routeFor(pathname) {
  return routes.find((route) => pathname.startsWith(`${route.prefix}/`));
}

function upstreamHeaders(requestHeaders) {
  const headers = new Headers(requestHeaders);

  // Access authenticates the request before the Worker runs. These credentials
  // are not needed by the private Docker gateway and must not reach its logs.
  headers.delete('cf-access-client-id');
  headers.delete('cf-access-client-secret');
  headers.delete('cf-access-token');
  headers.delete('cf-access-jwt-assertion');
  headers.delete('cookie');
  headers.delete('host');
  headers.delete('content-length');
  headers.delete('cf-connecting-ip');
  headers.delete('cf-ray');
  headers.delete('x-forwarded-for');
  headers.delete('x-real-ip');

  return headers;
}

function noStore(response) {
  const headers = new Headers(response.headers);
  headers.set('cache-control', 'no-store, private');
  headers.set('x-content-type-options', 'nosniff');
  headers.delete('set-cookie');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function fixedLengthBody(request) {
  if (!request.body) return null;

  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  if (length === 0) return null;
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const route = routeFor(url.pathname);

    if (!route) return jsonError(404, 'Rota não encontrada.');
    if (request.method !== 'POST') {
      return jsonError(405, 'Método não permitido.', { allow: 'POST' });
    }

    const upstreamPath = url.pathname.slice(route.prefix.length);
    if (url.search || !route.accepts(upstreamPath)) {
      return jsonError(404, 'Rota não encontrada.');
    }

    const contentType = request.headers.get('content-type') ?? '';
    if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
      return jsonError(415, 'Envie uma solicitação JSON.');
    }

    const binding = env[route.binding];
    if (!binding || typeof binding.fetch !== 'function') {
      return jsonError(503, 'Serviço privado não configurado.');
    }

    let body;
    try {
      body = await fixedLengthBody(request);
    } catch {
      return jsonError(400, 'Corpo JSON inválido.');
    }
    if (!body) return jsonError(413, 'Corpo JSON ausente ou muito grande.');

    const target = new URL(`http://127.0.0.1:${route.port}${upstreamPath}`);
    const forwarded = new Request(target, {
      method: request.method,
      headers: upstreamHeaders(request.headers),
      // A fixed-length body makes Workers set Content-Length. The Python
      // gateways do not support chunked request bodies.
      body,
      redirect: 'manual',
      signal: request.signal,
    });

    try {
      const response = await binding.fetch(forwarded);
      return noStore(response);
    } catch {
      console.error(
        JSON.stringify({
          event: 'vpc_upstream_unavailable',
          service: route.service,
        }),
      );
      return jsonError(503, 'Serviço privado temporariamente indisponível.');
    }
  },
};
