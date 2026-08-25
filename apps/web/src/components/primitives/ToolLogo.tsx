'use client';

import { useEffect, useState } from 'react';

type ToolIcon =
  | { kind: 'simple'; slug: string }
  | { kind: 'favicon'; domain: string };

const toolIcons: Record<string, ToolIcon> = {
  'abuse-ipdb': { kind: 'favicon', domain: 'abuseipdb.com' },
  cookies: { kind: 'favicon', domain: 'developer.mozilla.org' },
  'dns-records': { kind: 'favicon', domain: 'cloudflare.com' },
  ghunt: { kind: 'favicon', domain: 'github.com' },
  gobuster: { kind: 'favicon', domain: 'github.com' },
  'http-headers': { kind: 'favicon', domain: 'developer.mozilla.org' },
  'hunter-io': { kind: 'favicon', domain: 'hunter.io' },
  'ip-info': { kind: 'favicon', domain: 'ipinfo.io' },
  katana: { kind: 'favicon', domain: 'projectdiscovery.io' },
  nmap: { kind: 'favicon', domain: 'nmap.org' },
  'osint-framework': { kind: 'favicon', domain: 'osintframework.com' },
  osintgram: { kind: 'favicon', domain: 'github.com' },
  phoneinfoga: { kind: 'favicon', domain: 'github.com' },
  'redirect-chain': { kind: 'favicon', domain: 'httpstatus.io' },
  'robots-sitemap': { kind: 'favicon', domain: 'developers.google.com' },
  'server-location': { kind: 'favicon', domain: 'ipinfo.io' },
  'server-status': { kind: 'favicon', domain: 'uptimerobot.com' },
  sherlock: { kind: 'favicon', domain: 'github.com' },
  nuclei: { kind: 'favicon', domain: 'projectdiscovery.io' },
  shodan: { kind: 'favicon', domain: 'shodan.io' },
  'shodan-vulnerabilities': { kind: 'favicon', domain: 'nvd.nist.gov' },
  'ssl-certificate': { kind: 'simple', slug: 'letsencrypt' },
  subfinder: { kind: 'favicon', domain: 'projectdiscovery.io' },
  'tech-stack': { kind: 'simple', slug: 'wappalyzer' },
  'virus-total': { kind: 'simple', slug: 'virustotal' },
  'whois-rdap': { kind: 'favicon', domain: 'icann.org' },
};

export function ToolLogo({
  checkId,
  label,
  className = 'tool-card__icon tool-card__icon--logo',
}: {
  checkId: string;
  label: string;
  className?: string;
}) {
  const icon = toolIcons[checkId] ?? { kind: 'favicon', domain: 'github.com' };
  const primarySource =
    icon.kind === 'simple'
      ? `https://cdn.simpleicons.org/${icon.slug}/48E9FF`
      : `https://www.google.com/s2/favicons?domain=${icon.domain}&sz=64`;
  const fallbackSource = 'https://cdn.simpleicons.org/simpleicons/48E9FF';
  const [source, setSource] = useState(primarySource);

  useEffect(() => setSource(primarySource), [primarySource]);

  return (
    <span className={className}>
      <img
        alt={`${label} logo`}
        onError={() => {
          if (source !== fallbackSource) setSource(fallbackSource);
        }}
        src={source}
      />
    </span>
  );
}
