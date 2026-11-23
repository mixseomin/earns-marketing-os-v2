#!/usr/bin/env python3
"""KHỬ MÉO ỐNG KÍNH ảnh so (Mapillary: camera_type perspective, camera_parameters [f, k1, k2] — mô hình OpenSfM):
ảnh góc rộng làm tường thẳng thành cong → phép chiếu kiểu lỗ kim (khop-camera.mjs, chieuanh.js) đặt lệch. Nắn về ảnh lỗ kim CÙNG tiêu cự f.

  python3 apps/castle/scripts/khu-meo.py [--lau <tên>]
Nắn cả hai sổ: <lâu>-anh.json (ảnh so, tai-mapillary.mjs) và <lâu>-anh-web.json (ảnh tim-anh.mjs tải — do-anh.mjs định vị; 24/11/2026: ảnh GoPro Torbau
k1 −0,135 trượt PnP vì chưa nắn). tim-anh.mjs tự gọi sau mỗi lượt tải.

Toạ độ chuẩn hoá theo cạnh dài: n = (u − W/2) / max(W, H). Lỗ kim: n = f · x (x = X/Z). Có méo: n_d = f · x · (1 + k1 r² + k2 r⁴), r² = x² + y².
Ảnh ra: từng điểm (lỗ kim) → x = n / f → điểm nguồn n_d (lưới 48 × 27 ô + Image.MESH). Ghi anh/<tên>-thang.jpg, đổi `tep`, ghi `khuMeo` vào <lâu>-anh.json.
"""
import json, sys, pathlib
from PIL import Image

LAU = sys.argv[sys.argv.index('--lau') + 1] if '--lau' in sys.argv else 'neuschwanstein'
GOC = pathlib.Path(__file__).resolve().parent.parent / 'public/du-lieu'


def nan_so(tep):
  if not tep.exists(): return
  ds = json.loads(tep.read_text()); doi = False
  for a in ds:
    ok = a.get('ongKinh') or {}
    if a.get('khongDung') or a.get('khuMeo') or ok.get('kieu') != 'perspective': continue
    f, k1, k2 = (ok.get('thamSo') or [0, 0, 0]) + [0, 0][: max(0, 3 - len(ok.get('thamSo') or []))]
    if not f or (abs(k1) < 1e-6 and abs(k2) < 1e-6): a['khuMeo'] = 'không méo'; doi = True; continue
    im = Image.open(GOC / a['tep']).convert('RGB'); W, H = im.size; S = max(W, H)
    def nguon(u, v):
        x, y = (u - W / 2) / S / f, (v - H / 2) / S / f; r2 = x * x + y * y; c = 1 + k1 * r2 + k2 * r2 * r2
        return (x * c * f * S + W / 2, y * c * f * S + H / 2)
    NX, NY = 48, 27; mesh = []
    for j in range(NY):
        for i in range(NX):
            u0, u1, v0, v1 = W * i / NX, W * (i + 1) / NX, H * j / NY, H * (j + 1) / NY
            mesh.append(((int(u0), int(v0), int(u1), int(v1)), (*nguon(u0, v0), *nguon(u0, v1), *nguon(u1, v1), *nguon(u1, v0))))
    ra = im.transform((W, H), Image.MESH, mesh, Image.BILINEAR)
    moi = a['tep'].replace('.jpg', '-thang.jpg'); ra.save(GOC / moi, quality=88)
    a['tepGoc'] = a['tep']; a['tep'] = moi; a['khuMeo'] = f'OpenSfM perspective f={f:.3f} k1={k1:.3f} k2={k2:.3f}'
    doi = True; print('nắn', moi)
  if doi: tep.write_text(json.dumps(ds, ensure_ascii=False, indent=1) + '\n')


for ten in ('anh', 'anh-web'): nan_so(GOC / f'{LAU}-{ten}.json')
