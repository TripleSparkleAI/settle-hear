#!/usr/bin/env python3
"""THE PAGE CHIMES - offline levels in the browser: render tools/pagechime_levels.html in headless Chromium.

Usage:
  python3 tools/pagechime_levels.py            # the report: THE DJ's voices, the 50 chimes, the layered page sound
  python3 tools/pagechime_levels.py --trim     # the CHIME_TRIM_DB table that brings every chime to its target
  python3 tools/pagechime_levels.py --json     # the raw rows

It serves settle-hear on a free localhost port (the page imports ../src/pagechimes.js as an ES module), waits for the
OfflineAudioContext renders, prints, and stops its own server. Chromium is the instrument of record: the trim table in
src/pagechimes.js comes from --trim here. tools/pagechime_levels.mjs measures the same with tests/offline.mjs in node,
which the test suite runs. Needs python playwright with Chromium installed.
"""

import argparse
import functools
import http.server
import json
import math
import os
import socketserver
import threading

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MASTER_TARGET_DB = -40.0  # src/pagechime.js PAGE_CHIME.masterTargetDb
LEVEL = 0.55  # src/pagechime.js PAGE_CHIME.level


def render():
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
            errs = []
            page.on('pageerror', lambda e: errs.append(str(e)))
            page.goto(f'http://127.0.0.1:{port}/tools/pagechime_levels.html')
            try:
                page.wait_for_function('window.__result', timeout=300000)
            except Exception:
                raise SystemExit('render failed: ' + '; '.join(errs))
            res = page.evaluate('window.__result')
            b.close()
        httpd.shutdown()
    return res


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--json', action='store_true', help='print the raw rows')
    ap.add_argument('--trim', action='store_true', help='print the trim table')
    args = ap.parse_args()
    res = render()
    if args.json:
        print(json.dumps(res, indent=1))
        return
    if args.trim:
        target = MASTER_TARGET_DB - 20 * math.log10(LEVEL)
        print('export const CHIME_TRIM_DB = Object.freeze({')
        for r in res['raw']:
            print(f"  '{r['id']}': {target - r['peakDb']:.2f},")
        print('});')
        return
    print("THE DJ's symphony voices, one note each through its fader 0.55 (peak dBFS at the master input, Chromium):")
    for v in res['dj']:
        print(f"  {v['inst']:8} vel {v['vel']}  midi {v['midi']}  peak {v['peakDb']:7.2f}")
    quiet = min(res['dj'], key=lambda v: v['peakDb'])
    print(f"  quietest: {quiet['inst']} at {quiet['peakDb']:.2f} dBFS")
    print(f"\nTHE PAGE CHIMES as shipped, through the chime fader {LEVEL} (peak dBFS at the master input, Chromium):")
    for r in res['chimes']:
        print(f"  {r['id']:28} {r['family']:9} {r['masterDb']:7.2f}")
    lo = min(r['masterDb'] for r in res['chimes'])
    hi = max(r['masterDb'] for r in res['chimes'])
    print(f"  range {lo:.2f} .. {hi:.2f} dBFS; the loudest is {quiet['peakDb'] - hi:.2f} dB under THE DJ's quietest voice")
    lay = res['layered']
    w = lay['worst']
    print(f"\nLAYERED: the loudest chime ({lay['chime']}) 50 ms after each sword page card:")
    print(f"  worst card {w['id']}: alone {w['alone']:.2f}, with the chime {w['both']:.2f} dBFS")
    print(f"  the cap, the loudest click noise through the clicks' fader: {lay['capDb']:.2f} dBFS")
    print('NEXT -> npm test  (tests/pagechimes.test.mjs holds the node measure of the same)')


if __name__ == '__main__':
    main()
