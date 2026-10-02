import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { spawn } from 'node:child_process';
import type { NormalizedTarget } from '../core/target/normalize-target.js';
import nuclei, { parseNucleiJsonl } from './nuclei/index.js';

vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

class FakeChild extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();

  kill() {
    return true;
  }
}

const ipTarget: NormalizedTarget = {
  original: '8.8.8.8',
  value: '8.8.8.8',
  hostname: '8.8.8.8',
  kind: 'ip',
};

function queueScan(output: string, exitCode = 0) {
  const child = new FakeChild();
  vi.mocked(spawn).mockImplementationOnce(() => {
    queueMicrotask(() => {
      child.stdout.emit('data', Buffer.from(output));
      child.emit('close', exitCode);
    });
    return child as never;
  });
  return child;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(spawn).mockReset();
  vi.restoreAllMocks();
});

describe('plugin Nuclei', () => {
  it('usa o runner remoto sem tentar iniciar um processo na Vercel', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        tool: 'nuclei',
        exitCode: 0,
        findings: [
          {
            'template-id': 'exposed-panel',
            info: { name: 'Panel', severity: 'high' },
            request: 'raw-secret',
          },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const result = await nuclei.run(ipTarget, {
      signal: new AbortController().signal,
      credentials: { COMMAND_TOOLS_API_TOKEN: 'internal-token' },
      environment: { COMMAND_TOOLS_API_URL: 'https://tools.internal' },
    });
    expect(result.status).toBe('success');
    expect(result.data).toMatchObject({ total: 1 });
    expect(spawn).not.toHaveBeenCalled();
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain(
      '"tool":"nuclei"',
    );
    expect(JSON.stringify(result)).not.toContain('raw-secret');
    expect(JSON.stringify(result)).not.toContain('internal-token');
  });

  it('não cai para CLI local quando o runner remoto falha', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{}', { status: 503 })),
    );
    const result = await nuclei.run(ipTarget, {
      signal: new AbortController().signal,
      credentials: { COMMAND_TOOLS_API_TOKEN: 'internal-token' },
      environment: { COMMAND_TOOLS_API_URL: 'https://tools.internal' },
    });
    expect(result.status).toBe('error');
    expect(spawn).not.toHaveBeenCalled();
  });

  it('pula execução remota sem token e rejeita resposta inválida', async () => {
    const context = {
      signal: new AbortController().signal,
      credentials: {},
      environment: { COMMAND_TOOLS_API_URL: 'https://tools.internal' },
    };
    expect((await nuclei.run(ipTarget, context)).status).toBe('skipped');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ tool: 'nuclei', exitCode: 0 })),
    );
    expect(
      (
        await nuclei.run(ipTarget, {
          ...context,
          credentials: { COMMAND_TOOLS_API_TOKEN: 'token' },
        })
      ).status,
    ).toBe('error');
    expect(spawn).not.toHaveBeenCalled();
  });

  it('interpreta JSONL curado sem preservar request/response brutos', () => {
    const findings = parseNucleiJsonl(
      [
        JSON.stringify({
          'template-id': 'exposed-panel',
          info: {
            name: 'Exposed panel',
            severity: 'high',
            description: 'An administrative panel is exposed.',
            classification: { 'cve-id': ['CVE-2024-0001'] },
            reference: ['https://example.com/advisory'],
            tags: ['exposure', 'panel'],
          },
          'matched-at': 'https://example.com/admin',
          host: 'example.com',
          type: 'http',
          request: 'must not be returned',
        }),
        'status line that is not JSON',
      ].join('\n'),
    );

    expect(findings).toEqual([
      expect.objectContaining({
        id: 'exposed-panel',
        severity: 'high',
        cveIds: ['CVE-2024-0001'],
        matchedAt: 'https://example.com/admin',
      }),
    ]);
    expect(JSON.stringify(findings)).not.toContain('must not be returned');
  });

  it('executa o CLI, enriquece CVE com NVD/EPSS/KEV e alimenta o resumo', async () => {
    queueScan(
      JSON.stringify({
        'template-id': 'cve-2024-0001',
        info: {
          name: 'Example vulnerability',
          severity: 'high',
          description: 'Example finding.',
          classification: {
            'cve-id': ['CVE-2024-0001'],
            'cvss-score': '8.1',
          },
        },
        'matched-at': 'https://example.com',
      }),
    );
    const fetchMock = vi
      .fn()
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

    const result = await nuclei.run(ipTarget, {
      signal: new AbortController().signal,
      credentials: {},
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
    expect(JSON.stringify(result.data)).not.toContain('request');
    expect(vi.mocked(spawn)).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([
        '-jsonl',
        '-omit-raw',
        '-restrict-local-network-access',
      ]),
      expect.objectContaining({ stdio: ['ignore', 'pipe', 'pipe'] }),
    );
  });

  it('retorna skipped quando o binário não está disponível', async () => {
    const child = new FakeChild();
    vi.mocked(spawn).mockImplementationOnce(() => {
      queueMicrotask(() =>
        child.emit(
          'error',
          Object.assign(new Error('missing'), { code: 'ENOENT' }),
        ),
      );
      return child as never;
    });

    const result = await nuclei.run(ipTarget, {
      signal: new AbortController().signal,
      credentials: {},
    });

    expect(result.status).toBe('skipped');
    expect(result.error).toContain('Nuclei não está instalado');
  });
});
