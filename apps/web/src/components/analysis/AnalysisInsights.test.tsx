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
});
