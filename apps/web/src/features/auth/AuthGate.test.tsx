// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/supabase', () => ({
  supabase: null,
}));

import { AuthGate } from './AuthGate';

afterEach(cleanup);

describe('AuthGate', () => {
  it('mantém o formulário de login visível quando o Supabase não está configurado', async () => {
    render(
      <AuthGate>
        <div>Dashboard protegido</div>
      </AuthGate>,
    );

    expect(
      await screen.findByRole('heading', { name: 'Entrar na central' }),
    ).toBeTruthy();
    expect(screen.getByLabelText('E-mail')).toBeTruthy();
    expect(screen.getByLabelText('Senha')).toBeTruthy();
    expect(
      screen.getByText(
        /Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/,
      ),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Entrar' })).toHaveProperty(
      'disabled',
      true,
    );
    expect(screen.queryByText('Dashboard protegido')).toBeNull();
  });
});
