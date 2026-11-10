"""Downloading an address someone typed in must never reach this machine's own network.

Every hop (the first address and each redirect) must resolve only to public addresses. A name could in principle
resolve differently between this check and the connection; the check closes the direct and redirect routes, not that race.
"""
import ipaddress
import socket
from urllib.parse import urljoin, urlsplit

import requests

MAX_REDIRECTS = 5


class UnsafeUrlError(ValueError):
    """The address points at a private or internal network, or is not a plain http(s) address."""


def is_public_ip(address: str) -> bool:
    try:
        ip = ipaddress.ip_address(address)
    except ValueError:
        return False
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped is not None:
        ip = ip.ipv4_mapped
    # is_global is False for private, loopback, link-local (cloud metadata), carrier-grade NAT, multicast and reserved ranges
    return ip.is_global and not ip.is_multicast


def assert_public_url(url: str, resolve=socket.getaddrinfo) -> None:
    parts = urlsplit(url)
    if parts.scheme not in ('http', 'https'):
        raise UnsafeUrlError('Only http:// and https:// addresses can be downloaded.')
    if parts.username or parts.password or not parts.hostname:
        raise UnsafeUrlError('Addresses with a user name or password cannot be downloaded.')
    host = parts.hostname
    if host == 'localhost' or host.endswith('.localhost'):
        raise UnsafeUrlError('That address points to a private or internal network.')
    try:
        ipaddress.ip_address(host)
        addresses = [host]
    except ValueError:
        try:
            addresses = [info[4][0] for info in resolve(host, parts.port or (443 if parts.scheme == 'https' else 80))]
        except OSError as error:
            raise UnsafeUrlError(f'That address could not be resolved: {error}') from error
    if not addresses or any(not is_public_ip(address) for address in addresses):
        raise UnsafeUrlError('That address points to a private or internal network.')


def safe_get(url: str, resolve=socket.getaddrinfo, get=requests.get, **kwargs):
    """requests.get that refuses internal addresses on every redirect hop."""
    current = url
    for _ in range(MAX_REDIRECTS + 1):
        assert_public_url(current, resolve)
        response = get(current, allow_redirects=False, **kwargs)
        location = response.headers.get('location')
        if 300 <= response.status_code < 400 and location:
            current = urljoin(current, location)
            continue
        return response
    raise UnsafeUrlError('The address redirected too many times.')
