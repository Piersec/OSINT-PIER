'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

type AccountDestination = 'profile' | 'settings';

export function AccountMenu({
  email,
  onNavigate,
  onSignOut,
  trigger,
}: {
  email?: string | null;
  onNavigate: (destination: AccountDestination) => void;
  onSignOut: () => void;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  function goTo(destination: AccountDestination) {
    setOpen(false);
    onNavigate(destination);
  }

  return (
    <div className="account-menu" ref={menuRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Abrir conta ${email ?? 'usuário autenticado'}`}
        className="account-menu__trigger auth-avatar-button"
        onClick={() => setOpen((current) => !current)}
        title={email ?? 'Usuário autenticado'}
        type="button"
      >
        {trigger}
        <span className="account-menu__chevron" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="m7 10 5 5 5-5" />
          </svg>
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="account-menu__popover"
            exit={reducedMotion ? undefined : { opacity: 0, y: -5, scale: 0.98 }}
            initial={reducedMotion ? false : { opacity: 0, y: -7, scale: 0.98 }}
            role="menu"
            transition={{ duration: reducedMotion ? 0 : 0.18, ease: 'easeOut' }}
          >
            <div className="account-menu__identity">
              <span className="account-menu__status" aria-hidden="true" />
              <div>
                <strong>Conta autenticada</strong>
                <span title={email ?? undefined}>
                  {email ?? 'Usuário autenticado'}
                </span>
              </div>
            </div>
            <div className="account-menu__divider" />
            <button
              className="account-menu__item"
              onClick={() => goTo('profile')}
              role="menuitem"
              type="button"
            >
              <span>
                <svg aria-hidden="true" viewBox="0 0 24 24">
                  <circle cx="12" cy="8" r="3" />
                  <path d="M5 21a7 7 0 0 1 14 0" />
                </svg>
                Perfil
              </span>
              <small>Identidade</small>
            </button>
            <button
              className="account-menu__item"
              onClick={() => goTo('settings')}
              role="menuitem"
              type="button"
            >
              <span>
                <svg aria-hidden="true" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-2.5v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H6.4v-2.5h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.8-1.8.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5v-.2H15v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.2V14h-.2a1.7 1.7 0 0 0-1.5 1Z" />
                </svg>
                Configurações
              </span>
              <small>Preferências</small>
            </button>
            <div className="account-menu__divider" />
            <button
              className="account-menu__item account-menu__item--danger"
              onClick={onSignOut}
              role="menuitem"
              type="button"
            >
              <span>
                <svg aria-hidden="true" viewBox="0 0 24 24">
                  <path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10" />
                </svg>
                Sair
              </span>
              <small>Encerrar sessão</small>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
