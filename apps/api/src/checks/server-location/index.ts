import type { CheckPlugin } from '../../core/checks/contract.js';
import { failure, success } from '../../core/checks/results.js';
import { ANALYSIS_USER_AGENT } from '../../core/network/http.js';
import { isPublicAddress, resolveAddresses } from '../../core/network/ip.js';

const id = 'server-location';

interface LocationResponse {
  success?: boolean;
  message?: string;
  ip?: string;
  type?: string;
  continent?: string;
  country?: string;
  country_code?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  connection?: {
    asn?: number;
    org?: string;
    isp?: string;
    domain?: string;
  };
  timezone?: { id?: string; utc?: string };
}

const check: CheckPlugin = {
  id,
  label: 'Server Location',
  requiredEnv: [],
  async run(target, context) {
    try {
      const addresses = await resolveAddresses(target.hostname);
      const allAddresses = [...addresses.ipv4, ...addresses.ipv6];
      if (allAddresses.length === 0) {
        return failure(
          id,
          'ipwho.is',
          'Nenhum endereço IP foi encontrado para o alvo.',
        );
      }
      const ip = allAddresses.find(isPublicAddress);
      if (!ip) {
        return success(id, 'Local address classification', {
          addresses: allAddresses,
          scope: 'private-or-reserved',
          note: 'Endereços privados/reservados não são enviados ao serviço de geolocalização.',
        });
      }

      const response = await fetch(
        `https://ipwho.is/${encodeURIComponent(ip)}`,
        {
          signal: context.signal,
          headers: {
            'user-agent': ANALYSIS_USER_AGENT,
            accept: 'application/json',
          },
        },
      );
      if (response.status === 429) {
        return failure(
          id,
          'ipwho.is',
          'O limite gratuito de geolocalização foi atingido.',
        );
      }
      if (!response.ok) {
        return failure(
          id,
          'ipwho.is',
          `O serviço de localização respondeu com HTTP ${response.status}.`,
        );
      }
      const location = (await response.json()) as LocationResponse;
      if (location.success === false) {
        return failure(
          id,
          'ipwho.is',
          location.message ?? 'O IP não pôde ser localizado.',
        );
      }
      return success(id, 'ipwho.is', {
        ip: location.ip ?? ip,
        type: location.type ?? null,
        location: {
          continent: location.continent ?? null,
          country: location.country ?? null,
          countryCode: location.country_code ?? null,
          region: location.region ?? null,
          city: location.city ?? null,
          latitude: location.latitude ?? null,
          longitude: location.longitude ?? null,
        },
        network: {
          asn: location.connection?.asn ?? null,
          organization: location.connection?.org ?? null,
          isp: location.connection?.isp ?? null,
          domain: location.connection?.domain ?? null,
        },
        timezone: {
          id: location.timezone?.id ?? null,
          utc: location.timezone?.utc ?? null,
        },
        approximate: true,
      });
    } catch {
      return failure(
        id,
        'ipwho.is',
        'Não foi possível obter a localização aproximada do servidor.',
      );
    }
  },
};

export default check;
