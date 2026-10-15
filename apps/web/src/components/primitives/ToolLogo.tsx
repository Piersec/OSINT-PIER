const paths: Record<string, string> = {
  'dns-records': 'M12 3v5M5 16v-5h14v5M9 3h6v5H9zM2 16h6v5H2zm14 0h6v5h-6z',
  'ip-info': 'M4 7h16v10H4zM8 11h.01M12 11h4M8 14h8M9 17v4m6-4v4',
  'http-headers': 'M8 4H4v16h4M16 4h4v16h-4M10 8l4 4-4 4',
  'ssl-certificate': 'M12 3l8 4v6c0 4-8 8-8 8s-8-4-8-8V7zM8 12l3 3 5-6',
  'abuse-ipdb': 'M12 3l9 17H3zM12 9v4m0 3h.01',
  'virus-total': 'M12 3l8 4v6c0 4-8 8-8 8s-8-4-8-8V7zM8 12l3 3 5-6',
  'whois-rdap': 'M14 3H5v18h14V8zM14 3v5h5M8 12h8m-8 4h6',
  'server-location':
    'M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0M9 10a3 3 0 1 0 6 0 3 3 0 0 0-6 0',
  shodan:
    'M3 12s3-7 9-7 9 7 9 7-3 7-9 7-9-7-9-7M9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0',
  'tech-stack': 'M12 3l9 5-9 5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5',
  'hunter-io': 'M3 5h18v14H3zM3 5l9 8 9-8',
  'redirect-chain': 'M4 7h12m-4-4 4 4-4 4M20 17H8m4-4-4 4 4 4',
  nuclei: 'M12 3l9 5v8l-9 5-9-5V8zM12 8v5m0 3h.01',
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
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d={
            paths[checkId] ??
            'M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm10 0h6v6h-6z'
          }
        />
      </svg>
    </span>
  );
}
