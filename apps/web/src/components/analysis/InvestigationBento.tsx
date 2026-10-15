import type { CheckCatalogItem, TargetKind } from '@osint-pier/contracts';
import type { AnalysisHistoryEntry } from '../../features/history/analysis-history';
import { ToolLogo } from '../primitives/ToolLogo';

export function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  );
}

export function SourceReadiness({
  checks,
  loading,
  failed,
}: {
  checks: CheckCatalogItem[];
  loading: boolean;
  failed: boolean;
}) {
  const enabled = checks.filter((check) => check.enabled);
  const ready = enabled.filter((check) => check.configured);
  return (
    <aside
      className="source-readiness widget"
      aria-labelledby="source-readiness-title"
    >
      <div className="widget-heading">
        <h2 id="source-readiness-title">Disponibilidade das fontes</h2>
        <a href="#credentials" aria-label="Gerenciar fontes">
          <ArrowIcon />
        </a>
      </div>
      {loading ? (
        <p className="widget-message" role="status">
          Consultando catálogo…
        </p>
      ) : failed ? (
        <p className="widget-message" role="status">
          Catálogo indisponível. Recarregue a página para tentar novamente.
        </p>
      ) : (
        <>
          <div className="source-total">
            <strong>{ready.length}</strong>
            <span>
              fontes prontas<span>de {enabled.length} habilitadas</span>
            </span>
          </div>
          <div className="source-segments" aria-hidden="true">
            {enabled.map((check) => (
              <span
                className={check.configured ? 'is-ready' : ''}
                key={check.id}
              />
            ))}
          </div>
          <div className="source-legend">
            <span>
              <i />
              {ready.length} disponíveis
            </span>
            <span>
              <i />
              {enabled.length - ready.length} pendentes
            </span>
          </div>
          <ul className="source-list">
            {checks.slice(0, 6).map((check) => (
              <li key={check.id}>
                <ToolLogo checkId={check.id} label={check.label} />
                <span>{check.label}</span>
                <span
                  className={`source-state ${check.enabled && check.configured ? 'source-state--ready' : ''}`}
                >
                  {check.enabled && check.configured
                    ? 'Pronta'
                    : check.enabled
                      ? 'Pendente'
                      : 'Desativada'}
                </span>
              </li>
            ))}
          </ul>
          {!checks.length && (
            <p className="widget-message">Nenhuma fonte disponível.</p>
          )}
        </>
      )}
      <a className="widget-link" href="#credentials">
        Configurar integrações <ArrowIcon />
      </a>
    </aside>
  );
}

const targetLabels: Record<TargetKind, string> = {
  domain: 'Domínios',
  ip: 'Endereços IP',
  url: 'URLs',
  email: 'E-mails',
  username: 'Usernames',
  name: 'Nomes',
  phone: 'Telefones',
  cnpj: 'CNPJ',
  cpf: 'CPF',
};
type Category = 'web' | 'threat' | 'personal';
const categories = [
  ['web', 'Infraestrutura', 'DNS, rede e tecnologias'],
  ['threat', 'Segurança', 'Reputação e exposição'],
  ['personal', 'Identidades', 'Perfis e registros'],
] as const;

