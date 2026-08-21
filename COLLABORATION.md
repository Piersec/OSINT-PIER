# Pipeline de colaboração do OSINT Pier

Este arquivo é obrigatório para qualquer pessoa ou IA que altere o repositório. O objetivo é permitir trabalho em equipe sem sobrescrever mudanças, duplicar decisões ou misturar escopos.

## Ordem de leitura

Antes de escrever código:

1. Leia `AGENTS.md`.
2. Leia `PLAN.md` e identifique a fase atual.
3. Leia este arquivo.
4. Consulte a issue correspondente no Linear e os documentos específicos do escopo.

`AGENTS.md` define as regras arquiteturais. `PLAN.md` define o escopo e o estado do produto. Este arquivo define a coordenação entre pessoas e IAs. Se houver conflito entre arquivos, pare e peça uma decisão ao responsável pelo projeto.

## Contexto operacional

- Repositório: `OSINT-PIER`
- Linear: equipe `GAB`, projeto `OSINT - PIER`
- Organização Supabase: `llwcpmkimmewessubfzk`
- Projeto Supabase: `doqnyijzaogqiwkuygcs`
- Gerenciador: pnpm 11.19.0
- Runtime: Node.js 24 ou superior

Confirme esses identificadores no Linear/Supabase antes de executar uma operação externa. Eles são referências de coordenação, não substituem a leitura do estado atual.

## Papéis

### Coordenador/integrador

- Divide o trabalho em issues do Linear.
- Define o escopo de cada agente e os arquivos exclusivos.
- Mantém `PLAN.md`, `AGENTS.md`, este arquivo e os manifests sob coordenação serial.
- Integra branches, executa a validação final e faz o commit de integração.

### Implementador

- Trabalha somente no escopo declarado na issue.
- Não edita arquivos bloqueados por outro agente.
- Faz commits atômicos da própria etapa.
- Entrega um handoff com arquivos, commit, testes e pendências.

### Revisor/QA

- Começa em modo somente leitura.
- Reproduz o problema ou valida o comportamento descrito.
- Pode corrigir apenas se o escopo for explicitamente transferido para ele.
- Não altera código durante uma revisão sem registrar a mudança na issue.

## Unidade de trabalho

Toda alteração relevante deve ter uma issue no Linear. A issue precisa informar:

- objetivo e critério de aceite;
- fase do `PLAN.md`;
- arquivos que podem ser alterados;
- arquivos que não devem ser alterados;
- dependências externas e variáveis de ambiente;
- validações esperadas;
- responsável atual e estado.

Uma issue representa uma unidade de entrega. Não misture correção de bug, refatoração, documentação e feature na mesma issue sem registrar a decisão.

## Processo obrigatório

### 1. Preparar

- Verifique `git status --short --branch`.
- Preserve alterações existentes que não pertençam ao seu escopo.
- Leia a issue no Linear e procure issues relacionadas antes de criar outra solução.
- Confirme que não há outro agente trabalhando nos mesmos arquivos.

### 2. Declarar posse

Ao começar, atualize a issue para `In Progress` e deixe um comentário com:

```md
### Claim

- Escopo:
- Arquivos exclusivos:
- Arquivos compartilhados que não serão editados:
- Dependências:
- Critério de aceite:
```

Se não for possível declarar arquivos exclusivos, o trabalho deve ser serializado pelo coordenador.

### 3. Implementar

- Faça a menor alteração que atende ao critério de aceite.
- Use `apply_patch` para edições locais.
- Não reescreva arquivos inteiros sem necessidade.
- Não altere APIs, schema, dependências ou configuração de deploy fora do escopo.
- Nunca use `git reset --hard`, `git checkout --`, `git clean` ou equivalente para apagar trabalho sem autorização explícita.

### 4. Validar

Execute primeiro os testes diretamente afetados e depois as validações do repositório, conforme o risco:

```text
pnpm --filter <pacote> test
pnpm typecheck
pnpm lint
pnpm build
```

Se alguma validação não puder ser executada, registre o motivo exato no handoff. Não declare sucesso por inferência.

### 5. Entregar

Cada etapa relevante deve terminar com um commit atômico:

```text
feat: descrição curta
fix: descrição curta
docs: descrição curta
test: descrição curta
chore: descrição curta
```

O commit deve conter somente o escopo da issue. Antes de entregar, confira:

- `git diff --check` sem erros;
- `git status` sem arquivos inesperados;
- testes e comandos executados;
- documentação e Linear atualizados.

