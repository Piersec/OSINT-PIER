import { afterEach, describe, expect, it, vi } from 'vitest';
import check from './index.js';
import { normalizeTarget } from '../../core/target/normalize-target.js';

const target = normalizeTarget('00.000.000/0001-91');
const context = { signal: new AbortController().signal, credentials: {} };
afterEach(() => vi.restoreAllMocks());

describe('Consulta de CNPJ', () => {
  it('consulta uma vez o endpoint fixo e devolve somente campos curados', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({
        cnpj: target.value,
        razao_social: 'Empresa de exemplo',
        descricao_situacao_cadastral: 'ATIVA',
        municipio: 'SANTOS',
        uf: 'SP',
        qsa: [{ cpf_representante_legal: 'não exportar' }],
        email: 'não exportar',
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
