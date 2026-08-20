import { performance } from 'node:perf_hooks';
import type { NormalizedTarget } from '../target/normalize-target.js';

export const ANALYSIS_USER_AGENT =
  'OSINT-PIER/0.1 (internal security analysis)';

export interface RedirectHop {
  url: string;
  status: number;
  location: string | null;
  durationMs: number;
}

export interface FollowedResponse {
  response: Response;
  hops: RedirectHop[];
}

function formatHostname(hostname: string): string {
  return hostname.includes(':') && !hostname.startsWith('[')
    ? `[${hostname}]`
    : hostname;
}

export function candidateUrls(target: NormalizedTarget): string[] {
  if (target.kind === 'url') return [target.value];
  const hostname = formatHostname(target.hostname);
  return [`https://${hostname}/`, `http://${hostname}/`];
}

export async function fetchFirstAvailable(
  target: NormalizedTarget,
  signal: AbortSignal,
  options: RequestInit = {},
): Promise<Response> {
  let lastError: unknown;
  for (const url of candidateUrls(target)) {
    try {
      return await fetch(url, {
        ...options,
        headers: {
          accept: '*/*',
          'user-agent': ANALYSIS_USER_AGENT,
          ...options.headers,
        },
        signal,
      });
    } catch (error) {
      lastError = error;
      if (signal.aborted) throw error;
    }
  }
  throw lastError ?? new Error('Nenhum endpoint HTTP disponível.');
}

export async function followRedirects(
  initialUrl: string,
  signal: AbortSignal,
  maxRedirects = 10,
): Promise<FollowedResponse> {
  const hops: RedirectHop[] = [];
  const visited = new Set<string>();
  let currentUrl = initialUrl;

  for (let index = 0; index <= maxRedirects; index += 1) {
    if (visited.has(currentUrl))
      throw new Error('Loop de redirecionamento detectado.');
    visited.add(currentUrl);
    const startedAt = performance.now();
    const response = await fetch(currentUrl, {
      redirect: 'manual',
      signal,
      headers: { 'user-agent': ANALYSIS_USER_AGENT, accept: '*/*' },
    });
    const location = response.headers.get('location');
    hops.push({
      url: currentUrl,
      status: response.status,
      location,
      durationMs: performance.now() - startedAt,
    });

    if (![301, 302, 303, 307, 308].includes(response.status) || !location) {
      return { response, hops };
    }
    if (index === maxRedirects) {
      await response.body?.cancel();
      throw new Error(`A cadeia excedeu ${maxRedirects} redirecionamentos.`);
    }
    const nextUrl = new URL(location, currentUrl);
    if (!['http:', 'https:'].includes(nextUrl.protocol)) {
      await response.body?.cancel();
      throw new Error(
        'O servidor redirecionou para um protocolo não suportado.',
      );
    }
    await response.body?.cancel();
    currentUrl = nextUrl.toString();
  }

  throw new Error('Não foi possível concluir a cadeia de redirecionamentos.');
}

export async function followFirstAvailable(
  target: NormalizedTarget,
  signal: AbortSignal,
  maxRedirects = 10,
): Promise<FollowedResponse> {
  let lastError: unknown;
  for (const url of candidateUrls(target)) {
    try {
      return await followRedirects(url, signal, maxRedirects);
    } catch (error) {
      lastError = error;
      if (signal.aborted) throw error;
    }
  }
  throw lastError ?? new Error('Nenhum endpoint HTTP disponível.');
}

export async function readTextLimited(
  response: Response,
  maxBytes: number,
): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const remaining = maxBytes - size;
      if (value.byteLength > remaining) {
        if (remaining > 0) chunks.push(value.slice(0, remaining));
        size = maxBytes;
        await reader.cancel();
        break;
      }
      size += value.byteLength;
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}
