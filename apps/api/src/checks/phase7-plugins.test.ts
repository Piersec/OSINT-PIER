import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NormalizedTarget } from '../core/target/normalize-target.js';
import hunter from './hunter-io/index.js';
import shodan from './shodan/index.js';

const domainTarget: NormalizedTarget = {
  original: 'example.com',
  value: 'example.com',
  hostname: 'example.com',
  kind: 'domain',
};
const emailTarget: NormalizedTarget = {
  original: 'analyst@example.com',
  value: 'analyst@example.com',
  hostname: 'analyst@example.com',
  kind: 'email',
};
const ipTarget: NormalizedTarget = {
  original: '8.8.8.8',
  value: '8.8.8.8',
  hostname: '8.8.8.8',
  kind: 'ip',
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('plugins Hunter e Shodan', () => {
  it('Hunter faz Domain Search e cura os contatos sem expor a chave', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        data: {
          domain: 'example.com',
          organization: 'Example Inc.',
          pattern: '{first}',
          emails: [
            {
              value: 'ana@example.com',
              type: 'personal',
              confidence: 91,
              first_name: 'Ana',
              sources: [{ uri: 'https://example.com' }],
            },
          ],
        },
        meta: { results: 1, limit: 10, offset: 0 },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await hunter.run(domainTarget, {
      signal: new AbortController().signal,
      credentials: { HUNTER_API_KEY: 'hunter-secret' },
    });

    const [url] = fetchMock.mock.calls[0] as [URL];
    expect(url.toString()).toContain('domain=example.com');
    expect(url.toString()).toContain('limit=10');
    expect(url.toString()).toContain('api_key=hunter-secret');
    expect(result.data).toMatchObject({
      mode: 'domain-search',
      emails: [{ value: 'ana@example.com', sourcesCount: 1 }],
    });
    expect(JSON.stringify(result.data)).not.toContain('hunter-secret');
  });

  it('Hunter usa Email Verifier para um e-mail explícito', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          data: {
            email: 'analyst@example.com',
            score: 96,
            status: 'valid',
            result: 'deliverable',
            smtp_check: true,
          },
        }),
      ),
    );

    const result = await hunter.run(emailTarget, {
      signal: new AbortController().signal,
      credentials: { HUNTER_API_KEY: 'hunter-secret' },
    });

    expect(result.data).toMatchObject({
      mode: 'email-verifier',
      score: 96,
      checks: { smtpCheck: true },
    });
  });

  it('Shodan consulta host público e retorna somente campos curados', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        ip: '8.8.8.8',
        hostnames: ['dns.google'],
        country_code: 'US',
        org: 'Google',
        ports: [443, 53, 443],
        vulns: ['CVE-2024-0001'],
        cpes: ['cpe:/a:example:example:1.0'],
        data: [
          {
            port: 443,
            transport: 'tcp',
            product: 'Example',
            version: '1.0',
            data: 'raw banner should not be returned',
          },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await shodan.run(ipTarget, {
      signal: new AbortController().signal,
      credentials: { SHODAN_API_KEY: 'shodan-secret' },
    });

    const [url] = fetchMock.mock.calls[0] as [URL];
    expect(url.toString()).toBe('https://internetdb.shodan.io/8.8.8.8');
    expect(shodan.requiredEnv).toEqual([]);
    expect(result.data).toMatchObject({
      selectedIp: '8.8.8.8',
      observedPorts: [53, 443],
      possibleCves: ['CVE-2024-0001'],
      technologies: ['cpe:/a:example:example:1.0'],
    });
    expect(JSON.stringify(result.data)).not.toContain('raw banner');
    expect(JSON.stringify(result.data)).not.toContain('shodan-secret');
  });

  it('InternetDB informa falha de serviço sem atribuir o erro a uma chave', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 403 })),
    );

    const result = await shodan.run(ipTarget, {
      signal: new AbortController().signal,
      credentials: { SHODAN_API_KEY: 'shodan-secret' },
    });

    expect(result.status).toBe('error');
    expect(result.error).toContain('InternetDB temporariamente indisponível');
  });

  it('InternetDB funciona sem chave e Hunter continua exigindo a sua', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ ip: '8.8.8.8', ports: [] })));
    const [hunterResult, shodanResult] = await Promise.all([
      hunter.run(domainTarget, {
        signal: new AbortController().signal,
        credentials: {},
      }),
      shodan.run(ipTarget, {
        signal: new AbortController().signal,
        credentials: {},
      }),
    ]);

    expect(hunterResult.status).toBe('error');
    expect(shodanResult.status).toBe('success');
  });
  it('InternetDB não transforma 404 em ausência de vulnerabilidades', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    const result = await shodan.run(ipTarget, { signal: new AbortController().signal, credentials: {} });
    expect(result.data).toMatchObject({ found: false });
    expect(result.data).not.toHaveProperty('possibleCves');
  });
  it('InternetDB trata limite de uso e resposta incompleta', async () => {
    const mock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(Response.json({ ip: '8.8.8.8' }));
    vi.stubGlobal('fetch', mock);
    const context = { signal: new AbortController().signal, credentials: {} };
    expect((await shodan.run(ipTarget, context)).error).toContain('Limite');
    expect((await shodan.run(ipTarget, context)).status).toBe('error');
  });
  it('InternetDB não envia IP privado ao serviço', async () => {
    const mock = vi.fn();
    vi.stubGlobal('fetch', mock);
    const result = await shodan.run({ ...ipTarget, value: '127.0.0.1', hostname: '127.0.0.1' },
      { signal: new AbortController().signal, credentials: {} });
    expect(result.status).toBe('skipped');
    expect(mock).not.toHaveBeenCalled();
  });
});
