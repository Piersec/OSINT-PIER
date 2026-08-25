import { describe, expect, it } from 'vitest';
import type { CheckCatalogItem } from '@osint-pier/contracts';
import { getSuccessfulChecks } from './visible-results';

const checks: CheckCatalogItem[] = [
  {
    id: 'success-check',
    label: 'Sucesso',
    configured: true,
    enabled: true,
    requiredCredentials: [],
    supportedTargetKinds: ['ip'],
  },
  {
    id: 'error-check',
    label: 'Erro',
    configured: true,
    enabled: true,
    requiredCredentials: [],
    supportedTargetKinds: ['ip'],
  },
  {
    id: 'skipped-check',
    label: 'Pulado',
    configured: false,
    enabled: true,
    requiredCredentials: ['API_KEY'],
    supportedTargetKinds: ['ip'],
  },
];

describe('getSuccessfulChecks', () => {
  it('mantém apenas respostas concluídas com sucesso', () => {
    expect(
      getSuccessfulChecks(checks, {
        'success-check': {
          status: 'done',
          result: {
            id: 'success-check',
            status: 'success',
            source: 'test',
            durationMs: 10,
          },
        },
        'error-check': {
          status: 'done',
          result: {
            id: 'error-check',
            status: 'error',
            error: 'Falhou',
            source: 'test',
            durationMs: 10,
          },
        },
        'skipped-check': {
          status: 'request-error',
          message: 'Falha de transporte',
        },
      }).map((check) => check.id),
    ).toEqual(['success-check']);
  });
});
