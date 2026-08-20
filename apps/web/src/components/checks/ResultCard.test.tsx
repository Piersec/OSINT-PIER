// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CheckCatalogItem } from '@osint-pier/contracts';
import { ResultCard } from './ResultCard';

const check: CheckCatalogItem = {
  id: 'external-check',
  label: 'External Check',
  configured: false,
  enabled: true,
  requiredCredentials: ['EXTERNAL_API_KEY'],
  supportedTargetKinds: ['domain', 'ip', 'url'],
};

afterEach(cleanup);

describe('ResultCard', () => {
  it('direciona checks pulados ao painel de credenciais sem oferecer retry', () => {
    render(
      <ResultCard
        check={check}
        onRetry={vi.fn()}
        state={{
          status: 'done',
          result: {
            id: check.id,
            status: 'skipped',
            error: 'Credencial ausente.',
            source: 'configuration',
            durationMs: 1,
          },
        }}
      />,
    );

    expect(
      screen
        .getByRole('link', { name: 'Configurar credencial' })
        .getAttribute('href'),
    ).toBe('#credentials');
    expect(
      screen.queryByRole('button', { name: 'Tentar novamente' }),
    ).toBeNull();
  });

  it('explica rate limit sem oferecer retry imediato', () => {
    render(
      <ResultCard
        check={check}
        onRetry={vi.fn()}
        state={{
          status: 'request-error',
          message: 'Limite de análises atingido.',
          statusCode: 429,
          retryAfterSeconds: 30,
        }}
      />,
    );

    expect(
      screen.getByText(/Aguarde aproximadamente 30 segundos/),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Tentar novamente' }),
    ).toBeNull();
  });

  it('permite repetir uma falha isolada de plugin', () => {
    const onRetry = vi.fn();
    render(
      <ResultCard
        check={check}
        onRetry={onRetry}
        state={{
          status: 'done',
          result: {
            id: check.id,
            status: 'error',
            error: 'Serviço externo indisponível.',
            source: 'external',
            durationMs: 1,
          },
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
