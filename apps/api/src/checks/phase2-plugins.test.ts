import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NormalizedTarget } from '../core/target/normalize-target.js';
import abuseIpDb from './abuse-ipdb/index.js';
import virusTotal from './virus-total/index.js';

const domainTarget: NormalizedTarget = {
  original: 'example.com',
  value: 'example.com',
  hostname: 'example.com',
  kind: 'domain',
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

describe('plugins da Fase 2', () => {
  it('VirusTotal consulta domínio com header seguro e cura as detecções', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        data: {
          id: 'example.com',
          type: 'domain',
          attributes: {
            last_analysis_stats: { harmless: 80, malicious: 1 },
            last_analysis_date: 1_700_000_000,
            last_analysis_results: {
              ExampleEngine: {
                category: 'malicious',
                engine_name: 'Example Engine',
                result: 'phishing',
              },
            },
            reputation: -2,
            total_votes: { harmless: 3, malicious: 1 },
            categories: { ExampleProvider: 'technology' },
          },
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await virusTotal.run(domainTarget, {
      signal: new AbortController().signal,
      credentials: { VIRUSTOTAL_API_KEY: 'vt-secret' },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.virustotal.com/api/v3/domains/example.com',
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-apikey': 'vt-secret' }),
      }),
    );
    expect(result.data).toMatchObject({
      analysis: { detections: [{ engine: 'Example Engine' }] },
      reputation: -2,
    });
    expect(JSON.stringify(result.data)).not.toContain('vt-secret');
  });

  it('VirusTotal apresenta o limite de cota explicitamente', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('', { status: 429 })),
    );
    const result = await virusTotal.run(ipTarget, {
      signal: new AbortController().signal,
      credentials: { VIRUSTOTAL_API_KEY: 'vt-secret' },
    });
    expect(result.status).toBe('error');
    expect(result.error).toContain('cota');
  });

  it('AbuseIPDB consulta um IP em 90 dias com geolocalização curada', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json(
        {
          data: {
            ipAddress: '8.8.8.8',
            isPublic: true,
            ipVersion: 4,
            isWhitelisted: true,
            abuseConfidenceScore: 4,
            countryCode: 'US',
            countryName: 'United States of America',
            city: 'Mountain View',
            asn: 15169,
            usageType: 'Data Center/Web Hosting/Transit',
            isp: 'Example ISP',
            domain: 'example.com',
            isTor: false,
            totalReports: 2,
            numDistinctUsers: 2,
            lastReportedAt: '2026-08-01T00:00:00+00:00',
          },
        },
        {
          headers: {
            'x-ratelimit-limit': '1000',
            'x-ratelimit-remaining': '999',
            'x-ratelimit-reset': '1787097600',
          },
        },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await abuseIpDb.run(ipTarget, {
      signal: new AbortController().signal,
      credentials: { ABUSEIPDB_API_KEY: 'abuse-secret' },
    });

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('ipAddress=8.8.8.8');
    expect(url).toContain('maxAgeInDays=90');
    expect(url).toContain('verbose=');
    expect(options.headers).toMatchObject({ Key: 'abuse-secret' });
    expect(result.data).toMatchObject({
      abuseConfidenceScore: 4,
      reports: { total: 2 },
      network: {
        countryName: 'United States of America',
        city: 'Mountain View',
        asn: 15169,
        domain: 'example.com',
      },
      quota: { limit: 1000, remaining: 999 },
    });
    expect(JSON.stringify(result.data)).not.toContain('abuse-secret');
  });

  it('AbuseIPDB não envia endereços privados ao serviço externo', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const privateTarget: NormalizedTarget = {
      original: '192.168.1.10',
      value: '192.168.1.10',
      hostname: '192.168.1.10',
      kind: 'ip',
    };
    const result = await abuseIpDb.run(privateTarget, {
      signal: new AbortController().signal,
      credentials: { ABUSEIPDB_API_KEY: 'abuse-secret' },
    });
    expect(result.data).toMatchObject({ scope: 'private-or-reserved' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('AbuseIPDB apresenta autenticação inválida explicitamente', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('', { status: 401 })),
    );
    const result = await abuseIpDb.run(ipTarget, {
      signal: new AbortController().signal,
      credentials: { ABUSEIPDB_API_KEY: 'invalid' },
    });
    expect(result.status).toBe('error');
    expect(result.error).toContain('inválida');
  });

  it('AbuseIPDB enriquece cidade e ASN sem falhar quando a geolocalização não responde', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          data: {
            ipAddress: '8.8.8.8',
            countryCode: 'US',
            countryName: 'United States of America',
            abuseConfidenceScore: 0,
            totalReports: 0,
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          success: true,
          country: 'United States',
          country_code: 'US',
          city: 'Mountain View',
          connection: {
            asn: 15169,
            isp: 'Google LLC',
            domain: 'google.com',
          },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await abuseIpDb.run(ipTarget, {
      signal: new AbortController().signal,
      credentials: { ABUSEIPDB_API_KEY: 'abuse-secret' },
    });

    expect(result.data).toMatchObject({
      network: {
        city: 'Mountain View',
        asn: 15169,
        isp: 'Google LLC',
        domain: 'google.com',
        locationSource: 'ipwho.is (aproximado)',
      },
    });
  });
});
