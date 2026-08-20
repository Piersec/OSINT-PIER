import { resolve4, resolve6 } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { CheckPlugin } from '../../core/checks/contract.js';
import { failure, success } from '../../core/checks/results.js';
import { safeNetworkError } from '../../core/network/errors.js';

const id = 'ip-info';

const check: CheckPlugin = {
  id,
  label: 'IP Info',
  requiredEnv: [],
  async run(target) {
    try {
      if (isIP(target.hostname) === 4) {
        return success(id, 'Node.js DNS', {
          ipv4: [{ address: target.hostname }],
          ipv6: [],
        });
      }
      if (isIP(target.hostname) === 6) {
        return success(id, 'Node.js DNS', {
          ipv4: [],
          ipv6: [{ address: target.hostname }],
        });
      }

      const [ipv4Result, ipv6Result] = await Promise.allSettled([
        resolve4(target.hostname, { ttl: true }),
        resolve6(target.hostname, { ttl: true }),
      ]);
      const ipv4 = ipv4Result.status === 'fulfilled' ? ipv4Result.value : [];
      const ipv6 = ipv6Result.status === 'fulfilled' ? ipv6Result.value : [];
      if (ipv4.length === 0 && ipv6.length === 0) {
        return failure(
          id,
          'Node.js DNS',
          'Nenhum registro A ou AAAA foi encontrado.',
        );
      }
      return success(id, 'Node.js DNS', { ipv4, ipv6 });
    } catch (error) {
      return failure(
        id,
        'Node.js DNS',
        safeNetworkError(error, 'Falha ao resolver o alvo.'),
      );
    }
  },
};

export default check;
