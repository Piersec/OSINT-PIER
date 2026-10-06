# Substituição do Shodan por InternetDB — 2026-10-06

## Escopo

Substituir o plugin pago/restrito por Shodan InternetDB gratuito e sem chave,
conforme pedido do proprietário. Mantido id `shodan` para preservar flags e
compatibilidade do catálogo; novo label `Shodan InternetDB` e requiredEnv vazio.
Sem Docker adicional, sem assinatura e sem alteração das outras integrações.

## Contrato

- Resolve domínio/URL para o primeiro IPv4 público; IPv6-only e endereços privados
  são pulados sem transmissão ao serviço.
- GET https://internetdb.shodan.io/{ip}, sem chave ou Authorization, timeout 10 s.
- Curadoria limitada de portas observadas, hostnames, tecnologias CPE e possíveis
  CVEs. CVEs não são achados confirmados nem entram no gráfico do Nuclei.
- 404 significa sem dados, nunca ausência comprovada de exposição/vulnerabilidades.
- Erros de cota, rede e respostas incompletas tratados isoladamente.
- Cache e execução paralela existentes são reaproveitados.

Referência: https://book.shodan.io/developer-apis/internetdb/

## Validação e entrega

8 testes específicos aprovados, incluindo ausência de chave, 404, 429, payload
incompleto e bloqueio de IP privado. Typecheck da API aprovado.
Typecheck web e build API aprovados. Suíte completa: 102 testes aprovados no
reteste; a primeira execução teve timeout no teste de autenticação já observado
em etapas anteriores. Publicação e smoke pendentes.

Credencial antiga identificada exclusivamente pelo nome SHODAN_API_KEY no cofre
Supabase doqnyijzaogqiwkuygcs, sem leitura de ciphertext ou segredo.
Exclusão ainda pendente. Não remover credenciais de outras ferramentas.

PLAN.md, README e documentação de frontend têm mudanças anteriores e foram
preservados. Linear dispensado explicitamente. Esta entrega trata a substituição
da integração da Fase 7, sem alterações de design.
