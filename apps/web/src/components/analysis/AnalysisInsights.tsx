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
  insights: AnalysisInsight[];
}

const statusMeta: Record<AnalysisStatus, Omit<StatusDatum, 'value'>> = {
  idle: { key: 'idle', name: 'Aguardando', color: '#727a7d' },
  loading: { key: 'loading', name: 'Carregando', color: '#ffc25c' },
  success: { key: 'success', name: 'Sucesso', color: '#48e9ff' },
  error: { key: 'error', name: 'Erro', color: '#ff5f68' },
  skipped: { key: 'skipped', name: 'Pulado', color: '#ff9d63' },
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
          <span className="eyebrow">Leitura dos sinais</span>
          <h3>Panorama da execução</h3>
          <p>
            {target
              ? `Visão agregada dos checks para ${target}.`
              : 'Os gráficos serão preenchidos assim que uma análise começar.'}
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
