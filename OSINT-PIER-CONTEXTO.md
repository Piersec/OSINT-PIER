# OSINT Pier — contexto para continuidade

> Arquivo de handoff para iniciar uma nova conversa após reinstalação ou troca de
> computador. Anexe este arquivo ao novo chat e peça para o agente lê-lo antes de alterar
> o projeto. Ele resume as decisões e o estado conhecido até **21/09/2026**.

## Como usar no novo chat

1. Faça clone ou abra o repositório `Piersec/OSINT-PIER`.
2. Anexe este arquivo, `AGENTS.md`, `PLAN.md` e `COLLABORATION.md` ao novo chat.
3. Envie algo parecido com:

   > Leia `OSINT-PIER-CONTEXTO.md`, `AGENTS.md`, `PLAN.md` e `COLLABORATION.md`.
   > Continue o projeto a partir do estado atual, sem inventar credenciais, sem expor
   > segredos e preservando a arquitetura de plugins. Primeiro verifique `git status`,
   > a branch e a produção; depois trate a tarefa que eu enviar.

Este arquivo não transfere memória automaticamente: ele funciona como contexto explícito
para o próximo agente. Antes de assumir que algo continua válido, valide o estado atual no
GitHub, Supabase e Vercel.

## Identidade e objetivo do produto

- Nome do produto: **OSINT Pier**.
- Organização: PierSec.
- Produto: plataforma interna para investigação OSINT, análise de superfície de ataque e
  consulta de domínios, URLs, IPs e identidades.
- Idioma principal da interface: português do Brasil (`pt-BR`).
- Usuários informam um alvo; checks independentes são executados em paralelo e aparecem
  progressivamente em cards curados.
- O produto deve parecer uma ferramenta premium de inteligência/investigação: sério,
  legível e operacional, sem perder clareza ou virar um log bruto.
- Referências visuais discutidas: web-check (arquitetura conceitual), Cobolt/One Page Love,
  SecurityOne, Tailgrids, FortiGuard IPS Encyclopedia e o manual de marca PierSec enviado
  pelo usuário.

## Regras obrigatórias do repositório

Leia integralmente `AGENTS.md`, `PLAN.md` e `COLLABORATION.md` antes de editar.

Pontos essenciais:

- Cada check é um plugin autocontido com `id`, `label`, `requiredEnv` e `run(target,
  context)`.
- Resposta padronizada: `status` (`success`, `error` ou `skipped`), `data`, `error`,
  `source` e `durationMs`.
- Um plugin não pode derrubar os demais; use timeout e `try/catch` isolados.
- Segredos nunca podem ser hardcoded, commitados, colocados em Markdown, logs ou enviados
  para o frontend.
- Credenciais devem vir do cofre criptografado server-side ou, como fallback, de variáveis
  de ambiente.
- O frontend deve suportar loading, sucesso, erro e credencial ausente por check.
- Não copiar código do web-check; usar apenas como referência conceitual.
- Cada alteração relevante deve ter commit atômico, validações e atualização de documentação.
- O usuário dispensou o Linear para a entrega visual atual; não crie tarefas no Linear sem
  novo pedido explícito. O código, GitHub e Vercel continuam sendo mantidos.

## Stack e organização

- Monorepo pnpm (`pnpm@11.19.0`).
- Node.js 24 ou superior.
- Frontend: Next.js 16.3.2, React 19, TypeScript, Recharts, Three.js, GSAP/Motion,
  Supabase JS.
- API: Fastify/TypeScript em `apps/api`.
- Contratos compartilhados: `packages/contracts`.
- Web: `apps/web`.
- Migrações: `supabase/migrations`.
- Runners/gateways Docker: `infra/`.
- Documentação de integrações: `docs/`.
- Estilos principais: `apps/web/src/workspace-ui.css` e `apps/web/src/styles.css`.
- Entrada principal da aplicação: `apps/web/src/App.tsx`.
- Cards de resultado: `apps/web/src/components/checks/ResultCard.tsx`.

Comandos úteis:

```powershell
pnpm install
pnpm dev
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm format:check
```

O frontend local usa `http://localhost:5173`; a API Fastify local usa `http://localhost:3000`.
O cliente normalmente chama a API via same-origin `/api` pelo proxy do Next. Só configure
`NEXT_PUBLIC_API_URL` quando for necessário apontar para uma API Fastify separada.

## Repositórios, produção e estado Git

- GitHub: `https://github.com/Piersec/OSINT-PIER`.
- Branch principal: `master`.
- Último commit integrado da entrega visual de controles/resultados:
  `e534acc feat: simplify investigation controls and results`.
- Branch usada para essa entrega: `codex/clean-investigation-controls`.
- A `master` foi atualizada e enviada para `origin/master`; confirme com `git pull --ff-only`.
- Vercel: projeto `osint-pier`.
- Produção: `https://osint-pier.vercel.app`.
- O deploy do commit `e534acc` ficou `READY` e a URL respondeu HTTP 200.
- O projeto Supabase usado pelo backend tem ref `doqnyijzaogqiwkuygcs`.

