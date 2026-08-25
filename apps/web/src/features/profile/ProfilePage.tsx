'use client';

import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Factor, User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import {
  analyzePassword,
  generateStrongPassword,
  type PasswordAnalysis,
} from '../auth/password-strength';

const AVATAR_BUCKET = 'avatars';
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const avatarExtensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

interface PendingMfaEnrollment {
  factorId: string;
  qrCode: string;
  secret: string;
  uri: string;
}

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

function mfaErrorMessage(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes('already') || normalized.includes('factor')) {
    return 'Este autenticador já está vinculado ou não pode ser alterado agora.';
  }
  if (normalized.includes('invalid') || normalized.includes('verification')) {
    return 'O código do autenticador é inválido ou expirou.';
  }
  return 'Não foi possível atualizar o MFA agora. Tente novamente.';
}

function qrCodeSource(qrCode: string): string {
  if (qrCode.startsWith('data:')) return qrCode;
  return `data:image/svg+xml;utf-8,${encodeURIComponent(qrCode)}`;
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
  const [passwordVisible, setPasswordVisible] = useState(false);
  const analysis = useMemo(() => analyzePassword(password), [password]);
  const mismatch = confirmation.length > 0 && confirmation !== password;

  function suggestStrongPassword() {
    try {
      const suggestedPassword = generateStrongPassword();
      setPassword(suggestedPassword);
      setConfirmation(suggestedPassword);
      setPasswordVisible(true);
      setError(null);
      setSuccess(null);
    } catch {
      setError(
        'Não foi possível sugerir uma senha agora. Digite uma combinação forte.',
      );
    }
  }

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
    setPasswordVisible(false);
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

      <div className="profile-field">
        <div className="profile-field__heading">
          <label htmlFor={forced ? 'forced-new-password' : 'new-password'}>
            Nova senha
          </label>
          {forced && (
            <button
              className="profile-field__action"
              onClick={suggestStrongPassword}
              type="button"
            >
              Sugerir senha forte
            </button>
          )}
        </div>
        <input
          autoComplete="new-password"
          autoFocus={forced}
          id={forced ? 'forced-new-password' : 'new-password'}
          minLength={12}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Crie uma senha única"
          required
          type={passwordVisible ? 'text' : 'password'}
          value={password}
        />
        {password && (
          <button
            className="profile-field__visibility"
            onClick={() => setPasswordVisible((visible) => !visible)}
            type="button"
          >
            {passwordVisible ? 'Ocultar senha' : 'Mostrar senha'}
          </button>
        )}
      </div>

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
          type={passwordVisible ? 'text' : 'password'}
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

export function MfaSettings({ user }: { user: User }) {
  const [factors, setFactors] = useState<Factor<'totp', 'verified'>[]>([]);
  const [pendingEnrollment, setPendingEnrollment] =
    useState<PendingMfaEnrollment | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [removingFactorId, setRemovingFactorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<
    'enroll' | 'verify' | 'cancel' | 'remove' | null
  >(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadFactors = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      setError('O serviço de autenticação não está configurado.');
      return;
    }

    setLoading(true);
    const { data, error: factorsError } = await supabase.auth.mfa.listFactors();
    setLoading(false);
    if (factorsError || !data) {
      setError(
        factorsError
          ? mfaErrorMessage(factorsError.message)
          : 'Não foi possível consultar os autenticadores ativos.',
      );
      return;
    }

    setFactors(data.totp);
  }, []);

  useEffect(() => {
    void loadFactors();
  }, [loadFactors]);

  async function startEnrollment() {
    if (!supabase) {
      setError('O serviço de autenticação não está configurado.');
      return;
    }

    setBusyAction('enroll');
    setError(null);
    setMessage(null);
    const { data, error: enrollmentError } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: user.email ? `OSINT Pier · ${user.email}` : 'OSINT Pier',
      issuer: 'OSINT Pier',
    });
    setBusyAction(null);

    if (enrollmentError || !data) {
      setError(
        enrollmentError
          ? mfaErrorMessage(enrollmentError.message)
          : 'Não foi possível iniciar a configuração do autenticador.',
      );
      return;
    }

    setPendingEnrollment({
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
      uri: data.totp.uri,
    });
    setVerificationCode('');
  }

  async function verifyEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !pendingEnrollment) return;
    if (!/^\d{6}$/.test(verificationCode)) {
      setError('Digite o código de 6 dígitos exibido no autenticador.');
      return;
    }

    setBusyAction('verify');
    setError(null);
    const { data: challengeData, error: challengeError } =
      await supabase.auth.mfa.challenge({
        factorId: pendingEnrollment.factorId,
      });
    if (challengeError || !challengeData) {
      setBusyAction(null);
      setError(
        challengeError
          ? mfaErrorMessage(challengeError.message)
          : 'Não foi possível iniciar a confirmação do autenticador.',
      );
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      challengeId: challengeData.id,
      code: verificationCode,
      factorId: pendingEnrollment.factorId,
    });
    setBusyAction(null);
    if (verifyError) {
      setError(mfaErrorMessage(verifyError.message));
      return;
    }

    setPendingEnrollment(null);
    setVerificationCode('');
    setMessage('Autenticação multifator ativada nesta conta.');
    await loadFactors();
  }

  async function cancelEnrollment() {
    if (!supabase || !pendingEnrollment) return;

    setBusyAction('cancel');
    setError(null);
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({
      factorId: pendingEnrollment.factorId,
    });
    setBusyAction(null);
    if (unenrollError) {
      setError(mfaErrorMessage(unenrollError.message));
      return;
    }

    setPendingEnrollment(null);
    setVerificationCode('');
    setMessage('Configuração do autenticador cancelada.');
  }

  async function removeFactor(factorId: string) {
    if (!supabase) return;
    if (removingFactorId !== factorId) {
      setRemovingFactorId(factorId);
      setError(null);
      return;
    }

    setBusyAction('remove');
    setError(null);
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({
      factorId,
    });
    setBusyAction(null);
    setRemovingFactorId(null);
    if (unenrollError) {
      setError(mfaErrorMessage(unenrollError.message));
      return;
    }

    setFactors((current) => current.filter((factor) => factor.id !== factorId));
    setMessage('Autenticador removido desta conta.');
  }

  return (
    <section className="profile-card profile-mfa-card">
      <div className="profile-card__heading">
        <div>
          <span className="eyebrow">Próxima camada</span>
          <h3>Autenticação multifator</h3>
        </div>
        <span
          className={
            factors.length ? 'profile-status-dot' : 'profile-coming-badge'
          }
        >
          {factors.length ? 'Ativo' : 'Não configurado'}
        </span>
      </div>
      <p className="muted">
        Use um autenticador TOTP, como Google Authenticator ou 1Password, para
        adicionar uma segunda confirmação ao login.
      </p>

      {loading && <p className="profile-help">Consultando autenticadores…</p>}

      {!loading && factors.length > 0 && (
        <div className="mfa-factor-list" aria-label="Autenticadores ativos">
          {factors.map((factor) => (
            <div className="mfa-factor-row" key={factor.id}>
              <div>
                <strong>
                  {factor.friendly_name ?? 'Aplicativo autenticador'}
                </strong>
                <span>TOTP ativo · verificado</span>
              </div>
              <button
                className="button button--danger button--small"
                disabled={busyAction === 'remove'}
                onClick={() => void removeFactor(factor.id)}
                type="button"
              >
                {removingFactorId === factor.id
                  ? 'Confirmar remoção'
                  : 'Remover'}
              </button>
            </div>
          ))}
        </div>
      )}

      {!loading && !pendingEnrollment && (
        <button
          className="button button--secondary"
          disabled={busyAction === 'enroll'}
          onClick={() => void startEnrollment()}
          type="button"
        >
          {busyAction === 'enroll'
            ? 'Preparando autenticador…'
            : factors.length
              ? 'Adicionar outro autenticador'
              : 'Configurar autenticador'}
        </button>
      )}

      {pendingEnrollment && (
        <div className="mfa-enrollment">
          <div className="mfa-enrollment__heading">
            <div>
              <span className="eyebrow">Configuração em andamento</span>
              <h4>Escaneie o QR Code</h4>
            </div>
            <span className="section-count">Passo 1 de 2</span>
          </div>
          <div className="mfa-enrollment__body">
            <div className="mfa-qr-frame">
              <img
                alt="QR Code para configurar o autenticador TOTP"
                src={qrCodeSource(pendingEnrollment.qrCode)}
              />
            </div>
            <div className="mfa-enrollment__instructions">
              <p>
                Abra o aplicativo autenticador, escaneie o código e digite o
                número de 6 dígitos gerado por ele.
              </p>
              <label className="mfa-secret">
                <span>Segredo alternativo</span>
                <code>{pendingEnrollment.secret}</code>
                <small>{pendingEnrollment.uri}</small>
              </label>
            </div>
          </div>
          <form className="mfa-verify-form" onSubmit={verifyEnrollment}>
            <label className="profile-field" htmlFor="mfa-enrollment-code">
              Código de confirmação
              <input
                autoComplete="one-time-code"
                id="mfa-enrollment-code"
                inputMode="numeric"
                maxLength={6}
                onChange={(event) =>
                  setVerificationCode(
                    event.target.value.replace(/\D/g, '').slice(0, 6),
                  )
                }
                pattern="[0-9]{6}"
                placeholder="000000"
                required
                type="text"
                value={verificationCode}
              />
            </label>
            <div className="mfa-actions">
              <button
                className="button"
                disabled={
                  busyAction === 'verify' || verificationCode.length !== 6
                }
                type="submit"
              >
                {busyAction === 'verify' ? 'Confirmando…' : 'Ativar MFA'}
              </button>
              <button
                className="button button--ghost"
                disabled={busyAction === 'verify' || busyAction === 'cancel'}
                onClick={() => void cancelEnrollment()}
                type="button"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {message && (
        <p className="profile-form-success" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="profile-form-error" role="alert">
          {error}
        </p>
      )}
    </section>
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

        <MfaSettings user={user} />
      </div>
    </section>
  );
}
