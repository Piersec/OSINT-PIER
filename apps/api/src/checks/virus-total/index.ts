import { isIP } from 'node:net';
import type { CheckPlugin } from '../../core/checks/contract.js';
import { failure, success } from '../../core/checks/results.js';

const id = 'virus-total';
const source = 'VirusTotal API v3';

interface VirusTotalAttributes {
  last_analysis_stats?: Record<string, number>;
  last_analysis_results?: Record<
    string,
    { category?: string; engine_name?: string; result?: string }
  >;
  last_analysis_date?: number;
  reputation?: number;
  total_votes?: { harmless?: number; malicious?: number };
  categories?: Record<string, string>;
  tags?: string[];
  asn?: number;
  as_owner?: string;
  country?: string;
  network?: string;
  regional_internet_registry?: string;
}

interface VirusTotalResponse {
  data?: {
    id?: string;
    type?: string;
    attributes?: VirusTotalAttributes;
  };
}

function isoFromEpoch(value: number | undefined): string | null {
  if (!value || !Number.isFinite(value)) return null;
  return new Date(value * 1000).toISOString();
}

function apiFailure(status: number) {
  if (status === 401)
    return 'A chave do VirusTotal é inválida, está inativa ou não foi aceita.';
  if (status === 403)
    return 'A chave do VirusTotal não possui permissão para consultar este recurso.';
  if (status === 404)
    return 'O VirusTotal ainda não possui um relatório para este alvo.';
  if (status === 429)
    return 'A cota do VirusTotal foi atingida. Aguarde a janela de renovação da chave.';
  if (status >= 500) return 'O VirusTotal está temporariamente indisponível.';
  return `O VirusTotal respondeu com HTTP ${status}.`;
}

const check: CheckPlugin = {
  id,
  label: 'VirusTotal',
  requiredEnv: ['VIRUSTOTAL_API_KEY'],
  async run(target, context) {
    const apiKey = context.credentials.VIRUSTOTAL_API_KEY;
    if (!apiKey) {
      return failure(
        id,
        source,
        'Credencial VIRUSTOTAL_API_KEY não configurada.',
      );
    }

    const ipTarget = isIP(target.hostname) !== 0;
    const collection = ipTarget ? 'ip_addresses' : 'domains';
    const observable = target.hostname.toLowerCase();

    try {
      const response = await fetch(
        `https://www.virustotal.com/api/v3/${collection}/${encodeURIComponent(observable)}`,
        {
          signal: context.signal,
          headers: { accept: 'application/json', 'x-apikey': apiKey },
        },
      );
      if (!response.ok) return failure(id, source, apiFailure(response.status));

      const payload = (await response.json()) as VirusTotalResponse;
      const attributes = payload.data?.attributes;
      if (!payload.data || !attributes) {
        return failure(
          id,
          source,
          'O VirusTotal retornou um relatório incompleto.',
        );
      }

      const matchingDetections = Object.values(
        attributes.last_analysis_results ?? {},
      )
        .filter((result) =>
          ['malicious', 'suspicious'].includes(result.category ?? ''),
        )
        .map((result) => ({
          engine: result.engine_name ?? 'Desconhecido',
          category: result.category ?? null,
          result: result.result ?? null,
        }));
      const detections = matchingDetections.slice(0, 25);

      return success(id, source, {
        observable: payload.data.id ?? observable,
        observableType:
          payload.data.type ?? (ipTarget ? 'ip_address' : 'domain'),
        analysis: {
          stats: attributes.last_analysis_stats ?? {},
          analyzedAt: isoFromEpoch(attributes.last_analysis_date),
          detections,
          detectionsTruncated: matchingDetections.length > detections.length,
        },
        reputation: attributes.reputation ?? null,
        communityVotes: {
          harmless: attributes.total_votes?.harmless ?? 0,
          malicious: attributes.total_votes?.malicious ?? 0,
        },
        categories: Object.entries(attributes.categories ?? {}).map(
          ([provider, category]) => ({ provider, category }),
        ),
        tags: attributes.tags ?? [],
        network: ipTarget
          ? {
              asn: attributes.asn ?? null,
              owner: attributes.as_owner ?? null,
              country: attributes.country ?? null,
              range: attributes.network ?? null,
              registry: attributes.regional_internet_registry ?? null,
            }
          : null,
        reportUrl: `https://www.virustotal.com/gui/${ipTarget ? 'ip-address' : 'domain'}/${encodeURIComponent(observable)}`,
      });
    } catch {
      return failure(id, source, 'Não foi possível consultar o VirusTotal.');
    }
  },
};

export default check;
