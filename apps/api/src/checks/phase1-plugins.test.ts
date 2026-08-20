import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CheckPlugin } from '../core/checks/contract.js';
import type { NormalizedTarget } from '../core/target/normalize-target.js';
import cookies from './cookies/index.js';
import dnsRecords from './dns-records/index.js';
import httpHeaders from './http-headers/index.js';
import ipInfo from './ip-info/index.js';
import redirectChain from './redirect-chain/index.js';
import robotsSitemap from './robots-sitemap/index.js';
import serverLocation from './server-location/index.js';
import serverStatus from './server-status/index.js';
import sslCertificate from './ssl-certificate/index.js';
import techStack from './tech-stack/index.js';
import whoisRdap from './whois-rdap/index.js';

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
const context = () => ({
  signal: new AbortController().signal,
  credentials: {},
});

async function run(check: CheckPlugin, target = domainTarget) {
  return check.run(target, context());
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('plugins da Fase 1', () => {
  it('IP Info normaliza um IPv4 informado diretamente', async () => {
    const result = await run(ipInfo, ipTarget);
    expect(result.status).toBe('success');
    expect(result.data).toMatchObject({ ipv4: [{ address: '8.8.8.8' }] });
  });

  it('DNS Records rejeita IP direto sem tentar uma consulta incompatível', async () => {
    const result = await run(dnsRecords, ipTarget);
    expect(result.status).toBe('error');
    expect(result.error).toContain('domínio');
  });

  it('WHOIS/RDAP seleciona o servidor pelo bootstrap IANA e cura a resposta', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ services: [[['com'], ['https://rdap.example/']]] }),
      )
      .mockResolvedValueOnce(
        Response.json({
          ldhName: 'EXAMPLE.COM',
          status: ['active'],
          events: [
            { eventAction: 'registration', eventDate: '1995-08-14T04:00:00Z' },
          ],
          nameservers: [{ ldhName: 'A.IANA-SERVERS.NET' }],
          entities: [
            {
              roles: ['registrar'],
              vcardArray: ['vcard', [['fn', {}, 'text', 'Example Registrar']]],
            },
          ],
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await run(whoisRdap);
    expect(result.status).toBe('success');
    expect(result.data).toMatchObject({ registrar: 'Example Registrar' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('SSL/TLS transforma conexão recusada em erro isolado', async () => {
    const target: NormalizedTarget = {
      original: 'https://127.0.0.1:1',
      value: 'https://127.0.0.1:1/',
      hostname: '127.0.0.1',
      kind: 'url',
    };
    const result = await run(sslCertificate, target);
    expect(result.status).toBe('error');
    expect(result.source).toBe('Node.js TLS');
  });

  it('HTTP Headers avalia headers de segurança sem expor Set-Cookie', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('ok', {
          status: 200,
          headers: {
            'content-security-policy': "default-src 'self'",
            'strict-transport-security': 'max-age=31536000',
            'set-cookie': 'secret=value',
          },
        }),
      ),
    );
    const result = await run(httpHeaders);
    expect(result.status).toBe('success');
    expect(JSON.stringify(result.data)).not.toContain('secret=value');
  });

  it('Server Location não envia IP privado ao provedor externo', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const privateTarget: NormalizedTarget = {
      original: '192.168.1.2',
      value: '192.168.1.2',
      hostname: '192.168.1.2',
      kind: 'ip',
    };
    const result = await run(serverLocation, privateTarget);
    expect(result.status).toBe('success');
    expect(result.data).toMatchObject({ scope: 'private-or-reserved' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Server Location cura a resposta pública do ipwho.is', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          success: true,
          ip: '8.8.8.8',
          country: 'United States',
          city: 'Mountain View',
          connection: { asn: 15169, org: 'Google LLC' },
        }),
      ),
    );
    const result = await run(serverLocation, ipTarget);
    expect(result.data).toMatchObject({ network: { asn: 15169 } });
  });

  it('Redirect Chain resolve locations relativas e encerra na resposta final', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('', { status: 301, headers: { location: '/final' } }),
      )
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await run(redirectChain);
    expect(result.data).toMatchObject({ redirectCount: 1, finalStatus: 200 });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://example.com/final',
      expect.any(Object),
    );
  });

  it('Tech Stack detecta sinais curados em headers e HTML', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('<script id="__NEXT_DATA__">{}</script>', {
          status: 200,
          headers: { 'content-type': 'text/html', 'x-vercel-id': 'gru1::abc' },
        }),
      ),
    );
    const result = await run(techStack);
    const serialized = JSON.stringify(result.data);
    expect(serialized).toContain('Next.js');
    expect(serialized).toContain('Vercel');
  });

  it('Cookies omite valores e mantém apenas flags de segurança', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('ok', {
          status: 200,
          headers: {
            'set-cookie':
              'session=valor-secreto; Secure; HttpOnly; SameSite=Lax',
          },
        }),
      ),
    );
    const result = await run(cookies);
    expect(result.status).toBe('success');
    expect(JSON.stringify(result.data)).not.toContain('valor-secreto');
    expect(result.data).toMatchObject({ summary: { secure: 1, httpOnly: 1 } });
  });

  it('Robots/Sitemap resume regras e verifica o sitemap descoberto', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('home', { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          'User-agent: *\nDisallow: /admin\nSitemap: https://example.com/map.xml',
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response('<urlset/>', {
          status: 200,
          headers: { 'content-type': 'application/xml' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const result = await run(robotsSitemap);
    expect(result.data).toMatchObject({
      robots: { disallow: ['/admin'] },
      sitemaps: [{ available: true }],
    });
  });

  it('Server Status considera qualquer resposta HTTP como servidor online', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response('erro controlado', { status: 503 })),
    );
    const result = await run(serverStatus);
    expect(result.data).toMatchObject({ online: true, status: 503 });
  });
});
