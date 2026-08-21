'use client';

import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import {
  analyzePassword,
  type PasswordAnalysis,
} from '../auth/password-strength';

const AVATAR_BUCKET = 'avatars';
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const avatarExtensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

interface ProfilePageProps {
  user: User;
  onUserUpdated: (user: User) => void;
}

interface PasswordChangeFormProps {
  forced?: boolean;
  onComplete?: () => void;
  onUserUpdated: (user: User) => void;
  user: User;
}

function metadataString(user: User, key: string): string | null {
  const value = user.user_metadata?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function userInitials(user: User): string {
  const name = metadataString(user, 'full_name') ?? user.email ?? 'OSINT';
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    const firstWord = words[0] ?? '';
    const lastWord = words[words.length - 1] ?? '';
    return `${firstWord[0] ?? ''}${lastWord[0] ?? ''}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function PasswordStrengthMeter({ analysis }: { analysis: PasswordAnalysis }) {
  return (
    <div className="password-meter" aria-live="polite">
      <div className="password-meter__heading">
        <span>Força da senha</span>
        <strong
          className={`password-meter__label password-meter__label--${analysis.strength}`}
        >
          {analysis.label}
        </strong>
      </div>
      <div className="password-meter__track" aria-hidden="true">
        {[1, 2, 3].map((step) => (
          <span
            className={
              step <=
              (analysis.strength === 'strong'
                ? 3
                : analysis.strength === 'fair'
                  ? 2
                  : 1)
                ? `password-meter__segment password-meter__segment--${analysis.strength}`
                : 'password-meter__segment'
            }
            key={step}
          />
        ))}
      </div>
      <small>{analysis.feedback}</small>
    </div>
  );
}

function passwordErrorMessage(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes('password')) {
    return 'O Supabase recusou essa senha. Use uma combinação mais forte e tente novamente.';
  }
  return 'Não foi possível atualizar a senha agora. Tente novamente.';
}

function avatarErrorMessage(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes('policy') || normalized.includes('permission')) {
    return 'O armazenamento de avatares ainda não está disponível neste ambiente.';
  }
  return 'Não foi possível atualizar sua foto agora. Tente novamente.';
}

export function PasswordChangeForm({
  forced = false,
  onComplete,
  onUserUpdated,
  user,
}: PasswordChangeFormProps) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const analysis = useMemo(() => analyzePassword(password), [password]);
  const mismatch = confirmation.length > 0 && confirmation !== password;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!supabase) {
      setError('O serviço de autenticação não está configurado.');
      return;
    }
    if (analysis.strength !== 'strong') {
      setError('Crie uma senha forte para continuar.');
      return;
    }
    if (password !== confirmation) {
      setError('As senhas não conferem.');
      return;
    }

    setBusy(true);
    const changedAt = new Date().toISOString();
    const { data, error: updateError } = await supabase.auth.updateUser({
      password,
      data: { password_changed_at: changedAt },
    });
    setBusy(false);

    if (updateError) {
      setError(passwordErrorMessage(updateError.message));
      return;
    }

    const updatedUser =
      data.user ??
      ({
        ...user,
        user_metadata: {
          ...user.user_metadata,
          password_changed_at: changedAt,
        },
      } as User);
    onUserUpdated(updatedUser);
    setPassword('');
    setConfirmation('');
    setSuccess('Senha atualizada com sucesso.');
    onComplete?.();
  }

  return (
    <form
      className={`profile-password-form ${forced ? 'profile-password-form--forced' : ''}`}
      onSubmit={handleSubmit}
    >
      <div className="profile-form-heading">
        <div>
          <span className="eyebrow">Segurança da conta</span>
          <h3>{forced ? 'Crie uma senha nova' : 'Trocar senha'}</h3>
        </div>
        {forced && <span className="profile-required-badge">Obrigatório</span>}
      </div>
      <p className="muted profile-form-copy">
        {forced
          ? 'Sua senha inicial é fraca ou ainda não foi atualizada. Escolha uma combinação forte para liberar o painel.'
          : 'A senha precisa ter pelo menos 12 caracteres e combinar diferentes tipos de caracteres.'}
      </p>

      <label
        className="profile-field"
        htmlFor={forced ? 'forced-new-password' : 'new-password'}
      >
        Nova senha
        <input
          autoComplete="new-password"
          autoFocus={forced}
          id={forced ? 'forced-new-password' : 'new-password'}
          minLength={12}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Crie uma senha única"
          required
          type="password"
          value={password}
        />
      </label>

      {password && <PasswordStrengthMeter analysis={analysis} />}

      <label
        className="profile-field"
        htmlFor={forced ? 'forced-confirm-password' : 'confirm-password'}
      >
        Confirmar nova senha
        <input
          autoComplete="new-password"
          id={forced ? 'forced-confirm-password' : 'confirm-password'}
          onChange={(event) => setConfirmation(event.target.value)}
          placeholder="Digite a senha novamente"
          required
          type="password"
          value={confirmation}
        />
      </label>

      {mismatch && (
        <p className="profile-form-error" role="alert">
          As senhas não conferem.
        </p>
      )}
      {error && (
        <p className="profile-form-error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="profile-form-success" role="status">
          {success}
        </p>
      )}

      <button
        className="button"
        disabled={
          busy || analysis.strength !== 'strong' || password !== confirmation
        }
        type="submit"
      >
        {busy ? 'Atualizando…' : 'Atualizar senha'}
      </button>
    </form>
  );
}

export function PasswordRotationModal({
  onUserUpdated,
  user,
}: {
  onUserUpdated: (user: User) => void;
  user: User;
}) {
  return (
    <div className="password-modal-backdrop">
      <section
        aria-describedby="password-modal-copy"
        aria-labelledby="password-modal-title"
        aria-modal="true"
        className="password-modal"
        role="dialog"
      >
        <div className="password-modal__signal" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <span className="eyebrow">Primeiro acesso</span>
        <h2 id="password-modal-title">Sua conta precisa de uma senha nova</h2>
        <p className="muted" id="password-modal-copy">
          Por segurança, o painel só será liberado depois que você substituir a
          senha inicial por uma combinação forte.
        </p>
        <PasswordChangeForm
          forced
          onComplete={() => undefined}
          onUserUpdated={onUserUpdated}
          user={user}
        />
      </section>
    </div>
  );
}

export function ProfilePage({ user, onUserUpdated }: ProfilePageProps) {
  const avatarPath = metadataString(user, 'avatar_path');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setAvatarUrl(null);
    if (!supabase || !avatarPath) return () => undefined;

    void supabase.storage
      .from(AVATAR_BUCKET)
      .createSignedUrl(avatarPath, 3600)
      .then(({ data, error }) => {
        if (!active || error) return;
        setAvatarUrl(data.signedUrl);
      });

    return () => {
      active = false;
    };
  }, [avatarPath]);

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setAvatarMessage(null);
    setAvatarError(null);
    const extension = avatarExtensions[file.type];
    if (!extension) {
      setAvatarError('Escolha uma imagem JPG, PNG ou WebP.');
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      setAvatarError('A imagem precisa ter no máximo 2 MB.');
      return;
    }
    if (!supabase) {
      setAvatarError('O serviço de autenticação não está configurado.');
      return;
    }

    setAvatarBusy(true);
    const nextPath = `${user.id}/avatar.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(nextPath, file, {
        cacheControl: '3600',
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      setAvatarBusy(false);
      setAvatarError(avatarErrorMessage(uploadError.message));
      return;
    }

    const { data, error: metadataError } = await supabase.auth.updateUser({
      data: { avatar_path: nextPath },
    });
    if (metadataError) {
      setAvatarBusy(false);
      setAvatarError(
        'A foto foi enviada, mas não foi possível salvar o perfil.',
      );
      return;
    }

    const updatedUser = data.user ?? user;
    onUserUpdated(updatedUser);
    if (avatarPath && avatarPath !== nextPath) {
      await supabase.storage.from(AVATAR_BUCKET).remove([avatarPath]);
    }

    const { data: signedData, error: signedError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .createSignedUrl(nextPath, 3600);
    setAvatarBusy(false);
    if (signedError) {
      setAvatarError('Foto salva. Atualize a página para visualizá-la.');
      return;
    }
    setAvatarUrl(signedData.signedUrl);
    setAvatarMessage('Foto de perfil atualizada.');
  }

  return (
    <section className="profile-page">
      <div className="page-lead profile-lead">
        <div>
          <span className="eyebrow">Identidade autenticada</span>
          <h2>Seu perfil</h2>
        </div>
        <span className="section-count">Sessão protegida</span>
      </div>
      <p className="muted page-copy profile-intro">
        Atualize sua identidade visual e mantenha as credenciais da conta em
        dia. A senha nunca é exibida nem armazenada pelo frontend.
      </p>

      <div className="profile-grid">
        <section className="profile-card profile-identity-card">
          <div className="profile-card__heading">
            <div>
              <span className="eyebrow">Identidade</span>
              <h3>Como você aparece</h3>
            </div>
            <span className="profile-status-dot">Ativo</span>
          </div>
          <div className="profile-avatar-row">
            <div className="profile-avatar" aria-label="Foto de perfil">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" />
              ) : (
                <span>{userInitials(user)}</span>
              )}
            </div>
            <div>
              <strong>
                {metadataString(user, 'full_name') ?? 'Analista OSINT'}
              </strong>
              <span>{user.email ?? 'E-mail autenticado'}</span>
              <label className="avatar-upload">
                <input
                  accept="image/jpeg,image/png,image/webp"
                  disabled={avatarBusy}
                  onChange={(event) => void handleAvatarChange(event)}
                  type="file"
                />
                {avatarBusy ? 'Enviando foto…' : 'Escolher foto'}
              </label>
            </div>
          </div>
          <p className="profile-help">
            JPG, PNG ou WebP · até 2 MB. A imagem fica em um bucket privado e só
            sua sessão pode acessá-la.
          </p>
          {avatarMessage && (
            <p className="profile-form-success" role="status">
              {avatarMessage}
            </p>
          )}
          {avatarError && (
            <p className="profile-form-error" role="alert">
              {avatarError}
            </p>
          )}
        </section>

        <section className="profile-card">
          <PasswordChangeForm onUserUpdated={onUserUpdated} user={user} />
        </section>

        <section className="profile-card profile-mfa-card">
          <div className="profile-card__heading">
            <div>
              <span className="eyebrow">Próxima camada</span>
              <h3>Autenticação multifator</h3>
            </div>
            <span className="profile-coming-badge">Em breve</span>
          </div>
          <p className="muted">
            O perfil já está preparado para conectar um autenticador TOTP, como
            Google Authenticator ou 1Password. A ativação será adicionada em uma
            próxima etapa sem alterar sua sessão atual.
          </p>
          <button className="button button--secondary" disabled type="button">
            Configurar MFA em breve
          </button>
        </section>
      </div>
    </section>
  );
}
