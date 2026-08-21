# PLAN.md

Roadmap do projeto. Este arquivo deve ser mantido atualizado pelo agente de IA conforme
as fases avançam — marque os checkboxes conforme cada item for concluído.

---

## Visão geral

Plataforma web de análise de domínios/IPs/URLs, com dashboard de checagens rodando em
paralelo, arquitetura de plugins extensível (ver `AGENTS.md`), e integrações crescentes
com ferramentas externas de OSINT/segurança (VirusTotal, AbuseIPDB, Shodan e outras a
definir).

---

## Fase 0 — Fundação do projeto

- [x] Definir stack técnica (backend + frontend) e documentar a decisão aqui
- [x] Criar estrutura de pastas do repositório (backend, frontend, plugins de check)
- [x] Implementar o carregador dinâmico de plugins (lê a pasta de checks e registra
      automaticamente, sem lista manual)
- [x] Definir e implementar o contrato de resposta padronizado (ver `AGENTS.md` seção 2)
- [x] Configurar `.env.sample` com as variáveis já previstas
- [x] Configurar timeout e tratamento de erro isolado por plugin
- [x] Layout base do frontend: input de domínio/IP + grid de cards de resultado
- [x] Estado de card genérico (loading / sucesso / erro-pulado) reaproveitável para
      plugins sem componente customizado ainda
- [x] Implementar painel administrativo de credenciais de API (adicionar/substituir/
      remover sem revelar o segredo armazenado), usando cofre local AES-256-GCM e
      autenticação por `ADMIN_TOKEN`

---

## Fase 1 — MVP: checagens essenciais (sem chave de API externa)

Subconjunto priorizado do web-check — só o que traz mais valor direto, sem exigir
credenciais pagas/limitadas:

- [x] **IP Info** — IP(s) associados ao domínio (registro A/AAAA)
- [x] **DNS Records** — A, AAAA, MX, NS, TXT, CNAME
- [x] **WHOIS** — dados de registro do domínio
- [x] **SSL/TLS Certificate** — validade, emissor, cadeia
- [x] **HTTP Headers** — headers de resposta e headers de segurança (CSP, HSTS,
      X-Frame-Options etc.)
- [x] **Server Location** — geolocalização aproximada do IP
- [x] **Redirect Chain** — cadeia de redirecionamentos HTTP
- [x] **Tech Stack** — tecnologias detectadas no site
- [x] **Cookies** — cookies definidos pelo site e suas flags de segurança
- [x] **Robots.txt / Sitemap** — regras de crawling e mapa do site
- [x] **Server Status** — online/offline, tempo de resposta

> Critério de corte: incluir só o que tem alto valor informativo e não depende de API
> paga logo de início. Itens como carbon footprint, TLS handshake simulation, e outras
> checagens de nicho do web-check ficam de fora do MVP (podem voltar depois como plugin
> opcional se fizer sentido).

---

## Fase 2 — Integrações externas de segurança/OSINT

Cada item vira um plugin novo, seguindo o contrato do `AGENTS.md`. Lista inicial — será
expandida conforme o usuário for enviando novos repositórios/links:

- [x] **VirusTotal** — reputação do domínio/IP, detecções de malware/phishing
- [x] **AbuseIPDB** — histórico de abuso do IP
- [x] **Vulnerabilidades (CVE)** — correlação de serviços do Shodan com NVD, FIRST EPSS e CISA KEV
- [ ] _(placeholder — próxima ferramenta a ser definida pelo usuário)_

Cada nova integração deve:

- Ter sua própria seção neste plano quando for adicionada
- Documentar a variável de ambiente necessária no `.env.sample`
- Tratar corretamente rate limit e ausência de chave (status `skipped`)

### VirusTotal

- Credencial: `VIRUSTOTAL_API_KEY`, pelo cofre interno ou variável de ambiente
- Endpoint: API v3 de relatório de domínio/IP; nenhuma submissão ou reanálise automática
- Curadoria: estatísticas, motores maliciosos/suspeitos, reputação, votos, categorias e
  contexto de rede
- Limites: erros `401`, `403`, `404`, `429` e `5xx` tratados explicitamente; observar os
  termos e a cota da licença usada no serviço interno

### AbuseIPDB

- Credencial: `ABUSEIPDB_API_KEY`, pelo cofre interno ou variável de ambiente
- Endpoint: API v2 `check`, um IP público por análise e janela de 90 dias
- Curadoria: score, totais de denúncias/reportantes, última denúncia, flags e contexto de
  rede; comentários brutos não são solicitados
