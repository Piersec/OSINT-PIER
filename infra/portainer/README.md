# Portainer para o OSINT Pier

Esta pasta prepara um Portainer CE para administrar, no mesmo host Docker, as
stacks externas que o OSINT Pier usa: Command Tools (Nmap, Katana, Gobuster e
Subfinder), PhoneInfoga e GHunt.

O Portainer usa somente a porta HTTPS `9443`. A porta `8000`, usada por Edge
Agents, não é necessária para este cenário. O socket Docker dá controle
administrativo sobre o host; por isso, mantenha o painel restrito à rede local
ou VPN, use uma senha forte e não abra `9443` na internet.

## 1. Subir o Portainer

No host Docker, a partir da raiz deste repositório:

```text
docker compose -f infra/portainer/docker-compose.yml up -d
```

Abra `https://IP_DO_HOST:9443`. O certificado inicial pode ser autoassinado;
isso é esperado em uma instalação interna. Crie o primeiro usuário com uma
senha forte de pelo menos 12 caracteres.

Como o compose monta `/var/run/docker.sock`, o Portainer deve detectar o Docker
local durante a configuração inicial. Se a tela mostrar o assistente da imagem
anexada, escolha **Docker Standalone → Socket** somente para o host local. Não
ative Docker API em `2375` sem TLS.

## 2. Criar as stacks no Portainer

Em **Stacks → Add stack → Git repository**, use:

```text
Repository URL: https://github.com/Piersec/OSINT-PIER.git
Repository reference: refs/heads/master
```

Informe um diretório local diferente e gravável para cada stack. O caminho do
compose e as variáveis principais são:

| Stack | Compose path | Porta do gateway | Variáveis obrigatórias |
| --- | --- | ---: | --- |
| `osint-command-tools` | `infra/command-tools/docker-compose.yml` | `8080` | `COMMAND_TOOLS_API_TOKEN` |
| `osint-phoneinfoga` | `infra/phoneinfoga/docker-compose.yml` | `8082` | `PHONEINFOGA_API_TOKEN` |
| `osint-ghunt` | `infra/ghunt/docker-compose.yml` | `8083` | `GHUNT_API_TOKEN` |

Para evitar conflito entre elas, informe também estas variáveis no formulário
de cada stack:

```text
COMMAND_TOOLS_GATEWAY_PORT=8080
COMMAND_TOOLS_GATEWAY_BIND_ADDRESS=127.0.0.1
COMMAND_TOOLS_ENABLE_GOBUSTER=false
```

```text
PHONEINFOGA_GATEWAY_PORT=8082
PHONEINFOGA_GATEWAY_BIND_ADDRESS=127.0.0.1
```

```text
GHUNT_GATEWAY_PORT=8083
GHUNT_GATEWAY_BIND_ADDRESS=127.0.0.1
GHUNT_TIMEOUT_SECONDS=105
```

Use um token aleatório diferente para cada gateway, com pelo menos 32
caracteres. Não coloque esses valores no Git. As chaves opcionais do
PhoneInfoga (`NUMVERIFY_API_KEY`, `GOOGLECSE_CX` e `GOOGLE_API_KEY`) também
podem ser adicionadas somente no ambiente da stack quando forem necessárias.

Publique as stacks nesta ordem: Command Tools, PhoneInfoga e GHunt. Os runners
ficam sem porta pública; somente os gateways recebem portas no host.

## 3. Ativar no OSINT Pier

Depois que cada stack estiver saudável, cadastre no cofre do OSINT Pier:

```text
COMMAND_TOOLS_API_URL=https://tools.seu-dominio-interno
COMMAND_TOOLS_API_TOKEN=<mesmo token da stack>

PHONEINFOGA_API_URL=https://phoneinfoga.seu-dominio-interno
PHONEINFOGA_API_TOKEN=<mesmo token da stack>

GHUNT_API_URL=https://ghunt.seu-dominio-interno
GHUNT_API_TOKEN=<mesmo token da stack>
```

As URLs devem apontar para um proxy HTTPS ou túnel autenticado que encaminhe
para `127.0.0.1:8080`, `127.0.0.1:8082` e `127.0.0.1:8083`. Uma URL `192.168.x.x`
funciona apenas dentro da rede local; o backend hospedado na Vercel não consegue
acessar diretamente esse endereço privado. Se o OSINT Pier continuar na Vercel,
use um endpoint HTTPS privado publicado com firewall, autenticação e rate limit.

Para o GHunt, inicialize a sessão apenas no host Docker com a conta autorizada
da investigação. Nunca cole cookies, tokens ou senhas no Portainer ou no cofre
do OSINT Pier.

## 4. Atualizações

As stacks ligadas ao Git podem ser redeployadas pelo Portainer após um push no
repositório. Em cada atualização, verifique os logs do gateway e do runner e
confirme que o token configurado no Portainer continua igual ao token salvo no
cofre do OSINT Pier.

Referências: [instalação do Portainer CE com Docker](https://docs.portainer.io/2.33-lts/start/install-ce/server/docker/linux),
[conexão por socket](https://docs.portainer.io/sts/admin/environments/add/docker/socket) e
[deploy de stacks por Git](https://docs.portainer.io/sts/user/docker/stacks/add).
