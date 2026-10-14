import type { CheckPlugin } from '../../core/checks/contract.js';
import { failure, success } from '../../core/checks/results.js';

const id = 'cnpj';
const source = 'Minha Receita';

function details(input: Record<string, unknown>): Record<string, unknown> {
  // Explicit allowlists: never forward arbitrary provider fields or CPF values.
  const strings = [
    'descricao_identificador_matriz_filial',
    'data_situacao_cadastral',
    'descricao_motivo_situacao_cadastral',
    'situacao_especial',
    'data_situacao_especial',
    'descricao_tipo_de_logradouro',
    'logradouro',
    'numero',
    'complemento',
    'bairro',
    'cep',
    'pais',
    'nome_cidade_no_exterior',
    'email',
    'ddd_telefone_1',
    'ddd_telefone_2',
    'ddd_fax',
    'data_opcao_pelo_simples',
    'data_exclusao_do_simples',
    'data_opcao_pelo_mei',
    'data_exclusao_do_mei',
    'ente_federativo_responsavel',
  ];
  const numbers = [
    'capital_social',
    'cnae_fiscal',
    'codigo_municipio_ibge',
    'codigo_natureza_juridica',
    'identificador_matriz_filial',
  ];
  const output: Record<string, unknown> = {};
  for (const key of strings) {
    const value = input[key];
    if (typeof value === 'string' && value.trim() && value.length <= 1000)
      output[key.replaceAll('_', ' ')] = value.trim();
  }
  for (const key of numbers) {
    const value = input[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0)
      output[key.replaceAll('_', ' ')] = value;
  }
  for (const key of ['opcao_pelo_simples', 'opcao_pelo_mei']) {
    const value = input[key];
    if (typeof value === 'boolean') output[key.replaceAll('_', ' ')] = value;
  }
  const lists: Record<string, string[]> = {
    cnaes_secundarios: ['codigo', 'descricao'],
    qsa: [
      'nome_socio',
      'qualificacao_socio',
      'data_entrada_sociedade',
      'pais',
      'nome_representante_legal',
      'qualificacao_representante_legal',
    ],
    regime_tributario: [
      'ano',
      'cnpj_da_scp',
      'forma_de_tributacao',
      'quantidade_de_escrituracoes',
    ],
  };
  for (const [key, fields] of Object.entries(lists)) {
    const list = input[key];
    if (!Array.isArray(list)) continue;
    const limit = 200;
    output[
      key === 'qsa' ? 'Sócios e administradores' : key.replaceAll('_', ' ')
    ] = list.slice(0, limit).flatMap((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
      const row: Record<string, string | number> = {};
      for (const field of fields) {
        const value = (item as Record<string, unknown>)[field];
        if (typeof value === 'string' && value.trim() && value.length <= 1000)
          row[field.replaceAll('_', ' ')] = value.trim();
        else if (
          typeof value === 'number' &&
          Number.isFinite(value) &&
          value >= 0
        )
          row[field.replaceAll('_', ' ')] = value;
      }
      return Object.keys(row).length ? [row] : [];
    });
    if (list.length > limit)
      output[`${key} itens adicionais não exibidos`] = list.length - limit;
  }
  return output;
}
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
        `https://minhareceita.org/${cnpj}`,
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
            ? 'Limite da Minha Receita atingido. Aguarde antes de tentar novamente.'
            : response.status === 400
              ? 'A Minha Receita rejeitou o formato deste CNPJ.'
              : response.status === 401 || response.status === 403
                ? 'A Minha Receita restringiu o acesso a esta consulta.'
                : 'Consulta de CNPJ temporariamente indisponível.';
        return failure(id, source, error);
      }
      const payload: unknown = await response.json();
      const company = companyData(payload, cnpj);
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
        'Dados cadastrais complementares': details(
          payload as Record<string, unknown>,
        ),
        observacao:
          'Dados cadastrais públicos da base consultada; podem estar desatualizados. Contatos e endereço são os cadastrados pela empresa, não confirmação de contato atual. Capital social não é faturamento. CPFs não são exibidos. Confirme a situação atual na Receita Federal.',
      });
    } catch {
      return failure(
        id,
        source,
        'Não foi possível consultar a Minha Receita. Tente novamente mais tarde.',
      );
    }
  },
};

export default check;
