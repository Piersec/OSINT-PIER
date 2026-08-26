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
- [x] **Vulnerabilidades (CVE)** — achados do Nuclei com NVD, FIRST EPSS e CISA KEV
- [x] **Nuclei** — scanner CLI local com templates curados, JSONL e enriquecimento CVE

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

- O card do Shodan permanece independente. O card consolidado usa o scanner Nuclei para
  encontrar vulnerabilidades diretamente no alvo e não depende de `SHODAN_API_KEY`.
- NVD fornece CVSS e descrição quando o achado contém CVE; FIRST EPSS fornece
  probabilidade/percentil diário; CISA KEV sinaliza vulnerabilidades conhecidamente
  exploradas. O resultado final é curado, limitado a 100 achados e não persiste
  requests, responses, templates ou segredos.
- A prioridade visual combina CVSS, EPSS (limiar de 10%) e presença no KEV; isso é uma
  regra de triagem, não substitui validação técnica do ativo.

### Nuclei

- Execução: binário local `nuclei`, ou caminho informado por `NUCLEI_PATH`; não exige
  chave de API. `NUCLEI_TEMPLATE_DIR` pode apontar para um diretório de templates
  controlado pela organização.
- Saída: JSONL curado, sem request/response bruto ou template codificado. O plugin
  bloqueia rede privada, interações OAST, templates de fuzzing, headless, brute force,
  default-login e DOS, além de limitar concorrência e volume.
- Correlação: achados com CVE são enriquecidos por NVD, FIRST EPSS e CISA KEV; achados
  sem CVE continuam no gráfico usando a severidade declarada pelo template.
- Deploy: Vercel não fornece o executável do Nuclei por padrão. Nesse ambiente o check
  retorna `skipped` com instrução segura; execução em produção requer um worker interno
  autorizado ou outra forma explícita de disponibilizar o binário.

---

## Fase 3 — Robustez e UX

- [x] Cache de resultados por um período curto (evitar bater a API externa repetidamente
      para o mesmo alvo)
- [x] Rate limiting no backend para evitar abuso da própria plataforma
- [x] Exportar resultado da análise em JSON versionado e relatório PDF via impressão do
      navegador, gerados localmente após todos os checks chegarem a um estado terminal
- [x] Histórico de análises recentes da sessão, mantido em memória no frontend e sem
      persistência de alvos ou resultados
- [x] Tratamento de erro amigável no frontend (mensagem clara quando um check falha)
- [x] Responsividade mobile do dashboard
- [x] Gráficos Recharts e insights progressivos no resultado da análise, derivados
      exclusivamente dos sinais reais de segurança, exposição e criticidade
- [x] Panorama de risco com vulnerabilidades/CVEs, CISA KEV, EPSS alto e falhas de
      headers, cookies, TLS e reputação, persistido na sessão do navegador
- [x] Card curado do AbuseIPDB com confiança visual, contexto de rede e links externos;
      ocultar da grade os checks sem resposta bem-sucedida, mantendo atenção no panorama
- [x] Filtrar checks pelo tipo de alvo inferido antes da execução, evitando chamadas
      incompatíveis e cards redundantes de erro na análise principal
- [x] Panorama de segurança com índice de risco, postura radial, radar de exposição,
      mapa de criticidade, reputação externa e falhas priorizadas
- [x] Entrada imersiva de análise com campo de alvo destacado, cena 3D Three.js durante
      a coleta e relatório completo preservado após a execução
- [x] Palco 3D da entrada sem alvo ocupando o viewport inteiro, com campo de alvo sobreposto
      e transição direta para a coleta imersiva
- [x] Cena 3D da coleta expandida para o viewport inteiro durante a execução, com retorno
      automático ao relatório e scroll bloqueado enquanto houver checks ativos
- [x] Ação explícita de Nova análise para trocar o alvo restaurado sem apagar o histórico

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

- [x] PhoneInfoga — adapter REST server-side para o serviço oficial em Docker, com
      gateway autenticado e scanners opcionais configurados pelo cofre
- [x] GHunt — plugin de e-mail com JSON curado e runner Docker externo autenticado; sessão/
      cookies ficam somente no volume privado do runner
- [x] Osintgram — avaliação concluída; não integrar sem runner isolado, autenticação
      autorizada e revisão da licença/termos de uso
- [x] Shodan — consulta curada de host/domain com `SHODAN_API_KEY`
- [x] Hunter.io — Domain Search e Email Verifier com `HUNTER_API_KEY`, créditos e rate
      limit explícitos