export function InvestigationBento({
  history,
  loading,
  failed,
  checks,
  checksLoading,
  checksFailed,
  getCategory,
  onReuse,
  onTools,
}: {
  history: AnalysisHistoryEntry[];
  loading: boolean;
  failed: boolean;
  checks: CheckCatalogItem[];
  checksLoading: boolean;
  checksFailed: boolean;
  getCategory: (id: string) => Category;
  onReuse: (entry: AnalysisHistoryEntry) => void;
  onTools: (category: Category) => void;
}) {
  const coverage = Object.entries(targetLabels)
    .map(([kind, label]) => ({
      kind,
      label,
      count: checks.filter(
        (check) =>
          check.enabled &&
          check.supportedTargetKinds.includes(kind as TargetKind),
      ).length,
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);
  const maxCoverage = Math.max(1, ...coverage.map((item) => item.count));
  return (
    <section
      className="investigation-bento"
      aria-label="Bancada de investigação"
    >
      <article className="coverage-widget widget">
        <div className="widget-heading">
          <h2>Cobertura de alvos</h2>
          <span className="widget-meta">Fontes por tipo</span>
        </div>
        {checksLoading ? (
          <p className="widget-message" role="status">
            Carregando cobertura…
          </p>
        ) : checksFailed ? (
          <p className="widget-message">
            Aguardando disponibilidade do catálogo.
          </p>
        ) : coverage.length ? (
          <ul className="coverage-list">
            {coverage.slice(0, 5).map((item) => (
              <li key={item.kind}>
                <div>
                  <span>{item.label}</span>
                  <strong>{item.count}</strong>
                </div>
                <span className="coverage-bar" aria-hidden="true">
                  <span
                    style={{ width: `${(item.count / maxCoverage) * 100}%` }}
                  />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="widget-message">
            A cobertura aparecerá quando houver fontes habilitadas.
          </p>
        )}
      </article>
      <article className="tool-groups-widget widget">
        <div className="widget-heading">
          <h2>Explorar ferramentas</h2>
          <a href="#results" aria-label="Abrir todas as ferramentas">
            <ArrowIcon />
          </a>
        </div>
        <div className="tool-group-list">
          {categories.map(([id, label, detail]) => (
            <button key={id} onClick={() => onTools(id)} type="button">
              <span
                className={`tool-group-mark tool-group-mark--${id}`}
                aria-hidden="true"
              />
              <span>
                <strong>{label}</strong>
                <small>{detail}</small>
              </span>
              <span className="tool-group-count">
                {checksLoading || checksFailed
                  ? '—'
                  : checks.filter((check) => getCategory(check.id) === id)
                      .length}
              </span>
              <ArrowIcon />
            </button>
          ))}
        </div>
      </article>
      <article className="recent-widget widget">
        <div className="widget-heading">
          <h2>Consultas recentes</h2>
          <a href="#history">
            Ver histórico <ArrowIcon />
          </a>
        </div>
        {loading && !history.length ? (
          <p className="widget-message" role="status">
            Carregando consultas…
          </p>
        ) : history.length ? (
          <div className="recent-table">
            <div className="recent-table__head">
              <span>Alvo</span>
              <span>Data</span>
              <span>Fontes</span>
              <span className="sr-only">Ação</span>
            </div>
            {history.slice(0, 3).map((entry) => (
              <button
                className="recent-table__row"
                key={entry.id}
                onClick={() => onReuse(entry)}
                type="button"
              >
                <strong>{entry.target}</strong>
                <span>
                  {new Intl.DateTimeFormat('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  }).format(new Date(entry.completedAt))}
                </span>
                <span>{entry.total}</span>
                <ArrowIcon />
              </button>
            ))}
          </div>
        ) : (
          <div className="recent-empty">
            <span className="recent-empty__line" aria-hidden="true" />
            <div>
              <strong>
                {failed
                  ? 'Histórico indisponível'
                  : 'Nenhuma consulta nesta bancada'}
              </strong>
              <p>
                {failed
                  ? 'Você pode continuar iniciando novas análises.'
                  : 'Informe um alvo acima. As próximas investigações aparecem aqui.'}
              </p>
            </div>
          </div>
        )}
        <p className="widget-footnote">
          O histórico guarda alvos e resumos. As evidências detalhadas ficam na
          sessão.
        </p>
      </article>
      <article className="exports-widget widget">
        <div className="widget-heading">
          <h2>Relatórios</h2>
        </div>
        <div className="export-format">
          <span>JSON</span>
          <p>
            Dados estruturados
            <br />
            para continuar a análise.
          </p>
        </div>
        <div className="export-format">
          <span>PDF</span>
          <p>
            Relatório de evidências
            <br />
            pronto para compartilhar.
          </p>
        </div>
        <a className="widget-link" href="/docs#docs-history">
          Como exportar <ArrowIcon />
        </a>
      </article>
      <article className="guide-widget widget">
        <div className="widget-heading">
          <h2>Manual de campo</h2>
        </div>
        <nav aria-label="Guia da bancada">
          <a href="/docs#docs-analysis">
            Consultar um alvo <ArrowIcon />
          </a>
          <a href="/docs#docs-tools">
            Escolher uma ferramenta <ArrowIcon />
          </a>
          <a href="/docs#docs-help">
            Resolver problemas <ArrowIcon />
          </a>
        </nav>
        <a className="widget-link" href="/docs">
          Abrir documentação <ArrowIcon />
        </a>
      </article>
    </section>
  );
}
