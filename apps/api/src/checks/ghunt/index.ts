import type { CheckPlugin } from '../../core/checks/contract.js';
import { failure, success } from '../../core/checks/results.js';

const id = 'ghunt';
const source = 'GHunt runner';

interface RunnerPayload {
  email?: unknown;
  found?: unknown;
  profile?: unknown;
  signals?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringValue(value: unknown, maxLength = 512): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function booleanValue(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 24);
}

function readServiceUrl(
  environment: Readonly<Record<string, string | undefined>> | undefined,
): URL | undefined {
  const value = environment?.GHUNT_API_URL ?? process.env.GHUNT_API_URL;
  if (!value?.trim()) return undefined;

  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    return url;
  } catch {
    return undefined;
  }
}

function endpoint(baseUrl: URL, path: string): URL {
  const base = new URL(baseUrl.toString());
  if (!base.pathname.endsWith('/')) base.pathname += '/';
  return new URL(path.replace(/^\//, ''), base);
}

function responseError(status: number): string {
  if (status === 401 || status === 403)
    return 'A sessão Google do runner GHunt está inválida ou não autorizada.';
  if (status === 404) return 'O módulo de e-mail do GHunt não está disponível.';
  if (status === 429) return 'O limite de uso do runner GHunt foi atingido.';
  if (status >= 500) return 'O runner GHunt está temporariamente indisponível.';
  return `O runner GHunt respondeu com HTTP ${status}.`;
}

function compactPayload(payload: unknown, email: string): Record<string, unknown> {
  const value = isRecord(payload) ? (payload as RunnerPayload) : {};
  const profile = isRecord(value.profile) ? value.profile : {};
  const signals = isRecord(value.signals) ? value.signals : {};

  return {
    email,
    found: booleanValue(value.found) ?? false,
    profile: {
      name: stringValue(profile.name),
      gaiaId: stringValue(profile.gaiaId, 128),
      lastUpdated: stringValue(profile.lastUpdated, 64),
      profilePhotoUrl: stringValue(profile.profilePhotoUrl, 2048),
      profilePhotoCustom: booleanValue(profile.profilePhotoCustom),
      entityType: stringValue(profile.entityType, 128),
      services: stringList(profile.services),
    },
    signals: {
      hasPlayGamesProfile: booleanValue(signals.hasPlayGamesProfile) ?? false,
      hasMapsReviews: booleanValue(signals.hasMapsReviews) ?? false,
      hasPublicCalendar: booleanValue(signals.hasPublicCalendar) ?? false,
    },
  };
}

const check: CheckPlugin = {
  id,
  label: 'GHunt',
  requiredEnv: ['GHUNT_API_TOKEN'],
  supportedTargetKinds: ['email'],
  timeoutMs: 90_000,
  async run(target, context) {
    const token = context.credentials.GHUNT_API_TOKEN;
    const baseUrl = readServiceUrl(context.environment);

    if (!baseUrl) {
      return {
        id,
        status: 'skipped',
        error: 'GHUNT_API_URL não configurada no backend.',
        source: 'configuration',
        durationMs: 0,
      };
    }

    if (!token) return failure(id, source, 'Token interno do GHunt não configurado.');

    try {
      const response = await fetch(endpoint(baseUrl, '/api/v2/email'), {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: target.value }),
        signal: context.signal,
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) return failure(id, source, responseError(response.status));

      return success(id, source, compactPayload(payload, target.value));
    } catch {
      return failure(id, source, 'Não foi possível consultar o runner GHunt.');
    }
  },
};

export default check;
