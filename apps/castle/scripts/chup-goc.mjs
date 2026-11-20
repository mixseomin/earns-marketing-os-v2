#!/usr/bin/env node
// CHỤP MÔ HÌNH Ở BỘ GÓC CỐ ĐỊNH (20/11/2026) — ảnh trước / sau cho mọi lượt sửa khung (chiều cao, mái): cùng camera, chỉ lớp mô hình.
//   node apps/castle/scripts/chup-goc.mjs <thư mục ra> <nhãn: truoc | sau | …>      → <thư mục>/<góc>-<nhãn>.png
//   node apps/castle/scripts/chup-goc.mjs <thư mục ra> --ghep truoc sau              → <thư mục>/so-<góc>.jpg (trái: nhãn 1, phải: nhãn 2)
// tra-repo-ok: keo nội bộ (Playwright qua chung.mjs).
import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { doiSo, moTrang } from './chung.mjs';
const GOC_NHIN = { 'toan-canh-bac': [[-170, 90, 230], [0, 25, 0], 45], 'toan-canh-dong-nam': [[150, 85, -130], [10, 28, -5], 45], 'cong-torbau-ngoai': [[103.25, 24.26, -5.61], [11.66, 16.8, -22.2], 45],
  'torbau-tu-san-duoi': [[-2, 24, -6], [36, 27, -18], 55], 'palas-tu-san-tren': [[-6, 28.5, 1], [-34.7, 32, 13.8], 60], 'toan-canh-tay': [[-260, 70, -40], [-20, 35, 0], 40] };
const [RA, NHAN, A, B] = doiSo; if (!RA || !NHAN) { console.error('dùng: chup-goc.mjs <thư mục> <nhãn> | <thư mục> --ghep <nhãn 1> <nhãn 2>'); process.exit(1); }
mkdirSync(RA, { recursive: true });
if (NHAN === '--ghep') { const py = `
import sys
from PIL import Image, ImageDraw, ImageFont
RA, A, B = sys.argv[1:4]; f = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Unicode.ttf', 26)
for g in sys.argv[4:]:
    a, b = Image.open(f'{RA}/{g}-{A}.png').convert('RGB'), Image.open(f'{RA}/{g}-{B}.png').convert('RGB'); o = Image.new('RGB', (a.width + b.width + 12, a.height + 44), 'white'); o.paste(a, (0, 44)); o.paste(b, (a.width + 12, 44))
    d = ImageDraw.Draw(o); d.text((8, 6), f'{g} — {A.upper()}', fill='black', font=f); d.text((a.width + 20, 6), B.upper(), fill=(0, 110, 0), font=f); o.save(f'{RA}/so-{g}.jpg', quality=85); print(f'{RA}/so-{g}.jpg')
`; process.exit(spawnSync(join(homedir(), '.venvs/castle-khop/bin/python'), ['-c', py, RA, A, B, ...Object.keys(GOC_NHIN)], { stdio: 'inherit' }).status); }
const { pg, dong } = await moTrang({ anh3d: false, khung: { width: 1280, height: 800 } });
for (const [ten, [p, t, fov]] of Object.entries(GOC_NHIN)) {
  await pg.evaluate(([p, t, fov]) => { const n = window.__ns; for (const id of ['so', 'nut', 'hd', 'bd', 'nguon', 'goiY', 'khu']) { const e = document.getElementById(id); if (e) e.style.display = 'none'; }
    n.orbit.target.set(...t); n.camera.position.set(...p); n.camera.fov = fov; n.camera.updateProjectionMatrix(); n.orbit.update(); n.renderer.render(n.scene, n.camera); }, [p, t, fov]);
  await pg.waitForTimeout(700); await pg.screenshot({ path: join(RA, `${ten}-${NHAN}.png`) });
}
await dong(); console.log(`${Object.keys(GOC_NHIN).length} góc → ${RA} (${NHAN})`);