### 6. Handoff

Comente na issue e entregue ao coordenador:

```md
### Handoff

- Resultado:
- Commit:
- Arquivos alterados:
- Validações executadas:
- Variáveis/configurações novas:
- Pendências ou riscos:
- Próxima ação sugerida:
```

Depois do handoff, mova a issue para `In Review`. O coordenador move para `Done` somente após revisar e integrar.

## Branches e workspace

- Para trabalho paralelo, use uma branch por issue: `codex/GAB-<n>-<slug>`, ou o nome de branch sugerido pelo Linear.
- Nunca use a mesma working tree para dois agentes que escrevem ao mesmo tempo.
- Se worktrees não estiverem disponíveis, somente um agente pode editar; os demais ficam em leitura/revisão.
- Não faça `pull`, `push`, rebase ou merge automático sem que isso esteja no escopo autorizado.
- O coordenador é responsável por integrar commits e resolver conflitos.

## Arquivos de alto conflito

Estes arquivos exigem posse exclusiva ou edição serializada:

| Área                   | Arquivos                                                                  | Regra                                                         |
| ---------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Governança             | `AGENTS.md`, `PLAN.md`, `COLLABORATION.md`                                | Coordenador edita por último ou integra mudanças manualmente. |
| Dependências           | `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`                   | Um agente por vez; validar instalação e lockfile.             |
| API compartilhada      | `apps/api/src/app.ts`, `apps/api/src/config.ts`, `apps/api/src/server.ts` | Uma issue por vez.                                            |
| Frontend compartilhado | `apps/web/src/App.tsx`, `apps/web/src/styles.css`, `apps/web/src/app/*`   | Uma issue por vez, salvo arquivos de páginas independentes.   |
| Supabase               | `supabase/migrations/*`                                                   | Uma migração por issue; registrar projeto/ref e validação.    |
| Deploy                 | `vercel.json`, `apps/web/next.config.ts`                                  | Coordenador ou responsável de release.                        |

Arquivos em `dist/`, `.next/`, `coverage/`, `.data/`, `.env` e `node_modules/` são gerados ou locais. Não devem ser editados nem commitados.

## Regras para evitar conflitos

- Se `git status` mostrar alterações em arquivo que você precisa editar, pare e informe o coordenador.
- Não formate globalmente o projeto durante uma issue de escopo pequeno.
- Não atualize dependências junto com uma feature sem issue própria ou autorização explícita.
- Não resolva conflitos escolhendo automaticamente “o seu lado” ou “o outro lado”. Releia o contrato e peça decisão quando o comportamento não for óbvio.
- Se duas issues precisarem do mesmo arquivo, divida o arquivo por etapas ou serialize as issues.
- Prefira comentários de coordenação no Linear a instruções paralelas no chat.

## Linear como fonte de coordenação

Use os estados da equipe `GAB` assim:

- `Backlog`: ideia ainda não preparada.
- `Todo`: escopo pronto, sem implementação iniciada.
- `In Progress`: agente declarou posse.
- `In Review`: implementação entregue, aguardando revisão/integração.
- `Done`: validada e integrada.

Toda mudança de escopo, bloqueio, decisão de arquitetura, novo segredo/configuração ou resultado de QA deve virar comentário na issue. Nunca registre segredos, tokens, service role keys ou dados pessoais no Linear.

## Segurança e dados sensíveis

- Não coloque segredos em commits, issues, comentários, Markdown, logs ou screenshots.
- A chave Supabase publishable/anon pode aparecer no frontend; a service role key nunca.
- Não copie valores de `.env` para mensagens de handoff.
- Migrações e operações no Supabase devem apontar explicitamente para `doqnyijzaogqiwkuygcs` e ser verificadas depois.
- Mudanças que afetam autenticação, RLS, credenciais ou deploy exigem validação adicional e registro no Linear.

## Checklist rápido para qualquer IA

```text
[ ] Li AGENTS.md, PLAN.md e COLLABORATION.md.
[ ] Identifiquei a fase e a issue do Linear.
[ ] Verifiquei git status e alterações existentes.
[ ] Declarei escopo e arquivos exclusivos.
[ ] Confirmei que não há outro agente editando os mesmos arquivos.
[ ] Implementei somente o escopo combinado.
[ ] Rodei os testes/typecheck/lint/build adequados.
[ ] Atualizei documentação e Linear.
[ ] Fiz commit atômico.
[ ] Entreguei handoff com commit, validações e pendências.
```
