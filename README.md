# OSINT PIER

Plataforma interna e extensível para análise progressiva de domínios, URLs, endereços IP e
identidades. Cada checagem é um plugin independente, descoberto automaticamente pela API.

## Requisitos

- Node.js 24 ou superior
- pnpm 11

## Preparação local

1. Instale as dependências com `pnpm install`.
2. Copie `.env.sample` para `.env` sem versionar o novo arquivo.
3. Gere um token administrativo longo.
4. Gere 32 bytes aleatórios em base64 para `CREDENTIALS_ENCRYPTION_KEY`.
5. Inicie API e frontend com `pnpm dev`.

Exemplo para gerar a chave mestra:

```powershell
$bytes = [byte[]]::new(32)
[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToBase64String($bytes)
```

A interface Next.js abre em `http://localhost:5173` e, no modo local, mantém a API Fastify
em `http://localhost:3000`. O cliente usa a rota same-origin `/api` por padrão; defina
`NEXT_PUBLIC_API_URL` somente se quiser apontar para uma API Fastify separada. Em outro
ambiente interno, use HTTPS antes de inserir chaves no painel, pois o token administrativo
acompanha cada operação em um header.

## Credenciais

O painel administrativo aceita um identificador como `VIRUSTOTAL_API_KEY` e permite
adicionar, substituir ou remover seu valor. O backend:

- criptografa o cofre com AES-256-GCM;
- nunca devolve um segredo armazenado;
- exige `ADMIN_TOKEN` em todas as operações do cofre;
- usa variáveis de ambiente como fallback;
- retorna `skipped` quando um plugin não encontra uma credencial obrigatória.

O token administrativo fica somente na memória da aba e é descartado ao recarregar a
página. O arquivo `.data/credentials.enc` e os arquivos `.env` são ignorados pelo Git.

## Histórico persistente com Supabase

