#!/usr/bin/env python3
"""ANIMESFX - measure a sound deck offline: peak, loudness, length, brightness, top-end, pitch movement, likeness.

Usage:
  python3 tools/sfx_levels.py --clicks                       # the reference: clicks.js's 24 CLICK_NOISES
  python3 tools/sfx_levels.py --mod ../src/sfx-radial-hyper.js --exp RADIAL_HYPER
  python3 tools/sfx_levels.py --mod ... --exp ... --wav DIR   # also write one 16-bit WAV per sound, to audition
  python3 tools/sfx_levels.py ... --json                      # the raw rows

It serves settle-hear on a free localhost port, renders tools/sfx_render.html in headless Chromium (an
OfflineAudioContext per sound, straight into the destination, strength 1), measures the samples with numpy, prints a
table, and stops its own server. Columns:
  peak dBFS   the highest sample of either channel
  rms50 dBFS  the loudest 50 ms window of the mono mix (the loudness a listener hears at the hit)
  len s       from the first to the last sample above peak - 50 dB
  cent Hz     the energy-weighted spectral centroid over the sound
  hf>9k %     the share of energy above 9 kHz (the "harsh top end" measure)
  move oct    the centroid of the last third against the first third, in octaves (pitch or brightness movement)
  width       side energy over mid energy (stereo movement)
  near        the most similar other sound in the deck and the cosine likeness of their band-energy envelopes
              (16 log bands 60 Hz to Nyquist, any band holding no FFT bin skipped, x 12 time slices, mean-removed,
              plus 8 length slots; --legacy keeps the empty band, as the first version did)
Needs python playwright with Chromium, and numpy.
"""

import argparse
import base64
import functools
import http.server
import json
import os
import socketserver
import threading
import wave

import numpy as np
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEGACY = False


def render(query):
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass

    handler = functools.partial(Quiet, directory=ROOT)
    with socketserver.TCPServer(('127.0.0.1', 0), handler) as httpd:
        port = httpd.server_address[1]
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        with sync_playwright() as p:
            b = p.chromium.launch()
            page = b.new_page()
            errs = []
            page.on('pageerror', lambda e: errs.append(str(e)))
            page.goto(f'http://127.0.0.1:{port}/tools/sfx_render.html?{query}')
            try:
                page.wait_for_function('window.__result', timeout=180000)
            except Exception:
                raise SystemExit('render failed: ' + '; '.join(errs))
            res = page.evaluate('window.__result')
            b.close()
        httpd.shutdown()
    return res


def db(x):
    return 20 * np.log10(x) if x > 0 else -999.0