Não presuma que um deploy, domínio ou variável continua correto depois de uma migração de
computador. Sempre confira os logs da Vercel e as variáveis do ambiente de produção.

## Variáveis e segredos

O arquivo `.env.sample` contém nomes e defaults não sensíveis. A configuração inclui, entre
outras:

- `API_HOST`, `PORT`, `WEB_ORIGIN`;
- `CHECK_TIMEOUT_MS`, `CHECK_CACHE_TTL_MS`, `CHECK_CACHE_MAX_ENTRIES`;
- `ANALYSIS_RATE_LIMIT_MAX`, `ANALYSIS_RATE_LIMIT_WINDOW_MS`;
- `CREDENTIALS_ENCRYPTION_KEY` (32 bytes em Base64);
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_HISTORY_LIMIT`;
- credenciais de plugins como `VIRUSTOTAL_API_KEY`, `ABUSEIPDB_API_KEY`,
  `HUNTER_API_KEY` e `SHODAN_API_KEY`;
- URLs/tokens de runners Docker, quando usados, como `GHUNT_API_URL`,
  `PHONEINFOGA_API_URL`, `COMMAND_TOOLS_API_URL` e tokens correspondentes;
- `NUCLEI_PATH` e `NUCLEI_TEMPLATE_DIR` para execução local autorizada do Nuclei.

As chaves de VirusTotal, AbuseIPDB, Hunter e Shodan foram compartilhadas pelo usuário em
mensagens anteriores, mas foram deliberadamente **omitidas deste arquivo**. Depois de
formatar o PC, recupere-as somente do gerenciador/cofre autorizado ou gere novas chaves;
não cole valores antigos em commits, issues, prompts públicos ou documentação.

O cofre de integrações usa AES-256-GCM. A chave mestra e a service role key do Supabase
ficam somente no backend/Vercel. O navegador recebe apenas status (configurada/ausente),
nunca o valor armazenado. O painel administrativo atualmente usa a sessão autenticada do
Supabase; `ADMIN_TOKEN` não é exigido no fluxo atual. O RBAC que separará usuários normais
de administradores ainda é uma pendência e o serviço deve permanecer restrito até isso ser
concluído.

Se salvar uma credencial retornar `503` em produção, verifique no ambiente da Vercel:
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `CREDENTIALS_ENCRYPTION_KEY`, a aplicação das
variáveis ao ambiente **Production**, e faça um novo deploy. Nunca coloque essas chaves em
variáveis `NEXT_PUBLIC_*`.

## Banco e autenticação

Migrações importantes:

- `supabase/migrations/20260820000000_create_analysis_history.sql`
- `supabase/migrations/20260821000001_create_integration_credentials.sql`
- `supabase/migrations/20260821195314_create_profile_avatars.sql`

O histórico persistente guarda apenas alvo, tipo, contadores e horários. Não guarda respostas
detalhadas nem segredos. RLS fica habilitado e o acesso server-side usa service role.

O perfil permite nome/foto/senha conforme o fluxo Supabase. A troca de foto deve existir
apenas na aba **Perfil**; foi removida das Configurações por redundância. Se uma sessão
mostrar “Login indisponível”, confira `NEXT_PUBLIC_SUPABASE_URL` e
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` no frontend e as configurações de redirect do Supabase.

## Checks e integrações implementados

### Checks sem chave externa

IP Info, DNS Records, WHOIS/RDAP, SSL/TLS Certificate, HTTP Headers, Server Location,
Redirect Chain, Tech Stack, Cookies, Robots.txt/Sitemap e Server Status.

### Integrações com API/cofre

- VirusTotal: reputação agregada de domínio/IP, sem submissão automática.
- AbuseIPDB: score, denúncias e contexto de rede de IP público.
- Shodan: host/domain curado, portas, serviços, organização, localização, tags e CVEs;
  banners brutos não são exibidos.
- Hunter.io: Domain Search e Email Verifier, com dados curados de domínio/e-mail.

### Vulnerabilidades

- O card Shodan permanece independente.
- O bloco de Vulnerabilidades usa Nuclei para achados diretos e enriquece CVEs com NVD,
  FIRST EPSS e CISA KEV.
- A visualização resume quantidade, severidade e prioridade; a regra é triagem e não
  substitui validação técnica.
- Recharts é usado nos gráficos de criticidade.
- A Vercel não inclui o binário Nuclei; em produção o check retorna `skipped` até um worker
  interno autorizado ou runner explícito estar disponível.

### Ferramentas/integrações avaliadas ou externas

- PhoneInfoga e GHunt dependem de gateways/runners Docker autenticados.
- Osintgram foi apenas avaliado; não executar sem runner isolado, autorização e revisão de
  licença/termos.
- Sherlock foi avaliado; a CLI Python depende de runner externo autenticado.
- OSINT Framework é catálogo de referências filtráveis, sem scraping automático.
- Command Tools (Nmap, Katana, Gobuster, Subfinder) usam gateway/runner Docker com perfis
  allowlisted, limites e saída curada.
- As instruções operacionais estão em `infra/portainer/README.md` e nos READMEs dos runners.

