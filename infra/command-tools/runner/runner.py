import ipaddress
import json
import os
import re
import signal
import subprocess
import threading
import xml.etree.ElementTree as ElementTree
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit, urlunsplit


PORT = int(os.environ.get('PORT', '8081'))
MAX_BODY_BYTES = 32 * 1024
MAX_OUTPUT_BYTES = 2 * 1024 * 1024
MAX_RESULTS = 200
MAX_CONCURRENT_SCANS = 2
SCAN_SLOTS = threading.BoundedSemaphore(MAX_CONCURRENT_SCANS)
ENABLE_GOBUSTER = os.environ.get('COMMAND_TOOLS_ENABLE_GOBUSTER', '').lower() in {
    '1',
    'true',
    'yes',
}

TOOL_NAMES = {'nmap', 'katana', 'gobuster', 'subfinder'}
TOOL_TIMEOUTS = {
    'nmap': 75,
    'katana': 65,
    'gobuster': 55,
    'subfinder': 55,
}
BLOCKED_HOSTS = {
    'localhost',
    'localhost.localdomain',
    'host.docker.internal',
    'metadata.google.internal',
}
DOMAIN_PATTERN = re.compile(
    r'^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+'
    r'[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.?$',
    re.IGNORECASE,
)
GOBUSTER_RESULT_PATTERN = re.compile(
    r'^(?P<path>\S+)\s+\(Status:\s*(?P<status>\d{3})\)\s+\[Size:\s*(?P<size>\d+)\]'
)


class InvalidRequest(Exception):
    pass


class CommandTimeout(Exception):
    pass


class OutputLimit(Exception):
    pass


def send_json(handler: BaseHTTPRequestHandler, status: int, body: object) -> None:
    payload = json.dumps(body, separators=(',', ':')).encode('utf-8')
    handler.send_response(status)
    handler.send_header('content-type', 'application/json; charset=utf-8')
    handler.send_header('content-length', str(len(payload)))
    handler.send_header('cache-control', 'no-store')
    handler.end_headers()
    handler.wfile.write(payload)


def read_body(handler: BaseHTTPRequestHandler) -> dict:
    try:
        size = int(handler.headers.get('content-length', '0'))
    except ValueError as error:
        raise InvalidRequest from error
    if size < 1 or size > MAX_BODY_BYTES:
        raise InvalidRequest
    try:
        value = json.loads(handler.rfile.read(size))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise InvalidRequest from error
    if not isinstance(value, dict):
        raise InvalidRequest
    return value


def is_blocked_host(host: str) -> bool:
    normalized = host.lower().rstrip('.')
    if normalized in BLOCKED_HOSTS or normalized.endswith('.local'):
        return True
    try:
        address = ipaddress.ip_address(normalized)
    except ValueError:
        return False
    return any(
        (
            address.is_private,
            address.is_loopback,
            address.is_link_local,
            address.is_multicast,
            address.is_unspecified,
            address.is_reserved,
        )
    )


def validate_host(value: object, *, domain_only: bool = False) -> str:
    if not isinstance(value, str):
        raise InvalidRequest
    host = value.strip().rstrip('.').lower()
    if (
        not host
        or len(host) > 253
        or host.startswith('-')
        or any(ord(character) < 32 or character.isspace() for character in host)
        or is_blocked_host(host)
    ):
        raise InvalidRequest
    try:
        ipaddress.ip_address(host)
        if domain_only:
            raise InvalidRequest
        return host
    except ValueError:
        if not DOMAIN_PATTERN.fullmatch(host):
            raise InvalidRequest
        return host


def validate_url(value: object) -> str:
    if not isinstance(value, str) or len(value) > 2048:
        raise InvalidRequest
    parsed = urlsplit(value.strip())
    if parsed.scheme not in {'http', 'https'} or not parsed.hostname:
        raise InvalidRequest
    if parsed.username or parsed.password or is_blocked_host(parsed.hostname):
        raise InvalidRequest
    if any(ord(character) < 32 for character in value):
        raise InvalidRequest
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path or '/', parsed.query, ''))


def validate_request(body: dict) -> tuple[str, str, str]:
    if set(body) != {'tool', 'target', 'profile'}:
        raise InvalidRequest
    tool = body.get('tool')
    profile = body.get('profile')
    if tool not in TOOL_NAMES or profile != 'safe':
        raise InvalidRequest
    if tool == 'gobuster' and not ENABLE_GOBUSTER:
        raise PermissionError

    target = body.get('target')
    if tool == 'subfinder':
        return tool, validate_host(target, domain_only=True), profile
    if tool == 'nmap':
        return tool, validate_host(target), profile
    return tool, validate_url(target), profile


