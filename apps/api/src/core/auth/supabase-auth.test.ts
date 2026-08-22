import { describe, expect, it } from 'vitest';
import { SupabaseAuth } from './supabase-auth.js';

function tokenWithAal(aal: string): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ aal })}.signature`;
}

describe('SupabaseAuth', () => {
  it('requires AAL2 when the validated user has a verified TOTP factor', async () => {
    const auth = new SupabaseAuth({
      url: 'https://project.supabase.co',
      serviceRoleKey: 'service-role-key',
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            factors: [{ factor_type: 'totp', status: 'verified' }],
          }),
          { status: 200 },
        ),
    });

    await expect(auth.validateAccessToken(tokenWithAal('aal1'))).resolves.toBe(
      'mfa_required',
    );
  });

  it('authorizes an AAL2 session and users without a verified factor', async () => {
    const responseBody = JSON.stringify({
      factors: [{ factor_type: 'totp', status: 'verified' }],
    });
    const auth = new SupabaseAuth({
      url: 'https://project.supabase.co',
      serviceRoleKey: 'service-role-key',
      fetchImpl: async () => new Response(responseBody, { status: 200 }),
    });

    await expect(auth.validateAccessToken(tokenWithAal('aal2'))).resolves.toBe(
      'authorized',
    );

    const withoutFactor = new SupabaseAuth({
      url: 'https://project.supabase.co',
      serviceRoleKey: 'service-role-key',
      fetchImpl: async () =>
        new Response(JSON.stringify({ factors: [] }), { status: 200 }),
    });
    await expect(
      withoutFactor.validateAccessToken(tokenWithAal('aal1')),
    ).resolves.toBe('authorized');
  });
});