- Limites: metadados de cota preservados e erros `401`, `402`, `403`, `422`, `429` e `5xx`
  tratados explicitamente

### Vulnerabilidades (CVE)

- O plugin mantém o card do Shodan intacto e faz uma consulta complementar independente,
  usando a mesma credencial `SHODAN_API_KEY` para identificar IP, portas, produtos e
  versões observados.
- NVD fornece CVSS e descrição; FIRST EPSS fornece probabilidade/percentil diário; CISA
  KEV sinaliza vulnerabilidades conhecidamente exploradas. O resultado final é curado,
  limitado a 100 CVEs e não persiste banners ou segredos.
- A prioridade visual combina CVSS, EPSS (limiar de 10%) e presença no KEV; isso é uma
  regra de triagem, não substitui validação técnica do ativo.

---

## Fase 3 — Robustez e UX

- [x] Cache de resultados por um período curto (evitar bater a API externa repetidamente
      para o mesmo alvo)
- [x] Rate limiting no backend para evitar abuso da própria plataforma
- [x] Exportar resultado da análise em JSON versionado, gerado localmente no navegador
      após todos os checks chegarem a um estado terminal
- [x] Histórico de análises recentes da sessão, mantido em memória no frontend e sem
      persistência de alvos ou resultados
- [x] Tratamento de erro amigável no frontend (mensagem clara quando um check falha)
- [x] Responsividade mobile do dashboard

---

## Fase 4 — Extensibilidade formal

- [x] Painel/config simples para habilitar/desabilitar plugins sem editar código
- [x] Documentação interna de "como criar um novo plugin" (pode reaproveitar o
      `AGENTS.md`, mas com exemplos práticos de código)
- [x] Revisão de todos os plugins existentes para consistência do contrato de resposta

---

## Fase 5 — Histórico persistente com Supabase

- [x] Criar a tabela `public.analysis_history` com RLS habilitado e política exclusiva
      para `service_role` (sem acesso público)
