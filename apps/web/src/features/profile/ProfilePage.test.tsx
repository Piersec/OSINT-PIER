// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';

vi.mock('../../lib/supabase', () => ({
  supabase: null,
}));

import {
  PasswordChangeForm,
  PasswordRotationModal,
  ProfilePage,
} from './ProfilePage';

afterEach(cleanup);

const user = {
  id: 'user-1',
  email: 'analyst@example.com',
  user_metadata: { full_name: 'Analista Pier' },
} as unknown as User;

describe('ProfilePage', () => {
  it('exibe identidade, upload de avatar e preparação para MFA', () => {
    render(<ProfilePage onUserUpdated={() => undefined} user={user} />);

    expect(screen.getByRole('heading', { name: 'Seu perfil' })).toBeTruthy();
    expect(screen.getByLabelText('Foto de perfil')).toBeTruthy();
    expect(screen.getByLabelText('Escolher foto')).toBeTruthy();
    expect(screen.getByText('Autenticação multifator')).toBeTruthy();
  });

  it('não libera a troca enquanto a nova senha não for forte', () => {
    render(<PasswordChangeForm onUserUpdated={() => undefined} user={user} />);

    expect(
      screen.getByRole('button', { name: 'Atualizar senha' }),
    ).toHaveProperty('disabled', true);
  });

  it('apresenta a troca obrigatória sem opção de fechar', () => {
    render(
      <PasswordRotationModal onUserUpdated={() => undefined} user={user} />,
    );

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(
      screen.getByRole('heading', {
        name: 'Sua conta precisa de uma senha nova',
      }),
    ).toBeTruthy();
    expect(screen.getByText('Obrigatório')).toBeTruthy();
  });
});