O histórico agregado pode ser persistido em um projeto Supabase configurando
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_HISTORY_LIMIT`. A API usa a
service role apenas no servidor para acessar `public.analysis_history`; essa chave nunca
vai para o frontend. A migração `create_analysis_history` cria a tabela com RLS habilitado
e não cria políticas públicas, portanto o acesso fica restrito ao backend interno.
O SQL reproduzível fica em `supabase/migrations/20260820000000_create_analysis_history.sql`.

São salvos somente alvo, tipo da consulta, contadores de sucesso/atenção e horários —
nenhuma resposta detalhada dos plugins ou credencial. Se o Supabase não estiver
configurado ou estiver temporariamente indisponível, o dashboard continua usando o
histórico de sessão local.

## Configuração dos plugins

Depois de abrir o cofre, o painel também lista todos os plugins descobertos pela API. Cada
módulo pode ser habilitado ou desabilitado sem editar código; plugins novos entram
habilitados por padrão. A preferência é salva localmente em `.data/check-settings.json`
(ou no caminho de `CHECK_SETTINGS_PATH`) e contém apenas flags booleanas, nunca credenciais.
Plugins desabilitados não aparecem no dashboard nem aceitam novas execuções.

## Fontes externas sem chave

- WHOIS consulta o registro RDAP correto pelo bootstrap oficial da IANA.
- Server Location usa `ipwho.is`, limitado a 1.000 consultas diárias no endpoint gratuito.
- IPs privados e reservados são classificados localmente e nunca enviados ao serviço de
  geolocalização.

## Integrações opcionais com chave

- **VirusTotal API v3** — consulta o relatório existente de um domínio ou IP e exibe
  estatísticas agregadas, detecções maliciosas/suspeitas, reputação, categorias e contexto
  de rede. A chave usa o header `x-apikey`. A API pública é limitada a 4 consultas por
  minuto e 500 por dia e possui restrições de uso comercial e em fluxos empresariais;
  confirme que a chave/licença é compatível com o uso interno antes de habilitar.
- **AbuseIPDB API v2** — consulta um IP público no endpoint `check`, com janela de 90 dias,
  e exibe score de confiança, contagem de denúncias, contexto de rede e cota restante.
  Comentários brutos não são solicitados. O plano gratuito oferece 1.000 consultas por
  dia no endpoint; respostas `429` são apresentadas como limite atingido.
- **Hunter.io API v2** — usa Domain Search para domínios/URLs e Email Verifier para
  consultas de e-mail. Exibe organização, padrão, contatos resumidos, confiança e checks
  de entregabilidade; a chave usa `HUNTER_API_KEY` e os limites da API são preservados.
- **Shodan Host API** — resolve domínios/URLs para um IP público e consulta portas,
  serviços resumidos, organização, localização, tags e vulnerabilidades. A chave usa
  `SHODAN_API_KEY`; banners brutos não são enviados ao dashboard.
- **Vulnerabilidades (CVE)** — mantém o card Shodan original e, em um bloco separado,
  correlaciona fingerprints do host com a [API de vulnerabilidades do NVD](https://nvd.nist.gov/developers/vulnerabilities),
  enriquece a probabilidade de exploração pela [API FIRST EPSS](https://www.first.org/epss/api)
  e marca presença no [catálogo CISA KEV](https://www.cisa.gov/known-exploited-vulnerabilities-catalog).
  A triagem visual usa CVSS + EPSS + KEV e não substitui validação do serviço exposto.
- **OSINT Framework** — catálogo local de referências filtrado pelo tipo de alvo, sem
  scraping automático.

Para habilitar, abra o cofre no dashboard e salve `VIRUSTOTAL_API_KEY`,
`ABUSEIPDB_API_KEY`, `HUNTER_API_KEY` e/ou `SHODAN_API_KEY`. Se uma chave não estiver configurada, o card correspondente será
marcado como pulado sem afetar as demais checagens.

## Tipos de consulta e seleção de ferramentas

O campo de pesquisa usa detecção automática para domínio, IP, URL, nome, username, e-mail
e telefone, sem exigir uma caixa adicional de tipo. O seletor de ferramentas abaixo do
campo permite executar todas as checagens ou somente as marcadas; cada plugin declara seus
tipos suportados e a API normaliza o alvo antes da execução.

Integrações planejadas serão adicionadas como plugins isolados. Shodan e Hunter.io
exigem credenciais de API (`SHODAN_API_KEY` e `HUNTER_API_KEY`). Sherlock normalmente é
um utilitário local sem chave; PhoneInfoga, GHunt e Osintgram dependem de executáveis,
scanners ou sessões de conta e serão avaliados com autorização explícita antes de serem
habilitados. OSINT Framework será tratado como catálogo de referências, não como uma
fonte automática de resultados.

## Cache e proteção da API

Resultados bem-sucedidos são mantidos somente na memória do processo por 5 minutos. A
chave combina plugin, tipo e alvo normalizado; erros e checks pulados não são armazenados.
Chamadas simultâneas idênticas compartilham a mesma execução, o cache possui limite de
1.000 entradas e é limpo quando uma credencial é adicionada, substituída ou removida.

As respostas de execução incluem `x-osint-cache` com `HIT`, `MISS`, `COALESCED` ou
`BYPASS`. Configure `CHECK_CACHE_TTL_MS` e `CHECK_CACHE_MAX_ENTRIES` para ajustar ou
desabilitar o recurso.

Os endpoints `POST /api/checks/:id` compartilham um limite padrão de 60 requests por
minuto para cada IP de conexão. Ao excedê-lo, a API retorna `429`, `Retry-After` e uma
mensagem segura. Health check, catálogo e painel administrativo não consomem esse limite.
Os valores podem ser alterados por `ANALYSIS_RATE_LIMIT_MAX` e
`ANALYSIS_RATE_LIMIT_WINDOW_MS`.

Cache e rate limiting usam memória local porque o serviço atual possui uma única
instância. Um deploy com múltiplas instâncias exigirá um armazenamento compartilhado.

## Exportação

Depois que todos os checks chegam a um estado terminal, o dashboard habilita o botão
**Exportar JSON**. O arquivo é montado e baixado inteiramente no navegador, sem criar
histórico ou enviar uma cópia adicional ao backend.

O contrato atual usa `schemaVersion: 1` e inclui o alvo, horário de geração, resumo por
status e as respostas curadas de cada plugin. Falhas de transporte também são preservadas
com uma mensagem segura. Credenciais e valores do cofre nunca fazem parte da exportação.

## Histórico de análises

O dashboard mostra o histórico persistido do Supabase e combina essas entradas com os
seis últimos alvos da sessão atual. O histórico mostra horário, tipo e contadores
agregados, permite reutilizar um alvo e não armazena resultados detalhados, credenciais ou
valores do cofre.

## Comandos

- `pnpm dev` — API Fastify e frontend Next.js em modo de desenvolvimento
- `pnpm build` — build de produção dos workspaces (API e Next.js)
- `pnpm typecheck` — validação estática completa
- `pnpm test` — testes automatizados
- `pnpm lint` — análise de qualidade
- `pnpm format:check` — verificação de formatação

Consulte `AGENTS.md` e `PLAN.md` antes de alterar a arquitetura ou adicionar integrações.