- [x] OSINT Framework — transformar o catálogo em referências filtráveis, sem scraping
      automático por padrão
- [x] Sherlock — avaliação concluída; a CLI Python não entra diretamente no Vercel e a
      execução depende de um runner externo autenticado, com resultado curado de presença/URL
- [x] Command tools — Nmap, Katana, Gobuster e Subfinder integrados por runner Docker
      externo autenticado, com perfis allowlisted, limites operacionais e saída curada

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

### PhoneInfoga

- Serviço: imagem oficial `sundowndev/phoneinfoga:v2`, executada separadamente com
  `serve --no-client`; o Vercel chama somente o gateway HTTPS autenticado em
  `PHONEINFOGA_API_URL`
- Credencial: `PHONEINFOGA_API_TOKEN`, armazenada no cofre interno e validada pelo gateway;
  `NUMVERIFY_API_KEY`, `GOOGLECSE_CX` e `GOOGLE_API_KEY` são opcionais e chegam ao serviço
  somente no request server-side do scanner correspondente
- Endpoints usados: `POST /api/v2/numbers` e `POST /api/v2/scanners/{scanner}/run`
- Curadoria: normalização, local, Google Search, OVH, Numverify e Google CSE; links de
  pesquisa são referências para análise autorizada, e respostas brutas não chegam ao cliente
- Limites: timeout de 30 segundos no plugin; erros de scanners individuais não interrompem
  os demais; nenhum número, token ou resultado detalhado é gravado no histórico
- Operação: `infra/phoneinfoga/docker-compose.yml` mantém a porta interna fora da rede
  pública e o gateway aceita apenas `Authorization: Bearer` com o token configurado

### GHunt

- Serviço: `infra/ghunt/docker-compose.yml` mantém o pacote oficial em um runner Python
  separado; a API chama somente o gateway HTTPS autenticado em `GHUNT_API_URL`
- Credencial: `GHUNT_API_TOKEN`, armazenada no cofre interno e validada pelo gateway; a
  sessão/cookies do Google ficam no volume privado do runner e nunca no frontend, histórico
  ou variáveis do Vercel
- Endpoint usado: `POST /api/v2/email`, limitado a alvos do tipo `email`
- Curadoria: presença, nome, Gaia ID, última atualização, foto de perfil, serviços e sinais
  resumidos de Play Games, Maps e Calendar; JSON bruto, cookies, tokens, eventos, HTML e
  contatos não são devolvidos
- Limites: timeout de 90 segundos no plugin, 105 segundos no runner, corpo limitado e
  erros de sessão/rate limit/indisponibilidade tratados como mensagens seguras
- Licença: o pacote oficial está sob AGPL-3.0; permanece isolado em container e não teve
  código copiado para o backend

### Sherlock

- Avaliação registrada em [`docs/sherlock-integration.md`](docs/sherlock-integration.md)
- A ferramenta oficial é uma CLI Python, faz consultas externas por serviço e grava
  relatórios em arquivos; o `--json` documentado carrega dados de sites, não é um exportador
  de resultados JSON para o dashboard
- Decisão: não executar a CLI no runtime serverless da Vercel. O próximo passo é um runner
  Python/Docker separado, HTTPS privado e token interno, seguindo `supportedTargetKinds:
['username']`
- Escopo público futuro: username, presença e URL por serviço. Respostas brutas, cookies,
  proxies, stdout e credenciais nunca devem sair do runner
- Dependências e follow-up estão descritos na GAB-93, vinculada à GAB-69

### Osintgram

- Avaliação registrada em [`docs/osintgram-integration.md`](docs/osintgram-integration.md)
- A ferramenta exige uma conta/senha em `credentials.ini` ou um token HikerAPI, depende
  de `instagram-private-api` e possui shell interativo com saída em arquivos
- O escopo oficial inclui seguidores, contatos, stories e mídia; isso não entra no
  dashboard sem curadoria e autorização específica
- Decisão: não executar na Vercel, não guardar senha/cookies e não copiar o código GPL-3.0
  para o backend. Uma retomada depende de runner externo e revisão de licenciamento

### Command tools

- Implementação registrada em [`docs/command-tools-integration.md`](docs/command-tools-integration.md)
- Serviço: `infra/command-tools/docker-compose.yml`, com gateway HTTPS separado do runner
- Credencial: `COMMAND_TOOLS_API_TOKEN`, armazenada no cofre; URL operacional em
  `COMMAND_TOOLS_API_URL`
