export type SupabaseAuthStatus = 'authorized' | 'unauthorized' | 'unavailable';

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
      if (response.ok) return 'authorized';
      if (response.status === 401 || response.status === 403)
        return 'unauthorized';
      return 'unavailable';
    } catch {
      return 'unavailable';
    }
  }
}
