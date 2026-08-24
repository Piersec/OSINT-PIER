import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { CheckCatalogItem, TargetKind } from '@osint-pier/contracts';

const documentationUpdatedAt = '24 de agosto de 2026';
const documentationVersion = '1.5';

const targetLabels: Record<TargetKind, string> = {
  domain: 'domínio',
  ip: 'IP',
  url: 'URL',
  name: 'nome',
  username: 'username',
  email: 'e-mail',
  phone: 'telefone',
};

const plannedTools = [
  {
    label: 'Osintgram',
    description:
      'Avaliado; integração adiada por depender de sessão do Instagram e coleta ampla.',
  },
  {
    label: 'Sherlock',
    description:
      'Avaliado; requer runner externo autenticado para busca de usernames.',
  },
];

interface DocumentationNavItem {
  id: string;
  label: string;
  description: string;
  keywords: string;
}

interface DocumentationNavGroup {
  label: string;
  items: DocumentationNavItem[];
}

const documentationNav: DocumentationNavGroup[] = [
  {
    label: 'Comece aqui',
    items: [
      {
        id: 'docs-overview',
        label: 'Visão geral',
        description: 'O mapa rápido do OSINT Pier.',
        keywords: 'visão geral mapa introdução docs',
      },
      {
        id: 'docs-start',
        label: 'Primeiro acesso',
        description: 'Login, senha inicial e MFA.',
        keywords: 'login senha conta mfa autenticação supabase jwt',
      },
    ],
  },
  {
    label: 'Investigue',
    items: [
      {
        id: 'docs-analysis',
        label: 'Analisar um alvo',
        description: 'Consultas, criticidade e postura de segurança.',
        keywords:
          'análise alvo domínio ip url nome username email telefone abuseipdb gráficos sucesso erro vulnerabilidades cve kev falhas segurança sessão',
      },
      {
        id: 'docs-tools',
        label: 'Catálogo de ferramentas',
        description: 'Checks disponíveis e planejados.',
        keywords:
          'ferramentas plugins checks shodan virustotal hunter phoneinfoga ghunt',
      },
      {
        id: 'docs-history',
        label: 'Histórico e exportação',
        description: 'Auditoria e JSON local.',
        keywords: 'histórico auditoria exportar json supabase',
      },
    ],
  },
  {
    label: 'Administre',
    items: [
      {
        id: 'docs-credentials',
        label: 'Cofre de APIs',
        description: 'Credenciais e gateways externos.',
        keywords: 'credenciais cofre api key phoneinfoga ghunt gateway admin',
      },
      {
        id: 'docs-security',
        label: 'Perfil e segurança',
        description: 'Senha, avatar e MFA TOTP.',
        keywords: 'perfil segurança senha forte avatar foto mfa totp',
      },
      {
        id: 'docs-settings',
        label: 'Preferências',
        description: 'Tema e leitura do painel.',
        keywords: 'configurações tema dark white aparência',
      },
      {
        id: 'docs-help',
        label: 'Resolver problemas',
        description: 'Diagnóstico e manutenção.',
        keywords: 'ajuda erro api backend vercel deploy histórico problema',
      },
    ],
  },
];

const allDocumentationItems = documentationNav.flatMap((group) => group.items);

