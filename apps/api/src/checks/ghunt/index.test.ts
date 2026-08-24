import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NormalizedTarget } from '../../core/target/normalize-target.js';
import ghunt from './index.js';

const target: NormalizedTarget = {
  original: 'analyst@example.com',
  value: 'analyst@example.com',
  hostname: 'analyst@example.com',
  kind: 'email',
};

const environment = { GHUNT_API_URL: 'https://ghunt.internal' };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('plugin GHunt', () => {
  it('retorna skipped quando o gateway não está configurado', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await ghunt.run(target, {
      signal: new AbortController().signal,
      credentials: { GHUNT_API_TOKEN: 'gateway-token' },
      environment: {},
    });

    expect(result.status).toBe('skipped');
    expect(result.error).toContain('GHUNT_API_URL');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('envia somente o e-mail e cura o JSON do runner', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        email: target.value,
        found: true,
        profile: {
          name: 'Analyst Example',
          gaiaId: 'gaia-123',
          lastUpdated: '2026-08-24T12:00:00Z',
          profilePhotoUrl: 'https://lh3.googleusercontent.com/photo',
          profilePhotoCustom: true,
          entityType: 'PERSON',
          services: ['YouTube', 'Maps'],
          raw: 'must not be returned',
        },
        signals: {
          hasPlayGamesProfile: true,
          hasMapsReviews: false,
          hasPublicCalendar: true,
          raw: 'must not be returned',
        },
        raw: 'must not be returned',
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await ghunt.run(target, {
      signal: new AbortController().signal,
      credentials: { GHUNT_API_TOKEN: 'gateway-token' },
      environment,
    });

    expect(result.status).toBe('success');
    expect(result.data).toMatchObject({
      email: target.value,
      found: true,
      profile: {
        name: 'Analyst Example',
        gaiaId: 'gaia-123',
        services: ['YouTube', 'Maps'],
      },
      signals: { hasPlayGamesProfile: true, hasPublicCalendar: true },
    });
    expect(JSON.stringify(result.data)).not.toContain('must not be returned');

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe('https://ghunt.internal/api/v2/email');
    expect(JSON.parse(String(init.body))).toEqual({ email: target.value });
    expect(new Headers(init.headers).get('authorization')).toBe(
      'Bearer gateway-token',
    );
  });

  it('traduz sessão inválida e rate limit sem expor a resposta do runner', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 429 }));
    vi.stubGlobal('fetch', fetchMock);

    const context = {
      signal: new AbortController().signal,
      credentials: { GHUNT_API_TOKEN: 'gateway-token' },
      environment,
    };

    const invalidSession = await ghunt.run(target, context);
    const rateLimit = await ghunt.run(target, context);

    expect(invalidSession.error).toContain('sessão Google');
    expect(rateLimit.error).toContain('limite');
  });
});
