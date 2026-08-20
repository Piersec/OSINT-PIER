import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { EncryptedCredentialStore } from './encrypted-store.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function createStore() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'osint-pier-vault-'));
  temporaryDirectories.push(directory);
  const filePath = path.join(directory, 'credentials.enc');
  const store = new EncryptedCredentialStore({
    filePath,
    encodedKey: randomBytes(32).toString('base64'),
  });
  return { filePath, store };
}

describe('EncryptedCredentialStore', () => {
  it('persiste e recupera uma credencial sem gravar o segredo em texto puro', async () => {
    const { filePath, store } = await createStore();
    const secret = 'segredo-super-sensivel-123';

    await store.set('VIRUSTOTAL_API_KEY', secret);

    expect(await store.get('VIRUSTOTAL_API_KEY')).toBe(secret);
    expect(await store.listNames()).toEqual(['VIRUSTOTAL_API_KEY']);
    expect(await readFile(filePath, 'utf8')).not.toContain(secret);
  });

  it('remove somente o valor armazenado no cofre', async () => {
    const { store } = await createStore();
    await store.set('ABUSEIPDB_API_KEY', 'valor');

    expect(await store.remove('ABUSEIPDB_API_KEY')).toBe(true);
    expect(await store.get('ABUSEIPDB_API_KEY')).toBeUndefined();
    expect(await store.remove('ABUSEIPDB_API_KEY')).toBe(false);
  });

  it('fica desabilitado sem chave mestra', async () => {
    const store = new EncryptedCredentialStore({ filePath: 'unused' });
    expect(store.enabled).toBe(false);
    expect(await store.get('TEST_API_KEY')).toBeUndefined();
    await expect(store.set('TEST_API_KEY', 'valor')).rejects.toThrow(
      'não está configurado',
    );
  });
});
