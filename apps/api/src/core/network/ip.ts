import { isIP } from 'node:net';
import { resolve4, resolve6 } from 'node:dns/promises';

export async function resolveAddresses(hostname: string): Promise<{
  ipv4: string[];
  ipv6: string[];
}> {
  if (isIP(hostname) === 4) return { ipv4: [hostname], ipv6: [] };
  if (isIP(hostname) === 6) return { ipv4: [], ipv6: [hostname] };

  const [ipv4, ipv6] = await Promise.allSettled([
    resolve4(hostname),
    resolve6(hostname),
  ]);
  return {
    ipv4: ipv4.status === 'fulfilled' ? [...new Set(ipv4.value)] : [],
    ipv6: ipv6.status === 'fulfilled' ? [...new Set(ipv6.value)] : [],
  };
}

export function isPublicAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const octets = address.split('.').map(Number);
    const [a = 0, b = 0, c = 0] = octets;
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0 && c === 0) ||
      (a === 192 && b === 0 && c === 2) ||
      (a === 192 && b === 168) ||
      (a === 198 && [18, 19].includes(b)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113) ||
      a >= 224
    );
  }

  if (version === 6) {
    const normalized = address.toLowerCase();
    return !(
      normalized === '::' ||
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe8') ||
      normalized.startsWith('fe9') ||
      normalized.startsWith('fea') ||
      normalized.startsWith('feb') ||
      normalized.startsWith('ff') ||
      normalized.startsWith('2001:db8:')
    );
  }

  return false;
}
