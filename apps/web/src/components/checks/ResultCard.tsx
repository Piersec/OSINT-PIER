import type { CheckCatalogItem, CheckResult } from '@osint-pier/contracts';
import { StatusPill } from '../primitives/StatusPill';
import { ToolLogo } from '../primitives/ToolLogo';
import { AbuseIpdbResult } from './AbuseIpdbResult';

export type CardState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; result: CheckResult }
  | {
      status: 'request-error';
      message: string;
      statusCode?: number;
      retryAfterSeconds?: number;
    };

const keyLabels: Record<string, string> = {
  A: 'IPv4',
  AAAA: 'IPv6',
  MX: 'Servidores de e-mail',
  NS: 'Servidores DNS',
  TXT: 'Registros TXT',
  CNAME: 'Alias CNAME',
  acceptAll: 'Aceita todos',
  abuseConfidenceScore: 'Índice de abuso',
  analyzedAt: 'Analisado em',
  approximate: 'Localização aproximada',
  asn: 'ASN',
  authorized: 'Certificado autorizado',
  block: 'Bloqueado',
  city: 'Cidade',
  communityVotes: 'Votos da comunidade',
  confidence: 'Confiança',
  contentType: 'Tipo de conteúdo',
  country: 'País',
  countryCode: 'Código do país',
  count: 'Quantidade',
  daysRemaining: 'Dias restantes',
  department: 'Departamento',
  disposable: 'Descartável',
  dnssecSigned: 'DNSSEC ativo',
  domain: 'Domínio',
  domains: 'Domínios',
  email: 'E-mail',
  emails: 'E-mails encontrados',
  finalStatus: 'Status final',
  finalUrl: 'URL final',
  flags: 'Sinalizadores',
  found: 'Encontrado',
  fingerprint256: 'Fingerprint SHA-256',
  firstName: 'Nome',
  gaiaId: 'Gaia ID',
  hasMapsReviews: 'Avaliações no Maps',
  hasPlayGamesProfile: 'Perfil no Play Games',
  hasPublicCalendar: 'Calendário público',
  hostnames: 'Hostnames',
  hostnameMatches: 'Hostname compatível',
  httpOnly: 'HttpOnly',
  ip: 'IP',
  ipv4: 'IPv4',
  ipv6: 'IPv6',
  isp: 'ISP',
  lastReportedAt: 'Última denúncia',
  lastUpdate: 'Última atualização',
  lastUpdated: 'Última atualização do perfil',
  location: 'Localização',
  network: 'Rede',
  nameservers: 'Nameservers',
  note: 'Observação',
  online: 'Online',
  organization: 'Organização',
  pattern: 'Padrão de e-mail',
  ports: 'Portas abertas',
  position: 'Cargo',
  profile: 'Perfil',
  profilePhotoCustom: 'Foto personalizada',
  profilePhotoUrl: 'Foto de perfil',
  protocol: 'Protocolo',
  quota: 'Cota da API',
  redirectCount: 'Redirecionamentos',
  registrar: 'Registrador',
  reputation: 'Reputação',
  reportUrl: 'Relatório externo',
  reports: 'Denúncias',
  responseTimeMs: 'Tempo de resposta',
  result: 'Resultado',
  security: 'Headers de segurança',
  securityScore: 'Headers presentes',
  selectedIp: 'IP consultado',
  services: 'Serviços detectados',
  score: 'Pontuação',
  scope: 'Escopo',
  seniority: 'Senioridade',
  smtpCheck: 'Verificação SMTP',
  service: 'Serviço',
  product: 'Produto',
  version: 'Versão',
  method: 'Método',
  length: 'Tamanho',
  status: 'Status',
  statusText: 'Mensagem HTTP',
  subject: 'Subject',
  subjectAlternativeNames: 'Nomes alternativos',
  summary: 'Resumo',
  tags: 'Tags',
  technologies: 'Tecnologias',
  timezone: 'Fuso horário',
  total: 'Total',
  totalOpenPorts: 'Portas abertas',
  transport: 'Transporte',
  type: 'Tipo',
  tool: 'Ferramenta',
  truncated: 'Resultado limitado',
  usageType: 'Tipo de uso',
  value: 'Valor',
  vulnerabilities: 'Vulnerabilidades',
  urls: 'URLs encontradas',
  subdomains: 'Subdomínios encontrados',
  paths: 'Caminhos encontrados',
  path: 'Caminho',
  statusCode: 'Código HTTP',
  webmail: 'Webmail',
  windowDays: 'Janela de análise',
  whitelisted: 'Lista permitida',
};

