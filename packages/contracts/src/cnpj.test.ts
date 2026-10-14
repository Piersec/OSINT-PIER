import { describe, expect, it } from 'vitest';
import { looksLikeCnpj, normalizeCnpj } from './cnpj.js';

describe('CNPJ', () => {
  it.each([
    ['00.000.000/0001-91', '00000000000191'],
    ['19131243000197', '19131243000197'],
    ['12.abc.345/01de-35', '12ABC34501DE35'],
  ])('normaliza e valida %s', (input, expected) => {
    expect(normalizeCnpj(input)).toBe(expected);
    expect(looksLikeCnpj(input)).toBe(true);
  });

  it.each([
    '00000000000000',
    '19131243000198',
    '12ABC34501DE36',
    '19!131243000197',
  ])('rejeita %s', (input) => {
    expect(normalizeCnpj(input)).toBeNull();
  });

  it.each(['+5513997221735', 'example.com', 'longusername12', 'Ana Maria'])(
    'não captura outro tipo de alvo: %s',
    (input) => {
      expect(looksLikeCnpj(input)).toBe(false);
    },
  );
});
