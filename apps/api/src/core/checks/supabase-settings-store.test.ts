import { describe, expect, it, vi } from 'vitest';
import { SupabaseCheckSettingsStore } from './supabase-settings-store.js';

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('SupabaseCheckSettingsStore', () => {
  it('mantém plugins novos habilitados e lê somente flags persistidas', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      response([{ check_id: 'sherlock', enabled: false }]),
    );
    const store = new SupabaseCheckSettingsStore({
      url: 'https://project.supabase.co',
      serviceRoleKey: 'service-role-key',
      fetchImpl: fetchMock,
    });

    await expect(store.list(['sherlock', 'dns-records'])).resolves.toEqual({
      sherlock: false,
      'dns-records': true,
    });
  });

  it('persiste desabilitação e remove a flag ao habilitar novamente', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const store = new SupabaseCheckSettingsStore({
      url: 'https://project.supabase.co',
      serviceRoleKey: 'sb_secret_never-exposed',
      fetchImpl: fetchMock,
    });

    await store.setEnabled('sherlock', false);
    await store.setEnabled('sherlock', true);

    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'POST' });
    expect(fetchMock.mock.calls[0]?.[1]?.body).toContain('"enabled":false');
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'DELETE' });
    expect(
      new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get('authorization'),
    ).toBeNull();
  });

  it('não vaza detalhes da credencial quando o Supabase falha', async () => {
    const store = new SupabaseCheckSettingsStore({
      url: 'https://project.supabase.co',
      serviceRoleKey: 'secret-service-role-key',
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(
        new Response('secret-service-role-key', { status: 500 }),
      ),
    });

    await expect(store.setEnabled('sherlock', false)).rejects.toThrow(
      'Configuração persistente de plugins indisponível.',
    );
  });
});
