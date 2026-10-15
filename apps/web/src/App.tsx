import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { User } from '@supabase/supabase-js';
import {
  ApiRequestError,
  listChecks,
  listHistory,
  runCheck,
  saveHistory,
} from './api/client';
import { AnalysisInsights } from './components/analysis/AnalysisInsights';
import {
  InvestigationBento,
  SourceReadiness,
} from './components/analysis/InvestigationBento';
import {
  SignalTopologyCanvas,
  type SignalTopologyItem,
} from './components/analysis/SignalTopologyCanvas';
import { ResultCard, type CardState } from './components/checks/ResultCard';
import { MetricCard } from './components/primitives/MetricCard';
import { ToolLogo } from './components/primitives/ToolLogo';
import { WorkspaceNavigation } from './components/shell/WorkspaceNavigation';
import { MotionSurface } from './components/motion/MotionSurface';
import { AppShell } from './components/shell/AppShell';
import { PageHeader } from './components/shell/PageHeader';
import { VulnerabilitySummary } from './components/vulnerabilities/VulnerabilitySummary';
import type { TargetKind } from '@osint-pier/contracts';
import { looksLikeCnpj, looksLikeCpf } from '@osint-pier/contracts';
import { getCompatibleChecks } from './features/analysis/compatible-checks';
import {
  clearAnalysisSession,
  readAnalysisSession,
  writeAnalysisSession,
} from './features/analysis/analysis-session';
import { getCheckDescription } from './features/analysis/check-descriptions';
import { CredentialsPanel } from './features/credentials/CredentialsPanel';
import { AccountMenu } from './components/shell/AccountMenu';
import {
  buildAnalysisExport,
  downloadAnalysisExport,
  printAnalysisExport,
} from './features/export/analysis-export';
import {
  createAnalysisHistoryEntry,
  type AnalysisHistoryEntry,
} from './features/history/analysis-history';
import { useAuth } from './features/auth/AuthGate';
import { ProfilePage } from './features/profile/ProfilePage';
import { useGsapReveal } from './hooks/useGsapReveal';

type Page =
  'analysis' | 'results' | 'history' | 'credentials' | 'profile' | 'settings';
type AccountTab = 'profile' | 'settings';
type Theme = 'dark' | 'white';
type ResultFilter = 'all' | 'success' | 'attention';

const pageMeta: Record<
  Page,
  { eyebrow: string; title: string; description: string }
