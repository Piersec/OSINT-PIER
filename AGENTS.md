# AGENTS.md

Este arquivo define como qualquer agente de IA (Claude Code, Cursor, Copilot, etc.) deve
trabalhar neste repositório. Leia este arquivo e o `PLAN.md` **antes** de escrever qualquer
código. Se houver conflito entre uma instrução do usuário no chat e o que está aqui, avise
o usuário sobre a divergência antes de prosseguir.

---

## 1. Visão do projeto

Uma plataforma web de OSINT/análise de sites e IPs. O usuário informa um domínio, IP ou
URL, e a plataforma roda várias "checagens" (tarefas) em paralelo, exibindo os resultados
em um dashboard organizado por cards.

Inspiração conceitual: [web-check](https://github.com/lissy93/web-check) — mas com uma
arquitetura de plugins mais explícita e pensada para crescer com integrações de terceiros
(VirusTotal, AbuseIPDB, Shodan, e outras que serão adicionadas ao longo do tempo).

---

## 2. Princípio arquitetural central: Checks como Plugins

Cada checagem (ex: DNS, SSL, WHOIS, VirusTotal, AbuseIPDB) é um **módulo independente e
autocontido**. Nada de lógica de checagem espalhada pelo servidor principal.

### Contrato de um Plugin/Check

Todo módulo de check deve exportar:

- `id` — string única, kebab-case (ex: `dns-records`, `virus-total`)
- `label` — nome de exibição
- `requiredEnv` — lista de variáveis de ambiente necessárias (vazio se não precisar)
- `run(target, context)` — função que recebe o alvo (domínio/IP/URL) e retorna um resultado
  no formato padronizado abaixo

### Formato de resposta padronizado

```json
{
  "id": "dns-records",
  "status": "success | error | skipped",
  "data": { "...": "..." },
  "error": "mensagem, se status = error",
  "source": "nome do serviço/API usada",
  "durationMs": 123
}
```

- `status: skipped` deve ser usado quando o plugin depende de uma API key ausente.
  Nunca deixe um plugin faltando quebrar os outros — cada checagem roda isolada
  (try/catch individual, timeout individual).
- Todo plugin deve ter um timeout razoável (a definir no PLAN.md) para não travar o
  dashboard inteiro esperando uma API externa lenta.

`requiredEnv` continua sendo o identificador canônico de cada credencial, mas o valor
pode ser resolvido de duas fontes: primeiro o cofre criptografado administrado pela
interface interna e, como fallback, a variável de ambiente correspondente. O valor do
segredo nunca pode ser incluído no resultado do plugin.

### Adicionando um novo check/plugin

1. Criar o módulo na pasta de checks seguindo o contrato acima.
2. Registrar automaticamente (o sistema deve carregar plugins dinamicamente pela pasta —
   **não** manter uma lista manual gigante para editar toda vez).
3. Criar o componente de frontend correspondente para renderizar aquele resultado
   (ou usar um renderer genérico de fallback, se o dado for simples/tabular).
4. Documentar no `.env.sample` qualquer variável de ambiente nova.
5. Atualizar o checklist de features no `PLAN.md`.

### Adicionando uma nova integração externa (ex: VirusTotal, AbuseIPDB)

Quando o usuário mandar um link de repositório/API nova:

1. Ler a documentação da API (endpoints, autenticação, rate limits, formato de resposta).
2. Propor ao usuário como os dados relevantes dessa API se encaixam no dashboard
   (quais campos vale a pena exibir — não precisa expor a resposta bruta inteira).
3. Implementar como um novo plugin, seguindo o contrato da seção 2.
4. Tratar rate limit e erros de autenticação de forma explícita (status `error` com
   mensagem clara, nunca deixar estourar exception não tratada).

---

## 3. Regras gerais de código

- **Nunca hardcode chaves de API ou segredos.** Elas devem vir do cofre criptografado
  interno ou, como fallback, de variável de ambiente.
- Toda variável de ambiente nova precisa ser adicionada ao `.env.sample` com um comentário
  explicando onde obter a chave.
- O painel de credenciais é exclusivo do serviço interno e exige autenticação
  administrativa. Ele pode adicionar, substituir e remover segredos, mas nunca ler ou
  devolver ao frontend um valor já armazenado.
- Segredos persistidos pela aplicação devem usar criptografia autenticada em repouso. A
  chave mestra e o token administrativo continuam exclusivamente em variáveis de ambiente
  e nunca podem ser gravados no cofre que eles protegem.
- Arquivos do cofre, temporários de escrita e dados locais devem ser ignorados pelo Git.
- Prefira simplicidade: não adicionar abstrações genéricas demais "para o futuro" além do
  que o contrato de plugin já exige.
- Cada plugin deve ser testável isoladamente (mockando a API externa).
- Erros de rede/API externa nunca devem derrubar o processo do servidor — sempre try/catch
  no nível do plugin.
- Não expor stack traces ou detalhes internos de erro no response para o cliente.

---

## 4. Frontend

- Ao submeter um alvo (domínio/IP/URL), o frontend dispara todas as checagens habilitadas
  em paralelo.
- Cada card de resultado deve ter 3 estados visuais: carregando, sucesso, erro/pulado.
- Resultados devem aparecer progressivamente (streaming/paralelo), não esperar tudo
  terminar para mostrar algo.
- Novo plugin no backend não deve exigir reescrever a tela toda — o frontend deve
  conseguir renderizar resultados de forma genérica quando não houver um componente
  customizado ainda.

---

## 5. Fluxo de trabalho esperado do agente de IA

1. Ler `AGENTS.md` (este arquivo) e `PLAN.md` antes de qualquer alteração.
2. Verificar em qual fase do `PLAN.md` o projeto está.
3. Implementar apenas o escopo da fase atual, a menos que o usuário peça explicitamente
   para adiantar algo.
4. Ao concluir uma tarefa do plano, marcar o item correspondente como concluído no
   `PLAN.md`.
5. Se uma decisão de arquitetura não estiver coberta pelo plano, perguntar ao usuário
   antes de decidir sozinho.
6. Ao adicionar uma integração nova (a partir de um link que o usuário mandar), seguir
   o processo da seção 2.3 deste arquivo.

---

## 6. O que evitar

- Não copiar código do web-check diretamente (é apenas referência conceitual de
  arquitetura, não uma base de código a ser clonada).
- Não criar uma checagem que replique 100% do que uma API externa já retorna sem
  curadoria — o objetivo é mostrar as informações mais úteis, não um dump bruto.
- Não acoplar plugins entre si (um plugin não deve depender do resultado de outro,
  a menos que isso seja decidido explicitamente e documentado).
- Não commitar arquivos `.env` reais.
