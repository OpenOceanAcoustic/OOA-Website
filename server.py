#!/usr/bin/env python3
"""Static preview server for the browser-side Bellhop2D WASM demo."""

from __future__ import annotations

import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent / "dist"


class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path: str) -> str:
        clean = path.split("?", 1)[0].split("#", 1)[0].lstrip("/") or "index.html"
        target = (ROOT / clean).resolve()
        if target != ROOT and ROOT not in target.parents:
            return str(ROOT / "__not_found__")
        return str(target)

    def end_headers(self) -> None:
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt: str, *args: object) -> None:
        print(f"[OOB Web] {self.address_string()} - {fmt % args}")


def main() -> None:
    if not (ROOT / "index.html").is_file():
        raise SystemExit("Missing dist/index.html; run `npm run build` first.")
    host = os.environ.get("OOB_WEB_HOST", "127.0.0.1")
    port = int(os.environ.get("OOB_WEB_PORT", "8000"))
    server = ThreadingHTTPServer((host, port), Handler)
    print(f"OOA-RayMode WASM lab: http://{host}:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
