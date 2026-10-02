# Nmap e Nuclei no Umbrel

## Estado em 2026-10-02

- Gateway Command Tools encontrado parado (exit 137); reiniciado. Inspect após
  início: running, OOMKilled=false. A causa do encerramento anterior não foi
  preservada nos logs; o código sozinho não comprova falta de memória.
- Nmap 7.95 instalado no runner; teste TCP local retornou XML válido.
- Runner /healthz e gateway /healthz retornaram 200.
- Nuclei ainda requer reconstrução da imagem e publicação do backend desta branch.
  Não declarar integração de produção concluída antes do teste ponta a ponta.
- Teste autorizado no site com piersec.com.br: Nmap retornou sucesso em 2035 ms.
- Primeira reconstrução ultrapassou o limite do Portainer (DeadlineExceeded),
  preservando os contêineres anteriores. O build foi ajustado para copiar Nuclei
  da imagem oficial versionada, sem compilar suas dependências no Umbrel.

## Integração preparada

Nuclei usa POST /api/v1/scan no mesmo gateway autenticado de Command Tools.
O backend resolve COMMAND_TOOLS_API_TOKEN pelo cofre e envia também os headers
Cloudflare Access. Sem URL remota, o modo CLI local continua disponível.

A imagem fixa Nuclei v3.11.1 e templates v10.4.9. A execução usa somente templates
HTTP assinados previamente revisados (Git, Laravel .env, phpinfo e Docker Compose),
bloqueia rede privada e desativa Interactsh, atualizações automáticas,
fuzzing, brute force, headless e default-login. Limites: 20 requisições/s,
concorrência 3 e 70 segundos por execução. O resultado explicita que não é uma
varredura completa de CVEs. Expandir o perfil depende de revisar templates e
dimensionar tempo/fila de execução; não usar todo o catálogo nesta rota síncrona.
Timeout/falha não são apresentados como ausência de vulnerabilidades.

Os achados enviados ao backend excluem requests/responses, cookies e templates
brutos. O plugin conserva enriquecimento NVD/EPSS/KEV e o renderer existente.
O gateway permite respostas de até 2 MiB, sem truncar JSON silenciosamente.

Nmap mantém TCP connect top 100 sem scripts ou detecção de versão. O perfil
explicita --unprivileged; nomes de serviço por porta não são versões verificadas.

## Validação e implantação

1. Testes Python: executar unittest na pasta infra/command-tools/runner.
2. Testes API e typecheck.
3. Reconstruir imagem runner e gateway da stack ativa, preservando token, porta
   127.0.0.1:18080 e network_mode: service:runner. Não alterar Tunnel compartilhado.
4. Verificar versões, templates instalados, /healthz e autenticação (401 sem token).
5. Publicar backend após o runner aceitar nuclei.
6. Testar pelo site apenas contra ativo autorizado. Nmap/Nuclei não usam uma API paga,
   mas consomem recursos do Umbrel e requisições do bridge já existente.
