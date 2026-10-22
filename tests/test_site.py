import base64

import pytest

from conftest import open_site


def test_loads_without_errors(page):
    open_site(page)
    page.wait_for_timeout(1000)
    assert page.console_errors == []
    assert page.failed_requests == []


def test_canvas_not_blank(page):
    open_site(page)
    page.wait_for_timeout(1500)
    png = page.locator("#roll").screenshot()
    data_url = "data:image/png;base64," + base64.b64encode(png).decode()
    distinct = page.evaluate(
        """async (src) => {
          const img = new Image();
          img.src = src;
          await img.decode();
          const c = document.createElement("canvas");
          c.width = img.width; c.height = img.height;
          const g = c.getContext("2d");
          g.drawImage(img, 0, 0);
          const d = g.getImageData(0, 0, c.width, c.height).data;
          const seen = new Set();
          for (let i = 0; i < d.length; i += 4) seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
          return seen.size;
        }""",
        data_url,
    )
    assert distinct > 50, f"canvas looks blank/uniform ({distinct} distinct colors)"


def test_toggle_button(page):
    open_site(page)
    btn = page.locator("#toggleRoll")
    assert btn.inner_text() == "Unroll"
    assert page.evaluate("__roll.isOpen") is False
    btn.click()
    assert btn.inner_text() == "Roll it up"
    page.wait_for_function("__roll.length > 3", timeout=10000)
    btn.click()
    assert btn.inner_text() == "Unroll"
    page.wait_for_function("__roll.length < 0.5", timeout=10000)
    assert page.evaluate("__roll.isOpen") is False


def test_canvas_click_toggles(page):
    open_site(page)
    page.locator("#roll").click()
    assert page.evaluate("__roll.isOpen") is True
    assert page.locator("#toggleRoll").inner_text() == "Roll it up"
    page.wait_for_function("__roll.length > 3", timeout=10000)
    page.locator("#roll").click()
    assert page.evaluate("__roll.isOpen") is False
    page.wait_for_function("__roll.length < 0.5", timeout=10000)


def test_open_hash_starts_open(page):
    open_site(page, "#open")
    assert page.evaluate("__roll.isOpen") is True
    assert page.evaluate("__roll.length") > 3
    assert page.locator("#toggleRoll").inner_text() == "Roll it up"


def test_mouse_rotates_roll(page):
    open_site(page)
    w, h = 1440, 900
    page.mouse.move(w - 5, h / 2)
    page.wait_for_timeout(2500)
    right = page.evaluate("__roll.rotationY")
    page.mouse.move(5, h / 2)
    page.wait_for_timeout(2500)
    left = page.evaluate("__roll.rotationY")
    assert right - left > 0.5, f"right={right} left={left}"


def test_nav_anchors_resolve(page):
    open_site(page, wait_ready=False)
    hrefs = page.eval_on_selector_all(
        "nav a[href^='#']", "els => els.map(e => e.getAttribute('href'))"
    )
    targets = {h for h in hrefs if h != "#"}
    assert {"#bamboo", "#collection", "#story"} <= targets
    for h in targets:
        assert page.locator(f"section{h}").count() == 1, f"no section for {h}"


def test_newsletter_valid_email(page):
    open_site(page, wait_ready=False)
    page.locator("form input[type=email]").fill("reader@example.com")
    page.locator("form button[type=submit]").click()
    assert page.locator("p.thanks").is_visible()


@pytest.mark.parametrize("value", ["", "not-an-email", "a@"])
def test_newsletter_invalid_email(page, value):
    open_site(page, wait_ready=False)
    page.locator("form input[type=email]").fill(value)
    page.locator("form button[type=submit]").click()
    assert page.locator(".thanks").count() == 0


@pytest.mark.parametrize("size", [(390, 844), (768, 1024), (1440, 900)], ids=lambda s: f"{s[0]}x{s[1]}")
def test_no_horizontal_overflow(page, size):
    page.set_viewport_size({"width": size[0], "height": size[1]})
    open_site(page)
    page.wait_for_timeout(500)
    sw, iw = page.evaluate("[document.documentElement.scrollWidth, window.innerWidth]")
    assert sw <= iw, f"scrollWidth {sw} > innerWidth {iw}"


def test_open_state_no_overflow_mobile(page):
    page.set_viewport_size({"width": 390, "height": 844})
    open_site(page, "#open")
    page.wait_for_timeout(500)
    sw, iw = page.evaluate("[document.documentElement.scrollWidth, window.innerWidth]")
    assert sw <= iw


def test_all_resources_load(page):
    statuses = {}
    page.on("response", lambda r: statuses.__setitem__(r.url, r.status))
    open_site(page)
    page.wait_for_load_state("networkidle")
    refs = page.evaluate(
        """() => [
          ...document.querySelectorAll("img[src]"),
          ...document.querySelectorAll("script[src]"),
        ].map(e => e.src).concat(
          [...document.querySelectorAll("link[rel=stylesheet][href]")].map(e => e.href))"""
    )
    assert refs, "expected some referenced resources"
    for url in refs:
        assert url in statuses, f"never requested: {url}"
    bad = {u: s for u, s in statuses.items() if s >= 400}
    assert bad == {}
    # the Three.js module pulled in via the importmap must have loaded too
    assert any("three" in u and s < 400 for u, s in statuses.items())
