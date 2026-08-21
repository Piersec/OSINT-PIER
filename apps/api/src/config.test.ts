import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  it('trata variáveis opcionais vazias como ausentes', () => {
    const config = loadConfig({
      ADMIN_TOKEN: '',
      CREDENTIALS_ENCRYPTION_KEY: '',
      SUPABASE_URL: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
      SUPABASE_HISTORY_LIMIT: '',
    });

    expect(config.adminToken).toBeUndefined();
    expect(config.encryptionKey).toBeUndefined();
    expect(config.supabaseUrl).toBeUndefined();
    expect(config.supabaseServiceRoleKey).toBeUndefined();
    expect(config.supabaseHistoryLimit).toBe(50);
  });
});
