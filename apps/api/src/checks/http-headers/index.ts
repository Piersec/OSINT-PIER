import type { CheckPlugin } from '../../core/checks/contract.js';
import { failure, success } from '../../core/checks/results.js';
import { safeNetworkError } from '../../core/network/errors.js';
import { followFirstAvailable } from '../../core/network/http.js';

const id = 'http-headers';
const securityHeaderNames = [
  'content-security-policy',
  'strict-transport-security',
  'x-frame-options',
  'x-content-type-options',
  'referrer-policy',
  'permissions-policy',
] as const;

const check: CheckPlugin = {
  id,
  label: 'HTTP Headers',
  requiredEnv: [],
  async run(target, context) {
    try {
      const { response, hops } = await followFirstAvailable(
        target,
        context.signal,
      );
      const headers = Object.fromEntries(
        [...response.headers.entries()].filter(
          ([name]) => name !== 'set-cookie',
        ),
      );
      const security = Object.fromEntries(
        securityHeaderNames.map((name) => [
          name,
          {
            present: response.headers.has(name),
            value: response.headers.get(name),
          },
        ]),
      );
      await response.body?.cancel();
      return success(id, 'HTTP response headers', {
        finalUrl: hops.at(-1)?.url ?? null,
        status: response.status,
        securityScore: {
          present: securityHeaderNames.filter((name) =>
            response.headers.has(name),
          ).length,
          total: securityHeaderNames.length,
        },
        security,
        headers,
      });
    } catch (error) {
      return failure(
        id,
        'HTTP response headers',
        safeNetworkError(error, 'Não foi possível coletar os headers HTTP.'),
      );
    }
  },
};

export default check;
