# Revisão visual — direção C

Data: 15/10/2026. Disposição final da revisão independente: **ship**.

## Critério de aceite

Substituir a composição anterior do site inteiro pela direção C selecionada.
A exigência posterior de remover a sidebar é obrigatória: aplicativo e documentação
agora possuem navegação horizontal. O shell anterior foi retirado do App.

Referência: [Paperpillar / Dwinawan — Website Traffic Analytics Dashboard Widgets](https://dribbble.com/shots/27032024-Website-Traffic-Analytics-Dashboard-Widgets).
Adaptação de linguagem visual e composição para funções reais de OSINT; não é uma
reprodução dos gráficos, métricas ou conteúdo da referência.

## Evidências locais

Capturas em `.impeccable/review/`, ignoradas pelo Git:

- `reference-c.png`: referência pública com origem em docs/redesign-references.md.
- `comparison-c.png`: referência e bancada lado a lado para inspeção.
- `analysis-1440.png`, `analysis-390.png`: bancada sem sidebar.
- `{results,history,credentials,profile,settings,docs,login}-{1440,390}.png`:
  demais áreas nas mesmas larguras.
- `report-{1440,390}.png`: análise com evidências e visualizações.
- `capture-report.json`: 16 capturas, sem overflow horizontal e sem erros de página.
- `interaction-report.json`: atalhos de categoria, resultados, disponibilidade da
  exportação, reutilização do histórico, tema persistido e busca na documentação.

As capturas usam os componentes da aplicação em servidor isolado com autenticação e
respostas sintéticas. Não validam serviços externos ou login/MFA de produção. Nenhum
alvo real foi consultado para produzir esses registros. Credenciais reais não foram usadas.

## Correções verificadas

Navegação lateral retirada do aplicativo e da documentação; cabeçalhos separam título
e descrição; busca e ícones têm dimensões próprias; seções de documentação usam
coluna de largura correta; gráficos distribuem-se sem trilhas vazias; celular não
gera rolagem horizontal. A revisão independente posterior não identificou defeitos
materiais P0/P1/P2 remanescentes.

## Validação de código

- `pnpm --filter @osint-pier/web test`: 14 arquivos, 36 testes aprovados.
- `pnpm lint`: aprovado.
- `pnpm --filter @osint-pier/web build`: aprovado, incluindo TypeScript e geração de páginas.
- `pnpm --filter @osint-pier/web typecheck`: aprovado antes da rodada final; o build
  também verificou os últimos ajustes da documentação.

O redesign mantém contratos, execução, autenticação e integrações existentes.
Publicação em produção e integração na master não fazem parte desta validação local.
