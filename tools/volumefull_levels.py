#!/usr/bin/env python3
"""THE FULL VOLUME - the master chain's ceiling: render tools/volumefull_levels.html in headless Chromium and print
the sample and true peak at the speakers, at the old fresh gain (0.64, level 0.8) and the new one (1.0, level 1.0).

Usage:
  python3 tools/volumefull_levels.py         # the table
  python3 tools/volumefull_levels.py --json  # the raw rows

It serves settle-hear on a free localhost port, waits for the OfflineAudioContext renders, prints, and stops its own
server. Exits 1 when any input up to full scale reaches 0 dB true peak at the speakers; the twice-full-scale rows are
printed as the chain's edge and do not gate. Needs python playwright with Chromium.
Lane VOLUMEFULL, 2026-10-09. The DJ's own levels at a gain: tools/djfx_levels.py --gain 1 and
tools/djoverdrive_levels.py --gain 1.
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
            page.goto(f'http://127.0.0.1:{port}/tools/volumefull_levels.html')
            page.wait_for_function('window.__result', timeout=120000)
            res = page.evaluate('window.__result')
            b.close()
        httpd.shutdown()
    if args.json:
        print(json.dumps(res, indent=1))
        return 0
    g0, g1 = (str(g) for g in res['gains'])
    print(f"{'input':52} {'gain ' + g0 + ' peak / true':>24} {'gain ' + g1 + ' peak / true':>24}")
    for r in res['rows']:
        a, b_ = r[g0], r[g1]
        print(f"{r['name']:52} {a['peakDb']:>9.2f} / {a['truePeakDb']:>6.2f} dB {b_['peakDb']:>12.2f} / {b_['truePeakDb']:>6.2f} dB")
    # the gate: every input up to full scale stays under 0 dB true peak at both gains. The twice-full-scale rows are
    # shown as the chain's edge and do not gate: no voice on the site reaches the master that hot
    worst = max(r[g]['truePeak'] for r in res['rows'] if r['scale'] <= 1 for g in (g0, g1))
    edge = max(r[g]['truePeak'] for r in res['rows'] if r['scale'] > 1 for g in (g0, g1))
    print(f"\nworst true peak at the speakers, inputs up to full scale: {worst} (full scale is 1.0) -> {'NO CLIP' if worst < 1 else 'CLIPS'}")
    print(f"the edge, inputs at twice full scale (not gated): {edge}")
    print('NEXT -> python3 tools/djfx_levels.py --gain 1  (THE DJ\'s own mix at the new fresh gain)')
    return 0 if worst < 1 else 1


if __name__ == '__main__':
    raise SystemExit(main())
