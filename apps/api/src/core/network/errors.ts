export function safeNetworkError(error: unknown, fallback: string): string {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'A operação foi cancelada por timeout.';
  }

  if (error && typeof error === 'object' && 'code' in error) {
    const code = String((error as { code?: unknown }).code);
    const known: Record<string, string> = {
      ENOTFOUND: 'O nome do host não foi encontrado.',
      ENODATA: 'O servidor DNS não retornou dados para esta consulta.',
      ECONNREFUSED: 'A conexão foi recusada pelo servidor.',
      ECONNRESET: 'A conexão foi encerrada pelo servidor.',
      ETIMEDOUT: 'A conexão excedeu o tempo limite.',
      EAI_AGAIN: 'O resolvedor DNS está temporariamente indisponível.',
    };
    if (known[code]) return known[code];
  }

  return fallback;
}
