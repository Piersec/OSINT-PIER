// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import type { CardState } from '../../components/checks/ResultCard';
import {
  analysisSessionStorageKey,
  clearAnalysisSession,
  readAnalysisSession,
  writeAnalysisSession,
} from './analysis-session';

afterEach(() => window.sessionStorage.clear());

describe('analysis session storage', () => {
  it('restaura resultados curados e converte requests em andamento para idle', () => {
    const states: Record<string, CardState> = {
      'shodan-vulnerabilities': {
        status: 'done',
        result: {
          id: 'shodan-vulnerabilities',
          status: 'success',
          data: { total: 2, kevCount: 1 },
          source: 'test',
          durationMs: 42,
        },
      },
      'http-headers': { status: 'loading' },
    };

    writeAnalysisSession({
      target: 'example.com',
      targetKind: 'domain',
      selectedCheckIds: ['shodan-vulnerabilities', 'http-headers'],
      states,
      history: [],
    });

    expect(
      window.sessionStorage.getItem(analysisSessionStorageKey),
    ).toBeTruthy();
    expect(readAnalysisSession()).toMatchObject({
      target: 'example.com',
      targetKind: 'domain',
      states: {
        'shodan-vulnerabilities': states['shodan-vulnerabilities'],
        'http-headers': { status: 'idle' },
      },
    });
  });

  it('ignora JSON corrompido sem lançar erro', () => {
    window.sessionStorage.setItem(analysisSessionStorageKey, '{invalid');
    expect(readAnalysisSession()).toBeNull();
  });

  it('limpa somente a sessão ativa quando uma nova análise é iniciada', () => {
    window.sessionStorage.setItem(
      analysisSessionStorageKey,
      '{"target":"piersec.com.br"}',
    );

    clearAnalysisSession();

    expect(
      window.sessionStorage.getItem(analysisSessionStorageKey),
    ).toBeNull();
  });
});
