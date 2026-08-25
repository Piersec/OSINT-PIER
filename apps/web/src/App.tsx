import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
import { AnalysisScene } from './components/analysis/AnalysisScene';
import {
  SignalTopologyCanvas,
  type SignalTopologyItem,
} from './components/analysis/SignalTopologyCanvas';
import { ResultCard, type CardState } from './components/checks/ResultCard';
import { MetricCard } from './components/primitives/MetricCard';
import { ToolLogo } from './components/primitives/ToolLogo';
import { MotionSurface } from './components/motion/MotionSurface';
import { AppShell } from './components/shell/AppShell';
import { PageHeader } from './components/shell/PageHeader';
import { VulnerabilitySummary } from './components/vulnerabilities/VulnerabilitySummary';
import type { CheckCatalogItem, TargetKind } from '@osint-pier/contracts';
import { getSuccessfulChecks } from './features/analysis/visible-results';
import { getCompatibleChecks } from './features/analysis/compatible-checks';
import {
  clearAnalysisSession,
  readAnalysisSession,
  writeAnalysisSession,
} from './features/analysis/analysis-session';
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

type SidebarIcon = 'analysis' | 'results' | 'history' | 'credentials';

const sidebarGroups = [
  {
    label: 'Operations',
    items: [
      ['analysis', 'Análise', 'analysis'],
      ['results', 'Ferramentas', 'results'],
      ['history', 'Histórico', 'history'],
    ] as const,
  },
  {
    label: 'Compliance',
    items: [['credentials', 'Credenciais', 'credentials']] as const,
  },
] as const;

function SidebarNavIcon({ icon }: { icon: SidebarIcon }) {
  return (
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
    </svg>
  );
}

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
  ghunt: 'personal',
  gobuster: 'web',
  'http-headers': 'web',
  'hunter-io': 'personal',
  'ip-info': 'web',
  katana: 'web',
  nmap: 'web',
  'osint-framework': 'web',
  phoneinfoga: 'personal',
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
  {
    id: 'sherlock',
    label: 'Sherlock',
    category: 'personal' as const,
    description:
      'Planejado: depende do binário local e execução controlada de username.',
  },
];

function getAvatarUrl(user: User): string | undefined {
  const metadata = user.user_metadata ?? {};
  const candidate = metadata.avatar_url ?? metadata.picture;
  return typeof candidate === 'string' && candidate.trim()
    ? candidate.trim()
    : undefined;
}

const avatarCanvasSize = 256;
const maxAvatarFileSize = 10 * 1024 * 1024;

