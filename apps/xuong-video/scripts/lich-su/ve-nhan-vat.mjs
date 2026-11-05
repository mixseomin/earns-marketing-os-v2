#!/usr/bin/env node
// VẼ NHÂN VẬT HÀNG LOẠT cho mẫu Myths of the Zodiac + The Myth Behind (05/11/2026): đọc mục "ve" của mọi sổ chuyện la-so/than-thoai/*.json + la-so/than-thoai-sao/_ve.json → nhân vật / dáng nào chưa có PNG ở
// brand/astrolas/nhan-vat/<id>/<dáng>.png thì vẽ: box3 lich-su/kho-sinh.mts (ckey Nano Banana 2 ~110₫ / ảnh, phong cách brand/astrolas/nhan-vat/kho.json qua KHO_TEP)
// → kéo về iMac → shot-code/tach-lop.swift tách nền (Vision, 0đ) → PNG nền trong → pngquant nén (~60% nhẹ hơn). 4 nhân vật song song. In tiền thật.
//   node ve-nhan-vat.mjs [--xem]   (--xem: chỉ liệt kê việc + ước tiền, không vẽ)
import { execFileSync, spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOX, GOC_BOX } from './box3.mjs';

const DIR = dirname(fileURLToPath(import.meta.url)), NV = join(DIR, 'brand/astrolas/nhan-vat'), TT = join(DIR, 'la-so/than-thoai');
const viec = new Map();
for (const f of readdirSync(TT).filter((x) => x.endsWith('.json'))) for (const [id, v] of Object.entries(JSON.parse(readFileSync(join(TT, f), 'utf8')).ve ?? {})) {
  const thieu = [...new Set(['goc', ...v.dang])].filter((d) => !existsSync(join(NV, id, `${d}.png`)));
  if (thieu.length) viec.set(id, { ...v, thieu: [...new Set([...(viec.get(id)?.thieu ?? []), ...thieu])] });
}
// The Myth Behind: sổ nhân vật la-so/than-thoai-sao/_ve.json (tên → id; id đã có trong kho thì không có mo_ta)
const VE_SAO = join(DIR, 'la-so/than-thoai-sao/_ve.json');
if (existsSync(VE_SAO)) for (const v of Object.values(JSON.parse(readFileSync(VE_SAO, 'utf8')).ten)) if (v.mo_ta && !v.ve_sau) {
  const thieu = [...new Set(['goc', ...(v.dang ?? [])])].filter((d) => !existsSync(join(NV, v.id, `${d}.png`)));
  if (thieu.length && !viec.has(v.id)) viec.set(v.id, { loai: v.loai, mo_ta: v.mo_ta, dang: v.dang ?? [], thieu });
}
const soAnh = [...viec.values()].reduce((s, v) => s + v.thieu.length, 0);
console.log(`${viec.size} nhân vật · ${soAnh} ảnh · ước ~${soAnh * 111}₫`); for (const [id, v] of viec) console.log(`  ${id}: ${v.thieu.join(', ')}`);
if (process.argv.includes('--xem') || !viec.size) process.exit(0);
const chay = (id, v) => new Promise((ok) => {   // goc vẽ từ mô tả nếu chưa có; dáng sửa từ goc (giữ mặt / trang phục)
  const goc = existsSync(join(NV, id, 'goc.jpg')) ? null : `mota:${v.loai}:${v.mo_ta}`, ds = v.thieu.filter((d) => d !== 'goc');
  const lenh = goc ? `scripts/lich-su/kho-sinh.mts /opt/xv-nv/${id} ${JSON.stringify(goc)} ${['goc', ...ds].join(',')}` : null;
  if (!lenh) { console.log(`  ${id}: đã có goc.jpg — dáng thêm cần ảnh gốc trên R2, bỏ qua lượt này`); return ok(0); }
  const p = spawn('ssh', [BOX, `cd ${GOC_BOX} && set -a && . ../../.env.production && set +a && KHO_TEP=${GOC_BOX}/scripts/lich-su/brand/astrolas/nhan-vat/kho.json NODE_OPTIONS=--conditions=react-server timeout 900s ../../node_modules/.bin/tsx ${lenh}`]);
  let ra = ''; p.stdout.on('data', (d) => { ra += d; }); p.stderr.on('data', (d) => { ra += d; });
  p.on('close', () => { const vnd = Number(/tiền thật ~(\d+)₫/.exec(ra)?.[1] ?? 0); console.log(`  ${id}: ${ra.split('\n').filter((l) => /^[✓✗]/.test(l)).join(' ')} · ${vnd}₫`); ok(vnd); });
});
let tong = 0; const ds = [...viec.entries()];
for (let i = 0; i < ds.length; i += 4) tong += (await Promise.all(ds.slice(i, i + 4).map(([id, v]) => chay(id, v)))).reduce((a, b) => a + b, 0);
// kéo về + tách nền
for (const [id] of ds) {
  mkdirSync(join(NV, id), { recursive: true });
  try { execFileSync('scp', ['-q', `${BOX}:/opt/xv-nv/${id}/*.jpg`, join(NV, id)]); } catch { console.log(`✗ ${id}: không kéo được ảnh`); continue; }
  for (const f of readdirSync(join(NV, id)).filter((x) => x.endsWith('.jpg'))) {
    const d = f.replace(/\.jpg$/, ''), tam = join('/tmp', `tach-${id}-${d}`);
    if (existsSync(join(NV, id, `${d}.png`))) continue;
    try { execFileSync('swift', [join(DIR, '../shot-code/tach-lop.swift'), join(NV, id, f), tam], { stdio: 'ignore' }); const l = readdirSync(tam).find((x) => /^lop-.*\.png$/.test(x)); if (l) { copyFileSync(join(tam, l), join(NV, id, `${d}.png`));
      // nén PNG (pngquant, giữ nền trong) — 54 MB → 23 MB với bộ đầu; thiếu pngquant thì giữ bản gốc, báo một dòng
      try { execFileSync('pngquant', ['--quality=70-92', '--speed', '1', '--force', '--skip-if-larger', '--ext', '.png', join(NV, id, `${d}.png`)]); } catch (e) { if (e.code === 'ENOENT') console.log('⚠ chưa có pngquant (brew install pngquant) — PNG chưa nén'); } }
    else console.log(`✗ ${id}/${d}: tách nền không ra chủ thể`); }
    catch { console.log(`✗ ${id}/${d}: tách nền hỏng`); }
  }
}
console.log(`✓ xong · tiền thật ~${tong}₫`);
