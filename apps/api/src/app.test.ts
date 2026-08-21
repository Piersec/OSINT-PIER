import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import type { AppConfig } from './config.js';
import { SupabaseAuth } from './core/auth/supabase-auth.js';
import { CheckRegistry } from './core/checks/registry.js';
import { EncryptedCredentialStore } from './core/credentials/encrypted-store.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function fixture(
  options: { rateLimitMax?: number; autoAuthenticate?: boolean } = {},
) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'osint-pier-app-'));
  temporaryDirectories.push(directory);
  const encodedKey = randomBytes(32).toString('base64');
  const userToken = 'test-access-token';
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 3000,
    webOrigin: 'http://localhost:5173',
    checkTimeoutMs: 1000,
    checkCacheTtlMs: 60_000,
    checkCacheMaxEntries: 100,
    analysisRateLimitMax: options.rateLimitMax ?? 100,
    analysisRateLimitWindowMs: 60_000,
    adminToken: 'admin-token-with-more-than-24-characters',
    encryptionKey: encodedKey,
    credentialStorePath: path.join(directory, 'credentials.enc'),
    checkSettingsPath: path.join(directory, 'check-settings.json'),
    supabaseHistoryLimit: 50,
  };
  const vault = new EncryptedCredentialStore({
    filePath: config.credentialStorePath,
    encodedKey,
  });
  let executionCount = 0;
  const registry = new CheckRegistry([
    {
      id: 'credential-check',
      label: 'Credential check',
      requiredEnv: ['TEST_API_KEY'],
      async run(_target, context) {
        executionCount += 1;
        return {
          id: 'credential-check',
          status: 'success',
          data: {
            credentialReceived: Boolean(context.credentials.TEST_API_KEY),
          },
          source: 'fixture',
          durationMs: 0,
        };
      },
    },
  ]);
  const app = await createApp({
    config,
    vault,
    registry,
    environment: {},
    logger: false,
    supabaseAuth: new SupabaseAuth({
      url: 'https://project.supabase.co',
      serviceRoleKey: 'test-service-role-key',
      fetchImpl: async (_input, init) => {
        const authorization = new Headers(init?.headers).get('authorization');
        return new Response(null, {
          status: authorization === `Bearer ${userToken}` ? 200 : 401,
        });
      },
    }),
  });
  if (options.autoAuthenticate !== false) {
    app.addHook('onRequest', async (request) => {
      request.headers.authorization ??= `Bearer ${userToken}`;
    });
  }
  return {
    app,
    token: config.adminToken!,
    userToken,
    executionCount: () => executionCount,
  };
}

