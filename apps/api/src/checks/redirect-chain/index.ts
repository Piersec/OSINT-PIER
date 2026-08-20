import type { CheckPlugin } from '../../core/checks/contract.js';
import { failure, success } from '../../core/checks/results.js';
import { safeNetworkError } from '../../core/network/errors.js';
import { followFirstAvailable } from '../../core/network/http.js';

const id = 'redirect-chain';

const check: CheckPlugin = {
  id,
  label: 'Redirect Chain',
  requiredEnv: [],
  async run(target, context) {
    try {
      const { response, hops } = await followFirstAvailable(
        target,
        context.signal,
        10,
      );
      await response.body?.cancel();
      return success(id, 'HTTP redirects', {
        redirectCount: Math.max(0, hops.length - 1),
        finalUrl: hops.at(-1)?.url ?? null,
        finalStatus: response.status,
        chain: hops.map((hop) => ({
          ...hop,
          durationMs: Math.round(hop.durationMs),
        })),
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Falha na cadeia de redirecionamentos.';
      return failure(id, 'HTTP redirects', safeNetworkError(error, message));
    }
  },
};

export default check;
