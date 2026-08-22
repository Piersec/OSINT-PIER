'use client';

import {
  createContext,
  type FormEvent,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { MfaCheckErrorScreen, MfaChallengeScreen } from './MfaChallenge';
import { PasswordRotationModal } from '../profile/ProfilePage';
import { analyzePassword } from './password-strength';

interface AuthContextValue {
  user: User;
  signOut: () => Promise<void>;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
type MfaState = 'idle' | 'checking' | 'required' | 'verified' | 'error';

function authErrorMessage(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes('email not confirmed')) {
    return 'Este e-mail ainda não foi confirmado no Supabase.';
  }
  if (
    normalized.includes('invalid login credentials') ||
    normalized.includes('invalid password')
  ) {
    return 'E-mail ou senha inválidos.';
  }
  return 'Não foi possível entrar agora. Tente novamente.';
}

function applyStoredTheme() {
  try {
    document.documentElement.dataset.theme =
      window.localStorage.getItem('osint-pier-theme') === 'white'
        ? 'white'
        : 'dark';
  } catch {
    document.documentElement.dataset.theme = 'dark';
  }
}

function LoginForm({
  notice,
  onWeakPassword,
}: {
  notice?: string | null;
  onWeakPassword: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;

    setError(null);
    setSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setSubmitting(false);

    if (signInError) {
      setError(authErrorMessage(signInError.message));
      return;
    }
    if (analyzePassword(password).strength !== 'strong') onWeakPassword();
  }

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="login-title">
        <div className="auth-brand">
          <img src="/piersec-logo.svg" alt="" />
          <span>OSINT Pier</span>
        </div>
        <span className="eyebrow">Acesso interno</span>
        <h1 id="login-title">Entrar na central</h1>
        <p className="auth-copy">
          Use seu e-mail e senha autorizados para acessar as ferramentas de
          investigação.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="auth-email">E-mail</label>
          <input
            autoComplete="username"
            id="auth-email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="seu@email.com"
            required
            type="email"
            value={email}
          />

          <label htmlFor="auth-password">Senha</label>
          <input
            autoComplete="current-password"
            id="auth-password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Digite sua senha"
            required
            type="password"
            value={password}
          />

          {notice && (
            <p className="auth-notice" role="status">
              {notice}
            </p>
          )}

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <button
            className="button auth-submit"
            disabled={submitting || !supabase}
            type="submit"
          >
            {submitting ? 'Validando acesso…' : 'Entrar'}
          </button>
        </form>

        <p className="auth-footnote">
          Acesso restrito. Não há cadastro público.
        </p>
      </section>
    </main>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthGate.');
  return context;
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [mfaState, setMfaState] = useState<MfaState>('idle');
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaError, setMfaError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setMustChangePassword(false);
      return;
    }
    const changedAt = user.user_metadata?.password_changed_at;
    setMustChangePassword(
      !(typeof changedAt === 'string' && changedAt.length > 0),
    );
  }, [user]);

  const passwordRotationRequired = Boolean(
    user &&
    (mustChangePassword ||
      !(
        typeof user.user_metadata?.password_changed_at === 'string' &&
        user.user_metadata.password_changed_at.length > 0
      )),
  );

  const assessMfa = useCallback(async () => {
    if (!user || passwordRotationRequired) {
      setMfaState('idle');
      setMfaFactorId(null);
      setMfaError(null);
      return;
    }
    if (!supabase) {
      setMfaState('verified');
      return;
    }

    setMfaState('checking');
    setMfaError(null);
    const [aalResult, factorsResult] = await Promise.all([
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors(),
    ]);

    if (aalResult.error || factorsResult.error || !aalResult.data) {
      setMfaState('error');
      setMfaFactorId(null);
      setMfaError(
        'Não foi possível confirmar o estado do seu autenticador. A sessão foi mantida bloqueada por segurança.',
      );
      return;
    }

    const factorId = factorsResult.data?.totp?.[0]?.id ?? null;
    const requiresMfa =
      aalResult.data.currentLevel !== 'aal2' &&
      aalResult.data.nextLevel === 'aal2';
    setMfaFactorId(factorId);
    setMfaState(requiresMfa && factorId ? 'required' : 'verified');
  }, [passwordRotationRequired, user]);

  useEffect(() => {
    void assessMfa();
  }, [assessMfa]);

  useEffect(() => {
    applyStoredTheme();
    if (!supabase) {
      setError(
        'Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY para habilitar o login.',
      );
      setLoading(false);
      return;
    }

    let mounted = true;
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!mounted) return;
      if (sessionError) setError('Não foi possível validar a sessão.');
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      setLoading(false);
      setError(null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <main className="auth-shell">
        <div className="auth-loading" role="status">
          Validando sessão…
        </div>
      </main>
    );
  }

  if (!user)
    return (
      <LoginForm
        notice={error}
        onWeakPassword={() => setMustChangePassword(true)}
      />
    );

  function updateAuthenticatedUser(nextUser: User) {
    setUser(nextUser);
    const changedAt = nextUser.user_metadata?.password_changed_at;
    setMustChangePassword(
      !(typeof changedAt === 'string' && changedAt.length > 0),
    );
  }

  async function signOut() {
    await supabase?.auth.signOut();
  }

  if (
    !passwordRotationRequired &&
    (mfaState === 'idle' || mfaState === 'checking')
  ) {
    return (
      <main className="auth-shell">
        <div className="auth-loading" role="status">
          Validando autenticação adicional…
        </div>
      </main>
    );
  }

  if (!passwordRotationRequired && mfaState === 'required') {
    return (
      <MfaChallengeScreen
        factorId={mfaFactorId}
        onRetry={() => void assessMfa()}
        onSignOut={signOut}
        onVerified={() => {
          setMfaState('verified');
          setMfaError(null);
        }}
      />
    );
  }

  if (!passwordRotationRequired && mfaState === 'error') {
    return (
      <MfaCheckErrorScreen
        message={
          mfaError ??
          'Não foi possível validar a autenticação multifator desta sessão.'
        }
        onRetry={() => void assessMfa()}
        onSignOut={signOut}
      />
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        signOut,
        updateUser: updateAuthenticatedUser,
      }}
    >
      {children}
      {mustChangePassword && (
        <PasswordRotationModal
          onUserUpdated={updateAuthenticatedUser}
          user={user}
        />
      )}
    </AuthContext.Provider>
  );
}
