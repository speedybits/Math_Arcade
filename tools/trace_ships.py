#!/usr/bin/env python3
"""Turn the squadron concept sheet into the SHIP_ART block in math_invaders_3d.html.

Each hull is traced into seven nested tone bands. The darkest band is the whole
silhouette and each lighter band sits inside the previous one, so the game can
repaint a single set of shapes in any squadron's colour just by swapping the
seven-step ramp it fills them with. Exhaust is not traced: the cyan plumes are
reduced to nozzle anchors and drawn procedurally in the game, which keeps their
soft falloff.

Two of the three ships are lit from one side in the source art, and their
shadowed halves cannot be separated from the nebula behind them. Both are
symmetric front-on craft, so each is rebuilt by mirroring its well-lit half.
The carrier is a three-quarter view and is traced whole.

Usage
-----
    pip install pillow numpy scikit-image potracer

    python3 tools/trace_ships.py            # print the SHIP_ART block
    python3 tools/trace_ships.py --write    # splice it into math_invaders_3d.html
    python3 tools/trace_ships.py --debug    # also dump mask PNGs next to the script

Retuning
--------
If the art is replaced, the per-ship entries in SHIPS below are what to adjust:

    box     crop around the hull in source pixels, extended far enough down to
            take in the exhaust plumes
    fg      seed rectangles, in crop-local pixels, that are definitely ship.
            The crop border is seeded as definitely background. Everything
            between the two is decided by a random-walker segmentation.
    vt, st  minimum value and saturation for a pixel to count as hull. Raise
            them if nebula bleeds in, lower them if the hull is being eaten.
    open    radius of a morphological opening that trims the ragged fringe left
            where the hull meets a dark background. Keep it small or zero on
            ships with thin parts - it will chew off gun tubes and antennae.
    mirror  rebuild the ship from its brighter half.

Run with --debug and look at the mask PNGs before trusting a retune.
"""

import argparse
import json
import os
import re
import sys
import warnings

warnings.filterwarnings('ignore')

import numpy as np
from PIL import Image
from skimage import color, measure, morphology, segmentation, transform
import potrace

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
SRC = os.path.join(HERE, 'ship_concept_sheet.png')
GAME = os.path.join(REPO, 'math_invaders_3d.html')

# Hull 0 is the battlecruiser, 1 the dreadnought, 2 the carrier - the order the
# game's HULL_ART list expects.
ORDER = ['battlecruiser', 'dreadnought', 'carrier']
KEY = {'battlecruiser': 'bc', 'dreadnought': 'dn', 'carrier': 'cr'}

SHIPS = {
    'battlecruiser': dict(
        box=(40, 70, 480, 610), vt=0.30, st=0.24, open=2, mirror=True,
        fg=[(190, 30, 240, 300), (150, 300, 290, 380),
            (60, 330, 150, 395), (300, 320, 390, 385)]),
    'carrier': dict(
        box=(455, 215, 945, 620), vt=0.30, st=0.24, open=0, mirror=False,
        fg=[(160, 80, 340, 150), (70, 135, 410, 195), (210, 55, 310, 105)]),
    'dreadnought': dict(
        box=(990, 90, 1375, 660), vt=0.22, st=0.18, open=1, mirror=True,
        fg=[(150, 20, 250, 380), (90, 150, 310, 300), (120, 350, 270, 430)]),
}

NBANDS = 7      # tone bands per hull
TARGET_H = 200  # trace at roughly the size the ship is shown at, not full res


def trace_bits(bits, turd=8, alphamax=0.75, opt=0.3):
    """Trace a boolean mask into a single SVG path string."""
    # potracer traces the FALSE region, so hand it the inverse.
    bmp = potrace.Bitmap(np.ascontiguousarray(~bits.astype(bool)))
    path = bmp.trace(turdsize=turd, alphamax=alphamax,
                     opticurve=True, opttolerance=opt)
    d = []
    for curve in path:
        sp = curve.start_point
        d.append('M%.1f %.1f' % (sp.x, sp.y))
        for seg in curve:
            if seg.is_corner:
                c, e = seg.c, seg.end_point
                d.append('L%.1f %.1fL%.1f %.1f' % (c.x, c.y, e.x, e.y))
            else:
                c1, c2, e = seg.c1, seg.c2, seg.end_point
                d.append('C%.1f %.1f %.1f %.1f %.1f %.1f'
                         % (c1.x, c1.y, c2.x, c2.y, e.x, e.y))
        d.append('Z')
    return ''.join(d)


