# GHunt — integração

## Status

O GHunt foi integrado ao catálogo como uma checagem server-side para alvos do tipo
e-mail. A consulta depende de um gateway externo; sem `GHUNT_API_URL` o plugin retorna
`skipped` e não cria um card de erro.

## Referências oficiais

- [README do GHunt](https://github.com/mxrch/GHunt/blob/master/README.md)
- [Código do módulo de e-mail](https://github.com/mxrch/GHunt/blob/master/ghunt/modules/email.py)
- [Metadados e versão 2.3.4](https://github.com/mxrch/GHunt/blob/master/pyproject.toml)
- [Licença AGPL-3.0](https://github.com/mxrch/GHunt/blob/master/LICENSE.md)

O GHunt oficial declara Python 3.10 ou superior, exportação JSON e os módulos `email`,
`gaia`, `drive`, `geolocate` e `spiderdal`. A integração atual habilita somente o módulo
de e-mail, que é o alvo compatível com o formulário do OSINT Pier.

## Arquitetura

```text
Dashboard autenticado
        |
        | POST /api/v2/email + token interno
        v
Gateway HTTPS privado (infra/ghunt/gateway)
        |
        v
Runner Python/Docker com GHunt 2.3.4
        |
        | volume privado .malfrats/ghunt
        v
Sessão Google configurada localmente
```

A Vercel não executa Python, não inicia o processo GHunt e não recebe cookies. O token
de `GHUNT_API_TOKEN` autentica somente o gateway. A sessão Google fica no volume do
runner e nunca é cadastrada no cofre do OSINT Pier.

## Dados exibidos

O runner reduz o JSON oficial para:

- e-mail consultado e indicação de conta encontrada;
- nome, Gaia ID, última atualização e foto de perfil;
- tipo de entidade e serviços Google detectados;
- sinais booleanos de perfil no Play Games, avaliações no Maps e calendário público.

Não são devolvidos nem persistidos cookies, tokens, eventos de calendário, HTML, stdout,
arquivos temporários, contatos ou o JSON bruto do GHunt.

## Ativação

Consulte [`infra/ghunt/README.md`](../infra/ghunt/README.md) para subir o gateway,
configurar a sessão autorizada e publicar a URL HTTPS. Depois:

1. configure `GHUNT_API_URL` no ambiente do backend, sem `/api` no final;
2. salve `GHUNT_API_TOKEN` na página Credenciais;
3. habilite GHunt no catálogo;
4. informe um e-mail autorizado no campo de análise.

O login do GHunt deve ser feito no terminal interativo do runner, usando uma conta de
investigação autorizada. Nunca cole cookies no painel, em commits, no Vercel ou no
Supabase.

## Limites e operação

- o plugin aceita apenas e-mails;
- timeout do plugin: 90 segundos;
- timeout do processo externo: 105 segundos;
- sessão inválida retorna uma mensagem de reautenticação, sem diagnóstico sensível;
- indisponibilidade do gateway, rate limit e falhas externas são isolados do restante da
  análise;
- o pacote oficial fica em container separado, sob AGPL-3.0, sem código do GHunt copiado
  para o backend.
