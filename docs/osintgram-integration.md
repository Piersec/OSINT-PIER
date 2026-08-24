# Osintgram — decisão de integração

## Status

Avaliação concluída em 24/08/2026 no escopo da issue GAB-65. O Osintgram não foi
adicionado ao backend nem ao deployment. A decisão atual é não integrar a ferramenta
sem uma alternativa de autenticação autorizada, um runner isolado e uma revisão de
licença/termos de uso.

## O que foi analisado

Referências oficiais consultadas:

- [Repositório e README](https://github.com/Datalux/Osintgram)
- [Dependências](https://github.com/Datalux/Osintgram/blob/master/requirements.txt)
- [Licença GPL-3.0](https://github.com/Datalux/Osintgram/blob/master/LICENSE)

O projeto se apresenta como uma ferramenta Python com shell interativo para análise de
contas do Instagram por username. O README lista comandos para informações de perfil,
seguidores, seguidos, hashtags, comentários, usuários marcados, fotos, foto de perfil e
stories. Também inclui comandos que tentam obter e-mails e telefones de seguidores e
seguidos, o que ultrapassa o escopo curado de presença/URL que cabe no dashboard.

As dependências oficiais incluem `instagram-private-api==1.6.0` e `hikerapi==1.7.1`.
O README orienta configurar uma conta e senha em `config/credentials.ini` ou usar um
`HIKERAPI_TOKEN`. Isso significa que a operação depende de uma sessão/credencial de
terceiro, e não de uma API pública simples que possa ser cadastrada no cofre sem
revisão adicional.

O próprio README recomenda não usar a conta principal, informa que perfis privados não
podem ser acessados e documenta o erro `challenge_required` quando o Instagram detecta
comportamento suspeito. O repositório está sob GPL-3.0; qualquer distribuição ou
incorporação de código exigiria avaliação de compatibilidade e das obrigações da licença.

## Decisão

Não executar o Osintgram dentro da API ou de uma função serverless da Vercel. A CLI é
interativa, depende de runtime Python, credenciais de login e arquivos de configuração/
saída. Um `child_process` local criaria comportamento diferente entre desenvolvimento
e produção e aumentaria o risco de vazamento de sessão ou bloqueio da conta.

Também não será copiado código do projeto para o backend. A integração não deve usar a
conta do usuário, guardar senha do Instagram, receber cookies no frontend ou coletar
seguidores, contatos, mídia e stories automaticamente.

## Condições para uma retomada

Uma futura integração só poderá ser reavaliada se houver:

- autorização explícita para consultar as contas e as redes envolvidas;
- definição de uma fonte suportada e compatível com os termos aplicáveis;
- runner Python/Docker separado, privado e autenticado;
- token ou sessão temporária armazenado exclusivamente no cofre, sem exposição ao cliente;
- limites de concorrência, timeout, rate limit, cancelamento e retenção mínima;
- curadoria limitada a username, presença, URL e metadados não sensíveis;
- revisão da licença GPL-3.0 antes de distribuir qualquer componente derivado.

Se essas condições forem atendidas, o plugin deverá declarar `supportedTargetKinds:
['username']` e tratar ausência de credencial como `skipped`. O runner deverá devolver
somente um contrato JSON curado; respostas brutas, HTML, cookies, credenciais, stdout,
arquivos de mídia e listas de contatos não devem chegar ao dashboard nem ao histórico.

## Resultado

Nenhum plugin, variável de ambiente ou credencial foi adicionado nesta etapa. A issue
GAB-65 pode ser encerrada como avaliação concluída, mantendo a decisão de não integrar
até que as condições acima sejam aprovadas.
