import { afterEach, expect, it, vi } from 'vitest';
import check from './index.js';
import { normalizeTarget } from '../../core/target/normalize-target.js';
import { AnalysisHistoryWriteSchema } from '@osint-pier/contracts';

afterEach(() => vi.restoreAllMocks());
const context = { signal: new AbortController().signal, credentials: {} };

it('valida os dígitos sem rede, sem CPF completo e sem alegar situação regular', async () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch');
  const result = await check.run(normalizeTarget('123.456.789-09'), context);
  expect(result.status).toBe('success');
  expect(result.data).toMatchObject({
    'CPF mascarado': '***.***.***-09',
    'Dígitos verificadores': 'Válidos matematicamente',
    'Situação cadastral': 'Não consultada',
  });
  expect(JSON.stringify(result)).not.toContain('12345678909');
  expect(fetchMock).not.toHaveBeenCalled();
});

it.each(['00000000000', '11111111111', '12345678900', '12345678908'])(
  'identifica dígitos inválidos em %s',
  async (value) => {
    const result = await check.run(normalizeTarget(value), context);
    expect(result.data).toMatchObject({ 'Dígitos verificadores': 'Inválidos' });
  },
);

it('mantém telefone internacional e username explícito distintos do CPF', () => {
  expect(normalizeTarget('+5513997221735').kind).toBe('phone');
  expect(normalizeTarget('@12345678909').kind).toBe('username');
  expect(normalizeTarget('12345678909').kind).toBe('cpf');
  expect(() => normalizeTarget('123.456.789/09', 'cpf')).toThrow();
});

it('recusa formato inválido em execução direta', async () => {
  expect(
    (
      await check.run(
        {
          original: 'invalid',
          value: 'invalid',
          hostname: 'invalid',
          kind: 'cpf',
        },
        context,
      )
    ).status,
  ).toBe('error');
});

it('recusa CPF no contrato de histórico sem ampliar o schema do banco', () => {
  expect(
    AnalysisHistoryWriteSchema.safeParse({
      target: '12345678909',
      targetKind: 'cpf',
      total: 1,
      success: 1,
      attention: 0,
    }).success,
  ).toBe(false);
});
