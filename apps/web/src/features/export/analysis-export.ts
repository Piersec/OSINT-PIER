import type { CheckCatalogItem, CheckResult } from '@osint-pier/contracts';
import type { CardState } from '../../components/checks/ResultCard';

interface ExportedCheckResult extends CheckResult {
  label: string;
}

interface ExportedRequestError {
  id: string;
  label: string;
  status: 'request-error';
  error: string;
  statusCode?: number;
  retryAfterSeconds?: number;
}

export interface AnalysisExport {
  schemaVersion: 1;
  application: 'OSINT PIER';
  generatedAt: string;
  target: string;
  summary: {
    total: number;
    success: number;
    error: number;
    skipped: number;
    requestErrors: number;
    attention: number;
  };
  checks: Array<ExportedCheckResult | ExportedRequestError>;
}

export function buildAnalysisExport({
  target,
  checks,
  states,
  generatedAt = new Date(),
}: {
  target: string;
  checks: CheckCatalogItem[];
  states: Record<string, CardState>;
  generatedAt?: Date;
}): AnalysisExport {
  const exportedChecks = checks.map((check) => {
    const state = states[check.id];
    if (!state || state.status === 'idle' || state.status === 'loading') {
      throw new Error('A análise precisa terminar antes da exportação.');
    }

    if (state.status === 'request-error') {
      return {
        id: check.id,
        label: check.label,
        status: 'request-error' as const,
        error: state.message,
        ...(state.statusCode === undefined
          ? {}
          : { statusCode: state.statusCode }),
        ...(state.retryAfterSeconds === undefined
          ? {}
          : { retryAfterSeconds: state.retryAfterSeconds }),
      };
    }

    return { label: check.label, ...state.result };
  });

  const success = exportedChecks.filter(
    (result) => result.status === 'success',
  ).length;
  const error = exportedChecks.filter(
    (result) => result.status === 'error',
  ).length;
  const skipped = exportedChecks.filter(
    (result) => result.status === 'skipped',
  ).length;
  const requestErrors = exportedChecks.filter(
    (result) => result.status === 'request-error',
  ).length;

  return {
    schemaVersion: 1,
    application: 'OSINT PIER',
    generatedAt: generatedAt.toISOString(),
    target,
    summary: {
      total: checks.length,
      success,
      error,
      skipped,
      requestErrors,
      attention: error + skipped + requestErrors,
    },
    checks: exportedChecks,
  };
}

export function serializeAnalysisExport(report: AnalysisExport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function createAnalysisExportFilename(
  target: string,
  generatedAt: string,
): string {
  const targetSlug = target
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/[^a-z0-9.-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .toLowerCase();
  const timestamp = generatedAt.replace(/\.\d{3}Z$/, 'Z').replaceAll(':', '-');

  return `osint-pier_${targetSlug || 'analise'}_${timestamp}.json`;
}

export function downloadAnalysisExport(report: AnalysisExport): void {
  const blob = new Blob([serializeAnalysisExport(report)], {
    type: 'application/json;charset=utf-8',
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = createAnalysisExportFilename(
    report.target,
    report.generatedAt,
  );
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
}
