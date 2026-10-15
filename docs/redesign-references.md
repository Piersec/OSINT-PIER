# OSINT Pier — direção visual C

## Referência selecionada

O proprietário selecionou a opção **C**, após pedir uma substituição completa do visual do site: [Website Traffic Analytics Dashboard Widgets — Dwinawan / Paperpillar](https://dribbble.com/shots/27032024-Website-Traffic-Analytics-Dashboard-Widgets).

[Imagem pública da referência](https://cdn.dribbble.com/userupload/46551354/file/81c77dcc7461ae8daa7c4770e12328ac.png).

A referência define uma bancada escura e compacta: conteúdo domina cada módulo, números têm hierarquia clara e cada tipo de informação recebe uma apresentação própria. Preto no fundo, painéis cinza-escuros, texto branco, azul nas ações e cores semânticas em estados e séries. Ela orienta a composição; seus números, gráficos de marketing, pessoas e funcionalidades não pertencem ao OSINT Pier.

## Aplicação por área

| Área         | Composição implementada                                                                                                                                          |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entrada      | Campo de consulta compacto; disponibilidade, cobertura de tipos de alvo, categorias de ferramentas, consultas recentes e formatos de relatório no mesmo mosaico. |
| Resultados   | Resumo numérico, visualizações existentes derivadas das evidências e painéis com largura adequada ao tipo de resultado.                                          |
| Ferramentas  | Busca, filtros e catálogo compacto agrupado por finalidade.                                                                                                      |
| Histórico    | Lista de consultas, datas e contadores agregados com ação de reutilizar o alvo.                                                                                  |
| Credenciais  | Formulário, estado das chaves, consumo e disponibilidade dos plugins em grupos operacionais.                                                                     |
| Perfil       | Identidade, senha e MFA como módulos independentes.                                                                                                              |
| Aparência    | Seleção explícita entre a bancada escura padrão e sua alternativa clara.                                                                                         |
| Login e MFA  | Formulários de acesso no mesmo sistema de superfícies, tipografia e controles.                                                                                   |
| Documentação | Busca, navegação por assunto, leitura em coluna e orientação contextual.                                                                                         |

Os dados dos novos módulos vêm do catálogo e do histórico existentes. Falhas de rede e estados vazios são apresentados explicitamente. A fonte é Geist. O logotipo PierSec fornecido pelo projeto foi preservado.

Por orientação obrigatória posterior do proprietário, a sidebar foi retirada da estrutura do aplicativo e da documentação. As áreas do produto ficam no topo; os assuntos da documentação usam links horizontais. O novo shell e os cabeçalhos têm componentes próprios, sem as classes de layout do shell anterior.

## Pesquisa e acesso

Dribbble, Behance e o [catálogo web do Mobbin](https://mobbin.com/discover/apps/web) foram pesquisados. O Mobbin exigiu login para os fluxos internos; algumas páginas do Behance retornaram 403. Essas telas não foram tratadas como evidência inspecionada. A seleção final foi a referência pública do Paperpillar acima.

## Validação visual

As capturas locais em `.impeccable/review/` usam componentes reais com autenticação e respostas de API sintéticas em um servidor isolado de revisão. Elas validam apresentação e interações, sem consultar alvos reais ou alterar autenticação e integrações de produção. A referência externa foi guardada nesse diretório exclusivamente para comparação visual, com a origem registrada acima.
