# Retirada do PhoneInfoga — 2026-10-07

Retirada solicitada pelo proprietário. O plugin e seus testes foram removidos;
o catálogo dinâmico deixa de oferecer a ferramenta após o deploy. O Sherlock
planejado duplicado foi removido, preservando a integração Apify.

As alterações locais existentes no PLAN.md e em documentações não relacionadas
foram preservadas. Preservar Command Tools, Worker, túnel e credenciais Cloudflare
compartilhados.

Não apagar chaves opcionais Google/Numverify sem confirmar outros consumidores.
Osintgram permanece explicitamente planejado, não instalado.

## Limpeza operacional confirmada

- A stack `osint-phoneinfoga` e seus dois contêineres foram removidos do Portainer.
- Removidos do cofre Supabase `PHONEINFOGA_API_TOKEN` e `SHODAN_API_KEY`.
  Consulta posterior confirmou zero registros para essas duas chaves e
  `PHONEINFOGA_API_URL` (esta última já não estava no cofre).
- A remoção dos registros do cofre é permanente; novos tokens precisam ser
  cadastrados caso essas integrações sejam reativadas.
- A rota e o binding do PhoneInfoga foram removidos do código e do template
  Wrangler. A publicação do Worker continua pendente, pois a sessão Cloudflare
  está desconectada.
- `PHONEINFOGA_API_URL` e `PHONEINFOGA_API_TOKEN` foram removidas das variáveis
  Production na Vercel. O filtro do painel ficou sem resultados e a nova produção
  `dpl_DKeYw42771or1NjZiAgGFobWruqh` ficou `READY` no commit atual da master.
- Os arquivos de implantação do PhoneInfoga e o ícone foram removidos do código.
- Nenhum segredo foi lido. Credenciais opcionais Google/Numverify e recursos
  compartilhados foram preservados.
