import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiRequestError,
  listChecks,
  listHistory,
  runCheck,
  saveHistory,
} from './api/client';
import { ResultCard, type CardState } from './components/checks/ResultCard';
import { VulnerabilitySummary } from './components/vulnerabilities/VulnerabilitySummary';
import type { CheckCatalogItem, TargetKind } from '@osint-pier/contracts';
import { CredentialsPanel } from './features/credentials/CredentialsPanel';
import {
  buildAnalysisExport,
  downloadAnalysisExport,
} from './features/export/analysis-export';
import {
  createAnalysisHistoryEntry,
  type AnalysisHistoryEntry,
} from './features/history/analysis-history';
import { useAuth } from './features/auth/AuthGate';
import { ProfilePage } from './features/profile/ProfilePage';

type Page =
  'analysis' | 'results' | 'history' | 'credentials' | 'profile' | 'settings';
type Theme = 'dark' | 'white';

const pageMeta: Record<
  Page,
  { eyebrow: string; title: string; description: string }
> = {
  analysis: {
    eyebrow: 'OSINT Pier / investigação',
    title: 'Central de análise',
    description: 'Execute verificações paralelas sobre ativos e identidades.',
  },
  results: {
    eyebrow: 'OSINT Pier / ferramentas',
    title: 'Caixa de ferramentas',
    description:
      'Execute cada integração separadamente e veja o que ela consulta.',
  },
  history: {
    eyebrow: 'OSINT Pier / auditoria',
    title: 'Histórico de análises',
    description: 'Revisite os alvos investigados e seus resumos agregados.',
  },
  credentials: {
    eyebrow: 'OSINT Pier / administração',
    title: 'Cofre de integrações',
    description:
      'Gerencie chaves de APIs e a disponibilidade dos plugins internos.',
  },
  profile: {
    eyebrow: 'OSINT Pier / identidade',
    title: 'Seu perfil',
    description: 'Atualize sua foto e mantenha a segurança da conta em dia.',
  },
  settings: {
    eyebrow: 'OSINT Pier / preferências',
    title: 'Configurações',
    description: 'Ajuste a aparência do painel para o seu fluxo de trabalho.',
  },
};

const toolDescriptions: Record<string, string> = {
  'abuse-ipdb': 'Consulta histórico de abuso e reputação de um IP público.',
  cookies: 'Inspeciona cookies HTTP e sinaliza flags de segurança.',
  'dns-records': 'Resolve registros A, AAAA, MX, NS, TXT e CNAME.',
  'http-headers': 'Lê headers HTTP e verifica políticas de segurança.',
  'hunter-io':
    'Busca e-mails profissionais de um domínio ou verifica um e-mail.',
  'ip-info': 'Descobre os endereços IP associados ao domínio consultado.',
  'redirect-chain': 'Segue a cadeia de redirecionamentos HTTP do alvo.',
  'robots-sitemap': 'Consulta robots.txt e sitemap.xml disponíveis no site.',
  'server-location': 'Estima a localização e a rede do IP público resolvido.',
  'server-status': 'Verifica disponibilidade e tempo de resposta do servidor.',
  shodan: 'Consulta portas, serviços e exposição observada pelo Shodan.',
  'ssl-certificate':
    'Inspeciona validade, emissor e subject do certificado TLS.',
  'tech-stack': 'Detecta tecnologias e frameworks expostos pela página.',
  'virus-total': 'Consulta reputação e detecções agregadas do VirusTotal.',
  'whois-rdap': 'Consulta dados de registro via RDAP oficial.',
  'osint-framework':
    'Oferece referências curadas do OSINT Framework sem scraping automático.',
  'shodan-vulnerabilities':
    'Consolida CVEs dos serviços observados pelo Shodan com NVD, EPSS e CISA KEV.',
};

type ToolCategory = 'web' | 'threat' | 'personal';

const toolCategoryMeta: Record<
  ToolCategory,
  { label: string; description: string }
> = {
  web: {
    label: 'Web e infraestrutura',
    description: 'Domínios, IPs, DNS, certificados e superfície técnica.',
  },
  threat: {
    label: 'Threat intelligence',
    description: 'Reputação, exposição e vulnerabilidades de ativos.',
  },
  personal: {
    label: 'Dados pessoais e leads',
    description:
      'E-mails e referências para pesquisa de identidades autorizadas.',
  },
};

