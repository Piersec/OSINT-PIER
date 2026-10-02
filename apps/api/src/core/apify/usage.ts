import { z } from 'zod';

const APIFY_API_URL = 'https://api.apify.com/v2';

const UserResponseSchema = z.object({
  data: z.object({
    plan: z.object({
      tier: z.string().optional(),
      monthlyUsageCreditsUsd: z.number().finite().nonnegative().optional(),
    }),
  }),
});

const MonthlyUsageResponseSchema = z.object({
  data: z.object({
    usageCycle: z
      .object({ endAt: z.string().datetime({ offset: true }).optional() })
      .optional(),
    totalUsageCreditsUsdAfterVolumeDiscount: z.number().finite().nonnegative().optional(),
    totalUsageCreditsUsd: z.number().finite().nonnegative().optional(),
  }),
});

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
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
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
    const user = UserResponseSchema.parse(userPayload);
    const monthlyUsage = MonthlyUsageResponseSchema.parse(monthlyUsagePayload);
    const planTier = user.data.plan.tier?.toUpperCase();
    const monthlyCreditUsd = numberOrUndefined(
      user.data.plan.monthlyUsageCreditsUsd,
    );
    const usedUsd =
      numberOrUndefined(
        monthlyUsage.data.totalUsageCreditsUsdAfterVolumeDiscount,
      ) ?? numberOrUndefined(monthlyUsage.data.totalUsageCreditsUsd);

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
      cycleEndsAt: monthlyUsage.data.usageCycle?.endAt,
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
