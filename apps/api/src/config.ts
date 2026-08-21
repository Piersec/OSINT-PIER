import { existsSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

// Resolve runtime data from the workspace/current deployment instead of a
// file URL. This keeps the same local layout and allows Next/Turbopack to
// bundle the Fastify adapter without treating the optional files as imports.
function resolveDefaultDataFile(fileName: string): string {
  const directories = [
    path.resolve(process.cwd(), '.data', fileName),
    path.resolve(process.cwd(), '..', '.data', fileName),
    path.resolve(process.cwd(), '..', '..', '.data', fileName),
  ];

  // `pnpm --filter @osint-pier/web dev` runs with apps/web as cwd, while
  // Vercel and the standalone API normally run from the monorepo root. Keep
  // the encrypted vault and check flags in the same root .data directory in
  // both cases, and preserve a sensible default for a fresh deployment.
  const existing = directories.find((candidate) => existsSync(candidate));
  if (existing) return existing;
  return path.basename(process.cwd()) === 'web'
    ? directories[2]!
    : directories[0]!;
}

const defaultStorePath = resolveDefaultDataFile('credentials.enc');
const defaultCheckSettingsPath = resolveDefaultDataFile('check-settings.json');

const EnvironmentSchema = z.object({
  API_HOST: z.string().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  CHECK_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(100)
    .max(120_000)
    .default(10_000),
  CHECK_CACHE_TTL_MS: z.coerce
    .number()
    .int()
    .min(0)
    .max(86_400_000)
    .default(300_000),
  CHECK_CACHE_MAX_ENTRIES: z.coerce
    .number()
    .int()
    .min(1)
    .max(100_000)
    .default(1000),
  ANALYSIS_RATE_LIMIT_MAX: z.coerce
    .number()
    .int()
    .min(1)
    .max(100_000)
    .default(60),
  ANALYSIS_RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(86_400_000)
    .default(60_000),
  ADMIN_TOKEN: z.string().min(24).optional(),
  CREDENTIALS_ENCRYPTION_KEY: z.string().optional(),
  CREDENTIAL_STORE_PATH: z.string().optional(),
  CHECK_SETTINGS_PATH: z.string().optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  SUPABASE_HISTORY_LIMIT: z.coerce.number().int().min(1).max(500).default(50),
});

export interface AppConfig {
  host: string;
  port: number;
  webOrigin: string;
  checkTimeoutMs: number;
  checkCacheTtlMs: number;
  checkCacheMaxEntries: number;
  analysisRateLimitMax: number;
  analysisRateLimitWindowMs: number;
  adminToken?: string;
  encryptionKey?: string;
  credentialStorePath: string;
  checkSettingsPath: string;
  supabaseUrl?: string;
  supabaseServiceRoleKey?: string;
  supabaseHistoryLimit: number;
}

export function loadConfig(
  environment: NodeJS.ProcessEnv = process.env,
): AppConfig {
  const parsed = EnvironmentSchema.parse(environment);

  return {
    host: parsed.API_HOST,
    port: parsed.PORT,
    webOrigin: parsed.WEB_ORIGIN,
    checkTimeoutMs: parsed.CHECK_TIMEOUT_MS,
    checkCacheTtlMs: parsed.CHECK_CACHE_TTL_MS,
    checkCacheMaxEntries: parsed.CHECK_CACHE_MAX_ENTRIES,
    analysisRateLimitMax: parsed.ANALYSIS_RATE_LIMIT_MAX,
    analysisRateLimitWindowMs: parsed.ANALYSIS_RATE_LIMIT_WINDOW_MS,
    adminToken: parsed.ADMIN_TOKEN,
    encryptionKey: parsed.CREDENTIALS_ENCRYPTION_KEY,
    credentialStorePath: parsed.CREDENTIAL_STORE_PATH
      ? path.resolve(parsed.CREDENTIAL_STORE_PATH)
      : defaultStorePath,
    checkSettingsPath: parsed.CHECK_SETTINGS_PATH
      ? path.resolve(parsed.CHECK_SETTINGS_PATH)
      : defaultCheckSettingsPath,
    supabaseUrl: parsed.SUPABASE_URL,
    supabaseServiceRoleKey: parsed.SUPABASE_SERVICE_ROLE_KEY,
    supabaseHistoryLimit: parsed.SUPABASE_HISTORY_LIMIT,
  };
}
