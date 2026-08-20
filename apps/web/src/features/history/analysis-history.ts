import type { CardState } from '../../components/checks/ResultCard';
import type { TargetKind } from '@osint-pier/contracts';

export interface AnalysisHistoryEntry {
  id: string;
  target: string;
  targetKind: TargetKind;
  completedAt: string;
  total: number;
  success: number;
  attention: number;
}

export function createAnalysisHistoryEntry({
  target,
  targetKind = 'domain',
  states,
  completedAt = new Date(),
}: {
  target: string;
  targetKind?: TargetKind;
  states: CardState[];
  completedAt?: Date;
}): AnalysisHistoryEntry {
  const success = states.filter(
    (state) => state.status === 'done' && state.result.status === 'success',
  ).length;
  const attention = states.filter(
    (state) =>
      state.status === 'request-error' ||
      (state.status === 'done' && state.result.status !== 'success'),
  ).length;

  return {
    id: `${completedAt.toISOString()}-${target}`,
    target,
    targetKind,
    completedAt: completedAt.toISOString(),
    total: states.length,
    success,
    attention,
  };
}
