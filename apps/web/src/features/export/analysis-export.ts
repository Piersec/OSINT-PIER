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

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatExportValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '—';
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return escapeHtml(value);
  }
  return `<pre>${escapeHtml(JSON.stringify(value, null, 2))}</pre>`;
}

function exportStatusLabel(status: string): string {
  return (
    {
      success: 'Sucesso',
      error: 'Erro',
      skipped: 'Ignorado',
      'request-error': 'Falha na requisição',
    }[status] ?? status
  );
}

export function createAnalysisExportHtml(report: AnalysisExport): string {
  const generatedAt = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(report.generatedAt));
  const checks = report.checks
    .map((check) => {
      const data = 'data' in check ? check.data : undefined;
      const details = [
        'source' in check && check.source
          ? `<div class="detail"><b>Fonte</b><span>${escapeHtml(check.source)}</span></div>`
          : '',
        'durationMs' in check && check.durationMs !== undefined
          ? `<div class="detail"><b>Duração</b><span>${escapeHtml(`${check.durationMs} ms`)}</span></div>`
          : '',
        'error' in check && check.error
          ? `<div class="detail detail--error"><b>Mensagem</b><span>${escapeHtml(check.error)}</span></div>`
          : '',
      ].join('');
      return `<article class="check">
        <header><div><h2>${escapeHtml(check.label)}</h2><span class="check-id">${escapeHtml(check.id)}</span></div><span class="status status--${escapeHtml(check.status)}">${escapeHtml(exportStatusLabel(check.status))}</span></header>
        <div class="details">${details || '<div class="detail"><b>Dados</b><span>Sem dados adicionais.</span></div>'}</div>
        ${data === undefined ? '' : `<div class="data"><b>Dados curados</b>${formatExportValue(data)}</div>`}
      </article>`;
    })
    .join('');

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(`OSINT Pier — ${report.target}`)}</title>
    <style>
      :root { color-scheme: light; font-family: Arial, Helvetica, sans-serif; color: #172326; background: #fff; }
      * { box-sizing: border-box; }
      body { max-width: 900px; margin: 0 auto; padding: 42px 34px; }
      .brand { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding-bottom: 22px; border-bottom: 3px solid #08a7c3; }
      .brand strong { color: #0787a0; font-size: 22px; letter-spacing: .08em; text-transform: uppercase; }
      .brand span { color: #667071; font-size: 11px; }
      h1 { margin: 34px 0 8px; font-size: 32px; line-height: 1.1; }
      .target { margin: 0 0 26px; color: #566366; font-size: 14px; overflow-wrap: anywhere; }
      .summary { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 30px; }
      .metric { padding: 13px; border: 1px solid #d8e1e2; border-radius: 10px; background: #f7fafb; }
      .metric b { display: block; font-size: 20px; }
      .metric span { color: #687476; font-size: 10px; text-transform: uppercase; letter-spacing: .05em; }
      .check { break-inside: avoid; margin: 0 0 12px; padding: 18px; border: 1px solid #d8e1e2; border-radius: 12px; }
      .check header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
      .check h2 { margin: 0; font-size: 17px; }
      .check-id { display: block; margin-top: 4px; color: #778385; font-size: 10px; }
      .status { padding: 5px 8px; border-radius: 999px; color: #fff; background: #5d7074; font-size: 10px; font-weight: 700; white-space: nowrap; }
      .status--success { background: #198754; } .status--error, .status--request-error { background: #c63e4b; } .status--skipped { background: #a16e1d; }
      .details { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 15px; }
      .detail { display: grid; gap: 4px; min-width: 150px; color: #455356; font-size: 11px; }
      .detail b, .data > b { color: #6b7779; font-size: 9px; letter-spacing: .06em; text-transform: uppercase; }
      .detail--error span { color: #b52e3c; }
      .data { margin-top: 15px; padding-top: 13px; border-top: 1px solid #e6eded; color: #29383a; font-size: 11px; line-height: 1.5; }
      pre { max-height: 360px; margin: 8px 0 0; padding: 10px; overflow: auto; border-radius: 8px; color: #354346; background: #f5f8f8; font: 10px/1.5 Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
      footer { margin-top: 32px; padding-top: 15px; border-top: 1px solid #d8e1e2; color: #7b8788; font-size: 10px; }
      @media (max-width: 620px) { body { padding: 25px 16px; } .summary { grid-template-columns: repeat(2, 1fr); } .brand { align-items: flex-start; flex-direction: column; } }
      @media print { body { padding: 0; } .check { page-break-inside: avoid; } }
    </style>
  </head>
  <body>
    <div class="brand"><strong>OSINT Pier</strong><span>Relatório de análise · ${escapeHtml(generatedAt)}</span></div>
    <h1>Relatório de investigação</h1>
    <p class="target"><b>Alvo:</b> ${escapeHtml(report.target)}</p>
    <section class="summary" aria-label="Resumo">
      <div class="metric"><b>${report.summary.total}</b><span>Checks</span></div>
      <div class="metric"><b>${report.summary.success}</b><span>Sucesso</span></div>
      <div class="metric"><b>${report.summary.error}</b><span>Erros</span></div>
      <div class="metric"><b>${report.summary.skipped}</b><span>Ignorados</span></div>
      <div class="metric"><b>${report.summary.attention}</b><span>Atenção</span></div>
    </section>
    <main>${checks}</main>
    <footer>Gerado localmente pelo OSINT Pier. Este relatório contém apenas os dados curados retornados pelos checks. Na caixa de impressão, escolha “Salvar como PDF” para guardar o arquivo.</footer>
  </body>
</html>`;
}

/** Opens a print-friendly report; the browser's print dialog can save it as PDF. */
export function printAnalysisExport(report: AnalysisExport): void {
  const printWindow = window.open('', '_blank', 'popup,width=900,height=1100');
  if (!printWindow) {
    window.alert('Permita pop-ups para abrir o relatório PDF.');
    return;
  }
  printWindow.document.open();
  printWindow.document.write(createAnalysisExportHtml(report));
  printWindow.document.close();
  window.setTimeout(() => {
    if (printWindow.closed) return;
    printWindow.focus();
    printWindow.print();
  }, 250);
}
