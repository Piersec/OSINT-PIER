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
