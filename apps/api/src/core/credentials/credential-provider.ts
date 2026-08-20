import type { CredentialProvider } from '../checks/contract.js';
import type { EncryptedCredentialStore } from './encrypted-store.js';

export class AppCredentialProvider implements CredentialProvider {
  constructor(
    readonly vault: EncryptedCredentialStore,
    readonly environment: NodeJS.ProcessEnv = process.env,
  ) {}

  async get(name: string): Promise<string | undefined> {
    const stored = await this.vault.get(name);
    return stored || this.environment[name] || undefined;
  }

  async source(name: string): Promise<'vault' | 'environment' | null> {
    if (await this.vault.get(name)) return 'vault';
    return this.environment[name] ? 'environment' : null;
  }
}
