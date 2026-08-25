import type { CheckContext } from '../checks/contract.js';
import type { NormalizedTarget } from '../target/normalize-target.js';

export type CommandTool = 'nmap' | 'katana' | 'gobuster' | 'subfinder';

type RunnerOutcome =
  | { status: 'success'; payload: Record<string, unknown> }
  | { status: 'skipped'; error: string }
  | { status: 'error'; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readServiceUrl(
  environment: Readonly<Record<string, string | undefined>> | undefined,
): URL | undefined {
  const value =
    environment?.COMMAND_TOOLS_API_URL ?? process.env.COMMAND_TOOLS_API_URL;
  if (!value?.trim()) return undefined;

  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    return url;
  } catch {
    return undefined;
  }
}

function endpoint(baseUrl: URL): URL {
  const base = new URL(baseUrl.toString());
  if (!base.pathname.endsWith('/')) base.pathname += '/';
  return new URL('api/v1/scan', base);
}

function runnerTarget(tool: CommandTool, target: NormalizedTarget): string {
  if (tool === 'nmap' || tool === 'subfinder') return target.hostname;
  return target.kind === 'url' ? target.value : `https://${target.hostname}/`;
}

function responseError(status: number): string {
  if (status === 400) return 'O runner rejeitou o alvo ou perfil informado.';
  if (status === 401 || status === 403)
    return 'O token interno do runner foi rejeitado ou a ferramenta está desabilitada.';
  if (status === 404) return 'A rota de command tools não está disponível no runner.';
  if (status === 429)
    return 'O runner está ocupado. Tente novamente em instantes.';
  if (status === 504) return 'A ferramenta excedeu o limite de execução.';
  if (status >= 500) return 'O runner de command tools está temporariamente indisponível.';
  return `O runner respondeu com HTTP ${status}.`;
}

export async function callCommandTool(
  tool: CommandTool,
  target: NormalizedTarget,
  context: CheckContext,
): Promise<RunnerOutcome> {
  const baseUrl = readServiceUrl(context.environment);
  if (!baseUrl) {
    return {
      status: 'skipped',
      error: 'COMMAND_TOOLS_API_URL não configurada no backend.',
    };
  }

  const token = context.credentials.COMMAND_TOOLS_API_TOKEN;
  if (!token) {
    return {
      status: 'skipped',
      error: 'Token interno do runner de command tools não configurado.',
    };
  }

  try {
    const response = await fetch(endpoint(baseUrl), {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        tool,
        target: runnerTarget(tool, target),
        profile: 'safe',
      }),
      signal: context.signal,
    });
    const payload: unknown = await response.json().catch(() => ({}));

    if (!response.ok) return { status: 'error', error: responseError(response.status) };
    if (!isRecord(payload) || payload.tool !== tool) {
      return {
        status: 'error',
        error: 'O runner devolveu uma resposta inválida para esta ferramenta.',
      };
    }
    return { status: 'success', payload };
  } catch {
    return {
      status: 'error',
      error: 'Não foi possível consultar o runner de command tools.',
    };
  }
}

export function stringValue(value: unknown, maxLength = 512): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

export function numberValue(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.trunc(value);
}

export function listValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function recordValue(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}
