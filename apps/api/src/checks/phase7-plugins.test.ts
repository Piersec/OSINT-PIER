import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NormalizedTarget } from '../core/target/normalize-target.js';
import hunter from './hunter-io/index.js';
import shodan from './shodan/index.js';
import vulnerabilities from './shodan-vulnerabilities/index.js';

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
        ip_str: '8.8.8.8',
        hostnames: ['dns.google'],
        country_code: 'US',
        org: 'Google',
        ports: [443, 53, 443],
        vulns: { 'CVE-2024-0001': {} },
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
    expect(url.toString()).toContain('/shodan/host/8.8.8.8');
    expect(url.toString()).toContain('minify=true');
    expect(result.data).toMatchObject({
      selectedIp: '8.8.8.8',
      ports: [53, 443],
      vulnerabilities: ['CVE-2024-0001'],
      services: [{ port: 443, product: 'Example' }],
    });
    expect(JSON.stringify(result.data)).not.toContain('raw banner');
    expect(JSON.stringify(result.data)).not.toContain('shodan-secret');
  });

  it('Shodan diferencia chave inválida de restrição do plano', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 403 })),
    );

    const result = await shodan.run(ipTarget, {
      signal: new AbortController().signal,
      credentials: { SHODAN_API_KEY: 'shodan-secret' },
    });

    expect(result.status).toBe('error');
    expect(result.error).toContain('plano não permite');
  });

  it('retorna skipped quando as credenciais não existem', async () => {
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
    expect(shodanResult.status).toBe('error');
  });

  it('consolida CVEs do Shodan com CVSS, EPSS e CISA KEV', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          ip_str: '8.8.8.8',
          vulns: ['CVE-2024-0001'],
          data: [
            { port: 443, transport: 'tcp', product: 'Example', version: '1.0' },
          ],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          vulnerabilities: [
            {
              cve: {
                id: 'CVE-2024-0001',
                descriptions: [{ lang: 'en', value: 'Example vulnerability.' }],
                metrics: {
                  cvssMetricV31: [
                    {
                      cvssData: {
                        baseScore: 9.8,
                        baseSeverity: 'CRITICAL',
                        vectorString: 'CVSS:3.1/AV:N',
                      },
                    },
                  ],
                },
              },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(Response.json({ vulnerabilities: [] }))
      .mockResolvedValueOnce(
        Response.json({
          data: [{ cve: 'CVE-2024-0001', epss: '0.42', percentile: '0.95' }],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          vulnerabilities: [
            {
              cveID: 'CVE-2024-0001',
              dateAdded: '2024-01-01',
              dueDate: '2024-01-21',
              product: 'Example',
              vendorProject: 'Example Vendor',
              knownRansomwareCampaignUse: 'Known',
            },
          ],
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await vulnerabilities.run(ipTarget, {
      signal: new AbortController().signal,
      credentials: { SHODAN_API_KEY: 'shodan-secret' },
    });

    expect(result.status).toBe('success');
    expect(result.data).toMatchObject({
      total: 1,
      severityCounts: { critical: 1 },
      kevCount: 1,
      highEpssCount: 1,
      vulnerabilities: [
        {
          id: 'CVE-2024-0001',
          severity: 'critical',
          priority: 'critical',
          kev: true,
          epss: { score: 0.42 },
        },
      ],
    });
    expect(JSON.stringify(result.data)).not.toContain('shodan-secret');
  });
});
