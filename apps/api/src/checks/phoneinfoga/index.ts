import type { CheckPlugin } from '../../core/checks/contract.js';
import { failure, success } from '../../core/checks/results.js';

const id = 'phoneinfoga';
const source = 'PhoneInfoga REST API';

interface PhoneNumber {
  carrier?: string | null;
  country?: string | null;
  countryCode?: number | null;
  e164?: string | null;
  international?: string | null;
  local?: string | null;
  rawLocal?: string | null;
  valid?: boolean | null;
}

interface ScannerResponse {
  error?: string;
  message?: string;
  result?: unknown;
  success?: boolean;
}

interface ScannerOutcome {
  status: 'success' | 'error' | 'skipped';
  data?: unknown;
  error?: string;
}

function skipped(error: string): ScannerOutcome {
  return { status: 'skipped', error };
}

function scannerError(status: number): string {
  if (status === 400) return 'O PhoneInfoga rejeitou o número informado.';
  if (status === 404)
    return 'Este scanner não está disponível no serviço PhoneInfoga.';
  if (status === 429)
    return 'O limite de uso do serviço PhoneInfoga foi atingido.';
  if (status >= 500)
    return 'O serviço PhoneInfoga está temporariamente indisponível.';
  return `O PhoneInfoga respondeu com HTTP ${status}.`;
}

function readServiceUrl(
  environment: Readonly<Record<string, string | undefined>> | undefined,
): URL | undefined {
  const value =
    environment?.PHONEINFOGA_API_URL ?? process.env.PHONEINFOGA_API_URL;
  if (!value?.trim()) return undefined;

  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    return url;
  } catch {
    return undefined;
  }
}

function endpoint(baseUrl: URL, path: string): URL {
  const base = new URL(baseUrl.toString());
  if (!base.pathname.endsWith('/')) base.pathname += '/';
  return new URL(path.replace(/^\//, ''), base);
}

function requestHeaders(token: string): HeadersInit {
  return {
    accept: 'application/json',
    'content-type': 'application/json',
    authorization: `Bearer ${token}`,
  };
}

async function postJson(
  url: URL,
  body: unknown,
  token: string,
  signal: AbortSignal,
): Promise<{ response: Response; payload: ScannerResponse | PhoneNumber }> {
  const response = await fetch(url, {
    method: 'POST',
    headers: requestHeaders(token),
    body: JSON.stringify(body),
    signal,
  });
  const payload = (await response.json().catch(() => ({}))) as
    ScannerResponse | PhoneNumber;
  return { response, payload };
}

function compactPhoneNumber(payload: PhoneNumber, input: string) {
  return {
    input,
    valid: payload.valid ?? null,
    e164: payload.e164 ?? null,
    international: payload.international ?? null,
    local: payload.local ?? null,
    rawLocal: payload.rawLocal ?? null,
    country: payload.country ?? null,
    countryCode: payload.countryCode ?? null,
    carrier: payload.carrier ?? null,
  };
}

function compactDorks(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const dork =
      'dork' in item && typeof item.dork === 'string' ? item.dork : null;
    const url = 'url' in item && typeof item.url === 'string' ? item.url : null;
    if (!dork && !url) return [];
    return [{ dork, url }];
  });
}

function compactScannerResult(name: string, result: unknown): unknown {
  if (!result || typeof result !== 'object') return null;

  if (name === 'local') {
    const payload = result as PhoneNumber;
    return compactPhoneNumber(payload, payload.e164 ?? '');
  }

  if (name === 'numverify') {
    const payload = result as Record<string, unknown>;
    return {
      valid: typeof payload.valid === 'boolean' ? payload.valid : null,
      number: typeof payload.number === 'string' ? payload.number : null,
      localFormat:
        typeof payload.local_format === 'string' ? payload.local_format : null,
      internationalFormat:
        typeof payload.international_format === 'string'
          ? payload.international_format
          : null,
      countryCode:
        typeof payload.country_code === 'string' ? payload.country_code : null,
      countryName:
        typeof payload.country_name === 'string' ? payload.country_name : null,
      countryPrefix:
        typeof payload.country_prefix === 'string'
          ? payload.country_prefix
          : null,
      location: typeof payload.location === 'string' ? payload.location : null,
      carrier: typeof payload.carrier === 'string' ? payload.carrier : null,
      lineType:
        typeof payload.line_type === 'string' ? payload.line_type : null,
    };
  }

  if (name === 'ovh') {
    const payload = result as Record<string, unknown>;
    return {
      found: typeof payload.found === 'boolean' ? payload.found : null,
      numberRange:
        typeof payload.number_range === 'string' ? payload.number_range : null,
      city: typeof payload.city === 'string' ? payload.city : null,
      zipCode: typeof payload.zip_code === 'string' ? payload.zip_code : null,
    };
  }

  if (name === 'googlesearch') {
    const payload = result as Record<string, unknown>;
    return {
      general: compactDorks(payload.general),
      individuals: compactDorks(payload.individuals),
      reputation: compactDorks(payload.reputation),
      socialMedia: compactDorks(payload.social_media),
      disposableProviders: compactDorks(payload.disposable_providers),
    };
  }

  if (name === 'googlecse') {
    const payload = result as Record<string, unknown>;
    const items = Array.isArray(payload.items)
      ? payload.items.slice(0, 20).flatMap((item) => {
          if (!item || typeof item !== 'object') return [];
          const value = item as Record<string, unknown>;
          return [
            {
              title: typeof value.title === 'string' ? value.title : null,
              url: typeof value.link === 'string' ? value.link : null,
              snippet: typeof value.snippet === 'string' ? value.snippet : null,
            },
          ];
        })
      : [];
    return {
      homepage: typeof payload.homepage === 'string' ? payload.homepage : null,
      resultCount:
        typeof payload.result_count === 'number' ? payload.result_count : null,
      items,
    };
  }

  return null;
}

