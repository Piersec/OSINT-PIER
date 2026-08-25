export type StatusPillStatus =
  'idle' | 'loading' | 'success' | 'error' | 'skipped' | 'request-error';

const statusLabels: Record<StatusPillStatus, string> = {
  idle: 'Aguardando',
  loading: 'Carregando',
  success: 'Sucesso',
  error: 'Atenção',
  skipped: 'Atenção',
  'request-error': 'Atenção',
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
