import type { CheckCatalogItem } from '@osint-pier/contracts';
import type { CardState } from '../../components/checks/ResultCard';

export function getSuccessfulChecks(
  checks: CheckCatalogItem[],
  states: Record<string, CardState>,
): CheckCatalogItem[] {
  return checks.filter((check) => {
    const state = states[check.id];
    return state?.status === 'done' && state.result.status === 'success';
  });
}