- Endpoint: `POST /api/v1/scan`, aceitando somente `tool`, `target` e `profile: safe`
- Nmap usa TCP connect/top 100 e detecção leve; Katana usa crawl curto; Subfinder é
  passivo; Gobuster usa wordlist interna pequena e fica desabilitado por padrão
- O runner limita concorrência, timeout, tamanho de saída e bloqueia alvos locais/privados;
  stdout, stderr, banners e argumentos não são devolvidos ao cliente
- Próximos candidatos avaliados separadamente: `httpx`, `dnsx`, `tlsx` e `naabu`

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
- [x] Permitir configurar a foto do perfil via Supabase Auth metadata e reutilizá-la no
      cabeçalho, exibindo o e-mail apenas no hover do avatar
- [x] Criar página separada de documentação interna passo a passo, acessível fora
      da sidebar pelo link no rodapé e pela rota `/docs`
- [x] Evoluir a documentação para uma experiência profissional com navegação própria,
      busca local, onboarding, catálogo vivo e referências por seção
- [x] Criar a primeira fundação visual do rebranding em Light com tokens oficiais da
      PierSec, superfícies planas, shell editorial, painel de topologia e estados acessíveis
- [x] Aplicar a fundação visual refinada a todas as rotas e revisar a experiência em Dark
- [ ] Substituir os slots CDN provisórios dos logos por SVGs oficiais fornecidos pela equipe

---

## Decisões em aberto (a preencher conforme o projeto avança)

- Stack de backend: Node.js + Fastify + TypeScript + Zod
- Stack de frontend: Next.js + React + TypeScript + TanStack Query (Vite permanece apenas
  como infraestrutura do Vitest)
- Monorepo e qualidade: pnpm workspaces, Vitest, React Testing Library, ESLint e Prettier
- Timeout padrão por plugin: 10 segundos, configurável e com override por plugin
- Credenciais via painel: cofre AES-256-GCM persistido no Supabase quando
  `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` estão configurados; filesystem local é
  fallback para desenvolvimento. Ambos são protegidos por `ADMIN_TOKEN` e a chave
  mestra fica somente no ambiente do backend
- Banco de dados: Supabase para histórico agregado e cofre de integrações; o restante
  do estado transitório (cache e rate limit) permanece em memória na instância única
- Cache da Fase 3: memória local, TTL padrão de 5 minutos, limite de 1.000 entradas,
  somente `success`, deduplicação em andamento e invalidação ao alterar credenciais
- Rate limiting da Fase 3: armazenamento local do `@fastify/rate-limit`, 60 execuções por
  minuto/IP apenas em `POST /api/checks/:id`; health, catálogo e admin ficam fora
- Exportação da Fase 3: JSON com `schemaVersion: 1`, alvo, horário, resumo e respostas
  curadas; download client-side sem persistência ou endpoint adicional. O PDF usa uma
  janela de impressão dedicada, permitindo “Salvar como PDF” sem enviar resultados ao
  backend nem adicionar uma dependência de geração binária
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

## Fase 10 — Acesso interno, administração de integrações, cofre e segurança do deploy

### Autenticação interna

- [x] Exibir somente um formulário de login por e-mail e senha, sem cadastro externo
- [x] Persistir a sessão no navegador e oferecer saída da conta autenticada
- [x] Enviar o access token nas requisições do frontend
- [x] Validar a sessão no backend antes de liberar checks, histórico e administração
- [x] Disponibilizar perfil autenticado com avatar privado, troca de senha e medidor de
      força para rejeitar a senha inicial fraca
- [x] Exigir a troca da senha no primeiro acesso por modal sem opção de fechar
- [x] Oferecer sugestão local de senha forte no modal obrigatório, com preenchimento
      editável e opção de visualizar antes de salvar
- [x] Conectar configuração e verificação de MFA por TOTP no perfil, com desafio após
      login e enforcement de `aal2` nas rotas da API
- [x] Solicitar a ativação opcional do MFA no login para contas sem fator verificado,
      oferecendo `Ativar agora` e `Ativar mais tarde` apenas para a sessão atual
- [ ] Confirmar no painel do projeto Supabase a expiração dos JWTs em 3600 segundos
      (1 hora); essa configuração pertence ao Auth hospedado e não ao frontend
- [ ] Desativar manualmente o cadastro público no provedor Email do Supabase