def segment(arr, cfg):
    """Separate hull and exhaust from the nebula behind them."""
    h, w, _ = arr.shape
    mk = np.zeros((h, w), np.uint8)
    mk[:5, :] = 1; mk[-5:, :] = 1; mk[:, :5] = 1; mk[:, -5:] = 1
    for (x0, y0, x1, y1) in cfg['fg']:
        mk[max(0, y0):min(h, y1), max(0, x0):min(w, x1)] = 2
    rw = segmentation.random_walker(arr, mk, beta=250, mode='cg_j',
                                    channel_axis=-1) == 2

    hsv = color.rgb2hsv(arr)
    hue, sat, val = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    hull = (b > r * 1.06) & (val > cfg['vt']) & (sat > cfg['st']) \
        & (hue > 0.48) & (hue < 0.78)
    glow = (hue > 0.40) & (hue < 0.56) & (val > 0.55) & (g > r * 1.15)

    m = rw & hull & ~glow
    # Clean at full resolution so thin gun tubes survive: the opening kills the
    # ragged fringe where hull meets dark sky, the closing puts the tubes back.
    if cfg['open']:
        m = morphology.opening(m, morphology.disk(cfg['open']))
    m = morphology.closing(m, morphology.disk(5))
    m = morphology.remove_small_objects(m, 300)
    m = morphology.remove_small_holes(m, 60000)
    cc = measure.label(m)
    if cc.max():
        m = cc == max(measure.regionprops(cc), key=lambda p: p.area).label
    m = morphology.remove_small_holes(m, 60000)

    glow = morphology.remove_small_objects(glow, 150)
    glow = morphology.closing(glow, morphology.disk(3))
    glow = glow & ~m
    return m, glow, val


def mirror_halves(m, glow, val):
    """Rebuild a symmetric ship from whichever half is better lit."""
    cx = int(round(np.average(np.where(m)[1])))
    lv = val[:, :cx][m[:, :cx]].mean() if m[:, :cx].any() else 0
    rv = val[:, cx:][m[:, cx:]].mean() if m[:, cx:].any() else 0
    if rv >= lv:
        hm, hv, gh = m[:, cx:], val[:, cx:], glow[:, cx:]
    else:
        hm, hv, gh = (m[:, :cx][:, ::-1], val[:, :cx][:, ::-1],
                      glow[:, :cx][:, ::-1])
    m = np.concatenate([hm[:, ::-1], hm], axis=1)
    val = np.concatenate([hv[:, ::-1], hv], axis=1)
    glow = np.concatenate([gh[:, ::-1], gh], axis=1)
    ys, xs = np.where(m)
    rows = slice(ys.min(), ys.max() + 1)
    cols = slice(xs.min(), xs.max() + 1)
    return m[rows, cols], glow[:, cols], val[rows, cols]


