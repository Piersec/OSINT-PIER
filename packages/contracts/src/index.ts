import { z } from 'zod';

export const TargetKindSchema = z.enum([
  'domain',
  'ip',
  'url',
  'name',
  'username',
  'email',
  'phone',
]);
export type TargetKind = z.infer<typeof TargetKindSchema>;

export const CheckStatusSchema = z.enum(['success', 'error', 'skipped']);
export type CheckStatus = z.infer<typeof CheckStatusSchema>;

export const CheckResultSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    status: CheckStatusSchema,
    data: z.unknown().optional(),
    error: z.string().min(1).optional(),
    source: z.string().min(1),
    durationMs: z.number().nonnegative(),
  })
  .superRefine((result, context) => {
    if (result.status === 'error' && !result.error) {
      context.addIssue({
        code: 'custom',
        message: 'Resultados com status error precisam de uma mensagem.',
        path: ['error'],
      });
    }
  });
export type CheckResult = z.infer<typeof CheckResultSchema>;

export const CheckCatalogItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  configured: z.boolean(),
  enabled: z.boolean(),
  requiredCredentials: z.array(z.string()),
  supportedTargetKinds: z.array(TargetKindSchema).min(1),
});
export type CheckCatalogItem = z.infer<typeof CheckCatalogItemSchema>;

export const CheckEnabledWriteSchema = z.object({
  enabled: z.boolean(),
});

export const AnalyzeRequestSchema = z.object({
  target: z.string().trim().min(1).max(2048),
  targetKind: TargetKindSchema.optional(),
});
export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;

export const AnalysisHistoryEntrySchema = z.object({
  id: z.string().uuid(),
  target: z.string().min(1).max(2048),
  targetKind: TargetKindSchema,
  total: z.number().int().min(0).max(100),
  success: z.number().int().min(0).max(100),
  attention: z.number().int().min(0).max(100),
  completedAt: z.string().datetime({ offset: true }),
});
export type AnalysisHistoryEntry = z.infer<typeof AnalysisHistoryEntrySchema>;

export const AnalysisHistoryWriteSchema = z.object({
  target: z.string().trim().min(1).max(2048),
  targetKind: TargetKindSchema,
  total: z.number().int().min(0).max(100),
  success: z.number().int().min(0).max(100),
  attention: z.number().int().min(0).max(100),
});

export const AnalysisHistoryResponseSchema = z.object({
  enabled: z.boolean(),
  entries: z.array(AnalysisHistoryEntrySchema),
});

export const AnalysisHistorySaveResponseSchema = z.object({
  enabled: z.boolean(),
  persisted: z.boolean(),
  entry: AnalysisHistoryEntrySchema.nullable().optional(),
});

export const CredentialNameSchema = z
  .string()
  .trim()
  .regex(/^[A-Z][A-Z0-9_]{2,63}$/, {
    message: 'Use um identificador como VIRUSTOTAL_API_KEY.',
  });

export const CredentialWriteSchema = z.object({
  value: z.string().min(1).max(8192),
});

export const CredentialStatusSchema = z.object({
  name: CredentialNameSchema,
  configured: z.boolean(),
  source: z.enum(['vault', 'environment']).nullable(),
});
export type CredentialStatus = z.infer<typeof CredentialStatusSchema>;