### Administração de integrações

- [x] Separar visualmente o cofre criptografado do painel de status e gerenciamento das
      integrações, sem revelar valores armazenados
- [x] Exibir, por plugin, habilitação, presença da credencial e origem (cofre ou ambiente)
- [x] Permitir abrir o cofre interno sem `ADMIN_TOKEN` durante a transição para Supabase
      Auth, mantendo a autorização isolada para substituição futura por RBAC
- [x] Persistir o cofre de integrações cifrado no Supabase com RLS, mantendo a chave
      mestra e o token administrativo fora do banco
- [x] Tornar o adaptador serverless tolerante a variáveis opcionais vazias e registrar
      falhas de inicialização no log sem devolver stack trace ao cliente
- [x] Manter a proteção de deployment do Vercel enquanto o serviço for interno; usar
      bypass autenticado para testes em vez de tornar `/api` e o painel admin públicos
- [ ] Definir, com autorização explícita, eventual exposição pública do deployment e
      uma camada adicional de autenticação para o painel administrativo

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
- `2026-08-21` — Fase 10 iniciada: o painel de credenciais passou a separar o cofre do
  status das integrações, mostrando habilitação, presença da chave e origem sem expor
  segredos. O cofre passou a persistir valores cifrados em `public.integration_credentials`
  com RLS e acesso exclusivo para `service_role`.
- `2026-08-21` — O login fechado por e-mail e senha com Supabase Auth foi adicionado sem
  cadastro no frontend. A sessão é persistida no navegador, o access token segue para a
  API e o backend valida a sessão antes das operações da plataforma. A criação de
  usuários e o bloqueio do cadastro público continuam sendo configurações manuais no
  painel do Supabase.
- `2026-08-21` — A proteção do Vercel permanece ativa por coerência com o serviço interno;
  testes autenticados podem usar bypass sem tornar `/api` e o painel administrativo
  públicos.
- `2026-08-21` — Corrigido o caminho padrão dos dados locais quando o Next é iniciado
  pelo workspace `apps/web`: o cofre criptografado e as flags de checks agora continuam
  apontando para o `.data` da raiz do monorepo, evitando que o painel mostre chaves como
  ausentes apenas por causa do diretório de execução.
- `2026-08-21` — Corrigido erro de hidratação no Next.js: a página inicial agora usa
  estado determinístico no servidor e aplica hash da rota e tema persistido somente após
  a montagem no navegador. A navegação direta para `/#credentials` não deve mais gerar
  divergência entre as classes da barra lateral.
- `2026-08-21` — Diagnóstico de 500 no backend Vercel aplicado: variáveis opcionais vazias
  agora são tratadas como ausentes, uma `CREDENTIALS_ENCRYPTION_KEY` inválida desabilita
  somente o cofre administrativo, e a rota `/api/[...path]` registra falhas de inicialização
  no runtime e responde 503 JSON seguro. Validação sem secrets: `/api/health`,
  `/api/checks` e `/api/history` retornaram 200 em build de produção local mesmo sem
  credenciais/Supabase; cinco testes de configuração/cofre passaram.
- `2026-08-21` — O tracing do Next foi ampliado para preservar no bundle serverless todo
  o `apps/api/dist`, incluindo o núcleo de execução e descoberta dinâmica dos plugins;
  o manifesto local da rota agora contém 83 arquivos compilados da API.
- `2026-08-21` — O cofre de integrações deixou de depender do filesystem efêmero da
  Vercel: credenciais são cifradas com AES-256-GCM no backend e persistidas em
  `public.integration_credentials` no Supabase, com RLS e acesso somente para
  `service_role`. O gate adicional de `ADMIN_TOKEN` foi removido durante a transição
  para Supabase Auth; as rotas administrativas continuam protegidas por sessão
  autenticada e aguardam uma camada de RBAC mais granular.
- `2026-08-21` — GAB-76: corrigido o erro genérico ao salvar credenciais quando o cofre
  persistente está ausente ou indisponível. A API agora responde `503` com orientação
  segura para configurar Supabase e a chave mestra, sem incluir o segredo enviado. Os
  conflitos Git persistidos em configuração, testes, documentação e plano também foram
  resolvidos preservando autenticação Supabase e o cofre sem `ADMIN_TOKEN`.
