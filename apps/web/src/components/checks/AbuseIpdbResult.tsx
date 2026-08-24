interface AbuseIpdbNetwork {
  isp?: string | null;
  usageType?: string | null;
  asn?: number | string | null;
  domain?: string | null;
  countryCode?: string | null;
  countryName?: string | null;
  city?: string | null;
  hostnames?: string[];
  locationSource?: string | null;
}

interface AbuseIpdbData {
  selectedIp?: string;
  abuseConfidenceScore?: number;
  windowDays?: number;
  reports?: {
    total?: number;
    distinctReporters?: number;
    lastReportedAt?: string | null;
  };
  network?: AbuseIpdbNetwork;
  reportUrl?: string;
  whoisUrl?: string;
}

function dataOf(data: unknown): AbuseIpdbData {
  return data && typeof data === 'object' ? (data as AbuseIpdbData) : {};
}

function valueOf(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return 'Não informado';
  }
  return String(value);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Não informado';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(parsed);
}

function countryFlag(countryCode: string | null | undefined): string {
  if (!countryCode || !/^[A-Za-z]{2}$/.test(countryCode)) return '';
  return countryCode
    .toUpperCase()
    .split('')
    .map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)))
    .join('');
}

function externalHref(value: string | undefined): string | undefined {
  return value && /^https?:\/\//i.test(value) ? value : undefined;
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="abuse-ipdb-result__detail">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function AbuseIpdbResult({ data }: { data: unknown }) {
  const result = dataOf(data);
  const network = result.network ?? {};
  const reports = result.reports ?? {};
  const totalReports = Number.isFinite(reports.total)
    ? (reports.total ?? 0)
    : 0;
  const score = Math.min(
    100,
    Math.max(
      0,
      Number.isFinite(result.abuseConfidenceScore)
        ? (result.abuseConfidenceScore ?? 0)
        : 0,
    ),
  );
  const country = network.countryName ?? network.countryCode;
  const flag = countryFlag(network.countryCode);
  const asn = valueOf(network.asn);
  const asnHref = network.asn
    ? `https://bgp.he.net/AS${String(network.asn).replace(/^AS/i, '')}`
    : undefined;
  const reportHref = externalHref(result.reportUrl);
  const whoisHref = externalHref(result.whoisUrl);

  return (
    <div className="abuse-ipdb-result">
      <div
        className={`abuse-ipdb-result__headline ${totalReports > 0 ? 'abuse-ipdb-result__headline--reported' : 'abuse-ipdb-result__headline--clear'}`}
      >
        <strong>
          {totalReports > 0
            ? `${valueOf(result.selectedIp)} possui histórico de denúncias`
            : `${valueOf(result.selectedIp)} não possui denúncias recentes`}
        </strong>
        <span>Janela consultada: {valueOf(result.windowDays)} dias</span>
      </div>

      <div className="abuse-ipdb-result__score">
        <p>
          Este IP foi denunciado <strong>{totalReports}</strong>{' '}
          {totalReports === 1 ? 'vez' : 'vezes'}. Confiança de abuso:{' '}
          <strong>{score}%</strong>.
        </p>
        <div
          aria-label={`Confiança de abuso: ${score}%`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={score}
          className="abuse-ipdb-result__progress"
          role="progressbar"
        >
          <span style={{ width: `${score}%` }} />
        </div>
      </div>

      <dl className="abuse-ipdb-result__details">
        <Detail label="ISP">{valueOf(network.isp)}</Detail>
        <Detail label="Tipo de uso">{valueOf(network.usageType)}</Detail>
        <Detail label="ASN">
          {asnHref ? (
            <a href={asnHref} rel="noreferrer" target="_blank">
              {asn}
            </a>
          ) : (
            asn
          )}
        </Detail>
        <Detail label="Domínio">{valueOf(network.domain)}</Detail>
        <Detail label="País">
          {country ? `${flag ? `${flag} ` : ''}${country}` : 'Não informado'}
        </Detail>
        <Detail label="Cidade">{valueOf(network.city)}</Detail>
        <Detail label="Última denúncia">
          {formatDate(reports.lastReportedAt)}
        </Detail>
        <Detail label="Denunciantes distintos">
          {valueOf(reports.distinctReporters)}
        </Detail>
      </dl>

      {network.locationSource && (
        <p className="abuse-ipdb-result__source-note">
          Cidade e ASN são dados aproximados de {network.locationSource}.
        </p>
      )}

      {network.hostnames?.length ? (
        <div className="abuse-ipdb-result__hostnames">
          <span>Hostnames observados</span>
          <div>
            {network.hostnames.map((hostname) => (
              <code key={hostname}>{hostname}</code>
            ))}
          </div>
        </div>
      ) : null}

      {(reportHref || whoisHref) && (
        <div className="abuse-ipdb-result__links">
          {reportHref && (
            <a href={reportHref} rel="noreferrer" target="_blank">
              Abrir relatório <span aria-hidden="true">↗</span>
            </a>
          )}
          {whoisHref && (
            <a href={whoisHref} rel="noreferrer" target="_blank">
              Consultar WHOIS <span aria-hidden="true">↗</span>
            </a>
          )}
        </div>
      )}
    </div>
  );
}
import type { ReactNode } from 'react';
