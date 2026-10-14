# Fontes brasileiras e Consulta de CNPJ

## Escopo

- `osint-brazuca`: catálogo inicial de nove referências, selecionadas do OSINT
  Brazuca na revisão `c5596fd157bdbfecad8a9571245556cd3348b3df`. Filtra por tipo
  de alvo e mantém referências separadas. Querido Diário recebe nome/CNPJ para
  consulta pública unitária (até cinco publicações, um trecho de 350 caracteres).
  As demais fontes estão identificadas como manuais ou disponíveis em outro plugin;
  não são apresentadas como resultados coletados. Não preenche formulários.
  As classificações heurísticas do catálogo
  original foram revistas para este recorte. Licença em `osint-brazuca-LICENSE.txt`.
- `cnpj`: consulta unitária server-side diretamente em
  `https://minhareceita.org/{cnpj}`, sem chave e sem plano pago.
  Usa timeout de 10 segundos, cache/rate limit existentes e nenhum retry automático.
  Não faz enumeração de CNPJs. Trata 400, 401/403, 404, 429, 5xx e falhas de rede.
  Identifica o cliente como `OSINT-Pier/1.0` no User-Agent. A Minha Receita é a
  mesma origem usada pelo endpoint CNPJ da BrasilAPI; a consulta direta remove
  o intermediário que falhou na validação de produção. Não usa cookies,
  autenticação ou simulação de navegador.

## Alvo e resultado

O contrato aceita `cnpj`, com ou sem pontuação, em formato numérico ou alfanumérico.
A validação compartilhada de módulo 11 roda no backend antes de qualquer consulta.
CNPJ numérico de 14 dígitos tem precedência sobre telefone; telefones internacionais
devem usar `+`. Um identificador alfanumérico compacto só é inferido como CNPJ se os
dígitos verificadores forem válidos, preservando usernames comuns.

O card mostra razão social, CNPJ, situação cadastral e município/UF primeiro;
os demais campos cadastrais ficam na expansão genérica: endereço, contatos cadastrados,
capital social (não faturamento), CNAEs, situação, matriz/filial, Simples/MEI,
regime tributário e nomes/qualificações/datas do quadro societário. Não exporta CPF
de sócios ou representantes. Campos ausentes não são inventados; listas possuem teto
de 200 itens com contagem explícita de excedentes. Dados podem estar
desatualizados; ausência na fonte não comprova inexistência da empresa.

O resumo de quatro campos permanece. O botão `Ver mais detalhes` revela os demais
campos retornados e `Ver menos detalhes` os recolhe, com estado acessível
`aria-expanded`. A expansão de listas longas continua independente.

A migração amplia somente a restrição de tipo do histórico; RLS e grants permanecem
como estavam. O histórico pode guardar o CNPJ e contadores, seguindo o contrato
existente, mas não recebe a resposta cadastral detalhada.

## Fontes verificadas

- https://github.com/osintbrazuca/osint-brazuca
- https://github.com/osintbrazuca/osint-brazuca/blob/c5596fd157bdbfecad8a9571245556cd3348b3df/data/sources.json
- https://github.com/BrasilAPI/BrasilAPI/blob/main/pages/docs/doc/cnpj.json
- https://github.com/BrasilAPI/BrasilAPI/blob/main/services/cnpj.js
- https://docs.minhareceita.org/
- https://github.com/BrasilAPI/BrasilAPI#termos-de-uso

Minha Receita documenta uma API pública sem garantia de disponibilidade. A consulta
continua unitária, com cache, sem crawling ou consultas em massa.
Nenhuma integração aqui exige Docker, Apify ou configuração de cobrança.

Querido Diário: especificação pública verificada em
`https://api.queridodiario.org.br/openapi.json`; o endereço legado
`queridodiario.ok.org.br/api` redireciona para esse host. A integração usa o host
canônico com `redirect: error`, timeout do plugin, cache existente e nenhum retry.
Consulta CNPJ pontuado e sem pontuação; nomes são tratados como frases literais.
Falhas/cota da fonte são exibidas separadamente sem apagar as referências manuais.
Até cinco documentos são exibidos; menção não confirma identidade/vínculo e ausência
não comprova inexistência. Não baixa documentos nem realiza consultas em massa.
Referência de uso: https://docs.queridodiario.ok.org.br/pt-br/latest/utilizando/api-publica.html

Escopo desta ampliação: não adiciona consulta de CPF, planos pagos, scraping do INPI,
Receita Federal ou ReceitaWS, nem dependência entre resultados de plugins.

## Validação da entrega

- Correção de 2026-10-14: consulta direta à mesma origem da BrasilAPI. O plugin
  compilado retornou `success` em consulta autorizada, com situação e município
  preenchidos. O identificador usado na validação não é registrado no repositório.
  Os 13 testes do CNPJ e 12 testes das rotas da API passaram, assim como lint,
  verificação de tipos e build completo do monorepo.
- Contratos: 22 testes aprovados; API: 114; frontend: 33.
- Após ajustar User-Agent, os dez testes do CNPJ passaram novamente e a chamada
  real do plugin compilado retornou `success` para o exemplo público da documentação.
- Lint, build e verificação de tipos aprovados. Em uma cópia limpa, o typecheck
  do frontend exige compilar primeiro a API, cujo export aponta para `dist`.
- Migração aplicada no projeto `doqnyijzaogqiwkuygcs`, versão
  `20261014143126`. Restrição consultada após a aplicação e inserção CNPJ
  verificada em transação revertida; RLS continua habilitada.
- O advisor não apontou problema na tabela alterada. Retornou avisos existentes
  sobre `check_settings` sem política RLS e proteção de senhas vazadas desabilitada;
  essas configurações não foram alteradas nesta entrega.
- A primeira publicação encontrou ausência de `zod` na fronteira de importação
  dinâmica da Vercel. A produção anterior foi restaurada durante o reparo.
  O plugin agora valida a resposta com código local, sem imports de pacotes em
  runtime; a validação de CNPJ compartilhada continua no normalizador da API.
- Verificação isolada: ambos os novos módulos carregaram e o CNPJ executou com
  resposta simulada em diretório temporário sem `node_modules`; 13 testes dos
  plugins/registro, compilação da API e lint passaram após o reparo.
