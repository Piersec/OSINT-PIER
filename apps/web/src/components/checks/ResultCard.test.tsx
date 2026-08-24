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

  it('mantém a classificação de endereço privado no renderer genérico', () => {
    render(
      <ResultCard
        check={{ ...check, id: 'abuse-ipdb', label: 'AbuseIPDB' }}
        state={{
          status: 'done',
          result: {
            id: 'abuse-ipdb',
            status: 'success',
            data: {
              resolvedAddresses: ['192.168.1.10'],
              scope: 'private-or-reserved',
            },
            source: 'Local address classification',
            durationMs: 1,
          },
        }}
      />,
    );

    expect(screen.getByText('Escopo')).toBeTruthy();
    expect(screen.getByText('private-or-reserved')).toBeTruthy();
    expect(screen.queryByText(/denúncias recentes/)).toBeNull();
  });
});
