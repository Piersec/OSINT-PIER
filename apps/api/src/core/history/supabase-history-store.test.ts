import { describe, expect, it, vi } from 'vitest';
import { SupabaseHistoryStore } from './supabase-history-store.js';

const row = {
  id: '1f8b7a0e-cc93-4e53-a37f-0bf9ea6a3be2',
  target: 'example.com',
  target_kind: 'domain',
  total_count: 13,
  success_count: 11,
  attention_count: 2,
  completed_at: '2026-08-20T12:00:00.000Z',
};

describe('SupabaseHistoryStore', () => {
  it('permanece desabilitado sem URL e service role key', async () => {
    const store = new SupabaseHistoryStore({ defaultLimit: 50 });

    expect(store.enabled).toBe(false);
    expect(await store.list()).toEqual([]);
    expect(
      await store.append({
        target: 'example.com',
        targetKind: 'domain',
        total: 1,
        success: 1,
        attention: 0,
      }),
    ).toBeNull();
  });

  it('lista e converte as colunas do Supabase para o contrato público', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify([row]), { status: 200 }));
    const store = new SupabaseHistoryStore({
      url: 'https://project.supabase.co',
      serviceRoleKey: 'server-only-key',
      defaultLimit: 50,
      fetchImpl,
    });

    await expect(store.list(7)).resolves.toEqual([
      {
        id: row.id,
        target: row.target,
        targetKind: 'domain',
        total: 13,
        success: 11,
        attention: 2,
        completedAt: row.completed_at,
      },
    ]);
    const [request] = fetchImpl.mock.calls[0] ?? [];
    expect(String(request)).toContain('analysis_history');
    expect(String(request)).toContain('limit=7');
    expect(
      (fetchImpl.mock.calls[0]?.[1]?.headers as Record<string, string>)
        .Authorization,
    ).toBe('Bearer server-only-key');
  });

  it('persiste somente o resumo agregado e retorna a entrada criada', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify([row]), { status: 201 }));
    const store = new SupabaseHistoryStore({
      url: 'https://project.supabase.co',
      serviceRoleKey: 'server-only-key',
      defaultLimit: 50,
      fetchImpl,
    });

    await expect(
      store.append({
        target: 'example.com',
        targetKind: 'domain',
        total: 13,
        success: 11,
        attention: 2,
      }),
    ).resolves.toMatchObject({ target: 'example.com', success: 11 });

    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body));
    expect(body).toEqual({
      target: 'example.com',
      target_kind: 'domain',
      total_count: 13,
      success_count: 11,
      attention_count: 2,
    });
  });
});