const toolCategories: Record<string, ToolCategory> = {
  'abuse-ipdb': 'threat',
  cookies: 'web',
  'dns-records': 'web',
  'http-headers': 'web',
  'hunter-io': 'personal',
  'ip-info': 'web',
  'osint-framework': 'web',
  'redirect-chain': 'web',
  'robots-sitemap': 'web',
  'server-location': 'web',
  'server-status': 'web',
  shodan: 'threat',
  'shodan-vulnerabilities': 'threat',
  'ssl-certificate': 'web',
  'tech-stack': 'web',
  'virus-total': 'threat',
  'whois-rdap': 'web',
};

const plannedTools = [
  {
    id: 'phoneinfoga',
    label: 'PhoneInfoga',
    category: 'personal' as const,
    description:
      'Planejado: depende de CLI/provedores configurados para consultas telefônicas.',
  },
  {
    id: 'ghunt',
    label: 'GHunt',
    category: 'personal' as const,
    description: 'Planejado: depende de sessão/cookies autorizados do Google.',
  },
  {
    id: 'osintgram',
    label: 'Osintgram',
    category: 'personal' as const,
    description: 'Planejado: depende de autenticação autorizada do Instagram.',
  },
  {
    id: 'sherlock',
    label: 'Sherlock',
    category: 'personal' as const,
    description:
      'Planejado: depende do binário local e execução controlada de username.',
  },
];

const logoSlugs: Record<string, string | undefined> = {
  'abuse-ipdb': 'abuseipdb',
  'hunter-io': 'hunter',
  shodan: 'shodan',
  'shodan-vulnerabilities': 'nvd',
  'virus-total': 'virustotal',
};

function ToolLogo({ checkId, label }: { checkId: string; label: string }) {
  const [failed, setFailed] = useState(false);
  const slug = logoSlugs[checkId];
  if (!slug || failed) {
    return (
      <div className="tool-card__icon tool-card__icon--fallback">
        {label.slice(0, 2).toUpperCase()}
      </div>
    );
  }
  return (
    <div className="tool-card__icon tool-card__icon--logo">
      <img
        alt=""
        onError={() => setFailed(true)}
        src={`https://cdn.jsdelivr.net/npm/simple-icons@v16/icons/${slug}.svg`}
      />
    </div>
  );
}

function readPage(hash: string): Page {
  const value = hash.replace(/^#/, '') as Page;
  return [
    'analysis',
    'results',
    'history',
    'credentials',
    'profile',
    'settings',
  ].includes(value)
    ? value
    : 'analysis';
}

function readTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  try {
    return window.localStorage.getItem('osint-pier-theme') === 'white'
      ? 'white'
      : 'dark';
  } catch {
    return 'dark';
  }
}

function formatHistoryDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatTargetKind(kind: TargetKind): string {
  return {
    domain: 'Domínio',
    ip: 'IP',
    url: 'URL',
    name: 'Nome',
    username: 'Username',
    email: 'E-mail',
    phone: 'Telefone',
  }[kind];
}

function inferTargetKind(value: string): TargetKind {
  const input = value.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)) return 'email';
  if (/^https?:\/\//i.test(input)) return 'url';
  if (/^[0-9a-f:]+$/i.test(input) && input.includes(':')) return 'ip';
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(input)) return 'ip';
  if (/^\+?[0-9][0-9\s().-]{6,}$/.test(input)) return 'phone';
  if (/\s/.test(input)) return 'name';
  if (
    /^@[a-z0-9][a-z0-9._-]{1,63}$/i.test(input) ||
    (/^@?[a-z0-9][a-z0-9._-]{1,63}$/i.test(input) && !input.includes('.'))
  )
    return 'username';
  return 'domain';
}

function checkDescription(check: CheckCatalogItem): string {
  return (
    toolDescriptions[check.id] ??
    `Executa a verificação independente ${check.label} sobre o alvo informado.`
  );
}

