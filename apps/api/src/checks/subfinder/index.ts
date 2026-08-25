import type { CheckPlugin } from '../../core/checks/contract.js';
import { failure, success } from '../../core/checks/results.js';
import {
  callCommandTool,
  listValue,
  recordValue,
  stringValue,
} from '../../core/command-tools/runner-client.js';

const id = 'subfinder';
const source = 'Subfinder runner';

function compactPayload(payload: Record<string, unknown>, fallbackTarget: string) {
  const subdomains = listValue(payload.subdomains).slice(0, 200).flatMap((item) => {
    const value = recordValue(item);
    const host = stringValue(value.host, 253);
    return host
      ? [
          {
            host,
            sources: listValue(value.sources)
              .filter((source): source is string => typeof source === 'string')
              .map((source) => source.trim().slice(0, 128))
              .filter(Boolean)
              .slice(0, 8),
          },
        ]
      : [];
  });

  return {
    tool: id,
    profile: 'safe',
    target: stringValue(payload.target, 253) ?? fallbackTarget,
    subdomains,
    total: typeof payload.total === 'number' ? Math.trunc(payload.total) : subdomains.length,
    truncated: payload.truncated === true,
  };
}

const check: CheckPlugin = {
  id,
  label: 'Subfinder',
  requiredEnv: ['COMMAND_TOOLS_API_TOKEN'],
  supportedTargetKinds: ['domain', 'url'],
  timeoutMs: 75_000,
  async run(target, context) {
    const outcome = await callCommandTool('subfinder', target, context);
    if (outcome.status === 'skipped')
      return { id, status: 'skipped', error: outcome.error, source: 'configuration', durationMs: 0 };
    if (outcome.status === 'error') return failure(id, source, outcome.error);
    return success(id, source, compactPayload(outcome.payload, target.hostname));
  },
};

export default check;