interface DocumentationPageProps {
  checks: CheckCatalogItem[];
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function DocumentationIcon({ name }: { name: string }) {
  if (name === 'analysis') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <circle cx="11" cy="11" r="6.5" />
        <path d="m16 16 4.5 4.5M11 8v6M8 11h6" />
      </svg>
    );
  }

  if (name === 'tools') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="m14.5 6.5 3-3 3 3-3 3M4 20l8.5-8.5M12 5H5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-7" />
        <path d="m13 4 7 7" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 3 5 6v5c0 4.4 2.8 8.2 7 10 4.2-1.8 7-5.6 7-10V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function DocumentationSection({
  eyebrow,
  id,
  number,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  id: string;
  number: string;
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <section className="documentation-section" id={id}>
      <div className="documentation-section__heading">
        <span className="documentation-section__number">{number}</span>
        <div>
          <span className="documentation-section__eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
          {intro && <p>{intro}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function DocumentationStep({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="documentation-step">
      <span className="documentation-step__number">{number}</span>
      <div>
        <h3>{title}</h3>
        <p>{children}</p>
      </div>
    </li>
  );
}

function DocumentationCallout({
  children,
  title,
  tone = 'info',
}: {
  children: ReactNode;
  title: string;
  tone?: 'info' | 'warning';
}) {
  return (
    <aside className={`documentation-callout documentation-callout--${tone}`}>
      <span className="documentation-callout__mark" aria-hidden="true">
        {tone === 'warning' ? '!' : 'i'}
      </span>
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </aside>
  );
}

function targetKinds(check: CheckCatalogItem): string {
  return check.supportedTargetKinds
    .map((kind) => targetLabels[kind])
    .join(' · ');
}

export function DocumentationPage({ checks }: DocumentationPageProps) {
  const [query, setQuery] = useState('');
  const [activeSection, setActiveSection] = useState('docs-overview');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if (
        (event.key === '/' ||
          (event.key.toLowerCase() === 'k' &&
            (event.metaKey || event.ctrlKey))) &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }

    window.addEventListener('keydown', focusSearch);
    return () => window.removeEventListener('keydown', focusSearch);
  }, []);

  const normalizedQuery = normalizeText(query.trim());
  const filteredItems = useMemo(() => {
    if (!normalizedQuery) return allDocumentationItems;

    const checkText = checks
      .map((check) => `${check.id} ${check.label}`)
      .join(' ');

    return allDocumentationItems.filter((item) =>
      normalizeText(
        `${item.label} ${item.description} ${item.keywords} ${checkText}`,
      ).includes(normalizedQuery),
    );
  }, [checks, normalizedQuery]);

  const visibleIds = new Set(filteredItems.map((item) => item.id));
  const visibleGroups = documentationNav
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => visibleIds.has(item.id)),
    }))
    .filter((group) => group.items.length > 0);
  const showTools = visibleIds.has('docs-tools');
  const enabledChecks = checks.filter((check) => check.enabled).length;

  function isVisible(id: string): boolean {
    return !normalizedQuery || visibleIds.has(id);
  }

  return (
    <section className="documentation-page">
      <header className="documentation-topbar">
        <a className="documentation-brand" href="/#analysis">
          <img src="/piersec-logo.svg" alt="" />
          <span>OSINT Pier</span>
        </a>
        <div
          className="documentation-breadcrumb"
          aria-label="Localização atual"
        >
          <span>Manual interno</span>
          <span aria-hidden="true">/</span>
          <strong>Documentação</strong>
        </div>
        <div className="documentation-topbar__actions">
          <span className="documentation-auth-status">
            <i aria-hidden="true" /> Sessão autenticada
          </span>
          <a className="button button--ghost button--small" href="/#analysis">
            Voltar ao painel
          </a>
        </div>
      </header>

      <div className="documentation-search-row">
        <form
          className="documentation-search"
          role="search"
          onSubmit={(event) => event.preventDefault()}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4.5 4.5" />
          </svg>
          <label className="sr-only" htmlFor="documentation-search-input">
            Buscar na documentação
          </label>
          <input
            aria-keyshortcuts="/"
            id="documentation-search-input"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar na documentação..."
            ref={searchRef}
            type="search"
            value={query}
          />
          <kbd>/</kbd>
        </form>
        <span className="documentation-search-row__hint">
          {normalizedQuery
            ? `${filteredItems.length} resultado${filteredItems.length === 1 ? '' : 's'}`
            : 'Pressione / para buscar'}
        </span>
      </div>

      <div className="documentation-layout">
        <aside
          className="documentation-sidebar"
          aria-label="Navegação da documentação"
        >
          <div className="documentation-sidebar__heading">
            <span className="documentation-sidebar__mark">P</span>
            <div>
              <strong>Documentação</strong>
              <span>OSINT Pier / v{documentationVersion}</span>
            </div>
          </div>

          <nav className="documentation-nav">
            {visibleGroups.length > 0 ? (
              visibleGroups.map((group) => (
                <div className="documentation-nav__group" key={group.label}>
                  <span>{group.label}</span>
                  {group.items.map((item) => (
                    <a
                      aria-current={
                        activeSection === item.id ? 'page' : undefined
                      }
                      className={
                        activeSection === item.id
                          ? 'documentation-nav__link documentation-nav__link--active'
                          : 'documentation-nav__link'
                      }
                      href={`#${item.id}`}
                      key={item.id}
                      onClick={() => setActiveSection(item.id)}
                    >
                      <i aria-hidden="true" />
                      <span>
                        <strong>{item.label}</strong>
                        <small>{item.description}</small>
                      </span>
                    </a>
                  ))}
                </div>
              ))
            ) : (
              <p className="documentation-nav__empty">
                Nenhuma seção encontrada.
              </p>
            )}
          </nav>

          <div className="documentation-sidebar__footer">
            <span className="documentation-live-dot" aria-hidden="true" />
            <div>
              <strong>Conteúdo operacional</strong>
              <span>Atualizado em {documentationUpdatedAt}</span>
            </div>
          </div>
        </aside>

        <main className="documentation-main">
          <div className="documentation-main__eyebrow">
            <span>OSINT Pier / Docs</span>
            <span>Atualizado em {documentationUpdatedAt}</span>
          </div>

          {normalizedQuery && filteredItems.length === 0 ? (
            <div className="documentation-no-results">
              <span className="documentation-no-results__code">404</span>
              <h1>Nenhum capítulo encontrado</h1>
              <p>
                Tente buscar por uma tarefa, ferramenta ou palavra-chave
                diferente.
              </p>
              <button
                className="button button--secondary"
                onClick={() => setQuery('')}
                type="button"
              >
                Limpar busca
              </button>
            </div>
          ) : (
            <>
              {isVisible('docs-overview') && (
                <section className="documentation-hero" id="docs-overview">
                  <div className="documentation-hero__copy">
                    <span className="documentation-kicker">
                      <i aria-hidden="true" /> Manual operacional / v
                      {documentationVersion}
                    </span>
                    <h1>
                      Investigue com
                      <em> contexto.</em>
                    </h1>
                    <p>
                      O mapa de uso do OSINT Pier: do primeiro acesso à leitura
                      de sinais, com o contexto necessário para trabalhar com
                      segurança.
                    </p>
                    <div className="documentation-hero__actions">
                      <a className="button" href="/#analysis">
                        Começar uma análise
                        <span aria-hidden="true">↗</span>
                      </a>
                      <a className="button button--ghost" href="#docs-start">
                        Ver primeiro acesso
                      </a>
                    </div>
                    <div className="documentation-hero__meta">
                      <span>
                        <strong>Acesso</strong>
                        Somente usuários autenticados
                      </span>
                      <span>
                        <strong>Escopo</strong>
                        Uso interno e autorizado
                      </span>
                    </div>
                  </div>
                  <div
                    className="documentation-hero__map"
                    aria-label="Roteiro recomendado"
                  >
                    <div className="documentation-hero__map-topline">
                      <span>Roteiro recomendado</span>
                      <span>PIER / 01</span>
                    </div>
                    <div className="documentation-hero__map-steps">
                      <div className="documentation-hero__map-step documentation-hero__map-step--active">
                        <span>01</span>
                        <strong>Acesse</strong>
                        <small>conta + MFA</small>
                      </div>
                      <div
                        className="documentation-hero__map-line"
                        aria-hidden="true"
                      />
                      <div className="documentation-hero__map-step">
                        <span>02</span>
                        <strong>Investigue</strong>
                        <small>alvo autorizado</small>
                      </div>
                      <div
                        className="documentation-hero__map-line"
                        aria-hidden="true"
                      />
                      <div className="documentation-hero__map-step">
                        <span>03</span>
                        <strong>Registre</strong>
                        <small>histórico + JSON</small>
                      </div>
                    </div>
                    <div className="documentation-hero__map-footer">
                      <span>Leitura guiada</span>
                      <strong>3 etapas essenciais</strong>
                    </div>
                  </div>
                </section>
              )}

              {!normalizedQuery && (
                <section
                  className="documentation-quickstart"
                  aria-labelledby="docs-quickstart-title"
                >
                  <div className="documentation-quickstart__heading">
                    <span className="documentation-section__eyebrow">
                      Acesso rápido
                    </span>
                    <h2 id="docs-quickstart-title">O que você quer fazer?</h2>
                  </div>
                  <div className="documentation-quickstart__grid">
                    <a
                      className="documentation-quick-card"
                      href="#docs-analysis"
                    >
                      <span className="documentation-quick-card__icon">
                        <DocumentationIcon name="analysis" />
                      </span>
                      <span>
                        <strong>Analisar um alvo</strong>
                        <small>Domínio, IP, URL ou identidade</small>
                      </span>
                      <b aria-hidden="true">↗</b>
                    </a>
                    <a className="documentation-quick-card" href="#docs-tools">
                      <span className="documentation-quick-card__icon">
                        <DocumentationIcon name="tools" />
                      </span>
                      <span>
                        <strong>Executar uma ferramenta</strong>
                        <small>Rodar um plugin isoladamente</small>
                      </span>
                      <b aria-hidden="true">↗</b>
                    </a>
                    <a
                      className="documentation-quick-card"
                      href="#docs-security"
                    >
                      <span className="documentation-quick-card__icon">
                        <DocumentationIcon name="security" />
                      </span>
                      <span>
                        <strong>Proteger a conta</strong>
                        <small>Senha, perfil e autenticação</small>
                      </span>
                      <b aria-hidden="true">↗</b>
                    </a>
                  </div>
                </section>
              )}

              <div className="documentation-reading-grid">
                <div className="documentation-content">
                  {isVisible('docs-start') && (
                    <DocumentationSection
                      eyebrow="01 / primeiros passos"
                      id="docs-start"
                      intro="O OSINT Pier é uma plataforma interna: as contas são autorizadas antes do login e não existe cadastro público."
                      number="01"
                      title="Acesse e prepare sua conta"
                    >
                      <ol className="documentation-steps">
                        <DocumentationStep
                          number="01"
                          title="Entre com sua conta autorizada"
                        >
                          Informe o e-mail e a senha fornecidos pelo responsável
                          interno. A página de login só libera o painel quando o
                          Supabase Auth está disponível.
                        </DocumentationStep>
                        <DocumentationStep
                          number="02"
                          title="Troque a senha inicial"
                        >
                          No primeiro acesso, a janela de segurança bloqueia o
                          painel até você criar uma senha forte com pelo menos
                          12 caracteres e sem repetir a senha inicial fraca.
                        </DocumentationStep>
                        <DocumentationStep
                          number="03"
                          title="Ative o MFA quando solicitado"
                        >
                          Se a conta ainda não possui TOTP, escolha Ativar agora
                          para abrir o perfil ou Ativar mais tarde para adiar
                          somente nesta sessão.
                        </DocumentationStep>
                        <DocumentationStep
                          number="04"
                          title="Confirme o segundo fator"
                        >
                          Contas com MFA configurado informam o código atual de
                          6 dígitos do autenticador antes de acessar o painel.
                        </DocumentationStep>
                      </ol>
                      <DocumentationCallout title="Sessão protegida">
                        A sessão é validada pelo Supabase Auth e o access token
                        acompanha as requisições do painel. A expiração do JWT é
                        definida pelo Auth, não por uma opção visual da
                        documentação.
                      </DocumentationCallout>
                    </DocumentationSection>
                  )}

                  {isVisible('docs-analysis') && (
                    <DocumentationSection
                      eyebrow="02 / investigação"
                      id="docs-analysis"
                      intro="A página Análise combina as fontes selecionadas, mostra cada resposta assim que ela chega e transforma a rodada em um panorama visual."
                      number="02"
                      title="Analise um alvo"
                    >
                      <ol className="documentation-steps">
                        <DocumentationStep number="01" title="Informe o alvo">
                          Use um domínio, IP, URL, nome, username, e-mail ou
                          telefone. O tipo é identificado automaticamente e pode
                          ser revisado no formulário.
                        </DocumentationStep>
                        <DocumentationStep
                          number="02"
                          title="Revise filtros e ferramentas"
                        >
                          Abra Filtros e ferramentas para conferir os checks
                          compatíveis com o tipo de alvo. Use Selecionar todas
                          ou Limpar seleção para ajustar o conjunto; checks que
                          não aceitam esse tipo não são executados nem geram
                          cards redundantes de erro.
                        </DocumentationStep>
                        <DocumentationStep
                          number="03"
                          title="Inicie a consulta"
                        >
                          Clique em Analisar agora. Cada plugin roda
                          isoladamente, com seu próprio timeout, para que uma
                          fonte lenta não esconda as demais.
                        </DocumentationStep>
                        <DocumentationStep
                          number="04"
                          title="Leia os sinais progressivamente"
                        >
                          A grade exibe apenas os checks que retornaram com
                          sucesso; erros e integrações puladas ficam fora dos
                          cards de resultado. O panorama é reservado para sinais
                          de segurança, vulnerabilidades e criticidade.
                        </DocumentationStep>
                        <DocumentationStep
                          number="05"
                          title="Use os insights para priorizar"
                        >
                          Use o índice de risco, a postura de segurança e o
                          radar de exposição para priorizar a investigação. O
                          mapa de criticidade cruza severidade e concentração
                          dos sinais; reputação, CVEs, CISA KEV, EPSS alto e
                          falhas de headers, cookies e TLS aparecem em leituras
                          separadas. Quando todos terminarem, Exportar JSON fica
                          disponível.
                        </DocumentationStep>
                        <DocumentationStep number="06" title="Retome a sessão">
                          A rodada ativa e o histórico recente são mantidos na
                          sessão do navegador. Você pode visitar outra página,
                          sair e voltar para a aba ou recarregar a aplicação sem
                          perder os resultados curados; uma requisição que ainda
                          estava carregando volta para Aguardando.
                        </DocumentationStep>
                      </ol>
                      <div className="documentation-status-grid">
                        <div>
                          <span className="documentation-status-dot documentation-status-dot--loading" />
                          <strong>Carregando</strong>
                          <p>A fonte ainda está respondendo.</p>
                        </div>
                        <div>
                          <span className="documentation-status-dot documentation-status-dot--success" />
                          <strong>Sucesso</strong>
                          <p>O check respondeu com dados curados.</p>
                        </div>
                        <div>
                          <span className="documentation-status-dot documentation-status-dot--attention" />
                          <strong>Atenção</strong>
                          <p>Houve erro, limite ou integração pulada.</p>
                        </div>
                      </div>
                      <DocumentationCallout title="Exemplo: AbuseIPDB">
                        Quando o AbuseIPDB responder, o card mostra a confiança
                        de abuso em uma barra, total de denúncias, ISP, tipo de
                        uso, ASN, domínio, país, cidade, última denúncia e links
                        para relatório e WHOIS. A cidade e o ASN podem ser
                        enriquecidos por uma geolocalização aproximada; campos
                        que as fontes não fornecerem aparecem como “Não
                        informado”.
                      </DocumentationCallout>
                      <DocumentationCallout
                        title="Use somente alvos autorizados"
                        tone="warning"
                      >
                        Os checks consultam serviços externos. Confirme sua
                        autorização e respeite termos de uso, privacidade, rate
                        limits e leis aplicáveis.
                      </DocumentationCallout>
                      <div className="documentation-actions">
                        <a
                          className="button button--secondary"
                          href="/#analysis"
                        >
                          Abrir Análise <span aria-hidden="true">↗</span>
                        </a>
                      </div>
                    </DocumentationSection>
                  )}

                  {showTools && (
                    <DocumentationSection
                      eyebrow="03 / catálogo"
                      id="docs-tools"
                      intro="Ferramentas permite repetir uma fonte, testar um alvo ou investigar um sinal sem executar o catálogo inteiro."
                      number="03"
                      title="Execute uma ferramenta por vez"
                    >
                      <ol className="documentation-steps">
                        <DocumentationStep
                          number="01"
                          title="Escolha a categoria"
                        >
                          Navegue por Web e infraestrutura, Threat intelligence
                          ou Dados pessoais e leads na página Ferramentas.
                        </DocumentationStep>
                        <DocumentationStep
                          number="02"
                          title="Informe o alvo da ferramenta"
                        >
                          Digite o alvo uma vez. A execução respeita os tipos
                          suportados pelo plugin e informa quando uma credencial
                          está pendente.
                        </DocumentationStep>
                        <DocumentationStep
                          number="03"
                          title="Execute e repita se necessário"
                        >
                          Clique em Executar ferramenta. O card exibe fonte,
                          duração, dados curados e a ação Tentar novamente
                          quando fizer sentido.
                        </DocumentationStep>
                      </ol>
                      <div className="documentation-catalog-heading">
                        <div>
                          <span className="documentation-section__eyebrow">
                            Catálogo ao vivo
                          </span>
                          <h3>{enabledChecks} ferramentas habilitadas</h3>
                        </div>
                        <span>{checks.length} registradas na API</span>
                      </div>
                      <div
                        className="documentation-tool-list"
                        aria-label="Checks atuais"
                      >
                        {checks.length > 0 ? (
                          checks.map((check) => (
                            <article
                              className="documentation-tool-item"
                              key={check.id}
                            >
                              <div className="documentation-tool-item__topline">
                                <span className="documentation-tool-item__code">
                                  {check.id}
                                </span>
                                <span
                                  className={
                                    check.enabled
                                      ? 'documentation-tool-item__status'
                                      : 'documentation-tool-item__status documentation-tool-item__status--muted'
                                  }
                                >
                                  {check.enabled
                                    ? 'Disponível'
                                    : 'Desabilitado'}
                                </span>
                              </div>
                              <h3>{check.label}</h3>
                              <p>
                                Consulta independente para {targetKinds(check)}.
                              </p>
                              <span className="documentation-tool-item__credential">
                                {check.configured
                                  ? 'Credencial configurada'
                                  : 'Pode exigir credencial'}
                              </span>
                            </article>
                          ))
                        ) : (
                          <p className="muted">O catálogo está carregando.</p>
                        )}
                      </div>
                      <div className="documentation-planned-list">
                        <span className="documentation-section__eyebrow">
                          Próximas integrações
                        </span>
                        {plannedTools.map((tool) => (
                          <div key={tool.label}>
                            <strong>{tool.label}</strong>
                            <span>{tool.description}</span>
                            <em>Planejado</em>
                          </div>
                        ))}
                      </div>
                      <div className="documentation-actions">
                        <a
                          className="button button--secondary"
                          href="/#results"
                        >
                          Abrir Ferramentas <span aria-hidden="true">↗</span>
                        </a>
                      </div>
                    </DocumentationSection>
                  )}

                  {isVisible('docs-history') && (
                    <DocumentationSection
                      eyebrow="04 / rastreabilidade"
                      id="docs-history"
                      intro="O histórico ajuda a reencontrar consultas sem transformar a plataforma em um arquivo de resultados sensíveis."
                      number="04"
                      title="Consulte e exporte"
                    >
                      <div className="documentation-two-column">
                        <div>
                          <span className="documentation-card-label">
                            Histórico
                          </span>
                          <h3>Auditoria resumida</h3>
                          <p>
                            A página Histórico mostra alvo, tipo, horário e
                            contadores agregados. Use Usar novamente para
                            preencher a análise com o mesmo alvo.
                          </p>
                          <p>
                            A sessão mantém um fallback imediato. Quando o
                            Supabase está configurado, o backend persiste
                            somente o resumo.
                          </p>
                        </div>
                        <div>
                          <span className="documentation-card-label">
                            Exportação
                          </span>
                          <h3>JSON no navegador</h3>
                          <p>
                            Depois que todos os checks terminarem, Exportar JSON
                            baixa um relatório versionado com alvo, horário,
                            resumo e respostas curadas.
                          </p>
                          <p>
                            A exportação não cria uma cópia adicional no
                            servidor e não substitui a análise técnica de um
                            ativo.
                          </p>
                        </div>
                      </div>
                      <div className="documentation-actions">
                        <a
                          className="button button--secondary"
                          href="/#history"
                        >
                          Abrir Histórico <span aria-hidden="true">↗</span>
                        </a>
                      </div>
                    </DocumentationSection>
                  )}

                  {isVisible('docs-credentials') && (
                    <DocumentationSection
                      eyebrow="05 / integrações"
                      id="docs-credentials"
                      intro="Credenciais é uma área administrativa interna. Ela guarda as chaves que plugins externos usam, sem devolvê-las à interface."
                      number="05"
                      title="Configure o cofre de APIs"
                    >
                      <ol className="documentation-steps">
                        <DocumentationStep number="01" title="Abra o cofre">
                          Entre em Credenciais e clique em Atualizar
                          credenciais. O painel mostra nomes, origem e status
                          sem revelar valores armazenados.
                        </DocumentationStep>
                        <DocumentationStep
                          number="02"
                          title="Cadastre ou substitua uma chave"
                        >
                          Informe o identificador em maiúsculas, como
                          VIRUSTOTAL_API_KEY, e cole o valor em Nova chave. O
                          segredo não volta para a interface.
                        </DocumentationStep>
                        <DocumentationStep
                          number="03"
                          title="Confira o status do plugin"
                        >
                          O catálogo indica se o módulo está habilitado e se a
                          credencial obrigatória está presente no cofre ou no
                          ambiente.
                        </DocumentationStep>
                        <DocumentationStep
                          number="04"
                          title="Remova apenas quando necessário"
                        >
                          Remover uma credencial persistida faz o plugin ficar
                          pulado quando depender dela e invalida o cache
                          relacionado.
                        </DocumentationStep>
                      </ol>
                      <DocumentationCallout title="PhoneInfoga usa um gateway externo">
                        O serviço oficial não roda dentro do Vercel. Além do
                        token no cofre, o backend precisa de PHONEINFOGA_API_URL
                        apontando para um gateway HTTPS hospedado separadamente.
                        Nunca coloque esse token no frontend.
                      </DocumentationCallout>
                      <DocumentationCallout title="GHunt usa uma sessão isolada">
                        O plugin consulta e-mails por um gateway HTTPS e precisa de
                        GHUNT_API_URL no backend e GHUNT_API_TOKEN no cofre. A
                        sessão/cookies do Google são configurados somente no
                        volume privado do runner Docker; nunca cole cookies no
                        painel, no Vercel ou no histórico.
                      </DocumentationCallout>
                      <div className="documentation-actions">
                        <a
                          className="button button--secondary"
                          href="/#credentials"
                        >
                          Abrir Credenciais <span aria-hidden="true">↗</span>
                        </a>
                      </div>
                    </DocumentationSection>
                  )}

                  {isVisible('docs-security') && (
                    <DocumentationSection
                      eyebrow="06 / identidade"
                      id="docs-security"
                      intro="A segurança da conta é parte do fluxo de investigação: proteja o acesso antes de ampliar as integrações."
                      number="06"
                      title="Mantenha o perfil protegido"
                    >
                      <div className="documentation-security-grid">
                        <div>
                          <span className="documentation-card-label">
                            Perfil
                          </span>
                          <h3>Foto de perfil</h3>
                          <p>
                            Escolha JPG, PNG ou WebP de até 2 MB. A imagem vai
                            para um bucket privado e a sessão recebe somente uma
                            URL temporária.
                          </p>
                        </div>
                        <div>
                          <span className="documentation-card-label">
                            Senha
                          </span>
                          <h3>Troca forte</h3>
                          <p>
                            Use Sugerir senha forte para gerar uma opção local.
                            O medidor exige combinação forte e a senha inicial
                            não pode ser mantida.
                          </p>
                        </div>
                        <div>
                          <span className="documentation-card-label">
                            MFA TOTP
                          </span>
                          <h3>Segundo fator</h3>
                          <p>
                            Configure pelo QR Code ou segredo alternativo,
                            confirme o código de 6 dígitos e use-o nos próximos
                            logins.
                          </p>
                        </div>
                      </div>
                      <DocumentationCallout
                        title="O segredo do MFA deve permanecer no autenticador"
                        tone="warning"
                      >
                        O QR Code e o segredo alternativo aparecem durante o
                        cadastro. Não compartilhe capturas de tela e remova
                        fatores que não reconhece.
                      </DocumentationCallout>
                      <div className="documentation-actions">
                        <a
                          className="button button--secondary"
                          href="/#profile"
                        >
                          Abrir Perfil <span aria-hidden="true">↗</span>
                        </a>
                      </div>
                    </DocumentationSection>
                  )}

                  {isVisible('docs-settings') && (
                    <DocumentationSection
                      eyebrow="07 / preferências"
                      id="docs-settings"
                      intro="Configurações altera somente a apresentação local do painel; resultados, permissões e histórico continuam iguais."
                      number="07"
                      title="Ajuste a aparência"
                    >
                      <div className="documentation-two-column">
                        <div>
                          <span className="documentation-theme-swatch documentation-theme-swatch--dark" />
                          <h3>Dark</h3>
                          <p>
                            O tema padrão, com fundo escuro e destaque ciano.
                          </p>
                        </div>
                        <div>
                          <span className="documentation-theme-swatch documentation-theme-swatch--white" />
                          <h3>White</h3>
                          <p>
                            Uma leitura clara salva somente neste navegador.
                          </p>
                        </div>
                      </div>
                      <div className="documentation-actions">
                        <a
                          className="button button--secondary"
                          href="/#settings"
                        >
                          Abrir Configurações <span aria-hidden="true">↗</span>
                        </a>
                      </div>
                    </DocumentationSection>
                  )}

                  {isVisible('docs-help') && (
                    <DocumentationSection
                      eyebrow="08 / resolução"
                      id="docs-help"
                      intro="Quando algo falhar, use a mensagem e o endpoint certo para separar problema de conta, deploy, credencial ou serviço externo."
                      number="08"
                      title="Resolva problemas comuns"
                    >
                      <div className="documentation-help-list">
                        <div>
                          <strong>“A API não está disponível”</strong>
                          <p>
                            Verifique o deploy do Vercel e o endpoint
                            /api/health. Sem sessão, as rotas protegidas devem
                            responder 401.
                          </p>
                        </div>
                        <div>
                          <strong>
                            “Chave ausente” ou “integração pulada”
                          </strong>
                          <p>
                            Abra Credenciais, confira o nome da variável e
                            valide gateways externos, como PHONEINFOGA_API_URL.
                          </p>
                        </div>
                        <div>
                          <strong>“Confirme o código do autenticador”</strong>
                          <p>
                            Use o código atual do TOTP. Se o dispositivo não
                            estiver disponível, peça ao responsável interno para
                            revisar o fator.
                          </p>
                        </div>
                        <div>
                          <strong>Histórico vazio</strong>
                          <p>
                            O histórico aparece depois de uma análise. Com
                            Supabase indisponível, a sessão ainda pode mostrar o
                            fallback local.
                          </p>
                        </div>
                      </div>
                      <DocumentationCallout title="Como manter esta página atualizada">
                        Quando uma função mudar, atualize este componente, a
                        data no topo, o PLAN.md e a issue correspondente no
                        Linear. Novos checks aparecem automaticamente no
                        catálogo, mas passos e avisos específicos precisam ser
                        descritos aqui.
                      </DocumentationCallout>
                    </DocumentationSection>
                  )}
                </div>

                <aside
                  className="documentation-rail"
                  aria-label="Informações da documentação"
                >
                  <div className="documentation-rail__block">
                    <span className="documentation-rail__label">
                      Nesta página
                    </span>
                    <nav>
                      {allDocumentationItems
                        .filter(
                          (item) => !normalizedQuery || visibleIds.has(item.id),
                        )
                        .slice(0, 8)
                        .map((item) => (
                          <a
                            href={`#${item.id}`}
                            key={item.id}
                            onClick={() => setActiveSection(item.id)}
                          >
                            {item.label}
                          </a>
                        ))}
                    </nav>
                  </div>
                  <div className="documentation-rail__block documentation-rail__block--status">
                    <span className="documentation-rail__label">
                      Status do conteúdo
                    </span>
                    <strong>
                      <i aria-hidden="true" /> Operacional
                    </strong>
                    <p>Esta página acompanha o fluxo atual do produto.</p>
                    <span className="documentation-rail__updated">
                      Última revisão · {documentationUpdatedAt}
                    </span>
                  </div>
                  <div className="documentation-rail__block documentation-rail__block--help">
                    <span className="documentation-rail__label">
                      Precisa de ajuda?
                    </span>
                    <p>
                      Comece por Resolver problemas ou fale com o responsável
                      interno.
                    </p>
                    <a href="#docs-help">
                      Abrir diagnóstico <span aria-hidden="true">↗</span>
                    </a>
                  </div>
                </aside>
              </div>
            </>
          )}
        </main>
      </div>
    </section>
  );
}
