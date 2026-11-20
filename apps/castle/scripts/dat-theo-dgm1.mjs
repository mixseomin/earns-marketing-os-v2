#!/usr/bin/env node
// MẶT ĐẤT THEO ĐỊA HÌNH CHÍNH THỨC (20/11/2026) — thay số đo mặt đất trên ảnh 3D Google (<lâu>-nen.json "diem") bằng DGM1 (địa hình 1 m) / DOM20 (mặt trên 20 cm)
// của Bayerische Vermessungsverwaltung (CC BY 4.0, scripts/tai-bayern.sh). Lý do: so-dat-dgm1.mjs đo sân trước cổng đông trong mô hình thấp hơn thật 8,7 m, sân dưới
// 3,7 m (lưới Google bẹp quanh cổng) trong khi sân trên đúng (+0,7 m). Mỗi điểm [x, z] giữ nguyên, y mới = mặt chính thức tại (x + 7, z + 1) − mốc cảnh ↔ DHHN2016
// (mốc của scripts/sua-theo-dom20.mjs, du-lieu-goc/bayern/so-chieu-cao.json): chỗ đất trống (DOM20 − DGM1 < 0,7 m) lấy DOM20 (sân lát, bậc), còn lại lấy DGM1 (dưới cây / nhà).
// Neo sân (sua.json "<id sân>".neo_mat_dat) cũng lấy lại theo cùng nguồn.
//   node apps/castle/scripts/dat-theo-dgm1.mjs [--ghi]
// tra-repo-ok: đổi nguồn số đo của tệp dữ liệu riêng; đọc GeoTIFF bằng tifffile (venv đo ảnh).
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { GOC, du, doiSo } from './chung.mjs';
const BY = join(GOC, 'du-lieu-goc/bayern'), moc = JSON.parse(readFileSync(join(BY, 'so-chieu-cao.json'), 'utf8')).moc, NEN = JSON.parse(readFileSync(du('nen'), 'utf8')), SUA = JSON.parse(readFileSync(du('sua'), 'utf8'));
const neo = Object.entries(SUA).flatMap(([id, v]) => (v.neo_mat_dat || []).map((p, i) => [id, i, ...p]));
const py = `
import json, math, sys, numpy as np, tifffile
BY, moc, goc = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]); dom = tifffile.imread(BY + '/dom20-32631_5268.tif'); dgm = tifffile.imread(BY + '/dgm1-631_5268.tif'); P = json.load(sys.stdin)
E0, N0, g = 631637.44, 5268614.78, math.radians(1.7498 * math.sin(math.radians(47.5576))); c, s = math.cos(g), math.sin(g); ra = []
for x, z in P:
    n = -z; E = E0 + (c * (x + 7) - s * (n - 1)) * 0.99981; N = N0 + (s * (x + 7) + c * (n - 1)) * 0.99981; i, j = int((5269000 - N) / 0.2), int((E - 631000) / 0.2)
    if not (3 <= i < 4997 and 3 <= j < 4997): ra.append(None); continue
    t = float(dgm[int(5269000 - N), int(E - 631000)]); o = float(np.median(dom[i - 2:i + 3, j - 2:j + 3])); ra.append(round((o if o - t < 0.7 else t) - moc - goc, 2))
print(json.dumps(ra))
`;
const diem = [...NEN.diem.map((p) => [p[0], p[1]]), ...neo.map((p) => [p[2], p[3]])];
const r = spawnSync(join(homedir(), '.venvs/castle-khop/bin/python'), ['-W', 'ignore', '-c', py, BY, String(moc), String(NEN.goc)], { input: JSON.stringify(diem), encoding: 'utf8', maxBuffer: 256e6 }); if (r.status) { console.error(r.stderr); process.exit(1); }
const Y = JSON.parse(r.stdout.trim().split('\n').pop()), tv = (a) => { const b = [...a].sort((x, y) => x - y); return b[b.length >> 1]; }, l = NEN.diem.map((p, i) => (Y[i] == null ? null : Y[i] - p[2])).filter((v) => v != null);
console.log(`${NEN.diem.length} điểm mặt đất · chính thức − Google: trung vị ${tv(l).toFixed(1)} m · |lệch| ≤ 1 m: ${(l.filter((v) => Math.abs(v) <= 1).length / l.length * 100).toFixed(0)} % · > 3 m: ${(l.filter((v) => Math.abs(v) > 3).length / l.length * 100).toFixed(0)} % · mốc ${moc.toFixed(2)} m`);
for (const [k, [id, i, x, z, y]] of neo.entries()) console.log(`  neo sân ${id} [${x}, ${z}]: ${y} → ${Y[NEN.diem.length + k]}`);
if (doiSo.includes('--ghi')) {
  NEN.diem = NEN.diem.map((p, i) => (Y[i] == null ? p : [p[0], p[1], Y[i]])); NEN.nguon_dat = `diem: mặt đất theo DGM1 / DOM20 chính thức Bavaria (scripts/dat-theo-dgm1.mjs ${new Date().toISOString().slice(0, 10)}, mốc ${moc.toFixed(2)} m, dời +7 / +1 m); trước đó đo trên ảnh 3D Google`;
  writeFileSync(du('nen'), JSON.stringify(NEN) + '\n');
  for (const [k, [id, i]] of neo.entries()) if (Y[NEN.diem.length + k] != null) { SUA[id].neo_mat_dat[i][2] = Y[NEN.diem.length + k]; SUA[id].ly_do_dgm1 = `neo_mat_dat lấy lại theo DGM1 / DOM20 chính thức Bavaria (scripts/dat-theo-dgm1.mjs ${new Date().toISOString().slice(0, 10)}) — số cũ đo theo tia trên ảnh 3D Google (lưới bẹp quanh cổng)`; }
  writeFileSync(du('sua'), JSON.stringify(SUA, null, 1) + '\n'); console.log('đã ghi', du('nen'), '+ neo sân trong', du('sua'));
}
