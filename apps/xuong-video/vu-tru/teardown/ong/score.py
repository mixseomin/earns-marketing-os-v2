"""Tiếng cho phim tour Mellis HB-7: nền hợp âm sáng (96 bpm) một mức suốt phim, tiếng vo vo cánh bám đúng ga cánh của film.js
(ga 0 thì im, ga 1 thì ù đều), click mỗi lần bấm nút, vút khi tách rời, lách cách từng phần khi lắp lại, một tiếng chạm
khi lắp xong. Mọi mốc đọc từ ../ong-film/timeline.json.

    python run_sfx.py <đường dẫn>/ong/score.py
"""

import math
import os

from sfx.score_kit import airy, bed, chords, hz, rattle, thud
from sfx.synth import SR, blip, click, pop, whoosh

TIMELINE = "../ong-film/timeline.json"
OUT = os.path.join(os.environ.get("TEARDOWN_OUT", "teardown-out"), "ong-score.wav")
TARGET_LUFS = -14.0
SEED = 7

CHORDS = chords("Amaj9:A1 E2 G#2 B2 C#3/A0", "F#m9:F#1 C#2 E2 G#2 A2/F#0", "Dmaj7:D2 A2 C#3 F#3/D1", "E6sus:E1 A1 B1 C#2 F#2/E0")
MOTIF = [(0.5, hz("E5")), (1.5, hz("C#5")), (2.5, hz("B4"))]


def smoother(x):
    u = min(1.0, max(0.0, x))
    return u * u * u * (u * (u * 6 - 15) + 10)


def wing_at(ev, t):
    """Ga cánh, chép đúng kênh 'wing' của film.js: thả → 1, tách rời → 0, thả lại → 1, mỗi lần chuyển 1,1 s."""
    v = 0.0
    for t0, target in ((ev["release"], 1.0), (ev["explode"], 0.0), (ev["hover"], 1.0)):
        v += (target - v) * smoother((t - t0) / 1.1)
    return v


def buzz(dur, ev):
    """Vo vo: âm cơ bản 150 Hz × ga cánh, hài răng cưa mềm, rung nhẹ theo nhịp đập cánh trên màn (7,5 Hz)."""
    n = int(dur * SR)
    out = [0.0] * n
    ph = 0.0
    wob = 0.0
    for k in range(n):
        t = k / SR
        u = wing_at(ev, t)
        if u < 0.003:
            continue
        f = 70 + 80 * u
        ph += 2 * math.pi * f / SR
        wob += 2 * math.pi * 7.5 * u / SR
        s = math.sin(ph) + 0.5 * math.sin(2 * ph) + 0.28 * math.sin(3 * ph) + 0.14 * math.sin(5 * ph)
        out[k] = s * (u ** 1.5) * (0.82 + 0.18 * math.sin(wob))
    return out


def score(mix, tl):
    dur = tl["duration"]
    ev = tl["events"]
    left, right, low, drums = bed(dur, 96, CHORDS, MOTIF, motif_voice="epiano", kicks=(0, 2.5), snares=(), hats=8, swing=0.0, keys_vel=0.65, keys_lp=3600)
    mix.put_stereo(0, left, right, 0.11)
    mix.put(0, low, 0.12)
    mix.put(0, drums, 0.04)

    mix.put(0, buzz(dur, ev), 0.05)

    for key in ("release", "head", "abdomen", "explode", "reassemble", "hover"):
        mix.put(ev[key], click(2600, 0.022), 0.06)
    # cất cánh: luồng khí phồng lên dưới cánh
    mix.put(ev["liftoff"] - 0.3, airy(2.2, 300, 900, 0.6), 0.03)
    # soi mắt: tiếng lấy nét
    mix.put(ev["head"] + 1.3, blip(1760, 0.25, 0.08), 0.03)
    mix.put(ev["head"] + 1.5, blip(2350, 0.25, 0.08), 0.025)
    # mở bụng: các đốt trượt ra
    mix.put(ev["abdomen"] + 0.1, whoosh(0.9, 500, 1400, 0.5), 0.035)
    mix.put(ev["abdomen"] + 0.6, pop(900, 300, 0.12), 0.04)
    # tách rời: vút ra, vít rơi lách cách
    mix.put(ev["explode"] + 0.05, whoosh(1.6, 250, 3200, 0.55), 0.06)
    mix.put(ev["explode"] + 0.3, rattle(1.4, rate=22, f=3400, seed=3, level=1.0), 0.02)
    # lắp lại: hút vào, mỗi phần một tiếng khớp, chạm cuối
    mix.put(ev["reassemble"], whoosh(1.5, 3000, 300, 0.5), 0.05)
    for i in range(9):
        mix.put(ev["reassemble"] + 1.25 + i * 0.07, click(1800 + 140 * i, 0.015), 0.035)
    mix.put(ev["reassemble"] + 2.05, thud(110, 0.06, 0.4), 0.07)
