#!/usr/bin/env python3
"""SFX MEASURE - render a sound deck and the 24 click noises in headless Chromium, and print their levels and spectra.

Usage:
  python3 tools/sfx_measure.py                                   # the 24 click noises alone: the level reference
  python3 tools/sfx_measure.py --mod ../src/sfx-radial-psy.js:RADIAL_PSY
                                                                 # a deck module (url relative to tools/, the export)
  python3 tools/sfx_measure.py --mod ...:X --bench --voices 32   # also the CPU benchmark
  python3 tools/sfx_measure.py --mod ...:X --wav DIR             # also write each sound as a mono 48 kHz WAV
  python3 tools/sfx_measure.py --json                            # the raw rows

Columns: peak dBFS, the loudest 50 ms RMS dBFS, length to -60 dBFS, spectral centroid, share of energy above 10 kHz,
pitch movement in semitones (first to last loud 20 ms frame), and the nearest other sound of the same set by the
12-band profile distance. It serves settle-hear on a free localhost port and stops its own server.
"""

import argparse
import functools
import http.server
import json
import math
import os
import socketserver
import struct
import threading

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def write_wav(path, chans, sr=48000):
    """Write a stereo 16-bit WAV, trimmed 20 ms after the last sample above -66 dBFS."""
    L, R = chans
    last = max((i for i in range(len(L)) if max(abs(L[i]), abs(R[i])) > 0.0005), default=0)
    n = min(len(L), last + int(0.02 * sr))
    q = lambda x: max(-32768, min(32767, int(round(x * 32767))))
    data = b''.join(struct.pack('<hh', q(L[i]), q(R[i])) for i in range(n))
    with open(path, 'wb') as f:
        f.write(b'RIFF' + struct.pack('<I', 36 + len(data)) + b'WAVEfmt ' + struct.pack('<IHHIIHH', 16, 1, 2, sr, sr * 4, 4, 16))
        f.write(b'data' + struct.pack('<I', len(data)) + data)


def dist(a, b):
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a['profile'], b['profile'])))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--mod', action='append', default=[], help='<url relative to tools/>:<export name>')
    ap.add_argument('--bench', action='store_true')
    ap.add_argument('--voices', type=int, default=32)
    ap.add_argument('--wav', help='write each deck sound as a WAV into this directory')
    ap.add_argument('--seeds', type=int, default=1, help='also render seeds 2..N and report the worst level over them')
    ap.add_argument('--decode', help='comma list of audio files (urls relative to tools/) to time decodeAudioData on')
    ap.add_argument('--json', action='store_true')
    args = ap.parse_args()

    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass

    handler = functools.partial(Quiet, directory=ROOT)
    q = f"?mods={','.join(args.mod)}&seeds={args.seeds}" + (f"&bench=1&voices={args.voices}" if args.bench else '') + (f"&decode={args.decode}" if args.decode else '')
    with socketserver.TCPServer(('127.0.0.1', 0), handler) as httpd:
        port = httpd.server_address[1]
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        with sync_playwright() as p:
            b = p.chromium.launch()
            page = b.new_page()
            errs = []
            page.on('pageerror', lambda e: errs.append(str(e)))
            page.goto(f'http://127.0.0.1:{port}/tools/sfx_measure.html{q}')
            try:
                page.wait_for_function('window.__result', timeout=300000)
            except Exception:
                raise SystemExit(f'no result; page errors: {errs}')
            res = page.evaluate('window.__result')
            if args.wav:
                os.makedirs(args.wav, exist_ok=True)
                for r in res['rows']:
                    if r['set'] != 'clicks':
                        write_wav(os.path.join(args.wav, f"{r['id']}.wav"), page.evaluate(f"window.__pcm({json.dumps(r['id'])})"))
            b.close()
        httpd.shutdown()
    rows = res['rows']
    for r in rows:
        same = [o for o in rows if o['set'] == r['set'] and o is not r]
        n = min(same, key=lambda o: dist(r, o)) if same else None
        r['nearest'] = n['id'] if n else ''
        r['nearestDist'] = round(dist(r, n), 2) if n else 0
    if args.json:
        print(json.dumps(res, indent=1))
        return
    print(f"{'id':30} {'peak':>7} {'rms50':>7} {'dur':>6} {'cent':>6} {'>10k':>7} {'pitch':>6}  nearest")
    for r in rows:
        print(f"{r['id'][:30]:30} {r['peakDb']:7.2f} {r['rms50Db']:7.2f} {r['dur']:6.3f} {r['centroid']:6d} {r['hfShare']:7.4f} {r['pitchSemis']:6.1f}  {r['nearest']} ({r['nearestDist']})")
    ref = [r for r in rows if r['set'] == 'clicks']
    deck = [r for r in rows if r['set'] != 'clicks']
    if deck and args.seeds > 1:
        print(f"\nWORST OVER SEEDS 1..{args.seeds}: peak {max(r['worstPeakDb'] for r in deck):.2f} dBFS, rms50 {max(r['worstRms50Db'] for r in deck):.2f} dBFS")
    print(f"\nCLICK REFERENCE: loudest peak {max(r['peakDb'] for r in ref):.2f} dBFS, loudest 50 ms RMS {max(r['rms50Db'] for r in ref):.2f} dBFS, "
          f"max >10k share {max(r['hfShare'] for r in ref):.4f}")
    if res.get('bench'):
        print('\nCPU (offline render of 4 s, real time is 4000 ms):')
        for x in res['bench']:
            print(f"  {x['id']:30} {x['voices']} voices: procedural {x['procMs']} ms, sample {x['sampleMs']} ms")
        pm = sorted(x['procMs'] for x in res['bench']); sm = sorted(x['sampleMs'] for x in res['bench'])
        print(f"  MEDIAN procedural {pm[len(pm) // 2]} ms (worst {pm[-1]}), sample {sm[len(sm) // 2]} ms, per 4000 ms of audio")
    if res.get('build'):
        b = sorted(x['buildUs'] for x in res['build'])
        print(f"\nGRAPH BUILD (main thread, one play): median {b[len(b) // 2]} us, worst {b[-1]} us")
    for x in res.get('decode') or []:
        print(f"DECODE {x['url']}: {x['bytes']} bytes, {x['decodeUs']} us per decodeAudioData")
    print('NEXT -> listen: --wav DIR, then open the files; npm test pins the caps')


if __name__ == '__main__':
    main()
