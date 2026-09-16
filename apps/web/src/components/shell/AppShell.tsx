import type { ReactNode } from 'react';

export function AppShell({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={(
        'app-shell app-shell--piersec app-shell--ui ' + className
      ).trim()}
    >
      {children}
    </div>
  );
}
