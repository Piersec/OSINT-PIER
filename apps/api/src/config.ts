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

function emptyToUndefined(value: unknown): unknown {
  return typeof value === 'string' && value.trim() === '' ? undefined : value;
}

const optionalText = z.preprocess(emptyToUndefined, z.string().optional());
const optionalUrl = z.preprocess((value) => {
  const normalized = emptyToUndefined(value);
  if (typeof normalized !== 'string') return normalized;
  const trimmed = normalized.trim().replace(/^("|')|("|')$/g, '');
  try {
    new URL(trimmed);
    return trimmed;
  } catch {
    // Optional deployment configuration must not prevent public routes from
    // starting. The store remains disabled until a valid URL is provided.
    return undefined;
  }
}, z.string().url().optional());
const optionalPositiveNumber = (defaultValue: number) =>
  z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(1).max(500).default(defaultValue),
  );

const optionalString = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().min(1).optional(),
);

const optionalUrl = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().url().optional(),
);

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
<<<<<<< HEAD
  ADMIN_TOKEN: z.string().min(24).optional(),
  CREDENTIALS_ENCRYPTION_KEY: optionalString,
  CREDENTIAL_STORE_PATH: z.string().optional(),
  CHECK_SETTINGS_PATH: z.string().optional(),
  SUPABASE_URL: optionalUrl,
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  SUPABASE_HISTORY_LIMIT: z.coerce.number().int().min(1).max(500).default(50),
=======
  // Retained as a future authentication seam; the current internal build does
  // not require a token for the credentials panel.
  ADMIN_TOKEN: optionalText,
  CREDENTIALS_ENCRYPTION_KEY: optionalText,
  CREDENTIAL_STORE_PATH: optionalText,
  CHECK_SETTINGS_PATH: optionalText,
  SUPABASE_URL: optionalUrl,
  SUPABASE_SERVICE_ROLE_KEY: optionalText,
  SUPABASE_HISTORY_LIMIT: optionalPositiveNumber(50),
>>>>>>> 36846af18258b57a7a7474b5340ff41dc7ddd9ca
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
