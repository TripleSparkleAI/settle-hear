#!/usr/bin/env python3
"""THE DJ's OVERDRIVE AND VOCODER - offline levels: render tools/djoverdrive_levels.html in headless Chromium and print peak and RMS.

Usage:
  python3 tools/djoverdrive_levels.py         # two tables: the bus (CLEAN against OVERDRIVE) and each voice coloured
  python3 tools/djoverdrive_levels.py --json  # the raw rows

It serves settle-hear on a free localhost port (the page imports ../src/dj-fx.js, dj-colour.js and instruments.js as
ES modules), waits for the OfflineAudioContext renders in headless Chromium, prints, and stops its own server. Exits
1 when a coloured voice is louder than its dry self or OVERDRIVE clips. Needs python playwright with Chromium.
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
            page.goto(f'http://127.0.0.1:{port}/tools/djoverdrive_levels.html')
            page.wait_for_function('window.__result', timeout=120000)
            rows = page.evaluate('window.__result')
            b.close()
        httpd.shutdown()
    if args.json:
        print(json.dumps(rows, indent=1))
        return 0
    print(f"{'bus case':38} {'master peak':>12} {'master RMS':>11} {'bus peak':>9} {'bus RMS':>8} valve")
    for r in rows['bus']:
        m, s_ = r['master'], r['bus']
        print(f"{r['name']:38} {m['peakDb']:>9.2f} dB {m['rmsDb']:>8.2f} dB {s_['peakDb']:>6.2f} dB {s_['rmsDb']:>5.2f} dB {'yes' if s_['tube'] else 'no'}")
    worst = max(r['master']['peak'] for r in rows['bus'])
    print(f"\nworst peak through the master chain: {worst} (full scale is 1.0) -> {'NO CLIP' if worst < 1 else 'CLIPS'}\n")
    print(f"{'voice':16} {'colour':34} {'RMS of dry':>10} {'peak of dry':>11}")
    for r in rows['voices']:
        print(f"{r['voice']:16} {r['plan']:34} {r['rmsShare']:>10.4f} {r['peakShare']:>11.4f}")
    wr = max(r['rmsShare'] for r in rows['voices'])
    wp = max(r['peakShare'] for r in rows['voices'])
    ok = wr <= 1 and wp <= 1 and worst < 1
    print(f"\nloudest coloured voice: RMS {wr:.4f} and peak {wp:.4f} of dry -> {'NEVER LOUDER' if ok else 'LOUDER THAN DRY'}")
    print('NEXT -> npm test  (tests/djoverdrive.test.mjs pins the same law in the offline renderer)')
    return 0 if ok else 1


if __name__ == '__main__':
    raise SystemExit(main())
