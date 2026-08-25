import json
import os
import re
import subprocess
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


PORT = int(os.environ.get('PORT', '8081'))
TIMEOUT_SECONDS = int(os.environ.get('GHUNT_TIMEOUT_SECONDS', '105'))
MAX_BODY_BYTES = 16 * 1024
EMAIL_PATTERN = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')


def send_json(handler: BaseHTTPRequestHandler, status: int, body: object) -> None:
    payload = json.dumps(body, separators=(',', ':')).encode('utf-8')
    handler.send_response(status)
    handler.send_header('content-type', 'application/json; charset=utf-8')
    handler.send_header('content-length', str(len(payload)))
    handler.send_header('cache-control', 'no-store')
    handler.end_headers()
    handler.wfile.write(payload)


def scalar(value: object, limit: int = 512) -> str | None:
    if not isinstance(value, str):
        return None
    value = value.strip()
    return value[:limit] if value else None


def mapping(value: object) -> dict:
    return value if isinstance(value, dict) else {}


def named_record(value: object) -> dict:
    container = mapping(value)
    return mapping(container.get('PROFILE')) or next(
        (mapping(item) for item in container.values() if isinstance(item, dict)),
        {},
    )


def profile_name(profile: dict) -> str | None:
    names = named_record(profile.get('names'))
    return scalar(names.get('fullname') or names.get('displayName') or names.get('name'))


def profile_photo(profile: dict) -> tuple[str | None, bool | None]:
    photo = named_record(profile.get('profilePhotos'))
    return scalar(photo.get('url'), 2048), (
        photo.get('isDefault') is False if 'isDefault' in photo else None
    )


def compact(payload: object, email: str) -> dict:
    containers = mapping(payload)
    container = next(
        (
            mapping(value)
            for key, value in containers.items()
            if key.endswith('_CONTAINER') and isinstance(value, dict)
        ),
        {},
    )
    profile = mapping(container.get('profile'))
    source = named_record(profile.get('sourceIds'))
    extended = mapping(profile.get('extendedData'))
    dynamite = mapping(extended.get('dynamiteData'))
    reachability = named_record(profile.get('inAppReachability'))
    photo_url, photo_custom = profile_photo(profile)
    services = [
        item.strip()[:128]
        for item in reachability.get('apps', [])
        if isinstance(item, str) and item.strip()
    ][:24]
    play_games = container.get('play_games')
    maps = mapping(container.get('maps'))

    return {
        'email': email,
        'found': bool(profile),
        'profile': {
            'name': profile_name(profile),
            'gaiaId': scalar(profile.get('personId'), 128),
            'lastUpdated': scalar(source.get('lastUpdated'), 64),
            'profilePhotoUrl': photo_url,
            'profilePhotoCustom': photo_custom,
            'entityType': scalar(dynamite.get('entityType'), 128),
            'services': services,
        },
        'signals': {
            'hasPlayGamesProfile': bool(play_games),
            'hasMapsReviews': bool(maps.get('stats')),
            'hasPublicCalendar': bool(container.get('calendar')),
        },
    }


def run_ghunt(email: str) -> tuple[int, dict]:
    with tempfile.TemporaryDirectory(prefix='ghunt-') as directory:
        output = Path(directory) / 'result.json'
        environment = os.environ.copy()
        environment['HOME'] = os.environ.get('HOME', '/data')
        completed = subprocess.run(
            ['ghunt', 'email', email, '--json', str(output)],
            cwd=directory,
            env=environment,
            capture_output=True,
            text=True,
            timeout=TIMEOUT_SECONDS,
            check=False,
        )
        if output.is_file():
            try:
                with output.open('r', encoding='utf-8') as file:
                    return 200, compact(json.load(file), email)
            except (OSError, ValueError):
                return 502, {'error': 'O resultado do GHunt não pôde ser lido.'}

        diagnostic = f'{completed.stdout}\n{completed.stderr}'.lower()
        if any(
            marker in diagnostic
            for marker in ('cookie', 'session', 'not logged', 'oauth', 'auth')
        ):
            return 401, {'error': 'A sessão Google do runner GHunt é inválida.'}
        if any(marker in diagnostic for marker in ("wasn't found", 'not found')):
            return 200, compact({}, email)
        return 502, {'error': 'O GHunt falhou durante a consulta.'}


class RunnerHandler(BaseHTTPRequestHandler):
    server_version = 'OSINT-GHunt-Runner/1.0'

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
        try:
            size = int(self.headers.get('content-length', '0'))
            if size < 1 or size > MAX_BODY_BYTES:
                raise ValueError('invalid-body')
            body = json.loads(self.rfile.read(size))
            email = body.get('email') if isinstance(body, dict) else None
            if not isinstance(email, str) or not EMAIL_PATTERN.fullmatch(email.strip()):
                send_json(self, 400, {'error': 'Informe um e-mail válido.'})
                return
            status, result = run_ghunt(email.strip().lower())
            send_json(self, status, result)
        except (ValueError, json.JSONDecodeError):
            send_json(self, 400, {'error': 'Requisição inválida.'})
        except subprocess.TimeoutExpired:
            send_json(self, 504, {'error': 'A consulta do GHunt excedeu o tempo limite.'})
        except OSError:
            send_json(self, 503, {'error': 'O runner GHunt não está pronto.'})


ThreadingHTTPServer(('0.0.0.0', PORT), RunnerHandler).serve_forever()
