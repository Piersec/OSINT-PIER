import type { CheckPlugin } from '../../core/checks/contract.js';
import { failure, success } from '../../core/checks/results.js';
import { safeNetworkError } from '../../core/network/errors.js';
import {
  followFirstAvailable,
  readTextLimited,
} from '../../core/network/http.js';

const id = 'tech-stack';

interface Technology {
  name: string;
  category: string;
  evidence: string;
}

function detector(response: Response, html: string): Technology[] {
  const found = new Map<string, Technology>();
  const add = (name: string, category: string, evidence: string) => {
    if (!found.has(name)) found.set(name, { name, category, evidence });
  };
  const header = (name: string) => response.headers.get(name);
  const server = header('server');
  const poweredBy = header('x-powered-by');
  if (server) add(server, 'Web server / edge', 'Header Server');
  if (poweredBy) add(poweredBy, 'Runtime / framework', 'Header X-Powered-By');
  if (header('cf-ray') || /cloudflare/i.test(server ?? ''))
    add('Cloudflare', 'CDN / edge', 'Headers HTTP');
  if (header('x-vercel-id'))
    add('Vercel', 'Hosting / edge', 'Header X-Vercel-Id');
  if (header('x-nf-request-id'))
    add('Netlify', 'Hosting / edge', 'Header X-Nf-Request-Id');

  const signals: Array<[RegExp, string, string, string]> = [
    [
      /\/wp-(?:content|includes)\//i,
      'WordPress',
      'CMS',
      'Caminhos wp-content/wp-includes',
    ],
    [
      /__NEXT_DATA__|\/_next\//i,
      'Next.js',
      'Framework web',
      'Marcadores Next.js no HTML',
    ],
    [/__NUXT__|\/_nuxt\//i, 'Nuxt', 'Framework web', 'Marcadores Nuxt no HTML'],
    [/ng-version=/i, 'Angular', 'Framework frontend', 'Atributo ng-version'],
    [
      /data-v-[a-f0-9]{6,}/i,
      'Vue.js',
      'Framework frontend',
      'Atributos de escopo Vue',
    ],
    [
      /cdn\.shopify\.com|Shopify\.theme/i,
      'Shopify',
      'E-commerce',
      'Recursos Shopify',
    ],
    [
      /jquery(?:\.min)?\.js|jQuery\(/i,
      'jQuery',
      'Biblioteca frontend',
      'Script jQuery',
    ],
    [
      /bootstrap(?:\.min)?\.(?:css|js)/i,
      'Bootstrap',
      'UI framework',
      'Recurso Bootstrap',
    ],
    [
      /googletagmanager\.com\/gtag|google-analytics\.com/i,
      'Google Analytics',
      'Analytics',
      'Script de analytics',
    ],
  ];
  for (const [pattern, name, category, evidence] of signals) {
    if (pattern.test(html)) add(name, category, evidence);
  }

  const generator = html.match(
    /<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)/i,
  )?.[1];
  if (generator) add(generator, 'Generator / CMS', 'Meta generator');
  return [...found.values()];
}

const check: CheckPlugin = {
  id,
  label: 'Tech Stack',
  requiredEnv: [],
  async run(target, context) {
    try {
      const { response, hops } = await followFirstAvailable(
        target,
        context.signal,
      );
      const contentType = response.headers.get('content-type') ?? '';
      const html = contentType.includes('text/html')
        ? await readTextLimited(response, 524_288)
        : '';
      if (!contentType.includes('text/html')) await response.body?.cancel();
      const technologies = detector(response, html);
      return success(id, 'HTTP fingerprints', {
        finalUrl: hops.at(-1)?.url ?? null,
        contentType,
        count: technologies.length,
        technologies,
        heuristic: true,
      });
    } catch (error) {
      return failure(
        id,
        'HTTP fingerprints',
        safeNetworkError(
          error,
          'Não foi possível coletar sinais da stack tecnológica.',
        ),
      );
    }
  },
};

export default check;
