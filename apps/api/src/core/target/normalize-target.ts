import { isIP } from 'node:net';
import type { TargetKind } from '@osint-pier/contracts';

export type { TargetKind } from '@osint-pier/contracts';

export interface NormalizedTarget {
  original: string;
  value: string;
  hostname: string;
  kind: TargetKind;
}

const hostnamePattern =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

const usernamePattern = /^[a-z0-9][a-z0-9._-]{1,63}$/i;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^(?:\+?[0-9]|\([0-9]{2,3}\))[0-9\s().-]{5,28}$/;

function invalidTarget(): Error {
  return new Error(
    'Informe uma URL HTTP(S), domínio, IP, nome, username, e-mail ou telefone válido.',
  );
}

function normalizeWebTarget(
  rawTarget: string,
  requestedKind?: 'domain' | 'ip' | 'url',
): NormalizedTarget {
  const input = rawTarget.trim();

  if (requestedKind === 'ip' || (!requestedKind && isIP(input))) {
    if (!isIP(input)) throw invalidTarget();
    return { original: rawTarget, value: input, hostname: input, kind: 'ip' };
  }

  if (requestedKind === 'url' || (!requestedKind && input.includes('://'))) {
    let url: URL;
    try {
      url = new URL(input);
    } catch {
      throw invalidTarget();
    }

    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password
    ) {
      throw new Error(
        'Somente URLs HTTP(S) sem credenciais embutidas são aceitas.',
      );
    }

    url.hash = '';
    const hostname =
      url.hostname.startsWith('[') && url.hostname.endsWith(']')
        ? url.hostname.slice(1, -1)
        : url.hostname;
    return {
      original: rawTarget,
      value: url.toString(),
      hostname,
      kind: 'url',
    };
  }

  const domain = input.replace(/\.$/, '').toLowerCase();
  if (
    requestedKind === 'domain' ||
    (!requestedKind && hostnamePattern.test(domain))
  ) {
    if (!hostnamePattern.test(domain)) throw invalidTarget();
    return {
      original: rawTarget,
      value: domain,
      hostname: domain,
      kind: 'domain',
    };
  }

  throw invalidTarget();
}

function normalizeIdentityTarget(
  rawTarget: string,
  kind: Exclude<TargetKind, 'domain' | 'ip' | 'url'>,
): NormalizedTarget {
  const input = rawTarget.trim();
  if (!input || input.includes('\n') || input.includes('\r')) {
    throw invalidTarget();
  }

  if (kind === 'name') {
    if (input.length > 200) throw invalidTarget();
    return { original: rawTarget, value: input, hostname: input, kind };
  }

  if (kind === 'username') {
    const username = input.replace(/^@/, '');
    if (!usernamePattern.test(username)) throw invalidTarget();
    return { original: rawTarget, value: username, hostname: username, kind };
  }

  if (kind === 'email') {
    const email = input.toLowerCase();
    if (email.length > 320 || !emailPattern.test(email)) throw invalidTarget();
    return { original: rawTarget, value: email, hostname: email, kind };
  }

  if (!phonePattern.test(input)) throw invalidTarget();
  const digits = input.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) throw invalidTarget();
  const phone = `+${digits}`;
  return { original: rawTarget, value: phone, hostname: phone, kind };
}

export function normalizeTarget(
  rawTarget: string,
  requestedKind?: TargetKind,
): NormalizedTarget {
  if (!requestedKind) {
    const input = rawTarget.trim();
    if (emailPattern.test(input))
      return normalizeIdentityTarget(rawTarget, 'email');
    if (isIP(input)) return normalizeWebTarget(rawTarget);
    if (phonePattern.test(input))
      return normalizeIdentityTarget(rawTarget, 'phone');
    if (
      /^@[a-z0-9][a-z0-9._-]{1,63}$/i.test(input) ||
      (/^@?[a-z0-9][a-z0-9._-]{1,63}$/i.test(input) && !input.includes('.'))
    )
      return normalizeIdentityTarget(rawTarget, 'username');
    if (/\s/.test(input)) return normalizeIdentityTarget(rawTarget, 'name');
  }

  if (
    !requestedKind ||
    requestedKind === 'domain' ||
    requestedKind === 'ip' ||
    requestedKind === 'url'
  ) {
    return normalizeWebTarget(
      rawTarget,
      requestedKind as 'domain' | 'ip' | 'url' | undefined,
    );
  }

  return normalizeIdentityTarget(rawTarget, requestedKind);
}
