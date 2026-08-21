import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CredentialNameSchema } from '@osint-pier/contracts';

interface VaultEnvelope {
  version: 1;
  algorithm: 'aes-256-gcm';
  iv: string;
  authTag: string;
  ciphertext: string;
}

type VaultValues = Record<string, string>;

export class CredentialStoreDisabledError extends Error {
  constructor() {
    super('O cofre de credenciais não está configurado.');
  }
}

function decodeKey(encodedKey: string): Buffer {
  const key = Buffer.from(encodedKey, 'base64');
  if (key.length !== 32) {
    throw new Error(
      'CREDENTIALS_ENCRYPTION_KEY deve conter exatamente 32 bytes em base64.',
    );
  }
  return key;
}

export class EncryptedCredentialStore {
  readonly #filePath: string;
  readonly #key?: Buffer;
  readonly configurationError?: string;
  #writeQueue: Promise<void> = Promise.resolve();

  constructor(options: { filePath: string; encodedKey?: string }) {
    this.#filePath = options.filePath;
    if (!options.encodedKey) return;
    try {
      this.#key = decodeKey(options.encodedKey);
    } catch {
      // A malformed deployment secret must not prevent public health,
      // catalog, or history routes from starting. Admin operations remain
      // unavailable until the key is corrected, and no secret is echoed.
      this.configurationError =
        'CREDENTIALS_ENCRYPTION_KEY inválida ou incompatível.';
    }
  }

  get enabled(): boolean {
    return Boolean(this.#key);
  }

  async get(name: string): Promise<string | undefined> {
    CredentialNameSchema.parse(name);
    if (!this.#key) return undefined;
    const values = await this.#readValues();
    return values[name];
  }

  async listNames(): Promise<string[]> {
    if (!this.#key) return [];
    return Object.keys(await this.#readValues()).sort();
  }

  async set(name: string, value: string): Promise<void> {
    CredentialNameSchema.parse(name);
    if (!value || value.length > 8192)
      throw new Error('Valor de credencial inválido.');
    return this.#enqueueWrite(async () => {
      const values = await this.#readValues();
      values[name] = value;
      await this.#writeValues(values);
    });
  }

  async remove(name: string): Promise<boolean> {
    CredentialNameSchema.parse(name);
    let removed = false;
    await this.#enqueueWrite(async () => {
      const values = await this.#readValues();
      if (Object.hasOwn(values, name)) {
        delete values[name];
        removed = true;
        await this.#writeValues(values);
      }
    });
    return removed;
  }

  #enqueueWrite(operation: () => Promise<void>): Promise<void> {
    const next = this.#writeQueue.catch(() => undefined).then(operation);
    this.#writeQueue = next;
    return next;
  }

  async #readValues(): Promise<VaultValues> {
    if (!this.#key) throw new CredentialStoreDisabledError();

    let serialized: string;
    try {
      serialized = await readFile(this.#filePath, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
      throw error;
    }

    const envelope = JSON.parse(serialized) as VaultEnvelope;
    if (envelope.version !== 1 || envelope.algorithm !== 'aes-256-gcm') {
      throw new Error('Formato de cofre não suportado.');
    }

    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.#key,
      Buffer.from(envelope.iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(envelope.authTag, 'base64'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
      decipher.final(),
    ]);
    const values = JSON.parse(plaintext.toString('utf8')) as VaultValues;
    return values;
  }

  async #writeValues(values: VaultValues): Promise<void> {
    if (!this.#key) throw new CredentialStoreDisabledError();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.#key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(values), 'utf8'),
      cipher.final(),
    ]);
    const envelope: VaultEnvelope = {
      version: 1,
      algorithm: 'aes-256-gcm',
      iv: iv.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
      ciphertext: ciphertext.toString('base64'),
    };

    await mkdir(path.dirname(this.#filePath), { recursive: true });
    const temporaryPath = `${this.#filePath}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(envelope), {
      encoding: 'utf8',
      mode: 0o600,
    });
    await rename(temporaryPath, this.#filePath);
  }
}
