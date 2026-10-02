import { afterEach, describe, expect, it, vi } from 'vitest';
import check from './index.js';

const target = {
  kind: 'url' as const,
  value: 'https://www.linkedin.com/in/octocat/',
  hostname: 'www.linkedin.com',
  original: 'https://www.linkedin.com/in/octocat/',
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => vi.restoreAllMocks());

describe('linkedin-profile check', () => {
  it('solicita um único perfil sem ativar busca de e-mail', async () => {
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
            fullName: 'The Octocat',
            headline: 'Developer',
            companyName: 'GitHub',
            location: 'San Francisco',
            linkedinUrl: target.value,
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
      data: { name: 'The Octocat', company: 'GitHub' },
    });
    expect(fetchMock.mock.calls[2]?.[1]?.body).toBe(
      JSON.stringify({ urls: [target.value] }),
    );
    expect(fetchMock.mock.calls[2]?.[0].toString()).toContain(
      'maxTotalChargeUsd=0.01',
    );
  });

  it('não inicia o actor quando a proteção de crédito está ativa', async () => {
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

    expect(result.status).toBe('skipped');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
