import hmac
import http.client
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit


PORT = int(os.environ.get('PORT', '8080'))
TOKEN = os.environ.get('GHUNT_API_TOKEN', '')
UPSTREAM_VALUE = os.environ.get('GHUNT_UPSTREAM', 'http://runner:8081')
MAX_BODY_BYTES = 64 * 1024

if len(TOKEN) < 32:
    raise RuntimeError('GHUNT_API_TOKEN precisa ter pelo menos 32 caracteres.')

UPSTREAM = urlsplit(UPSTREAM_VALUE)
if UPSTREAM.scheme not in {'http', 'https'} or not UPSTREAM.hostname:
    raise RuntimeError('GHUNT_UPSTREAM precisa usar HTTP(S) com host válido.')


def send_json(handler: BaseHTTPRequestHandler, status: int, body: object) -> None:
    payload = json.dumps(body, separators=(',', ':')).encode('utf-8')
    handler.send_response(status)
    handler.send_header('content-type', 'application/json; charset=utf-8')
    handler.send_header('content-length', str(len(payload)))
    handler.send_header('cache-control', 'no-store')
    handler.end_headers()
    handler.wfile.write(payload)


def authorized(handler: BaseHTTPRequestHandler) -> bool:
    supplied = handler.headers.get('authorization', '')
    if not supplied.lower().startswith('bearer '):
        return False
    return hmac.compare_digest(supplied[7:].strip().encode(), TOKEN.encode())


def read_body(handler: BaseHTTPRequestHandler) -> bytes:
    try:
        size = int(handler.headers.get('content-length', '0'))
    except ValueError as error:
        raise ValueError('invalid-content-length') from error
    if size < 1 or size > MAX_BODY_BYTES:
        raise ValueError('request-too-large')
    return handler.rfile.read(size)


def proxy(path: str, body: bytes) -> tuple[int, dict[str, str], bytes]:
    connection_type = (
        http.client.HTTPSConnection
        if UPSTREAM.scheme == 'https'
        else http.client.HTTPConnection
    )
    connection = connection_type(UPSTREAM.hostname, UPSTREAM.port, timeout=110)
    upstream_path = f'{UPSTREAM.path.rstrip("/")}{path}'
    try:
        connection.request(
            'POST',
            upstream_path,
            body=body,
            headers={
                'accept': 'application/json',
                'content-type': 'application/json',
                'content-length': str(len(body)),
            },
        )
        response = connection.getresponse()
        response_body = response.read(MAX_BODY_BYTES)
        headers = {
            'content-type': response.getheader('content-type', 'application/json'),
            'cache-control': 'no-store',
        }
        return response.status, headers, response_body
    finally:
        connection.close()


class GatewayHandler(BaseHTTPRequestHandler):
    server_version = 'OSINT-GHunt-Gateway/1.0'

    def log_message(self, format: str, *args: object) -> None:
        return

    def do_GET(self) -> None:
        if self.path == '/healthz':
            send_json(self, 200, {'ok': True})
            return
        send_json(self, 404, {'error': 'Rota não encontrada.'})

    def do_POST(self) -> None:
        if self.path != '/api/v2/email':
            send_json(self, 404, {'error': 'Rota não encontrada.'})
            return
        if not authorized(self):
            send_json(self, 401, {'error': 'Não autorizado.'})
            return

        try:
            body = read_body(self)
            status, headers, response_body = proxy(self.path, body)
            self.send_response(status)
            for name, value in headers.items():
                self.send_header(name, value)
            self.send_header('content-length', str(len(response_body)))
            self.end_headers()
            self.wfile.write(response_body)
        except ValueError as error:
            if str(error) == 'request-too-large':
                send_json(self, 413, {'error': 'Requisição inválida.'})
            else:
                send_json(self, 400, {'error': 'Requisição inválida.'})
        except (OSError, TimeoutError):
            send_json(self, 502, {'error': 'Runner GHunt indisponível.'})


ThreadingHTTPServer(('0.0.0.0', PORT), GatewayHandler).serve_forever()
