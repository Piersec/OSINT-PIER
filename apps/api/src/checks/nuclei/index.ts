import { spawn, type ChildProcessByStdio } from 'node:child_process';
import type { Readable } from 'node:stream';
import type { CheckPlugin } from '../../core/checks/contract.js';
import { isPublicAddress } from '../../core/network/ip.js';
import { failure } from '../../core/checks/results.js';

const id = 'nuclei';
const source = 'Nuclei + NVD + FIRST EPSS + CISA KEV';
const NUCLEI_DEFAULT_PATH = 'nuclei';
const NUCLEI_TEMPLATES_URL =
  'https://github.com/projectdiscovery/nuclei-templates';
const NUCLEI_REPOSITORY_URL = 'https://github.com/projectdiscovery/nuclei';
const NVD_CVE_URL = 'https://services.nvd.nist.gov/rest/json/cves/2.0';
const EPSS_URL = 'https://api.first.org/data/v1/epss';
const CISA_KEV_URL =
  'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
const MAX_FINDINGS = 100;
const MAX_CVES = 50;

type Severity = 'critical' | 'high' | 'medium' | 'low' | 'unknown';

interface NucleiClassification {
  'cve-id'?: string | string[];
  'cwe-id'?: string | string[];
  'cvss-score'?: number | string;
}

interface NucleiInfo {
  name?: string;
  author?: string | string[];
  severity?: string;
  description?: string;
  reference?: string | string[];
  tags?: string | string[];
  classification?: NucleiClassification;
}

interface NucleiJsonFinding {
  'template-id'?: string;
  'template-url'?: string;
  'template-path'?: string;
  info?: NucleiInfo;
  type?: string;
  host?: string;
  matched?: string;
  'matched-at'?: string;
  timestamp?: string;
}

