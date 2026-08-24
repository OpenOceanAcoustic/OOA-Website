#!/usr/bin/env python3
"""Web server for the native OpenOcean Bellhop teaching demo."""

from __future__ import annotations

import json
import os
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from oob_backend import OOBUnavailableError, precise_eigenrays, simulate


ROOT = Path(__file__).resolve().parent


class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path: str) -> str:
        clean = path.split("?", 1)[0].split("#", 1)[0].lstrip("/") or "index.html"
        target = (ROOT / clean).resolve()
        if target != ROOT and ROOT not in target.parents:
            return str(ROOT / "__not_found__")
        return str(target)

    def do_POST(self) -> None:  # noqa: N802
        if self.path not in {"/api/simulate", "/api/eigenrays"}:
            self.send_error(404)
            return
        try:
            length = min(int(self.headers.get("Content-Length", "0")), 65536)
            payload = json.loads(self.rfile.read(length) or b"{}")
            started = time.perf_counter()
            result = (
                precise_eigenrays(payload)
                if self.path == "/api/eigenrays"
                else simulate(payload)
            )
            result["compute_ms"] = round((time.perf_counter() - started) * 1000.0, 2)
            body = json.dumps(result, separators=(",", ":")).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
        except OOBUnavailableError as exc:
            self.send_error(503, str(exc))
        except (ValueError, TypeError, json.JSONDecodeError) as exc:
            self.send_error(400, str(exc))
        except Exception as exc:  # Native validation/runtime failure.
            self.send_error(500, f"OOB Bellhop2D 求解失败: {exc}")

    def log_message(self, fmt: str, *args: object) -> None:
        print(f"[OOB Web] {self.address_string()} - {fmt % args}")


def main() -> None:
    host = os.environ.get("OOB_WEB_HOST", "127.0.0.1")
    port = int(os.environ.get("OOB_WEB_PORT", "8000"))
    server = ThreadingHTTPServer((host, port), Handler)
    print(f"OpenOcean Bellhop lab: http://{host}:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
