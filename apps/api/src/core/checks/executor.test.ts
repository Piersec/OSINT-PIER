import { describe, expect, it } from 'vitest';
import type { CheckPlugin, CredentialProvider } from './contract.js';
import { executeCheck } from './executor.js';

const target = {
  original: 'example.com',
  value: 'example.com',
  hostname: 'example.com',
  kind: 'domain' as const,
};

const emptyProvider: CredentialProvider = {
  async get() {
    return undefined;
  },
};

describe('executeCheck', () => {
  it('retorna skipped sem executar o plugin quando falta credencial', async () => {
    let executed = false;
    const check: CheckPlugin = {
      id: 'external-check',
      label: 'External check',
      requiredEnv: ['EXTERNAL_API_KEY'],
      async run() {
        executed = true;
        return {
          id: 'external-check',
          status: 'success',
          source: 'test',
          durationMs: 0,
        };
      },
    };

    const result = await executeCheck({
      check,
      target,
      credentialProvider: emptyProvider,
      defaultTimeoutMs: 1000,
    });

    expect(executed).toBe(false);
    expect(result.status).toBe('skipped');
  });

  it('isola plugins que excedem o timeout', async () => {
    const check: CheckPlugin = {
      id: 'slow-check',
      label: 'Slow check',
      requiredEnv: [],
      timeoutMs: 100,
      async run() {
        await new Promise(() => undefined);
        throw new Error('unreachable');
      },
    };

    const result = await executeCheck({
      check,
      target,
      credentialProvider: emptyProvider,
      defaultTimeoutMs: 1000,
    });

    expect(result.status).toBe('error');
    expect(result.error).toContain('100 ms');
  });

  it('normaliza id e duração do resultado', async () => {
    const check: CheckPlugin = {
      id: 'working-check',
      label: 'Working check',
      requiredEnv: [],
      async run() {
        return {
          id: 'wrong-id',
          status: 'success',
          data: { ok: true },
          source: 'fixture',
          durationMs: 999,
        };
      },
    };

    const result = await executeCheck({
      check,
      target,
      credentialProvider: emptyProvider,
      defaultTimeoutMs: 1000,
    });

    expect(result.id).toBe('working-check');
    expect(result.durationMs).toBeLessThan(999);
  });

  it('censura credenciais devolvidas acidentalmente por um plugin', async () => {
    const secret = 'chave-super-secreta';
    const check: CheckPlugin = {
      id: 'leaky-check',
      label: 'Leaky check',
      requiredEnv: ['LEAKY_API_KEY'],
      async run(_target, context) {
        return {
          id: 'leaky-check',
          status: 'success',
          data: {
            direct: context.credentials.LEAKY_API_KEY,
            nested: [`prefix-${context.credentials.LEAKY_API_KEY}-suffix`],
          },
          source: 'fixture',
          durationMs: 0,
        };
      },
    };
    const provider: CredentialProvider = {
      async get() {
        return secret;
      },
    };

    const result = await executeCheck({
      check,
      target,
      credentialProvider: provider,
      defaultTimeoutMs: 1000,
    });

    expect(JSON.stringify(result)).not.toContain(secret);
    expect(JSON.stringify(result)).toContain('[REDACTED]');
  });

  it('injeta credenciais opcionais quando estão disponíveis', async () => {
    const check: CheckPlugin = {
      id: 'optional-check',
      label: 'Optional check',
      requiredEnv: [],
      optionalEnv: ['OPTIONAL_API_KEY'],
      async run(_target, context) {
        return {
          id: 'optional-check',
          status: 'success',
          data: { configured: Boolean(context.credentials.OPTIONAL_API_KEY) },
          source: 'fixture',
          durationMs: 0,
        };
      },
    };
    const provider: CredentialProvider = {
      async get(name) {
        return name === 'OPTIONAL_API_KEY' ? 'optional-secret' : undefined;
      },
    };

    const result = await executeCheck({
      check,
      target,
      credentialProvider: provider,
      defaultTimeoutMs: 1000,
    });

    expect(result.data).toEqual({ configured: true });
  });
});
