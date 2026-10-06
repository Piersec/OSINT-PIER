# Command Tools: diagnóstico e correção — 2026-10-06

## Evidências em produção

- Nmap e Nuclei responderam em `piersec.com.br`.
- Katana respondeu com indisponibilidade após aproximadamente 42 segundos.
- Diagnóstico direto no contêiner: Katana encerrou com código 0 em 40,8 segundos,
  mas produziu 7.732.545 bytes; o runner rejeitava saídas acima de 2 MiB.
- Subfinder isolado excedeu o limite após aproximadamente 56 segundos.
- O runner aceita duas execuções simultâneas e rejeitava as demais imediatamente.
- Logs do gateway e runner estavam vazios; stderr não deve ser exposto.

## Correção preparada

- Subfinder mantém enumeração de 1 minuto, recebe timeout de 70 segundos no runner
  e 90 segundos no plugin, com timeout de 5 segundos por fonte e coleta de fontes.
- Até quatro chamadas podem aguardar uma vaga por no máximo 10 segundos;
  o limite de duas execuções ativas e o isolamento de rede permanecem intactos.
- Katana desativa verificações automáticas de atualização, limita cada resposta a
  1 MiB e restringe o crawl ao mesmo hostname. A saída é consumida progressivamente
  e o processo para ao atingir 200 linhas, conservando os resultados curados.
  O teto de 2 MiB permanece ativo, e outras falhas não viram sucesso vazio.
- Diagnóstico contém apenas ferramenta, duração, código de saída e tamanho de saída.
  Não registra alvo, argumentos, stdout, stderr ou credenciais.

## Entrega

Correção local; publicação e teste real ainda pendentes. Sem alteração de plano pago,
tokens, políticas Cloudflare ou stacks PhoneInfoga. PLAN.md preservado porque já
continha alterações locais anteriores. Linear dispensado pelo proprietário.
