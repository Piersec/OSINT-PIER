const glyphs: Record<string, string> = {
  'abuse-ipdb': '!',
  cookies: '◌',
  'dns-records': '⌘',
  ghunt: '@',
  gobuster: '/',
  'http-headers': '↗',
  'hunter-io': '✦',
  'ip-info': '◎',
  katana: '⌁',
  nmap: '⌖',
  'osint-framework': '◫',
  osintgram: '◉',
  phoneinfoga: '⌕',
  'redirect-chain': '→',
  'robots-sitemap': '⌘',
  'server-location': '◉',
  'server-status': '●',
  sherlock: '⌁',
  nuclei: '◈',
  shodan: '◍',
  'shodan-vulnerabilities': '!',
  'ssl-certificate': '◇',
  subfinder: '⌘',
  'tech-stack': '◫',
  'virus-total': 'V',
  'whois-rdap': '?',
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
  return (
    <span aria-label={label} className={className} role="img">
      {glyphs[checkId] ?? label.slice(0, 1).toUpperCase()}
    </span>
  );
}
