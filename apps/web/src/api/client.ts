import {
  CheckCatalogItemSchema,
  CheckEnabledWriteSchema,
  CheckResultSchema,
  AnalysisHistoryResponseSchema,
  AnalysisHistorySaveResponseSchema,
  AnalysisHistoryWriteSchema,
  CredentialStatusSchema,
  type AnalysisHistoryEntry,
  type TargetKind,
  type CheckCatalogItem,
  type CheckResult,
  type CredentialStatus,
} from '@osint-pier/contracts';
import { z } from 'zod';
import { getSupabaseAccessToken } from '../lib/supabase';

// In Next.js the default is same-origin, which lets the Vercel deployment use
// the serverless `/api` adapter. Set NEXT_PUBLIC_API_URL only when the local
// Fastify process is intentionally kept separate from the web app. If an old
// local URL was accidentally promoted to a hosted build, ignore it in the
// browser and keep the deployment on its same-origin adapter.
const apiBaseUrl = resolveApiBaseUrl();

export class ApiRequestError extends Error {
  readonly statusCode: number;
  readonly retryAfterSeconds?: number;

  constructor(options: {
    message: string;
    statusCode: number;
    retryAfterSeconds?: number;
  }) {
    super(options.message);
    this.name = 'ApiRequestError';
    this.statusCode = options.statusCode;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const accessToken = await getSupabaseAccessToken();
  const headers = new Headers(init?.headers);
  headers.set('content-type', 'application/json');
  if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);

  const requestInit: RequestInit = {
    ...init,
    headers,
  };

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, requestInit);
  } catch (error) {
    // A stale NEXT_PUBLIC_API_URL should not make a hosted deployment look
    // offline. Retry only transport failures; HTTP errors remain explicit.
    if (!apiBaseUrl || typeof window === 'undefined') throw error;
    response = await fetch(path, requestInit);
  }
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    retryAfterMs?: number;
  };
  if (!response.ok) {
    const retryAfterHeader = Number(response.headers.get('retry-after'));
    const retryAfterSeconds = Number.isFinite(retryAfterHeader)
      ? retryAfterHeader
      : payload.retryAfterMs
        ? Math.ceil(payload.retryAfterMs / 1000)
        : undefined;
    throw new ApiRequestError({
      message: payload.error ?? `A API respondeu com HTTP ${response.status}.`,
      statusCode: response.status,
      retryAfterSeconds,
    });
  }
  return payload;
}

function resolveApiBaseUrl(): string {
  const configured = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');
  if (!configured || typeof window === 'undefined') return configured;

  try {
    const configuredUrl = new URL(configured, window.location.origin);
    const localHosts = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
    const isHostedPage = !localHosts.has(window.location.hostname);
    if (isHostedPage && localHosts.has(configuredUrl.hostname)) return '';
  } catch {
    // An invalid public URL is safer as same-origin than as a broken endpoint.
    return '';
  }

  return configured;
}

export async function listChecks(): Promise<CheckCatalogItem[]> {
  return z.array(CheckCatalogItemSchema).parse(await request('/api/checks'));
}

export async function listCheckSettings(
  token: string,
): Promise<CheckCatalogItem[]> {
  return z
    .array(CheckCatalogItemSchema)
    .parse(
      await request('/api/admin/checks', { headers: adminHeaders(token) }),
    );
}

export async function setCheckEnabled(
  token: string,
  id: string,
  enabled: boolean,
): Promise<CheckCatalogItem> {
  return CheckCatalogItemSchema.parse(
    await request(`/api/admin/checks/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: adminHeaders(token),
      body: JSON.stringify(CheckEnabledWriteSchema.parse({ enabled })),
    }),
  );
}

export async function runCheck(
  id: string,
  target: string,
  targetKind?: TargetKind,
): Promise<CheckResult> {
  return CheckResultSchema.parse(
    await request(`/api/checks/${encodeURIComponent(id)}`, {
      method: 'POST',
      body: JSON.stringify({ target, ...(targetKind ? { targetKind } : {}) }),
    }),
  );
}

export async function listHistory(limit = 50): Promise<AnalysisHistoryEntry[]> {
  const response = AnalysisHistoryResponseSchema.parse(
    await request(`/api/history?limit=${limit}`),
  );
  return response.entries;
}

export async function saveHistory(input: {
  target: string;
  targetKind: TargetKind;
  total: number;
  success: number;
  attention: number;
}): Promise<AnalysisHistoryEntry | null> {
  const response = AnalysisHistorySaveResponseSchema.parse(
    await request('/api/history', {
      method: 'POST',
      body: JSON.stringify(AnalysisHistoryWriteSchema.parse(input)),
    }),
  );
  return response.entry ?? null;
}

function adminHeaders(token: string): HeadersInit {
  return { 'x-admin-token': token };
}

export async function listCredentials(
  token: string,
): Promise<CredentialStatus[]> {
  return z
    .array(CredentialStatusSchema)
    .parse(
      await request('/api/admin/credentials', { headers: adminHeaders(token) }),
    );
}

export async function saveCredential(
  token: string,
  name: string,
  value: string,
): Promise<void> {
  await request(`/api/admin/credentials/${encodeURIComponent(name)}`, {
    method: 'PUT',
    headers: adminHeaders(token),
    body: JSON.stringify({ value }),
  });
}

export async function removeCredential(
  token: string,
  name: string,
): Promise<void> {
  await request(`/api/admin/credentials/${encodeURIComponent(name)}`, {
    method: 'DELETE',
    headers: adminHeaders(token),
  });
}
