import type { CheckPlugin } from '../../core/checks/contract.js';
import { failure, success } from '../../core/checks/results.js';
import { safeNetworkError } from '../../core/network/errors.js';
import { followFirstAvailable } from '../../core/network/http.js';

const id = 'server-status';

const check: CheckPlugin = {
  id,
  label: 'Server Status',
  requiredEnv: [],
  async run(target, context) {
    try {
      const { response, hops } = await followFirstAvailable(
        target,
        context.signal,
      );
      await response.body?.cancel();
      const finalHop = hops.at(-1);
      return success(id, 'HTTP', {
        online: true,
        status: response.status,
        statusText: response.statusText,
        finalUrl: finalHop?.url ?? null,
        responseTimeMs: Math.round(
          hops.reduce((total, hop) => total + hop.durationMs, 0),
        ),
        redirectCount: Math.max(0, hops.length - 1),
      });
    } catch (error) {
      return failure(
        id,
        'HTTP',
        safeNetworkError(error, 'O servidor não respondeu via HTTP(S).'),
      );
    }
  },
};

export default check;
