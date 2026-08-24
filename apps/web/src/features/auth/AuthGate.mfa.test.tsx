// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({
  auth: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    mfa: {
      getAuthenticatorAssuranceLevel: vi.fn(),
      listFactors: vi.fn(),
    },
  },
}));

vi.mock('../../lib/supabase', () => ({
  supabase: supabaseMock,
}));

import { AuthGate } from './AuthGate';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AuthGate optional MFA prompt', () => {
  it('solicita MFA para contas sem fator verificado', async () => {
    supabaseMock.auth.getSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'user-1',
            email: 'analyst@example.com',
            user_metadata: { password_changed_at: '2026-08-24T10:00:00.000Z' },
          },
        },
      },
      error: null,
    });
    supabaseMock.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    supabaseMock.auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: 'aal1', nextLevel: 'aal1' },
      error: null,
    });
    supabaseMock.auth.mfa.listFactors.mockResolvedValue({
      data: { totp: [] },
      error: null,
    });

    render(
      <AuthGate>
        <div>Dashboard protegido</div>
      </AuthGate>,
    );

    expect(
      await screen.findByRole('dialog', { name: 'Ative o segundo fator' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ativar agora' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Ativar mais tarde' }),
    ).toBeTruthy();

    screen.getByRole('button', { name: 'Ativar mais tarde' }).click();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText('Dashboard protegido')).toBeTruthy();
  });
});
