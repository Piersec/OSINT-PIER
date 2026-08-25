import type { CheckCatalogItem } from '@osint-pier/contracts';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import type { TooltipContentProps } from 'recharts';
import type { CardState } from '../checks/ResultCard';

type SecuritySeverity = 'critical' | 'high' | 'medium' | 'low' | 'unknown';
type InsightTone = 'neutral' | 'positive' | 'attention' | 'critical';

interface VulnerabilityDatum {
  key: SecuritySeverity;
  name: string;
  value: number;
  color: string;
}

interface SecurityFailureDatum {
  id: string;
  name: string;
  value: number;
  detail: string;
}

interface ReputationDatum {
  id: string;
  name: string;
  value: number;
  rawValue: number;
  detail: string;
  color: string;
}

interface PostureAxisDatum {
  subject: string;
  score: number;
  fullMark: 100;
  detail: string;
}

interface CriticalityPoint {
  x: number;
  y: number;
  z: number;
  name: string;
  detail: string;
  color: string;
}

interface ReputationSnapshot {
  entries: ReputationDatum[];
  malicious: number;
  suspicious: number;
  abuseConfidenceScore: number | null;
  hasEvidence: boolean;
}

interface RiskSignals {
  vulnerabilities: VulnerabilityDatum[];
  vulnerabilityTotal: number;
  criticalVulnerabilityTotal: number;
  hasVulnerabilityEvidence: boolean;
  kevCount: number;
  highEpssCount: number;
  securityFailures: SecurityFailureDatum[];
  securityFailureTotal: number;
  hasFailureEvidence: boolean;
  postureScore: number | null;
  riskScore: number | null;
  criticalityLabel: string;
  postureAxes: PostureAxisDatum[];
  criticalityPoints: CriticalityPoint[];
  reputation: ReputationSnapshot;
}

export interface AnalysisInsight {
  label: string;
  value: string;
  detail: string;
  tone: InsightTone;
}

export interface AnalysisSnapshot extends RiskSignals {
  insights: AnalysisInsight[];
}

const vulnerabilityMeta: Record<
  SecuritySeverity,
  { name: string; color: string; weight: number; axis: number }
> = {
  critical: { name: 'Crítica', color: '#ff5f68', weight: 30, axis: 5 },
  high: { name: 'Alta', color: '#ff9d63', weight: 18, axis: 4 },
  medium: { name: 'Média', color: '#f2cf66', weight: 9, axis: 3 },
  low: { name: 'Baixa', color: '#48e9ff', weight: 4, axis: 2 },
  unknown: { name: 'Sem score', color: '#727a7d', weight: 2, axis: 1 },
};

