import type { CheckPlugin } from '../../core/checks/contract.js';
import { failure, success } from '../../core/checks/results.js';
import { isPublicAddress, resolveAddresses } from '../../core/network/ip.js';

const id = 'shodan';
const source = 'Shodan Host API';

interface ShodanService {
  port?: number;
  transport?: string;
  product?: string;
  version?: string;
  module?: string;
  ssl?: { versions?: string[] };
}

interface ShodanResponse {
  ip_str?: string;
  ip?: number;
  hostnames?: string[];
  domains?: string[];
  country_code?: string | null;
  country_name?: string | null;
  city?: string | null;
  region_code?: string | null;
  org?: string | null;
  isp?: string | null;
  asn?: string | null;
  os?: string | null;
  ports?: number[];
  tags?: string[];
  vulns?: Record<string, unknown> | string[];
  last_update?: string | null;
  data?: ShodanService[];
}

function apiFailure(status: number): string {
  if (status === 401) return 'A chave do Shodan é inválida.';
  if (status === 403)
    return 'A chave do Shodan foi reconhecida, mas o plano não permite esta consulta.';
  if (status === 404) return 'O Shodan não possui dados para este endereço IP.';
  if (status === 429)
    return 'O limite de uso do Shodan foi atingido. Aguarde antes de tentar novamente.';
  if (status >= 500) return 'O Shodan está temporariamente indisponível.';
  return `O Shodan respondeu com HTTP ${status}.`;
}

function compactService(service: ShodanService) {
  return {
    port: service.port ?? null,
    transport: service.transport ?? null,
    product: service.product ?? null,
    version: service.version ?? null,
    module: service.module ?? null,
    tlsVersions: service.ssl?.versions ?? [],
  };
}

const check: CheckPlugin = {
  id,
  label: 'Shodan',
  requiredEnv: ['SHODAN_API_KEY'],
  supportedTargetKinds: ['domain', 'ip', 'url'],
  async run(target, context) {
    const apiKey = context.credentials.SHODAN_API_KEY;
    if (!apiKey) {
      return failure(id, source, 'Credencial SHODAN_API_KEY não configurada.');
    }

    try {
      const addresses = await resolveAddresses(target.hostname);
      const resolvedAddresses = [...addresses.ipv4, ...addresses.ipv6];
      const selectedIp = resolvedAddresses.find(isPublicAddress);
      if (!selectedIp) {
        return success(id, 'Local address classification', {
          resolvedAddresses,
          scope: 'private-or-reserved',
          note: 'Endereços privados/reservados não são enviados ao Shodan.',
        });
      }

      const url = new URL(
        `https://api.shodan.io/shodan/host/${encodeURIComponent(selectedIp)}`,
      );
      url.searchParams.set('key', apiKey);
      url.searchParams.set('minify', 'true');
      const response = await fetch(url, {
        signal: context.signal,
        headers: { accept: 'application/json' },
      });
      if (!response.ok) return failure(id, source, apiFailure(response.status));

      const payload = (await response.json()) as ShodanResponse;
      return success(id, source, {
        selectedIp: payload.ip_str ?? selectedIp,
        resolvedAddresses,
        hostnames: payload.hostnames ?? [],
        domains: payload.domains ?? [],
        location: {
          countryCode: payload.country_code ?? null,
          countryName: payload.country_name ?? null,
          city: payload.city ?? null,
          regionCode: payload.region_code ?? null,
        },
        network: {
          organization: payload.org ?? null,
          isp: payload.isp ?? null,
          asn: payload.asn ?? null,
          os: payload.os ?? null,
        },
        ports: [...new Set(payload.ports ?? [])].sort((a, b) => a - b),
        tags: payload.tags ?? [],
        vulnerabilities: Array.isArray(payload.vulns)
          ? payload.vulns
          : Object.keys(payload.vulns ?? {}),
        services: (payload.data ?? []).slice(0, 40).map(compactService),
        lastUpdate: payload.last_update ?? null,
        reportUrl: `https://www.shodan.io/host/${encodeURIComponent(selectedIp)}`,
      });
    } catch {
      return failure(id, source, 'Não foi possível consultar o Shodan.');
    }
  },
};

export default check;
