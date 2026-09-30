import { describe, expect, it } from 'vitest';
import { cloudflareAccessServiceHeaders } from './cloudflare-access.js';

describe('Cloudflare Access service headers', () => {
  it('returns both headers only when the service token is complete', () => {
    expect(
      cloudflareAccessServiceHeaders({
        CLOUDFLARE_ACCESS_CLIENT_ID: 'client-id',
        CLOUDFLARE_ACCESS_CLIENT_SECRET: 'client-secret',
      }),
    ).toEqual({
      'CF-Access-Client-Id': 'client-id',
      'CF-Access-Client-Secret': 'client-secret',
    });

    expect(
      cloudflareAccessServiceHeaders({
        CLOUDFLARE_ACCESS_CLIENT_ID: 'client-id',
      }),
    ).toEqual({});
  });

  it('trims configured values and returns no headers when absent', () => {
    expect(
      cloudflareAccessServiceHeaders({
        CLOUDFLARE_ACCESS_CLIENT_ID: ' client-id ',
        CLOUDFLARE_ACCESS_CLIENT_SECRET: ' client-secret ',
      }),
    ).toEqual({
      'CF-Access-Client-Id': 'client-id',
      'CF-Access-Client-Secret': 'client-secret',
    });
    expect(cloudflareAccessServiceHeaders({})).toEqual({});
  });
});
