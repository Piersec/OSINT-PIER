import { describe, expect, it } from 'vitest';
import type { CheckCatalogItem } from '@osint-pier/contracts';
import { getCompatibleChecks } from './compatible-checks';

const checks: CheckCatalogItem[] = [
  {
    id: 'web-check',
    label: 'Web',
    configured: true,
    enabled: true,
    requiredCredentials: [],
    supportedTargetKinds: ['domain', 'url'],
  },
  {
    id: 'ip-check',
    label: 'IP',
    configured: true,
    enabled: true,
    requiredCredentials: [],
    supportedTargetKinds: ['ip'],
  },
  {
    id: 'identity-check',
    label: 'Identidade',
    configured: true,
    enabled: true,
    requiredCredentials: [],
    supportedTargetKinds: ['email', 'username'],
  },
];

describe('getCompatibleChecks', () => {
  it('mantém o catálogo completo enquanto o alvo está vazio', () => {
    expect(getCompatibleChecks(checks, null).map((check) => check.id)).toEqual([
      'web-check',
      'ip-check',
      'identity-check',
    ]);
  });

  it('retorna somente checks compatíveis com o tipo inferido', () => {
    expect(getCompatibleChecks(checks, 'ip').map((check) => check.id)).toEqual([
      'ip-check',
    ]);
    expect(
      getCompatibleChecks(checks, 'domain').map((check) => check.id),
    ).toEqual(['web-check']);
  });
});
