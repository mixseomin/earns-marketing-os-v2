#!/usr/bin/env node
// CHỤP MÔ HÌNH ĐÚNG CAMERA CỦA TỪNG ẢNH ĐÃ ĐO (20/11/2026, anh: "nhớ chụp lại để xem hiệu quả thế nào ở các vị trí đã làm") — nửa "trước / sau" của scripts/do-anh.mjs.
//   node apps/castle/scripts/chup-do-anh.mjs <thư mục ra> truoc     chụp TRƯỚC khi ghi (chọn ảnh: mọi ảnh có số ĐẠT mà tệp cửa sổ chưa có; ghi ds.json)
//   node apps/castle/scripts/chup-do-anh.mjs <thư mục ra> sau       chụp SAU khi ghi (đúng danh sách ds.json) rồi ghép: ảnh gốc · trước · sau + các số đã ghi
// tra-repo-ok: keo nội bộ (Playwright qua chung.mjs + ghép ảnh bằng Pillow của venv đo ảnh).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { PUB, du, doiSo, moTrang } from './chung.mjs';
const [RA, LUOT] = doiSo; if (!RA || !['truoc', 'sau'].includes(LUOT)) { console.error('dùng: chup-do-anh.mjs <thư mục ra> truoc|sau'); process.exit(1); }
mkdirSync(RA, { recursive: true });
const so = JSON.parse(readFileSync(du('do-anh'), 'utf8')), CS = JSON.parse(readFileSync(du('cua-so'), 'utf8')), TEP_DS = join(RA, 'ds.json');
const nhan = (t) => t.split('/').pop().replace(/\.[a-z]+$/i, '').replace(/[^A-Za-z0-9_-]+/g, '-');
let ds;
if (LUOT === 'truoc') { ds = {};
  for (const [mat, d] of Object.entries(so.mat || {})) for (const [f, g] of Object.entries(d)) if (g && !g.khong_ghi && Number.isFinite(g.gia_tri) && CS[mat]?.[f] === undefined && so.anh[g.anh]?.camera) (ds[g.anh] ??= []).push(`${mat} ${f} = ${g.gia_tri}${g.nhip_m ? ` (nhịp ${g.nhip_m} m)` : ''} · tin ${g.tin}`);
  writeFileSync(TEP_DS, JSON.stringify(ds, null, 1));
} else ds = JSON.parse(readFileSync(TEP_DS, 'utf8'));
const anh = Object.keys(ds); console.log(`${LUOT}: ${anh.length} ảnh`); if (!anh.length) process.exit(0);
const { pg, dong } = await moTrang({ anh3d: false, khung: { width: 1400, height: 1000 } });
for (const t of anh) {
  const k = await pg.evaluate((ban) => { const n = window.__ns; n.ANH.push(ban); n.moSo(n.ANH.length - 1); for (const id of ['so-khung', 'so', 'nut', 'hd', 'bd', 'nguon', 'goiY']) { const e = document.getElementById(id); if (e) e.style.display = 'none'; }
    n.renderer.render(n.scene, n.camera); const r = n.renderer.domElement.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }, { tep: t, tieuDe: t, trang: '', tacGia: '', giayPhep: '', ...so.anh[t] });
  await pg.waitForTimeout(500); await pg.screenshot({ path: join(RA, `${nhan(t)}-${LUOT}.png`), clip: k });
}
await dong();
if (LUOT === 'sau') {
  const py = `
import json, sys
from PIL import Image, ImageDraw, ImageFont
RA, PUB = sys.argv[1], sys.argv[2]; ds = json.load(open(RA + '/ds.json')); so = json.load(open(sys.argv[3]))
f = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Unicode.ttf', 20); H = 640
import re
for t, dong in ds.items():
    n = re.sub(r'[^A-Za-z0-9_-]+', '-', re.sub(r'\\.[a-z]+$', '', t.split('/')[-1], flags=re.I))
    try: ims = [Image.open(PUB + '/du-lieu/' + t).convert('RGB'), Image.open(f'{RA}/{n}-truoc.png').convert('RGB'), Image.open(f'{RA}/{n}-sau.png').convert('RGB')]
    except Exception as e: print('bỏ', t, e); continue
    ims = [i.resize((max(1, int(i.width * H / i.height)), H)) for i in ims]; a = so['anh'].get(t, {})
    o = Image.new('RGB', (sum(i.width for i in ims) + 20, H + 44 + 26 * len(dong)), 'white'); g = ImageDraw.Draw(o); x = 0
    for i, ten in zip(ims, (f"Ảnh gốc: {t.split('/')[-1][:46]} ({a.get('tacGia', '?')[:24]}, {a.get('giayPhep', '?')})", 'TRƯỚC (mô hình, cùng camera)', 'SAU (máy đo, không AI)')):
        o.paste(i, (x, 36)); g.text((x + 4, 8), ten, fill='black', font=f); x += i.width + 10
    for k, d in enumerate(dong): g.text((6, H + 42 + 26 * k), '+ ' + d, fill=(0, 90, 0), font=f)
    o.save(f'{RA}/so-{n}.jpg', quality=86); print('ghép', f'{RA}/so-{n}.jpg')
`;
  spawnSync(join(homedir(), '.venvs/castle-khop/bin/python'), ['-c', py, RA, PUB, du('do-anh')], { stdio: 'inherit' });
}