> = {
  analysis: {
    eyebrow: 'OSINT Pier / investigação',
    title: 'Bancada de investigação',
    description: 'Fontes abertas. Evidências conectadas.',
  },
  results: {
    eyebrow: 'OSINT Pier / ferramentas',
    title: 'Biblioteca de ferramentas',
    description:
      'Escolha uma fonte, entenda seu escopo e execute uma consulta isolada.',
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
  cnpj: 'personal',
  cpf: 'personal',
  'osint-brazuca': 'personal',
  'abuse-ipdb': 'threat',
  cookies: 'web',
  'dns-records': 'web',
  gobuster: 'web',
  'http-headers': 'web',
  'hunter-io': 'personal',
  'ip-info': 'web',
  katana: 'web',
  nmap: 'web',
  'osint-framework': 'web',
  sherlock: 'personal',
  'linkedin-profile': 'personal',
  'redirect-chain': 'web',
  'robots-sitemap': 'web',
  'server-location': 'web',
  'server-status': 'web',
  nuclei: 'threat',
  shodan: 'threat',
  'ssl-certificate': 'web',
  subfinder: 'web',
  'tech-stack': 'web',
  'virus-total': 'threat',
  'whois-rdap': 'web',
};

const plannedTools = [
  {
    id: 'osintgram',
    label: 'Osintgram',
    category: 'personal' as const,
    description: 'Planejado: depende de autenticação autorizada do Instagram.',
  },
];

function getAvatarUrl(user: User): string | undefined {
  const metadata = user.user_metadata ?? {};
  const candidate = metadata.avatar_url ?? metadata.picture;
  return typeof candidate === 'string' && candidate.trim()
    ? candidate.trim()
    : undefined;
}

function getUserInitials(email?: string | null): string {
  const value = email?.split('@')[0]?.trim() ?? '';
  const words = value.split(/[._-]+/).filter(Boolean);
  const initials =
    words.length > 1
      ? `${words[0]?.[0] ?? ''}${words[1]?.[0] ?? ''}`
      : value.slice(0, 2);
  return (initials || 'U').toUpperCase().padEnd(2, '•');
}

function UserAvatar({
  avatarUrl,
  email,
  className = '',
}: {
  avatarUrl?: string;
  email?: string | null;
  className?: string;
}) {
  return (
    <span
      aria-label={
        avatarUrl
          ? `Foto de ${email ?? 'usuário'}`
          : `Iniciais de ${email ?? 'usuário'}`
      }
      className={`user-avatar ${className}`.trim()}
      role="img"
    >
      {avatarUrl ? (
        <span
          aria-hidden="true"
          className="user-avatar__image"
          style={{ backgroundImage: `url("${avatarUrl}")` }}
        />
      ) : (
        <span>{getUserInitials(email)}</span>
      )}
    </span>
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
    return window.localStorage.getItem('osint-pier-workbench-theme') === 'white'
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
    cnpj: 'CNPJ',
    cpf: 'CPF',
  }[kind];
}

function inferTargetKind(value: string): TargetKind {
  const input = value.trim();
  if (looksLikeCnpj(input)) return 'cnpj';
  if (looksLikeCpf(input)) return 'cpf';
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

function isAttentionState(state: CardState | undefined): boolean {
  return Boolean(
    state?.status === 'request-error' ||
    (state?.status === 'done' && state.result.status !== 'success'),
  );
}

function getResultFilterLabel(filter: ResultFilter): string {
  return {
    all: 'Todos',
    success: 'Com dados',
    attention: 'Atenção',
  }[filter];
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
  const [accountTab, setAccountTab] = useState<AccountTab>('profile');
  const [target, setTarget] = useState('');
  const [lastTarget, setLastTarget] = useState<string | null>(null);
  const [lastTargetKind, setLastTargetKind] = useState<TargetKind | 'auto'>(
    'auto',
  );
  const [states, setStates] = useState<Record<string, CardState>>({});
  const [toolStates, setToolStates] = useState<Record<string, CardState>>({});
  const [toolTarget, setToolTarget] = useState('');
  const [toolSearch, setToolSearch] = useState('');
  const [toolCategoryFilter, setToolCategoryFilter] = useState<
    ToolCategory | 'all'
  >('all');
  const [history, setHistory] = useState<AnalysisHistoryEntry[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all');
  const [analysisCanceled, setAnalysisCanceled] = useState(false);
  const [theme, setTheme] = useState<Theme>('dark');
  const themeInitialized = useRef(false);
  const animationScopeRef = useRef<HTMLElement>(null);
  const targetInputRef = useRef<HTMLInputElement>(null);
  const [analysisSessionReady, setAnalysisSessionReady] = useState(false);
  const [selectedCheckIds, setSelectedCheckIds] = useState<string[] | null>(
    null,
  );
  const analysisRunRef = useRef(0);
  const analysisAbortRef = useRef<AbortController | null>(null);

  const avatarUrl = getAvatarUrl(user);

  useEffect(() => {
    const handleHashChange = () => {
      const nextPage = readPage(window.location.hash);
      setPage(nextPage);
      if (nextPage === 'profile' || nextPage === 'settings') {
        setAccountTab(nextPage);
      }
    };
    handleHashChange();
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
      window.localStorage.setItem('osint-pier-workbench-theme', theme);
    } catch {
      // A browser privacy mode can disable local storage; the in-memory choice remains active.
    }
  }, [theme]);

  useEffect(() => {
    const session = readAnalysisSession();
    if (session) {
      setTarget(session.target ?? '');
      setLastTarget(session.target);
      setLastTargetKind(session.targetKind);
      setSelectedCheckIds(session.selectedCheckIds);
      setStates(session.states);
      setHistory(session.history);
    }
    setAnalysisSessionReady(true);
  }, []);

  useEffect(() => {
    if (!analysisSessionReady) return;
    writeAnalysisSession({
      target: lastTarget,
      targetKind: lastTargetKind,
      selectedCheckIds,
      states,
      history,
    });
  }, [
    analysisSessionReady,
    history,
    lastTarget,
    lastTargetKind,
    selectedCheckIds,
    states,
  ]);

  const activeChecks = useMemo(
    () => (checksQuery.data ?? []).filter((check) => check.enabled),
    [checksQuery.data],
  );
  const inferredTargetKind = target.trim() ? inferTargetKind(target) : null;
  const analysisTargetKind = target.trim() ? inferredTargetKind : null;
  const compatibleChecks = useMemo(
    () => getCompatibleChecks(activeChecks, analysisTargetKind),
    [activeChecks, analysisTargetKind],
  );
  const checks = useMemo(
    () =>
      selectedCheckIds === null
        ? compatibleChecks
        : compatibleChecks.filter((check) =>
            selectedCheckIds.includes(check.id),
          ),
    [compatibleChecks, selectedCheckIds],
  );
  const reportChecks = useMemo(() => {
    const reportTarget = lastTarget ?? target;
    const reportKind = reportTarget
      ? lastTarget
        ? lastTargetKind === 'auto'
          ? inferTargetKind(reportTarget)
          : lastTargetKind
        : analysisTargetKind
      : null;
    const compatible = getCompatibleChecks(activeChecks, reportKind);
    return selectedCheckIds === null
      ? compatible
      : compatible.filter((check) => selectedCheckIds.includes(check.id));
  }, [
    activeChecks,
    analysisTargetKind,
    lastTarget,
    lastTargetKind,
    selectedCheckIds,
    target,
  ]);
  const normalizedToolSearch = toolSearch.trim().toLocaleLowerCase('pt-BR');
  const toolboxChecks = useMemo(
    () =>
      activeChecks.filter((check) => {
        const category = toolCategories[check.id] ?? 'web';
        if (toolCategoryFilter !== 'all' && category !== toolCategoryFilter)
          return false;
        if (!normalizedToolSearch) return true;
        return `${check.label} ${check.id} ${getCheckDescription(check)}`
          .toLocaleLowerCase('pt-BR')
          .includes(normalizedToolSearch);
      }),
    [activeChecks, normalizedToolSearch, toolCategoryFilter],
  );
  const visiblePlannedTools = useMemo(
    () =>
      plannedTools.filter((tool) => {
        if (
          toolCategoryFilter !== 'all' &&
          tool.category !== toolCategoryFilter
        )
          return false;
        if (!normalizedToolSearch) return true;
        return `${tool.label} ${tool.id} ${tool.description}`
          .toLocaleLowerCase('pt-BR')
          .includes(normalizedToolSearch);
      }),
    [normalizedToolSearch, toolCategoryFilter],
  );
  const visibleToolCategories = useMemo(
    () =>
      (Object.keys(toolCategoryMeta) as ToolCategory[]).filter(
        (category) =>
          toolboxChecks.some(
            (check) => (toolCategories[check.id] ?? 'web') === category,
          ) || visiblePlannedTools.some((tool) => tool.category === category),
      ),
    [toolboxChecks, visiblePlannedTools],
  );
  const visibleHistory = useMemo(() => {
    const entries = [...history, ...(historyQuery.data ?? [])];
    return entries.filter(
      (entry, index, all) =>
        all.findIndex((candidate) => candidate.id === entry.id) === index,
    );
  }, [history, historyQuery.data]);

  const analysisSummary = useMemo(() => {
    const currentStates = reportChecks
      .map((check) => states[check.id])
      .filter((state): state is CardState => Boolean(state));
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
  }, [reportChecks, states]);

  const visibleResultChecks = useMemo(
    () =>
      reportChecks.filter((check) => {
        const state = states[check.id];
        if (resultFilter === 'success') {
          return state?.status === 'done' && state.result.status === 'success';
        }
        if (resultFilter === 'attention') return isAttentionState(state);
        return true;
      }),
    [reportChecks, resultFilter, states],
  );

  const topologyItems = useMemo<SignalTopologyItem[]>(
    () =>
      reportChecks.map((check) => {
        const state = states[check.id];
        if (state?.status === 'loading') {
          return { id: check.id, label: check.label, status: 'loading' };
        }
        if (state?.status === 'done' && state.result.status === 'success') {
          return { id: check.id, label: check.label, status: 'success' };
        }
        if (state?.status === 'request-error' || state?.status === 'done') {
          return { id: check.id, label: check.label, status: 'attention' };
        }
        return { id: check.id, label: check.label, status: 'idle' };
      }),
    [reportChecks, states],
  );

  useGsapReveal(animationScopeRef, page);

  const canExport = Boolean(
    lastTarget &&
    reportChecks.length > 0 &&
    analysisSummary.loading === 0 &&
    analysisSummary.resolved === reportChecks.length,
  );

  function navigate(nextPage: Page) {
    if (nextPage === 'profile' || nextPage === 'settings') {
      setAccountTab(nextPage);
    }
    window.location.hash = `#${nextPage}`;
    setPage(nextPage);
  }

  function navigateAccountTab(nextTab: AccountTab) {
    navigate(nextTab);
  }

  async function requestCheck(
    checkId: string,
    submittedTarget: string,
    submittedTargetKind: TargetKind | 'auto',
    signal?: AbortSignal,
  ): Promise<CardState> {
    try {
      const result = await runCheck(
        checkId,
        submittedTarget,
        submittedTargetKind === 'auto' ? undefined : submittedTargetKind,
        signal,
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
    options: { runId?: number; signal?: AbortSignal } = {},
  ): Promise<CardState> {
    const runId = options.runId ?? analysisRunRef.current;
    if (runId === analysisRunRef.current) {
      setStates((current) => ({
        ...current,
        [checkId]: { status: 'loading' },
      }));
    }
    const nextState = await requestCheck(
      checkId,
      submittedTarget,
      submittedTargetKind,
      options.signal,
    );
    if (runId === analysisRunRef.current && !options.signal?.aborted) {
      setStates((current) => ({ ...current, [checkId]: nextState }));
    }
    return nextState;
  }

  async function executeTool(checkId: string) {
    const submittedTarget = toolTarget.trim();
    const check = toolboxChecks.find((candidate) => candidate.id === checkId);
    if (!submittedTarget || !check?.configured) return;
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

    analysisAbortRef.current?.abort();
    const controller = new AbortController();
    analysisAbortRef.current = controller;
    const runId = analysisRunRef.current + 1;
    analysisRunRef.current = runId;

    setLastTarget(submittedTarget);
    setLastTargetKind(submittedTargetKind);
    setResultFilter('all');
    setAnalysisCanceled(false);
    setStates(
      Object.fromEntries(
        checks.map((check) => [check.id, { status: 'loading' }]),
      ),
    );

    const completedStates = await Promise.all(
      checks.map((check) =>
        executeOneCheck(check.id, submittedTarget, submittedTargetKind, {
          runId,
          signal: controller.signal,
        }),
      ),
    );
    if (controller.signal.aborted || runId !== analysisRunRef.current) return;
    if (analysisAbortRef.current === controller) {
      analysisAbortRef.current = null;
    }
    if (submittedTargetKind === 'cpf') return;
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

  function cancelAnalysis() {
    if (analysisSummary.loading === 0) return;
    analysisRunRef.current += 1;
    analysisAbortRef.current?.abort();
    analysisAbortRef.current = null;
    setAnalysisCanceled(true);
    setStates((current) =>
      Object.fromEntries(
        Object.entries(current).map(([checkId, state]) =>
          state.status === 'loading'
            ? [
                checkId,
                {
                  status: 'request-error',
                  message: 'Execução cancelada pelo usuário.',
                },
              ]
            : [checkId, state],
        ),
      ),
    );
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
      buildAnalysisExport({ target: lastTarget, checks: reportChecks, states }),
    );
  }

  function exportPdf() {
    if (!lastTarget || !canExport) return;
    printAnalysisExport(
      buildAnalysisExport({ target: lastTarget, checks: reportChecks, states }),
    );
  }

  function startNewAnalysis() {
    analysisRunRef.current += 1;
    analysisAbortRef.current?.abort();
    analysisAbortRef.current = null;
    clearAnalysisSession();
    setTarget('');
    setLastTarget(null);
    setLastTargetKind('auto');
    setSelectedCheckIds(null);
    setStates({});
    setFiltersOpen(false);
    setResultFilter('all');
    setAnalysisCanceled(false);
    window.requestAnimationFrame(() => targetInputRef.current?.focus());
  }

  function reuseHistoryEntry(entry: AnalysisHistoryEntry) {
    setTarget(entry.target);
    setSelectedCheckIds(null);
    navigate('analysis');
  }

  const meta = pageMeta[page];

  return (
    <AppShell>
      <WorkspaceNavigation
        activePage={page}
        onNavigate={navigate}
        onNewInvestigation={() => {
          startNewAnalysis();
          navigate('analysis');
        }}
        account={
          <AccountMenu
            email={user.email}
            onNavigate={navigateAccountTab}
            onSignOut={() => void signOut()}
            trigger={<UserAvatar avatarUrl={avatarUrl} email={user.email} />}
          />
        }
      />

      <div className="workspace">
        <PageHeader
          eyebrow={meta.eyebrow}
          title={meta.title}
          description={meta.description}
        />

        <main ref={animationScopeRef} data-page={page}>
          {page === 'analysis' && (
            <>
              <section
                className={`overview ${lastTarget ? 'overview--report' : 'overview--landing'}`}
                id="analysis"
                data-reveal
              >
                <div
                  className={`analysis-card ${lastTarget ? 'analysis-card--report' : 'analysis-card--landing'}`}
                >
                  <div className="analysis-card__topline">
                    <span>Nova investigação</span>
                    <span>OSINT Pier / Workspace</span>
                  </div>
                  <div className="analysis-card__heading">
                    <div>
                      <span className="eyebrow">
                        {lastTarget
                          ? 'Caso em preparo'
                          : 'Central de investigação'}
                      </span>
                      <h2>
                        {lastTarget
                          ? 'Consultar outro alvo'
                          : 'Nova investigação'}
                      </h2>
                    </div>
                    {lastTarget && (
                      <button
                        className="button button--secondary analysis-new-button"
                        onClick={startNewAnalysis}
                        type="button"
                      >
                        <span aria-hidden="true">＋</span>
                        Nova análise
                      </button>
                    )}
                  </div>
                  <p>
                    {lastTarget
                      ? 'As respostas chegam em paralelo e compõem o relatório abaixo.'
                      : 'Informe um ativo ou identidade para consultar as fontes compatíveis.'}
                  </p>

                  <form className="analysis-form" onSubmit={analyze}>
                    <label htmlFor="target">Alvo da análise</label>
                    <div className="target-control">
                      <span className="target-prefix" aria-hidden="true">
                        <svg viewBox="0 0 24 24">
                          <circle cx="10.5" cy="10.5" r="6.5" />
                          <path d="m16 16 5 5" />
                        </svg>
                      </span>
                      <input
                        id="target"
                        ref={targetInputRef}
                        onChange={(event) => setTarget(event.target.value)}
                        placeholder="Domínio, IP, e-mail, username, CPF ou CNPJ…"
                        required
                        value={target}
                      />
                      <button
                        className="button"
                        disabled={
                          checks.length === 0 || analysisSummary.loading > 0
                        }
                        type="submit"
                      >
                        {analysisSummary.loading > 0
                          ? 'Mapeando…'
                          : 'Analisar agora'}
                      </button>
                    </div>

                    {!lastTarget && (
                      <div
                        className="hero-signal-summary"
                        aria-label="Capacidades da plataforma"
                      >
                        <span>
                          <b>
                            {checks.filter((check) => check.configured)
                              .length || '—'}
                          </b>{' '}
                          fontes prontas
                        </span>
                        <span>Detecção automática de alvo</span>
                        <span>Resultados progressivos</span>
                      </div>
                    )}

                    <div className="target-preflight" aria-live="polite">
                      <strong>Detecção automática</strong>
                      <span>
                        {target.trim()
                          ? `${formatTargetKind(analysisTargetKind ?? 'domain')} · ${checks.length} fonte${checks.length === 1 ? '' : 's'} compatível${checks.length === 1 ? '' : 'is'}`
                          : 'O tipo do alvo será identificado ao iniciar a análise.'}
                      </span>
                    </div>

                    {analysisSummary.loading > 0 && (
                      <button
                        className="button button--quiet analysis-cancel-button"
                        onClick={cancelAnalysis}
                        type="button"
                      >
                        Cancelar execução
                      </button>
                    )}

                    {(lastTarget || target.trim()) && (
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
                                d={
                                  filtersOpen ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'
                                }
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
                                    <div
                                      className={`check-picker__item ${checked ? 'check-picker__item--active' : ''}`}
                                      key={check.id}
                                    >
                                      <input
                                        id={`analysis-check-${check.id}`}
                                        aria-label={`${checked ? 'Desativar' : 'Ativar'} ${check.label}`}
                                        checked={checked}
                                        onChange={(event) => {
                                          const nextChecked =
                                            event.currentTarget.checked;
                                          setSelectedCheckIds((current) => {
                                            const ids =
                                              current ??
                                              compatibleChecks.map(
                                                (item) => item.id,
                                              );
                                            return nextChecked
                                              ? [...new Set([...ids, check.id])]
                                              : ids.filter(
                                                  (id) => id !== check.id,
                                                );
                                          });
                                        }}
                                        type="checkbox"
                                      />
                                      <label
                                        htmlFor={`analysis-check-${check.id}`}
                                      >
                                        <span>{check.label}</span>
                                        <i aria-hidden="true" />
                                      </label>
                                    </div>
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
                    )}

                    {(lastTarget || target.trim()) && (
                      <div className="form-meta">
                        <span>{checks.length} plugins selecionados</span>
                        <span>
                          {lastTarget
                            ? `${analysisSummary.resolved}/${checks.length} concluídos para ${lastTarget}`
                            : 'Aguardando um alvo'}
                        </span>
                      </div>
                    )}
                  </form>
                </div>

                {!lastTarget && (
                  <SourceReadiness
                    checks={checksQuery.data ?? []}
                    loading={checksQuery.isLoading}
                    failed={checksQuery.isError}
                  />
                )}

                {lastTarget && (
                  <aside className="analysis-context">
                    <MotionSurface className="analysis-context__motion">
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
                      <SignalTopologyCanvas
                        items={topologyItems}
                        target={lastTarget}
                      />
                      <div className="signal-line" aria-hidden="true">
                        <span />
                      </div>
                      <div className="analysis-context__brand">
                        <img src="/piersec-logo.svg" alt="" />
                        <span>PierSec intelligence</span>
                      </div>
                    </MotionSurface>
                  </aside>
                )}

                {lastTarget && (
                  <div className="metrics-grid" aria-label="Resumo da análise">
                    <MetricCard
                      label="Fontes consultadas"
                      value={reportChecks.length}
                      detail="Escopo desta investigação"
                    />
                    <MetricCard
                      label="Evidências recebidas"
                      value={analysisSummary.resolved}
                      detail="Fontes que responderam"
                    />
                    <MetricCard
                      label="Sinais confirmados"
                      value={analysisSummary.success}
                      detail="Dados utilizáveis no caso"
                      tone="positive"
                    />
                    <MetricCard
                      label="Pontos pendentes"
                      value={analysisSummary.attention}
                      detail="Fontes indisponíveis ou sem configuração"
                      tone="attention"
                    />
                  </div>
                )}

                {lastTarget && reportChecks.length > 0 && (
                  <details className="analysis-insights-disclosure" open>
                    <summary>
                      <span>
                        <span className="eyebrow">Leitura de risco</span>
                        <strong>Panorama de segurança</strong>
                      </span>
                      <span>Ver leitura detalhada</span>
                    </summary>
                    <AnalysisInsights
                      checks={reportChecks}
                      states={states}
                      target={lastTarget}
                    />
                  </details>
                )}
              </section>

              {!lastTarget && (
                <InvestigationBento
                  checks={checksQuery.data ?? []}
                  checksLoading={checksQuery.isLoading}
                  checksFailed={checksQuery.isError}
                  getCategory={(id) => toolCategories[id] ?? 'web'}
                  history={visibleHistory}
                  loading={historyQuery.isLoading}
                  failed={historyQuery.isError}
                  onReuse={reuseHistoryEntry}
                  onTools={(category) => {
                    setToolCategoryFilter(category);
                    navigate('results');
                  }}
                />
              )}

              {lastTarget && (
                <section className="results-section" id="results" data-reveal>
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">Execução em paralelo</span>
                      <h2>Resultados desta análise</h2>
                    </div>
                    <div className="section-heading__actions">
                      <span className="section-count">
                        {analysisSummary.success} com dados ·{' '}
                        {analysisSummary.attention} atenção ·{' '}
                        {reportChecks.length} fontes
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
                      <button
                        className="button button--secondary export-button"
                        disabled={!canExport}
                        onClick={exportPdf}
                        title={
                          canExport
                            ? 'Abrir um relatório pronto para salvar como PDF'
                            : 'Conclua uma análise para habilitar a exportação'
                        }
                        type="button"
                      >
                        <svg aria-hidden="true" viewBox="0 0 24 24">
                          <path d="M6 3h9l3 3v15H6zM15 3v4h4M9 12h6M9 16h6" />
                        </svg>
                        Exportar PDF
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
                    reportChecks.length === 0 && (
                      <div className="empty-state">
                        <span>00</span>
                        <h3>Nenhum check está habilitado</h3>
                        <p>
                          Abra a página de credenciais para habilitar módulos de
                          análise.
                        </p>
                      </div>
                    )}
                  {reportChecks.some((check) => check.id === 'nuclei') && (
                    <VulnerabilitySummary
                      check={reportChecks.find(
                        (check) => check.id === 'nuclei',
                      )!}
                      onRetry={() => retryCheck('nuclei')}
                      state={states.nuclei ?? { status: 'idle' }}
                    />
                  )}
                  {lastTarget && analysisSummary.attention > 0 && (
                    <div className="results-filter-notice" role="status">
                      <span aria-hidden="true">i</span>
                      <p>
                        {analysisSummary.attention}{' '}
                        {analysisSummary.attention === 1
                          ? 'fonte precisa de revisão.'
                          : 'fontes precisam de revisão.'}{' '}
                        Nada foi ocultado: use os filtros abaixo para priorizar
                        a leitura.
                      </p>
                    </div>
                  )}
                  <div
                    className="results-toolbar"
                    aria-label="Filtro de resultados"
                  >
                    <div className="results-filter-group" role="tablist">
                      {(['all', 'success', 'attention'] as ResultFilter[]).map(
                        (filter) => {
                          const count =
                            filter === 'all'
                              ? reportChecks.length
                              : filter === 'success'
                                ? analysisSummary.success
                                : analysisSummary.attention;
                          return (
                            <button
                              aria-selected={resultFilter === filter}
                              className={
                                resultFilter === filter
                                  ? 'results-filter results-filter--active'
                                  : 'results-filter'
                              }
                              key={filter}
                              onClick={() => setResultFilter(filter)}
                              role="tab"
                              type="button"
                            >
                              {getResultFilterLabel(filter)}
                              <span>{count}</span>
                            </button>
                          );
                        },
                      )}
                    </div>
                    {analysisCanceled && (
                      <span className="results-cancelled" role="status">
                        Execução interrompida pelo usuário.
                      </span>
                    )}
                  </div>
                  {lastTarget &&
                    analysisSummary.loading === 0 &&
                    analysisSummary.resolved === reportChecks.length &&
                    reportChecks.length > 0 &&
                    visibleResultChecks.length === 0 && (
                      <div className="empty-state results-filter-empty">
                        <span>00</span>
                        <h3>Nenhum resultado neste filtro</h3>
                        <p>
                          Troque o filtro para Todos para revisar cada resposta
                          desta rodada.
                        </p>
                      </div>
                    )}
                  <div className="results-grid">
                    {visibleResultChecks
                      .filter((check) => check.id !== 'nuclei')
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
              )}
            </>
          )}

          {page === 'results' && (
            <section className="toolbox-section" data-reveal>
              <div className="page-lead">
                <div>
                  <span className="eyebrow">Fontes disponíveis</span>
                  <h2>Selecione uma fonte</h2>
                </div>
                <span className="section-count">
                  {toolboxChecks.length} disponíveis
                </span>
              </div>
              <p className="muted page-copy">
                Cada fonte informa quais alvos aceita, como está configurada e o
                tipo de evidência que pode trazer para o caso.
              </p>
              <div className="toolbox-target">
                <label htmlFor="tool-target">Alvo da ferramenta</label>
                <div className="toolbox-target__controls">
                  <input
                    id="tool-target"
                    onChange={(event) => setToolTarget(event.target.value)}
                    placeholder="Domínio, IP, e-mail, nome, CPF ou CNPJ"
                    value={toolTarget}
                  />
                </div>
                <p className="target-auto-hint">
                  Detecção automática para domínio, IP, URL, e-mail, telefone,
                  CPF, CNPJ, nome ou username. Para telefone, prefira +55.
                </p>
              </div>
              <div
                className="toolbox-toolbar"
                aria-label="Filtros da caixa de ferramentas"
              >
                <label className="toolbox-search">
                  <span className="sr-only">Buscar ferramenta</span>
                  <svg aria-hidden="true" viewBox="0 0 24 24">
                    <circle cx="10.5" cy="10.5" r="6.5" />
                    <path d="m16 16 5 5" />
                  </svg>
                  <input
                    onChange={(event) => setToolSearch(event.target.value)}
                    placeholder="Buscar por ferramenta ou função"
                    type="search"
                    value={toolSearch}
                  />
                </label>
                <div className="tool-category-filters" role="tablist">
                  <button
                    aria-selected={toolCategoryFilter === 'all'}
                    className={
                      toolCategoryFilter === 'all'
                        ? 'tool-category-filter tool-category-filter--active'
                        : 'tool-category-filter'
                    }
                    onClick={() => setToolCategoryFilter('all')}
                    role="tab"
                    type="button"
                  >
                    Todas
                  </button>
                  {(Object.keys(toolCategoryMeta) as ToolCategory[]).map(
                    (category) => (
                      <button
                        aria-selected={toolCategoryFilter === category}
                        className={
                          toolCategoryFilter === category
                            ? 'tool-category-filter tool-category-filter--active'
                            : 'tool-category-filter'
                        }
                        key={category}
                        onClick={() => setToolCategoryFilter(category)}
                        role="tab"
                        type="button"
                      >
                        {toolCategoryMeta[category].label}
                      </button>
                    ),
                  )}
                </div>
              </div>
              <div className="toolbox-layout">
                <aside
                  className="tool-category-nav"
                  aria-label="Categorias de ferramentas"
                >
                  <span className="eyebrow">Navegação</span>
                  <h3>Por contexto</h3>
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
                      const categoryPlanned = visiblePlannedTools.filter(
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
                              <span className="eyebrow">Grupo de fontes</span>
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
                                <article
                                  className={`tool-card tool-card--${toolCategories[check.id] ?? 'web'}`}
                                  key={check.id}
                                >
                                  <div className="tool-card__heading">
                                    <ToolLogo
                                      checkId={check.id}
                                      label={check.label}
                                    />
                                    <div>
                                      <span className="eyebrow">
                                        {check.configured
                                          ? 'Pronta para consulta'
                                          : 'Configuração necessária'}
                                      </span>
                                      <h3>{check.label}</h3>
                                    </div>
                                  </div>
                                  <p>{getCheckDescription(check)}</p>
                                  <div className="tool-card__meta">
                                    {check.supportedTargetKinds
                                      .map(formatTargetKind)
                                      .join(' · ')}
                                  </div>
                                  <button
                                    className="button tool-card__run"
                                    disabled={
                                      !toolTarget.trim() ||
                                      !check.configured ||
                                      state.status === 'loading'
                                    }
                                    onClick={() => void executeTool(check.id)}
                                    type="button"
                                  >
                                    {state.status === 'loading'
                                      ? 'Executando…'
                                      : check.configured
                                        ? 'Consultar fonte'
                                        : 'Indisponível'}
                                  </button>
                                  {state.status !== 'idle' && (
                                    <div className="tool-card__result">
                                      {check.id === 'nuclei' ? (
                                        <VulnerabilitySummary
                                          check={check}
                                          onRetry={() => retryTool(check.id)}
                                          state={state}
                                        />
                                      ) : (
                                        <ResultCard
                                          check={check}
                                          onRetry={() => retryTool(check.id)}
                                          state={state}
                                        />
                                      )}
                                    </div>
                                  )}
                                </article>
                              );
                            })}
                            {categoryPlanned.map((tool) => (
                              <article
                                className={`tool-card tool-card--planned tool-card--${tool.category}`}
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
            <section
              className="history-section history-page"
              id="history"
              data-reveal
            >
              <div className="page-lead">
                <div>
                  <span className="eyebrow">Auditoria interna</span>
                  <h2>Suas investigações</h2>
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
                  <h3>
                    {historyQuery.isError
                      ? 'Não foi possível carregar o histórico'
                      : 'Seu histórico começa com uma descoberta'}
                  </h3>
                  <p>
                    {historyQuery.isError
                      ? 'Tente recarregar a página. Você pode continuar fazendo novas análises.'
                      : 'Inicie uma análise para reunir suas consultas neste espaço.'}
                  </p>
                  <a
                    className="button"
                    href="#analysis"
                    onClick={() => navigate('analysis')}
                  >
                    Iniciar investigação
                  </a>
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
              <p className="muted page-copy credentials-explainer">
                Conecte suas fontes de inteligência. Gerencie as chaves das APIs
                em um cofre criptografado e acompanhe a disponibilidade de cada
                integração.
              </p>
              <CredentialsPanel />
            </>
          )}

          {(page === 'profile' || page === 'settings') && (
            <section className="account-page" data-reveal>
              <div className="account-page__tabs">
                <div>
                  <span className="eyebrow">Account / control plane</span>
                  <strong>Perfil e configurações</strong>
                </div>
                <div
                  aria-label="Área da conta"
                  className="account-page__tablist"
                  role="tablist"
                >
                  <button
                    aria-controls="account-profile-panel"
                    aria-selected={accountTab === 'profile'}
                    className={`account-page__tab ${accountTab === 'profile' ? 'account-page__tab--active' : ''}`}
                    onClick={() => navigateAccountTab('profile')}
                    role="tab"
                    type="button"
                  >
                    Perfil
                  </button>
                  <button
                    aria-controls="account-settings-panel"
                    aria-selected={accountTab === 'settings'}
                    className={`account-page__tab ${accountTab === 'settings' ? 'account-page__tab--active' : ''}`}
                    onClick={() => navigateAccountTab('settings')}
                    role="tab"
                    type="button"
                  >
                    Configurações
                  </button>
                </div>
              </div>

              {accountTab === 'profile' ? (
                <div id="account-profile-panel" role="tabpanel">
                  <ProfilePage onUserUpdated={updateUser} user={user} />
                </div>
              ) : (
                <section
                  className="settings-page"
                  data-reveal
                  id="account-settings-panel"
                  role="tabpanel"
                >
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
                      <p>
                        Escolha entre uma leitura clara ou escura. Sua
                        preferência fica salva neste navegador.
                      </p>
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
                            <strong>
                              {option === 'dark' ? 'Escuro' : 'Claro'}
                            </strong>
                            <small>
                              {theme === option
                                ? 'Selecionado'
                                : 'Aplicar tema'}
                            </small>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </section>
              )}
            </section>
          )}
        </main>

        <footer className="site-footer">
          <span>OSINT Pier · PierSec intelligence</span>
          <a className="site-footer__docs" href="/docs">
            Documentação do produto
          </a>
          <span>Uso interno · segredos nunca expostos pelo cliente</span>
        </footer>
      </div>
    </AppShell>
  );
}
