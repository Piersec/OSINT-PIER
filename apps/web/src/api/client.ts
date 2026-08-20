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

const apiBaseUrl =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ??
  'http://localhost:3000';

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
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...init?.headers,
    },
  });
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
