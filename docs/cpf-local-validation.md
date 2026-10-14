# CPF — validação local

Plugin `cpf`, sem chave, Docker, assinatura ou consulta a terceiros. Aceita onze
dígitos ou `000.000.000-00`. Formato CPF tem precedência sobre telefone; use `+55`
para telefones. `@` preserva usernames numéricos. A normalização valida o formato;
o plugin calcula os dois dígitos verificadores e rejeita sequências repetidas.
Uma operação bem-sucedida pode informar dígitos inválidos: `success` indica execução,
não existência do documento. Não confirma titularidade, cadastro ou regularidade.

O resultado mostra somente CPF mascarado e orientação para consulta manual no serviço
oficial. Não envia CPF nos links, não pede nascimento e não contorna login/CAPTCHA.
O backend faz o cálculo em memória. CPF não passa pelo cache de checks; análises CPF
não entram no histórico ou sessionStorage. O contrato do endpoint de histórico
recusa gravações do tipo CPF; nenhuma migração ou ampliação de acesso no banco.
O CPF permanece no campo da aba durante o uso. Exportação explícita do relatório
continua podendo incluir o alvo digitado; guarde esse arquivo com cuidado.

Fonte oficial: https://www.gov.br/pt-br/servicos/consultar-cadastro-de-pessoas-fisicas
Integração automática Serpro não foi ativada (exige contratação).

Escopo: fase 7, aprovado no chat; Linear dispensado pelo proprietário. Arquivos
exclusivos: plugin CPF, contratos/normalizador e seus testes; rótulos do App/manual,
proteções de cache e persistência do novo tipo. Sem alterações de Auth/RLS/credenciais.