- `2026-08-24` — Nuclei adicionado como scanner de vulnerabilidades no lugar do consolidado
  baseado em Shodan. O plugin executa o CLI local sem shell, bloqueia rede privada e
  templates intrusivos, interpreta JSONL curado e alimenta o gráfico com NVD, EPSS e KEV;
  Shodan continua disponível como check independente. A Vercel marca o plugin como
  `skipped` até que um worker interno disponibilize o binário.
- `2026-08-25` — GAB-95: o cabeçalho passou a usar o avatar configurado no metadata do
  usuário, com e-mail disponível no hover, e o indicador “Rede interna” foi removido.
  O toggle administrativo de plugins recebeu atualização otimista com rollback seguro.
  A análise agora oferece JSON e um relatório PDF em janela de impressão, sem nova
  dependência ou envio de resultados ao backend.
- `2026-08-21` — Pipeline de colaboração atualizada em `COLLABORATION.md`: toda tarefa
  sincroniza a base com `pull`, usa branch exclusiva e faz `push`; após validação, a
  entrega é integrada e publicada na `master` autorizada pelo proprietário.
- `2026-08-21` — GAB-79: perfil autenticado implementado com upload de avatar em bucket
  privado do Supabase, troca de senha com análise local de força e modal obrigatório para
  contas sem `password_changed_at` (incluindo o acesso inicial `admin123`). O cartão de MFA
  ficou preparado como próxima etapa; a migration `create_profile_avatars` foi aplicada no
  projeto Supabase conectado e as policies restringem cada arquivo ao próprio usuário.
- `2026-08-22` — GAB-80: MFA TOTP conectado ao perfil e ao login. O usuário pode iniciar
  enrollment com QR Code/segredo, confirmar o autenticador, remover fatores e informar o
  código no próximo login. O backend também rejeita tokens `aal1` quando o usuário possui
  um fator TOTP verificado, liberando as rotas apenas após `aal2`. SMS e recovery codes
  continuam fora do escopo.
- `2026-08-24` — GAB-81: contas sem MFA TOTP verificado agora recebem um modal no login
  com as opções `Ativar agora` (abre o perfil) e `Ativar mais tarde` (dispensa somente
  nesta sessão). O desafio obrigatório permanece para contas com MFA. A expiração JWT do
  projeto hospedado deve ser confirmada manualmente no Auth do Supabase em 3600 segundos;
  a documentação do Supabase indica esse valor como padrão de 1 hora, mas a configuração
  atual do projeto não foi exposta pelo conector disponível.
- `2026-08-24` — GAB-82: o modal obrigatório de troca de senha agora oferece uma sugestão
  forte gerada localmente com Web Crypto, preenche confirmação automaticamente e permite
  visualizar ou editar a combinação antes do envio. Nenhuma senha sugerida é persistida ou
  registrada.
- `2026-08-24` — GAB-84: o cofre persistente e o histórico passaram a distinguir a chave
  secreta moderna `sb_secret_...` da `service_role` legada. A chave moderna permanece
  somente no header `apikey`, enquanto a legada mantém o Bearer JWT; isso permite cadastrar
  e usar as chaves dos plugins pela página Credenciais sem armazená-las em texto puro.
- `2026-08-24` — GAB-63: PhoneInfoga foi analisado pela documentação oficial. A ferramenta
  é um binário/serviço REST stateless em Go, com scanners opcionais e licença GPL-3.0; por
  isso, não será executada como processo dentro do Vercel nem terá código copiado para o
  backend. A decisão pendente é implementar um plugin nativo limitado (normalização local,
  fontes autorizadas sem chave e links de pesquisa manual) ou criar um adapter para um
  serviço PhoneInfoga hospedado separadamente. A integração permanece aberta até essa
  escolha, e nenhum número consultado é persistido.
- `2026-08-24` — GAB-63 implementado: o backend agora chama o PhoneInfoga oficial por
  `POST /api/v2/numbers` e pelos scanners base/opcionais, usando token server-side e
  curadoria por scanner. A stack `infra/phoneinfoga` adiciona gateway Docker autenticado,
  mantém a porta interna isolada e permite configurar Numverify/Google CSE pelo cofre da
  aplicação. Validação: 74 testes da API, 18 do frontend, typecheck, lint, build, compose
  config, build da imagem e smoke REST oficial com `401` sem token e `200` autenticado.
