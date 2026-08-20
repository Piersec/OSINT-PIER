import type { CheckResult } from '@osint-pier/contracts';

export function success(
  id: string,
  source: string,
  data: unknown,
): CheckResult {
  return { id, status: 'success', data, source, durationMs: 0 };
}

export function failure(
  id: string,
  source: string,
  error: string,
): CheckResult {
  return { id, status: 'error', error, source, durationMs: 0 };
}
