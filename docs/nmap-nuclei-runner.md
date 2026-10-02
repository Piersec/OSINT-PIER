# Nmap e Nuclei no Umbrel

## Estado em 2026-10-02

- Gateway Command Tools encontrado parado (exit 137); reiniciado. Inspect após
  início: running, OOMKilled=false. A causa do encerramento anterior não foi
  preservada nos logs; o código sozinho não comprova falta de memória.
- Nmap 7.95 instalado no runner; teste TCP local retornou XML válido.
- Runner /healthz e gateway /healthz retornaram 200.
- Stack ativa reconstruída com Nuclei v3.11.1, templates v10.4.9 e Nmap 7.95.
  Runner e gateway retornaram 200 em /healthz; gateway rejeitou POST sem token com 401.
- Testes autorizados no site com piersec.com.br: Nmap retornou sucesso em 2255 ms
  após a atualização; Nuclei concluiu com zero achados no perfil config-exposures.
  Teste direto do runner também retornou HTTP 200, exitCode 0 e zero achados.
- Backend publicado em produção na Vercel, commit a5e3271, deployment
  dpl_E1UiRL9Kdm8LDvaFJgf3V9NakgYQ READY (alias osint-pier.vercel.app).
- Validação local: 99 testes da API, typecheck, lint dos arquivos alterados e quatro
  testes Python aprovados. Consulta de logs error/fatal desse deployment sem registros.
- Primeira reconstrução ultrapassou o limite do Portainer (DeadlineExceeded),
  preservando os contêineres anteriores. O build foi ajustado para copiar Nuclei
  da imagem oficial versionada, sem compilar suas dependências no Umbrel.
- A segunda tentativa completou as outras ferramentas, mas atingiu o timeout antes
  dos templates; Portainer restaurou a versão anterior. Após terminar a restauração,
  nova implantação aproveitou o cache e concluiu. Nenhum serviço pago foi ativado.
- PLAN.md e demais documentos já modificados localmente foram preservados; o registro
  desta entrega fica neste documento para não misturar alterações preexistentes.

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
