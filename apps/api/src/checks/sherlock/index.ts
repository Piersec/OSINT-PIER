import type { CheckPlugin } from '../../core/checks/contract.js';
import {
  apifyGuardThresholdFromEnvironment,
  getApifyUsageSummary,
} from '../../core/apify/usage.js';
import { failure, success } from '../../core/checks/results.js';

const id = 'sherlock';
const source = 'Apify · misceres/sherlock';

interface SherlockDatasetItem {
  username?: unknown;
  links?: unknown;
}

function safeLinks(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(
    value.filter((item): item is string => {
      if (typeof item !== 'string') return false;
      try {
        const url = new URL(item);
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch {
        return false;
      }
    }),
  )].slice(0, 50);
}

function apiFailure(status: number): string {
  if (status === 401 || status === 403)
    return 'O Apify não aceitou a credencial configurada.';
  if (status === 402)
    return 'O Apify bloqueou a execução por limite de créditos ou cobrança.';
  if (status === 429)
    return 'O Apify atingiu o limite de requisições. Tente novamente mais tarde.';
  if (status >= 500) return 'O Apify está temporariamente indisponível.';
  return `O Apify respondeu com HTTP ${status}.`;
}

const check: CheckPlugin = {
  id,
  label: 'Sherlock',
  requiredEnv: ['APIFY_API_TOKEN'],
  supportedTargetKinds: ['username'],
  timeoutMs: 120_000,
  async run(target, context) {
    const token = context.credentials.APIFY_API_TOKEN;
    if (!token) {
      return failure(id, source, 'Credencial APIFY_API_TOKEN não configurada.');
    }

    const guard = await getApifyUsageSummary({
      token,
      signal: context.signal,
      guardThresholdPercent: apifyGuardThresholdFromEnvironment(
        context.environment,
      ),
    });
    if (guard.guardActive) {
      return {
        id,
        status: 'skipped',
        error: guard.guardReason ?? 'Proteção de crédito do Apify ativa.',
        source,
        durationMs: 0,
      };
    }

    try {
      const endpoint = new URL(
        'https://api.apify.com/v2/acts/misceres~sherlock/run-sync-get-dataset-items',
      );
      endpoint.searchParams.set('clean', 'true');
      const response = await fetch(endpoint, {
        method: 'POST',
        signal: context.signal,
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ usernames: [target.value] }),
      });
      if (!response.ok) return failure(id, source, apiFailure(response.status));

      const dataset = (await response.json()) as SherlockDatasetItem[];
      const result = Array.isArray(dataset)
        ? dataset.find((item) => item && typeof item === 'object')
        : undefined;
      const links = safeLinks(result?.links);
      return success(id, source, {
        username:
          typeof result?.username === 'string' ? result.username : target.value,
        profilesFound: links.length,
        profiles: links.map((url) => ({ url })),
        usage: {
          usedUsd: guard.usedUsd ?? null,
          remainingUsd: guard.remainingUsd ?? null,
          usagePercent: guard.usagePercent ?? null,
        },
      });
    } catch {
      return failure(id, source, 'Não foi possível executar a consulta Sherlock no Apify.');
    }
  },
};

export default check;
