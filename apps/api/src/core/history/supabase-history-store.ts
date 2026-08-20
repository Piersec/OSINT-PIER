import {
  AnalysisHistoryEntrySchema,
  TargetKindSchema,
  type AnalysisHistoryEntry,
  type TargetKind,
} from '@osint-pier/contracts';
import { z } from 'zod';

const SupabaseRowSchema = z.object({
  id: z.string().uuid(),
  target: z.string(),
  target_kind: TargetKindSchema,
  total_count: z.number().int(),
  success_count: z.number().int(),
  attention_count: z.number().int(),
  completed_at: z.string(),
});

export interface HistoryWrite {
  target: string;
  targetKind: TargetKind;
  total: number;
  success: number;
  attention: number;
}

export class SupabaseHistoryStore {
  readonly #url?: string;
  readonly #serviceRoleKey?: string;
  readonly #defaultLimit: number;
  readonly #fetch: typeof fetch;

  constructor(options: {
    url?: string;
    serviceRoleKey?: string;
    defaultLimit: number;
    fetchImpl?: typeof fetch;
  }) {
    this.#url = options.url?.replace(/\/$/, '');
    this.#serviceRoleKey = options.serviceRoleKey;
    this.#defaultLimit = options.defaultLimit;
    this.#fetch = options.fetchImpl ?? fetch;
  }

  get enabled(): boolean {
    return Boolean(this.#url && this.#serviceRoleKey);
  }

  async list(limit = this.#defaultLimit): Promise<AnalysisHistoryEntry[]> {
    if (!this.enabled) return [];
    const endpoint = this.endpoint();
    endpoint.searchParams.set(
      'select',
      'id,target,target_kind,total_count,success_count,attention_count,completed_at',
    );
    endpoint.searchParams.set('order', 'completed_at.desc');
    endpoint.searchParams.set('limit', String(limit));

    const response = await this.#fetch(endpoint, { headers: this.headers() });
    if (!response.ok) throw new Error('Histórico persistente indisponível.');
    const rows = z.array(SupabaseRowSchema).parse(await response.json());
    return rows.map((row) => this.toEntry(row));
  }

  async append(input: HistoryWrite): Promise<AnalysisHistoryEntry | null> {
    if (!this.enabled) return null;
    const response = await this.#fetch(this.endpoint(), {
      method: 'POST',
      headers: {
        ...this.headers(),
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        target: input.target,
        target_kind: input.targetKind,
        total_count: input.total,
        success_count: input.success,
        attention_count: input.attention,
      }),
    });
    if (!response.ok) throw new Error('Não foi possível salvar o histórico.');
    const rows = z.array(SupabaseRowSchema).parse(await response.json());
    return rows[0] ? this.toEntry(rows[0]) : null;
  }

  private endpoint(): URL {
    return new URL(`${this.#url}/rest/v1/analysis_history`);
  }

  private headers(): HeadersInit {
    return {
      apikey: this.#serviceRoleKey!,
      Authorization: `Bearer ${this.#serviceRoleKey!}`,
    };
  }

  private toEntry(
    row: z.infer<typeof SupabaseRowSchema>,
  ): AnalysisHistoryEntry {
    return AnalysisHistoryEntrySchema.parse({
      id: row.id,
      target: row.target,
      targetKind: row.target_kind,
      total: row.total_count,
      success: row.success_count,
      attention: row.attention_count,
      completedAt: new Date(row.completed_at).toISOString(),
    });
  }
}
