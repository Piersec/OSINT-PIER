# Command tools — integração controlada

## Status

Nmap, Katana, Gobuster e Subfinder foram adicionados como checks independentes. Eles
não rodam no processo da API nem na Vercel: o backend chama somente o gateway HTTPS
autenticado em `COMMAND_TOOLS_API_URL`.

Esta integração é destinada a ativos para os quais a equipe tem autorização explícita.
O runner rejeita alvos locais/privados, não aceita shell ou flags vindas do cliente,
limita concorrência e devolve dados curados em vez de stdout.

## Arquitetura

```text
Dashboard autenticado
        |
        | POST /api/v1/scan + token interno
        v
Gateway HTTPS privado (infra/command-tools/gateway)
        |
        v
Runner Docker isolado com Nmap, Katana, Gobuster e Subfinder
```

O request aceito pelo gateway tem exatamente este formato:

```json
{
  "tool": "nmap | katana | gobuster | subfinder",
  "target": "alvo normalizado",
  "profile": "safe"
}
```

Não há campo para comando, argumentos, wordlist, headers, cookies, proxy ou script.

## Perfis ativos

| Ferramenta | Alvos | Perfil | Resultado curado |
| --- | --- | --- | --- |
| Nmap | domínio, IP e URL | TCP connect, top 100, `--version-light`, somente abertos | hosts, portas, serviço e versão |
| Katana | domínio e URL | profundidade 2, crawl de 45 s, 3 workers, 20 req/s | URL, método, status e content type |
| Subfinder | domínio e URL | descoberta passiva, sem modo ativo | subdomínios e fontes |
| Gobuster | domínio e URL | diretório limitado, wordlist interna de 32 entradas, 4 threads | caminho, status e tamanho |

Nmap não usa NSE, UDP, OS detection, `-A`, full scan ou rede CIDR. Katana não usa
headless, JavaScript crawl, formulários, armazenamento de respostas ou corpos. Gobuster
não aceita recursão, extensões, headers customizados, wordlists externas ou modos DNS,
vhost, fuzz, S3 e cloud.

Gobuster fica desligado por padrão no Compose. Para habilitá-lo, defina
`COMMAND_TOOLS_ENABLE_GOBUSTER=true` somente em um runner sob controle da equipe.

## Subir o runner

No host que executará as ferramentas:

```bash
cd infra/command-tools
cp env.example .env
docker compose build
docker compose up -d
```

O gateway expõe `/healthz` e `/api/v1/scan`. Publique o gateway atrás de HTTPS, firewall
e uma allowlist de origem/rede. O serviço `runner` não publica porta para a internet.

Depois, no backend/Vercel:

1. configure `COMMAND_TOOLS_API_URL` com a URL HTTPS do gateway, sem `/api` no final;
2. salve o mesmo `COMMAND_TOOLS_API_TOKEN` na página Credenciais;
3. habilite os quatro checks no catálogo;
4. execute somente domínios, URLs ou IPs autorizados.

## Segurança e limites

- o gateway exige um Bearer token com pelo menos 32 caracteres;
- o runner aceita no máximo duas execuções simultâneas;
- cada processo possui timeout próprio e grupos de processo são encerrados no timeout;
- bodies e stdout possuem limite; stderr nunca é enviado ao cliente;
- respostas brutas, banners, corpos HTTP, cookies e credenciais não chegam ao dashboard;
- containers usam usuário sem privilégios, filesystem somente leitura, `tmpfs` e
  `no-new-privileges`;
- o alvo não pode ser loopback, privado, link-local, multicast, reservado ou
  `host.docker.internal`.

## Próximos candidatos

`httpx` e `dnsx` são os próximos candidatos naturais para enriquecer probing HTTP e
resolução DNS. `tlsx` e `naabu` exigem uma revisão operacional adicional antes de entrar
no runner. Eles permanecem fora desta entrega para que cada novo perfil seja revisado,
limitado e documentado separadamente.

## Referências oficiais

- [Nmap Reference Guide](https://nmap.org/book/man.html)
- [Subfinder Usage](https://docs.projectdiscovery.io/opensource/subfinder/usage)
- [Katana Usage](https://docs.projectdiscovery.io/opensource/katana/usage)
- [Gobuster](https://github.com/OJ/gobuster)
