import type { CheckPlugin } from '../../core/checks/contract.js';
import { failure, success } from '../../core/checks/results.js';
import { safeNetworkError } from '../../core/network/errors.js';
import {
  followFirstAvailable,
  followRedirects,
  readTextLimited,
} from '../../core/network/http.js';

const id = 'robots-sitemap';

function parseRobots(body: string) {
  const userAgents = new Set<string>();
  const allow: string[] = [];
  const disallow: string[] = [];
  const sitemaps: string[] = [];

  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+#.*$/, '').trim();
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const directive = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (!value) continue;
    if (directive === 'user-agent') userAgents.add(value);
    else if (directive === 'allow' && allow.length < 100) allow.push(value);
    else if (directive === 'disallow' && disallow.length < 100)
      disallow.push(value);
    else if (directive === 'sitemap') sitemaps.push(value);
  }
  return {
    userAgents: [...userAgents],
    allow,
    disallow,
    sitemaps: [...new Set(sitemaps)],
  };
}

const check: CheckPlugin = {
  id,
  label: 'Robots.txt / Sitemap',
  requiredEnv: [],
  async run(target, context) {
    try {
      const landing = await followFirstAvailable(target, context.signal);
      const finalUrl = landing.hops.at(-1)?.url ?? target.value;
      await landing.response.body?.cancel();
      const robotsUrl = new URL('/robots.txt', finalUrl).toString();
      const robotsResponse = await followRedirects(
        robotsUrl,
        context.signal,
        5,
      );
      const robotsPresent = robotsResponse.response.ok;
      const body = robotsPresent
        ? await readTextLimited(robotsResponse.response, 524_288)
        : '';
      if (!robotsPresent) await robotsResponse.response.body?.cancel();
      const rules = parseRobots(body);
      const sitemapCandidates = rules.sitemaps.length
        ? rules.sitemaps.slice(0, 5)
        : [new URL('/sitemap.xml', finalUrl).toString()];
      const sitemaps = [];

      for (const sitemapUrl of sitemapCandidates) {
        try {
          const result = await followRedirects(sitemapUrl, context.signal, 5);
          sitemaps.push({
            url: result.hops.at(-1)?.url ?? sitemapUrl,
            status: result.response.status,
            available: result.response.ok,
            contentType: result.response.headers.get('content-type'),
          });
          await result.response.body?.cancel();
        } catch {
          sitemaps.push({
            url: sitemapUrl,
            status: null,
            available: false,
            contentType: null,
          });
        }
      }

      return success(id, 'robots.txt and sitemap discovery', {
        robots: {
          url: robotsUrl,
          status: robotsResponse.response.status,
          present: robotsPresent,
          ...rules,
        },
        sitemaps,
      });
    } catch (error) {
      return failure(
        id,
        'robots.txt and sitemap discovery',
        safeNetworkError(
          error,
          'Não foi possível consultar robots.txt e sitemap.',
        ),
      );
    }
  },
};

export default check;
