import type { CheckPlugin } from '../../core/checks/contract.js';
import { failure, success } from '../../core/checks/results.js';
import {
  callCommandTool,
  listValue,
  numberValue,
  recordValue,
  stringValue,
} from '../../core/command-tools/runner-client.js';

const id = 'katana';
const source = 'Katana runner';

function compactPayload(payload: Record<string, unknown>, fallbackTarget: string) {
  const urls = listValue(payload.urls).slice(0, 200).flatMap((item) => {
    const value = recordValue(item);
    const url = stringValue(value.url, 2048);
    return url
      ? [
          {
            url,
            method: stringValue(value.method, 16),
            statusCode: numberValue(value.statusCode),
            contentType: stringValue(value.contentType, 128),
          },
        ]
      : [];
  });

  return {
    tool: id,
    profile: 'safe',
    target: stringValue(payload.target, 2048) ?? fallbackTarget,
    urls,
    total: numberValue(payload.total) ?? urls.length,
    truncated: payload.truncated === true,
  };
}

const check: CheckPlugin = {
  id,
  label: 'Katana',
  requiredEnv: ['COMMAND_TOOLS_API_TOKEN'],
  supportedTargetKinds: ['domain', 'url'],
  timeoutMs: 90_000,
  async run(target, context) {
    const outcome = await callCommandTool('katana', target, context);
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
