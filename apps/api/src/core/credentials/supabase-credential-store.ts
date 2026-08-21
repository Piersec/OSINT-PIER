import { CredentialNameSchema } from '@osint-pier/contracts';
import { z } from 'zod';
import {
  CredentialStoreDisabledError,
  decodeEncryptionKey,
  decryptVaultValue,
  encryptVaultValue,
  type CredentialStore,
  type VaultEnvelope,
} from './encrypted-store.js';

const SupabaseCredentialRowSchema = z.object({
  name: CredentialNameSchema,
  version: z.literal(1),
  algorithm: z.literal('aes-256-gcm'),
  iv: z.string().min(1),
  auth_tag: z.string().min(1),
  ciphertext: z.string().min(1),
});

const SupabaseCredentialNameRowSchema = z.object({
  name: CredentialNameSchema,
});

export class SupabaseCredentialStore implements CredentialStore {
  readonly #url?: string;
  readonly #serviceRoleKey?: string;
  readonly #key?: Buffer;
  readonly #fetch: typeof fetch;
  readonly configurationError?: string;

  constructor(options: {
    url?: string;
    serviceRoleKey?: string;
    encodedKey?: string;
    fetchImpl?: typeof fetch;
  }) {
    this.#url = options.url?.replace(/\/$/, '');
    this.#serviceRoleKey = options.serviceRoleKey;
    this.#fetch = options.fetchImpl ?? fetch;

    if (!this.#url || !this.#serviceRoleKey) {
      this.configurationError =
        'SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são necessários para o cofre persistente.';
      return;
    }
    if (!options.encodedKey) {
      this.configurationError =
        'CREDENTIALS_ENCRYPTION_KEY é necessária para o cofre persistente.';
      return;
    }
    try {
      this.#key = decodeEncryptionKey(options.encodedKey);
    } catch {
      this.configurationError =
        'CREDENTIALS_ENCRYPTION_KEY inválida ou incompatível.';
    }
  }

  get enabled(): boolean {
    return Boolean(this.#url && this.#serviceRoleKey && this.#key);
  }

  async get(name: string): Promise<string | undefined> {
    CredentialNameSchema.parse(name);
    if (!this.enabled) return undefined;
    const row = await this.#readRow(name);
    if (!row) return undefined;
    try {
      return decryptVaultValue(this.#toEnvelope(row), this.#key!);
    } catch {
      throw new Error('Cofre persistente não pôde ser decifrado.');
    }
  }

  async listNames(): Promise<string[]> {
    this.#assertEnabled();
    const endpoint = this.#endpoint();
    endpoint.searchParams.set('select', 'name');
    endpoint.searchParams.set('order', 'name.asc');
    const response = await this.#fetch(endpoint, { headers: this.#headers() });
    this.#assertResponse(response);
    const rows = z
      .array(SupabaseCredentialNameRowSchema)
      .parse(await response.json());
    return rows.map((row) => row.name);
  }

  async set(name: string, value: string): Promise<void> {
    CredentialNameSchema.parse(name);
    if (!value || value.length > 8192)
      throw new Error('Valor de credencial inválido.');
    this.#assertEnabled();
    const envelope = encryptVaultValue(value, this.#key!);
    const response = await this.#fetch(this.#endpoint({ upsert: true }), {
      method: 'POST',
      headers: {
        ...this.#headers(),
        'content-type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        name,
        version: envelope.version,
        algorithm: envelope.algorithm,
        iv: envelope.iv,
        auth_tag: envelope.authTag,
        ciphertext: envelope.ciphertext,
        updated_at: new Date().toISOString(),
      }),
    });
    this.#assertResponse(response);
  }

  async remove(name: string): Promise<boolean> {
    CredentialNameSchema.parse(name);
    this.#assertEnabled();
    const endpoint = this.#endpoint();
    endpoint.searchParams.set('name', `eq.${name}`);
    const response = await this.#fetch(endpoint, {
      method: 'DELETE',
      headers: {
        ...this.#headers(),
        Prefer: 'return=representation',
      },
    });
    this.#assertResponse(response);
    const rows = z
      .array(SupabaseCredentialNameRowSchema)
      .parse(await response.json());
    return rows.length > 0;
  }

  async #readRow(
    name: string,
  ): Promise<z.infer<typeof SupabaseCredentialRowSchema> | undefined> {
    const endpoint = this.#endpoint();
    endpoint.searchParams.set(
      'select',
      'name,version,algorithm,iv,auth_tag,ciphertext',
    );
    endpoint.searchParams.set('name', `eq.${name}`);
    const response = await this.#fetch(endpoint, { headers: this.#headers() });
    this.#assertResponse(response);
    const rows = z
      .array(SupabaseCredentialRowSchema)
      .parse(await response.json());
    return rows[0];
  }

  #endpoint(options: { upsert?: boolean } = {}): URL {
    this.#assertConfigured();
    const endpoint = new URL(`${this.#url}/rest/v1/integration_credentials`);
    if (options.upsert) endpoint.searchParams.set('on_conflict', 'name');
    return endpoint;
  }

  #headers(): HeadersInit {
    this.#assertConfigured();
    return {
      apikey: this.#serviceRoleKey!,
      Authorization: `Bearer ${this.#serviceRoleKey!}`,
    };
  }

  #toEnvelope(row: z.infer<typeof SupabaseCredentialRowSchema>): VaultEnvelope {
    return {
      version: row.version,
      algorithm: row.algorithm,
      iv: row.iv,
      authTag: row.auth_tag,
      ciphertext: row.ciphertext,
    };
  }

  #assertConfigured(): void {
    if (!this.#url || !this.#serviceRoleKey)
      throw new CredentialStoreDisabledError();
  }

  #assertEnabled(): void {
    if (!this.enabled) throw new CredentialStoreDisabledError();
  }

  #assertResponse(response: Response): void {
    if (!response.ok) throw new Error('Cofre persistente indisponível.');
  }
}
