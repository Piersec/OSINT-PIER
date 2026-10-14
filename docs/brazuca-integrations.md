# Fontes brasileiras e Consulta de CNPJ

## Escopo

- `osint-brazuca`: catálogo inicial de nove referências, selecionadas do OSINT
  Brazuca na revisão `c5596fd157bdbfecad8a9571245556cd3348b3df`. Filtra por tipo
  de alvo e entrega links estáticos para consulta manual. Não acessa portais,
  preenche formulários nem envia o alvo. As classificações heurísticas do catálogo
  original foram revistas para este recorte. Licença em `osint-brazuca-LICENSE.txt`.
- `cnpj`: consulta unitária server-side em
  `https://brasilapi.com.br/api/cnpj/v1/{cnpj}`, sem chave e sem plano pago.
  Usa timeout de 10 segundos, cache/rate limit existentes e nenhum retry automático.
  Não faz enumeração de CNPJs. Trata 400, 401/403, 404, 429, 5xx e falhas de rede.
  Identifica o cliente como `OSINT-Pier/1.0` no User-Agent; a consulta pública
  retornou 403 com o identificador genérico do Node e 200 com a identificação
  transparente da aplicação. Não usa cookies, autenticação ou simulação de navegador.

## Alvo e resultado

O contrato aceita `cnpj`, com ou sem pontuação, em formato numérico ou alfanumérico.
A validação compartilhada de módulo 11 roda no backend antes de qualquer consulta.
CNPJ numérico de 14 dígitos tem precedência sobre telefone; telefones internacionais
devem usar `+`. Um identificador alfanumérico compacto só é inferido como CNPJ se os
dígitos verificadores forem válidos, preservando usernames comuns.

O card mostra razão social, CNPJ, situação cadastral e município/UF primeiro;
os demais campos cadastrais ficam na expansão genérica. Não exporta CPF, quadro de
sócios, representantes, telefone ou e-mail da resposta original. Dados podem estar
desatualizados; ausência na fonte não comprova inexistência da empresa.

A migração amplia somente a restrição de tipo do histórico; RLS e grants permanecem
como estavam. O histórico pode guardar o CNPJ e contadores, seguindo o contrato
existente, mas não recebe a resposta cadastral detalhada.

## Fontes verificadas

- https://github.com/osintbrazuca/osint-brazuca
- https://github.com/osintbrazuca/osint-brazuca/blob/c5596fd157bdbfecad8a9571245556cd3348b3df/data/sources.json
- https://github.com/BrasilAPI/BrasilAPI/blob/main/pages/docs/doc/cnpj.json
- https://github.com/BrasilAPI/BrasilAPI/blob/main/services/cnpj.js
- https://github.com/BrasilAPI/BrasilAPI#termos-de-uso

BrasilAPI documenta o endpoint aberto, mas não publica uma cota numérica garantida
nesses documentos. O serviço pede que não sejam feitos crawling ou consultas em massa.
Nenhuma integração aqui exige Docker, Apify ou configuração de cobrança.

## Validação da entrega

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
