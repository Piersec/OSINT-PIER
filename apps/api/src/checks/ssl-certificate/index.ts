import { isIP } from 'node:net';
import {
  checkServerIdentity,
  connect,
  type DetailedPeerCertificate,
  type TLSSocket,
} from 'node:tls';
import type { CheckPlugin } from '../../core/checks/contract.js';
import { failure, success } from '../../core/checks/results.js';
import { safeNetworkError } from '../../core/network/errors.js';

const id = 'ssl-certificate';

function tlsEndpoint(target: Parameters<CheckPlugin['run']>[0]): {
  hostname: string;
  port: number;
} {
  if (target.kind !== 'url') return { hostname: target.hostname, port: 443 };
  const url = new URL(target.value);
  return {
    hostname: url.hostname,
    port: url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 443,
  };
}

function inspectChain(certificate: DetailedPeerCertificate) {
  const chain: Array<{
    subject: DetailedPeerCertificate['subject'];
    issuer: DetailedPeerCertificate['issuer'];
    fingerprint256: string;
  }> = [];
  const seen = new Set<string>();
  let current: DetailedPeerCertificate | undefined = certificate;

  while (
    current?.fingerprint256 &&
    !seen.has(current.fingerprint256) &&
    chain.length < 10
  ) {
    seen.add(current.fingerprint256);
    chain.push({
      subject: current.subject,
      issuer: current.issuer,
      fingerprint256: current.fingerprint256,
    });
    current = current.issuerCertificate;
  }
  return chain;
}

function openTlsSocket(
  hostname: string,
  port: number,
  signal: AbortSignal,
): Promise<TLSSocket> {
  return new Promise((resolve, reject) => {
    const socket = connect({
      host: hostname,
      port,
      servername: isIP(hostname) ? undefined : hostname,
      rejectUnauthorized: false,
    });
    const abort = () =>
      socket.destroy(new DOMException('Aborted', 'AbortError'));
    const cleanup = () => signal.removeEventListener('abort', abort);
    signal.addEventListener('abort', abort, { once: true });
    socket.once('secureConnect', () => {
      cleanup();
      resolve(socket);
    });
    socket.once('error', (error) => {
      cleanup();
      reject(error);
    });
  });
}

const check: CheckPlugin = {
  id,
  label: 'SSL/TLS Certificate',
  requiredEnv: [],
  async run(target, context) {
    const { hostname, port } = tlsEndpoint(target);
    let socket: TLSSocket | undefined;
    try {
      socket = await openTlsSocket(hostname, port, context.signal);
      const certificate = socket.getPeerCertificate(true);
      if (!certificate?.raw) {
        return failure(
          id,
          'Node.js TLS',
          'O servidor não apresentou um certificado TLS.',
        );
      }
      const hostnameError = isIP(hostname)
        ? undefined
        : checkServerIdentity(hostname, certificate);
      const validFrom = new Date(certificate.valid_from);
      const validTo = new Date(certificate.valid_to);
      return success(id, 'Node.js TLS', {
        endpoint: `${hostname}:${port}`,
        protocol: socket.getProtocol(),
        cipher: socket.getCipher(),
        authorized: socket.authorized,
        authorizationError: socket.authorizationError ?? null,
        hostnameMatches: !hostnameError,
        hostnameError: hostnameError?.message ?? null,
        subject: certificate.subject,
        issuer: certificate.issuer,
        subjectAlternativeNames: certificate.subjectaltname
          ? certificate.subjectaltname.split(/,\s*/)
          : [],
        serialNumber: certificate.serialNumber,
        fingerprint256: certificate.fingerprint256,
        validFrom: validFrom.toISOString(),
        validTo: validTo.toISOString(),
        daysRemaining: Math.floor(
          (validTo.getTime() - Date.now()) / 86_400_000,
        ),
        chain: inspectChain(certificate),
      });
    } catch (error) {
      return failure(
        id,
        'Node.js TLS',
        safeNetworkError(
          error,
          'Não foi possível estabelecer uma conexão TLS com o alvo.',
        ),
      );
    } finally {
      socket?.destroy();
    }
  },
};

export default check;