const hiddenFields: Record<string, Set<string>> = {
  'http-headers': new Set(['headers']),
  'ssl-certificate': new Set(['chain']),
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isDetailedAbuseIpdbResult(data: unknown): boolean {
  return (
    isRecord(data) && ('abuseConfidenceScore' in data || 'reports' in data)
  );
}

function labelForKey(key: string): string {
  if (keyLabels[key]) return keyLabels[key];
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (value) => value.toUpperCase());
}

function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime()) && /T\d{2}:\d{2}/.test(value)) {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(parsed);
  }
  return value;
}

function ScalarValue({ value, field }: { value: unknown; field?: string }) {
  if (value === null || value === undefined || value === '') {
    return <span className="result-empty">Não informado</span>;
  }
  if (typeof value === 'boolean') {
    return (
      <span className={`result-bool result-bool--${value ? 'yes' : 'no'}`}>
        {value ? 'Sim' : 'Não'}
      </span>
    );
  }
  if (typeof value === 'number') {
    const suffix = field?.toLowerCase().includes('score') ? '/100' : '';
    return (
      <span className="result-number">
        {value}
        {suffix}
      </span>
    );
  }
  if (typeof value === 'string') {
    const display = /At$|Date$|ReportedAt$|analyzedAt/i.test(field ?? '')
      ? formatDate(value)
      : value;
    if (isUrl(value)) {
      return (
        <a
          className="result-link"
          href={value}
          rel="noreferrer"
          target="_blank"
        >
          {display}
        </a>
      );
    }
    return <span>{display}</span>;
  }
  return <span>{String(value)}</span>;
}

function ResultTable({ items }: { items: Array<Record<string, unknown>> }) {
  const visibleItems = items.slice(0, 12);
  const keys = [...new Set(visibleItems.flatMap((item) => Object.keys(item)))]
    .filter((key) => key !== 'sources')
    .slice(0, 5);
  return (
    <div className="result-table" role="table">
      {visibleItems.map((item, index) => (
        <div
          className="result-table__row"
          key={String(item.id ?? index)}
          role="row"
        >
          {keys.map((key) => (
            <div className="result-table__cell" key={key} role="cell">
              <span>{labelForKey(key)}</span>
              <DataValue depth={2} field={key} value={item[key]} />
            </div>
          ))}
        </div>
      ))}
      {items.length > visibleItems.length && (
        <p className="result-table__more">
          + {items.length - visibleItems.length} itens omitidos para manter a
          leitura.
        </p>
      )}
    </div>
  );
}

