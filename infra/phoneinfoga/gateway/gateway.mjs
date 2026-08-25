import { timingSafeEqual } from 'node:crypto';
import http from 'node:http';
import https from 'node:https';

const port = Number.parseInt(process.env.PORT ?? '8080', 10);
const token = process.env.PHONEINFOGA_API_TOKEN ?? '';
const upstreamValue =
  process.env.PHONEINFOGA_UPSTREAM ?? 'http://phoneinfoga:5000';
const maxBodyBytes = 256 * 1024;

if (!token || token.length < 32) {
  throw new Error(
    'PHONEINFOGA_API_TOKEN precisa ter pelo menos 32 caracteres.',
  );
}

const upstream = new URL(upstreamValue);
if (!['http:', 'https:'].includes(upstream.protocol)) {
  throw new Error('PHONEINFOGA_UPSTREAM precisa usar HTTP ou HTTPS.');
}

function authorized(request) {
  const value = request.headers.authorization ?? '';
  const supplied = value.match(/^Bearer\s+(.+)$/i)?.[1] ?? '';
  const expected = Buffer.from(token);
  const received = Buffer.from(supplied);
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}

function sendJson(response, statusCode, body) {
  const payload = JSON.stringify(body);
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
  });
  response.end(payload);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    request.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBodyBytes) {
        reject(new Error('request-too-large'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks)));
    request.on('error', reject);
  });
}

function proxy(request, response, body) {
  const transport = upstream.protocol === 'https:' ? https : http;
  const proxyRequest = transport.request(
    {
      protocol: upstream.protocol,
      hostname: upstream.hostname,
      port: upstream.port || undefined,
      method: request.method,
      path: `${new URL(request.url, 'http://gateway').pathname}${new URL(request.url, 'http://gateway').search}`,
      headers: {
        accept: request.headers.accept ?? 'application/json',
        ...(body.length > 0 ? { 'content-type': 'application/json' } : {}),
        ...(body.length > 0 ? { 'content-length': body.length } : {}),
      },
      timeout: 25_000,
    },
    (upstreamResponse) => {
      const headers = {};
      for (const name of ['content-type', 'content-length', 'cache-control']) {
        const value = upstreamResponse.headers[name];
        if (typeof value === 'string') headers[name] = value;
      }
      response.writeHead(upstreamResponse.statusCode ?? 502, headers);
      upstreamResponse.pipe(response);
    },
  );

  proxyRequest.on('timeout', () => proxyRequest.destroy(new Error('timeout')));
  proxyRequest.on('error', () => {
    if (!response.headersSent)
      sendJson(response, 502, { error: 'PhoneInfoga indisponível.' });
    else response.destroy();
  });
  if (body.length > 0) proxyRequest.write(body);
  proxyRequest.end();
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://gateway');

  if (url.pathname === '/healthz' && request.method === 'GET') {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (!url.pathname.startsWith('/api/')) {
    sendJson(response, 404, { error: 'Rota não encontrada.' });
    return;
  }

  if (!['GET', 'POST'].includes(request.method ?? '')) {
    response.writeHead(405, { allow: 'GET, POST' });
    response.end();
    return;
  }

  if (!authorized(request)) {
    sendJson(response, 401, { error: 'Não autorizado.' });
    return;
  }

  try {
    const body =
      request.method === 'POST' ? await readBody(request) : Buffer.alloc(0);
    proxy(request, response, body);
  } catch (error) {
    if (error instanceof Error && error.message === 'request-too-large') {
      sendJson(response, 413, { error: 'Requisição muito grande.' });
      return;
    }
    sendJson(response, 400, { error: 'Requisição inválida.' });
  }
});

server.listen(port, '0.0.0.0');
