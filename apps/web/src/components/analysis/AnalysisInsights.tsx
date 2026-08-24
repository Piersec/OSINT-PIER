import type { CheckCatalogItem } from '@osint-pier/contracts';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CardState } from '../checks/ResultCard';

type AnalysisStatus = 'idle' | 'loading' | 'success' | 'error' | 'skipped';

interface StatusDatum {
  key: AnalysisStatus;
  name: string;
  value: number;
  color: string;
}

interface DurationDatum {
  id: string;
  label: string;
  fullLabel: string;
  durationMs: number;
}

type SecuritySeverity = 'critical' | 'high' | 'medium' | 'low' | 'unknown';

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

export interface AnalysisInsight {
  label: string;
  value: string;
  detail: string;
  tone: 'neutral' | 'positive' | 'attention';
}

export interface AnalysisSnapshot {
  total: number;
  resolved: number;
  loading: number;
  success: number;
  error: number;
  skipped: number;
  coverage: number;
  successRate: number;
  averageDurationMs: number | null;
  statuses: StatusDatum[];
  durations: DurationDatum[];
  vulnerabilities: VulnerabilityDatum[];
  vulnerabilityTotal: number;
  kevCount: number;
  highEpssCount: number;
  securityFailures: SecurityFailureDatum[];
  securityFailureTotal: number;
  insights: AnalysisInsight[];
}

const statusMeta: Record<AnalysisStatus, Omit<StatusDatum, 'value'>> = {
  idle: { key: 'idle', name: 'Aguardando', color: '#727a7d' },
  loading: { key: 'loading', name: 'Carregando', color: '#ffc25c' },
  success: { key: 'success', name: 'Sucesso', color: '#48e9ff' },
  error: { key: 'error', name: 'Erro', color: '#ff5f68' },
  skipped: { key: 'skipped', name: 'Pulado', color: '#ff9d63' },
};

const vulnerabilityMeta: Record<
  SecuritySeverity,
  { name: string; color: string }
> = {
  critical: { name: 'Crítica', color: '#ff5f68' },
  high: { name: 'Alta', color: '#ff9d63' },
  medium: { name: 'Média', color: '#f2cf66' },
  low: { name: 'Baixa', color: '#48e9ff' },
  unknown: { name: 'Sem score', color: '#727a7d' },
};

function analysisStatus(state: CardState | undefined): AnalysisStatus {
  if (!state || state.status === 'idle') return 'idle';
  if (state.status === 'loading') return 'loading';
  if (state.status === 'request-error') return 'error';
  return state.result.status;
}

function formatDuration(value: number): string {
  if (value < 1000) return `${Math.round(value)} ms`;
  return `${(value / 1000).toFixed(1)} s`;
}

