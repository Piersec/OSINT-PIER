import type { CheckPlugin } from '../../core/checks/contract.js';
import { failure, success } from '../../core/checks/results.js';
import { isPublicAddress, resolveAddresses } from '../../core/network/ip.js';

const id = 'abuse-ipdb';
const source = 'AbuseIPDB API v2';
const maxAgeInDays = 90;

interface AbuseIpDbData {
  ipAddress?: string;
  isPublic?: boolean;
  ipVersion?: number;
  isWhitelisted?: boolean | null;
  abuseConfidenceScore?: number;
  countryCode?: string | null;
  usageType?: string | null;
  isp?: string | null;
  domain?: string | null;
  hostnames?: string[];
  isTor?: boolean;
  totalReports?: number;
  numDistinctUsers?: number;
  lastReportedAt?: string | null;
}

interface AbuseIpDbResponse {
  data?: AbuseIpDbData;
}

function numberHeader(response: Response, name: string): number | null {
  const value = response.headers.get(name);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function resetAt(response: Response): string | null {
  const epoch = numberHeader(response, 'x-ratelimit-reset');
  return epoch ? new Date(epoch * 1000).toISOString() : null;
}

function apiFailure(status: number) {
  if (status === 401 || status === 403)
    return 'A chave do AbuseIPDB é inválida ou não possui permissão para esta consulta.';
  if (status === 402)
    return 'O plano atual do AbuseIPDB não permite os parâmetros solicitados.';
  if (status === 422)
    return 'O AbuseIPDB rejeitou o endereço IP ou os parâmetros da consulta.';
  if (status === 429) return 'O limite diário do AbuseIPDB foi atingido.';
  if (status >= 500) return 'O AbuseIPDB está temporariamente indisponível.';
  return `O AbuseIPDB respondeu com HTTP ${status}.`;
}

const check: CheckPlugin = {
  id,
  label: 'AbuseIPDB',
  requiredEnv: ['ABUSEIPDB_API_KEY'],
  async run(target, context) {
    const apiKey = context.credentials.ABUSEIPDB_API_KEY;
    if (!apiKey) {
      return failure(
        id,
        source,
        'Credencial ABUSEIPDB_API_KEY não configurada.',
      );
    }

    try {
      const addresses = await resolveAddresses(target.hostname);
      const resolvedAddresses = [...addresses.ipv4, ...addresses.ipv6];
      if (resolvedAddresses.length === 0) {
        return failure(
          id,
          source,
          'Nenhum endereço IP foi encontrado para o alvo.',
        );
      }

      const selectedIp = resolvedAddresses.find(isPublicAddress);
      if (!selectedIp) {
        return success(id, 'Local address classification', {
          resolvedAddresses,
          scope: 'private-or-reserved',
          note: 'Endereços privados/reservados não são enviados ao AbuseIPDB.',
        });
      }

      const query = new URLSearchParams({
        ipAddress: selectedIp,
        maxAgeInDays: String(maxAgeInDays),
      });
      const response = await fetch(
        `https://api.abuseipdb.com/api/v2/check?${query.toString()}`,
        {
          signal: context.signal,
          headers: { accept: 'application/json', Key: apiKey },
        },
      );
      if (!response.ok) return failure(id, source, apiFailure(response.status));

      const payload = (await response.json()) as AbuseIpDbResponse;
      if (!payload.data) {
        return failure(
          id,
          source,
          'O AbuseIPDB retornou um relatório incompleto.',
        );
      }
      const data = payload.data;

      return success(id, source, {
        selectedIp: data.ipAddress ?? selectedIp,
        resolvedAddresses,
        windowDays: maxAgeInDays,
        abuseConfidenceScore: data.abuseConfidenceScore ?? 0,
        reports: {
          total: data.totalReports ?? 0,
          distinctReporters: data.numDistinctUsers ?? 0,
          lastReportedAt: data.lastReportedAt ?? null,
        },
        flags: {
          public: data.isPublic ?? true,
          whitelisted: data.isWhitelisted ?? null,
          tor: data.isTor ?? false,
        },
        network: {
          ipVersion: data.ipVersion ?? null,
          countryCode: data.countryCode ?? null,
          usageType: data.usageType ?? null,
          isp: data.isp ?? null,
          domain: data.domain ?? null,
          hostnames: data.hostnames ?? [],
        },
        quota: {
          limit: numberHeader(response, 'x-ratelimit-limit'),
          remaining: numberHeader(response, 'x-ratelimit-remaining'),
          resetAt: resetAt(response),
        },
        reportUrl: `https://www.abuseipdb.com/check/${encodeURIComponent(selectedIp)}`,
      });
    } catch {
      return failure(id, source, 'Não foi possível consultar o AbuseIPDB.');
    }
  },
};

export default check;
