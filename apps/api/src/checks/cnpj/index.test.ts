import { afterEach, describe, expect, it, vi } from 'vitest';
import check from './index.js';
import { normalizeTarget } from '../../core/target/normalize-target.js';

const target = normalizeTarget('00.000.000/0001-91');
const context = { signal: new AbortController().signal, credentials: {} };
afterEach(() => vi.restoreAllMocks());

describe('Consulta de CNPJ', () => {
  it('expõe quadro societário sem CPF e limita listas explicitamente', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({
        cnpj: target.value,
        razao_social: 'Empresa',
        qsa: [
          {
            nome_socio: 'Sócio de exemplo',
            qualificacao_socio: 'Administrador',
            cpf_representante_legal: '12345678909',
            cnpj_cpf_do_socio: '12345678909',
          },
        ],
        cnaes_secundarios: Array.from({ length: 201 }, () => ({
          codigo: 1,
          descricao: 'Atividade',
        })),
      }),
    );
    const result = await check.run(target, context);
    const data = result.data as Record<string, Record<string, unknown>>;
    const extra = data['Dados cadastrais complementares'];
    expect(extra['Sócios e administradores']).toEqual([
      {
        'nome socio': 'Sócio de exemplo',
        'qualificacao socio': 'Administrador',
      },
    ]);
    expect(extra['cnaes secundarios']).toHaveLength(200);
    expect(extra['cnaes_secundarios itens adicionais não exibidos']).toBe(1);
    expect(JSON.stringify(result)).not.toContain('12345678909');
  });
  it('consulta uma vez o endpoint fixo e devolve somente campos curados', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({
        cnpj: target.value,
        razao_social: 'Empresa de exemplo',
        descricao_situacao_cadastral: 'ATIVA',
        municipio: 'SANTOS',
        uf: 'SP',
        qsa: [{ cpf_representante_legal: 'não exportar' }],
        email: 'contato@example.com',
        capital_social: 0,
        opcao_pelo_simples: false,
        cnaes_secundarios: [
          {
            codigo: 6204000,
            descricao: 'Consultoria',
            segredo: 'não exportar',
          },
        ],
      }),
    );
    const result = await check.run(target, context);
    expect(result).toMatchObject({
      status: 'success',
      data: { razao_social: 'Empresa de exemplo', municipio_uf: 'SANTOS / SP' },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://brasilapi.com.br/api/cnpj/v1/00000000000191',
      expect.objectContaining({
        redirect: 'error',
        signal: context.signal,
        headers: expect.objectContaining({
          'user-agent':
            'OSINT-Pier/1.0 (+https://github.com/Piersec/OSINT-PIER)',
        }),
      }),
    );
    expect(JSON.stringify(result)).not.toContain('não exportar');
    expect(result.data).toMatchObject({
      'Dados cadastrais complementares': {
        email: 'contato@example.com',
        'capital social': 0,
        'opcao pelo simples': false,
        'cnaes secundarios': [{ codigo: 6204000, descricao: 'Consultoria' }],
      },
    });
  });

  it.each([400, 401, 403, 429, 500])(
    'trata HTTP %s sem vazar a resposta',
    async (status) => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('private provider details', { status }),
      );
      const result = await check.run(target, context);
      expect(result.status).toBe('error');
      expect(JSON.stringify(result)).not.toContain('private provider details');
      if (status === 429) expect(result.error).toContain('Limite');
    },
  );

  it('distingue ausência na fonte de uma empresa inexistente', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 404 }),
    );
    expect(await check.run(target, context)).toMatchObject({
      status: 'success',
      data: { encontrado: false },
    });
  });

  it('rejeita dados de outro CNPJ', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({ cnpj: '19131243000197', razao_social: 'Outra empresa' }),
    );
    expect((await check.run(target, context)).status).toBe('error');
  });

  it('trata erro de rede', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('private error'));
    const result = await check.run(target, context);
    expect(result.status).toBe('error');
    expect(result.error).not.toContain('private error');
  });

  it('não envia um CNPJ inválido ao provedor', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    expect(
      (await check.run({ ...target, value: '00000000000000' }, context)).status,
    ).toBe('error');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
