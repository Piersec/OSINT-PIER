import { randomBytes } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { SupabaseCredentialStore } from './supabase-credential-store.js';

const encodedKey = randomBytes(32).toString('base64');

describe('SupabaseCredentialStore', () => {
  it('permanece desabilitado quando a configuração persistente está incompleta', async () => {
    const store = new SupabaseCredentialStore({
      url: 'https://project.supabase.co',
      serviceRoleKey: 'server-only-key',
    });

    expect(store.enabled).toBe(false);
    expect(await store.get('TEST_API_KEY')).toBeUndefined();
  });

  it('cifra antes de persistir e consegue ler/remover a credencial', async () => {
    let saved: Record<string, unknown> | undefined;
    const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
      if (init?.method === 'POST') {
        saved = JSON.parse(String(init.body)) as Record<string, unknown>;
        return new Response(null, { status: 201 });
      }
      if (init?.method === 'DELETE') {
        return new Response(
          JSON.stringify(saved ? [{ name: saved.name }] : []),
          {
            status: 200,
          },
        );
      }
      if (saved) {
        return new Response(
          JSON.stringify([
            {
              name: saved.name,
              version: saved.version,
              algorithm: saved.algorithm,
              iv: saved.iv,
              auth_tag: saved.auth_tag,
              ciphertext: saved.ciphertext,
            },
          ]),
          { status: 200 },
        );
      }
      return new Response('[]', { status: 200 });
    });
    const store = new SupabaseCredentialStore({
      url: 'https://project.supabase.co',
      serviceRoleKey: 'server-only-key',
      encodedKey,
      fetchImpl,
    });

    await store.set('TEST_API_KEY', 'secret-value');
    expect(saved?.name).toBe('TEST_API_KEY');
    expect(saved?.ciphertext).not.toBe('secret-value');
    expect(saved).not.toHaveProperty('value');
    await expect(store.get('TEST_API_KEY')).resolves.toBe('secret-value');
    await expect(store.remove('TEST_API_KEY')).resolves.toBe(true);

    const postHeaders = fetchImpl.mock.calls.find(
      ([, init]) => init?.method === 'POST',
    )?.[1]?.headers as Record<string, string>;
    expect(postHeaders.apikey).toBe('server-only-key');
    expect(postHeaders.Authorization).toBe('Bearer server-only-key');
  });

  it('não envia chave secreta moderna como Bearer JWT', async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response(null, { status: 201 }),
    );
    const store = new SupabaseCredentialStore({
      url: 'https://project.supabase.co',
      serviceRoleKey: 'sb_secret_backend-key',
      encodedKey,
      fetchImpl,
    });

    await store.set('TEST_API_KEY', 'secret-value');

    const headers = fetchImpl.mock.calls[0]?.[1]?.headers as Record<
      string,
      string
    >;
    expect(headers.apikey).toBe('sb_secret_backend-key');
    expect(headers.Authorization).toBeUndefined();
  });

  it('não habilita o cofre com chave mestra inválida', () => {
    const store = new SupabaseCredentialStore({
      url: 'https://project.supabase.co',
      serviceRoleKey: 'server-only-key',
      encodedKey: 'invalid',
    });

    expect(store.enabled).toBe(false);
    expect(store.configurationError).toContain('CREDENTIALS_ENCRYPTION_KEY');
  });
});
