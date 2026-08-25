export type SupabaseAuthStatus =
  'authorized' | 'mfa_required' | 'unauthorized' | 'unavailable';

interface SupabaseUserResponse {
  factors?: Array<{
    factor_type?: unknown;
    status?: unknown;
  }>;
}

interface AccessTokenClaims {
  aal?: unknown;
}

function readAccessTokenClaims(accessToken: string): AccessTokenClaims | null {
  try {
    const payload = accessToken.split('.')[1];
    if (!payload) return null;
    return JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    ) as AccessTokenClaims;
  } catch {
    return null;
  }
}

function hasVerifiedFactor(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const factors = (value as SupabaseUserResponse).factors;
  return (
    Array.isArray(factors) &&
    factors.some(
      (factor) => factor.status === 'verified' && factor.factor_type === 'totp',
    )
  );
}

export class SupabaseAuth {
  readonly #url?: string;
  readonly #serviceRoleKey?: string;
  readonly #fetch: typeof fetch;

  constructor(options: {
    url?: string;
    serviceRoleKey?: string;
    fetchImpl?: typeof fetch;
  }) {
    this.#url = options.url?.replace(/\/$/, '');
    this.#serviceRoleKey = options.serviceRoleKey;
    this.#fetch = options.fetchImpl ?? fetch;
  }

  get configured(): boolean {
    return Boolean(this.#url && this.#serviceRoleKey);
  }

  async validateAccessToken(accessToken: string): Promise<SupabaseAuthStatus> {
    if (!this.configured) return 'unavailable';

    try {
      const response = await this.#fetch(`${this.#url}/auth/v1/user`, {
        headers: {
          apikey: this.#serviceRoleKey!,
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (response.ok) {
        const user = await response.json().catch(() => undefined);
        const claims = readAccessTokenClaims(accessToken);
        if (hasVerifiedFactor(user) && claims?.aal !== 'aal2') {
          return 'mfa_required';
        }
        return 'authorized';
      }
      if (response.status === 401 || response.status === 403)
        return 'unauthorized';
      return 'unavailable';
    } catch {
      return 'unavailable';
    }
  }
}
