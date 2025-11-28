"""Manuals converter for old Toyota Land Cruiser 200 Series HTML manuals.

This script is an adaptation of the user's local `convert.py`.
It lives inside the backend and converts legacy HTML files (and their local assets)
into modern standalone HTML pages that can be served as static manuals.

- Source root:   /app/backend/uploads/manuals_raw
- Output root:   /app/backend/uploads/manuals_converted
- Assets folder: /app/backend/uploads/manuals_converted/assets

For now this module is intended to be run manually from within the container:

    python -m manuals_converter

Later we can wrap some of its functionality behind FastAPI endpoints if needed.
"""

from __future__ import annotations

import shutil
from pathlib import Path
from urllib.parse import urlparse, unquote

from bs4 import BeautifulSoup


BACKEND_ROOT = Path(__file__).resolve().parent
UPLOADS_ROOT = BACKEND_ROOT / "uploads"
SRC_ROOT = UPLOADS_ROOT / "manuals_raw"
OUT_ROOT = UPLOADS_ROOT / "manuals_converted"
OUT_ASSETS_ROOT = OUT_ROOT / "assets"


def is_remote(url: str | None) -> bool:
    if not url:
        return False
    p = urlparse(url)
    return p.scheme in ("http", "https")


def ensure_dir(p: Path) -> None:
    if not p.exists():
        p.mkdir(parents=True, exist_ok=True)


def copy_asset(asset_path: Path, src_root: Path, out_assets_root: Path) -> str | None:
    """Copy asset to out_assets_root preserving relative path from src_root.

    Returns the new web path (starting with /assets/...), or None if copying failed.
    """

    try:
        asset_abs = asset_path.resolve()
    except Exception:  # noqa: BLE001
        return None

    try:
        rel = asset_abs.relative_to(src_root.resolve())
    except Exception:  # noqa: BLE001
        # If asset is outside src_root, flatten into assets/extern/<name>
        rel = Path("extern") / asset_abs.name

    dest = out_assets_root / rel
    ensure_dir(dest.parent)

    try:
        shutil.copy2(asset_abs, dest)
    except Exception:  # noqa: BLE001
        return None

    web_path = "/assets/" + str(rel).replace("\\", "/")
    return web_path


def process_file(html_file: Path, src_root: Path, out_root: Path, out_assets_root: Path) -> None:
    print(f"[manuals_converter] Processing: {html_file}")
    text = html_file.read_text(encoding="utf-8", errors="ignore")
    soup = BeautifulSoup(text, "html.parser")

    # Get <main> or <body> or whole html
    main = soup.find("main") or soup.find("body") or soup

    # Fix asset references: img[src], script[src], link[href]
    for img in main.find_all("img"):
        src = img.get("src")
        if not src or is_remote(src):
            continue
        src_unq = unquote(src.split("#")[0].split("?")[0])
        asset_path = (html_file.parent / src_unq).resolve()
        new_web = copy_asset(asset_path, src_root, out_assets_root)
        if new_web:
            img["src"] = new_web

    for script in main.find_all("script"):
        src = script.get("src")
        if not src or is_remote(src):
            continue
        src_unq = unquote(src.split("#")[0].split("?")[0])
        asset_path = (html_file.parent / src_unq).resolve()
        new_web = copy_asset(asset_path, src_root, out_assets_root)
        if new_web:
            script["src"] = new_web

    for link in main.find_all("link"):
        href = link.get("href")
        if not href or is_remote(href):
            continue
        href_unq = unquote(href.split("#")[0].split("?")[0])
        asset_path = (html_file.parent / href_unq).resolve()
        new_web = copy_asset(asset_path, src_root, out_assets_root)
        if new_web:
            link["href"] = new_web

    # Build output HTML (simple wrapper) – Arabic, RTL, neutral styling
    title_tag = soup.find("title")
    title = title_tag.text.strip() if title_tag else html_file.stem

    body_html = str(main)

    out_html = f"""<!doctype html>
<html lang=\"ar\" dir=\"rtl\">
  <head>
    <meta charset=\"utf-8\">
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">
    <title>{title}</title>
    <link href=\"https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css\" rel=\"stylesheet\">
    <link rel=\"stylesheet\" href=\"/static/manuals/styles.css\">
  </head>
  <body class=\"bg-light\">
    <nav class=\"navbar navbar-expand-lg navbar-dark bg-primary\">
      <div class=\"container-fluid\">
        <a class=\"navbar-brand\" href=\"#\">دليل تويوتا لاندكروزر 200</a>
      </div>
    </nav>
    <main class=\"container py-4\">
      <div class=\"card mb-4\"><div class=\"card-body\">{body_html}</div></div>
    </main>
    <footer class=\"bg-white py-3 border-top\">
      <div class=\"container small text-center text-muted\">© دليل تويوتا</div>
    </footer>
    <script src=\"https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js\"></script>
  </body>
</html>
"""

    rel_path = html_file.relative_to(src_root)
    out_file = out_root / rel_path
    ensure_dir(out_file.parent)
    out_file.write_text(out_html, encoding="utf-8")
    print(f"[manuals_converter] Wrote: {out_file}")


def run_conversion() -> None:
    """Entry point to convert all HTML manuals under SRC_ROOT."""

    if not SRC_ROOT.exists():
        print(f"[manuals_converter] Source root not found: {SRC_ROOT}")
        return

    ensure_dir(OUT_ROOT)
    ensure_dir(OUT_ASSETS_ROOT)

    html_files = list(SRC_ROOT.rglob("*.htm")) + list(SRC_ROOT.rglob("*.html"))
    print(f"[manuals_converter] Found {len(html_files)} HTML files under {SRC_ROOT}")

    for f in html_files:
        try:
            process_file(f, SRC_ROOT, OUT_ROOT, OUT_ASSETS_ROOT)
        except Exception as e:  # noqa: BLE001
            print("[manuals_converter] Error processing", f, e)


if __name__ == "__main__":
    run_conversion()
