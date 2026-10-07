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

## Limpeza operacional confirmada

- A stack `osint-phoneinfoga` e seus dois contêineres foram removidos do Portainer.
- Removidos do cofre Supabase `PHONEINFOGA_API_TOKEN` e `SHODAN_API_KEY`.
  Consulta posterior confirmou zero registros para essas duas chaves e
  `PHONEINFOGA_API_URL` (esta última já não estava no cofre).
- A remoção dos registros do cofre é permanente; novos tokens precisam ser
  cadastrados caso essas integrações sejam reativadas.
- A rota PhoneInfoga no bridge e seu binding de referência ainda estão presentes
  no código. Sua limpeza e a verificação das variáveis na Vercel estão pendentes.
- Nenhum segredo foi lido. Credenciais opcionais Google/Numverify e recursos
  compartilhados foram preservados.
