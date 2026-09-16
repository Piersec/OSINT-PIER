export type StatusPillStatus =
  'idle' | 'loading' | 'success' | 'error' | 'skipped' | 'request-error';

const statusLabels: Record<StatusPillStatus, string> = {
  idle: 'Na fila',
  loading: 'Consultando',
  success: 'Resposta recebida',
  error: 'Fonte indisponível',
  skipped: 'Configuração necessária',
  'request-error': 'Conexão interrompida',
};

export function StatusPill({
  status,
  label = statusLabels[status],
}: {
  status: StatusPillStatus;
  label?: string;
}) {
  return (
    <span className={'status-pill status-pill--' + status} role="status">
      <i aria-hidden="true" />
      {label}
    </span>
  );
}
