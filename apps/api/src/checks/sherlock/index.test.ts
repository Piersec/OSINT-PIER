import { afterEach, describe, expect, it, vi } from 'vitest';
import check from './index.js';

const target = {
  kind: 'username' as const,
  value: 'octocat',
  hostname: 'octocat',
  url: null,
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => vi.restoreAllMocks());

describe('sherlock check', () => {
  it('returns only curated profile URLs after usage guard succeeds', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        response({ data: { plan: { tier: 'FREE', monthlyUsageCreditsUsd: 5 } } }),
      )
      .mockResolvedValueOnce(
        response({ data: { totalUsageCreditsUsdAfterVolumeDiscount: 0.5 } }),
      )
      .mockResolvedValueOnce(
        response([
          {
            username: 'octocat',
            links: [
              'https://github.com/octocat',
              'not-a-url',
              'https://github.com/octocat',
            ],
          },
        ]),
      );

    const result = await check.run(target, {
      signal: new AbortController().signal,
      credentials: { APIFY_API_TOKEN: 'secret' },
      environment: { APIFY_USAGE_GUARD_PERCENT: '80' },
    });

    expect(result).toMatchObject({
      status: 'success',
      data: {
        username: 'octocat',
        profilesFound: 1,
        profiles: [{ url: 'https://github.com/octocat' }],
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2]?.[0].toString()).toContain(
      'misceres~sherlock/run-sync-get-dataset-items',
    );
    expect(fetchMock.mock.calls[2]?.[0].toString()).toContain(
      'maxTotalChargeUsd=0.05',
    );
  });

  it('does not start an Actor when the credit guard is active', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        response({ data: { plan: { tier: 'FREE', monthlyUsageCreditsUsd: 5 } } }),
      )
      .mockResolvedValueOnce(
        response({ data: { totalUsageCreditsUsdAfterVolumeDiscount: 4.5 } }),
      );

    const result = await check.run(target, {
      signal: new AbortController().signal,
      credentials: { APIFY_API_TOKEN: 'secret' },
      environment: { APIFY_USAGE_GUARD_PERCENT: '80' },
    });

    expect(result).toMatchObject({ status: 'skipped' });
    expect(result.error).toContain('Proteção preventiva');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
