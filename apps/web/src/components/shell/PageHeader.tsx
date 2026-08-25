import type { ReactNode } from 'react';

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="topbar">
      <div className="topbar__identity">
        <div className="topbar__signal-line" aria-label="Sessão operacional">
          <span>PIERSEC / OPERATIONS</span>
          <span className="topbar__signal-status">
            <i aria-hidden="true" /> sessão segura
          </span>
        </div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="topbar__actions">{actions}</div>}
    </header>
  );
}
