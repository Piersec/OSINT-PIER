import type { CheckPlugin } from '../../core/checks/contract.js';
import { failure, success } from '../../core/checks/results.js';

function validCheckDigits(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  for (const length of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(cpf[i]) * (length + 1 - i);
    const digit = (sum * 10) % 11;
    if (Number(cpf[length]) !== (digit === 10 ? 0 : digit)) return false;
  }
  return true;
}

const check: CheckPlugin = {
  id: 'cpf',
  label: 'CPF — validação local',
  requiredEnv: [],
  supportedTargetKinds: ['cpf'],
  timeoutMs: 1_000,
  async run(target) {
    if (target.kind !== 'cpf' || !/^\d{11}$/.test(target.value))
      return failure(
        'cpf',
        'Validação matemática local',
        'Informe um CPF com 11 dígitos.',
      );
    return success('cpf', 'Validação matemática local — sem consulta externa', {
      'CPF mascarado': `***.***.***-${target.value.slice(-2)}`,
      'Dígitos verificadores': validCheckDigits(target.value)
        ? 'Válidos matematicamente'
        : 'Inválidos',
      'Situação cadastral': 'Não consultada',
      'Limites da validação':
        'Não confirma existência, titularidade ou regularidade na Receita Federal. Não retorna nome, endereço ou data de nascimento.',
      'Consulta oficial':
        'https://www.gov.br/pt-br/servicos/consultar-cadastro-de-pessoas-fisicas',
      'Como consultar':
        'Abra o serviço oficial e informe seus dados quando solicitado. Login ou CAPTCHA, quando exigidos, devem ser realizados por você. Nenhum CPF é enviado automaticamente ao portal.',
      Privacidade:
        'Validação no backend do OSINT Pier, sem provedor externo, sem cache de resultado e sem histórico persistente.',
    });
  },
};

export default check;
