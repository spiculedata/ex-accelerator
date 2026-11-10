import pytest

from safe_http import UnsafeUrlError, assert_public_url, is_public_ip, safe_get


class Resp:
    def __init__(self, status=200, location=None):
        self.status_code = status
        self.headers = {'location': location} if location else {}


def public(host, port):
    return [(2, 1, 6, '', ('93.184.216.34', port))]


@pytest.mark.parametrize('ip', ['8.8.8.8', '93.184.216.34', '2606:4700:4700::1111', '172.32.0.1'])
def test_public_addresses(ip):
    assert is_public_ip(ip)


@pytest.mark.parametrize('ip', [
    '127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.0.1', '169.254.169.254', '100.64.0.1', '0.0.0.0',
    '224.0.0.1', '::1', 'fe80::1', 'fd00::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1', 'example.com',
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
