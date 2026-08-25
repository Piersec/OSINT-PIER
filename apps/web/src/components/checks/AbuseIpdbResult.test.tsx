// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AbuseIpdbResult } from './AbuseIpdbResult';

describe('AbuseIpdbResult', () => {
  it('exibe os campos de reputação, rede, localização e links externos', () => {
    render(
      <AbuseIpdbResult
        data={{
          selectedIp: '8.8.8.8',
          windowDays: 90,
          abuseConfidenceScore: 4,
          reports: {
            total: 2,
            distinctReporters: 2,
            lastReportedAt: '2026-08-01T00:00:00+00:00',
          },
          network: {
            isp: 'Example ISP',
            usageType: 'Commercial',
            asn: 15169,
            domain: 'example.com',
            countryCode: 'US',
            countryName: 'United States of America',
            city: 'Mountain View',
          },
          reportUrl: 'https://www.abuseipdb.com/check/8.8.8.8',
          whoisUrl: 'https://www.whois.com/whois/8.8.8.8',
        }}
      />,
    );

    expect(screen.getByText(/possui histórico de denúncias/)).toBeTruthy();
    expect(screen.getByText('Example ISP')).toBeTruthy();
    expect(screen.getByText('Commercial')).toBeTruthy();
    expect(screen.getByText('15169')).toBeTruthy();
    expect(screen.getByText('Mountain View')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(
      '4',
    );
    expect(
      screen
        .getByRole('link', { name: /Abrir relatório/ })
        .getAttribute('href'),
    ).toBe('https://www.abuseipdb.com/check/8.8.8.8');
    expect(
      screen
        .getByRole('link', { name: /Consultar WHOIS/ })
        .getAttribute('href'),
    ).toBe('https://www.whois.com/whois/8.8.8.8');
  });

  it('explica quando a API não fornece um campo', () => {
    render(
      <AbuseIpdbResult
        data={{
          selectedIp: '192.0.2.10',
          abuseConfidenceScore: 0,
          reports: { total: 0 },
          network: {},
        }}
      />,
    );

    expect(screen.getAllByText('Não informado').length).toBeGreaterThan(3);
    expect(screen.getByText(/não possui denúncias recentes/)).toBeTruthy();
  });
});
