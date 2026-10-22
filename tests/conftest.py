import socket
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

import pytest
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent


def _free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@pytest.fixture(scope="session")
def base_url():
    port = _free_port()
    proc = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1"],
        cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    url = f"http://127.0.0.1:{port}"
    for _ in range(50):
        try:
            urllib.request.urlopen(url, timeout=1)
            break
        except OSError:
            time.sleep(0.1)
    else:
        proc.kill()
        raise RuntimeError("http.server did not start")
    yield url
    proc.terminate()
    proc.wait(timeout=5)


@pytest.fixture(scope="session")
def browser():
    with sync_playwright() as p:
        b = p.chromium.launch(
            channel="msedge",
            headless=True,
            args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
        )
        yield b
        b.close()


@pytest.fixture
def page(browser, base_url):
    """Fresh page; records console errors, page errors and failed requests."""
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    pg = ctx.new_page()
    pg.base_url = base_url
    pg.console_errors = []
    pg.failed_requests = []
    pg.on("console", lambda m: m.type == "error" and pg.console_errors.append(m.text))
    pg.on("pageerror", lambda e: pg.console_errors.append(f"pageerror: {e}"))
    pg.on("requestfailed", lambda r: pg.failed_requests.append(f"{r.url} {r.failure}"))
    yield pg
    ctx.close()


def open_site(pg, suffix="", wait_ready=True):
    pg.goto(pg.base_url + "/" + suffix, wait_until="load")
    if wait_ready:
        pg.wait_for_function("window.__roll !== undefined", timeout=30000)