async function runScanner(
  name: string,
  number: string,
  options: Record<string, string>,
  baseUrl: URL,
  token: string,
  signal: AbortSignal,
): Promise<ScannerOutcome> {
  try {
    const { response, payload } = await postJson(
      endpoint(baseUrl, `/api/v2/scanners/${encodeURIComponent(name)}/run`),
      { number, options },
      token,
      signal,
    );
    if (!response.ok) {
      return { status: 'error', error: scannerError(response.status) };
    }

    const result = (payload as ScannerResponse).result;
    return {
      status: 'success',
      data: compactScannerResult(name, result),
    };
  } catch {
    return {
      status: 'error',
      error: 'Não foi possível consultar este scanner do PhoneInfoga.',
    };
  }
}

const check: CheckPlugin = {
  id,
  label: 'PhoneInfoga',
  requiredEnv: ['PHONEINFOGA_API_TOKEN'],
  optionalEnv: ['NUMVERIFY_API_KEY', 'GOOGLECSE_CX', 'GOOGLE_API_KEY'],
  supportedTargetKinds: ['phone'],
  timeoutMs: 30_000,
  async run(target, context) {
    const token = context.credentials.PHONEINFOGA_API_TOKEN;
    const baseUrl = readServiceUrl(context.environment);
    if (!baseUrl) {
      return {
        id,
        status: 'skipped',
        error: 'PHONEINFOGA_API_URL não configurada no backend.',
        source: 'configuration',
        durationMs: 0,
      };
    }
    if (!token) {
      return failure(
        id,
        source,
        'Token interno do PhoneInfoga não configurado.',
      );
    }

    try {
      const { response, payload } = await postJson(
        endpoint(baseUrl, '/api/v2/numbers'),
        { number: target.value },
        token,
        context.signal,
      );
      if (!response.ok)
        return failure(id, source, scannerError(response.status));

      const normalized = payload as PhoneNumber;
      if (normalized.valid === false) {
        return failure(
          id,
          source,
          'O PhoneInfoga não reconheceu um número válido.',
        );
      }

      const number = normalized.e164 ?? target.value;
      const optionalCredentials = context.credentials;
      const scannerOptions: Record<string, Record<string, string>> = {
        local: {},
        googlesearch: {},
        ovh: {},
      };
      const skippedScanners: Record<string, string> = {};

      if (optionalCredentials.NUMVERIFY_API_KEY) {
        scannerOptions.numverify = {
          NUMVERIFY_API_KEY: optionalCredentials.NUMVERIFY_API_KEY,
        };
      } else {
        skippedScanners.numverify =
          'NUMVERIFY_API_KEY não configurada no cofre de integrações.';
      }

      if (
        optionalCredentials.GOOGLECSE_CX &&
        optionalCredentials.GOOGLE_API_KEY
      ) {
        scannerOptions.googlecse = {
          GOOGLECSE_CX: optionalCredentials.GOOGLECSE_CX,
          GOOGLE_API_KEY: optionalCredentials.GOOGLE_API_KEY,
        };
      } else {
        skippedScanners.googlecse =
          'GOOGLECSE_CX e GOOGLE_API_KEY precisam estar configuradas no cofre.';
      }

      const scannerEntries = await Promise.all(
        Object.entries(scannerOptions).map(
          async ([name, options]) =>
            [
              name,
              await runScanner(
                name,
                number,
                options,
                baseUrl,
                token,
                context.signal,
              ),
            ] as const,
        ),
      );

      const scanners = Object.fromEntries(scannerEntries);
      for (const [name, error] of Object.entries(skippedScanners)) {
        scanners[name] = skipped(error);
      }

      return success(id, source, {
        number: compactPhoneNumber(normalized, target.value),
        scanners,
        note: 'Scanners executados pelo serviço PhoneInfoga autorizado; resultados curados pelo backend.',
      });
    } catch {
      return failure(
        id,
        source,
        'Não foi possível consultar o serviço PhoneInfoga.',
      );
    }
  },
};

export default check;
