#!/usr/bin/env python3
"""THE DJ'S DESK - offline levels: render tools/djfx_levels.html in headless Chromium and print peak and RMS.

Usage:
  python3 tools/djfx_levels.py            # a table: each mood and overdo, through the master chain and bus alone
  python3 tools/djfx_levels.py --json     # the raw rows

It serves settle-hear on a free localhost port (the page imports ../src/dj-fx.js as an ES module), waits for the
OfflineAudioContext renders, prints, and stops its own server. Needs python playwright with Chromium installed.
"""

import argparse
import functools
import http.server
import json
import os
import socketserver
import threading

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--json', action='store_true', help='print the raw rows')
    args = ap.parse_args()
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass

    handler = functools.partial(Quiet, directory=ROOT)
    with socketserver.TCPServer(('127.0.0.1', 0), handler) as httpd:
        port = httpd.server_address[1]
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        with sync_playwright() as p:
            b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
            page = b.new_page()
            page.goto(f'http://127.0.0.1:{port}/tools/djfx_levels.html')
            page.wait_for_function('window.__result', timeout=120000)
            rows = page.evaluate('window.__result')
            b.close()
        httpd.shutdown()
    if args.json:
        print(json.dumps(rows, indent=1))
        return
    print(f"{'case':42} {'master peak':>12} {'master RMS':>11} {'bus peak':>9} {'bus RMS':>8}")
    for r in rows:
        m, s = r['master'], r['bus']
        print(f"{r['name']:42} {m['peakDb']:>9.2f} dB {m['rmsDb']:>8.2f} dB {s['peakDb']:>6.2f} dB {s['rmsDb']:>5.2f} dB")
    worst = max(r['master']['peak'] for r in rows)
    print(f"\nworst peak through the master chain: {worst} (full scale is 1.0) -> {'NO CLIP' if worst < 1 else 'CLIPS'}")
    print('NEXT -> npm test  (tests/djfx.test.mjs pins the caps these levels rest on)')


if __name__ == '__main__':
    main()
