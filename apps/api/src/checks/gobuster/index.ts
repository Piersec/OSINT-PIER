import type { CheckPlugin } from '../../core/checks/contract.js';
import { failure, success } from '../../core/checks/results.js';
import {
  callCommandTool,
  listValue,
  numberValue,
  recordValue,
  stringValue,
} from '../../core/command-tools/runner-client.js';

const id = 'gobuster';
const source = 'Gobuster runner';

function compactPayload(payload: Record<string, unknown>, fallbackTarget: string) {
  const paths = listValue(payload.paths).slice(0, 200).flatMap((item) => {
    const value = recordValue(item);
    const path = stringValue(value.path, 512);
    const statusCode = numberValue(value.statusCode);
    return path && statusCode !== null
      ? [
          {
            path,
            statusCode,
            length: numberValue(value.length),
          },
        ]
      : [];
  });

  return {
    tool: id,
    profile: 'safe',
    target: stringValue(payload.target, 2048) ?? fallbackTarget,
    paths,
    total: numberValue(payload.total) ?? paths.length,
    truncated: payload.truncated === true,
    note: stringValue(payload.note, 256),
  };
}

const check: CheckPlugin = {
  id,
  label: 'Gobuster',
  requiredEnv: ['COMMAND_TOOLS_API_TOKEN'],
  supportedTargetKinds: ['domain', 'url'],
  timeoutMs: 75_000,
  async run(target, context) {
    const outcome = await callCommandTool('gobuster', target, context);
    if (outcome.status === 'skipped')
      return { id, status: 'skipped', error: outcome.error, source: 'configuration', durationMs: 0 };
    if (outcome.status === 'error') return failure(id, source, outcome.error);
    return success(
      id,
      source,
      compactPayload(
        outcome.payload,
        target.kind === 'url' ? target.value : `https://${target.hostname}/`,
      ),
    );
  },
};

export default check;