def run_command(arguments: list[str], timeout_seconds: int) -> tuple[int, str]:
    environment = os.environ.copy()
    environment.update({'HOME': '/tmp', 'XDG_CONFIG_HOME': '/tmp/config'})
    process = subprocess.Popen(
        arguments,
        cwd='/tmp',
        env=environment,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        start_new_session=True,
    )
    try:
        stdout, _stderr = process.communicate(timeout=timeout_seconds)
    except subprocess.TimeoutExpired as error:
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except OSError:
            process.kill()
        process.communicate()
        raise CommandTimeout from error
    if len(stdout.encode('utf-8', errors='ignore')) > MAX_OUTPUT_BYTES:
        raise OutputLimit
    return process.returncode, stdout


def string_value(value: object, limit: int = 512) -> str | None:
    if not isinstance(value, str):
        return None
    value = value.strip()
    return value[:limit] if value else None


def integer_value(value: object) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if isinstance(value, str) and value.strip().isdigit():
        return int(value.strip())
    return None


def mapping(value: object) -> dict:
    return value if isinstance(value, dict) else {}


def list_value(value: object) -> list:
    return value if isinstance(value, list) else []


def json_lines(output: str) -> list[dict]:
    values = []
    for line in output.splitlines():
        try:
            value = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(value, dict):
            values.append(value)
    return values


def run_subfinder(domain: str) -> tuple[int, dict]:
    returncode, output = run_command(
        ['subfinder', '-d', domain, '-silent', '-oJ', '-duc', '-max-time', '1'],
        TOOL_TIMEOUTS['subfinder'],
    )
    if returncode != 0 and not output.strip():
        return 502, {'error': 'Subfinder não conseguiu concluir a descoberta passiva.'}

    subdomains = []
    seen = set()
    for item in json_lines(output):
        host = string_value(item.get('host') or item.get('input'), 253)
        if not host or host in seen or not DOMAIN_PATTERN.fullmatch(host):
            continue
        seen.add(host)
        sources = [
            source[:128]
            for source in list_value(item.get('sources'))
            if isinstance(source, str) and source.strip()
        ][:8]
        subdomains.append({'host': host, 'sources': sources})
        if len(subdomains) >= MAX_RESULTS:
            break
    return 200, {
        'tool': 'subfinder',
        'profile': 'safe',
        'target': domain,
        'subdomains': subdomains,
        'total': len(subdomains),
        'truncated': len(subdomains) >= MAX_RESULTS,
    }


def nested(value: object, *keys: str) -> object:
    current = value
    for key in keys:
        current = mapping(current).get(key)
    return current


def run_katana(target: str) -> tuple[int, dict]:
    returncode, output = run_command(
        [
            'katana',
            '-u',
            target,
            '-silent',
            '-jsonl',
            '-d',
            '2',
            '-c',
            '3',
            '-p',
            '1',
            '-rl',
            '20',
            '-ct',
            '45s',
            '-timeout',
            '5',
            '-retry',
            '0',
            '-or',
            '-ob',
        ],
        TOOL_TIMEOUTS['katana'],
    )
    if returncode != 0 and not output.strip():
        return 502, {'error': 'Katana não conseguiu concluir o crawl limitado.'}

    urls = []
    seen = set()
    for item in json_lines(output):
        request = mapping(item.get('request'))
        response = mapping(item.get('response'))
        url = string_value(item.get('url') or request.get('endpoint'), 2048)
        if not url or url in seen or not url.startswith(('http://', 'https://')):
            continue
        seen.add(url)
        urls.append(
            {
                'url': url,
                'method': string_value(request.get('method'), 16),
                'statusCode': integer_value(response.get('status_code')),
                'contentType': string_value(
                    nested(response, 'headers', 'content-type'), 128
                ),
            }
        )
        if len(urls) >= MAX_RESULTS:
            break
    return 200, {
        'tool': 'katana',
        'profile': 'safe',
        'target': target,
        'urls': urls,
        'total': len(urls),
        'truncated': len(urls) >= MAX_RESULTS,
    }


