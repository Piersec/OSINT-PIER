import type { CheckPlugin } from '../../core/checks/contract.js';
import { failure, success } from '../../core/checks/results.js';
import { safeNetworkError } from '../../core/network/errors.js';
import { followFirstAvailable } from '../../core/network/http.js';

const id = 'cookies';

function parseCookie(header: string) {
  const [nameValue = '', ...attributes] = header.split(';');
  const separator = nameValue.indexOf('=');
  const name =
    separator >= 0 ? nameValue.slice(0, separator).trim() : nameValue.trim();
  const parsed = {
    name,
    domain: null as string | null,
    path: null as string | null,
    expires: null as string | null,
    maxAge: null as string | null,
    sameSite: null as string | null,
    secure: false,
    httpOnly: false,
  };

  for (const rawAttribute of attributes) {
    const [rawName = '', ...valueParts] = rawAttribute.trim().split('=');
    const attribute = rawName.toLowerCase();
    const value = valueParts.join('=').trim() || null;
    if (attribute === 'secure') parsed.secure = true;
    else if (attribute === 'httponly') parsed.httpOnly = true;
    else if (attribute === 'domain') parsed.domain = value;
    else if (attribute === 'path') parsed.path = value;
    else if (attribute === 'expires') parsed.expires = value;
    else if (attribute === 'max-age') parsed.maxAge = value;
    else if (attribute === 'samesite') parsed.sameSite = value;
  }
  return parsed;
}

const check: CheckPlugin = {
  id,
  label: 'Cookies',
  requiredEnv: [],
  async run(target, context) {
    try {
      const { response, hops } = await followFirstAvailable(
        target,
        context.signal,
      );
      const cookieHeaders =
        (
          response.headers as Headers & { getSetCookie?: () => string[] }
        ).getSetCookie?.() ??
        (response.headers.get('set-cookie')
          ? [response.headers.get('set-cookie')!]
          : []);
      const cookies = cookieHeaders
        .map(parseCookie)
        .filter((cookie) => cookie.name);
      await response.body?.cancel();
      return success(id, 'Set-Cookie response headers', {
        finalUrl: hops.at(-1)?.url ?? null,
        count: cookies.length,
        summary: {
          secure: cookies.filter((cookie) => cookie.secure).length,
          httpOnly: cookies.filter((cookie) => cookie.httpOnly).length,
          sameSite: cookies.filter((cookie) => cookie.sameSite).length,
        },
        cookies,
        note: 'Valores dos cookies foram omitidos intencionalmente.',
      });
    } catch (error) {
      return failure(
        id,
        'Set-Cookie response headers',
        safeNetworkError(
          error,
          'Não foi possível analisar os cookies do alvo.',
        ),
      );
    }
  },
};

export default check;
