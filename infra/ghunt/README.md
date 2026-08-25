# GHunt externo

Esta stack mantém o GHunt oficial em um runner Python separado da API do OSINT
Pier. O gateway valida `Authorization: Bearer` e encaminha somente a rota curada
`POST /api/v2/email`.

O runner usa GHunt 2.3.4, Python 3.13 e um volume privado para a sessão do Google.
O volume nunca é enviado ao Git, ao Supabase ou ao frontend. A ferramenta oficial
é licenciada sob AGPL-3.0; mantenha o pacote em container separado e revise as
obrigações da licença antes de distribuir a imagem.

## Subir o serviço

1. Copie `env.example` para `.env`.
2. Gere um token aleatório com pelo menos 32 caracteres e coloque-o em
   `GHUNT_API_TOKEN`.
3. Execute `docker compose up -d --build`.
4. Inicialize a sessão do runner de forma interativa:

   ```text
   docker compose run --rm --entrypoint ghunt runner login
   ```

   Use somente uma conta de investigação autorizada. O GHunt Companion ou os
   cookies devem ser usados apenas no terminal local/interativo do runner; nunca
   cole cookies no painel do OSINT Pier ou em variáveis do Vercel.
5. Publique o gateway `:8080` atrás de HTTPS e mantenha a porta interna `8081`
   fora da rede pública.
6. Configure `GHUNT_API_URL` no ambiente do backend com a URL HTTPS do gateway,
   sem o sufixo `/api`.
7. Salve o mesmo token em `GHUNT_API_TOKEN` na página **Credenciais**.

## Verificação

O health check não usa a sessão:

```text
GET /healthz
```

Para testar o adapter, use uma requisição autenticada e um e-mail autorizado:

```text
POST /api/v2/email
Authorization: Bearer <GHUNT_API_TOKEN>
Content-Type: application/json

{"email":"conta-autorizada@example.com"}
```

O retorno do runner contém apenas presença, nome, Gaia ID, última atualização,
foto de perfil, serviços e sinais resumidos de Play Games, Maps e Calendar. Não
são devolvidos cookies, tokens, respostas brutas, eventos de calendário, contatos,
HTML, stdout ou arquivos temporários.

## Limites

- O plugin só aceita alvos do tipo e-mail.
- Ausência de `GHUNT_API_URL` faz o check retornar `skipped`.
- Sessão inválida retorna atenção e exige reautenticação local no runner.
- O timeout do plugin é de 90 segundos; o processo externo é cancelado após 105
  segundos.
- Não registre o token, cookies, e-mails consultados ou respostas completas nos logs.