Uma instalação Docker na rede privada (por exemplo, `192.168.x.x`) não é acessível pelo
backend hospedado na Vercel sem endpoint HTTPS intermediário, firewall/túnel autorizado e
token configurado.

## Fluxo de consulta

- Detecção do tipo é automática por padrão: domínio, IP, URL, nome, username, e-mail ou
  telefone.
- O usuário pode selecionar/desselecionar ferramentas com toggles/checkboxes.
- O backend normaliza o alvo, filtra `supportedTargetKinds` e executa checks compatíveis em
  paralelo.
- Resultados aparecem progressivamente.
- Existe cache de sucesso em memória por padrão de 5 minutos e rate limit por IP.
- Histórico pode ser reutilizado com a ação **Usar novamente**.
- Exportações JSON/PDF são feitas localmente depois que os checks chegam a estado terminal;
  credenciais nunca entram no arquivo.

## Decisões e histórico de produto

O projeto começou como uma central inspirada no web-check, com cards para IP/DNS/WHOIS/SSL
e integrações VirusTotal, AbuseIPDB e Shodan. Em seguida foram adicionados:

- paginação/categorias de Análise, Ferramentas, Histórico, Credenciais e Configurações;
- filtro de ferramentas e consultas por identidade;
- histórico no Supabase;
- cofre criptografado de APIs;
- autenticação Supabase e perfil com foto;
- exportação JSON e PDF por impressão;
- CVEs com Nuclei/NVD/EPSS/KEV e gráfico Recharts;
- runners Docker para ferramentas que não cabem em funções serverless.

O usuário pediu várias revisões visuais: visual PierSec/OSINT Pier, Inter, tema dark/white,
bento grid, hero com constelação, redução do “AI slop”, maior densidade dos dados e inspiração
Tailgrids/Cobolt/SecurityOne/FortiGuard. A direção atual é uma ferramenta premium de
investigação, com cyan/blue como destaque, superfícies escuras, cards operacionais e dados
curados em vez de dumps.

## Última entrega visual (commit `e534acc`)

Foi implementado e publicado:

1. Remoção dos títulos de grupo redundantes da barra lateral; a marca e o contexto da
   plataforma permanecem.
2. Cor de “Expandir” alinhada ao azul/ciano da interface.
3. Estilos dos botões secundários, abas e upload alinhados ao estilo dos controles da
   navegação.
4. Foto de perfil removida de Configurações; edição permanece em Perfil.
5. `ResultCard` mostra primeiro os campos principais e recolhe dados adicionais em `<details>`.
6. Cards ganharam cabeçalho/stripe ciano, grids chave/valor mais legíveis, tabelas internas
   mais neutras e espaçamento responsivo.
7. `PLAN.md` recebeu o item de simplificação de controles/resultados como concluído.

Arquivos centrais da entrega:

- `apps/web/src/App.tsx`
- `apps/web/src/components/checks/ResultCard.tsx`
- `apps/web/src/workspace-ui.css`
- `PLAN.md`

Validações realizadas nessa entrega:

- testes do web: 31 testes passaram;
- `pnpm typecheck` passou;
- deploy de produção da Vercel ficou `READY`;
- `https://osint-pier.vercel.app` respondeu HTTP 200.

## Pendências conhecidas e próximos cuidados

- Implementar RBAC real para distinguir administradores e usuários comuns antes de abrir o
  cofre em uma rede mais ampla.
- Resolver/operacionalizar runners HTTPS para Nuclei, GHunt, PhoneInfoga e Command Tools;
  não tentar executar essas CLIs diretamente em Vercel.
- Confirmar em produção todas as variáveis Supabase e credenciais do cofre após a troca de PC.
- Avaliar o vínculo entre `avatar_path` salvo no perfil e a função de leitura do avatar do
  cabeçalho, caso a foto do usuário não apareça depois do login.
- Fazer QA visual em desktop e mobile nos cards, especialmente `<details>` com tabelas/listas
  longas e o tema White.
- Manter o formato dos resultados curado; não voltar a renderizar respostas brutas de API.
- Usar branches `codex/<slug>` para próximas mudanças e integrar somente depois de testes,
  `git diff --check`, revisão e deploy.

## Checklist para retomar o desenvolvimento

```text
[ ] Ler este arquivo, AGENTS.md, PLAN.md e COLLABORATION.md
[ ] git status --short --branch
[ ] git switch master && git pull --ff-only origin master
[ ] Confirmar ambiente Node 24 + pnpm 11
[ ] Conferir variáveis locais sem imprimir valores secretos
[ ] Reproduzir o pedido no local antes de editar
[ ] Criar branch codex/<slug>
[ ] Editar com apply_patch e manter escopo pequeno
[ ] Rodar teste afetado, typecheck, lint/build conforme o risco
[ ] Atualizar PLAN.md/documentação quando necessário
[ ] Commit atômico e push da branch
[ ] Integrar master, push e confirmar deploy Vercel
```

## Segurança do handoff

Este arquivo intencionalmente não contém chaves de API, service role key, chave mestra,
tokens de runners, senha ou dados pessoais de usuários. Se qualquer cópia futura incluir
segredos por acidente, revogue/rotacione-os imediatamente e remova-os do histórico Git.