def run_nmap(target: str) -> tuple[int, dict]:
    returncode, output = run_command(
        [
            'nmap',
            '-sT',
            '-Pn',
            '-T3',
            '--top-ports',
            '100',
            '--version-light',
            '--open',
            '--max-retries',
            '2',
            '--host-timeout',
            '60s',
            '-oX',
            '-',
            target,
        ],
        TOOL_TIMEOUTS['nmap'],
    )
    if returncode != 0 and not output.strip():
        return 502, {'error': 'Nmap não conseguiu concluir a varredura limitada.'}

    try:
        root = ElementTree.fromstring(output)
    except ElementTree.ParseError:
        return 502, {'error': 'A saída estruturada do Nmap não pôde ser lida.'}

    hosts = []
    open_ports = 0
    for host in root.findall('./host')[:4]:
        address = host.find('./address')
        status = host.find('./status')
        ports = []
        for port in host.findall('./ports/port'):
            state = port.find('./state')
            if state is None or state.attrib.get('state') not in {
                'open',
                'open|filtered',
                'unfiltered',
            }:
                continue
            service = port.find('./service')
            ports.append(
                {
                    'port': integer_value(port.attrib.get('portid')),
                    'protocol': string_value(port.attrib.get('protocol'), 8),
                    'state': string_value(state.attrib.get('state'), 32),
                    'service': string_value(service.attrib.get('name') if service is not None else None, 64),
                    'product': string_value(service.attrib.get('product') if service is not None else None, 128),
                    'version': string_value(service.attrib.get('version') if service is not None else None, 64),
                }
            )
        open_ports += len(ports)
        hosts.append(
            {
                'ip': string_value(address.attrib.get('addr') if address is not None else None, 128),
                'status': string_value(status.attrib.get('state') if status is not None else None, 32),
                'ports': ports[:100],
            }
        )
    return 200, {
        'tool': 'nmap',
        'profile': 'safe',
        'target': target,
        'hosts': hosts,
        'totalOpenPorts': open_ports,
        'note': 'TCP top 100, detecção leve de serviço e somente portas observáveis.',
    }


def run_gobuster(target: str) -> tuple[int, dict]:
    wordlist = '/app/wordlists/common.txt'
    returncode, output = run_command(
        [
            'gobuster',
            'dir',
            '-u',
            target,
            '-w',
            wordlist,
            '-q',
            '--no-progress',
            '--no-error',
            '--no-color',
            '-t',
            '4',
            '--timeout',
            '5s',
            '-l',
            '-s',
            '200,204,301,302,307,401,403',
        ],
        TOOL_TIMEOUTS['gobuster'],
    )
    if returncode != 0 and not output.strip():
        return 502, {'error': 'Gobuster não conseguiu concluir a enumeração limitada.'}

    paths = []
    seen = set()
    for line in output.splitlines():
        match = GOBUSTER_RESULT_PATTERN.search(line.strip())
        if not match or match.group('path') in seen:
            continue
        seen.add(match.group('path'))
        paths.append(
            {
                'path': match.group('path')[:512],
                'statusCode': int(match.group('status')),
                'length': int(match.group('size')),
            }
        )
        if len(paths) >= MAX_RESULTS:
            break
    return 200, {
        'tool': 'gobuster',
        'profile': 'safe',
        'target': target,
        'paths': paths,
        'total': len(paths),
        'truncated': len(paths) >= MAX_RESULTS,
        'note': 'Perfil limitado com wordlist interna; sem recursão, extensões ou headers customizados.',
    }


def execute(tool: str, target: str) -> tuple[int, dict]:
    if tool == 'subfinder':
        return run_subfinder(target)
    if tool == 'nmap':
        return run_nmap(target)
    if tool == 'katana':
        return run_katana(target)
    if tool == 'gobuster':
        return run_gobuster(target)
    raise InvalidRequest


class RunnerHandler(BaseHTTPRequestHandler):
    server_version = 'OSINT-Command-Tools-Runner/1.0'

    def log_message(self, format: str, *args: object) -> None:
        return

    def do_GET(self) -> None:
        if self.path == '/healthz':
            send_json(
                self,
                200,
                {
                    'ok': True,
                    'tools': sorted(TOOL_NAMES - ({'gobuster'} if not ENABLE_GOBUSTER else set())),
                },
            )
            return
        send_json(self, 404, {'error': 'Rota não encontrada.'})

    def do_POST(self) -> None:
        if self.path != '/api/v1/scan':
            send_json(self, 404, {'error': 'Rota não encontrada.'})
            return
        if not SCAN_SLOTS.acquire(blocking=False):
            send_json(self, 429, {'error': 'O runner está ocupado. Tente novamente em instantes.'})
            return
        try:
            body = read_body(self)
            tool, target, _profile = validate_request(body)
            try:
                status, result = execute(tool, target)
                send_json(self, status, result)
            except CommandTimeout:
                send_json(self, 504, {'error': 'A ferramenta excedeu o limite de execução.'})
            except OutputLimit:
                send_json(self, 502, {'error': 'A ferramenta produziu saída acima do limite.'})
            except FileNotFoundError:
                send_json(self, 503, {'error': 'A ferramenta solicitada não está instalada no runner.'})
            except OSError:
                send_json(self, 503, {'error': 'O runner não conseguiu iniciar a ferramenta.'})
        except PermissionError:
            send_json(self, 403, {'error': 'Gobuster está desabilitado no runner.'})
        except InvalidRequest:
            send_json(self, 400, {'error': 'Alvo, ferramenta ou perfil inválido.'})
        finally:
            SCAN_SLOTS.release()


ThreadingHTTPServer(('0.0.0.0', PORT), RunnerHandler).serve_forever()