const criticalityLabels: Record<number, string> = {
  1: 'Sem score',
  2: 'Baixa',
  3: 'Média',
  4: 'Alta',
  5: 'Crítica',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function clamp(value: number, minimum = 0, maximum = 100): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function headerLabel(value: string): string {
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function addSecurityFailure(
  failures: Map<string, SecurityFailureDatum>,
  id: string,
  name: string,
  value: number,
  detail: string,
) {
  if (!Number.isFinite(value) || value <= 0) return;
  const current = failures.get(id);
  failures.set(id, {
    id,
    name,
    value: (current?.value ?? 0) + value,
    detail,
  });
}

function criticalityLabel(riskScore: number | null): string {
  if (riskScore === null) return 'Sem leitura';
  if (riskScore >= 70) return 'Crítica';
  if (riskScore >= 40) return 'Alta';
  if (riskScore >= 15) return 'Moderada';
  return 'Controlada';
}

function postureTone(riskScore: number | null): InsightTone {
  if (riskScore === null) return 'neutral';
  if (riskScore >= 70) return 'critical';
  if (riskScore >= 15) return 'attention';
  return 'positive';
}

function postureColor(postureScore: number | null): string {
  if (postureScore === null) return 'var(--muted)';
  if (postureScore < 30) return 'var(--danger)';
  if (postureScore < 60) return '#ff9d63';
  if (postureScore < 85) return '#f2cf66';
  return 'var(--accent)';
}

function collectRiskSignals(
  checks: CheckCatalogItem[],
  states: Record<string, CardState>,
): RiskSignals {
  const vulnerabilityCounts: Record<SecuritySeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    unknown: 0,
  };
  const failures = new Map<string, SecurityFailureDatum>();
  const reputationStats = {
    malicious: 0,
    suspicious: 0,
    harmless: 0,
    undetected: 0,
    timeout: 0,
    total: 0,
  };
  let kevCount = 0;
  let highEpssCount = 0;
  let abuseConfidenceScore: number | null = null;
  let hasSecurityEvidence = false;
  let hasVulnerabilityEvidence = false;
  let hasFailureEvidence = false;
  let tlsRiskScore = 0;

  for (const check of checks) {
    const state = states[check.id];
    if (state?.status !== 'done' || state.result.status !== 'success') {
      continue;
    }
    if (!isRecord(state.result.data)) continue;

    const data = state.result.data;
    if (check.id === 'shodan-vulnerabilities') {
      hasSecurityEvidence = true;
      hasVulnerabilityEvidence = true;
      const severityCounts = isRecord(data.severityCounts)
        ? data.severityCounts
        : {};
      for (const severity of Object.keys(
        vulnerabilityCounts,
      ) as SecuritySeverity[]) {
        const count = numberValue(severityCounts[severity]);
        if (count !== null) vulnerabilityCounts[severity] += Math.max(0, count);
      }
      kevCount += Math.max(0, numberValue(data.kevCount) ?? 0);
      highEpssCount += Math.max(0, numberValue(data.highEpssCount) ?? 0);
      const total = Math.max(0, numberValue(data.total) ?? 0);
      const knownCount = Object.values(vulnerabilityCounts).reduce(
        (sum, count) => sum + count,
        0,
      );
      if (total > knownCount) vulnerabilityCounts.unknown += total - knownCount;
    }

    if (check.id === 'http-headers') {
      hasSecurityEvidence = true;
      hasFailureEvidence = true;
      const security = isRecord(data.security) ? data.security : {};
      const missingHeaders = Object.entries(security).filter(
        ([, value]) => isRecord(value) && value.present === false,
      );
      if (missingHeaders.length) {
        for (const [header] of missingHeaders) {
          addSecurityFailure(
            failures,
            `header-${header}`,
            headerLabel(header),
            1,
            'Header de segurança ausente',
          );
        }
      } else if (isRecord(data.securityScore)) {
        const present = numberValue(data.securityScore.present) ?? 0;
        const total = numberValue(data.securityScore.total) ?? 0;
        addSecurityFailure(
          failures,
          'security-headers',
          'Headers de segurança',
          Math.max(0, total - present),
          'Headers recomendados ausentes',
        );
      }
    }

    if (check.id === 'cookies') {
      hasSecurityEvidence = true;
      hasFailureEvidence = true;
      const count = Math.max(0, numberValue(data.count) ?? 0);
      const summary = isRecord(data.summary) ? data.summary : {};
      for (const [key, label] of [
        ['secure', 'Cookies sem Secure'],
        ['httpOnly', 'Cookies sem HttpOnly'],
        ['sameSite', 'Cookies sem SameSite'],
      ] as const) {
        const protectedCount = Math.max(0, numberValue(summary[key]) ?? 0);
        addSecurityFailure(
          failures,
          `cookies-${key}`,
          label,
          Math.max(0, count - protectedCount),
          'Atributo de proteção ausente',
        );
      }
    }

    if (check.id === 'ssl-certificate') {
      hasSecurityEvidence = true;
      hasFailureEvidence = true;
      if (data.authorized === false) {
        tlsRiskScore += 50;
        addSecurityFailure(
          failures,
          'tls-authorization',
          'Certificado não autorizado',
          1,
          'A cadeia TLS não foi autorizada',
        );
      }
      if (data.hostnameMatches === false) {
        tlsRiskScore += 40;
        addSecurityFailure(
          failures,
          'tls-hostname',
          'Hostname incompatível',
          1,
          'O certificado não corresponde ao hostname',
        );
      }
      const daysRemaining = numberValue(data.daysRemaining);
      if (daysRemaining !== null) {
        if (daysRemaining < 0) {
          tlsRiskScore += 50;
          addSecurityFailure(
            failures,
            'tls-expired',
            'Certificado expirado',
            1,
            'A validade do certificado terminou',
          );
        } else if (daysRemaining < 30) {
          tlsRiskScore += 20;
        }
      }
    }

    if (check.id === 'abuse-ipdb') {
      hasSecurityEvidence = true;
      hasFailureEvidence = true;
      const score = numberValue(data.abuseConfidenceScore);
      if (score !== null) {
        abuseConfidenceScore = Math.max(abuseConfidenceScore ?? 0, score);
      }
      if ((score ?? 0) >= 75) {
        addSecurityFailure(
          failures,
          'abuse-high-confidence',
          'Alta confiança de abuso',
          1,
          'Reputação IP acima de 75%',
        );
      } else if ((score ?? 0) >= 25) {
        addSecurityFailure(
          failures,
          'abuse-confidence',
          'Confiança de abuso',
          1,
          'Reputação IP entre 25% e 74%',
        );
      }
    }

    if (check.id === 'virus-total') {
      hasSecurityEvidence = true;
      const analysis = isRecord(data.analysis) ? data.analysis : {};
      const stats = isRecord(analysis.stats) ? analysis.stats : {};
      for (const key of [
        'malicious',
        'suspicious',
        'harmless',
        'undetected',
        'timeout',
      ] as const) {
        reputationStats[key] += Math.max(0, numberValue(stats[key]) ?? 0);
      }
      reputationStats.total = Object.values(reputationStats).reduce(
        (sum, count) => sum + count,
        0,
      );
    }
  }

  const vulnerabilities = (Object.keys(vulnerabilityMeta) as SecuritySeverity[])
    .map((key) => ({
      key,
      ...vulnerabilityMeta[key],
      value: vulnerabilityCounts[key],
    }))
    .filter((item) => item.value > 0);
  const securityFailures = [...failures.values()]
    .sort((left, right) => right.value - left.value)
    .slice(0, 8);
  const vulnerabilityRisk = (
    Object.keys(vulnerabilityCounts) as SecuritySeverity[]
  ).reduce(
    (sum, severity) =>
      sum + vulnerabilityCounts[severity] * vulnerabilityMeta[severity].weight,
    0,
  );
  const exploitationRisk = kevCount * 40 + highEpssCount * 15;
  const hygieneRisk =
    [...failures.values()].reduce((sum, item) => sum + item.value, 0) * 12;
  const reputationRisk = Math.max(
    abuseConfidenceScore ?? 0,
    reputationStats.malicious * 35 + reputationStats.suspicious * 18,
  );
  const axes: PostureAxisDatum[] = [
    {
      subject: 'Exposição',
      score: clamp(vulnerabilityRisk),
      fullMark: 100,
      detail: `${vulnerabilityCounts.critical + vulnerabilityCounts.high} CVEs críticas/altas`,
    },
    {
      subject: 'Exploração',
      score: clamp(exploitationRisk),
      fullMark: 100,
      detail: `${kevCount} KEV e ${highEpssCount} EPSS alto`,
    },
    {
      subject: 'Reputação',
      score: clamp(reputationRisk),
      fullMark: 100,
      detail: `${reputationStats.malicious} detecções maliciosas e AbuseIPDB`,
    },
    {
      subject: 'Higiene',
      score: clamp(hygieneRisk),
      fullMark: 100,
      detail: `${securityFailures.reduce((sum, item) => sum + item.value, 0)} falhas de proteção`,
    },
    {
      subject: 'TLS',
      score: clamp(tlsRiskScore),
      fullMark: 100,
      detail: tlsRiskScore
        ? 'Validade ou cadeia TLS exigem revisão'
        : 'Cadeia TLS sem sinal crítico',
    },
  ];
  const riskScore = hasSecurityEvidence
    ? Math.round(
        clamp(
          vulnerabilityRisk * 0.3 +
            exploitationRisk * 0.2 +
            hygieneRisk * 0.25 +
            reputationRisk * 0.15 +
            tlsRiskScore * 0.1,
        ),
      )
    : null;
  const postureScore = riskScore === null ? null : 100 - riskScore;
  const reputationTotal = reputationStats.total;
  const reputationEntries: ReputationDatum[] = [];
  if (reputationTotal > 0) {
    for (const [key, label, color] of [
      ['malicious', 'VT malicioso', '#ff5f68'],
      ['suspicious', 'VT suspeito', '#ff9d63'],
      ['harmless', 'VT inofensivo', '#48e9ff'],
      ['undetected', 'VT não detectado', '#727a7d'],
      ['timeout', 'VT sem resposta', '#f2cf66'],
    ] as const) {
      const rawValue = reputationStats[key];
      if (rawValue === 0) continue;
      reputationEntries.push({
        id: `virustotal-${key}`,
        name: label,
        value: Math.round((rawValue / reputationTotal) * 100),
        rawValue,
        detail: `${rawValue} de ${reputationTotal} motores`,
        color,
      });
    }
  }
  if (abuseConfidenceScore !== null) {
    reputationEntries.push({
      id: 'abuse-ipdb',
      name: 'AbuseIPDB',
      value: abuseConfidenceScore,
      rawValue: abuseConfidenceScore,
      detail: `${abuseConfidenceScore}% de confiança de abuso`,
      color: '#f2cf66',
    });
  }

  const criticalityPoints: CriticalityPoint[] = vulnerabilities.map((item) => ({
    x: vulnerabilityMeta[item.key].axis,
    y: item.value,
    z: Math.min(600, 90 + item.value * 50),
    name: `${item.name} · CVEs`,
    detail: `${item.value} vulnerabilidade${item.value === 1 ? '' : 's'} ${item.name.toLowerCase()}`,
    color: item.color,
  }));
  if (securityFailures.length) {
    criticalityPoints.push({
      x: 3,
      y: securityFailures.reduce((sum, item) => sum + item.value, 0),
      z: Math.min(600, 90 + securityFailures.length * 50),
      name: 'Falhas de segurança',
      detail: `${securityFailures.length} categorias de proteção exigem revisão`,
      color: '#ff5f68',
    });
  }
  if (reputationStats.malicious > 0) {
    criticalityPoints.push({
      x: 4,
      y: reputationStats.malicious,
      z: Math.min(600, 90 + reputationStats.malicious * 50),
      name: 'Detecções maliciosas',
      detail: `${reputationStats.malicious} motores sinalizaram comportamento malicioso`,
      color: '#ff5f68',
    });
  }

  return {
    vulnerabilities,
    vulnerabilityTotal: vulnerabilities.reduce(
      (sum, item) => sum + item.value,
      0,
    ),
    criticalVulnerabilityTotal: vulnerabilityCounts.critical,
    hasVulnerabilityEvidence,
    kevCount,
    highEpssCount,
    securityFailures,
    securityFailureTotal: [...failures.values()].reduce(
      (sum, item) => sum + item.value,
      0,
    ),
    hasFailureEvidence,
    postureScore,
    riskScore,
    criticalityLabel: criticalityLabel(riskScore),
    postureAxes: axes,
    criticalityPoints,
    reputation: {
      entries: reputationEntries,
      malicious: reputationStats.malicious,
      suspicious: reputationStats.suspicious,
      abuseConfidenceScore,
      hasEvidence: reputationTotal > 0 || abuseConfidenceScore !== null,
    },
  };
}

export function buildAnalysisSnapshot(
  checks: CheckCatalogItem[],
  states: Record<string, CardState>,
): AnalysisSnapshot {
  const signals = collectRiskSignals(checks, states);
  const hasSecurityEvidence = signals.riskScore !== null;
  const insights: AnalysisInsight[] = [
    {
      label: 'Índice de risco',
      value: signals.riskScore === null ? '—' : `${signals.riskScore}/100`,
      detail:
        signals.riskScore === null
          ? 'Aguardando sinais de segurança.'
          : `Criticidade ${signals.criticalityLabel.toLowerCase()} · postura ${signals.postureScore}/100.`,
      tone: postureTone(signals.riskScore),
    },
    {
      label: 'CVEs críticas',
      value: signals.hasVulnerabilityEvidence
        ? String(signals.criticalVulnerabilityTotal)
        : '—',
      detail: !signals.hasVulnerabilityEvidence
        ? hasSecurityEvidence
          ? 'Nenhuma fonte de vulnerabilidades retornou nesta rodada.'
          : 'Aguardando sinais de segurança.'
        : signals.vulnerabilityTotal > 0
          ? `${signals.vulnerabilityTotal} vulnerabilidades correlacionadas no total.`
          : 'Nenhuma vulnerabilidade correlacionada nesta rodada.',
      tone: !signals.hasVulnerabilityEvidence
        ? 'neutral'
        : signals.criticalVulnerabilityTotal > 0
          ? 'critical'
          : 'positive',
    },
    {
      label: 'Exploração conhecida',
      value: signals.hasVulnerabilityEvidence ? String(signals.kevCount) : '—',
      detail: !signals.hasVulnerabilityEvidence
        ? hasSecurityEvidence
          ? 'A correlação de CVEs não retornou dados nesta rodada.'
          : 'Aguardando sinais de segurança.'
        : signals.highEpssCount > 0
          ? `${signals.highEpssCount} CVE${signals.highEpssCount === 1 ? '' : 's'} com EPSS alto.`
          : 'Nenhum sinal de exploração provável foi correlacionado.',
      tone: !signals.hasVulnerabilityEvidence
        ? 'neutral'
        : signals.kevCount > 0 || signals.highEpssCount > 0
          ? 'critical'
          : 'positive',
    },
    {
      label: 'Falhas de segurança',
      value: signals.hasFailureEvidence
        ? String(signals.securityFailureTotal)
        : '—',
      detail: !signals.hasFailureEvidence
        ? hasSecurityEvidence
          ? 'Nenhuma fonte de higiene retornou dados nesta rodada.'
          : 'Aguardando sinais de segurança.'
        : signals.securityFailureTotal > 0
          ? 'Headers, cookies, TLS ou reputação exigem revisão.'
          : 'Nenhuma falha de proteção observada.',
      tone: !signals.hasFailureEvidence
        ? 'neutral'
        : signals.securityFailureTotal > 0
          ? 'attention'
          : 'positive',
    },
  ];

  return { ...signals, insights };
}

function SecurityChartTooltip({
  active,
  label,
  payload,
}: TooltipContentProps) {
  if (!active || !payload?.length) return null;

  const entry = payload[0];
  if (!entry) return null;
  const data = isRecord(entry.payload) ? entry.payload : {};
  const title =
    typeof data.name === 'string'
      ? data.name
      : typeof data.subject === 'string'
        ? data.subject
        : String(label ?? 'Sinal de segurança');
  const detail =
    typeof data.detail === 'string'
      ? data.detail
      : 'Sinal derivado da postura de segurança';
  const rawValue = numberValue(data.value) ?? numberValue(entry.value);
  const isPercentage =
    title.startsWith('VT ') || title === 'AbuseIPDB' || title === 'Postura';
  const value = rawValue === null ? '—' : `${rawValue}${isPercentage ? '%' : ''}`;
  const color =
    typeof data.color === 'string'
      ? data.color
      : typeof entry.color === 'string'
        ? entry.color
        : 'var(--accent)';

  return (
    <div className="analysis-chart-tooltip" role="tooltip">
      <span className="analysis-chart-tooltip__eyebrow">
        Sinal de segurança
      </span>
      <strong className="analysis-chart-tooltip__title">{title}</strong>
      <div className="analysis-chart-tooltip__value">
        <i aria-hidden="true" style={{ backgroundColor: color, color }} />
        <b>{value}</b>
      </div>
      <span className="analysis-chart-tooltip__detail">{detail}</span>
    </div>
  );
}

export function AnalysisInsights({
  checks,
  states,
  target,
}: {
  checks: CheckCatalogItem[];
  states: Record<string, CardState>;
  target: string | null;
}) {
  const snapshot = buildAnalysisSnapshot(checks, states);
  const isRunning = Object.values(states).some(
    (state) => state.status === 'loading',
  );
  const postureData =
    snapshot.postureScore === null
      ? []
      : [
          {
            name: 'Postura',
            value: snapshot.postureScore,
            fill: postureColor(snapshot.postureScore),
          },
        ];
  const reputationData = snapshot.reputation.entries;

  return (
    <section className="analysis-insights" aria-live="polite">
      <header className="analysis-insights__header">
        <div>
          <span className="eyebrow">Leitura de risco</span>
          <h3>Panorama de segurança</h3>
          <p>
            {target
              ? `Criticidade, exposição e postura de segurança observadas em ${target}.`
              : 'Os sinais de segurança serão preenchidos assim que uma análise começar.'}
          </p>
        </div>
        <span
          className={`analysis-insights__live ${isRunning ? 'analysis-insights__live--active' : ''}`}
        >
          <i aria-hidden="true" />
          {isRunning
            ? 'Atualizando agora'
            : snapshot.riskScore !== null
              ? 'Leitura disponível'
              : 'Aguardando sinais'}
        </span>
      </header>

      <div className="analysis-insights__cards">
        {snapshot.insights.map((insight) => (
          <article
            className={`analysis-insight-card analysis-insight-card--${insight.tone}`}
            key={insight.label}
          >
            <span>{insight.label}</span>
            <strong>{insight.value}</strong>
            <small>{insight.detail}</small>
          </article>
        ))}
      </div>

      <div className="analysis-insights__charts">
        <article className="analysis-chart-card analysis-chart-card--posture">
          <div className="analysis-chart-card__heading">
            <div>
              <span className="eyebrow">Índice derivado</span>
              <h4>Postura de segurança</h4>
            </div>
            <span>{snapshot.criticalityLabel}</span>
          </div>
          <div className="analysis-chart analysis-chart--radial">
            {postureData.length ? (
              <ResponsiveContainer height={235} width="100%">
                <RadialBarChart
                  barSize={16}
                  cx="50%"
                  cy="50%"
                  data={postureData}
                  endAngle={-270}
                  innerRadius="70%"
                  outerRadius="100%"
                  startAngle={90}
                >
                  <RadialBar
                    background={{ fill: 'var(--surface-strong)' }}
                    cornerRadius={12}
                    dataKey="value"
                  />
                </RadialBarChart>
              </ResponsiveContainer>
            ) : (
              <div className="analysis-chart__empty">
                Nenhum sinal de segurança disponível.
              </div>
            )}
            {snapshot.postureScore !== null && (
              <div className="analysis-chart--radial__center">
                <strong>{snapshot.postureScore}</strong>
                <span>postura / 100</span>
              </div>
            )}
          </div>
          <p className="analysis-chart-card__note">
            Quanto maior a postura, menor a carga de risco observada. O índice é
            derivado de vulnerabilidades, exploração, reputação, higiene e TLS.
          </p>
        </article>

        <article className="analysis-chart-card analysis-chart-card--radar">
          <div className="analysis-chart-card__heading">
            <div>
              <span className="eyebrow">Vetor de ameaça</span>
              <h4>Radar de exposição</h4>
            </div>
            <span>0–100</span>
          </div>
          <div className="analysis-chart analysis-chart--radar-plot">
            {snapshot.riskScore !== null ? (
              <ResponsiveContainer height={235} width="100%">
                <RadarChart data={snapshot.postureAxes} outerRadius="70%">
                  <PolarGrid stroke="var(--border-strong)" />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fill: 'var(--muted)', fontSize: 9 }}
                  />
                  <PolarRadiusAxis
                    angle={30}
                    domain={[0, 100]}
                    tick={{ fill: 'var(--muted)', fontSize: 8 }}
                  />
                  <Radar
                    dataKey="score"
                    fill="var(--danger)"
                    fillOpacity={0.2}
                    name="Risco"
                    stroke="var(--danger)"
                    strokeWidth={2}
                  />
                  <Tooltip
                    content={SecurityChartTooltip}
                  />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="analysis-chart__empty">
                Aguardando dados de postura.
              </div>
            )}
          </div>
          <p className="analysis-chart-card__note">
            Picos maiores indicam concentração de sinais no vetor indicado.
          </p>
        </article>

        <article className="analysis-chart-card analysis-chart-card--criticality">
          <div className="analysis-chart-card__heading">
            <div>
              <span className="eyebrow">Priorização</span>
              <h4>Mapa de criticidade</h4>
            </div>
            <span>{snapshot.criticalityPoints.length} sinais</span>
          </div>
          <div
            className="analysis-chart analysis-chart--scatter"
            aria-label="Mapa de sinais por criticidade"
          >
            {snapshot.criticalityPoints.length ? (
              <ResponsiveContainer height={235} width="100%">
                <ScatterChart
                  margin={{ bottom: 8, left: 0, right: 12, top: 8 }}
                >
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis
                    allowDecimals={false}
                    dataKey="x"
                    domain={[0, 6]}
                    tick={{ fill: 'var(--muted)', fontSize: 8 }}
                    tickFormatter={(value) => criticalityLabels[value] ?? ''}
                    tickLine={false}
                    type="number"
                  />
                  <YAxis
                    allowDecimals={false}
                    dataKey="y"
                    tick={{ fill: 'var(--muted)', fontSize: 8 }}
                    tickLine={false}
                    type="number"
                    width={28}
                  />
                  <ZAxis dataKey="z" range={[90, 620]} type="number" />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    content={SecurityChartTooltip}
                  />
                  <Scatter data={snapshot.criticalityPoints} dataKey="y">
                    {snapshot.criticalityPoints.map((point) => (
                      <Cell
                        fill={point.color}
                        key={`${point.name}-${point.x}`}
                      />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            ) : (
              <div className="analysis-chart__empty">
                Nenhuma criticidade correlacionada.
              </div>
            )}
          </div>
          <p className="analysis-chart-card__note">
            O eixo horizontal vai de baixa a crítica; o tamanho do ponto indica
            a concentração do sinal.
          </p>
        </article>

        <article className="analysis-chart-card analysis-chart-card--reputation">
          <div className="analysis-chart-card__heading">
            <div>
              <span className="eyebrow">Inteligência externa</span>
              <h4>Reputação observada</h4>
            </div>
            <span>
              {snapshot.reputation.malicious + snapshot.reputation.suspicious}{' '}
              alertas
            </span>
          </div>
          <div
            className="analysis-chart analysis-chart--reputation"
            aria-label="Reputação externa normalizada em percentual"
          >
            {reputationData.length ? (
              <ResponsiveContainer height={235} width="100%">
                <BarChart
                  data={reputationData}
                  layout="vertical"
                  margin={{ bottom: 0, left: 10, right: 18, top: 0 }}
                >
                  <CartesianGrid
                    horizontal={false}
                    stroke="var(--border)"
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    allowDecimals={false}
                    domain={[0, 100]}
                    tick={{ fill: 'var(--muted)', fontSize: 8 }}
                    tickFormatter={(value) => `${value}%`}
                    tickLine={false}
                    type="number"
                  />
                  <YAxis
                    axisLine={false}
                    dataKey="name"
                    tick={{ fill: 'var(--muted)', fontSize: 8 }}
                    tickLine={false}
                    type="category"
                    width={92}
                  />
                  <Tooltip
                    content={SecurityChartTooltip}
                  />
                  <Bar barSize={13} dataKey="value" radius={[0, 6, 6, 0]}>
                    {reputationData.map((item) => (
                      <Cell fill={item.color} key={item.id} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="analysis-chart__empty">
                Nenhum sinal de reputação disponível.
              </div>
            )}
          </div>
          <p className="analysis-chart-card__note">
            VirusTotal mostra a proporção entre motores; AbuseIPDB mostra a
            confiança de abuso do IP consultado.
          </p>
        </article>

        <article className="analysis-chart-card analysis-chart-card--failures">
          <div className="analysis-chart-card__heading">
            <div>
              <span className="eyebrow">Higiene do ativo</span>
              <h4>Falhas priorizadas</h4>
            </div>
            <span>{snapshot.securityFailureTotal} sinais</span>
          </div>
          <div
            className="analysis-chart analysis-chart--bars"
            aria-label="Falhas de segurança observadas"
          >
            {snapshot.securityFailures.length ? (
              <ResponsiveContainer height={235} width="100%">
                <BarChart
                  data={snapshot.securityFailures}
                  layout="vertical"
                  margin={{ bottom: 0, left: 6, right: 18, top: 0 }}
                >
                  <CartesianGrid
                    horizontal={false}
                    stroke="var(--border)"
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    allowDecimals={false}
                    axisLine={false}
                    tick={{ fill: 'var(--muted)', fontSize: 9 }}
                    tickLine={false}
                    type="number"
                  />
                  <YAxis
                    axisLine={false}
                    dataKey="name"
                    tick={{ fill: 'var(--muted)', fontSize: 8 }}
                    tickLine={false}
                    type="category"
                    width={112}
                  />
                  <Tooltip
                    content={SecurityChartTooltip}
                  />
                  <Bar
                    barSize={13}
                    dataKey="value"
                    fill="var(--danger)"
                    radius={[0, 6, 6, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="analysis-chart__empty">
                Nenhuma falha de proteção observada.
              </div>
            )}
          </div>
          <p className="analysis-chart-card__note">
            Inclui headers ausentes, cookies sem proteção, TLS inválido e
            reputação de abuso relevante.
          </p>
        </article>
      </div>
    </section>
  );
}
