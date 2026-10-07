import type { CheckPlugin } from '../../core/checks/contract.js';
import {
  apifyGuardThresholdFromEnvironment,
  getApifyUsageSummary,
} from '../../core/apify/usage.js';
import { failure, success } from '../../core/checks/results.js';

const id = 'linkedin-profile';
const source = 'Apify · harvestapi/linkedin-profile-scraper';

interface LinkedInDatasetItem {
  name?: unknown;
  fullName?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  currentPosition?: unknown;
  experience?: unknown;
  headline?: unknown;
  title?: unknown;
  companyName?: unknown;
  company?: unknown;
  location?: unknown;
  linkedinUrl?: unknown;
  url?: unknown;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function currentExperience(value: unknown): Record<string, unknown> {
  if (!Array.isArray(value)) return {};
  return record(
    value.find((entry) => {
      const end = record(record(entry).endDate);
      return stringOrNull(end.text)?.toLowerCase() === 'present';
    }),
  );
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

function isPublicLinkedInProfile(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.hostname === 'linkedin.com' ||
        url.hostname.endsWith('.linkedin.com')) &&
      url.pathname.startsWith('/in/')
    );
  } catch {
    return false;
  }
}

const check: CheckPlugin = {
  id,
  label: 'Perfil LinkedIn',
  requiredEnv: ['APIFY_API_TOKEN'],
  supportedTargetKinds: ['url'],
  timeoutMs: 120_000,
  async run(target, context) {
    const token = context.credentials.APIFY_API_TOKEN;
    if (!token)
      return failure(id, source, 'Credencial APIFY_API_TOKEN não configurada.');
    if (!isPublicLinkedInProfile(target.value)) {
      return {
        id,
        status: 'skipped',
        error:
          'Informe uma URL pública de perfil do LinkedIn (linkedin.com/in/...).',
        source,
        durationMs: 0,
      };
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
        'https://api.apify.com/v2/acts/harvestapi~linkedin-profile-scraper/run-sync-get-dataset-items',
      );
      endpoint.searchParams.set('clean', 'true');
      endpoint.searchParams.set('maxTotalChargeUsd', '0.01');
      const response = await fetch(endpoint, {
        method: 'POST',
        signal: context.signal,
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        // The actor defaults to profile details. Do not opt into its paid
        // e-mail-search mode or submit more than one profile per analysis.
        body: JSON.stringify({ urls: [target.value] }),
      });
      if (!response.ok) return failure(id, source, apiFailure(response.status));

      const dataset = (await response.json()) as LinkedInDatasetItem[];
      const item = Array.isArray(dataset)
        ? dataset.find((entry) => entry && typeof entry === 'object')
        : undefined;
      if (!item)
        return failure(
          id,
          source,
          'O Apify não encontrou um perfil público para essa URL.',
        );

      const experience = currentExperience(item.experience);
      const position = Array.isArray(item.currentPosition)
        ? record(item.currentPosition[0])
        : record(item.currentPosition);
      const location = record(item.location);
      const composedName = [
        stringOrNull(item.firstName),
        stringOrNull(item.lastName),
      ]
        .filter(Boolean)
        .join(' ');
      return success(id, source, {
        profileUrl:
          stringOrNull(item.linkedinUrl) ??
          stringOrNull(item.url) ??
          target.value,
        name:
          stringOrNull(item.fullName) ??
          stringOrNull(item.name) ??
          stringOrNull(composedName),
        headline: stringOrNull(item.headline),
        currentTitle:
          stringOrNull(item.title) ??
          stringOrNull(position.position) ??
          stringOrNull(experience.position),
        company:
          stringOrNull(item.companyName) ??
          stringOrNull(item.company) ??
          stringOrNull(position.companyName) ??
          stringOrNull(experience.companyName),
        location:
          stringOrNull(item.location) ??
          stringOrNull(location.linkedinText) ??
          stringOrNull(record(location.parsed).text),
        usage: {
          usedUsd: guard.usedUsd ?? null,
          remainingUsd: guard.remainingUsd ?? null,
          usagePercent: guard.usagePercent ?? null,
        },
      });
    } catch {
      return failure(
        id,
        source,
        'Não foi possível consultar o perfil LinkedIn no Apify.',
      );
    }
  },
};

export default check;
