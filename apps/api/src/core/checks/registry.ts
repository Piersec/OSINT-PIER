import { readdir, access } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { TargetKindSchema, type TargetKind } from '@osint-pier/contracts';
import type { CheckPlugin } from './contract.js';

const DEFAULT_TARGET_KINDS: readonly TargetKind[] = ['domain', 'ip', 'url'];

const PluginMetadataSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  label: z.string().trim().min(1),
  requiredEnv: z.array(z.string().regex(/^[A-Z][A-Z0-9_]*$/)),
  supportedTargetKinds: z.array(TargetKindSchema).min(1).optional(),
  timeoutMs: z.number().int().min(100).max(120_000).optional(),
  run: z.function(),
});

export class CheckRegistry {
  readonly #checks = new Map<string, CheckPlugin>();

  constructor(checks: Iterable<CheckPlugin> = []) {
    for (const check of checks) this.register(check);
  }

  register(candidate: CheckPlugin): void {
    const check = PluginMetadataSchema.parse(candidate) as CheckPlugin;
    if (this.#checks.has(check.id)) {
      throw new Error(`ID de plugin duplicado: ${check.id}`);
    }
    this.#checks.set(check.id, {
      ...check,
      supportedTargetKinds: check.supportedTargetKinds ?? DEFAULT_TARGET_KINDS,
    });
  }

  get(id: string): CheckPlugin | undefined {
    return this.#checks.get(id);
  }

  all(): CheckPlugin[] {
    return [...this.#checks.values()].sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  }
}

async function firstExisting(paths: string[]): Promise<string | undefined> {
  for (const candidate of paths) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Tenta a próxima extensão suportada.
    }
  }
  return undefined;
}

export async function loadCheckRegistry(
  checksDirectory: string,
): Promise<CheckRegistry> {
  let entries;
  try {
    entries = await readdir(checksDirectory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return new CheckRegistry();
    throw error;
  }

  const registry = new CheckRegistry();
  const directories = entries
    .filter(
      (entry) =>
        entry.isDirectory() &&
        !entry.name.startsWith('_') &&
        !entry.name.startsWith('.'),
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const directory of directories) {
    const base = path.join(checksDirectory, directory.name, 'index');
    const modulePath = await firstExisting([
      `${base}.js`,
      `${base}.mjs`,
      `${base}.ts`,
    ]);
    if (!modulePath) {
      throw new Error(`Plugin ${directory.name} não possui index.ts/index.js.`);
    }

    const module = (await import(pathToFileURL(modulePath).href)) as {
      default?: CheckPlugin;
      check?: CheckPlugin;
    };
    const plugin = module.default ?? module.check;
    if (!plugin)
      throw new Error(`Plugin ${directory.name} não exporta default ou check.`);
    registry.register(plugin);
  }

  return registry;
}