function DataValue({
  value,
  field,
  depth = 0,
}: {
  value: unknown;
  field?: string;
  depth?: number;
}) {
  if (!Array.isArray(value) && !isRecord(value)) {
    return <ScalarValue value={value} field={field} />;
  }

  if (Array.isArray(value)) {
    if (value.length === 0)
      return <span className="result-empty">Nenhum item</span>;
    if (value.every(isRecord)) {
      return <ResultTable items={value.filter(isRecord)} />;
    }
    return (
      <div className="result-chips">
        {value.slice(0, 24).map((item, index) => (
          <span className="result-chip" key={`${String(item)}-${index}`}>
            {typeof item === 'string' && isUrl(item) ? (
              <a href={item} rel="noreferrer" target="_blank">
                {item}
              </a>
            ) : (
              String(item)
            )}
          </span>
        ))}
        {value.length > 24 && (
          <span className="result-chip result-chip--muted">
            +{value.length - 24}
          </span>
        )}
      </div>
    );
  }

  const entries = Object.entries(value).filter(([key]) => key !== 'sources');
  if (depth > 1) {
    return (
      <div className="result-inline-grid">
        {entries.map(([key, item]) => (
          <div className="result-inline-field" key={key}>
            <span>{labelForKey(key)}</span>
            <DataValue depth={depth + 1} field={key} value={item} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="result-nested">
      {entries.map(([key, item]) => (
        <div className="result-nested__field" key={key}>
          <span>{labelForKey(key)}</span>
          <DataValue depth={depth + 1} field={key} value={item} />
        </div>
      ))}
    </div>
  );
}

function curateData(checkId: string, data: unknown): unknown {
  if (!isRecord(data)) return data;
  const copy = { ...data };
  for (const key of hiddenFields[checkId] ?? []) delete copy[key];
  if (checkId === 'ssl-certificate' && Array.isArray(data.chain)) {
    copy.chain = `${data.chain.length} certificados na cadeia`;
  }
  return copy;
}

function ResultData({ checkId, data }: { checkId: string; data: unknown }) {
  const curated = curateData(checkId, data);
  if (!isRecord(curated)) {
    return (
      <div className="result-data">
        <DataValue value={curated} />
      </div>
    );
  }
  return (
    <div className="result-data">
      {Object.entries(curated).map(([key, value]) => (
        <section className="result-block" key={key}>
          <h4>{labelForKey(key)}</h4>
          <DataValue depth={0} field={key} value={value} />
        </section>
      ))}
    </div>
  );
}

export function ResultCard({
  check,
  state,
  onRetry,
}: {
  check: CheckCatalogItem;
  state: CardState;
  onRetry?: () => void;
}) {
  const visualStatus =
    state.status === 'done' ? state.result.status : state.status;
  const canRetry =
    (state.status === 'done' && state.result.status === 'error') ||
    (state.status === 'request-error' &&
      (!state.statusCode || state.statusCode >= 500));

  return (
    <article
      aria-busy={state.status === 'loading'}
      className={`result-card result-card--${visualStatus}`}
    >
      <header className="result-card__header">
        <div className="result-card__identity">
          <ToolLogo
            checkId={check.id}
            label={check.label}
            className="source-logo"
          />
          <div>
            <span className="eyebrow">{check.id}</span>
            <h3>{check.label}</h3>
          </div>
        </div>
        <StatusPill status={visualStatus} />
      </header>

      {state.status === 'idle' && (
        <p className="muted">
          Aguardando uma análise para executar esta checagem.
        </p>
      )}
      {state.status === 'loading' && (
        <div className="skeleton-stack" aria-label="Carregando resultado">
          <span />
          <span />
          <span />
        </div>
      )}
      {state.status === 'request-error' && (
        <div className="result-alert" role="alert">
          <p className="error-message">{state.message}</p>
          {state.statusCode === 400 && (
            <p className="result-guidance">
              Revise o alvo informado e inicie uma nova análise.
            </p>
          )}
          {state.statusCode === 429 && (
            <p className="result-guidance">
              {state.retryAfterSeconds
                ? `Aguarde aproximadamente ${state.retryAfterSeconds} segundos antes de tentar novamente.`
                : 'Aguarde a janela indicada antes de tentar novamente.'}
            </p>
          )}
        </div>
      )}
      {state.status === 'done' && (
        <>
          {state.result.error && (
            <div className="result-alert" role="alert">
              <p className="error-message">{state.result.error}</p>
              {state.result.status === 'skipped' && (
                <p className="result-guidance">
                  Esta integração está desabilitada até a credencial obrigatória
                  ser configurada.
                </p>
              )}
            </div>
          )}
          {state.result.data !== undefined &&
            (check.id === 'abuse-ipdb' &&
            state.result.status === 'success' &&
            isDetailedAbuseIpdbResult(state.result.data) ? (
              <AbuseIpdbResult data={state.result.data} />
            ) : (
              <ResultData checkId={check.id} data={state.result.data} />
            ))}
          <footer className="result-card__footer">
            <span>Fonte: {state.result.source}</span>
            <span>{Math.round(state.result.durationMs)} ms</span>
          </footer>
        </>
      )}
      <div className="result-actions">
        {canRetry && onRetry && (
          <button
            className="button button--secondary button--small"
            onClick={onRetry}
            type="button"
          >
            Tentar novamente
          </button>
        )}
        {state.status === 'done' && state.result.status === 'skipped' && (
          <a className="result-action-link" href="#credentials">
            Configurar credencial
          </a>
        )}
      </div>
    </article>
  );
}
