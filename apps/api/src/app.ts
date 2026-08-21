import { fileURLToPath } from 'node:url';
import path from 'node:path';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from 'fastify';
import { z, ZodError } from 'zod';
import {
  AnalyzeRequestSchema,
  AnalysisHistoryWriteSchema,
  CheckEnabledWriteSchema,
  CredentialNameSchema,
  CredentialWriteSchema,
} from '@osint-pier/contracts';
import { loadConfig, type AppConfig } from './config.js';
import { executeCheck } from './core/checks/executor.js';
import { CheckResultCache } from './core/checks/cache.js';
import { loadCheckRegistry } from './core/checks/registry.js';
import type { CheckRegistry } from './core/checks/registry.js';
import { CheckSettingsStore } from './core/checks/settings-store.js';
import { SupabaseHistoryStore } from './core/history/supabase-history-store.js';
import { SupabaseAuth } from './core/auth/supabase-auth.js';
import { AppCredentialProvider } from './core/credentials/credential-provider.js';
import {
  EncryptedCredentialStore,
  type CredentialStore,
} from './core/credentials/encrypted-store.js';
import { SupabaseCredentialStore } from './core/credentials/supabase-credential-store.js';
import { normalizeTarget } from './core/target/normalize-target.js';

export interface AppDependencies {
  config?: AppConfig;
  registry?: CheckRegistry;
  checksDirectory?: string;
  vault?: CredentialStore;
  environment?: NodeJS.ProcessEnv;
  logger?: boolean;
  cache?: CheckResultCache;
  settings?: CheckSettingsStore;
  historyStore?: SupabaseHistoryStore;
  supabaseAuth?: SupabaseAuth;
}

function authorizeAdmin(
  _request: FastifyRequest,
  reply: FastifyReply,
  _config: AppConfig,
  _vault: CredentialStore,
): boolean {
  // Temporary internal mode requested by the owner. Keep the authorization
  // seam isolated so a future Supabase Auth/RBAC layer can replace this
  // function without changing credential endpoints or storage.
  void _config;
  void _vault;
  void reply;
  return true;
}

async function authorizeUser(
  request: FastifyRequest,
  reply: FastifyReply,
  auth: SupabaseAuth,
): Promise<boolean> {
  const authorization = request.headers.authorization;
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) {
    void reply
      .code(401)
      .send({ error: 'Faça login para acessar a plataforma.' });
    return false;
  }

  const status = await auth.validateAccessToken(accessToken);
  if (status === 'authorized') return true;
  if (status === 'unavailable') {
    void reply
      .code(503)
      .send({ error: 'Autenticação indisponível no momento.' });
    return false;
  }

  void reply.code(401).send({ error: 'Sessão inválida ou expirada.' });
  return false;
}

