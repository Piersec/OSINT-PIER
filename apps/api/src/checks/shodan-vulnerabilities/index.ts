import type { CheckPlugin } from '../../core/checks/contract.js';
import { failure, success } from '../../core/checks/results.js';
import { isPublicAddress, resolveAddresses } from '../../core/network/ip.js';

const id = 'shodan-vulnerabilities';
const source = 'Shodan + NVD + FIRST EPSS + CISA KEV';
const SHODAN_HOST_URL = 'https://api.shodan.io/shodan/host';
const NVD_CVE_URL = 'https://services.nvd.nist.gov/rest/json/cves/2.0';
const EPSS_URL = 'https://api.first.org/data/v1/epss';
const CISA_KEV_URL =
  'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';

interface ShodanService {
  port?: number;
  transport?: string;
  product?: string;
  version?: string;
  cpe?: string[] | string;
  cpe23?: string[] | string;
}

interface ShodanResponse {
  ip_str?: string;
  vulns?: Record<string, unknown> | string[];
  data?: ShodanService[];
}

interface NvdCve {
  id?: string;
  descriptions?: Array<{ lang?: string; value?: string }>;
  metrics?: {
    cvssMetricV40?: CvssMetric[];
    cvssMetricV31?: CvssMetric[];
    cvssMetricV30?: CvssMetric[];
    cvssMetricV2?: CvssMetric[];
  };
}

interface CvssMetric {
  cvssData?: {
    baseScore?: number;
    baseSeverity?: string;
    vectorString?: string;
  };
}

interface NvdResponse {
  vulnerabilities?: Array<{ cve?: NvdCve }>;
}

interface KevEntry {
  cveID?: string;
  dateAdded?: string;
  dueDate?: string;
  product?: string;
  vendorProject?: string;
  vulnerabilityName?: string;
  knownRansomwareCampaignUse?: string;
}

interface KevResponse {
  vulnerabilities?: KevEntry[];
}

interface EpssEntry {
  cve?: string;
  epss?: string;
  percentile?: string;
}

interface EpssResponse {
  data?: EpssEntry[];
}

class ExternalSourceError extends Error {
  constructor(
    readonly service: string,
    readonly status: number,
  ) {
    super(`${service}:${status}`);
  }
}

interface ServiceFingerprint {
  port: number | null;
  transport: string | null;
  product: string | null;
  version: string | null;
  cpe: string | null;
}

interface VulnerabilityRecord {
  id: string;
  description: string | null;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'unknown';
  cvss: { score: number | null; vector: string | null };
  epss: { score: number | null; percentile: number | null };
  kev: boolean;
  priority: 'critical' | 'high' | 'medium' | 'low' | 'unknown';
  nvdUrl: string;
  kevDetails: {
    dateAdded: string | null;
    dueDate: string | null;
    product: string | null;
    vendor: string | null;
    ransomwareUse: string | null;
  } | null;
}