interface NucleiFinding {
  id: string;
  name: string;
  severity: Severity;
  description: string | null;
  matchedAt: string | null;
  host: string | null;
  type: string | null;
  tags: string[];
  cveIds: string[];
  cweIds: string[];
  cvssScore: number | null;
  references: string[];
  templateUrl: string;
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

interface ServiceResult {
  findings: NucleiFinding[];
  exitCode: number | null;
}

class ExternalSourceError extends Error {
  constructor(
    readonly service: string,
    readonly status: number,
  ) {
    super(`${service}:${status}`);
  }
}

class NucleiUnavailableError extends Error {}

class NucleiProcessError extends Error {}

interface VulnerabilityRecord {
  id: string;
  description: string | null;
  severity: Severity;
  priority: Severity;
  cvss: { score: number | null; vector: string | null };
  epss: { score: number | null; percentile: number | null };
  kev: boolean;
  nvdUrl: string;
  cveIds: string[];
  matchedAt: string | null;
  templateUrl: string;
  scanner: 'nuclei';
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

function asStringList(value: unknown): string[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values.map(asString).filter((item): item is string => Boolean(item));
}

function normalizeSeverity(value: unknown): Severity {
  const normalized = asString(value)?.toLowerCase();
  if (
    normalized === 'critical' ||
    normalized === 'high' ||
    normalized === 'medium' ||
    normalized === 'low'
  )
    return normalized;
  return 'unknown';
}

function finiteNumber(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function cveIdsFrom(value: unknown): string[] {
  return asStringList(value)
    .flatMap((item) => item.match(/CVE-\d{4}-\d{4,}/gi) ?? [])
    .map((item) => item.toUpperCase())
    .filter((item, index, all) => all.indexOf(item) === index);
}

function cveIdsFromFinding(finding: NucleiJsonFinding): string[] {
  const classification = finding.info?.classification;
  const fields = [
    ...cveIdsFrom(classification?.['cve-id']),
    ...cveIdsFrom(finding['template-id']),
    ...cveIdsFrom(finding.info?.name),
    ...cveIdsFrom(finding.info?.description),
    ...cveIdsFrom(finding.info?.reference),
  ];
  return fields.filter((item, index, all) => all.indexOf(item) === index);
}

function toFinding(value: NucleiJsonFinding): NucleiFinding | null {
  const templateId = asString(value['template-id']);
  if (!templateId || !value.info) return null;
  const info = value.info;
  const cveIds = cveIdsFromFinding(value);
  const templateUrl =
    asString(value['template-url']) ??
    `${NUCLEI_TEMPLATES_URL}/search?q=${encodeURIComponent(templateId)}`;
  return {
    id: templateId,
    name: asString(info.name) ?? templateId,
    severity: normalizeSeverity(info.severity),
    description: asString(info.description),
    matchedAt: asString(value['matched-at']) ?? asString(value.matched),
    host: asString(value.host),
    type: asString(value.type),
    tags: asStringList(info.tags),
    cveIds,
    cweIds: asStringList(info.classification?.['cwe-id']),
    cvssScore: finiteNumber(info.classification?.['cvss-score']),
    references: asStringList(info.reference).slice(0, 5),
    templateUrl,
  };
}

export function parseNucleiJsonl(output: string): NucleiFinding[] {
  const findings: NucleiFinding[] = [];
  for (const line of output.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as NucleiJsonFinding;
      const finding = toFinding(parsed);
      if (finding) findings.push(finding);
    } catch {
      // Banner/status lines are ignored; JSONL findings remain usable.
    }
    if (findings.length >= MAX_FINDINGS) break;
  }
  return findings;
}

function nucleiEnvironment(): NodeJS.ProcessEnv {
  const names = [
    'PATH',
    'HOME',
    'USERPROFILE',
    'APPDATA',
    'LOCALAPPDATA',
    'TEMP',
    'TMP',
    'XDG_CONFIG_HOME',
    'XDG_CACHE_HOME',
    'XDG_DATA_HOME',
  ];
  return Object.fromEntries(
    names
      .map((name) => [name, process.env[name]])
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}

function runNuclei(
  target: string,
  signal: AbortSignal,
): Promise<ServiceResult> {
  const executable = process.env.NUCLEI_PATH?.trim() || NUCLEI_DEFAULT_PATH;
  const args = [
    '-u',
    target,
    '-jsonl',
    '-silent',
    '-no-color',
    '-omit-raw',
    '-omit-template',
    '-disable-update-check',
    '-no-interactsh',
    '-restrict-local-network-access',
    '-exclude-tags',
    'dos,fuzz,bruteforce,headless,default-logins',
    '-severity',
    'low,medium,high,critical,unknown',
    '-rate-limit',
    '50',
    '-concurrency',
    '10',
    '-bulk-size',
    '10',
  ];
  const templateDirectory = process.env.NUCLEI_TEMPLATE_DIR?.trim();
  if (templateDirectory) args.push('-templates', templateDirectory);

  return new Promise((resolve, reject) => {
    let child: ChildProcessByStdio<null, Readable, Readable>;
    try {
      child = spawn(executable, args, {
        env: nucleiEnvironment(),
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
    } catch {
      reject(new NucleiUnavailableError());
      return;
    }

    let stdout = '';
    let stderr = '';
    let settled = false;
    let abort = () => undefined;
    const cleanup = () => signal.removeEventListener('abort', abort);
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };
    abort = () => {
      child.kill();
      finish(() => reject(new NucleiProcessError()));
    };

    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener('abort', abort, { once: true });

    child.stdout.on('data', (chunk: Buffer | string) => {
      stdout += chunk.toString();
      if (Buffer.byteLength(stdout) > MAX_OUTPUT_BYTES) {
        child.kill();
        finish(() => reject(new NucleiProcessError()));
      }
    });
    child.stderr.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString();
      if (Buffer.byteLength(stderr) > MAX_OUTPUT_BYTES)
        stderr = stderr.slice(-MAX_OUTPUT_BYTES);
    });
    child.once('error', (error: NodeJS.ErrnoException) => {
      finish(() => {
        if (error.code === 'ENOENT') reject(new NucleiUnavailableError());
        else reject(new NucleiProcessError());
      });
    });
    child.once('close', (code: number | null) => {
      finish(() => {
        const findings = parseNucleiJsonl(stdout);
        if (code !== 0 && findings.length === 0) {
          void stderr;
          reject(new NucleiProcessError());
          return;
        }
        resolve({ findings, exitCode: code });
      });
    });
  });
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
): Severity {
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
  severity: Severity,
  kev: boolean,
  epss: number | null,
): Severity {
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
  cveId: string,
  signal: AbortSignal,
): Promise<NvdCve | undefined> {
  const url = new URL(NVD_CVE_URL);
  url.searchParams.set('resultsPerPage', '1');
  url.searchParams.set('cveId', cveId);
  const payload = await getJson<NvdResponse>(url, signal, 'NVD');
  return payload.vulnerabilities?.[0]?.cve;
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

function skipped(error: string) {
  return {
    id,
    status: 'skipped' as const,
    error,
    source: 'Nuclei CLI',
    durationMs: 0,
  };
}

function findingKey(finding: NucleiFinding): string {
  return finding.cveIds[0] ?? `${finding.id}:${finding.matchedAt ?? ''}`;
}

function toRecord(
  finding: NucleiFinding,
  nvd: NvdCve | undefined,
  epss: EpssEntry | undefined,
  kev: KevEntry | undefined,
): VulnerabilityRecord {
  const cvss = nvd ? chooseCvss(nvd) : undefined;
  const nvdScore = finiteNumber(cvss?.baseScore);
  const score = nvdScore ?? finding.cvssScore;
  const severity = nvd
    ? severityFromCvss(score, asString(cvss?.baseSeverity))
    : finding.severity;
  const epssScore = finiteNumber(epss?.epss);
  const epssPercentile = finiteNumber(epss?.percentile);
  const cveId = finding.cveIds[0];
  return {
    id: cveId ?? finding.id,
    description:
      asString(
        nvd?.descriptions?.find((description) => description.lang === 'en')
          ?.value,
      ) ??
      asString(nvd?.descriptions?.[0]?.value) ??
      finding.description,
    severity,
    priority: priorityFor(severity, Boolean(kev), epssScore),
    cvss: {
      score,
      vector: asString(cvss?.vectorString),
    },
    epss: {
      score: epssScore,
      percentile: epssPercentile,
    },
    kev: Boolean(kev),
    nvdUrl: cveId ? nvdUrl(cveId) : finding.templateUrl,
    cveIds: finding.cveIds,
    matchedAt: finding.matchedAt,
    templateUrl: finding.templateUrl,
    scanner: 'nuclei',
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
  label: 'Vulnerabilidades (Nuclei)',
  requiredEnv: [],
  supportedTargetKinds: ['domain', 'ip', 'url'],
  timeoutMs: 60_000,
  async run(target, context) {
    try {
      if (target.kind === 'ip' && !isPublicAddress(target.hostname)) {
        return skipped(
          'Endereços IP privados/reservados não são enviados ao Nuclei.',
        );
      }

      const scan = await runNuclei(target.value, context.signal);
      const findings = scan.findings;
      const cveIds = findings
        .flatMap((finding) => finding.cveIds)
        .filter((value, index, all) => all.indexOf(value) === index)
        .slice(0, MAX_CVES);
      const cves = new Map<string, NvdCve>();

      for (const cveId of cveIds) {
        const cve = await queryNvd(cveId, context.signal);
        if (cve?.id) cves.set(cve.id.toUpperCase(), cve);
      }

      const [epss, kev] = cveIds.length
        ? await Promise.all([
            queryEpss(cveIds, context.signal),
            queryKev(context.signal),
          ])
        : [new Map<string, EpssEntry>(), new Map<string, KevEntry>()];

      const records = new Map<string, VulnerabilityRecord>();
      for (const finding of findings) {
        const primaryCve = finding.cveIds[0];
        const record = toRecord(
          finding,
          primaryCve ? cves.get(primaryCve) : undefined,
          primaryCve ? epss.get(primaryCve) : undefined,
          primaryCve ? kev.get(primaryCve) : undefined,
        );
        const key = findingKey(finding);
        if (!records.has(key)) records.set(key, record);
      }

      const vulnerabilities = [...records.values()]
        .sort((a, b) => {
          if (a.kev !== b.kev) return a.kev ? -1 : 1;
          return (b.cvss.score ?? -1) - (a.cvss.score ?? -1);
        })
        .slice(0, MAX_FINDINGS);
      const severityCounts = vulnerabilities.reduce(
        (counts, vulnerability) => {
          counts[vulnerability.severity] += 1;
          return counts;
        },
        { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 },
      );

      return {
        id,
        status: 'success' as const,
        data: {
          target: target.value,
          total: vulnerabilities.length,
          cveCount: vulnerabilities.filter(
            (vulnerability) => vulnerability.cveIds.length > 0,
          ).length,
          severityCounts,
          kevCount: vulnerabilities.filter((vulnerability) => vulnerability.kev)
            .length,
          highEpssCount: vulnerabilities.filter(
            (vulnerability) => (vulnerability.epss.score ?? 0) >= 0.1,
          ).length,
          vulnerabilities,
          sources: [
            { name: 'Nuclei', url: NUCLEI_REPOSITORY_URL },
            { name: 'Nuclei templates', url: NUCLEI_TEMPLATES_URL },
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
          note: 'O Nuclei executa templates comunitários em modo curado, sem templates de fuzzing, headless, brute force ou default-login. CVEs são enriquecidos com CVSS do NVD, probabilidade EPSS e presença no catálogo CISA KEV. Execute somente contra ativos autorizados; a ausência de achados não prova que o ativo esteja livre de vulnerabilidades.',
          ...(scan.exitCode !== 0
            ? {
                warning:
                  'O Nuclei encerrou com um código parcial, mas retornou achados.',
              }
            : {}),
        },
        source,
        durationMs: 0,
      };
    } catch (error) {
      if (error instanceof NucleiUnavailableError) {
        return skipped(
          'Nuclei não está instalado neste ambiente. Configure NUCLEI_PATH ou instale o binário antes de executar este check.',
        );
      }
      if (error instanceof ExternalSourceError) {
        return failure(id, source, apiFailure(error.status, error.service));
      }
      return failure(
        id,
        source,
        'Não foi possível executar o Nuclei ou consolidar seus achados.',
      );
    }
  },
};

export default check;