export async function createApp(
  dependencies: AppDependencies = {},
): Promise<FastifyInstance> {
  const config = dependencies.config ?? loadConfig(dependencies.environment);
  const checksDirectory =
    dependencies.checksDirectory ??
    path.join(path.dirname(fileURLToPath(import.meta.url)), 'checks');
  const registry =
    dependencies.registry ?? (await loadCheckRegistry(checksDirectory));
  const vault =
    dependencies.vault ??
    (config.supabaseUrl && config.supabaseServiceRoleKey
      ? new SupabaseCredentialStore({
          url: config.supabaseUrl,
          serviceRoleKey: config.supabaseServiceRoleKey,
          encodedKey: config.encryptionKey,
        })
      : new EncryptedCredentialStore({
          filePath: config.credentialStorePath,
          encodedKey: config.encryptionKey,
        }));
  const credentialProvider = new AppCredentialProvider(
    vault,
    dependencies.environment ?? process.env,
  );
  const cache =
    dependencies.cache ??
    new CheckResultCache({
      ttlMs: config.checkCacheTtlMs,
      maxEntries: config.checkCacheMaxEntries,
    });
  const settings =
    dependencies.settings ?? new CheckSettingsStore(config.checkSettingsPath);
  await settings.initialize();
  const historyStore =
    dependencies.historyStore ??
    new SupabaseHistoryStore({
      url: config.supabaseUrl,
      serviceRoleKey: config.supabaseServiceRoleKey,
      defaultLimit: config.supabaseHistoryLimit,
    });
  const supabaseAuth =
    dependencies.supabaseAuth ??
    new SupabaseAuth({
      url: config.supabaseUrl,
      serviceRoleKey: config.supabaseServiceRoleKey,
    });
  const requireUser = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await authorizeUser(request, reply, supabaseAuth))) return reply;
  };
  const app = Fastify({ logger: dependencies.logger ?? true });

  await app.register(cors, { origin: config.webOrigin });
  await app.register(rateLimit, {
    global: false,
    max: config.analysisRateLimitMax,
    timeWindow: config.analysisRateLimitWindowMs,
    errorResponseBuilder: (_request, context) => ({
      statusCode: 429,
      error: `Limite de análises atingido. Tente novamente em ${context.after}.`,
      retryAfterMs: context.ttl,
    }),
  });

  app.setErrorHandler((error, _request, reply) => {
    if (
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      error.statusCode === 429
    ) {
      const rateLimitError = error as unknown as {
        error?: unknown;
        retryAfterMs?: unknown;
      };
      return reply.code(429).send({
        error:
          typeof rateLimitError.error === 'string'
            ? rateLimitError.error
            : 'Limite de análises atingido. Aguarde antes de tentar novamente.',
        retryAfterMs:
          typeof rateLimitError.retryAfterMs === 'number'
            ? rateLimitError.retryAfterMs
            : undefined,
      });
    }
    if (error instanceof ZodError) {
      return reply
        .code(400)
        .send({ error: 'Dados inválidos.', details: error.issues });
    }
    app.log.error(error);
    return reply.code(500).send({ error: 'Erro interno inesperado.' });
  });

  app.get('/api/health', async () => ({ status: 'ok' }));

  app.get(
    '/api/history',
    { preHandler: requireUser },
    async (request, reply) => {
      const { limit } = z
        .object({ limit: z.coerce.number().int().min(1).max(500).default(50) })
        .parse(request.query ?? {});
      try {
        return {
          enabled: historyStore.enabled,
          entries: await historyStore.list(limit),
        };
      } catch (error) {
        app.log.error(error);
        return reply
          .code(503)
          .send({ error: 'Histórico persistente indisponível.' });
      }
    },
  );

  app.post(
    '/api/history',
    { preHandler: requireUser },
    async (request, reply) => {
      const input = AnalysisHistoryWriteSchema.parse(request.body);
      try {
        const entry = await historyStore.append(input);
        return {
          enabled: historyStore.enabled,
          persisted: Boolean(entry),
          entry,
        };
      } catch (error) {
        app.log.error(error);
        return reply
          .code(503)
          .send({ error: 'Não foi possível salvar o histórico.' });
      }
    },
  );

  app.get('/api/checks', { preHandler: requireUser }, async () => {
    const checks = registry.all();
    const enabled = await settings.list(checks.map((check) => check.id));
    return Promise.all(
      checks.map(async (check) => ({
        id: check.id,
        label: check.label,
        enabled: enabled[check.id] ?? true,
        requiredCredentials: [...check.requiredEnv],
        supportedTargetKinds: [...(check.supportedTargetKinds ?? [])],
        configured: (
          await Promise.all(
            check.requiredEnv.map((name) => credentialProvider.get(name)),
          )
        ).every(Boolean),
      })),
    );
  });

  app.post(
    '/api/checks/:id',
    {
      preHandler: requireUser,
      config: {
        rateLimit: {
          groupId: 'analysis',
        },
      },
    },
    async (request, reply) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const check = registry.get(id);
      if (!check)
        return reply.code(404).send({ error: 'Checagem não encontrada.' });
      if (!(await settings.isEnabled(check.id))) {
        return reply.code(409).send({
          error: 'Esta checagem está desabilitada no painel interno.',
        });
      }

      const { target, targetKind } = AnalyzeRequestSchema.parse(request.body);
      let normalizedTarget;
      try {
        normalizedTarget = normalizeTarget(target, targetKind);
      } catch (error) {
        return reply.code(400).send({
          error: error instanceof Error ? error.message : 'Alvo inválido.',
        });
      }

      const cacheKey = `${check.id}\u0000${normalizedTarget.kind}\u0000${normalizedTarget.value}`;
      const execution = await cache.execute(cacheKey, () =>
        executeCheck({
          check,
          target: normalizedTarget,
          credentialProvider,
          defaultTimeoutMs: config.checkTimeoutMs,
        }),
      );
      void reply.header('x-osint-cache', execution.cacheStatus);
      return execution.result;
    },
  );

  app.get(
    '/api/admin/credentials',
    { preHandler: requireUser },
    async (request, reply) => {
      if (!authorizeAdmin(request, reply, config, vault)) return reply;
      const names = new Set(await vault.listNames());
      for (const check of registry.all()) {
        for (const name of check.requiredEnv) names.add(name);
      }

      return Promise.all(
        [...names].sort().map(async (name) => ({
          name,
          configured: Boolean(await credentialProvider.get(name)),
          source: await credentialProvider.source(name),
        })),
      );
    },
  );

  app.get(
    '/api/admin/checks',
    { preHandler: requireUser },
    async (request, reply) => {
      if (!authorizeAdmin(request, reply, config, vault)) return reply;
      const checks = registry.all();
      const enabled = await settings.list(checks.map((check) => check.id));

      return Promise.all(
        checks.map(async (check) => ({
          id: check.id,
          label: check.label,
          enabled: enabled[check.id] ?? true,
          requiredCredentials: [...check.requiredEnv],
          supportedTargetKinds: [...(check.supportedTargetKinds ?? [])],
          configured: (
            await Promise.all(
              check.requiredEnv.map((name) => credentialProvider.get(name)),
            )
          ).every(Boolean),
        })),
      );
    },
  );

  app.put(
    '/api/admin/checks/:id',
    { preHandler: requireUser },
    async (request, reply) => {
      if (!authorizeAdmin(request, reply, config, vault)) return reply;
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const check = registry.get(id);
      if (!check)
        return reply.code(404).send({ error: 'Checagem não encontrada.' });
      const { enabled } = CheckEnabledWriteSchema.parse(request.body);
      await settings.setEnabled(check.id, enabled);
      cache.clear();

      return {
        id: check.id,
        label: check.label,
        enabled,
        requiredCredentials: [...check.requiredEnv],
        supportedTargetKinds: [...(check.supportedTargetKinds ?? [])],
        configured: (
          await Promise.all(
            check.requiredEnv.map((name) => credentialProvider.get(name)),
          )
        ).every(Boolean),
      };
    },
  );

  app.put(
    '/api/admin/credentials/:name',
    { preHandler: requireUser },
    async (request, reply) => {
      if (!authorizeAdmin(request, reply, config, vault)) return reply;
      const name = CredentialNameSchema.parse(
        z.object({ name: z.string() }).parse(request.params).name,
      );
      const { value } = CredentialWriteSchema.parse(request.body);
      await vault.set(name, value);
      cache.clear();
      return { name, configured: true, source: 'vault' as const };
    },
  );

  app.delete(
    '/api/admin/credentials/:name',
    { preHandler: requireUser },
    async (request, reply) => {
      if (!authorizeAdmin(request, reply, config, vault)) return reply;
      const name = CredentialNameSchema.parse(
        z.object({ name: z.string() }).parse(request.params).name,
      );
      await vault.remove(name);
      cache.clear();
      const source = await credentialProvider.source(name);
      return { name, configured: Boolean(source), source };
    },
  );

  return app;
}
