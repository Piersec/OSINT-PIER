import {
  CheckResultSchema,
  TargetKindSchema,
  type TargetKind,
} from '@osint-pier/contracts';
import type { CardState } from '../../components/checks/ResultCard';
import type { AnalysisHistoryEntry } from '../history/analysis-history';

const storageKey = 'osint-pier-analysis-session-v1';

export interface AnalysisSession {
  target: string | null;
  targetKind: TargetKind | 'auto';
  selectedCheckIds: string[] | null;
  states: Record<string, CardState>;
  history: AnalysisHistoryEntry[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeState(value: unknown): CardState | null {
  if (!isRecord(value) || typeof value.status !== 'string') return null;
  if (value.status === 'idle') return { status: 'idle' };
  if (value.status === 'done') {
    const result = CheckResultSchema.safeParse(value.result);
    if (result.success) return { status: 'done', result: result.data };
  }
  if (value.status === 'request-error' && typeof value.message === 'string') {
    return {
      status: 'request-error',
      message: value.message,
      ...(typeof value.statusCode === 'number'
        ? { statusCode: value.statusCode }
        : {}),
      ...(typeof value.retryAfterSeconds === 'number'
        ? { retryAfterSeconds: value.retryAfterSeconds }
        : {}),
    };
  }
  // A request cannot resume after a remount. Leaving it idle allows a new run.
  if (value.status === 'loading') return { status: 'idle' };
  return null;
}

function normalizeStates(value: unknown): Record<string, CardState> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([id, state]) => [id, normalizeState(state)] as const)
      .filter((entry): entry is [string, CardState] => entry[1] !== null),
  );
}

function normalizeHistory(value: unknown): AnalysisHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is AnalysisHistoryEntry =>
      isRecord(entry) &&
      typeof entry.id === 'string' &&
      typeof entry.target === 'string' &&
      typeof entry.targetKind === 'string' &&
      TargetKindSchema.safeParse(entry.targetKind).success &&
      typeof entry.completedAt === 'string' &&
      typeof entry.total === 'number' &&
      typeof entry.success === 'number' &&
      typeof entry.attention === 'number',
  );
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && Boolean(window.sessionStorage);
}

export function readAnalysisSession(): AnalysisSession | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;

    const target = typeof parsed.target === 'string' ? parsed.target : null;
    const targetKind =
      parsed.targetKind === 'auto'
        ? 'auto'
        : TargetKindSchema.safeParse(parsed.targetKind).success
          ? (parsed.targetKind as TargetKind)
          : 'auto';
    const selectedCheckIds =
      parsed.selectedCheckIds === null
        ? null
        : Array.isArray(parsed.selectedCheckIds) &&
            parsed.selectedCheckIds.every((id) => typeof id === 'string')
          ? parsed.selectedCheckIds
          : null;

    return {
      target,
      targetKind,
      selectedCheckIds,
      states: normalizeStates(parsed.states),
      history: normalizeHistory(parsed.history),
    };
  } catch {
    return null;
  }
}

export function writeAnalysisSession(session: AnalysisSession): void {
  if (!canUseStorage()) return;
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(session));
  } catch {
    // Private browsing or a full session quota must not break the analysis.
  }
}

export function clearAnalysisSession(): void {
  if (!canUseStorage()) return;
  try {
    window.sessionStorage.removeItem(storageKey);
  } catch {
    // Ignore storage restrictions; the in-memory session remains available.
  }
}

export { storageKey as analysisSessionStorageKey };
