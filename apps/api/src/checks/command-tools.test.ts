import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NormalizedTarget } from '../core/target/normalize-target.js';
import gobuster from './gobuster/index.js';
import katana from './katana/index.js';
import nmap from './nmap/index.js';
import subfinder from './subfinder/index.js';

const domainTarget: NormalizedTarget = {
  original: 'example.com',
  value: 'example.com',
  hostname: 'example.com',
  kind: 'domain',
};
const urlTarget: NormalizedTarget = {
  original: 'https://example.com/app',
  value: 'https://example.com/app',
  hostname: 'example.com',
  kind: 'url',
};
const ipTarget: NormalizedTarget = {
  original: '8.8.8.8',
  value: '8.8.8.8',
  hostname: '8.8.8.8',
  kind: 'ip',
};
const environment = { COMMAND_TOOLS_API_URL: 'https://tools.internal' };
const context = {
  signal: new AbortController().signal,
  credentials: { COMMAND_TOOLS_API_TOKEN: 'runner-secret' },
  environment,
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function responseFor(tool: string, data: Record<string, unknown>) {
  return Response.json({ tool, profile: 'safe', ...data });
}

describe('plugins de command tools', () => {
  it('envia Nmap ao runner e conserva apenas portas curadas', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      responseFor('nmap', {
        target: '8.8.8.8',
        hosts: [
          {
            ip: '8.8.8.8',
            status: 'up',
            ports: [
              {
                port: 443,
                protocol: 'tcp',
                state: 'open',
                service: 'https',
                product: 'Example',
                version: '1.0',
                banner: 'raw output must not pass',
              },
            ],
          },
        ],
        totalOpenPorts: 1,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await nmap.run(ipTarget, context);
    const [, request] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(String(request.body)).toContain('"tool":"nmap"');
    expect(String(request.body)).toContain('"target":"8.8.8.8"');
    expect(result.data).toMatchObject({
      totalOpenPorts: 1,
      hosts: [{ ports: [{ port: 443, service: 'https' }] }],
    });
    expect(JSON.stringify(result.data)).not.toContain('raw output');
    expect(JSON.stringify(result.data)).not.toContain('runner-secret');
  });

  it('cura URLs do Katana sem aceitar resposta fora do contrato', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        responseFor('katana', {
          target: urlTarget.value,
          urls: [
            {
              url: 'https://example.com/app/login',
              method: 'GET',
              statusCode: 200,
              contentType: 'text/html',
              body: 'raw response must not pass',
            },
          ],
          total: 1,
        }),
      ),
    );

    const result = await katana.run(urlTarget, context);
    expect(result.data).toMatchObject({
      target: urlTarget.value,
      urls: [{ url: 'https://example.com/app/login', statusCode: 200 }],
    });
    expect(JSON.stringify(result.data)).not.toContain('raw response');
  });

  it('cura resultados do Subfinder e do Gobuster', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        responseFor('subfinder', {
          target: 'example.com',
          subdomains: [{ host: 'api.example.com', sources: ['crtsh'] }],
          total: 1,
        }),
      )
      .mockResolvedValueOnce(
        responseFor('gobuster', {
          target: 'https://example.com/',
          paths: [{ path: '/admin', statusCode: 403, length: 123 }],
          total: 1,
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const [subfinderResult, gobusterResult] = await Promise.all([
      subfinder.run(domainTarget, context),
      gobuster.run(domainTarget, context),
    ]);
    expect(subfinderResult.data).toMatchObject({
      subdomains: [{ host: 'api.example.com' }],
    });
    expect(gobusterResult.data).toMatchObject({
      paths: [{ path: '/admin', statusCode: 403 }],
    });
  });

  it('retorna skipped quando o gateway não está configurado', async () => {
    const result = await subfinder.run(domainTarget, {
      ...context,
      environment: {},
    });
    expect(result.status).toBe('skipped');
    expect(result.error).toContain('COMMAND_TOOLS_API_URL');
  });
});
