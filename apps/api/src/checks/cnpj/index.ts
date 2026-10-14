import type { CheckPlugin } from '../../core/checks/contract.js';
import { failure, success } from '../../core/checks/results.js';

const id = 'cnpj';
const source = 'BrasilAPI / Minha Receita';
// Dynamic checks must load using only the compiled API files copied to Vercel.
function companyData(
  input: unknown,
  cnpj: string,
): Record<string, string> | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const payload = input as Record<string, unknown>;
  if (
    typeof payload.cnpj !== 'string' ||
    payload.cnpj.replace(/[./-]/g, '').toUpperCase() !== cnpj
  )
    return null;
  const company: Record<string, string> = {};
  for (const key of [
    'razao_social',
    'nome_fantasia',
    'descricao_situacao_cadastral',
    'data_inicio_atividade',
    'cnae_fiscal_descricao',
    'municipio',
    'uf',
    'porte',
    'natureza_juridica',
  ]) {
    const value = payload[key];
    if (value === null || value === undefined) continue;
    if (typeof value !== 'string' || value.length > 1000) return null;
    company[key] = value.trim();
  }
  return company.razao_social ? company : null;
}

const check: CheckPlugin = {
  id,
  label: 'Consulta de CNPJ',
  requiredEnv: [],
  supportedTargetKinds: ['cnpj'],
  timeoutMs: 10_000,
  async run(target, context) {
    // The executor supplies a checksum-validated NormalizedTarget; keep a local
    // shape guard without importing a package at the dynamic module boundary.
    const cnpj = target.value;
    if (
      target.kind !== 'cnpj' ||
      !/^[A-Z0-9]{12}[0-9]{2}$/.test(cnpj) ||
      /^(\d)\1{13}$/.test(cnpj)
    ) {
      return failure(id, source, 'Informe um CNPJ válido.');
    }
    try {
      const response = await fetch(
        `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`,
        {
          signal: context.signal,
          redirect: 'error',
          headers: {
            accept: 'application/json',
            'user-agent':
              'OSINT-Pier/1.0 (+https://github.com/Piersec/OSINT-PIER)',
          },
        },
      );
      if (response.status === 404) {
        return success(id, source, {
          cnpj,
          encontrado: false,
          observacao:
            'CNPJ não encontrado nesta fonte. Isso não comprova que a empresa não existe.',
        });
      }
      if (!response.ok) {
        const error =
          response.status === 429
            ? 'Limite da BrasilAPI atingido. Aguarde antes de tentar novamente.'
            : response.status === 400
              ? 'A BrasilAPI rejeitou o formato deste CNPJ.'
              : response.status === 401 || response.status === 403
                ? 'A BrasilAPI restringiu o acesso a esta consulta.'
                : 'Consulta de CNPJ temporariamente indisponível.';
        return failure(id, source, error);
      }
      const company = companyData(await response.json(), cnpj);
      if (!company) {
        return failure(
          id,
          source,
          'A fonte retornou dados incompletos ou de outro CNPJ.',
        );
      }
      return success(id, source, {
        razao_social: company.razao_social,
        cnpj,
        situacao_cadastral:
          company.descricao_situacao_cadastral || 'Não informada',
        municipio_uf:
          [company.municipio, company.uf].filter(Boolean).join(' / ') ||
          'Não informado',
        nome_fantasia: company.nome_fantasia || 'Não informado',
        inicio_atividade: company.data_inicio_atividade || 'Não informado',
        atividade_principal: company.cnae_fiscal_descricao || 'Não informada',
        porte: company.porte || 'Não informado',
        natureza_juridica: company.natureza_juridica || 'Não informada',
        observacao:
          'Dados cadastrais da base consultada; podem estar desatualizados. Confirme a situação atual na Receita Federal.',
      });
    } catch {
      return failure(
        id,
        source,
        'Não foi possível consultar a BrasilAPI. Tente novamente mais tarde.',
      );
    }
  },
};

export default check;
