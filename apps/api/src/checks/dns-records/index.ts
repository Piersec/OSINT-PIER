import { isIP } from 'node:net';
import {
  resolve4,
  resolve6,
  resolveCname,
  resolveMx,
  resolveNs,
  resolveTxt,
} from 'node:dns/promises';
import type { CheckPlugin } from '../../core/checks/contract.js';
import { failure, success } from '../../core/checks/results.js';

const id = 'dns-records';

async function optional<T>(operation: Promise<T>): Promise<T | []> {
  try {
    return await operation;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (['ENODATA', 'ENOTFOUND', 'ESERVFAIL', 'EREFUSED'].includes(code ?? ''))
      return [];
    throw error;
  }
}

const check: CheckPlugin = {
  id,
  label: 'DNS Records',
  requiredEnv: [],
  async run(target) {
    if (isIP(target.hostname)) {
      return failure(
        id,
        'Node.js DNS',
        'Esta checagem requer um domínio, não um IP direto.',
      );
    }

    try {
      const [a, aaaa, mx, ns, txt, cname] = await Promise.all([
        optional(resolve4(target.hostname, { ttl: true })),
        optional(resolve6(target.hostname, { ttl: true })),
        optional(resolveMx(target.hostname)),
        optional(resolveNs(target.hostname)),
        optional(resolveTxt(target.hostname)),
        optional(resolveCname(target.hostname)),
      ]);
      return success(id, 'Node.js DNS', {
        A: a,
        AAAA: aaaa,
        MX: mx,
        NS: ns,
        TXT: (txt as string[][]).map((parts) => parts.join('')),
        CNAME: cname,
      });
    } catch {
      return failure(
        id,
        'Node.js DNS',
        'A consulta DNS falhou no resolvedor configurado.',
      );
    }
  },
};

export default check;
