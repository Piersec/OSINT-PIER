# Autenticação interna

O OSINT Pier usa o Supabase Auth somente para login por e-mail e senha.

- Não existe formulário de cadastro no frontend.
- Não existe login social ou anônimo.
- O backend valida o access token do Supabase antes de liberar checks, histórico e painel administrativo.
- A `service_role key` permanece somente no ambiente do backend.

## Variáveis do frontend

Configure no ambiente `Development` e `Production` do Vercel:

```env
NEXT_PUBLIC_SUPABASE_URL=https://doqnyijzaogqiwkuygcs.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

A chave legada `anon` também é aceita usando `NEXT_PUBLIC_SUPABASE_ANON_KEY`, mas a publishable key é preferível para novos projetos.

## Variáveis do backend

Mantenha no ambiente do backend/Vercel, sem o prefixo `NEXT_PUBLIC_`:

```env
SUPABASE_URL=https://doqnyijzaogqiwkuygcs.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
```

Essas variáveis também habilitam o histórico persistente. Nunca coloque a service role key no navegador, no Git ou no `.env.sample` com valor real.

## Usuários

Crie os usuários manualmente em `Authentication → Users` no projeto Supabase. O frontend não chama `signUp()`.

Para bloquear também tentativas externas de cadastro pela API do Supabase, desative `Allow new users to sign up` em `Authentication → Providers → Email`.

Depois de alterar as variáveis do Vercel, faça um novo deploy. A aplicação deve mostrar a tela de login para visitantes sem sessão e o dashboard somente depois de uma sessão válida.
