import { describe, expect, it } from 'vitest';
import { normalizeTarget } from './normalize-target.js';

describe('normalizeTarget', () => {
  it('detecta automaticamente e-mail, telefone, username e nome', () => {
    expect(normalizeTarget('Analyst@Example.COM').kind).toBe('email');
    expect(normalizeTarget('8.8.8.8').kind).toBe('ip');
    expect(normalizeTarget('(11) 99876-5432').kind).toBe('phone');
    expect(normalizeTarget('@analyst_one').kind).toBe('username');
    expect(normalizeTarget('@Analyst.One').kind).toBe('username');
    expect(normalizeTarget('Ana Maria').kind).toBe('name');
  });

  it('remove os colchetes do hostname de uma URL IPv6', () => {
    expect(normalizeTarget('https://[2001:4860:4860::8888]/path')).toEqual({
      original: 'https://[2001:4860:4860::8888]/path',
      value: 'https://[2001:4860:4860::8888]/path',
      hostname: '2001:4860:4860::8888',
      kind: 'url',
    });
  });

  it('normaliza consultas de identidade com o tipo escolhido', () => {
    expect(normalizeTarget('  @Analyst.One ', 'username')).toMatchObject({
      value: 'Analyst.One',
      hostname: 'Analyst.One',
      kind: 'username',
    });
    expect(normalizeTarget('Analyst@Example.COM', 'email')).toMatchObject({
      value: 'analyst@example.com',
      kind: 'email',
    });
    expect(normalizeTarget('(11) 99876-5432', 'phone')).toMatchObject({
      value: '+11998765432',
      kind: 'phone',
    });
    expect(normalizeTarget('Ana Maria', 'name')).toMatchObject({
      value: 'Ana Maria',
      kind: 'name',
    });
  });

  it('rejeita um valor incompatível com o tipo explícito', () => {
    expect(() => normalizeTarget('example.com', 'email')).toThrow('válido');
    expect(() => normalizeTarget('not-an-ip', 'ip')).toThrow('válido');
  });
});