function shortLabel(label: string): string {
  return label.length > 17 ? `${label.slice(0, 16)}…` : label;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
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

function headerLabel(value: string): string {
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function collectRiskSignals(
  checks: CheckCatalogItem[],
  states: Record<string, CardState>,
): {
  vulnerabilities: VulnerabilityDatum[];
  vulnerabilityTotal: number;
  kevCount: number;
  highEpssCount: number;
  securityFailures: SecurityFailureDatum[];
  securityFailureTotal: number;
} {
  const vulnerabilityCounts: Record<SecuritySeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    unknown: 0,
  };
  const failures = new Map<string, SecurityFailureDatum>();
  let kevCount = 0;
  let highEpssCount = 0;

  for (const check of checks) {
    const state = states[check.id];
    if (state?.status !== 'done' || state.result.status !== 'success') {
      continue;
    }
    if (!isRecord(state.result.data)) continue;

    const data = state.result.data;
    if (check.id === 'shodan-vulnerabilities') {
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
      if (data.authorized === false) {
        addSecurityFailure(
          failures,
          'tls-authorization',
          'Certificado não autorizado',
          1,
          'A cadeia TLS não foi autorizada',
        );
      }
      if (data.hostnameMatches === false) {
        addSecurityFailure(
          failures,
          'tls-hostname',
          'Hostname incompatível',
          1,
          'O certificado não corresponde ao hostname',
        );
      }
      const daysRemaining = numberValue(data.daysRemaining);
      if (daysRemaining !== null && daysRemaining < 0) {
        addSecurityFailure(
          failures,
          'tls-expired',
          'Certificado expirado',
          1,
          'A validade do certificado terminou',
        );
      }
    }

    if (check.id === 'abuse-ipdb') {
      const score = numberValue(data.abuseConfidenceScore) ?? 0;
      if (score >= 75) {
        addSecurityFailure(
          failures,
          'abuse-high-confidence',
          'Alta confiança de abuso',
          1,
          'Reputação IP acima de 75%',
        );
      } else if (score >= 25) {
        addSecurityFailure(
          failures,
          'abuse-confidence',
          'Confiança de abuso',
          1,
          'Reputação IP entre 25% e 74%',
        );
      }
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

  return {
    vulnerabilities,
    vulnerabilityTotal: vulnerabilities.reduce(
      (sum, item) => sum + item.value,
      0,
    ),
    kevCount,
    highEpssCount,
    securityFailures,
    securityFailureTotal: [...failures.values()].reduce(
      (sum, item) => sum + item.value,
      0,
    ),
  };
}

export function buildAnalysisSnapshot(
  checks: CheckCatalogItem[],
  states: Record<string, CardState>,
): AnalysisSnapshot {
  const counts: Record<AnalysisStatus, number> = {
    idle: 0,
    loading: 0,
    success: 0,
    error: 0,
    skipped: 0,
  };
  const durations: DurationDatum[] = [];

  for (const check of checks) {
    const state = states[check.id];
    const status = analysisStatus(state);
    counts[status] += 1;

    if (
      state?.status === 'done' &&
      Number.isFinite(state.result.durationMs) &&
      state.result.durationMs >= 0
    ) {
      durations.push({
        id: check.id,
        label: shortLabel(check.label),
        fullLabel: check.label,
        durationMs: state.result.durationMs,
      });
    }
  }

  const resolved = counts.success + counts.error + counts.skipped;
  const averageDurationMs = durations.length
    ? durations.reduce((total, item) => total + item.durationMs, 0) /
      durations.length
    : null;
  const sortedDurations = [...durations].sort(
    (left, right) => right.durationMs - left.durationMs,
  );
  const statuses = (Object.keys(statusMeta) as AnalysisStatus[])
    .map((key) => ({ ...statusMeta[key], value: counts[key] }))
    .filter((item) => item.value > 0);
  const coverage = checks.length
    ? Math.round((resolved / checks.length) * 100)
    : 0;
  const successRate = resolved
    ? Math.round((counts.success / resolved) * 100)
    : 0;
  const slowest = sortedDurations[0];
  const attention = counts.error + counts.skipped;
  const isComplete = checks.length > 0 && resolved === checks.length;
  const riskSignals = collectRiskSignals(checks, states);

  const insights: AnalysisInsight[] = [
    {
      label: 'Cobertura',
      value: `${resolved}/${checks.length}`,
      detail: isComplete
        ? 'Todos os checks chegaram a um estado final.'
        : resolved === 0 && counts.loading === 0
          ? 'Inicie a análise para acompanhar a cobertura.'
          : `${checks.length - resolved} fonte${checks.length - resolved === 1 ? '' : 's'} ainda em execução.`,
      tone: isComplete ? 'positive' : 'neutral',
    },
    {
      label: 'Taxa de sucesso',
      value: `${successRate}%`,
      detail:
        resolved > 0
          ? `${counts.success} resposta${counts.success === 1 ? '' : 's'} com dados retornados.`
          : 'Inicie uma análise para calcular a taxa.',
      tone: successRate >= 80 && resolved > 0 ? 'positive' : 'neutral',
    },
    {
      label: 'Pontos de atenção',
      value: `${attention}`,
      detail:
        attention > 0
          ? `${counts.error} erro${counts.error === 1 ? '' : 's'} e ${counts.skipped} integração${counts.skipped === 1 ? '' : 'ções'} pulada${counts.skipped === 1 ? '' : 's'}.`
          : 'Nenhuma falha ou integração pulada até agora.',
      tone: attention > 0 ? 'attention' : 'positive',
    },
    {
      label: 'Tempo médio',
      value:
        averageDurationMs === null ? '—' : formatDuration(averageDurationMs),
      detail: slowest
        ? `${slowest.fullLabel} foi a fonte mais lenta nesta rodada.`
        : 'A duração aparece quando uma fonte responder.',
      tone: 'neutral',
    },
    {
      label: 'Vulnerabilidades',
      value: String(riskSignals.vulnerabilityTotal),
      detail:
        riskSignals.vulnerabilityTotal > 0
          ? `${riskSignals.kevCount} no CISA KEV e ${riskSignals.highEpssCount} com EPSS alto.`
          : 'Nenhuma CVE correlacionada nesta rodada.',
      tone: riskSignals.vulnerabilityTotal > 0 ? 'attention' : 'positive',
    },
    {
      label: 'Falhas de segurança',
      value: String(riskSignals.securityFailureTotal),
      detail:
        riskSignals.securityFailureTotal > 0
          ? 'Headers, cookies, TLS ou reputação exigem revisão.'
          : 'Nenhuma falha de segurança observada.',
      tone: riskSignals.securityFailureTotal > 0 ? 'attention' : 'positive',
    },
  ];

  return {
    total: checks.length,
    resolved,
    loading: counts.loading,
    success: counts.success,
    error: counts.error,
    skipped: counts.skipped,
    coverage,
    successRate,
    averageDurationMs,
    statuses,
    durations: sortedDurations.slice(0, 8),
    ...riskSignals,
    insights,
  };
}

function chartTooltipStyle() {
  return {
    backgroundColor: 'var(--surface-raised)',
    border: '1px solid var(--border-strong)',
    borderRadius: 10,
    color: 'var(--text)',
    fontSize: 11,
  };
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
  const isRunning = snapshot.loading > 0;

  return (
    <section className="analysis-insights" aria-live="polite">
      <header className="analysis-insights__header">
        <div>
          <span className="eyebrow">Leitura de risco</span>
          <h3>Panorama de risco</h3>
          <p>
            {target
              ? `Vulnerabilidades e falhas de segurança observadas em ${target}.`
              : 'Os gráficos de risco serão preenchidos assim que uma análise começar.'}
          </p>
        </div>
        <span
          className={`analysis-insights__live ${isRunning ? 'analysis-insights__live--active' : ''}`}
        >
          <i aria-hidden="true" />
          {isRunning
            ? 'Atualizando agora'
            : snapshot.resolved > 0
              ? 'Leitura disponível'
              : 'Aguardando análise'}
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
        <article className="analysis-chart-card analysis-chart-card--distribution">
          <div className="analysis-chart-card__heading">
            <div>
              <span className="eyebrow">Estado dos checks</span>
              <h4>Distribuição da rodada</h4>
            </div>
            <span>{snapshot.coverage}% coberto</span>
          </div>
          <div className="analysis-chart analysis-chart--donut">
            {snapshot.statuses.length ? (
              <ResponsiveContainer height={220} width="100%">
                <PieChart>
                  <Pie
                    data={snapshot.statuses}
                    dataKey="value"
                    innerRadius={58}
                    nameKey="name"
                    outerRadius={83}
                    paddingAngle={3}
                  >
                    {snapshot.statuses.map((item) => (
                      <Cell fill={item.color} key={item.key} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={chartTooltipStyle()} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="analysis-chart__empty">
                Aguardando checks selecionados.
              </div>
            )}
            {snapshot.total > 0 && (
              <div className="analysis-chart--donut__center">
                <strong>{snapshot.resolved}</strong>
                <span>de {snapshot.total}</span>
              </div>
            )}
          </div>
          <div className="analysis-chart-legend">
            {snapshot.statuses.map((item) => (
              <span key={item.key}>
                <i style={{ backgroundColor: item.color }} />
                {item.name} <b>{item.value}</b>
              </span>
            ))}
          </div>
        </article>

        <article className="analysis-chart-card analysis-chart-card--risk">
          <div className="analysis-chart-card__heading">
            <div>
              <span className="eyebrow">Exposição conhecida</span>
              <h4>Vulnerabilidades</h4>
            </div>
            <span>{snapshot.vulnerabilityTotal} CVEs</span>
          </div>
          <div
            className="analysis-chart analysis-chart--bars"
            aria-label="Distribuição de vulnerabilidades por severidade"
          >
            {snapshot.vulnerabilities.length ? (
              <ResponsiveContainer height={220} width="100%">
                <BarChart
                  data={snapshot.vulnerabilities}
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
                    tick={{ fill: 'var(--muted)', fontSize: 9 }}
                    tickLine={false}
                    type="category"
                    width={72}
                  />
                  <Tooltip
                    contentStyle={chartTooltipStyle()}
                    formatter={(value) => [value, 'CVEs']}
                  />
                  <Bar barSize={14} dataKey="value" radius={[0, 5, 5, 0]}>
                    {snapshot.vulnerabilities.map((item) => (
                      <Cell fill={item.color} key={item.key} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="analysis-chart__empty">
                Nenhuma vulnerabilidade correlacionada.
              </div>
            )}
          </div>
          <div className="analysis-risk-card__metrics">
            <span>
              <b>{snapshot.kevCount}</b> CISA KEV
            </span>
            <span>
              <b>{snapshot.highEpssCount}</b> EPSS alto
            </span>
          </div>
        </article>

        <article className="analysis-chart-card analysis-chart-card--security">
          <div className="analysis-chart-card__heading">
            <div>
              <span className="eyebrow">Higiene do ativo</span>
              <h4>Falhas de segurança</h4>
            </div>
            <span>{snapshot.securityFailureTotal} sinais</span>
          </div>
          <div
            className="analysis-chart analysis-chart--bars"
            aria-label="Falhas de segurança observadas"
          >
            {snapshot.securityFailures.length ? (
              <ResponsiveContainer height={220} width="100%">
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
                    tick={{ fill: 'var(--muted)', fontSize: 9 }}
                    tickLine={false}
                    type="category"
                    width={112}
                  />
                  <Tooltip
                    contentStyle={chartTooltipStyle()}
                    formatter={(value, _name, item) => [
                      value,
                      item.payload.detail,
                    ]}
                  />
                  <Bar
                    barSize={14}
                    dataKey="value"
                    fill="#ff5f68"
                    radius={[0, 5, 5, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="analysis-chart__empty">
                Nenhuma falha de segurança observada.
              </div>
            )}
          </div>
          <p className="analysis-chart-card__note">
            Inclui headers ausentes, cookies sem proteção, TLS inválido/expirado
            e reputação de abuso relevante.
          </p>
        </article>

        <article className="analysis-chart-card analysis-chart-card--latency">
          <div className="analysis-chart-card__heading">
            <div>
              <span className="eyebrow">Tempo de resposta</span>
              <h4>Quais fontes demoraram mais?</h4>
            </div>
            <span>Top {Math.min(snapshot.durations.length, 8)}</span>
          </div>
          <div className="analysis-chart analysis-chart--bars">
            {snapshot.durations.length ? (
              <ResponsiveContainer height={220} width="100%">
                <BarChart
                  data={snapshot.durations}
                  layout="vertical"
                  margin={{ bottom: 0, left: 6, right: 18, top: 0 }}
                >
                  <CartesianGrid
                    horizontal={false}
                    stroke="var(--border)"
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    axisLine={false}
                    tick={{ fill: 'var(--muted)', fontSize: 9 }}
                    tickLine={false}
                    type="number"
                  />
                  <YAxis
                    axisLine={false}
                    dataKey="label"
                    tick={{ fill: 'var(--muted)', fontSize: 9 }}
                    tickLine={false}
                    type="category"
                    width={86}
                  />
                  <Tooltip
                    contentStyle={chartTooltipStyle()}
                    formatter={(value) => [
                      formatDuration(Number(value)),
                      'Tempo',
                    ]}
                    labelFormatter={(label) => {
                      const item = snapshot.durations.find(
                        (duration) => duration.label === label,
                      );
                      return item?.fullLabel ?? label;
                    }}
                  />
                  <Bar
                    barSize={13}
                    dataKey="durationMs"
                    fill="var(--accent)"
                    radius={[0, 5, 5, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="analysis-chart__empty">
                As durações aparecem progressivamente.
              </div>
            )}
          </div>
          <p className="analysis-chart-card__note">
            Duração individual informada pela fonte; não é uma estimativa de
            risco.
          </p>
        </article>
      </div>
    </section>
  );
}
