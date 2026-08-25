import type { CheckResult } from '@osint-pier/contracts';
import type { TargetKind } from '@osint-pier/contracts';
import type { NormalizedTarget } from '../target/normalize-target.js';

export interface CheckContext {
  signal: AbortSignal;
  credentials: Readonly<Record<string, string>>;
  environment?: Readonly<Record<string, string | undefined>>;
}

export interface CheckPlugin {
  id: string;
  label: string;
  requiredEnv: readonly string[];
  optionalEnv?: readonly string[];
  supportedTargetKinds?: readonly TargetKind[];
  timeoutMs?: number;
  run(target: NormalizedTarget, context: CheckContext): Promise<CheckResult>;
}

export interface CredentialProvider {
  get(name: string): Promise<string | undefined>;
}
