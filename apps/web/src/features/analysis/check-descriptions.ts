import type { CheckCatalogItem } from '@osint-pier/contracts';

const toolDescriptions: Record<string, string> = {
  'abuse-ipdb': 'Consulta histórico de abuso e reputação de um IP público.',
  cookies: 'Inspeciona cookies HTTP e sinaliza flags de segurança.',
  'dns-records': 'Resolve registros A, AAAA, MX, NS, TXT e CNAME.',
  ghunt:
    'Consulta sinais públicos de um e-mail Google por um runner isolado e autorizado.',
  'http-headers': 'Lê headers HTTP e verifica políticas de segurança.',
  'hunter-io':
    'Busca e-mails profissionais de um domínio ou verifica um e-mail.',
  'ip-info': 'Descobre os endereços IP associados ao domínio consultado.',
  gobuster:
    'Enumera caminhos web com uma wordlist interna curta e perfil controlado.',
  katana: 'Faz um crawl web curto e limitado para encontrar URLs observáveis.',
  nmap: 'Identifica portas TCP abertas e versões de serviço nos top ports.',
  'redirect-chain': 'Segue a cadeia de redirecionamentos HTTP do alvo.',
  'robots-sitemap': 'Consulta robots.txt e sitemap.xml disponíveis no site.',
  'server-location': 'Estima a localização e a rede do IP público resolvido.',
  'server-status': 'Verifica disponibilidade e tempo de resposta do servidor.',
  nuclei:
    'Executa templates curados do Nuclei para encontrar vulnerabilidades e enriquecer CVEs com NVD, EPSS e CISA KEV.',
  shodan: 'Consulta portas, serviços e exposição observada pelo Shodan.',
  'ssl-certificate':
    'Inspeciona validade, emissor e subject do certificado TLS.',
  subfinder:
    'Descobre subdomínios de forma passiva usando fontes configuradas no runner.',
  'tech-stack': 'Detecta tecnologias e frameworks expostos pela página.',
  'virus-total': 'Consulta reputação e detecções agregadas do VirusTotal.',
  'whois-rdap': 'Consulta dados de registro via RDAP oficial.',
  'osint-framework':
    'Oferece referências curadas do OSINT Framework sem scraping automático.',
  phoneinfoga:
    'Analisa números com o PhoneInfoga oficial, scanners autorizados e resultados curados.',
};

export function getCheckDescription(
  check: Pick<CheckCatalogItem, 'id' | 'label'>,
): string {
  return (
    toolDescriptions[check.id] ??
    `Executa a verificação independente ${check.label} sobre o alvo informado.`
  );
}
