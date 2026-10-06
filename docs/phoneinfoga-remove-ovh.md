# Remoção OVH e revisão Apify — 2026-10-06

Pedido: remover OVH do OSINT Pier e continuar a revisão das ferramentas restantes.
O plugin PhoneInfoga deixa de executar/renderizar OVH; local e googlesearch ficam,
e Numverify/Google CSE continuam opcionais. Imagem oficial e Docker preservados.

Branch isolada da master: a troca InternetDB pendente não está nesta entrega.
Arquivos exclusivos: plugin PhoneInfoga, seus testes e este relatório. PLAN.md e
documentação web já alterados foram preservados; Linear dispensado pelo usuário.

Validação: 12 testes específicos PhoneInfoga/Apify aprovados e typecheck API
aprovado. Regressão verifica que não existe chamada OVH nem campo OVH no resultado.
Erro de um scanner restante continua isolado. Publicação/smoke ainda pendentes.

Revisão Apify, sem executar Actors: três plugins usam guard de saldo e bloqueiam
planos não FREE, saldo desconhecido e uso >=80% por padrão. LinkedIn define teto
de evento USD0.01 e Google Places USD0.05. Sherlock é pay-per-usage e não tem teto
de execução configurado; não afirmar que a guarda de percentual elimina todos os
custos. Concorrência e execução já iniciada podem ultrapassar o limiar preventivo.

Fontes oficiais:
- https://apify.com/misceres/sherlock
- https://docs.apify.com/actors/running/actors-in-store

Próximo passo Apify: confirmar limites adequados ao modelo de cada Actor, antes de
teste real. Nenhum custo, assinatura ou execução externa foi iniciado nesta revisão.
