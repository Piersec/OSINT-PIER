import { performance } from 'node:perf_hooks';
import { CheckResultSchema, type CheckResult } from '@osint-pier/contracts';
import type { NormalizedTarget } from '../target/normalize-target.js';
import type { CheckPlugin, CredentialProvider } from './contract.js';

class CheckTimeoutError extends Error {}

function publicError(error: unknown): string {
  if (error instanceof CheckTimeoutError) return error.message;
  return 'A checagem falhou. Consulte os logs internos usando o identificador da requisição.';
}

function redactString(value: string, secrets: readonly string[]): string {
  return secrets.reduce(
    (redacted, secret) => redacted.split(secret).join('[REDACTED]'),
    value,
  );
}

function redactValue(
  value: unknown,
  secrets: readonly string[],
  visited = new WeakSet<object>(),
): unknown {
  if (typeof value === 'string') return redactString(value, secrets);
  if (!value || typeof value !== 'object') return value;
  if (visited.has(value)) return '[CIRCULAR]';
  visited.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, secrets, visited));
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      redactValue(item, secrets, visited),
    ]),
  );
}

export async function executeCheck(options: {
  check: CheckPlugin;
  target: NormalizedTarget;
  credentialProvider: CredentialProvider;
  defaultTimeoutMs: number;
  environment?: NodeJS.ProcessEnv;
}): Promise<CheckResult> {
  const {
    check,
    target,
    credentialProvider,
    defaultTimeoutMs,
    environment = process.env,
  } = options;
  const startedAt = performance.now();
  const credentials: Record<string, string> = {};

  if (
    check.supportedTargetKinds &&
    !check.supportedTargetKinds.includes(target.kind)
  ) {
    return {
      id: check.id,
      status: 'skipped',
      error: 'Esta checagem não se aplica ao tipo de alvo selecionado.',
      source: 'configuration',
      durationMs: performance.now() - startedAt,
    };
  }

  for (const name of check.requiredEnv) {
    const value = await credentialProvider.get(name);
    if (!value) {
      return {
        id: check.id,
        status: 'skipped',
        error: `Credencial ${name} não configurada.`,
        source: 'configuration',
        durationMs: performance.now() - startedAt,
      };
    }
    credentials[name] = value;
  }

  for (const name of check.optionalEnv ?? []) {
    const value = await credentialProvider.get(name);
    if (value) credentials[name] = value;
  }

  const controller = new AbortController();
  const timeoutMs = check.timeoutMs ?? defaultTimeoutMs;
  let timeout: NodeJS.Timeout | undefined;

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        reject(
          new CheckTimeoutError(
            `A checagem excedeu o limite de ${timeoutMs} ms.`,
          ),
        );
      }, timeoutMs);
    });

    const rawResult = await Promise.race([
      check.run(target, {
        signal: controller.signal,
        credentials,
        environment,
      }),
      timeoutPromise,
    ]);

    const result = CheckResultSchema.parse({
      ...rawResult,
      id: check.id,
      durationMs: performance.now() - startedAt,
    });
    const secrets = Object.values(credentials).filter(Boolean);
    return {
      ...result,
      data: redactValue(result.data, secrets),
      error: result.error ? redactString(result.error, secrets) : undefined,
      source: redactString(result.source, secrets),
    };
  } catch (error) {
    return {
      id: check.id,
      status: 'error',
      error: publicError(error),
      source: check.label,
      durationMs: performance.now() - startedAt,
    };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
