---
tokens:
  background: '#080808'
  surface: '#161616'
  surfaceSoft: '#111111'
  surfaceRaised: '#222222'
  border: '#2b2b2b'
  text: '#f5f5f5'
  muted: '#a5a5a5'
  accent: '#9aaaff'
  action: '#2e4bfa'
  success: '#79d99a'
  danger: '#ff8983'
  warning: '#e4ba74'
  fontFamily: Geist, sans-serif
  panelRadius: 12px
  controlRadius: 8px
---

# OSINT Pier — bancada de evidências

## Overview

Direção C escolhida pelo proprietário: [Website Traffic Analytics Dashboard Widgets,
Paperpillar / Dwinawan](https://dribbble.com/shots/27032024-Website-Traffic-Analytics-Dashboard-Widgets).
A estrutura anterior foi substituída: navegação horizontal, conteúdo em largura ampla,
mosaico de informações com tamanhos e apresentações diferentes. Não há sidebar no
aplicativo nem na documentação. O nome e o logotipo fornecido permanecem.

## Colors

Os tokens acima descrevem o tema escuro padrão. Preto separa os módulos; cinzas
organizam superfícies e divisores. Azul identifica ações; verde, vermelho e âmbar
representam estados e séries. Cor acompanha texto ou forma, sem comunicar estado sozinha.
A alternativa clara usa fundo #eeeeec, painéis #ffffff, texto #161616 e bordas #dededb.
Os valores executáveis estão em apps/web/src/piersec-product.css.

## Typography

Geist em toda a interface, carregada pelo Google Fonts. Títulos curtos e compactos,
números com destaque e descrições secundárias. Evitar a tipografia e os rótulos
decorativos da composição anterior. Dados longos devem quebrar linha.

## Layout

Cabeçalho horizontal com marca, quatro áreas de trabalho e acesso à conta. No celular,
as áreas ocupam uma segunda linha. A entrada usa doze colunas: consulta ocupa oito,
disponibilidade quatro; cobertura e categorias dividem a linha intermediária;
histórico recente, relatórios e guia completam a bancada. Em 960px o mosaico usa oito
colunas e em 700px se torna uma sequência vertical. O conteúdo tem largura máxima de
1480px. Documentação usa assuntos horizontais e coluna central de leitura.

## Elevation & Depth

Painéis planos, sem brilhos, gradientes ou sombras decorativas. O contraste entre
fundo e superfície define os módulos. Popovers ficam acima do conteúdo e mantêm
bordas legíveis.

## Shapes

Painéis com raio de 12px e controles com 6–8px. Separadores finos nas listas.
Ícones SVG discretos; logotipos das fontes preservados quando disponíveis.

## Components

- WorkspaceNavigation: navegação superior, ação de nova investigação e menu da conta.
- InvestigationBento: disponibilidade real, cobertura por alvo, categorias e consultas recentes.
- ResultCard e visualizações existentes: evidências progressivas com origem e estado.
- Biblioteca: alvo compartilhado, busca, filtros e ferramentas agrupadas por finalidade.
- Cofre: cadastro, disponibilidade, consumo e configurações de plugins.
- Conta: identidade, senha e MFA em módulos próprios.
- Documentação: busca, assuntos horizontais e seções de leitura.
- Autenticação: formulários no mesmo sistema de cores, fonte e controles.

## Do's and Don'ts

Usar dados do catálogo e do histórico, estados vazios honestos, foco visível e
movimento reduzido. Preservar execução paralela, cancelamento, exportação e contratos.
Não inventar telemetria, séries, resultados ou garantias de segurança. Não recuperar
a sidebar ou a estrutura antiga por conveniência. Não copiar conteúdo fictício da referência.

Pesquisa e adaptações por página: docs/redesign-references.md. Evidências e limites de
validação: design-qa.md.
