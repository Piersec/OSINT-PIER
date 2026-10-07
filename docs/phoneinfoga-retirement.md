# Retirada do PhoneInfoga — 2026-10-07

Retirada solicitada pelo proprietário. O plugin e seus testes foram removidos;
o catálogo dinâmico deixa de oferecer a ferramenta após o deploy. O Sherlock
planejado duplicado foi removido, preservando a integração Apify.

As alterações locais existentes no PLAN.md e na documentação foram preservadas.
Recursos operacionais exclusivos a conferir antes da remoção: stack
`osint-phoneinfoga`, seus dois contêineres, URL e token PHONEINFOGA.
Preservar Command Tools, Worker, túnel e credenciais Cloudflare compartilhados.
A infraestrutura de referência e a rota do bridge permanecem até a limpeza
operacional verificada; não considerar essa etapa como remoção completa.

Não apagar chaves opcionais Google/Numverify sem confirmar outros consumidores.
Osintgram permanece explicitamente planejado, não instalado.
