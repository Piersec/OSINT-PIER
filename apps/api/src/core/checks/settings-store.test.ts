import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CheckSettingsStore } from './settings-store.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('CheckSettingsStore', () => {
  it('habilita plugins novos por padrão e persiste somente desabilitações', async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), 'osint-pier-settings-'),
    );
    temporaryDirectories.push(directory);
    const filePath = path.join(directory, 'check-settings.json');
    const store = new CheckSettingsStore(filePath);

    expect(await store.list(['dns-records', 'virus-total'])).toEqual({
      'dns-records': true,
      'virus-total': true,
    });
    await store.setEnabled('virus-total', false);

    expect(await store.isEnabled('virus-total')).toBe(false);
    expect(JSON.parse(await readFile(filePath, 'utf8'))).toEqual({
      'virus-total': false,
    });

    const reloaded = new CheckSettingsStore(filePath);
    expect(await reloaded.list(['dns-records', 'virus-total'])).toEqual({
      'dns-records': true,
      'virus-total': false,
    });
    await reloaded.setEnabled('virus-total', true);
    expect(JSON.parse(await readFile(filePath, 'utf8'))).toEqual({});
  });
});
