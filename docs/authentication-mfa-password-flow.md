# Fluxo genérico de autenticação, MFA e troca de senha

Guia reutilizável para aplicações com área protegida, login por e-mail e senha,
troca obrigatória de senha inicial, autenticação multifator (MFA) e API protegida
por JWT usando Supabase Auth.

## Objetivo

Este documento descreve o comportamento esperado desde a abertura da aplicação até
a autorização de uma chamada ao backend. Ele não inclui cadastro público: as contas
devem ser criadas por um administrador ou por um processo interno controlado.

## Visão geral do fluxo

```text
Usuário abre a aplicação
        |
        v
Existe sessão válida? ---- não ----> Formulário de login
        |                                  |
       sim                                 v
        |                           Login por senha
        v                                  |
Verificar senha inicial                   v
        |                         Senha forte e atualizada?
        |                                  |
        |                         não ----+---- sim
        |                         |              |
        v                         v              v
Avaliar MFA              Modal de troca       Avaliar MFA
        |                 obrigatória              |
        |                                  +-------+-------+
        |                                  |               |
        |                         Sem fator verificado   Fator verificado
        |                                  |               |
        |                                  v               v
        |                         Prompt opcional    Desafio TOTP
        |                         Ativar agora /     challenge + verify
        |                         Ativar mais tarde       |
        |                                  |               v
        +----------------------------------+        Sessão AAL2
                                                   |
                                                   v
                                           Área protegida e API
```

## 1. Abertura da aplicação e restauração da sessão

1. O cliente inicializa o SDK de autenticação com a URL pública do projeto e a
   chave publicável.
2. O SDK restaura uma sessão persistida, quando existir, e renova o access token
   automaticamente enquanto o refresh token continuar válido.
3. Se não houver usuário autenticado, a aplicação mostra somente o formulário de
   login.
4. Não deve existir link ou fluxo de cadastro público quando o acesso for controlado.

Exemplo de configuração no frontend:

```ts
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  },
);
```

## 2. Login

O formulário deve aceitar e-mail e senha e chamar o login por senha:

```ts
const { data, error } = await supabase.auth.signInWithPassword({
  email: email.trim(),
  password,
});
```

Regras importantes:

- não informar se o e-mail existe; use uma mensagem genérica para credenciais
  inválidas;
- bloquear submissões repetidas enquanto a requisição estiver em andamento;
- nunca registrar senha, access token ou refresh token em logs;
- após o login, executar a verificação de senha inicial e MFA antes de liberar a
  área protegida;
- tratar erro de rede separadamente de credencial inválida, sem expor stack trace.

## 3. Troca obrigatória da senha inicial

Contas criadas com senha temporária, fraca ou compartilhada devem ser direcionadas
para um modal bloqueante de troca de senha logo após o login.

### Regras da nova senha

Uma política recomendada é:

- pelo menos 12 caracteres;
- combinação de pelo menos três grupos: maiúsculas, minúsculas, números e símbolos;
- rejeição de senhas comuns, previsíveis ou relacionadas ao nome da aplicação;
- confirmação idêntica à nova senha;
- indicador visual de força com mensagem clara do que falta.

O botão **Sugerir senha forte** pode gerar uma senha aleatória usando `crypto` do
navegador. A senha gerada deve ser exibida apenas para o usuário atual e não deve
ser enviada a nenhum serviço externo.

### Atualização

```ts
const changedAt = new Date().toISOString();

const { error } = await supabase.auth.updateUser({
  password: newPassword,
  data: {
    password_changed_at: changedAt,
  },
});
```

Depois da confirmação do backend de autenticação:

1. limpar os campos do formulário;
2. atualizar o estado local do usuário;
3. fechar o modal;
4. continuar para a avaliação de MFA;
5. informar sucesso sem mostrar a senha na tela ou nos logs.

### Ponto de segurança sobre o sinal de troca

`user_metadata` é útil para a experiência da interface, mas não deve ser usado como
única fonte de autorização: o próprio usuário pode atualizar metadados desse tipo.
Se a troca for realmente obrigatória, mantenha o estado em uma coluna controlada pelo
servidor, por exemplo `password_rotation_required` em uma tabela de perfil, ou em
`app_metadata` atualizado apenas por uma operação administrativa/backend. O
middleware da API deve negar operações protegidas enquanto esse estado estiver ativo.

## 4. Avaliação de MFA após o login

Depois da troca obrigatória de senha, consultar o nível de garantia e os fatores
registrados:

```ts
const [{ data: assurance }, { data: factors }] = await Promise.all([
  supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  supabase.auth.mfa.listFactors(),
]);
```

Considere somente fatores TOTP verificados.

### Usuário sem fator verificado

Mostrar um prompt opcional com duas ações:

- **Ativar agora**: abrir a área de perfil/configurações para iniciar o cadastro;
- **Ativar mais tarde**: fechar o prompt e liberar a sessão atual.

A opção “Ativar mais tarde” deve ser tratada como uma decisão temporária de UX. Se
a política da aplicação exigir MFA, não liberar o acesso apenas porque o usuário
dispensou o prompt.

### Usuário com fator verificado

Se o JWT estiver em AAL1 e existir fator TOTP verificado, exibir a tela de desafio
de seis dígitos. O usuário deve informar o código do aplicativo autenticador:

