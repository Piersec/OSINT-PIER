// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/supabase', () => ({
  supabase: null,
}));

import { MfaChallengeScreen } from './MfaChallenge';

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
});
