# Gilded Grove

Landing page for a boutique organic bamboo toilet paper brand, in forest green and gold.

The hero features an interactive 3D roll built with [Three.js](https://threejs.org/):

- **Move the mouse**: the roll turns to follow the cursor, and the hanging sheet sways with your movement.
- **Click the roll** (or the *Unroll* button): the paper unrolls sheet by sheet; click again to roll it back up.
- Open `index.html#open` to load the page already unrolled.

Static site with no build step. Serve the folder with any web server, e.g. `python -m http.server`.

## Running tests

Functional and regression tests use pytest + Playwright (Python) and drive the installed Microsoft Edge in headless mode. They need internet access (Three.js and fonts load from CDNs).

```
python -m pip install -r requirements-dev.txt
python -m pytest
```
