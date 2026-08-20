import type { CheckPlugin } from '../../core/checks/contract.js';
import { success } from '../../core/checks/results.js';

const id = 'osint-framework';
const source = 'OSINT Framework catalog';

const catalog = {
  domain: [
    {
      name: 'DNSdumpster',
      url: 'https://dnsdumpster.com/',
      purpose: 'DNS e subdomínios',
    },
    {
      name: 'SecurityTrails',
      url: 'https://securitytrails.com/',
      purpose: 'Histórico DNS',
    },
    {
      name: 'crt.sh',
      url: 'https://crt.sh/',
      purpose: 'Certificados e subdomínios',
    },
  ],
  ip: [
    { name: 'BGPView', url: 'https://bgpview.io/', purpose: 'ASN e prefixos' },
    {
      name: 'AbuseIPDB',
      url: 'https://www.abuseipdb.com/',
      purpose: 'Reputação de IP',
    },
    {
      name: 'Shodan',
      url: 'https://www.shodan.io/',
      purpose: 'Serviços expostos',
    },
  ],
  url: [
    {
      name: 'urlscan.io',
      url: 'https://urlscan.io/',
      purpose: 'Capturas e recursos web',
    },
    {
      name: 'BuiltWith',
      url: 'https://builtwith.com/',
      purpose: 'Tecnologias web',
    },
    {
      name: 'Wayback Machine',
      url: 'https://web.archive.org/',
      purpose: 'Histórico de páginas',
    },
  ],
  email: [
    {
      name: 'Hunter',
      url: 'https://hunter.io/',
      purpose: 'Descoberta e verificação de e-mails',
    },
    {
      name: 'Have I Been Pwned',
      url: 'https://haveibeenpwned.com/',
      purpose: 'Exposição em vazamentos',
    },
  ],
  phone: [
    {
      name: 'PhoneInfoga',
      url: 'https://github.com/sundowndev/phoneinfoga',
      purpose: 'Enumeração de telefone',
    },
  ],
  username: [
    {
      name: 'Sherlock',
      url: 'https://github.com/sherlock-project/sherlock',
      purpose: 'Presença de username',
    },
    {
      name: 'WhatsMyName',
      url: 'https://whatsmyname.app/',
      purpose: 'Busca de contas públicas',
    },
  ],
  name: [
    {
      name: 'OSINT Framework',
      url: 'https://osintframework.com/',
      purpose: 'Ponto de partida para pesquisa',
    },
  ],
} as const;

const check: CheckPlugin = {
  id,
  label: 'OSINT Framework',
  requiredEnv: [],
  supportedTargetKinds: [
    'domain',
    'ip',
    'url',
    'name',
    'username',
    'email',
    'phone',
  ],
  async run(target) {
    return success(id, source, {
      target: target.value,
      targetKind: target.kind,
      catalogUrl: 'https://osintframework.com/',
      references: catalog[target.kind],
      note: 'Catálogo de referências para investigação autorizada. Nenhuma fonte é consultada ou raspada automaticamente.',
    });
  },
};

export default check;
