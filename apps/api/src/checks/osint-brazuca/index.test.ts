import { afterEach, expect, it, vi } from 'vitest';
import check from './index.js';
import { normalizeTarget } from '../../core/target/normalize-target.js';

afterEach(() => vi.restoreAllMocks());

it('seleciona fontes CNPJ sem consultar os portais nem enviar o alvo nos links', async () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch');
  const target = normalizeTarget('00000000000191');
  const result = await check.run(target, {
    signal: new AbortController().signal,
    credentials: {},
  });
  expect(result.status).toBe('success');
  const data = result.data as { referencias: { nome: string; url: string }[] };
  expect(data.referencias).toHaveLength(4);
  expect(data.referencias.some((item) => item.nome === 'Receita Federal')).toBe(
    true,
  );
  expect(data.referencias.some((item) => item.nome.includes('WHOIS'))).toBe(
    false,
  );
  expect(JSON.stringify(data)).not.toContain(target.value);
  expect(fetchMock).not.toHaveBeenCalled();
});

it('mostra referências de domínio para uma URL e mantém os links HTTPS', async () => {
  const result = await check.run(normalizeTarget('https://piersec.com.br/'), {
    signal: new AbortController().signal,
    credentials: {},
  });
  const data = result.data as { referencias: { nome: string; url: string }[] };
  expect(data.referencias).toHaveLength(2);
  expect(
    data.referencias.every((item) => new URL(item.url).protocol === 'https:'),
  ).toBe(true);
});
