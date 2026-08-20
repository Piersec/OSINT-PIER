import type { CheckPlugin } from '../../core/checks/contract.js';
import { failure, success } from '../../core/checks/results.js';

const id = 'hunter-io';
const source = 'Hunter API v2';

interface HunterEmail {
  value?: string;
  type?: string;
  confidence?: number;
  first_name?: string | null;
  last_name?: string | null;
  position?: string | null;
  department?: string | null;
  seniority?: string | null;
  linkedin?: string | null;
  twitter?: string | null;
  sources?: unknown[];
}

interface HunterResponse {
  data?: {
    domain?: string | null;
    organization?: string | null;
    pattern?: string | null;
    disposable?: boolean | null;
    webmail?: boolean | null;
    accept_all?: boolean | null;
    emails?: HunterEmail[];
    email?: string | null;
    score?: number | null;
    status?: string | null;
    result?: string | null;
    regexp?: boolean | null;
    gibberish?: boolean | null;
    mx_records?: boolean | null;
    smtp_server?: string | null;
    smtp_check?: boolean | null;
    block?: boolean | null;
  };
  meta?: {
    results?: number;
    limit?: number;
    offset?: number;
    aggregations?: unknown;
  };
}

function apiFailure(status: number): string {
  if (status === 401)
    return 'A chave do Hunter é inválida ou não foi aceita pela API.';
  if (status === 403)
    return 'O Hunter bloqueou a requisição por limite ou permissão da conta.';
  if (status === 404)
    return 'O recurso solicitado não foi encontrado no Hunter.';
  if (status === 429)
    return 'O limite de uso do Hunter foi atingido. Aguarde antes de tentar novamente.';
  if (status === 451)
    return 'O Hunter não pode processar este dado por restrições legais.';
  if (status >= 500) return 'O Hunter está temporariamente indisponível.';
  return `O Hunter respondeu com HTTP ${status}.`;
}

function endpoint(
  path: string,
  apiKey: string,
  params: Record<string, string>,
) {
  const url = new URL(`https://api.hunter.io/v2/${path}`);
  for (const [name, value] of Object.entries({ ...params, api_key: apiKey })) {
    url.searchParams.set(name, value);
  }
  return url;
}

function compactEmail(email: HunterEmail) {
  return {
    value: email.value ?? null,
    type: email.type ?? null,
    confidence: email.confidence ?? null,
    firstName: email.first_name ?? null,
    lastName: email.last_name ?? null,
    position: email.position ?? null,
    department: email.department ?? null,
    seniority: email.seniority ?? null,
    linkedinUrl: email.linkedin ?? null,
    twitter: email.twitter ?? null,
    sourcesCount: Array.isArray(email.sources) ? email.sources.length : 0,
  };
}

const check: CheckPlugin = {
  id,
  label: 'Hunter.io',
  requiredEnv: ['HUNTER_API_KEY'],
  supportedTargetKinds: ['domain', 'url', 'email'],
  async run(target, context) {
    const apiKey = context.credentials.HUNTER_API_KEY;
    if (!apiKey) {
      return failure(id, source, 'Credencial HUNTER_API_KEY não configurada.');
    }

    try {
      const isEmail = target.kind === 'email';
      const observable = isEmail ? target.value : target.hostname;
      const response = await fetch(
        endpoint(isEmail ? 'email-verifier' : 'domain-search', apiKey, {
          ...(isEmail
            ? { email: observable }
            : { domain: observable, limit: '10' }),
        }),
        { signal: context.signal, headers: { accept: 'application/json' } },
      );
      if (!response.ok) return failure(id, source, apiFailure(response.status));

      const payload = (await response.json()) as HunterResponse;
      if (!payload.data) {
        return failure(
          id,
          source,
          'O Hunter retornou uma resposta incompleta.',
        );
      }

      if (isEmail) {
        return success(id, source, {
          mode: 'email-verifier',
          email: payload.data.email ?? observable,
          score: payload.data.score ?? null,
          status: payload.data.status ?? null,
          result: payload.data.result ?? null,
          checks: {
            regexp: payload.data.regexp ?? null,
            gibberish: payload.data.gibberish ?? null,
            disposable: payload.data.disposable ?? null,
            webmail: payload.data.webmail ?? null,
            mxRecords: payload.data.mx_records ?? null,
            smtpServer: payload.data.smtp_server ?? null,
            smtpCheck: payload.data.smtp_check ?? null,
            acceptAll: payload.data.accept_all ?? null,
            block: payload.data.block ?? null,
          },
          reportUrl: `https://hunter.io/email-verifier/${encodeURIComponent(observable)}`,
        });
      }

      return success(id, source, {
        mode: 'domain-search',
        domain: payload.data.domain ?? observable,
        organization: payload.data.organization ?? null,
        pattern: payload.data.pattern ?? null,
        disposable: payload.data.disposable ?? null,
        webmail: payload.data.webmail ?? null,
        acceptAll: payload.data.accept_all ?? null,
        emails: (payload.data.emails ?? []).slice(0, 10).map(compactEmail),
        meta: {
          results: payload.meta?.results ?? 0,
          limit: payload.meta?.limit ?? 10,
          offset: payload.meta?.offset ?? 0,
          aggregations: payload.meta?.aggregations ?? null,
        },
        reportUrl: `https://hunter.io/domain-search/${encodeURIComponent(observable)}`,
      });
    } catch {
      return failure(id, source, 'Não foi possível consultar o Hunter.');
    }
  },
};

export default check;
