import { describe, expect, it } from 'vitest';
import type { CheckCatalogItem } from '@osint-pier/contracts';
import type { CardState } from '../../components/checks/ResultCard';
import {
  buildAnalysisExport,
  createAnalysisExportHtml,
  createAnalysisExportFilename,
  serializeAnalysisExport,
} from './analysis-export';

const checks: CheckCatalogItem[] = [
  {
    id: 'dns-records',
    label: 'DNS Records',
    configured: true,
    enabled: true,
    requiredCredentials: [],
    supportedTargetKinds: ['domain', 'ip', 'url'],
  },
  {
    id: 'external-check',
    label: 'External Check',
    configured: true,
    enabled: true,
    requiredCredentials: ['EXTERNAL_API_KEY'],
    supportedTargetKinds: ['domain', 'ip', 'url'],
  },
];

describe('analysis export', () => {
  it('gera um documento versionado com resultados e falhas de request', () => {
    const states: Record<string, CardState> = {
      'dns-records': {
        status: 'done',
        result: {
          id: 'dns-records',
          status: 'success',
          data: { addresses: ['203.0.113.10'] },
          source: 'DNS',
          durationMs: 12,
        },
      },
      'external-check': {
        status: 'request-error',
        message: 'Serviço temporariamente indisponível.',
        statusCode: 503,
      },
    };

    const report = buildAnalysisExport({
      target: 'example.com',
      checks,
      states,
      generatedAt: new Date('2026-08-20T12:30:45.000Z'),
    });

    expect(report).toMatchObject({
      schemaVersion: 1,
      application: 'OSINT PIER',
      generatedAt: '2026-08-20T12:30:45.000Z',
      target: 'example.com',
      summary: {
        total: 2,
        success: 1,
        error: 0,
        skipped: 0,
        requestErrors: 1,
        attention: 1,
      },
    });
    expect(report.checks).toHaveLength(2);
    expect(serializeAnalysisExport(report).endsWith('\n')).toBe(true);
  });

  it('impede exportação de uma análise ainda em andamento', () => {
    expect(() =>
      buildAnalysisExport({
        target: 'example.com',
        checks,
        states: {
          'dns-records': { status: 'loading' },
          'external-check': { status: 'idle' },
        },
      }),
    ).toThrow('A análise precisa terminar antes da exportação.');
  });

  it('gera nome de arquivo seguro e previsível', () => {
    expect(
      createAnalysisExportFilename(
        'https://Example.com/path?q=one',
        '2026-08-20T12:30:45.000Z',
      ),
    ).toBe('osint-pier_example.com-path-q-one_2026-08-20T12-30-45Z.json');
  });

  it('gera HTML de impressão sem interpretar o alvo ou os dados', () => {
    const report = buildAnalysisExport({
      target: '<example.test>',
      checks,
      states: {
        'dns-records': {
          status: 'done',
          result: {
            id: 'dns-records',
            status: 'success',
            data: { note: '<script>alert(1)</script>' },
            source: 'DNS',
            durationMs: 8,
          },
        },
        'external-check': {
          status: 'request-error',
          message: 'Falha de rede',
        },
      },
      generatedAt: new Date('2026-08-20T12:30:45.000Z'),
    });

    const html = createAnalysisExportHtml(report);
    expect(html).toContain('&lt;example.test&gt;');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('Falha na requisição');
    expect(html).toContain('Salvar como PDF');
    expect(html).toContain('class="brand-lockup"');
    expect(html).toContain('class="brand-mark__svg"');
    expect(html).toContain('>PierSec</span>');
  });
});
