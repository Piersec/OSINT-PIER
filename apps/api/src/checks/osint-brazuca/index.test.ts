import { afterEach, expect, it, vi } from 'vitest';
import check from './index.js';
import { normalizeTarget } from '../../core/target/normalize-target.js';

afterEach(() => vi.restoreAllMocks());

it('consulta somente Querido Diário e distingue as fontes manuais', async () => {
  const fetchMock = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(
      Response.json({
        total_gazettes: 1,
        gazettes: [
          {
            date: '2026-10-14',
            territory_name: 'Santos',
            state_code: 'SP',
            excerpts: ['<b>Empresa</b> mencionada'],
            url: 'https://example.com/diario.pdf',
          },
        ],
      }),
    );
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
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(String(fetchMock.mock.calls[0][0])).toContain(
    'https://api.queridodiario.org.br/gazettes?',
  );
  expect(JSON.stringify(data)).toContain('Empresa mencionada');
  expect(JSON.stringify(data)).not.toContain('<b>');
  expect(JSON.stringify(data)).toContain('Consulta manual');
});

it('mantém as referências quando a consulta automática falha', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response('private failure', { status: 429 }),
  );
  const result = await check.run(normalizeTarget('00000000000191'), {
    signal: new AbortController().signal,
    credentials: {},
  });
  expect(result.status).toBe('success');
  expect(JSON.stringify(result.data)).toContain('Limite da fonte');
  expect(JSON.stringify(result)).not.toContain('private failure');
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