async function prepareAvatarFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Escolha um arquivo de imagem.');
  }
  if (file.size > maxAvatarFileSize) {
    throw new Error('A foto precisa ter no máximo 10 MB.');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const loadedImage = new Image();
      loadedImage.onload = () => resolve(loadedImage);
      loadedImage.onerror = () =>
        reject(new Error('Não foi possível ler a foto escolhida.'));
      loadedImage.src = objectUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = avatarCanvasSize;
    canvas.height = avatarCanvasSize;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Seu navegador não suporta este upload.');

    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    const scale = Math.max(
      avatarCanvasSize / sourceWidth,
      avatarCanvasSize / sourceHeight,
    );
    const drawWidth = sourceWidth * scale;
    const drawHeight = sourceHeight * scale;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(
      image,
      (avatarCanvasSize - drawWidth) / 2,
      (avatarCanvasSize - drawHeight) / 2,
      drawWidth,
      drawHeight,
    );

    const webp = canvas.toDataURL('image/webp', 0.85);
    return webp.startsWith('data:image/webp')
      ? webp
      : canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
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
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [avatarUrl]);

  return (
    <span className={`user-avatar ${className}`.trim()} aria-hidden="true">
      {avatarUrl && !failed ? (
        <img alt="" onError={() => setFailed(true)} src={avatarUrl} />
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
  if (typeof window === 'undefined') return 'white';
  try {
    return window.localStorage.getItem('osint-pier-theme') === 'white'
      ? 'white'
      : window.localStorage.getItem('osint-pier-theme') === 'dark'
        ? 'dark'
        : 'white';
  } catch {
    return 'white';
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
  const { user, signOut, updateAvatar, updateUser } = useAuth();
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
  const [history, setHistory] = useState<AnalysisHistoryEntry[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>('white');
  const themeInitialized = useRef(false);
  const [avatarDraft, setAvatarDraft] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState<string | null>(null);
  const animationScopeRef = useRef<HTMLElement>(null);
  const targetInputRef = useRef<HTMLInputElement>(null);
  const [analysisSessionReady, setAnalysisSessionReady] = useState(false);
  const [selectedCheckIds, setSelectedCheckIds] = useState<string[] | null>(
    null,
  );

  const avatarUrl = getAvatarUrl(user);
  const displayedAvatarUrl =
    avatarDraft === null ? avatarUrl : avatarDraft || undefined;

  useEffect(() => {
    setAvatarDraft(null);
  }, [avatarUrl]);

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
      window.localStorage.setItem('osint-pier-theme', theme);
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
  const analysisTargetKind = target.trim() ? inferTargetKind(target) : null;
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
    const currentStates = checks
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
  }, [checks, states]);

  const successfulChecks = useMemo(
    () => getSuccessfulChecks(checks, states),
    [checks, states],
  );

  const topologyItems = useMemo<SignalTopologyItem[]>(
    () =>
      checks.map((check) => {
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
    [checks, states],
  );

  useGsapReveal(animationScopeRef, page);

  const canExport = Boolean(
    lastTarget &&
    checks.length > 0 &&
    analysisSummary.loading === 0 &&
    analysisSummary.resolved === checks.length,
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

  function exportPdf() {
    if (!lastTarget || !canExport) return;
    printAnalysisExport(
      buildAnalysisExport({ target: lastTarget, checks, states }),
    );
  }

  async function saveAvatar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextAvatar = avatarDraft === null ? (avatarUrl ?? '') : avatarDraft;
    setAvatarBusy(true);
    setAvatarMessage(null);
    try {
      await updateAvatar(nextAvatar);
      setAvatarDraft(null);
      setAvatarMessage(
        nextAvatar.trim()
          ? 'Foto do perfil atualizada.'
          : 'Foto removida; as iniciais serão exibidas.',
      );
    } catch (error) {
      setAvatarMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível atualizar a foto do perfil.',
      );
    } finally {
      setAvatarBusy(false);
    }
  }

  async function handleAvatarFileChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    setAvatarBusy(true);
    setAvatarMessage(null);
    try {
      setAvatarDraft(await prepareAvatarFile(file));
      setAvatarMessage(
        'Arquivo selecionado. Clique em Salvar foto para aplicar.',
      );
    } catch (error) {
      setAvatarMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível preparar a foto escolhida.',
      );
    } finally {
      input.value = '';
      setAvatarBusy(false);
    }
  }

  function startNewAnalysis() {
    clearAnalysisSession();
    setTarget('');
    setLastTarget(null);
    setLastTargetKind('auto');
    setSelectedCheckIds(null);
    setStates({});
    setFiltersOpen(false);
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
        <div className="sidebar__brand-meta">
          <span>PIERSEC / 01</span>
          <small>Investigation workspace</small>
        </div>
        <nav>
          {sidebarGroups.map((group) => (
            <div className="sidebar__nav-group" key={group.label}>
              <span className="sidebar__nav-label">{group.label}</span>
              {group.items.map(([itemPage, label, icon]) => (
                <a
                  className={`sidebar__link ${page === itemPage ? 'sidebar__link--active' : ''}`}
                  href={`#${itemPage}`}
                  key={itemPage}
                  onClick={() => setPage(itemPage)}
                  aria-current={page === itemPage ? 'page' : undefined}
                >
                  <SidebarNavIcon icon={icon} />
                  <span>{label}</span>
                </a>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar__status" title="Sessão autenticada">
          <span />
          <div>
            <small>Workspace online</small>
            <strong>Sessão autenticada</strong>
          </div>
          <code>LIVE</code>
        </div>
      </aside>

      <div className="workspace">
        <PageHeader
          eyebrow={meta.eyebrow}
          title={meta.title}
          description={meta.description}
          actions={
            <>
              <span className="wordmark">
                OSINT <b>Pier</b>
              </span>
              <AccountMenu
                email={user.email}
                onNavigate={navigateAccountTab}
                onSignOut={() => void signOut()}
                trigger={
                  <UserAvatar avatarUrl={avatarUrl} email={user.email} />
                }
              />
            </>
          }
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
                    <span>01 / TARGET INTAKE</span>
                    <span>3D SIGNAL MAP</span>
                  </div>
                  <div className="analysis-card__heading">
                    <div>
                      <span className="eyebrow">Nova investigação</span>
                      <h2>O que você quer investigar?</h2>
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
                    Digite um domínio, IP, URL ou identidade. O mapa de sinais
                    acompanha a coleta e o relatório aparece assim que as fontes
                    respondem.
                  </p>

                  {(!lastTarget || analysisSummary.loading > 0) && (
                    <AnalysisScene
                      phase={analysisSummary.loading > 0 ? 'running' : 'idle'}
                      target={lastTarget ?? target.trim()}
                    />
                  )}

                  <form className="analysis-form" onSubmit={analyze}>
                    <label htmlFor="target">Alvo da análise</label>
                    <div className="target-control">
                      <span className="target-prefix">›</span>
                      <input
                        id="target"
                        ref={targetInputRef}
                        onChange={(event) => setTarget(event.target.value)}
                        placeholder="example.com, 8.8.8.8, username ou e-mail"
                        required
                        value={target}
                      />
                      <button
                        className="button"
                        disabled={checks.length === 0 || analysisSummary.loading > 0}
                        type="submit"
                      >
                        {analysisSummary.loading > 0 ? 'Mapeando…' : 'Analisar agora'}
                      </button>
                    </div>

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
                    label="Plugins"
                    value={checks.length}
                    detail="Fontes disponíveis"
                  />
                  <MetricCard
                    label="Concluídos"
                    value={analysisSummary.resolved}
                    detail="Respostas recebidas"
                  />
                  <MetricCard
                    label="Sucesso"
                    value={analysisSummary.success}
                    detail="Sinais processados"
                    tone="positive"
                  />
                  <MetricCard
                    label="Atenção"
                    value={analysisSummary.attention}
                    detail="Erros ou integrações puladas"
                    tone="attention"
                  />
                  </div>
                )}

                {lastTarget && checks.length > 0 && (
                  <AnalysisInsights
                    checks={checks}
                    states={states}
                    target={lastTarget}
                  />
                )}
              </section>

              {lastTarget && (
                <section className="results-section" id="results" data-reveal>
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">Execução em paralelo</span>
                    <h2>Resultados desta análise</h2>
                  </div>
                  <div className="section-heading__actions">
                    <span className="section-count">
                      {successfulChecks.length} com dados · {checks.length}{' '}
                      módulos
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
                {checks.some((check) => check.id === 'nuclei') && (
                  <VulnerabilitySummary
                    check={checks.find((check) => check.id === 'nuclei')!}
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
                        ? 'fonte não retornou dados e foi ocultada.'
                        : 'fontes não retornaram dados e foram ocultadas.'}{' '}
                      O panorama acima mantém esse detalhe para você revisar.
                    </p>
                  </div>
                )}
                {lastTarget &&
                  analysisSummary.loading === 0 &&
                  analysisSummary.resolved === checks.length &&
                  checks.length > 0 &&
                  successfulChecks.length === 0 && (
                    <div className="empty-state results-filter-empty">
                      <span>00</span>
                      <h3>Nenhuma fonte retornou dados</h3>
                      <p>
                        As respostas desta rodada foram ocultadas porque não
                        concluíram com sucesso. Revise o panorama de atenção e
                        tente novamente.
                      </p>
                    </div>
                  )}
                <div className="results-ledger__header" aria-hidden="true">
                  <span>Fonte / check</span>
                  <span>Dados observados</span>
                  <span>Fonte</span>
                  <span>Status</span>
                </div>
                <div className="results-grid">
                  {successfulChecks
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
            <section
              className="history-section history-page"
              id="history"
              data-reveal
            >
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
                  <div className="settings-card settings-card--profile">
                    <div className="profile-card__identity">
                      <UserAvatar
                        avatarUrl={displayedAvatarUrl}
                        email={user.email}
                        className="user-avatar--large"
                      />
                      <div>
                        <span className="eyebrow">Identidade visual</span>
                        <h3>Foto da conta</h3>
                        <p>
                          A mesma imagem aparece no cabeçalho e no menu da
                          conta.
                        </p>
                      </div>
                    </div>
                    <form className="profile-form" onSubmit={saveAvatar}>
                      <label htmlFor="profile-avatar-file">
                        Arquivo da foto do perfil
                        <input
                          accept="image/*"
                          id="profile-avatar-file"
                          onChange={handleAvatarFileChange}
                          type="file"
                        />
                      </label>
                      <p className="profile-form__hint">
                        Escolha uma imagem na sua máquina. Ela será ajustada
                        para o formato do avatar.
                      </p>
                      <div className="profile-form__actions">
                        <button
                          className="button"
                          disabled={avatarBusy || avatarDraft === null}
                          type="submit"
                        >
                          {avatarBusy ? 'Salvando…' : 'Salvar foto'}
                        </button>
                        <button
                          className="button button--ghost"
                          disabled={
                            avatarBusy ||
                            (avatarDraft === null ? !avatarUrl : !avatarDraft)
                          }
                          onClick={() => {
                            setAvatarDraft('');
                            setAvatarMessage(
                              'A foto será removida ao salvar as alterações.',
                            );
                          }}
                          type="button"
                        >
                          Remover
                        </button>
                      </div>
                      {avatarMessage && (
                        <p className="inline-notice" role="status">
                          {avatarMessage}
                        </p>
                      )}
                    </form>
                  </div>
                  <div className="settings-card">
                    <div>
                      <span className="eyebrow">Tema de cor</span>
                      <h3>Escolha uma paleta</h3>
                      <p>
                        Light é o tema padrão; Dark oferece uma leitura
                        concentrada.
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
                              {option === 'dark' ? 'Dark' : 'Light'}
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