def features(sr, mono, side, peak):
    a = np.abs(mono)
    thr = peak * 10 ** (-50 / 20)
    idx = np.nonzero(a > thr)[0]
    if len(idx) == 0:
        return dict(peakDb=db(peak), rms50Db=-999, len=0, cent=0, hf=0, move=0, width=0, env=np.zeros(1))
    s0, s1 = idx[0], idx[-1] + 1
    x = mono[s0:s1]
    w = int(0.05 * sr)
    c = np.cumsum(np.concatenate([[0], x.astype(np.float64) ** 2]))
    if len(x) > w:
        rms50 = np.sqrt(np.max(c[w:] - c[:-w]) / w)
    else:
        rms50 = np.sqrt(c[-1] / max(1, len(x)))
    n = 1024
    hop = 256
    frames = []
    for i in range(0, max(1, len(x) - n), hop):
        seg = x[i:i + n]
        if len(seg) < n:
            seg = np.pad(seg, (0, n - len(seg)))
        frames.append(np.abs(np.fft.rfft(seg * np.hanning(n))) ** 2)
    S = np.array(frames) if frames else np.abs(np.fft.rfft(np.pad(x, (0, n - len(x))) * np.hanning(n)))[None] ** 2
    f = np.fft.rfftfreq(n, 1 / sr)
    tot = S.sum(axis=1) + 1e-20
    cents = (S * f).sum(axis=1) / tot
    cent = float((cents * tot).sum() / tot.sum())
    hf = float(S[:, f > 9000].sum() / tot.sum())
    k = max(1, len(cents) // 3)
    t0, t1 = tot[:k], tot[-k:]
    c0 = (cents[:k] * t0).sum() / t0.sum()
    c1 = (cents[-k:] * t1).sum() / t1.sum()
    move = float(np.log2(max(c1, 1) / max(c0, 1)))
    xs = side[s0:s1]
    width = float(np.sum(xs.astype(np.float64) ** 2) / (np.sum(x.astype(np.float64) ** 2) + 1e-20))
    # the likeness fingerprint: 16 log-spaced bands x 12 time slices of the active region, log energy
    edges = np.geomspace(60, sr / 2, 17)
    # a band with no FFT bin (band 0, 60 to 89 Hz, at 1024 frames and 48 kHz) adds a constant log10(1e-12) column every
    # sound shares; it inflated every likeness and made the measure level-dependent, so it is skipped unless --legacy
    masks = [(f >= edges[j]) & (f < edges[j + 1]) for j in range(16)]
    masks = [m for m in masks if LEGACY or m.any()]
    bands = np.stack([S[:, m].sum(axis=1) for m in masks], axis=1)
    sl = np.array_split(np.arange(len(bands)), 12)
    env = np.concatenate([np.log10(bands[s].mean(axis=0) + 1e-12) if len(s) else np.full(bands.shape[1], -12) for s in sl])
    env = env - env.mean()
    # length matters too: append the length as a few coarse slots so a long and a short sweep differ
    env = np.concatenate([env, np.full(8, (s1 - s0) / sr * 4)])
    return dict(peakDb=db(peak), rms50Db=db(rms50), len=(s1 - s0) / sr, cent=cent, hf=hf, move=move, width=width, env=env)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--clicks', action='store_true', help='measure the reference, clicks.js CLICK_NOISES')
    ap.add_argument('--mod', help='the deck module, a path from tools/ (e.g. ../src/sfx-radial-hyper.js)')
    ap.add_argument('--exp', help='the export name of the deck array')
    ap.add_argument('--strength', type=float, default=1.0)
    ap.add_argument('--seed', type=int, default=1)
    ap.add_argument('--wav', help='write one WAV per sound into this directory')
    ap.add_argument('--json', action='store_true', help='print the raw rows')
    ap.add_argument('--legacy', action='store_true', help='the first likeness print, which keeps the empty 60-89 Hz band')
    args = ap.parse_args()
    global LEGACY
    LEGACY = args.legacy
    if args.clicks:
        q = f'kind=clicks&mod=../src/clicks.js&exp=CLICK_NOISES&strength={args.strength}'
    elif args.mod and args.exp:
        q = f'kind=deck&mod={args.mod}&exp={args.exp}&strength={args.strength}&seed={args.seed}'
    else:
        raise SystemExit('give --clicks, or --mod and --exp')
    res = render(q)
    sr = res['sr']
    rows = []
    for r in res['rows']:
        mono = np.frombuffer(base64.b64decode(r['mono']), dtype=np.float32)
        side = np.frombuffer(base64.b64decode(r['side']), dtype=np.float32)
        ft = features(sr, mono, side, r['peak'])
        rows.append(dict(id=r['id'], name=r['name'], kind=r['kind'], dur=r['dur'], err=r['err'], mono=mono, side=side, **ft))
        if args.wav:
            os.makedirs(args.wav, exist_ok=True)
            st = np.stack([mono + side, mono - side], axis=1)
            pcm = (np.clip(st, -1, 1) * 32767).astype('<i2')
            with wave.open(os.path.join(args.wav, f"{r['id']}.wav".replace(' ', '-')), 'wb') as wv:
                wv.setnchannels(2)
                wv.setsampwidth(2)
                wv.setframerate(sr)
                wv.writeframes(pcm.tobytes())
    E = np.array([r['env'] for r in rows])
    En = E / (np.linalg.norm(E, axis=1, keepdims=True) + 1e-12)
    sim = En @ En.T
    np.fill_diagonal(sim, -1)
    for i, r in enumerate(rows):
        j = int(np.argmax(sim[i]))
        r['near'] = rows[j]['id']
        r['likeness'] = float(sim[i, j])
    if args.json:
        print(json.dumps([{k: v for k, v in r.items() if k not in ('mono', 'side', 'env')} for r in rows], indent=1))
        return
    print(f"{'id':30} {'peak':>7} {'rms50':>7} {'len s':>6} {'cent Hz':>8} {'hf>9k%':>7} {'move':>6} {'width':>6}  near (likeness)")
    for r in rows:
        e = '  ERROR ' + r['err'].splitlines()[0] if r['err'] else ''
        print(f"{r['id'][:30]:30} {r['peakDb']:7.1f} {r['rms50Db']:7.1f} {r['len']:6.3f} {r['cent']:8.0f} {100 * r['hf']:7.2f} {r['move']:6.2f} {r['width']:6.3f}  {r['near'][:22]} ({r['likeness']:.3f}){e}")
    pk = max(r['peakDb'] for r in rows)
    rm = max(r['rms50Db'] for r in rows)
    print(f"\nloudest peak {pk:.1f} dBFS, loudest rms50 {rm:.1f} dBFS, longest {max(r['len'] for r in rows):.3f} s, "
          f"worst top end {100 * max(r['hf'] for r in rows):.2f}% above 9 kHz, most alike pair {max(r['likeness'] for r in rows):.3f}")


if __name__ == '__main__':
    main()
