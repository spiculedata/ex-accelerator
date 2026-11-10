"""Downloading an address someone typed in must never reach this machine's own network.

Three layers, because each alone has a gap:
  1. The URL is parsed once, by the same parser the HTTP client uses, and refused if it is ambiguous (a backslash, spaces,
     control characters) or names an internal host.
  2. Every hop, including each redirect, must resolve only to public addresses.
  3. The connection itself resolves once, checks the answers and connects to the checked address, so a name cannot answer
     differently between the check and the connection (DNS rebinding).
Proxies and .netrc from the environment are ignored, since a proxy would resolve and connect on its own.
"""
import ipaddress
import re
import socket
import time
from urllib.parse import urljoin

import requests
from requests.adapters import HTTPAdapter
from urllib3.connection import HTTPConnection, HTTPSConnection
from urllib3.connectionpool import HTTPConnectionPool, HTTPSConnectionPool
from urllib3.util import parse_url
from urllib3.util.connection import create_connection

MAX_REDIRECTS = 5
PRIVATE_MESSAGE = 'That address points to a private or internal network.'
# For a name, the same words as any other download failure, so the answer does not reveal what a name resolves to
GENERIC_MESSAGE = 'The image could not be downloaded. Check the address, and that the site allows downloads.'
_HOST_CHARS = re.compile(r'^[A-Za-z0-9.-]+$')
_BAD_URL_CHARS = re.compile(r'[\\\s\x00-\x1f\x7f]')


class UnsafeUrlError(ValueError):
    """The address points at a private or internal network, or is not a plain http(s) address."""


class TooLargeError(ValueError):
    """The download is bigger than the cap."""


# Addresses that look public to ipaddress but are not safe: 6to4 relay, Azure's platform endpoint
_EXTRA_DENIED = [ipaddress.ip_network('192.88.99.0/24'), ipaddress.ip_network('168.63.129.16/32')]
_IPV6_GLOBAL = ipaddress.ip_network('2000::/3')
_IPV6_SPECIAL = [ipaddress.ip_network(n) for n in ('2001::/32', '2001:db8::/32', '2002::/16')]  # Teredo, documentation, 6to4


def is_public_ip(address: str) -> bool:
    try:
        ip = ipaddress.ip_address(address.split('%')[0])
    except ValueError:
        return False
    if isinstance(ip, ipaddress.IPv6Address):
        if ip.ipv4_mapped is not None:
            return is_public_ip(str(ip.ipv4_mapped))
        # Only global unicast, minus its special-purpose blocks (so NAT64, 6to4, IPv4-compatible and site-local all fail)
        return ip in _IPV6_GLOBAL and not any(ip in net for net in _IPV6_SPECIAL) and ip.is_global
    if any(ip in net for net in _EXTRA_DENIED):
        return False
    return ip.is_global and not ip.is_multicast


def _client_host(url: str) -> str:
    """The host the HTTP client will really connect to, found with the client's own parser."""
    prepared = requests.Request('GET', url).prepare().url
    host = parse_url(prepared).host
    if not host:
        raise UnsafeUrlError('That is not a web address.')
    return host


def assert_public_url(url: str, resolve=socket.getaddrinfo) -> None:
    if _BAD_URL_CHARS.search(url):
        raise UnsafeUrlError('That is not a web address.')
    parsed = parse_url(url)
    if parsed.scheme not in ('http', 'https'):
        raise UnsafeUrlError('Only http:// and https:// addresses can be downloaded.')
    if parsed.auth:
        raise UnsafeUrlError('Addresses with a user name or password cannot be downloaded.')
    host = _client_host(url).strip('[]').rstrip('.').lower()
    if host == 'localhost' or host.endswith('.localhost'):
        raise UnsafeUrlError(PRIVATE_MESSAGE)
    try:
        ipaddress.ip_address(host.split('%')[0])
        addresses, literal = [host], True
    except ValueError:
        if not _HOST_CHARS.match(host):
            raise UnsafeUrlError('That is not a web address.')
        literal = False
        try:
            addresses = [info[4][0] for info in resolve(host, parsed.port or (443 if parsed.scheme == 'https' else 80))]
        except OSError as error:
            raise UnsafeUrlError(GENERIC_MESSAGE) from error
    if not addresses or any(not is_public_ip(address) for address in addresses):
        raise UnsafeUrlError(PRIVATE_MESSAGE if literal else GENERIC_MESSAGE)


def _checked_address(host: str, port: int) -> str:
    try:
        infos = socket.getaddrinfo(host, port, 0, socket.SOCK_STREAM)
    except OSError as error:
        raise UnsafeUrlError(GENERIC_MESSAGE) from error
    addresses = [info[4][0] for info in infos]
    if not addresses or any(not is_public_ip(address) for address in addresses):
        raise UnsafeUrlError(GENERIC_MESSAGE)
    return addresses[0]


class GuardedHTTPConnection(HTTPConnection):
    def _new_conn(self):
        address = _checked_address(self._dns_host, self.port)
        # The host name stays as it is (for the Host header and TLS), but the socket goes to the address just checked
        return create_connection((address, self.port), self.timeout, source_address=self.source_address, socket_options=self.socket_options)


class GuardedHTTPSConnection(HTTPSConnection):
    _new_conn = GuardedHTTPConnection._new_conn


class GuardedHTTPPool(HTTPConnectionPool):
    ConnectionCls = GuardedHTTPConnection


class GuardedHTTPSPool(HTTPSConnectionPool):
    ConnectionCls = GuardedHTTPSConnection


class GuardedAdapter(HTTPAdapter):
    def init_poolmanager(self, *args, **kwargs):
        super().init_poolmanager(*args, **kwargs)
        self.poolmanager.pool_classes_by_scheme = {'http': GuardedHTTPPool, 'https': GuardedHTTPSPool}


def guarded_session() -> requests.Session:
    session = requests.Session()
    session.trust_env = False
    session.mount('http://', GuardedAdapter())
    session.mount('https://', GuardedAdapter())
    return session


def safe_get(url: str, resolve=socket.getaddrinfo, get=None, **kwargs):
    """GET that refuses internal addresses on every redirect hop. The body is streamed: read it with read_capped."""
    session = None
    if get is None:
        session = guarded_session()
        get = session.get
    headers = {**kwargs.pop('headers', {}), 'Accept-Encoding': 'identity'}
    current = url
    for _ in range(MAX_REDIRECTS + 1):
        assert_public_url(current, resolve)
        response = get(current, allow_redirects=False, stream=True, headers=headers, **kwargs)
        location = response.headers.get('location')
        if 300 <= response.status_code < 400 and location:
            response.close()  # a redirect's body is never read, so release its connection
            current = urljoin(current, location)
            continue
        return response
    raise UnsafeUrlError('The address redirected too many times.')


def read_capped(response, max_bytes: int, timeout: float = 30) -> bytes:
    """Reads a streamed body, giving up past `max_bytes` or after `timeout` seconds in total, however slowly it arrives."""
    deadline = time.monotonic() + timeout
    chunks, total = [], 0
    try:
        for chunk in response.iter_content(chunk_size=8192):
            total += len(chunk)
            if total > max_bytes:
                raise TooLargeError(f'Image too large (max {max_bytes // (1024 * 1024)}MB).')
            if time.monotonic() > deadline:
                raise UnsafeUrlError('The download took too long.')
            chunks.append(chunk)
    except (TooLargeError, UnsafeUrlError):
        response.close()
        raise
    return b''.join(chunks)
