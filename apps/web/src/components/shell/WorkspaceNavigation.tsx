import type { ReactNode } from 'react';
import { PierMark } from '../primitives/PierMark';

type WorkspacePage =
  'analysis' | 'results' | 'history' | 'credentials' | 'profile' | 'settings';
const areas = [
  ['analysis', 'Investigar'],
  ['results', 'Ferramentas'],
  ['history', 'Histórico'],
  ['credentials', 'Integrações'],
] as const;

export function WorkspaceNavigation({
  activePage,
  onNavigate,
  onNewInvestigation,
  account,
}: {
  activePage: WorkspacePage;
  onNavigate: (page: WorkspacePage) => void;
  onNewInvestigation: () => void;
  account: ReactNode;
}) {
  return (
    <header className="workspace-navigation">
      <a
        className="workspace-navigation__brand"
        href="#analysis"
        onClick={() => onNavigate('analysis')}
      >
        <PierMark />
        <span>OSINT Pier</span>
      </a>
      <nav
        className="workspace-navigation__areas"
        aria-label="Áreas de investigação"
      >
        {areas.map(([page, label]) => (
          <a
            href={`#${page}`}
            key={page}
            onClick={() => onNavigate(page)}
            aria-current={activePage === page ? 'page' : undefined}
          >
            {label}
          </a>
        ))}
      </nav>
      <div className="workspace-navigation__actions">
        <a href="/docs">Guia</a>
        <a href="#settings" onClick={() => onNavigate('settings')}>
          Configurações
        </a>
        <button
          className="workspace-navigation__new"
          onClick={onNewInvestigation}
          type="button"
        >
          Nova investigação
        </button>
        {account}
      </div>
    </header>
  );
}