function apiFailure(status: number, service: string): string {
  if (status === 401)
    return `A credencial usada pela fonte ${service} é inválida.`;
  if (status === 403)
    return `A fonte ${service} reconheceu a credencial, mas o plano não permite esta consulta.`;
  if (status === 404) return `${service} não encontrou dados para este alvo.`;
  if (status === 429) return `O limite de uso do ${service} foi atingido.`;
  if (status >= 500) return `${service} está temporariamente indisponível.`;
  return `${service} respondeu com HTTP ${status}.`;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function firstCpe(service: ShodanService): string | null {
  const values = [service.cpe23, service.cpe].flatMap((value) =>
    Array.isArray(value) ? value : value ? [value] : [],
  );
  return values.map(asString).find(Boolean) ?? null;
}

function fingerprint(service: ShodanService): ServiceFingerprint {
  return {
    port: typeof service.port === 'number' ? service.port : null,
    transport: asString(service.transport),
    product: asString(service.product),
    version: asString(service.version),
    cpe: firstCpe(service),
  };
}

function chooseCvss(cve: NvdCve): CvssMetric['cvssData'] | undefined {
  const metrics = [
    ...(cve.metrics?.cvssMetricV40 ?? []),
    ...(cve.metrics?.cvssMetricV31 ?? []),
    ...(cve.metrics?.cvssMetricV30 ?? []),
    ...(cve.metrics?.cvssMetricV2 ?? []),
  ];
  return metrics.find((metric) => metric.cvssData)?.cvssData;
}

function severityFromCvss(
  score: number | null,
  label: string | null,
): VulnerabilityRecord['severity'] {
  const normalized = label?.toLowerCase();
  if (
    normalized === 'critical' ||
    normalized === 'high' ||
    normalized === 'medium' ||
    normalized === 'low'
  )
    return normalized;
  if (score === null) return 'unknown';
  if (score >= 9) return 'critical';
  if (score >= 7) return 'high';
  if (score >= 4) return 'medium';
  return 'low';
}

function priorityFor(
  severity: VulnerabilityRecord['severity'],
  kev: boolean,
  epss: number | null,
): VulnerabilityRecord['priority'] {
  if (kev || (epss !== null && epss >= 0.1 && severity === 'critical'))
    return 'critical';
  if (severity === 'critical' || severity === 'high') return 'high';
  return severity;
}

function nvdUrl(idValue: string): string {
  return `https://nvd.nist.gov/vuln/detail/${encodeURIComponent(idValue)}`;
}

async function getJson<T>(
  url: URL,
  signal: AbortSignal,
  service: string,
): Promise<T> {
  const response = await fetch(url, {
    signal,
    headers: {
      accept: 'application/json',
      'user-agent': 'OSINT-Pier/1.0 (internal security analysis)',
    },
  });
  if (!response.ok) throw new ExternalSourceError(service, response.status);
  return (await response.json()) as T;
}

async function queryNvd(
  params: { cveId?: string; keywordSearch?: string },
  signal: AbortSignal,
): Promise<NvdCve[]> {
  const url = new URL(NVD_CVE_URL);
  url.searchParams.set('resultsPerPage', '50');
  if (params.cveId) url.searchParams.set('cveId', params.cveId);
  if (params.keywordSearch)
    url.searchParams.set('keywordSearch', params.keywordSearch);
  const payload = await getJson<NvdResponse>(url, signal, 'NVD');
  return (payload.vulnerabilities ?? [])
    .map((entry) => entry.cve)
    .filter((cve): cve is NvdCve => Boolean(cve?.id));
}

async function queryEpss(
  ids: string[],
  signal: AbortSignal,
): Promise<Map<string, EpssEntry>> {
  const map = new Map<string, EpssEntry>();
  for (let index = 0; index < ids.length; index += 100) {
    const url = new URL(EPSS_URL);
    url.searchParams.set('cve', ids.slice(index, index + 100).join(','));
    const payload = await getJson<EpssResponse>(url, signal, 'FIRST EPSS');
    for (const entry of payload.data ?? []) {
      if (entry.cve) map.set(entry.cve.toUpperCase(), entry);
    }
  }
  return map;
}

async function queryKev(signal: AbortSignal): Promise<Map<string, KevEntry>> {
  const payload = await getJson<KevResponse>(
    new URL(CISA_KEV_URL),
    signal,
    'CISA KEV',
  );
  return new Map(
    (payload.vulnerabilities ?? [])
      .filter((entry) => entry.cveID)
      .map((entry) => [entry.cveID!.toUpperCase(), entry]),
  );
}

function toRecord(
  cve: NvdCve,
  epss: EpssEntry | undefined,
  kev: KevEntry | undefined,
): VulnerabilityRecord {
  const idValue = cve.id!;
  const cvss = chooseCvss(cve);
  const score = typeof cvss?.baseScore === 'number' ? cvss.baseScore : null;
  const severity = severityFromCvss(score, asString(cvss?.baseSeverity));
  const epssScore = epss?.epss ? Number(epss.epss) : null;
  const epssPercentile = epss?.percentile ? Number(epss.percentile) : null;
  return {
    id: idValue,
    description:
      cve.descriptions?.find((description) => description.lang === 'en')
        ?.value ??
      cve.descriptions?.[0]?.value ??
      null,
    severity,
    cvss: { score, vector: asString(cvss?.vectorString) },
    epss: {
      score: Number.isFinite(epssScore) ? epssScore : null,
      percentile: Number.isFinite(epssPercentile) ? epssPercentile : null,
    },
    kev: Boolean(kev),
    priority: priorityFor(
      severity,
      Boolean(kev),
      Number.isFinite(epssScore) ? epssScore : null,
    ),
    nvdUrl: nvdUrl(idValue),
    kevDetails: kev
      ? {
          dateAdded: asString(kev.dateAdded),
          dueDate: asString(kev.dueDate),
          product: asString(kev.product),
          vendor: asString(kev.vendorProject),
          ransomwareUse: asString(kev.knownRansomwareCampaignUse),
        }
      : null,
  };
}

const check: CheckPlugin = {
  id,
  label: 'Vulnerabilidades (CVE)',
  requiredEnv: ['SHODAN_API_KEY'],
  supportedTargetKinds: ['domain', 'ip', 'url'],
  timeoutMs: 30_000,
  async run(target, context) {
    const apiKey = context.credentials.SHODAN_API_KEY;
    if (!apiKey)
      return failure(id, source, 'Credencial SHODAN_API_KEY não configurada.');

    try {
      const addresses = await resolveAddresses(target.hostname);
      const resolvedAddresses = [...addresses.ipv4, ...addresses.ipv6];
      const selectedIp = resolvedAddresses.find(isPublicAddress);
      if (!selectedIp) {
        return success(id, source, {
          targetIp: null,
          total: 0,
          severityCounts: {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
            unknown: 0,
          },
          kevCount: 0,
          highEpssCount: 0,
          vulnerabilities: [],
          services: [],
          note: 'Nenhum IP público foi resolvido; o alvo não foi enviado às fontes externas.',
        });
      }

      const shodanUrl = new URL(
        `${SHODAN_HOST_URL}/${encodeURIComponent(selectedIp)}`,
      );
      shodanUrl.searchParams.set('key', apiKey);
      shodanUrl.searchParams.set('minify', 'true');
      const shodan = await getJson<ShodanResponse>(
        shodanUrl,
        context.signal,
        'Shodan',
      );
      const services = (shodan.data ?? []).slice(0, 40).map(fingerprint);
      const shodanCves = Array.isArray(shodan.vulns)
        ? shodan.vulns.filter(
            (value): value is string => typeof value === 'string',
          )
        : Object.keys(shodan.vulns ?? {});
      const cves = new Map<string, NvdCve>();

      for (const cveId of shodanCves.slice(0, 50)) {
        if (!/^CVE-\d{4}-\d{4,}$/i.test(cveId)) continue;
        for (const cve of await queryNvd({ cveId }, context.signal))
          cves.set(cve.id!.toUpperCase(), cve);
      }

      const fingerprints = services
        .filter((service) => service.product)
        .filter(
          (service, index, all) =>
            all.findIndex(
              (candidate) =>
                candidate.product === service.product &&
                candidate.version === service.version,
            ) === index,
        )
        .slice(0, 4);
      for (const service of fingerprints) {
        const keyword = [service.product, service.version]
          .filter(Boolean)
          .join(' ');
        if (!keyword) continue;
        for (const cve of await queryNvd(
          { keywordSearch: keyword },
          context.signal,
        ))
          cves.set(cve.id!.toUpperCase(), cve);
      }

      const ids = [...cves.keys()];
      const [epss, kev] = await Promise.all([
        ids.length
          ? queryEpss(ids, context.signal)
          : Promise.resolve(new Map<string, EpssEntry>()),
        queryKev(context.signal),
      ]);
      const vulnerabilities = [...cves.values()]
        .map((cve) =>
          toRecord(
            cve,
            epss.get(cve.id!.toUpperCase()),
            kev.get(cve.id!.toUpperCase()),
          ),
        )
        .sort((a, b) => {
          if (a.kev !== b.kev) return a.kev ? -1 : 1;
          return (b.cvss.score ?? -1) - (a.cvss.score ?? -1);
        })
        .slice(0, 100);
      const severityCounts = vulnerabilities.reduce(
        (counts, vulnerability) => {
          counts[vulnerability.severity] += 1;
          return counts;
        },
        { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 },
      );

      return success(id, source, {
        targetIp: selectedIp,
        resolvedAddresses,
        services,
        total: vulnerabilities.length,
        severityCounts,
        kevCount: vulnerabilities.filter((vulnerability) => vulnerability.kev)
          .length,
        highEpssCount: vulnerabilities.filter(
          (vulnerability) => (vulnerability.epss.score ?? 0) >= 0.1,
        ).length,
        vulnerabilities,
        sources: [
          {
            name: 'Shodan',
            url: `https://www.shodan.io/host/${encodeURIComponent(selectedIp)}`,
          },
          {
            name: 'NVD',
            url: 'https://nvd.nist.gov/developers/vulnerabilities',
          },
          { name: 'FIRST EPSS', url: 'https://www.first.org/epss/' },
          {
            name: 'CISA KEV',
            url: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog',
          },
        ],
        note: 'A correlação usa CPE quando o banner curado informa esse identificador e, como fallback, produto/versão observados. A prioridade combina CVSS do NVD, probabilidade EPSS e presença no catálogo CISA KEV; a ausência de CVE não prova que o ativo esteja livre de vulnerabilidades.',
      });
    } catch (error) {
      const message =
        error instanceof ExternalSourceError
          ? apiFailure(error.status, error.service)
          : 'Não foi possível consolidar as vulnerabilidades deste alvo.';
      return failure(id, source, message);
    }
  },
};

export default check;
