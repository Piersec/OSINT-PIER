import type { CheckPlugin } from '../../core/checks/contract.js';
import { failure, success } from '../../core/checks/results.js';
import { isPublicAddress, resolveAddresses } from '../../core/network/ip.js';

// Preserve existing enable/disable settings while replacing the provider.
const id = 'shodan';
const source = 'Shodan InternetDB';

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === 'string'))].slice(0, 100)
    : [];
}

const check: CheckPlugin = {
  id,
  label: 'Shodan InternetDB',
  requiredEnv: [],
  supportedTargetKinds: ['domain', 'ip', 'url'],
  timeoutMs: 10_000,
  async run(target, context) {
    try {
      const addresses = await resolveAddresses(target.hostname);
      const selectedIp = addresses.ipv4.find(isPublicAddress);
      if (!selectedIp) {
        return { id, status: 'skipped', source, durationMs: 0,
          error: 'InternetDB requer um IPv4 público; o alvo não foi enviado ao serviço.' };
      }
      const response = await fetch(
        new URL(`https://internetdb.shodan.io/${encodeURIComponent(selectedIp)}`),
        { signal: context.signal, headers: { accept: 'application/json' } },
      );
      if (response.status === 404) {
        return success(id, source, { selectedIp, found: false,
          note: 'Sem dados disponíveis no InternetDB. Isso não indica ausência de portas ou vulnerabilidades.' });
      }
      if (!response.ok) {
        return failure(id, source, response.status === 429
          ? 'Limite do InternetDB atingido. Aguarde antes de tentar novamente.'
          : 'InternetDB temporariamente indisponível.');
      }
      const payload: unknown = await response.json();
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return failure(id, source, 'O InternetDB retornou uma resposta incompleta.');
      }
      const data = payload as Record<string, unknown>;
      if (data.ip !== selectedIp || !Array.isArray(data.ports)) {
        return failure(id, source, 'O InternetDB retornou uma resposta incompleta.');
      }
      const observedPorts = [...new Set(data.ports.filter((port): port is number =>
        typeof port === 'number' && Number.isInteger(port) && port > 0 && port <= 65535,
      ))].sort((a, b) => a - b).slice(0, 200);
      return success(id, source, {
        selectedIp, found: true, observedPorts,
        hostnames: strings(data.hostnames), technologies: strings(data.cpes),
        tags: strings(data.tags),
        possibleCves: strings(data.vulns).filter(value => /^CVE-\d{4}-\d{4,}$/i.test(value)),
        note: 'Dados observados, atualizados semanalmente. CVEs são possíveis associações, verificadas ou não pela fonte; não comprovam vulnerabilidades no alvo.',
      });
    } catch {
      return failure(id, source, 'Não foi possível consultar o InternetDB.');
    }
  },
};

export default check;
