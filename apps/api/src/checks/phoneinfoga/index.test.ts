import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NormalizedTarget } from '../../core/target/normalize-target.js';
import phoneinfoga from './index.js';

const target: NormalizedTarget = {
  original: '+5511998765432',
  value: '+5511998765432',
  hostname: '+5511998765432',
  kind: 'phone',
};

const environment = {
  PHONEINFOGA_API_URL: 'https://phoneinfoga.internal',
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('plugin PhoneInfoga', () => {
  it('retorna skipped quando o gateway não está configurado', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await phoneinfoga.run(target, {
      signal: new AbortController().signal,
      credentials: { PHONEINFOGA_API_TOKEN: 'gateway-token' },
      environment: {},
    });

    expect(result.status).toBe('skipped');
    expect(result.error).toContain('PHONEINFOGA_API_URL');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('normaliza o número e executa os scanners base sem expor resposta bruta', async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const body = init?.body ? JSON.parse(String(init.body)) : undefined;

        if (url.endsWith('/api/v2/numbers')) {
          return Response.json({
            e164: '+5511998765432',
            international: '+55 11 99876-5432',
            local: '99876-5432',
            rawLocal: '998765432',
            country: 'BR',
            countryCode: 55,
            carrier: 'Example Carrier',
            valid: true,
          });
        }

        if (url.endsWith('/local/run')) {
          expect(body).toEqual({ number: '+5511998765432', options: {} });
          return Response.json({
            result: {
              e164: '+5511998765432',
              country: 'BR',
              countryCode: 55,
              carrier: 'Example Carrier',
              rawBanner: 'must not be returned',
            },
          });
        }

        if (url.endsWith('/googlesearch/run')) {
          return Response.json({
            result: {
              social_media: [
                {
                  dork: 'site:example.test +5511998765432',
                  url: 'https://www.google.com/search?q=example',
                },
              ],
              internalRawField: 'must not be returned',
            },
          });
        }

        if (url.endsWith('/ovh/run')) {
          return Response.json({
            result: {
              found: false,
              number_range: '11xxxxxx',
              city: 'São Paulo',
              zip_code: '00000-000',
            },
          });
        }

        throw new Error(`URL inesperada: ${url}`);
      },
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await phoneinfoga.run(target, {
      signal: new AbortController().signal,
      credentials: { PHONEINFOGA_API_TOKEN: 'gateway-token' },
      environment,
    });

    expect(result.status).toBe('success');
    expect(result.data).toMatchObject({
      number: { e164: '+5511998765432', country: 'BR' },
      scanners: {
        local: { status: 'success' },
        googlesearch: { status: 'success' },
        ovh: { status: 'success' },
        numverify: { status: 'skipped' },
        googlecse: { status: 'skipped' },
      },
    });
    expect(JSON.stringify(result.data)).not.toContain('must not be returned');

    for (const [, init] of fetchMock.mock.calls) {
      expect(new Headers(init?.headers).get('authorization')).toBe(
        'Bearer gateway-token',
      );
    }
  });

  it('envia credenciais opcionais apenas para os scanners correspondentes', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/v2/numbers')) {
        return Response.json({ e164: '+5511998765432', valid: true });
      }
      return Response.json({ result: {} });
    });
    vi.stubGlobal('fetch', fetchMock);

    await phoneinfoga.run(target, {
      signal: new AbortController().signal,
      credentials: {
        PHONEINFOGA_API_TOKEN: 'gateway-token',
        NUMVERIFY_API_KEY: 'numverify-secret',
        GOOGLECSE_CX: 'google-cx',
        GOOGLE_API_KEY: 'google-secret',
      },
      environment,
    });

    const numverifyCall = fetchMock.mock.calls.find(([input]) =>
      String(input).endsWith('/numverify/run'),
    );
    const googlecseCall = fetchMock.mock.calls.find(([input]) =>
      String(input).endsWith('/googlecse/run'),
    );
    expect(JSON.parse(String(numverifyCall?.[1]?.body))).toEqual({
      number: '+5511998765432',
      options: { NUMVERIFY_API_KEY: 'numverify-secret' },
    });
    expect(JSON.parse(String(googlecseCall?.[1]?.body))).toEqual({
      number: '+5511998765432',
      options: {
        GOOGLECSE_CX: 'google-cx',
        GOOGLE_API_KEY: 'google-secret',
      },
    });
  });

  it('mantém erro de um scanner isolado', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/v2/numbers')) {
        return Response.json({ e164: '+5511998765432', valid: true });
      }
      if (url.endsWith('/ovh/run')) return new Response(null, { status: 429 });
      return Response.json({ result: {} });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await phoneinfoga.run(target, {
      signal: new AbortController().signal,
      credentials: { PHONEINFOGA_API_TOKEN: 'gateway-token' },
      environment,
    });

    expect(result.status).toBe('success');
    expect(result.data).toMatchObject({
      scanners: {
        local: { status: 'success' },
        googlesearch: { status: 'success' },
        ovh: {
          status: 'error',
          error: 'O limite de uso do serviço PhoneInfoga foi atingido.',
        },
      },
    });
  });
});
