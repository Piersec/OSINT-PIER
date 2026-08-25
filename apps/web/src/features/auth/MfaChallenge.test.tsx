// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/supabase', () => ({
  supabase: null,
}));

import { MfaChallengeScreen, MfaOptionalPrompt } from './MfaChallenge';

afterEach(cleanup);

describe('MfaChallengeScreen', () => {
  it('informa quando a sessão exige MFA mas não há fator disponível', () => {
    render(
      <MfaChallengeScreen
        factorId={null}
        onRetry={() => undefined}
        onSignOut={async () => undefined}
        onVerified={() => undefined}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Confirme sua identidade' }),
    ).toBeTruthy();
    expect(
      screen.getByText(/Não foi possível localizar um autenticador TOTP/),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    ).toBeTruthy();
  });

  it('oferece ativar agora ou deixar a configuração para depois', () => {
    const onActivate = vi.fn();
    const onDismiss = vi.fn();

    render(<MfaOptionalPrompt onActivate={onActivate} onDismiss={onDismiss} />);

    expect(
      screen.getByRole('heading', { name: 'Ative o segundo fator' }),
    ).toBeTruthy();
    screen.getByRole('button', { name: 'Ativar agora' }).click();
    screen.getByRole('button', { name: 'Ativar mais tarde' }).click();

    expect(onActivate).toHaveBeenCalledOnce();
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
