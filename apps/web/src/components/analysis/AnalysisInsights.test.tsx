import { describe, expect, it } from 'vitest';
import type { CheckCatalogItem } from '@osint-pier/contracts';
import type { CardState } from '../checks/ResultCard';
import { buildAnalysisSnapshot } from './AnalysisInsights';

const checks: CheckCatalogItem[] = [
  {
    id: 'fast-check',
    label: 'Fast check',
    configured: true,
    enabled: true,
    requiredCredentials: [],
    supportedTargetKinds: ['domain'],
  },
  {
    id: 'slow-check',
    label: 'Slow check',
    configured: true,
    enabled: true,
    requiredCredentials: [],
    supportedTargetKinds: ['domain'],
  },
  {
    id: 'pending-check',
    label: 'Pending check',
    configured: false,
    enabled: true,
    requiredCredentials: ['PENDING_KEY'],
    supportedTargetKinds: ['domain'],
  },
];

const states: Record<string, CardState> = {
  'fast-check': {
    status: 'done',
    result: {
      id: 'fast-check',
      status: 'success',
      source: 'test',
      durationMs: 40,
    },
  },
  'slow-check': {
    status: 'done',
    result: {
      id: 'slow-check',
      status: 'skipped',
      error: 'Credencial ausente.',
      source: 'test',
      durationMs: 1200,
    },
  },
  'pending-check': { status: 'loading' },
};

describe('AnalysisInsights', () => {
  it('agrega estados, cobertura, duração e insights sem alterar os resultados', () => {
    const snapshot = buildAnalysisSnapshot(checks, states);

    expect(snapshot.resolved).toBe(2);
    expect(snapshot.loading).toBe(1);
    expect(snapshot.success).toBe(1);
    expect(snapshot.skipped).toBe(1);
    expect(snapshot.coverage).toBe(67);
    expect(snapshot.successRate).toBe(50);
    expect(snapshot.averageDurationMs).toBe(620);
    expect(snapshot.durations[0]).toMatchObject({
      fullLabel: 'Slow check',
      durationMs: 1200,
    });
    expect(snapshot.insights).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Cobertura', value: '2/3' }),
        expect.objectContaining({ label: 'Pontos de atenção', value: '1' }),
      ]),
    );
  });

  it('mantém a visualização vazia quando não há checks', () => {
    const snapshot = buildAnalysisSnapshot([], {});

    expect(snapshot.total).toBe(0);
    expect(snapshot.statuses).toEqual([]);
    expect(snapshot.durations).toEqual([]);
    expect(snapshot.insights[0]).toMatchObject({
      label: 'Cobertura',
      value: '0/0',
    });
  });

  it('transforma vulnerabilidades e falhas técnicas em sinais de risco', () => {
    const riskChecks: CheckCatalogItem[] = [
      {
        id: 'shodan-vulnerabilities',
        label: 'Vulnerabilidades (CVE)',
        configured: true,
        enabled: true,
        requiredCredentials: ['SHODAN_API_KEY'],
        supportedTargetKinds: ['domain', 'ip', 'url'],
      },
      {
        id: 'http-headers',
        label: 'HTTP Headers',
        configured: true,
        enabled: true,
        requiredCredentials: [],
        supportedTargetKinds: ['domain', 'url'],
      },
      {
        id: 'ssl-certificate',
        label: 'SSL/TLS Certificate',
        configured: true,
        enabled: true,
        requiredCredentials: [],
        supportedTargetKinds: ['domain', 'ip', 'url'],
      },
    ];
    const riskStates: Record<string, CardState> = {
      'shodan-vulnerabilities': {
        status: 'done',
        result: {
          id: 'shodan-vulnerabilities',
          status: 'success',
          data: {
            total: 3,
            severityCounts: { critical: 1, high: 1, low: 1 },
            kevCount: 1,
            highEpssCount: 2,
          },
          source: 'test',
          durationMs: 50,
        },
      },
      'http-headers': {
        status: 'done',
        result: {
          id: 'http-headers',
          status: 'success',
          data: {
            security: {
              'content-security-policy': { present: false },
              'x-frame-options': { present: true },
            },
          },
          source: 'test',
          durationMs: 50,
        },
      },
      'ssl-certificate': {
        status: 'done',
        result: {
          id: 'ssl-certificate',
          status: 'success',
          data: { authorized: false, hostnameMatches: true, daysRemaining: 4 },
          source: 'test',
          durationMs: 50,
        },
      },
    };

    const snapshot = buildAnalysisSnapshot(riskChecks, riskStates);

    expect(snapshot.vulnerabilityTotal).toBe(3);
    expect(snapshot.kevCount).toBe(1);
    expect(snapshot.highEpssCount).toBe(2);
    expect(snapshot.vulnerabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'critical', value: 1 }),
        expect.objectContaining({ key: 'high', value: 1 }),
      ]),
    );
    expect(snapshot.securityFailureTotal).toBe(2);
    expect(snapshot.securityFailures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'header-content-security-policy' }),
        expect.objectContaining({ id: 'tls-authorization' }),
      ]),
    );
    expect(snapshot.insights).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Vulnerabilidades', value: '3' }),
        expect.objectContaining({ label: 'Falhas de segurança', value: '2' }),
      ]),
    );
  });
});
