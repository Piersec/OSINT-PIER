import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

const SettingsSchema = z.record(z.string(), z.boolean());

/**
 * Persists only explicit disabled flags. Missing entries are enabled by
 * default, so adding a new plugin never requires editing this file.
 */
export class CheckSettingsStore {
  readonly #filePath: string;
  #settings: Record<string, boolean> = {};
  #loaded = false;
  #writeQueue: Promise<void> = Promise.resolve();

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  async initialize(): Promise<void> {
    if (this.#loaded) return;

    try {
      const content = await readFile(this.#filePath, 'utf8');
      this.#settings = SettingsSchema.parse(JSON.parse(content));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      this.#settings = {};
    }

    this.#loaded = true;
  }

  async isEnabled(id: string): Promise<boolean> {
    await this.initialize();
    return this.#settings[id] ?? true;
  }

  async list(ids: Iterable<string>): Promise<Record<string, boolean>> {
    await this.initialize();
    return Object.fromEntries(
      [...ids].map((id) => [id, this.#settings[id] ?? true]),
    );
  }

  async setEnabled(id: string, enabled: boolean): Promise<void> {
    await this.initialize();
    if (enabled) delete this.#settings[id];
    else this.#settings[id] = false;

    const snapshot = JSON.stringify(this.#settings, null, 2) + '\n';
    this.#writeQueue = this.#writeQueue.then(async () => {
      await mkdir(path.dirname(this.#filePath), { recursive: true });
      const temporaryPath = `${this.#filePath}.${process.pid}.tmp`;
      await writeFile(temporaryPath, snapshot, {
        encoding: 'utf8',
        mode: 0o600,
      });
      await rename(temporaryPath, this.#filePath);
    });
    await this.#writeQueue;
  }
}
