import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { loadCheckRegistry } from './registry.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function createPlugin(root: string, directory: string, id: string) {
  const pluginDirectory = path.join(root, directory);
  await mkdir(pluginDirectory, { recursive: true });
  await writeFile(
    path.join(pluginDirectory, 'index.mjs'),
    `export default {
      id: '${id}',
      label: '${directory}',
      requiredEnv: [],
      async run() {
        return { id: '${id}', status: 'success', data: {}, source: 'test', durationMs: 0 };
      }
    };`,
    'utf8',
  );
}

describe('loadCheckRegistry', () => {
  it('mantém o contrato consistente para todos os plugins do projeto', async () => {
    const checksDirectory = fileURLToPath(
      new URL('../../checks', import.meta.url),
    );
    const registry = await loadCheckRegistry(checksDirectory);

    expect(registry.all()).toHaveLength(19);
    for (const check of registry.all()) {
      expect(check.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(check.label.length).toBeGreaterThan(0);
      expect(
        check.requiredEnv.every((name) => /^[A-Z][A-Z0-9_]*$/.test(name)),
      ).toBe(true);
      expect(typeof check.run).toBe('function');
    }
  });

  it('descobre plugins por diretório sem lista manual', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'osint-pier-checks-'));
    temporaryDirectories.push(root);
    await createPlugin(root, 'dns-records', 'dns-records');
    await createPlugin(root, 'server-status', 'server-status');

    const registry = await loadCheckRegistry(root);

    expect(
      registry
        .all()
        .map((check) => check.id)
        .sort(),
    ).toEqual(['dns-records', 'server-status']);
  });

  it('rejeita IDs duplicados', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'osint-pier-checks-'));
    temporaryDirectories.push(root);
    await createPlugin(root, 'one', 'duplicated');
    await createPlugin(root, 'two', 'duplicated');

    await expect(loadCheckRegistry(root)).rejects.toThrow(
      'ID de plugin duplicado',
    );
  });
});