export function App() {
  const { user, signOut, updateUser } = useAuth();
  const queryClient = useQueryClient();
  const checksQuery = useQuery({ queryKey: ['checks'], queryFn: listChecks });
  const historyQuery = useQuery({
    queryKey: ['history'],
    queryFn: () => listHistory(50),
    retry: false,
  });
  // Keep the first render identical on the server and browser. The hash is
  // only available in the browser, so reading it during useState would make
  // `/` and `/#credentials` produce different trees during hydration.
  const [page, setPage] = useState<Page>('analysis');
  const [target, setTarget] = useState('');
  const [lastTarget, setLastTarget] = useState<string | null>(null);
  const [lastTargetKind, setLastTargetKind] = useState<TargetKind | 'auto'>(
    'auto',
  );
  const [states, setStates] = useState<Record<string, CardState>>({});
  const [toolStates, setToolStates] = useState<Record<string, CardState>>({});
  const [toolTarget, setToolTarget] = useState('');
  const [history, setHistory] = useState<AnalysisHistoryEntry[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [theme, setTheme] = useState<Theme>('dark');
  const themeInitialized = useRef(false);
  const [selectedCheckIds, setSelectedCheckIds] = useState<string[] | null>(
    null,
  );

  useEffect(() => {
    const handleHashChange = () => setPage(readPage(window.location.hash));
    setPage(readPage(window.location.hash));
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (!themeInitialized.current) {
      themeInitialized.current = true;
      const storedTheme = readTheme();
      if (storedTheme !== theme) {
        setTheme(storedTheme);
        return;
      }
    }
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem('osint-pier-theme', theme);
    } catch {
      // A browser privacy mode can disable local storage; the in-memory choice remains active.
    }
  }, [theme]);

  const activeChecks = useMemo(
    () => (checksQuery.data ?? []).filter((check) => check.enabled),
    [checksQuery.data],
  );
  const compatibleChecks = activeChecks;
  const checks = useMemo(
    () =>
      selectedCheckIds === null
        ? compatibleChecks
        : compatibleChecks.filter((check) =>
            selectedCheckIds.includes(check.id),
          ),
    [compatibleChecks, selectedCheckIds],
  );
  const toolboxChecks = activeChecks;
  const visibleToolCategories = useMemo(
    () =>
      (Object.keys(toolCategoryMeta) as ToolCategory[]).filter(
        (category) =>
          toolboxChecks.some(
            (check) => (toolCategories[check.id] ?? 'web') === category,
          ) || plannedTools.some((tool) => tool.category === category),
      ),
    [toolboxChecks],
  );
  const visibleHistory = useMemo(() => {
    const entries = [...history, ...(historyQuery.data ?? [])];
    return entries.filter(
      (entry, index, all) =>
        all.findIndex((candidate) => candidate.id === entry.id) === index,
    );
  }, [history, historyQuery.data]);

  const analysisSummary = useMemo(() => {
    const currentStates = Object.values(states);
    return {
      resolved: currentStates.filter(
        (state) => state.status === 'done' || state.status === 'request-error',
      ).length,
      success: currentStates.filter(
        (state) => state.status === 'done' && state.result.status === 'success',
      ).length,
      attention: currentStates.filter(
        (state) =>
          state.status === 'request-error' ||
          (state.status === 'done' && state.result.status !== 'success'),
      ).length,
      loading: currentStates.filter((state) => state.status === 'loading')
        .length,
    };
  }, [states]);

  const canExport = Boolean(
    lastTarget &&
    checks.length > 0 &&
    analysisSummary.loading === 0 &&
    analysisSummary.resolved === checks.length,
  );

  function navigate(nextPage: Page) {
    window.location.hash = `#${nextPage}`;
    setPage(nextPage);
  }

  async function requestCheck(
    checkId: string,
    submittedTarget: string,
    submittedTargetKind: TargetKind | 'auto',
  ): Promise<CardState> {
    try {
      const result = await runCheck(
        checkId,
        submittedTarget,
        submittedTargetKind === 'auto' ? undefined : submittedTargetKind,
      );
      return { status: 'done', result };
    } catch (error) {
      return {
        status: 'request-error',
        message:
          error instanceof Error
            ? error.message
            : 'Falha ao executar a checagem.',
        statusCode:
          error instanceof ApiRequestError ? error.statusCode : undefined,
        retryAfterSeconds:
          error instanceof ApiRequestError
            ? error.retryAfterSeconds
            : undefined,
      };
    }
  }

  async function executeOneCheck(
    checkId: string,
    submittedTarget: string,
    submittedTargetKind: TargetKind | 'auto',
  ): Promise<CardState> {
    setStates((current) => ({
      ...current,
      [checkId]: { status: 'loading' },
    }));
    const nextState = await requestCheck(
      checkId,
      submittedTarget,
      submittedTargetKind,
    );
    setStates((current) => ({ ...current, [checkId]: nextState }));
    return nextState;
  }

  async function executeTool(checkId: string) {
    const submittedTarget = toolTarget.trim();
    if (!submittedTarget) return;
    const submittedTargetKind = inferTargetKind(submittedTarget);
    setToolStates((current) => ({
      ...current,
      [checkId]: { status: 'loading' },
    }));
    const nextState = await requestCheck(
      checkId,
      submittedTarget,
      submittedTargetKind,
    );
    setToolStates((current) => ({ ...current, [checkId]: nextState }));
  }

  async function analyze(event: FormEvent) {
    event.preventDefault();
    const submittedTarget = target.trim();
    if (!submittedTarget || checks.length === 0) return;
    const submittedTargetKind = inferTargetKind(submittedTarget);

    setLastTarget(submittedTarget);
    setLastTargetKind(submittedTargetKind);
    setStates(
      Object.fromEntries(
        checks.map((check) => [check.id, { status: 'loading' }]),
      ),
    );

    const completedStates = await Promise.all(
      checks.map((check) =>
        executeOneCheck(check.id, submittedTarget, submittedTargetKind),
      ),
    );
    const entry = createAnalysisHistoryEntry({
      target: submittedTarget,
      targetKind: submittedTargetKind,
      states: completedStates,
    });
    setHistory((current) => [entry, ...current].slice(0, 6));
    void saveHistory({
      target: submittedTarget,
      targetKind: submittedTargetKind,
      total: entry.total,
      success: entry.success,
      attention: entry.attention,
    })
      .then((persistedEntry) => {
        if (!persistedEntry) return;
        queryClient.setQueryData<AnalysisHistoryEntry[]>(
          ['history'],
          (current) => [persistedEntry, ...(current ?? [])].slice(0, 50),
        );
      })
      .catch(() => {
        // A temporary Supabase outage must not hide the local session history.
      });
  }

  function retryCheck(checkId: string) {
    if (lastTarget) void executeOneCheck(checkId, lastTarget, lastTargetKind);
  }

  function retryTool(checkId: string) {
    void executeTool(checkId);
  }

  function exportAnalysis() {
    if (!lastTarget || !canExport) return;
    downloadAnalysisExport(
      buildAnalysisExport({ target: lastTarget, checks, states }),
    );
  }

  function reuseHistoryEntry(entry: AnalysisHistoryEntry) {
    setTarget(entry.target);
    setSelectedCheckIds(null);
    navigate('analysis');
  }

  const meta = pageMeta[page];

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Navegação principal">
        <a
          className="sidebar__brand"
          href="#analysis"
          onClick={() => setPage('analysis')}
          aria-label="OSINT Pier — análise"
        >
          <img src="/piersec-logo.svg" alt="" />
          <span>OSINT Pier</span>
        </a>
        <nav>
          {(
            [
              ['analysis', 'Análise', 'analysis'],
              ['results', 'Ferramentas', 'results'],
              ['history', 'Histórico', 'history'],
              ['credentials', 'Credenciais', 'credentials'],
              ['profile', 'Perfil', 'profile'],
              ['settings', 'Configurações', 'settings'],
            ] as const
          ).map(([itemPage, label, icon]) => (
            <a
              className={`sidebar__link ${page === itemPage ? 'sidebar__link--active' : ''}`}
              href={`#${itemPage}`}
              key={itemPage}
              onClick={() => setPage(itemPage)}
              aria-current={page === itemPage ? 'page' : undefined}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24">
                {icon === 'analysis' && (
                  <>
                    <circle cx="12" cy="12" r="3" />
                    <circle cx="12" cy="12" r="8" />
                    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                  </>
                )}
                {icon === 'results' && (
                  <>
                    <rect height="7" rx="2" width="7" x="3" y="3" />
                    <rect height="7" rx="2" width="7" x="14" y="3" />
                    <rect height="7" rx="2" width="7" x="3" y="14" />
                    <rect height="7" rx="2" width="7" x="14" y="14" />
                  </>
                )}
                {icon === 'history' && (
                  <>
                    <circle cx="12" cy="12" r="8" />
                    <path d="M12 7v5l3 2M4 5l-2 2 2 2" />
                  </>
                )}
                {icon === 'credentials' && (
                  <>
                    <rect height="11" rx="3" width="16" x="4" y="10" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
                  </>
                )}
                {icon === 'settings' && (
                  <>
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-2.5v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H6.4v-2.5h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.8-1.8.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5v-.2H15v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.2V14h-.2a1.7 1.7 0 0 0-1.5 1Z" />
                  </>
                )}
                {icon === 'profile' && (
                  <>
                    <circle cx="12" cy="8" r="3" />
                    <path d="M5 21a7 7 0 0 1 14 0" />
                  </>
                )}
              </svg>
              <span>{label}</span>
            </a>
          ))}
        </nav>
        <div className="sidebar__status" title="Sessão autenticada">
          <span />
          <small>Autenticado</small>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar" id="top">
          <div className="topbar__identity">
            <span className="eyebrow">{meta.eyebrow}</span>
            <h1>{meta.title}</h1>
            <p>{meta.description}</p>
          </div>
          <div className="topbar__actions">
            <span className="wordmark">
              OSINT <b>Pier</b>
            </span>
            <span className="internal-badge">
              <i /> Rede interna
            </span>
            <span className="auth-user" title={user.email ?? undefined}>
              {user.email ?? 'Usuário autenticado'}
            </span>
            <button
              className="auth-logout"
              onClick={() => void signOut()}
              type="button"
            >
              Sair
            </button>
          </div>
        </header>

        <main>
          {page === 'analysis' && (
            <>
              <section className="overview" id="analysis">
                <div className="analysis-card">
                  <div className="analysis-card__heading">
                    <div>
                      <span className="eyebrow">Nova investigação</span>
                      <h2>Consulte um alvo ou identidade</h2>
                    </div>
                  </div>
                  <p>
                    Os checks são executados em paralelo e os resultados
                    aparecem assim que cada fonte responde.
                  </p>

                  <form className="analysis-form" onSubmit={analyze}>
                    <label htmlFor="target">Alvo da análise</label>
                    <div className="target-control">
                      <span className="target-prefix">›</span>
                      <input
                        id="target"
                        onChange={(event) => setTarget(event.target.value)}
                        placeholder="example.com, 8.8.8.8, username ou e-mail"
                        required
                        value={target}
                      />
                      <button
                        className="button"
                        disabled={checks.length === 0}
                        type="submit"
                      >
                        Analisar agora
                      </button>
                    </div>

                    <div className="analysis-filters">
                      <button
                        className="filter-toggle"
                        type="button"
                        aria-expanded={filtersOpen}
                        onClick={() => setFiltersOpen((open) => !open)}
                      >
                        <span>
                          <b>Filtros e ferramentas</b>
                          <small>
                            {checks.length} de {compatibleChecks.length}{' '}
                            selecionadas
                          </small>
                        </span>
                        <span className="filter-toggle__state">
                          {filtersOpen ? 'Recolher' : 'Expandir'}
                          <svg aria-hidden="true" viewBox="0 0 24 24">
                            <path
                              d={filtersOpen ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'}
                            />
                          </svg>
                        </span>
                      </button>

                      {filtersOpen && (
                        <div className="analysis-filters__body">
                          <fieldset className="check-picker">
                            <legend>Ferramentas desta análise</legend>
                            <div className="check-picker__actions">
                              <button
                                className="button button--secondary button--small"
                                onClick={() =>
                                  setSelectedCheckIds(
                                    compatibleChecks.map((check) => check.id),
                                  )
                                }
                                type="button"
                              >
                                Selecionar todas
                              </button>
                              <button
                                className="button button--secondary button--small"
                                onClick={() => setSelectedCheckIds([])}
                                type="button"
                              >
                                Limpar seleção
                              </button>
                            </div>
                            <div className="check-picker__list">
                              {compatibleChecks.map((check) => {
                                const checked =
                                  selectedCheckIds === null ||
                                  selectedCheckIds.includes(check.id);
                                return (
                                  <label
                                    className={`check-picker__item ${checked ? 'check-picker__item--active' : ''}`}
                                    key={check.id}
                                  >
                                    <input
                                      aria-label={`${checked ? 'Desativar' : 'Ativar'} ${check.label}`}
                                      checked={checked}
                                      onChange={(event) => {
                                        setSelectedCheckIds((current) => {
                                          const ids =
                                            current ??
                                            compatibleChecks.map(
                                              (item) => item.id,
                                            );
                                          return event.target.checked
                                            ? [...new Set([...ids, check.id])]
                                            : ids.filter(
                                                (id) => id !== check.id,
                                              );
                                        });
                                      }}
                                      type="checkbox"
                                    />
                                    <span>{check.label}</span>
                                    <i aria-hidden="true" />
                                  </label>
                                );
                              })}
                              {compatibleChecks.length === 0 && (
                                <span className="muted">
                                  Nenhum plugin disponível para este tipo de
                                  consulta.
                                </span>
                              )}
                            </div>
                          </fieldset>
                        </div>
                      )}
                    </div>

                    <div className="form-meta">
                      <span>{checks.length} plugins selecionados</span>
                      <span>
                        {lastTarget
                          ? `${analysisSummary.resolved}/${checks.length} concluídos para ${lastTarget}`
                          : 'Aguardando um alvo'}
                      </span>
                    </div>
                  </form>
                </div>

                <aside className="analysis-context">
                  <span className="eyebrow">Estado atual</span>
                  <strong>
                    {analysisSummary.loading > 0
                      ? 'Análise em andamento'
                      : lastTarget
                        ? 'Última análise concluída'
                        : 'Sistema pronto'}
                  </strong>
                  <p>
                    {lastTarget
                      ? lastTarget
                      : 'As integrações disponíveis serão acionadas sob demanda.'}
                  </p>
                  <div className="signal-line" aria-hidden="true">
                    <span />
                  </div>
                  <div className="analysis-context__brand">
                    <img src="/piersec-logo.svg" alt="" />
                    <span>PierSec intelligence</span>
                  </div>
                </aside>

                <div className="metrics-grid" aria-label="Resumo da análise">
                  <article className="metric-card">
                    <span>Plugins</span>
                    <strong>{checks.length.toString().padStart(2, '0')}</strong>
                    <small>Fontes disponíveis</small>
                  </article>
                  <article className="metric-card">
                    <span>Concluídos</span>
                    <strong>
                      {analysisSummary.resolved.toString().padStart(2, '0')}
                    </strong>
                    <small>Respostas recebidas</small>
                  </article>
                  <article className="metric-card metric-card--positive">
                    <span>Sucesso</span>
                    <strong>
                      {analysisSummary.success.toString().padStart(2, '0')}
                    </strong>
                    <small>Sinais processados</small>
                  </article>
                  <article className="metric-card metric-card--attention">
                    <span>Atenção</span>
                    <strong>
                      {analysisSummary.attention.toString().padStart(2, '0')}
                    </strong>
                    <small>Erros ou integrações puladas</small>
                  </article>
                </div>
              </section>

              <section className="results-section" id="results">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">Execução em paralelo</span>
                    <h2>Resultados desta análise</h2>
                  </div>
                  <div className="section-heading__actions">
                    <span className="section-count">
                      {checks.length} módulos
                    </span>
                    <button
                      className="button button--secondary export-button"
                      disabled={!canExport}
                      onClick={exportAnalysis}
                      title={
                        canExport
                          ? 'Baixar relatório completo em JSON'
                          : 'Conclua uma análise para habilitar a exportação'
                      }
                      type="button"
                    >
                      <svg aria-hidden="true" viewBox="0 0 24 24">
                        <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
                      </svg>
                      Exportar JSON
                    </button>
                  </div>
                </div>

                {checksQuery.isLoading && (
                  <p className="muted">Descobrindo plugins disponíveis…</p>
                )}
                {checksQuery.isError && (
                  <p className="error-message">
                    A API não está disponível. Verifique o backend.
                  </p>
                )}
                {!checksQuery.isLoading &&
                  !checksQuery.isError &&
                  checks.length === 0 && (
                    <div className="empty-state">
                      <span>00</span>
                      <h3>Nenhum check está habilitado</h3>
                      <p>
                        Abra a página de credenciais para habilitar módulos de
                        análise.
                      </p>
                    </div>
                  )}
                {checks.some(
                  (check) => check.id === 'shodan-vulnerabilities',
                ) && (
                  <VulnerabilitySummary
                    check={checks.find(
                      (check) => check.id === 'shodan-vulnerabilities',
                    )!}
                    onRetry={() => retryCheck('shodan-vulnerabilities')}
                    state={
                      states['shodan-vulnerabilities'] ?? { status: 'idle' }
                    }
                  />
                )}
                <div className="results-grid">
                  {checks
                    .filter((check) => check.id !== 'shodan-vulnerabilities')
                    .map((check) => (
                      <ResultCard
                        key={check.id}
                        check={check}
                        onRetry={() => retryCheck(check.id)}
                        state={states[check.id] ?? { status: 'idle' }}
                      />
                    ))}
                </div>
              </section>
            </>
          )}

          {page === 'results' && (
            <section className="toolbox-section">
              <div className="page-lead">
                <div>
                  <span className="eyebrow">Execução individual</span>
                  <h2>Escolha uma ferramenta</h2>
                </div>
                <span className="section-count">
                  {toolboxChecks.length} disponíveis
                </span>
              </div>
              <p className="muted page-copy">
                Cada módulo roda isoladamente. Informe um alvo uma vez e execute
                apenas as fontes que deseja consultar.
              </p>
              <div className="toolbox-target">
                <label htmlFor="tool-target">Alvo da ferramenta</label>
                <div className="toolbox-target__controls">
                  <input
                    id="tool-target"
                    onChange={(event) => setToolTarget(event.target.value)}
                    placeholder="example.com, 8.8.8.8 ou analyst@example.com"
                    value={toolTarget}
                  />
                </div>
                <p className="target-auto-hint">
                  Detecção automática para domínio, IP, URL, e-mail, telefone,
                  nome ou username.
                </p>
              </div>
              <div className="toolbox-layout">
                <aside
                  className="tool-category-nav"
                  aria-label="Categorias de ferramentas"
                >
                  <span className="eyebrow">Índice</span>
                  <h3>Categorias</h3>
                  <nav>
                    {visibleToolCategories.map((category) => (
                      <button
                        key={category}
                        onClick={() =>
                          document
                            .getElementById(`tool-category-${category}`)
                            ?.scrollIntoView({
                              behavior: 'smooth',
                              block: 'start',
                            })
                        }
                        type="button"
                      >
                        {toolCategoryMeta[category].label}
                      </button>
                    ))}
                  </nav>
                </aside>
                <div className="toolbox-content">
                  <div className="tool-categories">
                    {visibleToolCategories.map((category) => {
                      const categoryChecks = toolboxChecks.filter(
                        (check) =>
                          (toolCategories[check.id] ?? 'web') === category,
                      );
                      const categoryPlanned = plannedTools.filter(
                        (tool) => tool.category === category,
                      );
                      if (
                        categoryChecks.length === 0 &&
                        categoryPlanned.length === 0
                      )
                        return null;
                      return (
                        <section
                          className="tool-category"
                          id={`tool-category-${category}`}
                          key={category}
                        >
                          <div className="tool-category__heading">
                            <div>
                              <span className="eyebrow">Categoria</span>
                              <h3>{toolCategoryMeta[category].label}</h3>
                              <p>{toolCategoryMeta[category].description}</p>
                            </div>
                            <span className="section-count">
                              {categoryChecks.length + categoryPlanned.length}{' '}
                              itens
                            </span>
                          </div>
                          <div className="tool-grid">
                            {categoryChecks.map((check) => {
                              const state = toolStates[check.id] ?? {
                                status: 'idle',
                              };
                              return (
                                <article className="tool-card" key={check.id}>
                                  <div className="tool-card__heading">
                                    <ToolLogo
                                      checkId={check.id}
                                      label={check.label}
                                    />
                                    <div>
                                      <span className="eyebrow">
                                        {check.configured
                                          ? 'Disponível'
                                          : 'Chave pendente'}
                                      </span>
                                      <h3>{check.label}</h3>
                                    </div>
                                  </div>
                                  <p>{checkDescription(check)}</p>
                                  <div className="tool-card__meta">
                                    {check.supportedTargetKinds
                                      .map(formatTargetKind)
                                      .join(' · ')}
                                  </div>
                                  <button
                                    className="button tool-card__run"
                                    disabled={
                                      !toolTarget.trim() ||
                                      state.status === 'loading'
                                    }
                                    onClick={() => void executeTool(check.id)}
                                    type="button"
                                  >
                                    {state.status === 'loading'
                                      ? 'Executando…'
                                      : 'Executar ferramenta'}
                                  </button>
                                  {state.status !== 'idle' && (
                                    <div className="tool-card__result">
                                      <ResultCard
                                        check={check}
                                        onRetry={() => retryTool(check.id)}
                                        state={state}
                                      />
                                    </div>
                                  )}
                                </article>
                              );
                            })}
                            {categoryPlanned.map((tool) => (
                              <article
                                className="tool-card tool-card--planned"
                                key={tool.id}
                              >
                                <div className="tool-card__heading">
                                  <ToolLogo
                                    checkId={tool.id}
                                    label={tool.label}
                                  />
                                  <div>
                                    <span className="eyebrow">
                                      Em planejamento
                                    </span>
                                    <h3>{tool.label}</h3>
                                  </div>
                                </div>
                                <p>{tool.description}</p>
                                <div className="tool-card__meta">
                                  Integração condicionada a configuração interna
                                </div>
                                <button
                                  className="button button--secondary tool-card__run"
                                  disabled
                                  type="button"
                                >
                                  Indisponível
                                </button>
                              </article>
                            ))}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>
          )}

          {page === 'history' && (
            <section className="history-section history-page" id="history">
              <div className="page-lead">
                <div>
                  <span className="eyebrow">Auditoria interna</span>
                  <h2>Histórico de análises</h2>
                </div>
                <span className="section-count">
                  {visibleHistory.length} registros
                </span>
              </div>
              <p className="muted history-copy">
                O histórico mostra apenas alvo, tipo e contadores agregados.
                Nenhum resultado detalhado ou segredo é armazenado.
                {historyQuery.isError &&
                  ' O Supabase está indisponível no momento.'}
              </p>
              {visibleHistory.length === 0 ? (
                <div className="empty-state">
                  <span>00</span>
                  <h3>Nenhuma análise registrada</h3>
                  <p>As próximas consultas aparecerão aqui para auditoria.</p>
                </div>
              ) : (
                <div className="history-list">
                  {visibleHistory.map((entry) => (
                    <article className="history-entry" key={entry.id}>
                      <div>
                        <span className="eyebrow">
                          {formatTargetKind(entry.targetKind)} ·{' '}
                          {formatHistoryDate(entry.completedAt)}
                        </span>
                        <h3>{entry.target}</h3>
                        <p>
                          <strong>{entry.success}</strong> sucesso
                          <span aria-hidden="true"> · </span>
                          <strong>{entry.attention}</strong> atenção
                          <span aria-hidden="true"> · </span>
                          {entry.total} checks
                        </p>
                      </div>
                      <button
                        className="button button--secondary button--small"
                        onClick={() => reuseHistoryEntry(entry)}
                        type="button"
                      >
                        Usar novamente
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {page === 'credentials' && (
            <>
              <section className="page-lead credentials-lead">
                <div>
                  <span className="eyebrow">Acesso autenticado</span>
                  <h2>Credenciais das integrações</h2>
                </div>
                <span className="lock-badge">Cofre local</span>
              </section>
              <p className="muted page-copy credentials-explainer">
                Esta página não é um login da plataforma. Ela apenas guarda, de
                forma criptografada, as chaves que os plugins usam para
                consultar APIs externas.
              </p>
              <CredentialsPanel />
            </>
          )}

          {page === 'profile' && (
            <ProfilePage onUserUpdated={updateUser} user={user} />
          )}

          {page === 'settings' && (
            <section className="settings-page">
              <div className="page-lead settings-lead">
                <div>
                  <span className="eyebrow">Preferências locais</span>
                  <h2>Aparência do painel</h2>
                </div>
                <span className="section-count">Salvo neste navegador</span>
              </div>
              <p className="muted page-copy">
                Escolha como o OSINT Pier deve aparecer. A opção é aplicada
                imediatamente e não altera os resultados das análises.
              </p>
              <div className="settings-card">
                <div>
                  <span className="eyebrow">Tema de cor</span>
                  <h3>Escolha uma paleta</h3>
                  <p>Dark é o tema padrão; White oferece uma leitura clara.</p>
                </div>
                <div
                  aria-label="Tema de cor"
                  className="theme-options"
                  role="radiogroup"
                >
                  {(['dark', 'white'] as const).map((option) => (
                    <button
                      aria-checked={theme === option}
                      className={`theme-option theme-option--${option} ${theme === option ? 'theme-option--active' : ''}`}
                      key={option}
                      onClick={() => setTheme(option)}
                      role="radio"
                      type="button"
                    >
                      <span className="theme-option__swatch" />
                      <span>
                        <strong>{option === 'dark' ? 'Dark' : 'White'}</strong>
                        <small>
                          {theme === option ? 'Selecionado' : 'Aplicar tema'}
                        </small>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}
        </main>

        <footer className="site-footer">
          <span>OSINT Pier · PierSec intelligence</span>
          <span>Uso interno · segredos nunca expostos pelo cliente</span>
        </footer>
      </div>
    </div>
  );
}
