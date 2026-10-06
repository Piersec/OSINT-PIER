# PhoneInfoga: formato REST — 2026-10-06

## Escopo

Corrigir somente a serialização do telefone na API e nos scanners. Preservar o
formato internacional apresentado ao usuário, as credenciais, o gateway e a rede.
Linear dispensado pelo proprietário; PLAN.md contém mudanças locais anteriores e
foi preservado. Não registrar o telefone autorizado neste relatório.

## Evidência

O teste pelo site retornou a mensagem segura de rejeição do telefone (HTTP 400
tratado pelo plugin), antes de executar os scanners. O plugin enviava `+` no campo
number. Os handlers oficiais da API informam que a entrada deve ser numérica,
sem caracteres especiais, tanto em numbers quanto em scanners.

Fontes oficiais:
- https://github.com/sundowndev/phoneinfoga/blob/master/web/v2/api/handlers/numbers.go
- https://github.com/sundowndev/phoneinfoga/blob/master/web/v2/api/handlers/scanners.go

## Alteração e validação

- Serializar somente dígitos em ambos os endpoints, sem alterar o alvo ou o E.164
  retornado para a interface.
- Testes verificam o body inicial, todos os scanners e as opções de credenciais
  opcionais, além de manter a apresentação internacional.
- 4 testes específicos aprovados; typecheck da API aprovado.
- Publicação e reteste real ainda pendentes. Não considerar a causa confirmada
  no ambiente instalado até que a nova versão passe pelo teste real.
- Nenhuma ativação de serviço pago ou alteração Docker necessária nesta correção.
