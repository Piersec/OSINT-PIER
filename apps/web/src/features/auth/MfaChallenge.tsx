'use client';

import { type FormEvent, useState } from 'react';
import { supabase } from '../../lib/supabase';

function mfaErrorMessage(message: string): string {
  const normalized = message.toLowerCase();
  if (
    normalized.includes('invalid') ||
    normalized.includes('verification') ||
    normalized.includes('code')
  ) {
    return 'Código inválido ou expirado. Confira o autenticador e tente novamente.';
  }
  return 'Não foi possível validar o autenticador agora. Tente novamente.';
}

export function MfaChallengeScreen({
  factorId,
  onRetry,
  onSignOut,
  onVerified,
}: {
  factorId: string | null;
  onRetry: () => void;
  onSignOut: () => Promise<void>;
  onVerified: () => void;
}) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!supabase || !factorId) {
      setError('Não foi possível localizar o fator MFA desta conta.');
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setError('Digite o código de 6 dígitos do seu autenticador.');
      return;
    }

    setBusy(true);
    const { data: challengeData, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId });
    if (challengeError || !challengeData) {
      setBusy(false);
      setError(
        challengeError
          ? mfaErrorMessage(challengeError.message)
          : 'Não foi possível iniciar a validação MFA.',
      );
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      challengeId: challengeData.id,
      code,
      factorId,
    });
    setBusy(false);

    if (verifyError) {
      setError(mfaErrorMessage(verifyError.message));
      return;
    }

    onVerified();
  }

  return (
    <main className="mfa-challenge-shell">
      <section className="mfa-challenge-card" aria-labelledby="mfa-title">
        <div className="auth-brand">
          <img src="/piersec-logo.svg" alt="" />
          <span>OSINT Pier</span>
        </div>
        <span className="eyebrow">Segundo fator</span>
        <h1 id="mfa-title">Confirme sua identidade</h1>
        <p className="auth-copy">
          Abra seu autenticador e informe o código temporário para continuar na
          central.
        </p>

        {factorId ? (
          <form className="mfa-challenge-form" onSubmit={handleSubmit}>
            <label htmlFor="mfa-login-code">Código do autenticador</label>
            <input
              autoComplete="one-time-code"
              autoFocus
              id="mfa-login-code"
              inputMode="numeric"
              maxLength={6}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
              }
              pattern="[0-9]{6}"
              placeholder="000000"
              required
              type="text"
              value={code}
            />
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="button auth-submit"
              disabled={busy || code.length !== 6}
              type="submit"
            >
              {busy ? 'Verificando…' : 'Continuar'}
            </button>
          </form>
        ) : (
          <div className="mfa-challenge-error" role="alert">
            <p>
              Não foi possível localizar um autenticador TOTP ativo para esta
              sessão.
            </p>
            <button className="button" onClick={onRetry} type="button">
              Tentar novamente
            </button>
          </div>
        )}

        <button
          className="button button--ghost mfa-sign-out"
          onClick={() => void onSignOut()}
          type="button"
        >
          Sair da conta
        </button>
      </section>
    </main>
  );
}

export function MfaCheckErrorScreen({
  message,
  onRetry,
  onSignOut,
}: {
  message: string;
  onRetry: () => void;
  onSignOut: () => Promise<void>;
}) {
  return (
    <main className="mfa-challenge-shell">
      <section className="mfa-challenge-card" aria-labelledby="mfa-error-title">
        <div className="auth-brand">
          <img src="/piersec-logo.svg" alt="" />
          <span>OSINT Pier</span>
        </div>
        <span className="eyebrow">Segurança da sessão</span>
        <h1 id="mfa-error-title">Não foi possível validar o MFA</h1>
        <p className="auth-copy">{message}</p>
        <button className="button auth-submit" onClick={onRetry} type="button">
          Tentar novamente
        </button>
        <button
          className="button button--ghost mfa-sign-out"
          onClick={() => void onSignOut()}
          type="button"
        >
          Sair da conta
        </button>
      </section>
    </main>
  );
}

export function MfaOptionalPrompt({
  onActivate,
  onDismiss,
}: {
  onActivate: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="security-modal-backdrop">
      <section
        aria-labelledby="mfa-optional-title"
        aria-modal="true"
        className="security-modal"
        role="dialog"
      >
        <div className="password-modal__signal" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <span className="eyebrow">Proteção recomendada</span>
        <h2 id="mfa-optional-title">Ative o segundo fator</h2>
        <p>
          Sua conta ainda não tem um autenticador configurado. O MFA adiciona
          uma camada extra de proteção mesmo que sua senha seja descoberta.
        </p>
        <div className="security-modal__actions">
          <button className="button" onClick={onActivate} type="button">
            Ativar agora
          </button>
          <button
            className="button button--ghost"
            onClick={onDismiss}
            type="button"
          >
            Ativar mais tarde
          </button>
        </div>
      </section>
    </div>
  );
}
