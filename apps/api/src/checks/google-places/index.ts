import type { CheckPlugin } from '../../core/checks/contract.js';
import {
  apifyGuardThresholdFromEnvironment,
  getApifyUsageSummary,
} from '../../core/apify/usage.js';
import { failure, success } from '../../core/checks/results.js';

const id = 'google-places';
const source = 'Apify · compass/crawler-google-places';

interface PlaceDatasetItem {
  title?: unknown;
  address?: unknown;
  categoryName?: unknown;
  totalScore?: unknown;
  reviewsCount?: unknown;
  url?: unknown;
  website?: unknown;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
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
  label: 'Google Places',
  requiredEnv: ['APIFY_API_TOKEN'],
  supportedTargetKinds: ['name'],
  timeoutMs: 120_000,
  async run(target, context) {
    const token = context.credentials.APIFY_API_TOKEN;
    if (!token)
      return failure(id, source, 'Credencial APIFY_API_TOKEN não configurada.');

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
        'https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items',
      );
      endpoint.searchParams.set('clean', 'true');
      endpoint.searchParams.set('maxTotalChargeUsd', '0.05');
      const response = await fetch(endpoint, {
        method: 'POST',
        signal: context.signal,
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        // Explicitly keep all paid add-ons and enrichment off. The 10-place
        // cap and run cost cap bound both result volume and account exposure.
        body: JSON.stringify({
          searchStringsArray: [target.value],
          maxCrawledPlacesPerSearch: 10,
          language: 'pt-BR',
          scrapePlaceDetailPage: false,
          scrapeTableReservationProvider: false,
          scrapeOrderOnline: false,
          includeWebResults: false,
          scrapeDirectories: false,
          scrapeContacts: false,
          scrapeSocialMediaProfiles: {
            facebooks: false,
            instagrams: false,
            youtubes: false,
            tiktoks: false,
            twitters: false,
          },
          maxQuestions: 0,
        }),
      });
      if (!response.ok) return failure(id, source, apiFailure(response.status));

      const dataset = (await response.json()) as PlaceDatasetItem[];
      const places = Array.isArray(dataset)
        ? dataset.slice(0, 10).map((item) => ({
            name: stringOrNull(item.title),
            address: stringOrNull(item.address),
            category: stringOrNull(item.categoryName),
            rating: numberOrNull(item.totalScore),
            reviews: numberOrNull(item.reviewsCount),
            mapsUrl: stringOrNull(item.url),
            website: stringOrNull(item.website),
          }))
        : [];
      return success(id, source, {
        query: target.value,
        placesFound: places.length,
        places,
        usage: {
          usedUsd: guard.usedUsd ?? null,
          remainingUsd: guard.remainingUsd ?? null,
          usagePercent: guard.usagePercent ?? null,
        },
      });
    } catch {
      return failure(id, source, 'Não foi possível consultar o Google Places no Apify.');
    }
  },
};

export default check;