- `2026-08-24` — GAB-86: criada a página separada de documentação interna do produto,
  sem item na sidebar. O manual está disponível pelo link no rodapé e pela rota `/docs`,
  cobre login, análise, ferramentas, histórico, cofre, perfil, MFA, tema e
  troubleshooting, e lê o catálogo atual de checks para acompanhar novas integrações.
  A manutenção futura deve atualizar a data/versionamento do componente, o plano e a
  issue correspondente no Linear.
- `2026-08-24` — GAB-87: a documentação foi redesenhada como uma experiência própria de
  produto, com sidebar da documentação, busca local por tarefa/ferramenta, hero de
  onboarding, atalhos de uso, índice contextual, status do catálogo e layout responsivo.
  A página continua separada em `/docs`, protegida pela autenticação existente e sem item
  na sidebar do dashboard.
- `2026-08-24` — GAB-88: a página de Análise passou a exibir um panorama Recharts com
  distribuição dos estados, duração por fonte e insights de cobertura, sucesso, atenção
  e tempo médio. Os gráficos atualizam progressivamente durante a execução e a seção de
  documentação foi atualizada para explicar a leitura desses sinais.
- `2026-08-24` — GAB-89: o AbuseIPDB passou a solicitar `verbose` para exibir país e
  renderizar um card curado com confiança, denúncias, rede, contexto geográfico quando
  fornecido, com enriquecimento aproximado de cidade/ASN quando necessário, e links de
  referência. A grade de resultados agora mostra somente checks com sucesso; erros e
  integrações puladas continuam no resumo/insights sem criar cards de ruído.
- `2026-08-24` — GAB-90: o panorama Recharts passou a agregar vulnerabilidades por
  severidade, CISA KEV, EPSS alto e falhas observadas em headers, cookies, TLS e
  reputação. A rodada ativa agora é restaurada pela sessão do navegador, sem persistir
  credenciais; requisições interrompidas retornam ao estado Aguardando.
- `2026-08-24` — GAB-91: a análise passou a filtrar o catálogo pelo tipo de alvo
  inferido, DNS e WHOIS/RDAP deixaram de aceitar IP como alvo compatível, e a grade
  principal mantém somente respostas bem-sucedidas. Falhas e checks pulados seguem
  agregados no panorama, enquanto a página individual de ferramentas preserva seus
  detalhes de diagnóstico.
- `2026-08-24` — GAB-92: o Panorama de segurança deixou de exibir métricas operacionais
  de cobertura, sucesso, atenção, duração e distribuição dos checks. A seção agora
  concentra índice de risco, CVEs críticas, exploração conhecida, postura, radar de
  exposição, mapa de criticidade, reputação externa e falhas de segurança priorizadas.
- `2026-08-24` — GAB-69: Sherlock foi avaliado pela documentação e pelo código oficiais.
  A ferramenta é uma CLI Python MIT, sem exportador JSON de resultados pronto para o
  dashboard, e depende de muitas consultas externas. A integração foi deliberadamente
  adiada para um runner Python/Docker externo, autenticado e com limites operacionais;
  nenhum processo Sherlock foi acoplado ao Vercel. A decisão e o contrato curado estão
  em `docs/sherlock-integration.md`.
- `2026-08-24` — GAB-65: Osintgram foi avaliado pela documentação oficial. A ferramenta
  exige credencial de Instagram ou token HikerAPI, usa `instagram-private-api`, possui
  comandos de coleta ampla e está sob GPL-3.0. A integração não será executada na Vercel,
  não receberá senhas/cookies nem terá código copiado; o item foi encerrado como análise,
  com retomada condicionada a runner isolado, autorização e revisão de licença em
  `docs/osintgram-integration.md`.
- `2026-08-24` — GAB-64: GHunt foi integrado como plugin server-side de e-mail e stack
  Docker externa. O runner fixa GHunt 2.3.4/Python 3.13, mantém a sessão Google em volume
  privado e devolve apenas um contrato curado; o gateway exige token e a API do Vercel só
  conhece `GHUNT_API_URL`. A ativação em produção ainda exige hospedar o gateway, autenticar
  uma conta de investigação autorizada e salvar o token no cofre.
- `2026-08-25` — GAB-94: Nmap, Katana, Gobuster e Subfinder foram adicionados como checks
  independentes por meio de `infra/command-tools`, um gateway autenticado e um runner
  Docker sem shell arbitrário. Os perfis são limitados, o Gobuster começa desabilitado,
  e o dashboard recebe somente hosts, portas, URLs, subdomínios e caminhos curados. A
  ativação em produção ainda exige hospedar o gateway HTTPS e salvar o token no cofre.