- [x] Adicionar configuração opcional `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e limite
      de leitura no `.env.sample`
- [x] Implementar adapter REST server-side com tratamento seguro de indisponibilidade
- [x] Criar endpoints agregados `GET/POST /api/history`
- [x] Mostrar histórico persistente combinado com fallback de sessão no dashboard
- [x] Persistir somente alvo, tipo e contadores; nunca resultados detalhados ou segredos

O projeto Supabase usado no ambiente interno é identificado pelo ref `doqnyijzaogqiwkuygcs`.
A service role key permanece exclusivamente no `.env`/ambiente do backend ou no cofre
operacional; ela não deve ser registrada neste arquivo.

---

## Fase 6 — Consultas por identidade e seleção de checks

- [x] Expandir o contrato de alvo para domínio, IP, URL, nome, username, e-mail e telefone
- [x] Normalizar e validar cada tipo explicitamente no backend
- [x] Adicionar `supportedTargetKinds` ao contrato e filtrar plugins incompatíveis
- [x] Criar seletor de tipo e filtro de ferramentas no formulário de análise
- [x] Permitir reutilizar do histórico o alvo e o tipo de consulta original

---

## Fase 7 — Integrações OSINT adicionais

Cada integração será analisada antes de implementação, com escopo curado, autorização
explícita e tratamento de rate limit/credenciais. A ausência de chave ou sessão deve
produzir `skipped`, sem interromper os outros plugins.

- [ ] PhoneInfoga — avaliar CLI/REST e scanners externos; pode exigir configuração de
      provedores, sem assumir uma API key única
- [ ] GHunt — avaliar execução local e sessão/cookies do Google; não armazenar cookies no
      histórico nem no frontend
- [ ] Osintgram — avaliar execução local e autenticação autorizada do Instagram
- [x] Shodan — consulta curada de host/domain com `SHODAN_API_KEY`
- [x] Hunter.io — Domain Search e Email Verifier com `HUNTER_API_KEY`, créditos e rate
      limit explícitos
- [x] OSINT Framework — transformar o catálogo em referências filtráveis, sem scraping
      automático por padrão
- [ ] Sherlock — avaliar CLI de username com saída JSON e timeout configurável; normalmente
      não exige API key

### Shodan

- Credencial: `SHODAN_API_KEY`, armazenada no cofre interno ou variável de ambiente
- Endpoint: `GET /shodan/host/{ip}` com `minify=true`; domínios e URLs são resolvidos para
  um IP público antes da consulta
- Curadoria: localização, organização, ASN, portas, serviços resumidos, tags e CVEs; raw
  banners não são devolvidos ao dashboard
- Limites: `401/403`, `404`, `429` e `5xx` viram mensagens seguras no card

### Hunter.io

- Credencial: `HUNTER_API_KEY`, armazenada no cofre interno ou variável de ambiente
- Endpoints: Domain Search para domínios/URLs e Email Verifier para consultas do tipo e-mail
- Curadoria: organização, padrão, contatos resumidos, confiança e checks de entregabilidade;
  fontes brutas não são persistidas
- Limites: consulta de domínio limitada a 10 contatos por chamada para compatibilidade com
  o plano atual; `401`, `403`, `404`, `429`, `451` e `5xx` tratados explicitamente

## Fase 8 — Navegação e identidade do OSINT Pier

- [x] Separar a barra lateral em páginas de Análise, Ferramentas, Histórico e Credenciais
- [x] Criar caixa de ferramentas para executar plugins individualmente, com descrição e
      filtro de tipo de alvo
- [x] Organizar a caixa de ferramentas por Web e infraestrutura, Threat intelligence e
      Dados pessoais e leads, incluindo itens planejados sem configuração executável
- [x] Exibir uma lista lateral clicável para navegar diretamente entre as categorias da
      caixa de ferramentas
- [x] Aplicar toggles visuais acessíveis no seletor de plugins da análise
- [x] Permitir recolher e expandir a caixa de filtros da página de Análise
- [x] Transformar o histórico em página de auditoria com ação “Usar novamente”
- [x] Aplicar nome OSINT Pier, símbolo PierSec, paleta e tipografia do brand kit

---

## Decisões em aberto (a preencher conforme o projeto avança)

- Stack de backend: Node.js + Fastify + TypeScript + Zod
- Stack de frontend: Next.js + React + TypeScript + TanStack Query (Vite permanece apenas
  como infraestrutura do Vitest)
- Monorepo e qualidade: pnpm workspaces, Vitest, React Testing Library, ESLint e Prettier
- Timeout padrão por plugin: 10 segundos, configurável e com override por plugin
- Credenciais via painel: cofre local AES-256-GCM, protegido por `ADMIN_TOKEN`, com
  variáveis de ambiente como fallback; serviço interno/single-admin
- Banco de dados: Supabase opcional para o histórico agregado; o restante do estado
  transitório (cache e rate limit) permanece em memória na instância única
- Cache da Fase 3: memória local, TTL padrão de 5 minutos, limite de 1.000 entradas,
  somente `success`, deduplicação em andamento e invalidação ao alterar credenciais
- Rate limiting da Fase 3: armazenamento local do `@fastify/rate-limit`, 60 execuções por
  minuto/IP apenas em `POST /api/checks/:id`; health, catálogo e admin ficam fora
- Exportação da Fase 3: JSON com `schemaVersion: 1`, alvo, horário, resumo e respostas
  curadas; download client-side sem persistência ou endpoint adicional. PDF fica fora do
  escopo atual para preservar simplicidade
- Histórico: a sessão mantém os 6 últimos alvos como fallback imediato; quando Supabase
  está configurado, o backend persiste somente alvo, tipo, timestamp e contadores
  agregados. Nenhum resultado detalhado ou segredo é persistido.
- Configuração da Fase 4: flags de plugins são mantidas em `.data/check-settings.json`
  (ou `CHECK_SETTINGS_PATH`), com novos plugins habilitados por padrão. O arquivo contém
  somente booleans; leitura e alteração exigem `ADMIN_TOKEN` pelo painel interno.
- Estratégia de deploy: Vercel com projeto conectado ao GitHub `Piersec/OSINT-PIER`;
  o serviço permanece interno e o adaptador Next expõe a API Fastify em `/api`.

## Fase 9 — Migração Next.js e preparação para Vercel

- [x] Migrar a aplicação web de Vite para Next.js App Router
- [x] Manter o dashboard React como cliente e preservar navegação, tema e renderização
      progressiva dos plugins
- [x] Adaptar a API Fastify para uma rota serverless `/api/[...path]`, mantendo o loader
      dinâmico de plugins e fallback para API separada via `NEXT_PUBLIC_API_URL`
- [x] Configurar build de monorepo no `vercel.json`, incluindo compilação dos contratos e
      backend antes do Next.js
- [x] Criar commit final, enviar ao repositório Piersec/OSINT-PIER e concluir deploy de
      preview protegido no projeto Vercel conectado

## Fase 10 — Acesso interno com Supabase Auth

- [x] Exibir somente um formulário de login por e-mail e senha, sem cadastro externo
- [x] Persistir a sessão no navegador e oferecer saída da conta autenticada
- [x] Enviar o access token nas requisições do frontend
- [x] Validar a sessão no backend antes de liberar checks, histórico e administração
- [ ] Desativar manualmente o cadastro público no provedor Email do Supabase

---

## Log de progresso

Use esta seção para anotar brevemente o que foi feito em cada sessão de trabalho.

- `2026-08-19` — Stack e estrutura aprovadas. Requisito de painel para adicionar e
  remover credenciais de APIs registrado. Definido cofre local AES-256-GCM protegido por
  `ADMIN_TOKEN`, adequado ao serviço interno informado pelo usuário.
- `2026-08-19` — Fase 0 concluída: monorepo criado, loader dinâmico, contrato e executor
  isolado implementados, dashboard progressivo e card genérico entregues, cofre/painel de
  credenciais implementados. Validação: 12 testes, typecheck, lint, Prettier e builds de
  API/frontend aprovados.
- `2026-08-19` — Fase 1 concluída com 11 plugins essenciais. WHOIS usa o bootstrap RDAP
  oficial da IANA; localização usa `ipwho.is` sem chave, com tratamento de limite e sem
  enviar IPs privados/reservados. Validação: 26 testes, smoke real dos 11 checks em
  `example.com`, typecheck, lint, Prettier e builds aprovados.
- `2026-08-19` — Fase 2 iniciada: plugins VirusTotal e AbuseIPDB implementados com
  credenciais opcionais pelo cofre, respostas curadas, proteção de IPs privados e erros de
  autenticação/cota explícitos. Validação: 32 testes, typecheck, lint, Prettier, builds e
  smoke local com 13 checks aprovados. Os placeholders permanecem aguardando novas
  ferramentas.
- `2026-08-19` — Fase 3 iniciada nos itens sem decisão pendente: cache efêmero e limitado
  de resultados bem-sucedidos, deduplicação de chamadas simultâneas e rate limiting por IP
  nos endpoints de execução. Exportação e histórico continuam aguardando decisões de
  produto previstas neste plano. Tratamento de erro agora diferencia `skipped`, `429`, alvo
  inválido e falha repetível; breakpoints de 320 px e 1280 px foram validados sem overflow.
  Validação: 42 testes, lint, typecheck, Prettier, builds e smoke local `MISS → HIT` com
  headers de limite aprovados.
- `2026-08-19` — Dashboard redesenhado a partir das referências visuais fornecidas: nova
  sidebar, composição operacional com consulta e métricas, cards escuros arredondados,
  acento verde-lima e navegação adaptativa, sem alterar o fluxo progressivo ou o painel de
  credenciais. Validação do frontend: 3 testes, lint, typecheck, Prettier e build aprovados;
  renderização conferida em 1440 px e 375 px sem overflow horizontal.
- `2026-08-19` — Credenciais de VirusTotal e AbuseIPDB cadastradas no cofre local
  criptografado e verificadas sem expor seus valores. Corrigido o carregamento do `.env`
  da raiz pela API, independentemente do diretório de execução do `pnpm`. Smoke real dos
  dois plugins com IP público retornou `success`; `.env` e `.data/credentials.enc`
  permanecem ignorados pelo Git. Validação: 39 testes da API, lint, typecheck e build
  aprovados.
- `2026-08-20` — Exportação JSON concluída na Fase 3: relatório versionado com alvo,
  horário, resumo agregado, resultados curados e falhas de transporte. O download só é
  habilitado quando os 13 checks terminam e acontece inteiramente no navegador, sem criar
  histórico. Validação: 6 testes do frontend, lint, typecheck, build e download real via
  Chrome aprovados.
- `2026-08-20` — Histórico recente concluído na Fase 3 como recurso de sessão: os 6
  últimos alvos são mantidos apenas na memória da aba, com timestamp e contadores de
  sucesso/atenção. O usuário pode reutilizar um alvo sem reter os dados detalhados dos
  checks. Validação: 7 testes do frontend, lint, typecheck, build e fluxo real em mobile
  aprovados.
- `2026-08-20` — Fase 4 concluída: painel administrativo permite habilitar/desabilitar
  plugins sem editar código; flags persistem localmente com novos módulos habilitados por
  padrão. A documentação interna de criação de plugins foi adicionada em
  `docs/plugin-authoring.md` e todos os 13 plugins foram revisados contra o contrato do
  loader. Validação: 49 testes (42 API e 7 frontend), lint, typecheck, builds e smoke local
  com 13 checks ativos aprovados.
- `2026-08-20` — Fases 5 e 6 implementadas: migração Supabase `analysis_history` com RLS
  restritivo, adapter REST server-side, endpoints de histórico, tipos de consulta para
  identidade e seletor de checks compatíveis no dashboard. As sete ferramentas da Fase 7 foram
  registradas no Linear como itens independentes para análise e implementação gradual.
  Validação final: 49 testes da API, 7 do frontend, typecheck, lint, formatação, build e
  smoke HTTP local aprovados; advisor de segurança do Supabase sem lints.
- `2026-08-20` — Hunter.io e Shodan implementados como plugins independentes, com as
  credenciais fornecidas armazenadas no cofre criptografado. Hunter usa Domain Search /
  Email Verifier com limite de 10 resultados compatível com o plano atual; Shodan consulta
  host por IP público e remove banners brutos. O dashboard foi reorganizado em páginas de
  Análise, Resultados (ferramentas individuais), Histórico e Credenciais, com filtros
  recolhíveis e identidade visual PierSec. Smoke real: Shodan e Hunter retornaram sucesso;
  validação: 53 testes da API, 7 do frontend, typecheck, lint e build aprovados.
- `2026-08-20` — Resultados do dashboard passaram a usar renderização curada (métricas,
  blocos, chips e tabelas), sem dumps JSON de headers/cadeias técnicas. A logo oficial
  `logoBrancaPierRedonda.svg` foi aplicada, fontes foram alinhadas ao manual PierSec e o
  estado de atenção passou a usar vermelho. A caixa de tipo foi removida: frontend e
  backend detectam automaticamente IP, domínio, URL, e-mail, telefone, nome e username.
  O grid usa colunas compactas para evitar espaços entre cards de alturas diferentes.
- `2026-08-20` — Fase 2 recebeu o plugin composto de Vulnerabilidades (CVE): Shodan é
  consultado de forma independente para fingerprints, NVD fornece CVSS, FIRST EPSS
  fornece probabilidade e CISA KEV sinaliza exploração conhecida. O dashboard ganhou
  um bloco único com métricas, lista curada e gráfico de criticidade em Recharts. O
  OSINT Framework foi implementado como catálogo local de referências sem scraping;
  PhoneInfoga, GHunt, Osintgram e Sherlock continuam planejados por dependerem de CLI,
  sessão ou autenticação externa que ainda não foi fornecida.
- `2026-08-20` — Como o serviço é interno, a API passou a escutar `127.0.0.1` por padrão
  (`API_HOST` configurável no `.env.sample`), evitando exposição acidental na rede local.
- `2026-08-20` — A nova credencial fornecida para o Shodan foi atualizada no cofre
  criptografado e validada com sucesso. A interface removeu o marcador numérico da nova
  investigação, ganhou navegação lateral por categorias e transformou checkboxes em
  toggles visuais mantendo a semântica de acessibilidade.
- `2026-08-20` — O diagnóstico do Shodan foi refinado: HTTP 401 agora informa chave
  inválida e HTTP 403 informa restrição do plano. A nova chave retornou sucesso em
  consultas permitidas; quando o host não possui serviços/CVEs observáveis, o consolidado
  retorna sucesso com zero em vez de mascarar isso como falha das fontes NVD/EPSS/KEV.
- `2026-08-20` — A caixa de ferramentas passou a usar uma lista lateral de categorias
  com navegação direta por rolagem, sem recolhimento global. A nova página Configurações
  permite alternar entre os temas Dark e White, mantendo Dark como padrão e persistindo
  a escolha somente no navegador local.
- `2026-08-21` — Fase 9 concluída: frontend migrado para Next.js 16.3.2 (versão corrigida),
  API Fastify adaptada para `/api/[...path]`, build monorepo configurado no Vercel e
  repositório atualizado no GitHub. Deploy de preview protegido validado como `READY` em
  `osint-pier-ou73mbxld-rhuanoliveira.vercel.app`; credenciais continuam fora do Git e
  precisam ser cadastradas nas variáveis/cofre do ambiente Vercel.
- `2026-08-21` — Corrigido o empacotamento serverless do adaptador Next: o rastreamento
  agora parte da raiz do monorepo e inclui explicitamente o backend compilado e os
  plugins. O cliente também ignora um `NEXT_PUBLIC_API_URL` local configurado por engano
  em uma página hospedada e retorna ao endpoint same-origin `/api`.
- `2026-08-21` — Fase 10 iniciada: login fechado por e-mail e senha com Supabase Auth,
  sem cadastro no frontend. A sessão é persistida no navegador, o access token segue
  para a API e o backend valida a sessão antes das operações da plataforma. A criação
  de usuários e o bloqueio do cadastro público continuam sendo configurações manuais
  no painel do Supabase.
