import { describe, expect, it, vi } from 'vitest';
import {
  apifyGuardThresholdFromEnvironment,
  getApifyUsageSummary,
} from './usage.js';

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('getApifyUsageSummary', () => {
  it('reports remaining free credit and keeps the guard open below the threshold', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response({ data: { plan: { tier: 'FREE', monthlyUsageCreditsUsd: 5 } } }),
      )
      .mockResolvedValueOnce(
        response({
          data: {
            usageCycle: { endAt: '2026-10-31T23:59:59.000Z' },
            totalUsageCreditsUsdAfterVolumeDiscount: 1.25,
          },
        }),
      );

    const summary = await getApifyUsageSummary({
      token: 'secret',
      guardThresholdPercent: 80,
      fetchImpl,
    });

    expect(summary).toMatchObject({
      status: 'available',
      planTier: 'FREE',
      monthlyCreditUsd: 5,
      usedUsd: 1.25,
      remainingUsd: 3.75,
      usagePercent: 25,
      guardActive: false,
    });
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      'https://api.apify.com/v2/users/me',
      'https://api.apify.com/v2/users/me/usage/monthly',
    ]);
  });

  it('blocks tools at the preventive threshold and fails closed on unavailable usage', async () => {
    const nearLimit = await getApifyUsageSummary({
      token: 'secret',
      guardThresholdPercent: 80,
      fetchImpl: vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          response({ data: { plan: { tier: 'FREE', monthlyUsageCreditsUsd: 5 } } }),
        )
        .mockResolvedValueOnce(
          response({ data: { totalUsageCreditsUsdAfterVolumeDiscount: 4 } }),
        ),
    });
    const unavailable = await getApifyUsageSummary({
      token: 'secret',
      guardThresholdPercent: 80,
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(response({}, 401)),
    });

    expect(nearLimit.guardActive).toBe(true);
    expect(nearLimit.guardReason).toContain('80%');
    expect(unavailable).toMatchObject({ status: 'unavailable', guardActive: true });
  });

  it('uses a conservative default threshold', () => {
    expect(apifyGuardThresholdFromEnvironment({})).toBe(80);
    expect(apifyGuardThresholdFromEnvironment({ APIFY_USAGE_GUARD_PERCENT: '90' })).toBe(90);
    expect(apifyGuardThresholdFromEnvironment({ APIFY_USAGE_GUARD_PERCENT: '15' })).toBe(80);
  });
});
