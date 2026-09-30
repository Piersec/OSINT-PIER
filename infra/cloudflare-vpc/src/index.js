/* global Headers, Request, Response, URL, console */

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
  {
    prefix: '/ghunt',
    binding: 'GHUNT',
    service: 'ghunt',
    port: 18083,
    accepts: (path) => path === '/api/v2/email',
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

    const target = new URL(`http://127.0.0.1:${route.port}${upstreamPath}`);
    const forwarded = new Request(target, {
      method: request.method,
      headers: upstreamHeaders(request.headers),
      body: request.body,
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