```ts
const { data: challenge } = await supabase.auth.mfa.challenge({ factorId });

await supabase.auth.mfa.verify({
  factorId,
  challengeId: challenge.id,
  code,
});
```

Somente após `verify` concluir com sucesso a sessão deve ser considerada AAL2 e a
área protegida deve ser liberada.

Se a avaliação de MFA falhar por indisponibilidade do serviço, mostrar uma tela de
erro com **Tentar novamente** e **Sair**. Não liberar silenciosamente uma sessão
quando a política de MFA exige uma verificação que não pôde ser concluída.

## 5. Cadastro de um fator TOTP no perfil

O cadastro deve acontecer em uma área autenticada, nunca em uma tela pública:

1. solicitar ao serviço um novo fator TOTP;
2. exibir QR Code e, como alternativa, a chave secreta para entrada manual;
3. pedir o código atual gerado pelo aplicativo autenticador;
4. criar um challenge;
5. verificar o código;
6. somente então considerar o fator verificado;
7. atualizar a lista de fatores ativos.

Se o usuário cancelar uma inscrição ainda não verificada, remova o fator pendente.
Ao remover um fator ativo, exigir confirmação explícita e informar o impacto na
segurança da conta.

## 6. Proteção do backend com JWT

Cada chamada à API deve enviar o access token da sessão:

```http
Authorization: Bearer <access-token>
```

No backend:

1. extrair o Bearer token;
2. rejeitar chamadas sem token com `401`;
3. validar o token contra o serviço de autenticação usando credencial exclusiva do
   servidor;
4. verificar expiração, assinatura e usuário;
5. quando houver fator TOTP verificado, exigir `aal = aal2`;
6. aplicar também a regra server-side de troca obrigatória de senha, caso exista;
7. só então executar a operação solicitada.

Respostas recomendadas:

| Situação | Resposta |
| --- | --- |
| Bearer ausente ou token inválido | `401 Unauthorized` |
| MFA exigido, mas sessão ainda em AAL1 | `403 Forbidden` |
| Serviço de autenticação indisponível | `503 Service Unavailable` |
| Usuário autorizado | executar a operação |

O frontend nunca deve decidir sozinho se uma chamada protegida pode prosseguir.

## 7. JWT, sessão e expiração

O access token é curto e carrega a autorização da sessão; o refresh token é usado
para obter novos access tokens. Eles têm funções diferentes e não devem ser
confundidos com tokens internos de um gateway ou de uma integração.

A duração do JWT é configurada/verificada no projeto de autenticação hospedado, não
no componente visual do frontend. Se a política for uma hora, confirme no painel de
autenticação que o TTL está configurado para `3600` segundos e valide o comportamento
com um token expirado. O backend deve rejeitar tokens expirados mesmo que a interface
pareça estar aberta.

## 8. Variáveis de ambiente

Use nomes neutros no `.env` de cada aplicação:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>

SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<server-only-key>
```

Regras:

- somente as variáveis com prefixo público podem chegar ao bundle do navegador;
- `SUPABASE_SERVICE_ROLE_KEY` deve existir apenas no backend;
- nunca salvar chaves reais no Git, no `.env.example` ou em documentação;
- preferir o cofre de segredos do provedor de deploy para produção;
- rotacionar imediatamente qualquer chave que tenha sido exposta.

## 9. Checklist de testes

### Login

- [ ] sessão persistida restaura corretamente ao reabrir a aplicação;
- [ ] login válido libera a avaliação pós-login;
- [ ] credencial inválida retorna mensagem genérica;
- [ ] não existe cadastro público;
- [ ] access token é enviado nas chamadas protegidas.

### Troca de senha

- [ ] conta sem marcador de troca vê o modal bloqueante;
- [ ] senha curta, comum ou previsível é rejeitada;
- [ ] **Sugerir senha forte** preenche uma senha válida;
- [ ] confirmação diferente é rejeitada;
- [ ] após atualizar, o modal não reaparece na mesma sessão;
- [ ] o backend também bloqueia a conta enquanto a troca for obrigatória.

### MFA

- [ ] usuário sem fator vê **Ativar agora** e **Ativar mais tarde**;
- [ ] ativação cria e confirma um fator TOTP;
- [ ] código incorreto não libera o acesso;
- [ ] fator verificado exige sessão AAL2;
- [ ] usuário pode remover um fator com confirmação;
- [ ] falha na avaliação oferece tentar novamente e sair.

### Segurança

- [ ] service role nunca aparece no frontend;
- [ ] tokens e senhas não aparecem em logs;
- [ ] JWT expirado é rejeitado pelo backend;
- [ ] `user_metadata` não é usado como autorização única;
- [ ] erros internos não são enviados ao cliente.

## 10. Como reutilizar em outra aplicação

Para adaptar este fluxo:

1. substitua textos, rotas e nomes visuais pelo vocabulário da nova aplicação;
2. mantenha as chamadas do SDK (`signInWithPassword`, `updateUser`, `mfa.enroll`,
   `mfa.challenge` e `mfa.verify`);
3. mova a regra de troca obrigatória para um estado controlado pelo servidor;
4. implemente o middleware JWT no backend da nova aplicação;
5. configure as variáveis de ambiente no provedor de deploy;
6. execute o checklist completo antes de liberar a aplicação.

O fluxo de autenticação pode ser reutilizado, mas cada aplicação deve definir sua
própria política de senha, exigência de MFA, duração de sessão e mensagens para o
usuário.
