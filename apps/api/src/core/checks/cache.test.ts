import { describe, expect, it, vi } from 'vitest';
import type { CheckResult } from '@osint-pier/contracts';
import { CheckResultCache } from './cache.js';

const successResult: CheckResult = {
  id: 'test-check',
  status: 'success',
  data: { ok: true },
  source: 'test',
  durationMs: 1,
};

describe('CheckResultCache', () => {
  it('reutiliza apenas resultados bem-sucedidos dentro do TTL', async () => {
    const producer = vi.fn().mockResolvedValue(successResult);
    const cache = new CheckResultCache({ ttlMs: 1000, maxEntries: 10 });

    const first = await cache.execute('key', producer);
    const second = await cache.execute('key', producer);

    expect(first.cacheStatus).toBe('MISS');
    expect(second.cacheStatus).toBe('HIT');
    expect(producer).toHaveBeenCalledTimes(1);
  });

  it('não armazena erros', async () => {
    const errorResult: CheckResult = {
      id: 'test-check',
      status: 'error',
      error: 'Falha controlada.',
      source: 'test',
      durationMs: 1,
    };
    const producer = vi.fn().mockResolvedValue(errorResult);
    const cache = new CheckResultCache({ ttlMs: 1000, maxEntries: 10 });

    await cache.execute('key', producer);
    await cache.execute('key', producer);

    expect(producer).toHaveBeenCalledTimes(2);
  });

  it('deduplica execuções simultâneas para a mesma chave', async () => {
    let resolveExecution!: (result: CheckResult) => void;
    const producer = vi.fn(
      () =>
        new Promise<CheckResult>((resolve) => {
          resolveExecution = resolve;
        }),
    );
    const cache = new CheckResultCache({ ttlMs: 1000, maxEntries: 10 });

    const first = cache.execute('key', producer);
    const second = cache.execute('key', producer);
    resolveExecution(successResult);

    expect((await first).cacheStatus).toBe('MISS');
    expect((await second).cacheStatus).toBe('COALESCED');
    expect(producer).toHaveBeenCalledTimes(1);
  });

  it('expira entradas e respeita o limite de memória', async () => {
    let now = 0;
    const producer = vi.fn().mockResolvedValue(successResult);
    const cache = new CheckResultCache({
      ttlMs: 10,
      maxEntries: 1,
      now: () => now,
    });

    await cache.execute('first', producer);
    await cache.execute('second', producer);
    await cache.execute('first', producer);
    now = 11;
    await cache.execute('first', producer);

    expect(producer).toHaveBeenCalledTimes(4);
  });

  it('não restaura resposta antiga quando o cache é limpo durante a execução', async () => {
    let resolveOld!: (result: CheckResult) => void;
    const oldResult = { ...successResult, data: { version: 'old' } };
    const newResult = { ...successResult, data: { version: 'new' } };
    const producer = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<CheckResult>((resolve) => {
            resolveOld = resolve;
          }),
      )
      .mockResolvedValue(newResult);
    const cache = new CheckResultCache({ ttlMs: 1000, maxEntries: 10 });

    const oldExecution = cache.execute('key', producer);
    cache.clear();
    const freshExecution = await cache.execute('key', producer);
    resolveOld(oldResult);
    await oldExecution;
    const cached = await cache.execute('key', producer);

    expect(freshExecution.result).toEqual(newResult);
    expect(cached.result).toEqual(newResult);
    expect(producer).toHaveBeenCalledTimes(2);
  });
});