describe('API', () => {
<<<<<<< HEAD
  it('exige uma sessão Supabase para as operações da plataforma', async () => {
    const { app } = await fixture({ autoAuthenticate: false });
    const response = await app.inject({ method: 'GET', url: '/api/checks' });
    await app.close();

    expect(response.statusCode).toBe(401);
  });

  it('protege todas as operações administrativas', async () => {
=======
  it('permite operações do cofre sem token no modo interno temporário', async () => {
>>>>>>> 36846af18258b57a7a7474b5340ff41dc7ddd9ca
    const { app } = await fixture();
    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/credentials',
    });
    await app.close();

    expect(response.statusCode).toBe(200);
  });

  it('expõe o histórico agregado mesmo quando o Supabase está opcionalmente desabilitado', async () => {
    const { app } = await fixture();
    const listed = await app.inject({ method: 'GET', url: '/api/history' });
    const saved = await app.inject({
      method: 'POST',
      url: '/api/history',
      payload: {
        target: 'analyst@example.com',
        targetKind: 'email',
        total: 2,
        success: 1,
        attention: 1,
      },
    });
    await app.close();

    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toEqual({ enabled: false, entries: [] });
    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toEqual({
      enabled: false,
      persisted: false,
      entry: null,
    });
  });

  it('adiciona uma chave, executa o plugin e nunca devolve o segredo', async () => {
    const { app, token } = await fixture();
    const secret = 'valor-que-nao-pode-vazar';

    const saved = await app.inject({
      method: 'PUT',
      url: '/api/admin/credentials/TEST_API_KEY',
      headers: { 'x-admin-token': token },
      payload: { value: secret },
    });
    const listed = await app.inject({
      method: 'GET',
      url: '/api/admin/credentials',
      headers: { 'x-admin-token': token },
    });
    const executed = await app.inject({
      method: 'POST',
      url: '/api/checks/credential-check',
      payload: { target: 'example.com' },
    });
    await app.close();

    expect(saved.statusCode).toBe(200);
    expect(listed.json()).toEqual([
      { name: 'TEST_API_KEY', configured: true, source: 'vault' },
    ]);
    expect(executed.json().status).toBe('success');
    expect(`${saved.body}${listed.body}${executed.body}`).not.toContain(secret);
  });

  it('retorna skipped depois que a chave é removida', async () => {
    const { app, token } = await fixture();
    await app.inject({
      method: 'PUT',
      url: '/api/admin/credentials/TEST_API_KEY',
      headers: { 'x-admin-token': token },
      payload: { value: 'temporaria' },
    });
    await app.inject({
      method: 'DELETE',
      url: '/api/admin/credentials/TEST_API_KEY',
      headers: { 'x-admin-token': token },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/checks/credential-check',
      payload: { target: 'example.com' },
    });
    await app.close();

    expect(response.json().status).toBe('skipped');
  });

  it('pula um plugin web quando a consulta usa um tipo de identidade incompatível', async () => {
    const { app } = await fixture();
    const response = await app.inject({
      method: 'POST',
      url: '/api/checks/credential-check',
      payload: { target: 'analyst@example.com', targetKind: 'email' },
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'skipped',
      source: 'configuration',
    });
  });

  it('permite habilitar e desabilitar plugins pelo painel administrativo', async () => {
    const { app, token } = await fixture();

    const disabled = await app.inject({
      method: 'PUT',
      url: '/api/admin/checks/credential-check',
      headers: { 'x-admin-token': token },
      payload: { enabled: false },
    });
    const catalog = await app.inject({
      method: 'GET',
      url: '/api/checks',
    });
    const blocked = await app.inject({
      method: 'POST',
      url: '/api/checks/credential-check',
      payload: { target: 'example.com' },
    });
    const adminCatalog = await app.inject({
      method: 'GET',
      url: '/api/admin/checks',
      headers: { 'x-admin-token': token },
    });
    await app.close();

    expect(disabled.statusCode).toBe(200);
    expect(disabled.json()).toMatchObject({
      id: 'credential-check',
      enabled: false,
    });
    expect(catalog.json()).toEqual([
      expect.objectContaining({ id: 'credential-check', enabled: false }),
    ]);
    expect(blocked.statusCode).toBe(409);
    expect(adminCatalog.json()).toEqual([
      expect.objectContaining({ id: 'credential-check', enabled: false }),
    ]);
  });

  it('reutiliza resultado em cache e informa HIT no header', async () => {
    const { app, token, executionCount } = await fixture();
    await app.inject({
      method: 'PUT',
      url: '/api/admin/credentials/TEST_API_KEY',
      headers: { 'x-admin-token': token },
      payload: { value: 'temporaria' },
    });

    const first = await app.inject({
      method: 'POST',
      url: '/api/checks/credential-check',
      payload: { target: 'example.com' },
    });
    const second = await app.inject({
      method: 'POST',
      url: '/api/checks/credential-check',
      payload: { target: 'example.com' },
    });
    await app.close();

    expect(first.headers['x-osint-cache']).toBe('MISS');
    expect(second.headers['x-osint-cache']).toBe('HIT');
    expect(executionCount()).toBe(1);
  });

  it('limita apenas execuções e orienta quando tentar novamente', async () => {
    const { app } = await fixture({ rateLimitMax: 2 });
    const request = () =>
      app.inject({
        method: 'POST',
        url: '/api/checks/credential-check',
        payload: { target: 'example.com' },
      });

    expect((await request()).statusCode).toBe(200);
    expect((await request()).statusCode).toBe(200);
    const limited = await request();
    const health = await app.inject({ method: 'GET', url: '/api/health' });
    await app.close();

    expect(limited.statusCode).toBe(429);
    expect(limited.json().error).toContain('Limite de análises');
    expect(limited.headers['retry-after']).toBeDefined();
    expect(health.statusCode).toBe(200);
  });
});
