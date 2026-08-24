import type { ReactNode } from 'react';
import type { CheckCatalogItem, TargetKind } from '@osint-pier/contracts';

const documentationUpdatedAt = '24 de agosto de 2026';
const documentationVersion = '1.0';

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
    label: 'GHunt',
    description:
      'Planejado para pesquisas autorizadas que dependem de sessão do Google.',
  },
  {
    label: 'Osintgram',
    description:
      'Planejado para execução controlada com autenticação do Instagram.',
  },
  {
    label: 'Sherlock',
    description:
      'Planejado para busca local de usernames com timeout controlado.',
  },
];

interface DocumentationPageProps {
  checks: CheckCatalogItem[];
}

function DocumentationSection({
  eyebrow,
  id,
  number,
  title,
  children,
}: {
  eyebrow: string;
  id: string;
  number: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="documentation-section" id={id}>
      <div className="documentation-section__heading">
        <span className="documentation-section__number">{number}</span>
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h3>{title}</h3>
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
        <h4>{title}</h4>
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
  if (check.supportedTargetKinds.length === 0) return 'alvo geral';
  return check.supportedTargetKinds
    .map((kind) => targetLabels[kind])
    .join(' · ');
}

export function DocumentationPage({ checks }: DocumentationPageProps) {
  return (
    <section className="documentation-page">
      <header className="documentation-route-bar">
        <a className="documentation-route-bar__brand" href="/#analysis">
          <img src="/piersec-logo.svg" alt="" />
          <span>OSINT Pier</span>
        </a>
        <span className="documentation-route-bar__label">Manual interno</span>
        <a className="button button--ghost button--small" href="/#analysis">
          Voltar ao painel
        </a>
      </header>

      <header className="documentation-hero">
        <div className="documentation-hero__copy">
          <span className="eyebrow">
            Manual operacional / v{documentationVersion}
          </span>
          <h2>Como trabalhar no OSINT Pier</h2>
          <p>
            Um guia direto para transformar um alvo autorizado em sinais
            organizados, entender cada estado da plataforma e manter a conta
            protegida.
          </p>
          <div className="documentation-hero__meta">
            <span>
              <b>Atualizado</b>
              {documentationUpdatedAt}
            </span>
            <span>
              <b>Acesso</b>
              Somente usuários autenticados
            </span>
          </div>
        </div>
        <div
          className="documentation-hero__signal"
          aria-label="Índice do manual"
        >
          <span className="documentation-hero__signal-label">PIER / DOCS</span>
          <strong>01</strong>
          <span className="documentation-hero__signal-line" aria-hidden="true">
            <i />
          </span>
          <small>Leia, execute, registre.</small>
        </div>
      </header>

      <nav className="documentation-index" aria-label="Índice da documentação">
        <div>
          <span className="eyebrow">Índice de uso</span>
          <strong>Encontre um fluxo</strong>
        </div>
        <div className="documentation-index__links">
          <a href="#docs-start">Começar</a>
          <a href="#docs-analysis">Analisar</a>
          <a href="#docs-tools">Ferramentas</a>
          <a href="#docs-history">Histórico</a>
          <a href="#docs-security">Segurança</a>
          <a href="#docs-help">Ajuda</a>
        </div>
      </nav>

      <div className="documentation-content">
        <DocumentationSection
          eyebrow="01 / primeiro acesso"
          id="docs-start"
          number="01"
          title="Entre e prepare sua conta"
        >
          <p className="documentation-lead">
            O OSINT Pier é uma plataforma interna. Não existe cadastro público:
            a conta precisa ser criada e autorizada no Supabase antes do login.
          </p>
          <ol className="documentation-steps">
            <DocumentationStep number="01" title="Abra a página de login">
              Informe o e-mail autorizado e a senha. O botão de entrar só é
              liberado quando a configuração do Supabase está disponível.
            </DocumentationStep>
            <DocumentationStep number="02" title="Troque a senha inicial">
              No primeiro acesso, uma janela obrigatória bloqueia o painel até
              você criar uma senha forte. Ela deve ter pelo menos 12 caracteres,
              combinar tipos de caracteres e não pode ser a senha inicial fraca.
            </DocumentationStep>
            <DocumentationStep number="03" title="Decida sobre o MFA">
              Se a conta ainda não possui TOTP, o painel recomenda ativá-lo. Use
              Ativar agora para abrir o perfil ou Ativar mais tarde para adiar
              somente nesta sessão.
            </DocumentationStep>
            <DocumentationStep number="04" title="Confirme o segundo fator">
              Contas com MFA verificado precisam informar o código de 6 dígitos
              do autenticador antes de acessar a plataforma.
            </DocumentationStep>
          </ol>
          <DocumentationCallout title="Sessão protegida">
            A sessão é validada pelo Supabase Auth e o access token acompanha as
            requisições do painel. A expiração do JWT é uma configuração do
            Auth, não uma opção visual do site.
          </DocumentationCallout>
        </DocumentationSection>

        <DocumentationSection
          eyebrow="02 / investigação"
          id="docs-analysis"
          number="02"
          title="Faça uma análise completa"
        >
          <p className="documentation-lead">
            A página Análise é o ponto de partida. Você informa um alvo, escolhe
            as fontes e acompanha as respostas chegando em paralelo.
          </p>
          <ol className="documentation-steps">
            <DocumentationStep number="01" title="Informe o alvo">
              Use um domínio, IP, URL, nome, username, e-mail ou telefone. O
              tipo é identificado automaticamente; nomes de campo e exemplos
              aparecem no próprio formulário.
            </DocumentationStep>
            <DocumentationStep number="02" title="Revise os filtros">
              Abra Filtros e ferramentas para conferir quais checks estão
              selecionados. Use Selecionar todas ou Limpar seleção quando quiser
              mudar o conjunto da análise.
            </DocumentationStep>
            <DocumentationStep number="03" title="Inicie a consulta">
              Clique em Analisar agora. Cada plugin roda isoladamente, com
              timeout próprio, e o resultado aparece assim que aquela fonte
              responder.
            </DocumentationStep>
            <DocumentationStep number="04" title="Leia o resumo">
              Os cards do topo mostram plugins, respostas concluídas, sucessos e
              itens que precisam de atenção. Use Exportar JSON quando todos os
              checks chegarem a um estado final.
            </DocumentationStep>
          </ol>
          <div className="documentation-status-grid">
            <div>
              <strong>Carregando</strong>
              <span>A fonte ainda está respondendo.</span>
            </div>
            <div>
              <strong>Sucesso</strong>
              <span>O check respondeu com dados curados.</span>
            </div>
            <div>
              <strong>Atenção</strong>
              <span>Houve erro, limite ou integração pulada.</span>
            </div>
          </div>
          <DocumentationCallout
            title="Use somente alvos autorizados"
            tone="warning"
          >
            Os checks consultam serviços externos. Confirme sua autorização e
            respeite termos de uso, privacidade, rate limits e leis aplicáveis
            antes de iniciar uma análise.
          </DocumentationCallout>
        </DocumentationSection>

        <DocumentationSection
          eyebrow="03 / catálogo"
          id="docs-tools"
          number="03"
          title="Use uma ferramenta por vez"
        >
          <p className="documentation-lead">
            Em Ferramentas, o mesmo catálogo pode ser executado individualmente.
            Isso é útil para repetir uma fonte, testar um alvo ou investigar um
            sinal específico sem iniciar todos os plugins.
          </p>
          <ol className="documentation-steps">
            <DocumentationStep number="01" title="Escolha a categoria">
              Navegue por Web e infraestrutura, Threat intelligence ou Dados
              pessoais e leads. A lista lateral da própria página leva direto à
              seção escolhida.
            </DocumentationStep>
            <DocumentationStep number="02" title="Informe o alvo da ferramenta">
              Digite o alvo uma vez. O tipo de consulta é inferido para cada
              execução, respeitando os tipos suportados pelo plugin.
            </DocumentationStep>
            <DocumentationStep
              number="03"
              title="Execute e repita se necessário"
            >
              Clique em Executar ferramenta. O card mostra a fonte, a duração,
              os dados curados e a ação Tentar novamente quando uma falha puder
              ser repetida.
            </DocumentationStep>
          </ol>
          <div className="documentation-tool-list" aria-label="Checks atuais">
            {checks.length > 0 ? (
              checks.map((check) => (
                <article className="documentation-tool-item" key={check.id}>
                  <div>
                    <span className="eyebrow">{check.id}</span>
                    <h4>{check.label}</h4>
                  </div>
                  <span
                    className={
                      check.enabled
                        ? 'documentation-tool-item__status'
                        : 'documentation-tool-item__status documentation-tool-item__status--muted'
                    }
                  >
                    {check.enabled ? 'Disponível' : 'Desabilitado'}
                  </span>
                  <p>{targetKinds(check)}</p>
                </article>
              ))
            ) : (
              <p className="muted">O catálogo está carregando.</p>
            )}
          </div>
          <div className="documentation-planned-list">
            <span className="eyebrow">Em planejamento</span>
            {plannedTools.map((tool) => (
              <div key={tool.label}>
                <strong>{tool.label}</strong>
                <span>{tool.description}</span>
              </div>
            ))}
          </div>
        </DocumentationSection>

        <DocumentationSection
          eyebrow="04 / rastreabilidade"
          id="docs-history"
          number="04"
          title="Consulte o histórico e exporte"
        >
          <div className="documentation-two-column">
            <div>
              <h4>Histórico</h4>
              <p>
                A página Histórico mostra alvo, tipo, horário e contadores
                agregados. Use Usar novamente para preencher a análise com o
                mesmo alvo e iniciar uma nova execução.
              </p>
              <p>
                A sessão mantém um fallback imediato. Quando o Supabase está
                configurado, o backend persiste somente o resumo; resultados
                detalhados e segredos não entram no histórico.
              </p>
            </div>
            <div>
              <h4>Exportação JSON</h4>
              <p>
                Depois que todos os checks terminarem, Exportar JSON baixa um
                relatório versionado diretamente no navegador. O arquivo contém
                alvo, horário, resumo e respostas curadas.
              </p>
              <p>
                A exportação não cria uma cópia adicional no servidor e não
                substitui a análise técnica de um ativo.
              </p>
            </div>
          </div>
          <div className="documentation-actions">
            <a className="button button--secondary" href="/#analysis">
              Ir para Análise
            </a>
            <a className="button button--ghost" href="/#history">
              Abrir Histórico
            </a>
          </div>
        </DocumentationSection>

        <DocumentationSection
          eyebrow="05 / integrações"
          id="docs-credentials"
          number="05"
          title="Configure o cofre de APIs"
        >
          <p className="documentation-lead">
            Credenciais é uma área administrativa interna. Ela não é o login do
            usuário: serve para guardar as chaves que plugins externos usam.
          </p>
          <ol className="documentation-steps">
            <DocumentationStep number="01" title="Abra o cofre">
              Entre em Credenciais e clique em Atualizar credenciais. O painel
              carrega nomes, origem e status sem revelar valores armazenados.
            </DocumentationStep>
            <DocumentationStep
              number="02"
              title="Cadastre ou substitua uma chave"
            >
              Informe o identificador em maiúsculas, como VIRUSTOTAL_API_KEY, e
              cole a chave em Nova chave. O valor não volta para a interface
              depois de salvo.
            </DocumentationStep>
            <DocumentationStep number="03" title="Confira o status do plugin">
              O painel indica se o módulo está habilitado e se a credencial
              obrigatória está presente. A origem pode ser cofre ou ambiente.
            </DocumentationStep>
            <DocumentationStep
              number="04"
              title="Remova apenas quando necessário"
            >
              Remover do cofre apaga a credencial persistida. O plugin passa a
              ficar pulado quando depender dela e o cache é invalidado.
            </DocumentationStep>
          </ol>
          <DocumentationCallout title="PhoneInfoga precisa de um gateway externo">
            O serviço oficial não roda dentro do Vercel. Além do token no cofre,
            o backend precisa de PHONEINFOGA_API_URL apontando para um gateway
            HTTPS hospedado separadamente. Nunca coloque esse token no frontend.
          </DocumentationCallout>
          <div className="documentation-actions">
            <a className="button button--secondary" href="/#credentials">
              Abrir Credenciais
            </a>
          </div>
        </DocumentationSection>

        <DocumentationSection
          eyebrow="06 / identidade"
          id="docs-security"
          number="06"
          title="Mantenha o perfil protegido"
        >
          <div className="documentation-security-grid">
            <div>
              <h4>Foto de perfil</h4>
              <p>
                No Perfil, escolha JPG, PNG ou WebP de até 2 MB. A imagem vai
                para um bucket privado e a sessão recebe somente uma URL
                temporária para exibição.
              </p>
            </div>
            <div>
              <h4>Troca de senha</h4>
              <p>
                O medidor exige uma combinação forte. No primeiro acesso, use
                Sugerir senha forte para gerar uma opção local, revise se quiser
                e confirme antes de salvar.
              </p>
            </div>
            <div>
              <h4>MFA TOTP</h4>
              <p>
                Configure um autenticador pelo QR Code ou segredo alternativo,
                confirme o código de 6 dígitos e use-o nos próximos logins.
              </p>
            </div>
          </div>
          <DocumentationCallout
            title="O segredo do MFA deve permanecer no autenticador"
            tone="warning"
          >
            O QR Code e o segredo alternativo aparecem durante o cadastro. Não
            compartilhe capturas de tela e remova fatores que não reconhece.
          </DocumentationCallout>
          <div className="documentation-actions">
            <a className="button button--secondary" href="/#profile">
              Abrir Perfil
            </a>
          </div>
        </DocumentationSection>

        <DocumentationSection
          eyebrow="07 / preferências"
          id="docs-settings"
          number="07"
          title="Ajuste a aparência"
        >
          <p className="documentation-lead">
            Configurações controla somente a apresentação local do painel. A
            escolha não altera plugins, permissões, histórico ou resultados.
          </p>
          <div className="documentation-two-column">
            <div>
              <h4>Dark</h4>
              <p>É o tema padrão, com fundo escuro e destaque ciano.</p>
            </div>
            <div>
              <h4>White</h4>
              <p>Oferece uma leitura clara e fica salvo neste navegador.</p>
            </div>
          </div>
          <div className="documentation-actions">
            <a className="button button--secondary" href="/#settings">
              Abrir Configurações
            </a>
          </div>
        </DocumentationSection>

        <DocumentationSection
          eyebrow="08 / resolução"
          id="docs-help"
          number="08"
          title="Resolva problemas comuns"
        >
          <div className="documentation-help-list">
            <div>
              <strong>“A API não está disponível”</strong>
              <p>
                Verifique o deploy do Vercel e o endpoint /api/health. Sem
                sessão, as rotas da plataforma devem responder 401.
              </p>
            </div>
            <div>
              <strong>“Chave ausente” ou “integração pulada”</strong>
              <p>
                Abra Credenciais, confira o nome da variável e valide
                configurações externas obrigatórias, como a URL do gateway
                PhoneInfoga.
              </p>
            </div>
            <div>
              <strong>“Confirme o código do autenticador”</strong>
              <p>
                Use o código atual do TOTP. Se o dispositivo não estiver
                disponível, peça ao responsável interno para revisar o fator da
                conta.
              </p>
            </div>
            <div>
              <strong>Histórico vazio</strong>
              <p>
                O histórico só aparece depois de uma análise. Se o Supabase
                estiver indisponível, a sessão ainda pode mostrar o fallback
                local.
              </p>
            </div>
          </div>
          <DocumentationCallout title="Como manter esta página atualizada">
            Quando uma função mudar, atualize este componente, a data no topo, o
            PLAN.md e a issue correspondente no Linear. Novos checks aparecem
            automaticamente no catálogo desta página, mas seus passos e avisos
            específicos também devem ser descritos aqui.
          </DocumentationCallout>
        </DocumentationSection>
      </div>
    </section>
  );
}
