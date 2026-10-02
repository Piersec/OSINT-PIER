import { afterEach, describe, expect, it, vi } from 'vitest';
import check from './index.js';

const target = {
  kind: 'name' as const,
  value: 'cafeterias em São Paulo',
  hostname: 'cafeterias em São Paulo',
  original: 'cafeterias em São Paulo',
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => vi.restoreAllMocks());

describe('google-places check', () => {
  it('limita a consulta e mantém add-ons pagos desabilitados', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        response({ data: { plan: { tier: 'FREE', monthlyUsageCreditsUsd: 5 } } }),
      )
      .mockResolvedValueOnce(
        response({ data: { totalUsageCreditsUsdAfterVolumeDiscount: 0.5 } }),
      )
      .mockResolvedValueOnce(
        response([{ title: 'Café', totalScore: 4.7, reviewsCount: 120 }]),
      );

    const result = await check.run(target, {
      signal: new AbortController().signal,
      credentials: { APIFY_API_TOKEN: 'secret' },
      environment: { APIFY_USAGE_GUARD_PERCENT: '80' },
    });

    expect(result).toMatchObject({
      status: 'success',
      data: { placesFound: 1, places: [{ name: 'Café', rating: 4.7 }] },
    });
    expect(fetchMock.mock.calls[2]?.[0].toString()).toContain(
      'maxTotalChargeUsd=0.05',
    );
    expect(JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body))).toMatchObject({
      maxCrawledPlacesPerSearch: 10,
      scrapeContacts: false,
      scrapePlaceDetailPage: false,
    });
  });
});
