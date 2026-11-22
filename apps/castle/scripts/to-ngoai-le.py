#!/usr/bin/env python3
"""TỜ DUYỆT NGOẠI LỆ cho scripts/do-anh.mjs (23/11/2026): ghép MỘT ảnh chỉ gồm các mặt máy KHÔNG GHI hoặc LỆCH tệp — mỗi mặt một hàng, mỗi ảnh chụp
một ô (ảnh soát đã vẽ khung ô cửa / dấu đếm: cua-<ảnh>-<k>.png, dem-<ảnh>-<k>.png; chưa có thì ảnh nắn mat-<ảnh>-<k>.png), nhãn = mặt + lý do.
Lý do: duyệt bằng mắt (người hoặc Claude) trước đây đọc cả bảng + mở từng ảnh soát → mỗi mặt nhiều lượt; giờ một tờ, chỉ chỗ cần quyết.
  python3 apps/castle/scripts/to-ngoai-le.py <thư mục nan> <ngoai-le.json> <ra.png>
tra-repo-ok: ghép ảnh bằng PIL cho tệp nội bộ."""
import json, sys, pathlib
from PIL import Image, ImageDraw, ImageFont
NAN, DS, RA = pathlib.Path(sys.argv[1]), json.load(open(sys.argv[2])), sys.argv[3]
G = {}   # một mặt lệch nhiều trường (số tầng + số cửa…) → một hàng, gộp lý do
for n in DS:
    k = (n['mat'], n['loai'])
    if k in G: G[k]['ly'] += ' · ' + n['ly']; G[k]['anh'] += [a for a in n['anh'] if a not in G[k]['anh']]
    else: G[k] = dict(n, anh=list(n['anh']))
DS = list(G.values())
O, NHAN = 260, 34; hang = []
try: F = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Unicode.ttf', 14)   # phông mặc định PIL không có dấu tiếng Việt
except Exception: F = ImageFont.load_default()
for n in DS:
    o = []
    for a in n['anh'][:4]:
        try: M = json.load(open(NAN / f'mat-{a}.json'))
        except Exception: continue
        k = next((i for i, m in enumerate(M) if f"{m['khoi']}#{m['canh']}" == n['mat']), None)
        if k is None: continue
        tep = next((NAN / f'{t}-{a}-{k}.png' for t in (n['loai'], 'cua', 'dem', 'mat') if (NAN / f'{t}-{a}-{k}.png').exists()), None)
        if tep: o.append((a, Image.open(tep).convert('RGB')))
    hang.append((n, o))
W = max(1, max(len(o) for _, o in hang)) * O; H = sum(NHAN + O for _ in hang); to = Image.new('RGB', (W, max(H, 1)), (24, 24, 28)); g = ImageDraw.Draw(to); y = 0
for n, o in hang:
    g.text((6, y + 4), f"{n['mat']} — {n['ly']}", fill=(255, 210, 80), font=F); y += NHAN
    for i, (a, im) in enumerate(o):
        im.thumbnail((O - 8, O - 20)); to.paste(im, (i * O + 4, y)); g.text((i * O + 4, y + O - 16), a[:40], fill=(200, 200, 200), font=F)
    if not o: g.text((6, y + 8), '(không có ảnh soát)', fill=(200, 120, 120), font=F)
    y += O
to.save(RA); print(RA)
