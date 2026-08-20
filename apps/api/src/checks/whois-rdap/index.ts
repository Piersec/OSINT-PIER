import { isIP } from 'node:net';
import type { CheckPlugin } from '../../core/checks/contract.js';
import { failure, success } from '../../core/checks/results.js';
import { ANALYSIS_USER_AGENT } from '../../core/network/http.js';

const id = 'whois-rdap';
const bootstrapUrl = 'https://data.iana.org/rdap/dns.json';

interface BootstrapRegistry {
  services: Array<[string[], string[]]>;
}

interface RdapEvent {
  eventAction?: string;
  eventDate?: string;
}

interface RdapEntity {
  roles?: string[];
  vcardArray?: [string, Array<[string, unknown, string, unknown]>];
}

interface RdapDomain {
  ldhName?: string;
  handle?: string;
  status?: string[];
  events?: RdapEvent[];
  entities?: RdapEntity[];
  nameservers?: Array<{ ldhName?: string }>;
  secureDNS?: { delegationSigned?: boolean };
}

function vcardName(entity: RdapEntity): string | undefined {
  const properties = entity.vcardArray?.[1] ?? [];
  const name = properties.find(([property]) => property === 'fn')?.[3];
  return typeof name === 'string' ? name : undefined;
}

const check: CheckPlugin = {
  id,
  label: 'WHOIS / RDAP',
  requiredEnv: [],
  async run(target, context) {
    if (isIP(target.hostname)) {
      return failure(
        id,
        'IANA RDAP',
        'A consulta WHOIS/RDAP desta fase requer um domínio.',
      );
    }

    try {
      const bootstrapResponse = await fetch(bootstrapUrl, {
        signal: context.signal,
        headers: {
          'user-agent': ANALYSIS_USER_AGENT,
          accept: 'application/json',
        },
      });
      if (!bootstrapResponse.ok) {
        return failure(
          id,
          'IANA RDAP',
          'O bootstrap RDAP da IANA está indisponível.',
        );
      }
      const bootstrap = (await bootstrapResponse.json()) as BootstrapRegistry;
      const tld = target.hostname.split('.').at(-1)?.toLowerCase();
      const service = bootstrap.services.find(
        ([tlds]) => tld && tlds.includes(tld),
      );
      const baseUrl = service?.[1][0];
      if (!baseUrl)
        return failure(
          id,
          'IANA RDAP',
          'Nenhum servidor RDAP foi publicado para este TLD.',
        );

      const queryUrl = new URL(
        `domain/${encodeURIComponent(target.hostname)}`,
        baseUrl,
      ).toString();
      const response = await fetch(queryUrl, {
        signal: context.signal,
        headers: {
          'user-agent': ANALYSIS_USER_AGENT,
          accept: 'application/rdap+json',
        },
      });
      if (response.status === 429) {
        return failure(
          id,
          new URL(baseUrl).hostname,
          'O servidor RDAP aplicou limite de consultas.',
        );
      }
      if (response.status === 404) {
        return failure(
          id,
          new URL(baseUrl).hostname,
          'O domínio não foi encontrado no RDAP do registro.',
        );
      }
      if (!response.ok) {
        return failure(
          id,
          new URL(baseUrl).hostname,
          `O servidor RDAP respondeu com HTTP ${response.status}.`,
        );
      }

      const rdap = (await response.json()) as RdapDomain;
      const registrar = rdap.entities?.find((entity) =>
        entity.roles?.includes('registrar'),
      );
      const events = Object.fromEntries(
        (rdap.events ?? [])
          .filter((event) => event.eventAction && event.eventDate)
          .map((event) => [event.eventAction!, event.eventDate!]),
      );
      return success(id, new URL(baseUrl).hostname, {
        domain: rdap.ldhName ?? target.hostname,
        handle: rdap.handle ?? null,
        registrar: registrar ? (vcardName(registrar) ?? null) : null,
        status: rdap.status ?? [],
        events,
        nameservers: (rdap.nameservers ?? []).flatMap((server) =>
          server.ldhName ? [server.ldhName] : [],
        ),
        dnssecSigned: rdap.secureDNS?.delegationSigned ?? null,
      });
    } catch {
      return failure(
        id,
        'IANA RDAP',
        'Não foi possível consultar os dados de registro do domínio.',
      );
    }
  },
};

export default check;
