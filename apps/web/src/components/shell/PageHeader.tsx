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
    <header className="workbench-page-heading">
      <div className="workbench-page-heading__identity">
        <span className="sr-only">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && (
        <div className="workbench-page-heading__actions">{actions}</div>
      )}
    </header>
  );
}
