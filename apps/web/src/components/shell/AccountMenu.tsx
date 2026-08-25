export function AccountMenu({
  email,
  onSignOut,
}: {
  email?: string | null;
  onSignOut: () => void;
}) {
  return (
    <div className="account-menu">
      <span className="account-menu__status" aria-hidden="true" />
      <span className="auth-user" title={email ?? undefined}>
        {email ?? 'Usuário autenticado'}
      </span>
      <button className="auth-logout" onClick={onSignOut} type="button">
        Sair
      </button>
    </div>
  );
}
