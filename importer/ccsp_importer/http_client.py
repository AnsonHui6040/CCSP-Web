"""Thin requests wrapper that enforces our scraping etiquette."""
from __future__ import annotations

import logging
import time
from typing import Optional

import requests

from .config import REQUEST_DELAY_SEC, REQUEST_TIMEOUT_SEC, USER_AGENT

log = logging.getLogger(__name__)


class PoliteSession:
    """Single-host session with a configurable inter-request delay.

    Rationale: the THU course site is a small institutional service. We
    serialize and pace requests so we look like a single attentive reader.
    """

    def __init__(self, delay_sec: float = REQUEST_DELAY_SEC) -> None:
        self._delay = delay_sec
        self._last_request_at: Optional[float] = None
        self._session = requests.Session()
        self._session.headers.update(
            {"User-Agent": USER_AGENT, "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.5"}
        )

    def get(self, url: str, **kwargs) -> requests.Response:
        self._sleep_if_needed()
        log.info("GET %s", url)
        kwargs.setdefault("timeout", REQUEST_TIMEOUT_SEC)
        resp = self._session.get(url, **kwargs)
        self._last_request_at = time.monotonic()
        return resp

    def _sleep_if_needed(self) -> None:
        if self._last_request_at is None:
            return
        elapsed = time.monotonic() - self._last_request_at
        if elapsed < self._delay:
            time.sleep(self._delay - elapsed)
