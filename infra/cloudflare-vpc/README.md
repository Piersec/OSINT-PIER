# Cloudflare Workers VPC bridge

Esta stack conecta um túnel **novo e separado** ao loopback do Umbrel para que o
Worker em `workers.dev` alcance somente os três gateways OSINT já existentes.
Ela não publica hostnames, não abre portas de entrada e não altera o túnel
Cloudflare `Server Umbrel`.

## Topologia e limites

```text
Vercel (backend)
  └─ HTTPS + Cloudflare Access Service Token
       └─ Worker `osint-pier-api-bridge` em workers.dev
            └─ Workers VPC (3 serviços HTTP com host/porta fixos)
                 └─ novo cloudflared no Umbrel, em rede host
                      ├─ 127.0.0.1:18080  Command Tools
                      ├─ 127.0.0.1:18082  PhoneInfoga
                      └─ 127.0.0.1:18083  GHunt
```

O túnel usa conexões de saída QUIC em UDP 7844. `network_mode: host` é usado
porque os gateways estão vinculados a `127.0.0.1`; não altere esse bind para
`0.0.0.0`. Não há `ports`, socket Docker, montagem de arquivos do host ou rota
de hostname público nesta stack. O código do Worker permite somente os métodos
e endpoints usados pelos plugins existentes e mantém os corpos em streaming.

Workers VPC está em beta. `workers.dev` não é recomendado pela Cloudflare para
serviços business-critical; esta opção é a alternativa sem domínio próprio e
deve ser reavaliada quando houver um domínio Cloudflare disponível.

## Provisionamento

1. Na conta Cloudflare **Rhuan Marcos**, crie um túnel novo pela área Workers
   VPC. Não selecione nem edite `Server Umbrel`. Copie o token do túnel apenas
   para a variável `CLOUDFLARE_VPC_TUNNEL_TOKEN` da nova stack Portainer.
2. No Portainer, adicione somente `osint-pier-workers-vpc` com o diretório
   `infra/cloudflare-vpc`. As três stacks de API existentes já estão em execução:
   não as recrie nem as atualize nesta etapa. Confira nos logs que o novo
   conector está conectado e usando QUIC.
3. Implante primeiro um Worker bootstrap sem `vpc_services`, usando
   `wrangler.bootstrap.jsonc.template` como `wrangler.jsonc`. As rotas permitidas
   responderão `503` por falta de bindings; nenhum gateway privado estará
   conectado ainda.
4. Crie uma aplicação Cloudflare Access para o hostname exato do Worker
   `workers.dev`, com política **Service Auth** e um service token dedicado.
   Não proteja todos os Workers da conta nem altere regras globais. Faça isso
   antes de anexar os serviços VPC ao Worker.
5. Crie três serviços VPC HTTP associados somente ao túnel novo:
   - `127.0.0.1:18080`, serviço `command-tools`;
   - `127.0.0.1:18082`, serviço `phoneinfoga`;
   - `127.0.0.1:18083`, serviço `ghunt`.
6. Copie os IDs retornados para `wrangler.jsonc`, substituindo os três
   marcadores de `wrangler.jsonc.template`; nunca coloque o token do túnel no
   arquivo. Implante novamente `src/index.js`. O Access já estará ativo antes
   de os bindings privados existirem.
7. Configure no ambiente **Production** do projeto Vercel:
   - `CLOUDFLARE_ACCESS_CLIENT_ID` e `CLOUDFLARE_ACCESS_CLIENT_SECRET`;
   - `COMMAND_TOOLS_API_URL=https://osint-pier-api-bridge.<subdominio>.workers.dev/command-tools`;
   - `PHONEINFOGA_API_URL=https://osint-pier-api-bridge.<subdominio>.workers.dev/phoneinfoga`;
   - `GHUNT_API_URL=https://osint-pier-api-bridge.<subdominio>.workers.dev/ghunt`.
8. Faça novo deploy do Vercel. Os bearer tokens próprios dos gateways continuam
   no cofre criptografado existente e são enviados separadamente; o segredo do
   Cloudflare Access fica somente no ambiente server-side do Vercel.

Não habilite as URLs Vercel antes do Worker final estar implantado, com os três
bindings e Access Service Auth ativos. O token do túnel é credencial de conexão:
não o registre no Git, em screenshots, logs ou mensagens.
