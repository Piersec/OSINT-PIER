import { describe, expect, it } from 'vitest';
import type { CheckCatalogItem } from '@osint-pier/contracts';
import type { CardState } from '../checks/ResultCard';
import { buildAnalysisSnapshot } from './AnalysisInsights';

const checks: CheckCatalogItem[] = [
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
  {
    id: 'virus-total',
    label: 'VirusTotal',
    configured: true,
    enabled: true,
    requiredCredentials: ['VIRUSTOTAL_API_KEY'],
    supportedTargetKinds: ['domain', 'ip', 'url'],
  },
  {
    id: 'abuse-ipdb',
    label: 'AbuseIPDB',
    configured: true,
    enabled: true,
    requiredCredentials: ['ABUSEIPDB_API_KEY'],
    supportedTargetKinds: ['domain', 'ip', 'url'],
  },
];

const states: Record<string, CardState> = {
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
  'virus-total': {
    status: 'done',
    result: {
      id: 'virus-total',
      status: 'success',
      data: {
        analysis: {
          stats: { malicious: 1, suspicious: 2, harmless: 70, undetected: 20 },
        },
      },
      source: 'test',
      durationMs: 50,
    },
  },
  'abuse-ipdb': {
    status: 'done',
    result: {
      id: 'abuse-ipdb',
      status: 'success',
      data: { abuseConfidenceScore: 40 },
      source: 'test',
      durationMs: 50,
    },
  },
};

describe('AnalysisInsights', () => {
  it('agrega somente sinais de segurança e criticidade', () => {
    const snapshot = buildAnalysisSnapshot(checks, states);

    expect(snapshot.riskScore).toBeGreaterThan(0);
    expect(snapshot.postureScore).toBeLessThan(100);
    expect(snapshot.criticalityLabel).toBeTruthy();
    expect(snapshot.criticalVulnerabilityTotal).toBe(1);
    expect(snapshot.vulnerabilityTotal).toBe(3);
    expect(snapshot.kevCount).toBe(1);
    expect(snapshot.highEpssCount).toBe(2);
    expect(snapshot.securityFailureTotal).toBe(3);
    expect(snapshot.postureAxes).toHaveLength(5);
    expect(snapshot.criticalityPoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Crítica · CVEs' }),
        expect.objectContaining({ name: 'Falhas de segurança' }),
        expect.objectContaining({ name: 'Detecções maliciosas' }),
      ]),
    );
    expect(snapshot.reputation.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'virustotal-malicious', rawValue: 1 }),
        expect.objectContaining({ id: 'abuse-ipdb', rawValue: 40 }),
      ]),
    );
    expect(snapshot.insights.map((insight) => insight.label)).toEqual([
      'Índice de risco',
      'CVEs críticas',
      'Exploração conhecida',
      'Falhas de segurança',
    ]);
  });

  it('não inventa criticidade quando ainda não há sinais de segurança', () => {
    const snapshot = buildAnalysisSnapshot(checks, {});

    expect(snapshot.riskScore).toBeNull();
    expect(snapshot.postureScore).toBeNull();
    expect(snapshot.criticalityPoints).toEqual([]);
    expect(snapshot.reputation.hasEvidence).toBe(false);
    expect(snapshot.insights.map((insight) => insight.value)).toEqual([
      '—',
      '—',
      '—',
      '—',
    ]);
  });
});
