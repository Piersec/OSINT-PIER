import { z } from 'zod';
import type { CheckSettings } from './settings-store.js';

const CheckSettingsRowSchema = z.object({
  check_id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  enabled: z.boolean(),
});

/** Persists plugin flags outside the ephemeral serverless filesystem. */
export class SupabaseCheckSettingsStore implements CheckSettings {
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

  async initialize(): Promise<void> {
    this.#assertConfigured();
  }

  async isEnabled(id: string): Promise<boolean> {
    return (await this.list([id]))[id] ?? true;
  }

  async list(ids: Iterable<string>): Promise<Record<string, boolean>> {
    this.#assertConfigured();
    const requested = [...new Set(ids)];
    if (requested.length === 0) return {};

    const endpoint = this.#endpoint();
    endpoint.searchParams.set('select', 'check_id,enabled');
    const response = await this.#fetch(endpoint, { headers: this.#headers() });
    this.#assertResponse(response);
    const rows = z.array(CheckSettingsRowSchema).parse(await response.json());
    const stored = new Map(rows.map((row) => [row.check_id, row.enabled]));
    return Object.fromEntries(
      requested.map((id) => [id, stored.get(id) ?? true]),
    );
  }

  async setEnabled(id: string, enabled: boolean): Promise<void> {
    CheckSettingsRowSchema.shape.check_id.parse(id);
    const endpoint = this.#endpoint();

    if (enabled) {
      endpoint.searchParams.set('check_id', `eq.${id}`);
      const response = await this.#fetch(endpoint, {
        method: 'DELETE',
        headers: this.#headers(),
      });
      this.#assertResponse(response);
      return;
    }

    endpoint.searchParams.set('on_conflict', 'check_id');
    const response = await this.#fetch(endpoint, {
      method: 'POST',
      headers: {
        ...this.#headers(),
        'content-type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        check_id: id,
        enabled: false,
        updated_at: new Date().toISOString(),
      }),
    });
    this.#assertResponse(response);
  }

  #endpoint(): URL {
    this.#assertConfigured();
    return new URL(`${this.#url}/rest/v1/check_settings`);
  }

  #headers(): HeadersInit {
    this.#assertConfigured();
    const headers: Record<string, string> = {
      apikey: this.#serviceRoleKey!,
    };
    if (!this.#serviceRoleKey!.startsWith('sb_secret_')) {
      headers.Authorization = `Bearer ${this.#serviceRoleKey!}`;
    }
    return headers;
  }

  #assertConfigured(): void {
    if (!this.#url || !this.#serviceRoleKey) {
      throw new Error('Configuração persistente de plugins indisponível.');
    }
  }

  #assertResponse(response: Response): void {
    if (!response.ok) {
      throw new Error('Configuração persistente de plugins indisponível.');
    }
  }
}
