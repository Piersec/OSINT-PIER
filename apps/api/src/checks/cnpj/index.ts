import { z } from 'zod';
import { normalizeCnpj } from '@osint-pier/contracts';
import type { CheckPlugin } from '../../core/checks/contract.js';
import { failure, success } from '../../core/checks/results.js';

const id = 'cnpj';
const source = 'BrasilAPI / Minha Receita';
const text = z.string().max(1000).nullable().optional();
const CompanySchema = z.object({
  cnpj: z.string(),
  razao_social: z.string().trim().min(1).max(1000),
  nome_fantasia: text,
  descricao_situacao_cadastral: text,
  data_inicio_atividade: text,
  cnae_fiscal_descricao: text,
  municipio: text,
  uf: text,
  porte: text,
  natureza_juridica: text,
});

const check: CheckPlugin = {
  id,
  label: 'Consulta de CNPJ',
  requiredEnv: [],
  supportedTargetKinds: ['cnpj'],
  timeoutMs: 10_000,
  async run(target, context) {
    const cnpj = target.kind === 'cnpj' ? normalizeCnpj(target.value) : null;
    if (!cnpj) return failure(id, source, 'Informe um CNPJ válido.');
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
      const parsed = CompanySchema.safeParse(await response.json());
      if (!parsed.success || normalizeCnpj(parsed.data.cnpj) !== cnpj) {
        return failure(
          id,
          source,
          'A fonte retornou dados incompletos ou de outro CNPJ.',
        );
      }
      const company = parsed.data;
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
