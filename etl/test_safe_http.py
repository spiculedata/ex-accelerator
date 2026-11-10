import pytest

import time

import safe_http
from safe_http import TooLargeError, UnsafeUrlError, assert_public_url, is_public_ip, read_capped, safe_get


class Resp:
    def __init__(self, status=200, location=None):
        self.status_code = status
        self.headers = {'location': location} if location else {}

    def close(self):
        pass


def public(host, port):
    return [(2, 1, 6, '', ('93.184.216.34', port))]


@pytest.mark.parametrize('ip', ['8.8.8.8', '93.184.216.34', '2606:4700:4700::1111', '172.32.0.1'])
def test_public_addresses(ip):
    assert is_public_ip(ip)


@pytest.mark.parametrize('ip', [
    '127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.0.1', '169.254.169.254', '100.64.0.1', '0.0.0.0',
    '224.0.0.1', '::1', 'fe80::1', 'fd00::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1', 'example.com',
    '64:ff9b::7f00:1', '64:ff9b::a9fe:a9fe', '2002:7f00:1::', '2002:a9fe:a9fe::', '::127.0.0.1', '::ffff:0:7f00:1', 'fec0::1',
    '192.88.99.1', '168.63.129.16', '2001:db8::1', '2001::1',
])
def test_private_or_special_addresses(ip):
    assert not is_public_ip(ip)


@pytest.mark.parametrize('url', [
    'http://127.0.0.1/a.png', 'http://localhost/a.png', 'http://169.254.169.254/latest/meta-data/', 'http://[::1]/',
    'http://user:pw@example.com/a.png', 'ftp://example.com/a.png', 'file:///etc/passwd',
])
def test_unsafe_urls_are_refused(url):
    with pytest.raises(UnsafeUrlError):
        assert_public_url(url, resolve=public)


def test_a_name_resolving_to_an_internal_address_is_refused_even_if_another_answer_is_public():
    mixed = lambda host, port: [(2, 1, 6, '', ('93.184.216.34', port)), (2, 1, 6, '', ('10.0.0.9', port))]
    with pytest.raises(UnsafeUrlError):
        assert_public_url('https://evil.example/a.png', resolve=mixed)


def test_redirects_are_checked_at_every_hop():
    calls = []

    def get(url, **kwargs):
        calls.append(url)
        assert kwargs['allow_redirects'] is False
        return Resp(302, 'http://169.254.169.254/latest/') if url.startswith('https://example.com') else Resp(200)

    with pytest.raises(UnsafeUrlError):
        safe_get('https://example.com/a.png', resolve=public, get=get)
    assert calls == ['https://example.com/a.png']


def test_a_safe_redirect_is_followed_and_a_loop_is_stopped():
    def get(url, **kwargs):
        return Resp(301, '/b.png') if url.endswith('/a.png') else Resp(200)

    assert safe_get('https://example.com/a.png', resolve=public, get=get).status_code == 200
    with pytest.raises(UnsafeUrlError):
        safe_get('https://example.com/a.png', resolve=public, get=lambda url, **k: Resp(302, 'https://example.com/loop'))


@pytest.mark.parametrize('url', [
    'http://127.0.0.1\\x.attacker.com/a.jpg',          # a backslash ends the host for requests but not for urlsplit
    'http://169.254.169.254\\x.attacker.com/latest/',
    'http://localhost\\x.attacker.com/',
    'http://exa mple.com/', 'http://example.com/a\tb', 'http://exa\x00mple.com/',
    'http://localhost./a.png', 'http://LOCALHOST/a.png', 'http://app.localhost/a.png',
])
def test_urls_that_two_parsers_could_read_differently_are_refused(url):
    with pytest.raises(UnsafeUrlError):
        assert_public_url(url, resolve=public)


def test_decimal_octal_and_hex_hosts_are_checked_after_resolution():
    loopback = lambda host, port: [(2, 1, 6, '', ('127.0.0.1', port))]
    for url in ('http://2130706433/', 'http://0x7f.1/', 'http://017700000001/', 'http://127.1/'):
        with pytest.raises(UnsafeUrlError):
            assert_public_url(url, resolve=loopback)


def test_a_name_that_resolves_privately_gets_the_same_message_as_any_download_failure():
    internal = lambda host, port: [(2, 1, 6, '', ('10.0.0.9', port))]
    with pytest.raises(UnsafeUrlError) as caught:
        assert_public_url('https://intranet.example/', resolve=internal)
    assert 'could not be downloaded' in str(caught.value)


class FakeResponse:
    def __init__(self, chunks, status=200, location=None):
        self.chunks = chunks
        self.status_code = status
        self.headers = {'location': location} if location else {}
        self.closed = False

    def iter_content(self, chunk_size=8192):
        for chunk in self.chunks:
            yield chunk

    def close(self):
        self.closed = True


def test_read_capped_reads_a_body_under_the_cap():
    assert read_capped(FakeResponse([b'a' * 10, b'b' * 5]), max_bytes=100, timeout=5) == b'a' * 10 + b'b' * 5


def test_read_capped_stops_at_the_cap_and_closes():
    response = FakeResponse([b'x' * 60, b'x' * 60, b'x' * 60])
    with pytest.raises(TooLargeError):
        read_capped(response, max_bytes=100, timeout=5)
    assert response.closed


def test_read_capped_gives_up_after_the_deadline_however_slowly_it_arrives():
    def slow():
        for _ in range(3):
            time.sleep(0.05)
            yield b'x'

    response = FakeResponse([])
    response.iter_content = lambda chunk_size=8192: slow()
    with pytest.raises(UnsafeUrlError, match='too long'):
        read_capped(response, max_bytes=100, timeout=0.06)


def test_redirect_responses_are_closed():
    responses = []

    def get(url, **kwargs):
        response = FakeResponse([], 302, 'https://example.com/b.png') if url.endswith('/a.png') else FakeResponse([b'img'])
        responses.append(response)
        return response

    safe_get('https://example.com/a.png', resolve=public, get=get)
    assert responses[0].closed and not responses[1].closed


def test_the_connection_goes_to_the_address_that_was_checked(monkeypatch):
    seen = {}
    monkeypatch.setattr(safe_http.socket, 'getaddrinfo', lambda host, port, *a, **k: [(2, 1, 6, '', ('93.184.216.34', port))])
    monkeypatch.setattr(safe_http, 'create_connection', lambda address, *a, **k: seen.setdefault('address', address) or object())
    conn = safe_http.GuardedHTTPConnection('example.com', 80)
    conn._new_conn()
    assert seen['address'] == ('93.184.216.34', 80)


def test_a_connection_to_a_name_that_now_resolves_internally_is_refused(monkeypatch):
    monkeypatch.setattr(safe_http.socket, 'getaddrinfo', lambda host, port, *a, **k: [(2, 1, 6, '', ('127.0.0.1', port))])
    called = []
    monkeypatch.setattr(safe_http, 'create_connection', lambda *a, **k: called.append(1))
    with pytest.raises(UnsafeUrlError):
        safe_http.GuardedHTTPConnection('rebind.example', 80)._new_conn()
    assert not called


def test_proxies_and_netrc_from_the_environment_are_ignored():
    assert safe_http.guarded_session().trust_env is False
