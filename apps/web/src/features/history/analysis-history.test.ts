import { describe, expect, it } from 'vitest';
import type { CardState } from '../../components/checks/ResultCard';
import { createAnalysisHistoryEntry } from './analysis-history';

describe('analysis history', () => {
  it('resume sucessos e sinais de atenção sem guardar os dados dos checks', () => {
    const states: CardState[] = [
      {
        status: 'done',
        result: {
          id: 'dns-records',
          status: 'success',
          data: { addresses: ['203.0.113.10'] },
          source: 'DNS',
          durationMs: 12,
        },
      },
      {
        status: 'done',
        result: {
          id: 'virus-total',
          status: 'skipped',
          error: 'Credencial ausente.',
          source: 'configuration',
          durationMs: 1,
        },
      },
      {
        status: 'request-error',
        message: 'Serviço indisponível.',
        statusCode: 503,
      },
    ];

    const entry = createAnalysisHistoryEntry({
      target: 'example.com',
      states,
      completedAt: new Date('2026-08-20T13:00:00.000Z'),
    });

    expect(entry).toEqual({
      id: '2026-08-20T13:00:00.000Z-example.com',
      target: 'example.com',
      targetKind: 'domain',
      completedAt: '2026-08-20T13:00:00.000Z',
      total: 3,
      success: 1,
      attention: 2,
    });
    expect(entry).not.toHaveProperty('data');
  });
});
