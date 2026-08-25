export function MetricCard({
  label,
  value,
  detail,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  detail: string;
  tone?: 'default' | 'positive' | 'attention';
}) {
  return (
    <article className={'metric-card metric-card--' + tone}>
      <span>{label}</span>
      <strong>{String(value).padStart(2, '0')}</strong>
      <small>{detail}</small>
    </article>
  );
}
