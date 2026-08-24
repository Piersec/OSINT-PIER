# Sherlock — decisão de integração

## Status

Avaliação concluída em 24/08/2026 no escopo da issue GAB-69. A execução do Sherlock
não foi adicionada ao backend da Vercel. A integração permanece planejada para um
runner externo, isolado e autenticado.

## O que foi analisado

As referências oficiais consultadas foram:

- [Documentação da CLI](https://github.com/sherlock-project/sherlock/blob/master/docs/README.md)
- [Metadados e dependências do projeto](https://github.com/sherlock-project/sherlock/blob/master/pyproject.toml)
- [Implementação da execução](https://github.com/sherlock-project/sherlock/blob/master/sherlock_project/sherlock.py)
- [Licença MIT](https://github.com/sherlock-project/sherlock/blob/master/LICENSE)

O Sherlock é uma ferramenta Python para procurar um username em várias redes sociais.
O projeto oficial declara Python 3.9 ou superior, versão 0.16.1 no `pyproject.toml` e
licença MIT. A CLI aceita um ou mais usernames e oferece opções de timeout, seleção de
sites, proxy e gravação em TXT, CSV ou XLSX.

O parâmetro `--json` documentado carrega dados de sites; ele não transforma a saída da
execução em uma resposta JSON pronta para o nosso dashboard. Na implementação oficial,
os resultados internos são organizados por rede social e incluem URL, status e outros
metadados de resposta, enquanto a CLI grava relatórios em arquivos.

## Decisão arquitetural

Não executar o Sherlock diretamente dentro de uma rota serverless da Vercel. Essa
abordagem não fornece um runtime Python/dependências controlado nem um worker adequado
para a quantidade variável de requisições externas da ferramenta. Também dificultaria
cancelamento, limite de concorrência, observabilidade e isolamento de falhas.

A implementação futura deve seguir este fluxo:

```text
Dashboard autenticado
        |
        | HTTPS + token interno + username validado
        v
Runner Sherlock isolado (Python/Docker)
        |
        | resultados curados, sem stdout bruto
        v
Plugin Sherlock no backend
        |
        v
Presença + URL por serviço
```

O runner deverá:

- executar uma versão fixada do pacote em imagem ou ambiente Python reproduzível;
- aceitar somente usernames individuais e consultas autorizadas;
- impor timeout por execução, limite de concorrência e cancelamento;
- impedir que proxy, cookies, tokens ou stdout bruto sejam devolvidos ao dashboard;
- devolver um contrato JSON pequeno, versionado e autenticado;
- tratar indisponibilidade de rede, rate limit e falso positivo por serviço;
- evitar persistência por padrão, especialmente de respostas HTML e dados de sessão.

## Contrato planejado do plugin

Quando houver runner hospedado e autorizado, o plugin deverá declarar:

```ts
supportedTargetKinds: ['username']
requiredEnv: ['SHERLOCK_RUNNER_URL', 'SHERLOCK_RUNNER_TOKEN']
```

O resultado público deverá conter somente campos curados, por exemplo:

```json
{
  "username": "exemplo",
  "found": 2,
  "sites": [
    { "name": "GitHub", "url": "https://github.com/exemplo" },
    { "name": "Reddit", "url": "https://www.reddit.com/user/exemplo" }
  ]
}
```

Não devem ser expostos nem persistidos: resposta bruta do site, cookies, proxy,
headers privados, stdout completo, arquivos temporários ou credenciais do runner.

## Dependências para retomar a implementação

Antes de escrever o adapter, o projeto precisa ter:

1. um host para o runner Python/Docker;
2. URL HTTPS privada e token de serviço rotacionável;
3. política de autorização para usernames e uso das redes consultadas;
4. limites operacionais definidos para timeout, concorrência e rate limit;
5. endpoint do runner com contrato JSON e health check;
6. smoke test em ambiente de homologação.

Sem esses itens, adicionar apenas uma chamada local para `sherlock` criaria uma
integração que funciona no desenvolvimento e falha ou fica insegura em produção.
