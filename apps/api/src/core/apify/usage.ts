const APIFY_API_URL = 'https://api.apify.com/v2';

export type ApifyUsageStatus = 'available' | 'unavailable' | 'not-configured';

export interface ApifyUsageSummary {
  status: ApifyUsageStatus;
  planTier?: string;
  monthlyCreditUsd?: number;
  usedUsd?: number;
  remainingUsd?: number;
  usagePercent?: number;
  cycleEndsAt?: string;
  guardThresholdPercent: number;
  guardActive: boolean;
  guardReason?: string;
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

function recordOrUndefined(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function parseUsagePayloads(userPayload: unknown, monthlyUsagePayload: unknown): {
  planTier?: string;
  monthlyCreditUsd?: number;
  usedUsd?: number;
  cycleEndsAt?: string;
} {
  const userData = recordOrUndefined(userPayload)?.data;
  const plan = recordOrUndefined(recordOrUndefined(userData)?.plan);
  const usageData = recordOrUndefined(monthlyUsagePayload)?.data;
  const cycle = recordOrUndefined(recordOrUndefined(usageData)?.usageCycle);

  return {
    planTier: stringOrUndefined(plan?.tier)?.toUpperCase(),
    monthlyCreditUsd: numberOrUndefined(plan?.monthlyUsageCreditsUsd),
    usedUsd:
      numberOrUndefined(usageData?.totalUsageCreditsUsdAfterVolumeDiscount) ??
      numberOrUndefined(usageData?.totalUsageCreditsUsd),
    cycleEndsAt: stringOrUndefined(cycle?.endAt),
  };
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

async function getJson(
  path: string,
  token: string,
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  const response = await fetchImpl(`${APIFY_API_URL}${path}`, {
    signal,
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) throw new Error(`Apify respondeu com HTTP ${response.status}.`);
  return response.json();
}

export async function getApifyUsageSummary(options: {
  token?: string;
  guardThresholdPercent: number;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}): Promise<ApifyUsageSummary> {
  const { token, guardThresholdPercent, signal, fetchImpl } = options;
  if (!token) {
    return {
      status: 'not-configured',
      guardThresholdPercent,
      guardActive: true,
      guardReason: 'Credencial APIFY_API_TOKEN não configurada.',
    };
  }

  try {
    const [userPayload, monthlyUsagePayload] = await Promise.all([
      getJson('/users/me', token, signal, fetchImpl),
      getJson('/users/me/usage/monthly', token, signal, fetchImpl),
    ]);
    const { planTier, monthlyCreditUsd, usedUsd, cycleEndsAt } =
      parseUsagePayloads(userPayload, monthlyUsagePayload);

    if (!monthlyCreditUsd || usedUsd === undefined) {
      return {
        status: 'unavailable',
        planTier,
        guardThresholdPercent,
        guardActive: true,
        guardReason: 'O Apify não informou uma cota mensal utilizável.',
      };
    }

    const usagePercent = clampPercent((usedUsd / monthlyCreditUsd) * 100);
    const planIsFree = planTier === 'FREE';
    const guardActive = !planIsFree || usagePercent >= guardThresholdPercent;
    return {
      status: 'available',
      planTier,
      monthlyCreditUsd,
      usedUsd,
      remainingUsd: Math.max(0, monthlyCreditUsd - usedUsd),
      usagePercent,
      cycleEndsAt,
      guardThresholdPercent,
      guardActive,
      guardReason: guardActive
        ? planIsFree
          ? `Proteção preventiva ativada em ${guardThresholdPercent}% da cota mensal.`
          : 'O OSINT Pier está configurado para operar somente no plano Free do Apify.'
        : undefined,
    };
  } catch {
    return {
      status: 'unavailable',
      guardThresholdPercent,
      guardActive: true,
      guardReason:
        'Não foi possível confirmar a cota do Apify; as ferramentas foram bloqueadas por segurança.',
    };
  }
}

export function apifyGuardThresholdFromEnvironment(
  environment: Readonly<Record<string, string | undefined>> | undefined,
): number {
  const parsed = Number(environment?.APIFY_USAGE_GUARD_PERCENT);
  return Number.isInteger(parsed) && parsed >= 50 && parsed <= 99 ? parsed : 80;
}
