"""Local launcher for the routine & residency dashboard.

Serves this folder on 127.0.0.1:8765 using only the Python standard library.
Use --no-browser to start without opening a browser window (for tests).
"""

from __future__ import annotations

import sys
import urllib.error
import urllib.request
import webbrowser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HOST = "127.0.0.1"
PORT = 8765
ROOT = Path(__file__).resolve().parent
URL = f"http://{HOST}:{PORT}/index.html"


def _utf8_console() -> None:
    # پیام‌های فارسی باید در هر کنسولی درست چاپ شوند:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass


class DashboardHandler(SimpleHTTPRequestHandler):
    # در حال توسعه، همیشه نسخهٔ تازه از صفحه بارگذاری شود:
    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def _server_already_running() -> bool:
    try:
        with urllib.request.urlopen(URL, timeout=2) as response:
            return response.status == 200
    except (urllib.error.URLError, TimeoutError, OSError):
        return False


def main() -> int:
    _utf8_console()
    no_browser = "--no-browser" in sys.argv[1:]
    handler = partial(DashboardHandler, directory=str(ROOT))

    try:
        server = ThreadingHTTPServer((HOST, PORT), handler)
    except OSError:
        if _server_already_running():
            print("داشبورد از قبل روی همین پورت در حال اجراست.")
            if not no_browser:
                webbrowser.open(URL)
            return 0
        print("پورت ۸۷۶۵ روی این دستگاه در دسترس نیست.")
        print("اگر پنجرهٔ سرور قبلی باز است، ابتدا آن را ببند و دوباره تلاش کن.")
        return 1

    print("سرور داشبورد روی آدرس زیر اجرا شد:")
    print(URL)
    print("برای توقف، همین پنجره را ببند یا کلیدهای Ctrl+C را بزن.")
    if not no_browser:
        webbrowser.open(URL)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    print("سرور متوقف شد.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
