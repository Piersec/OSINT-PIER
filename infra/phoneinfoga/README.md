# PhoneInfoga externo

Esta stack executa a imagem oficial do PhoneInfoga e mantém a porta do serviço
interno fora da rede pública. O gateway Node valida `Authorization: Bearer` antes
de encaminhar somente as rotas `/api/*` para o PhoneInfoga.

A API oficial do PhoneInfoga é stateless e disponibiliza REST em `/api`. O serviço
é executado sem o cliente web porque o OSINT Pier já possui o dashboard próprio.

## Subir o serviço

1. Copie `env.example` para `.env`.
2. Gere um token aleatório com pelo menos 32 caracteres e coloque-o em
   `PHONEINFOGA_API_TOKEN`.
3. Execute `docker compose up -d`.
4. Publique o gateway `:8080` atrás de HTTPS em um domínio privado. Não publique
   a porta interna do serviço `phoneinfoga:5000`.
5. No backend do OSINT Pier, configure `PHONEINFOGA_API_URL` com a URL HTTPS do
   gateway, sem acrescentar `/api`.
6. Na página **Credenciais** do OSINT Pier, salve o mesmo token em
   `PHONEINFOGA_API_TOKEN`.

As chaves opcionais `NUMVERIFY_API_KEY`, `GOOGLECSE_CX` e `GOOGLE_API_KEY` podem
ser cadastradas na página **Credenciais**. O adapter as envia apenas no request
server-side do scanner correspondente; elas nunca chegam ao navegador.

## Verificação

O endpoint de saúde do gateway não consulta o PhoneInfoga:

```text
GET /healthz
```

Para verificar o serviço oficial, use uma requisição autenticada ao gateway:

```text
GET /api/
Authorization: Bearer <PHONEINFOGA_API_TOKEN>
```

Não registre o token, números de telefone ou respostas completas nos logs. O
PhoneInfoga é GPL-3.0; mantenha a imagem oficial separada do código proprietário
e revise as obrigações da licença antes de distribuir a solução.
