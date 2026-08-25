import type { CheckPlugin } from '../../core/checks/contract.js';
import { failure, success } from '../../core/checks/results.js';
import {
  callCommandTool,
  listValue,
  numberValue,
  recordValue,
  stringValue,
} from '../../core/command-tools/runner-client.js';

const id = 'nmap';
const source = 'Nmap runner';

function compactPayload(payload: Record<string, unknown>, fallbackTarget: string) {
  const hosts = listValue(payload.hosts).slice(0, 4).flatMap((item) => {
    const host = recordValue(item);
    const ports = listValue(host.ports).slice(0, 100).flatMap((port) => {
      const value = recordValue(port);
      const portNumber = numberValue(value.port);
      if (portNumber === null) return [];
      return [
        {
          port: portNumber,
          protocol: stringValue(value.protocol, 8),
          state: stringValue(value.state, 32),
          service: stringValue(value.service, 64),
          product: stringValue(value.product, 128),
          version: stringValue(value.version, 64),
        },
      ];
    });
    return [
      {
        ip: stringValue(host.ip, 128),
        status: stringValue(host.status, 32),
        ports,
      },
    ];
  });

  return {
    tool: id,
    profile: 'safe',
    target: stringValue(payload.target, 253) ?? fallbackTarget,
    hosts,
    totalOpenPorts:
      numberValue(payload.totalOpenPorts) ??
      hosts.reduce((total, host) => total + host.ports.length, 0),
    note: stringValue(payload.note, 256),
  };
}

const check: CheckPlugin = {
  id,
  label: 'Nmap',
  requiredEnv: ['COMMAND_TOOLS_API_TOKEN'],
  supportedTargetKinds: ['domain', 'ip', 'url'],
  timeoutMs: 90_000,
  async run(target, context) {
    const outcome = await callCommandTool('nmap', target, context);
    if (outcome.status === 'skipped')
      return { id, status: 'skipped', error: outcome.error, source: 'configuration', durationMs: 0 };
    if (outcome.status === 'error') return failure(id, source, outcome.error);
    return success(id, source, compactPayload(outcome.payload, target.hostname));
  },
};

export default check;