def build(name, cfg, full, debug=False):
    crop = full.crop(cfg['box'])
    arr = np.asarray(crop).astype(np.float32) / 255.
    m, glow, val = segment(arr, cfg)

    ys, xs = np.where(m)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    # Keep enough rows below the hull for the plumes to live in.
    glow = glow[y0:min(glow.shape[0], y1 + int((y1 - y0) * 0.85)), x0:x1]
    m, val = m[y0:y1, x0:x1], val[y0:y1, x0:x1]
    if cfg['mirror']:
        m, glow, val = mirror_halves(m, glow, val)

    sc = TARGET_H / m.shape[0]
    nh, nw = int(round(m.shape[0] * sc)), int(round(m.shape[1] * sc))
    glow = transform.resize(glow.astype(float),
                            (int(round(glow.shape[0] * sc)), nw), order=1) > 0.5
    m = transform.resize(m.astype(float), (nh, nw), order=1) > 0.5
    val = transform.resize(val, (nh, nw), order=1)

    if debug:
        Image.fromarray((m * 255).astype(np.uint8)).save(
            os.path.join(HERE, 'debug-mask-%s.png' % name))

    # Equal-population tone bands, so no single tone swamps the ship.
    qs = np.quantile(val[m], [i / NBANDS for i in range(1, NBANDS)])
    bands = []
    for i in range(NBANDS):
        bits = m if i == 0 else (m & (val >= qs[i - 1]))
        bits = morphology.remove_small_objects(bits, 18)
        bits = morphology.remove_small_holes(bits, 24)
        if bits.sum() < 40:
            continue
        bands.append(trace_bits(bits))

    # Each exhaust blob becomes a nozzle anchor: where it starts, how wide and
    # how long. The plume itself is drawn in the game.
    engines = []
    if glow.any():
        for pr in measure.regionprops(
                measure.label(morphology.remove_small_objects(glow, 60))):
            r0, c0, r1, c1 = pr.bbox
            if (c1 - c0) < 3 or (r1 - r0) < 4:
                continue
            engines.append(dict(x=round((c0 + c1) / 2, 1), y=round(r0, 1),
                                w=round(c1 - c0, 1), l=round(r1 - r0, 1)))
        engines.sort(key=lambda e: e['x'])
    return dict(w=nw, h=nh, bands=bands, engines=engines)


def emit(art):
    parts = []
    for name in ORDER:
        s = art[name]
        vb = max([s['h']] + [e['y'] + e['l'] * 1.55 for e in s['engines']])
        eng = ','.join('{x:%g,y:%g,w:%g,l:%g}' % (e['x'], e['y'], e['w'], e['l'])
                       for e in s['engines'])
        bands = ',\n  '.join("'" + d + "'" for d in s['bands'])
        parts.append("  %s: { w: %d, h: %d, vb: %d, engines: [%s], bands: [\n  %s\n  ] }"
                     % (KEY[name], s['w'], s['h'], int(np.ceil(vb)), eng, bands))
    return ("/* Ship art traced from the squadron concept sheet: each hull is a stack of\n"
            "   nested tone bands, so one shape set repaints in any squadron colour.\n"
            "   Coordinates are in the hull's own space; `vb` leaves room for exhaust.\n"
            "   Regenerate with tools/trace_ships.py --write. */\n"
            "const SHIP_ART = {\n" + ",\n".join(parts) + "\n};\n")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--write', action='store_true',
                    help='splice the result into math_invaders_3d.html')
    ap.add_argument('--debug', action='store_true',
                    help='dump the mask for each ship as a PNG')
    args = ap.parse_args()

    if not os.path.exists(SRC):
        sys.exit('missing source art: %s' % SRC)
    full = Image.open(SRC).convert('RGB')

    art = {}
    for name in ORDER:
        art[name] = build(name, SHIPS[name], full, args.debug)
        s = art[name]
        print('%-14s %dx%d bands=%d engines=%d chars=%d'
              % (name, s['w'], s['h'], len(s['bands']), len(s['engines']),
                 sum(len(d) for d in s['bands'])), file=sys.stderr)

    block = emit(art)
    if not args.write:
        print(block)
        return

    src = open(GAME, encoding='utf-8').read()
    pat = re.compile(r'/\* Ship art traced from.*?\nconst SHIP_ART = \{.*?\n\};\n',
                     re.S)
    if not pat.search(src):
        sys.exit('could not find the SHIP_ART block in %s' % GAME)
    open(GAME, 'w', encoding='utf-8').write(pat.sub(lambda _: block, src, count=1))
    print('wrote SHIP_ART into %s' % GAME, file=sys.stderr)


if __name__ == '__main__':
    main()
