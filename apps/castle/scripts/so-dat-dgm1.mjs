#!/usr/bin/env node
// SO MẶT ĐẤT MÔ HÌNH VỚI ĐỊA HÌNH CHÍNH THỨC (20/11/2026): lưới 2 m quanh lâu đài, matDat của cảnh ↔ DGM1 Bavaria (1 m) tại chỗ ĐẤT TRỐNG
// (DOM20 − DGM1 < 0,7 m: không cây, không nhà), đã trừ mốc độ cao của scripts/sua-theo-dom20.mjs. In lệch theo vùng + ghi du-lieu-goc/bayern/so-dat.json + ảnh.
//   node apps/castle/scripts/so-dat-dgm1.mjs [ảnh ra.png]
// tra-repo-ok: so dữ liệu riêng của cảnh với raster chính thức.
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { GOC, doiSo, moTrang } from './chung.mjs';
const BY = join(GOC, 'du-lieu-goc/bayern'), moc = JSON.parse(readFileSync(join(BY, 'so-chieu-cao.json'), 'utf8')).moc;
const { pg, dong } = await moTrang({ anh3d: false });
const K = await pg.evaluate(() => { const n = window.__ns, d = []; for (let x = -130; x <= 110; x += 2) for (let z = -90; z <= 70; z += 2) { const y = n.matDat(x, z); if (Number.isFinite(y)) d.push([x, z, +y.toFixed(2)]); } return { goc: n.GOC_Y, d }; }); await dong();
writeFileSync(join(BY, 'diem-dat.json'), JSON.stringify(K));
const py = `
import json, math, sys, numpy as np, tifffile
from PIL import Image
BY, moc = sys.argv[1], float(sys.argv[2]); dom = tifffile.imread(BY + '/dom20-32631_5268.tif'); dgm = tifffile.imread(BY + '/dgm1-631_5268.tif'); K = json.load(open(BY + '/diem-dat.json'))
sys.path.insert(0, BY + '/../../scripts'); from toa_do_bayern import EN, canh   # độ dời OSM → DOM20 đọc từ so-dom20.json
ra = []; im = Image.new('RGB', (121, 81), (40, 40, 40)); px = im.load()
for x, z, y in K['d']:
    E, N = EN(x, z); t = float(dgm[int(5269000 - N), int(E - 631000)]); o = float(np.median(dom[int((5269000 - N) / 0.2) - 2:int((5269000 - N) / 0.2) + 3, int((E - 631000) / 0.2) - 2:int((E - 631000) / 0.2) + 3]))
    if o - t > 0.7: continue                                   # cây / nhà
    l = (t - moc) - (y + K['goc']); ra.append([x, z, round(l, 2)]); v = max(-1, min(1, l / 8)); px[int((x + 130) / 2), int((z + 90) / 2)] = (int(255 * max(0, v)) + 60, 60, int(255 * max(0, -v)) + 60)
a = np.array(ra); print(f'{len(a)} điểm đất trống · DGM1 − mô hình: trung vị {np.median(a[:, 2]):+.1f} m · |lệch| ≤ 1 m: {(abs(a[:, 2]) <= 1).mean():.0%} · > 3 m: {(abs(a[:, 2]) > 3).mean():.0%}')
for ten, (x0, x1, z0, z1) in {'sân dưới (trong cổng)': (2, 26, -16, 0), 'sân trước cổng đông': (42, 62, -30, -4), 'sân trên': (-45, -8, -6, 16), 'sườn bắc': (-60, 40, 30, 60), 'sườn nam': (-60, 40, -80, -50)}.items():
    m = a[(a[:, 0] >= x0) & (a[:, 0] <= x1) & (a[:, 1] >= z0) & (a[:, 1] <= z1)]
    print(' ', ten.ljust(24), f'{len(m)} điểm', '—' if len(m) < 3 else f'DGM1 − mô hình: trung vị {np.median(m[:, 2]):+.1f} m (từ {m[:, 2].min():+.1f} tới {m[:, 2].max():+.1f})')
json.dump(ra, open(BY + '/so-dat.json', 'w'))
if len(sys.argv) > 3: im.resize((121 * 6, 81 * 6), Image.NEAREST).save(sys.argv[3]); print('ảnh (đỏ = mô hình thấp hơn thật, xanh = cao hơn):', sys.argv[3])
`;
process.exit(spawnSync(join(homedir(), '.venvs/castle-khop/bin/python'), ['-W', 'ignore', '-c', py, BY, String(moc), ...(doiSo[0] ? [doiSo[0]] : [])], { stdio: 'inherit' }).status);
