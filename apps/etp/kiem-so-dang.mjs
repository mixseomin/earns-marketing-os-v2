#!/usr/bin/env node
// LƯỚI SỔ DẠNG CREATIVE (anh 08/11/2026: "Sửa code để … làm cho đúng ngay từ đầu khi mở rộng những gì đang có để ko bị khai thừa ở nhiều nơi").
// Một nơi duy nhất: apps/web/src/lib/etp-dang.json (Python đọc qua apps/etp/so_dang.py, web import thẳng). Lưới này:
//   1. sổ hợp lệ: mã ngắn / mã dòng / nhãn không trùng, đủ trường;
//   2. CẤM bảng dạng tự khai: dòng mã nào nhắc ≥ 3 dạng khác nhau (chuỗi trong nháy, có dấu hoặc không dấu) ngoài sổ = khai lại → đỏ;
//   3. máy dòng phim (dong_phim.py TINH) chỉ dùng mã dòng có trong sổ; 4. mỗi mã dòng có mục form ở etp-dong.ts.
// Chạy: node apps/etp/kiem-so-dang.mjs · tự kiểm: --tu-kiem
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const GOC = join(import.meta.dirname, '..', '..');
const SO = 'apps/web/src/lib/etp-dang.json';
const QUET = ['apps/etp', 'apps/web/src', 'apps/cty/worker', 'apps/xuong-video/scripts/ethopex', 'apps/ethopex-ext'];
const DUOI = /\.(py|ts|tsx|mjs|mts|js)$/;
// dòng là CHÍNH SÁCH (cấu hình chọn vài dạng, vd dạng phải thử trước khi cất phim) chứ không phải bảng tra → ghi nhãn này trên chính dòng đó, kèm lý do
const MIEN = 'so-dang: chính sách';

export function docSo(txt = readFileSync(join(GOC, SO), 'utf8')) {
  const ds = JSON.parse(txt).dang, loi = [];
  for (const k of ['dang', 'ma', 'khong_dau', 'dong']) {
    const v = ds.map((x) => x[k]).filter((x) => x != null), trung = v.filter((x, i) => v.indexOf(x) !== i);
    if (trung.length) loi.push(`sổ dạng: ${k} trùng ${[...new Set(trung)].join(', ')}`);
  }
  for (const x of ds) for (const k of ['dang', 'ma', 'mau', 'khong_dau']) if (!x[k]) loi.push(`sổ dạng: mục ${JSON.stringify(x).slice(0, 60)} thiếu ${k}`);
  return { ds, loi };
}
export function demDang(dong, ds) {
  const co = new Set();
  for (const x of ds) for (const n of [x.dang, x.khong_dau]) if (dong.includes(`"${n}"`) || dong.includes(`'${n}'`)) co.add(x.dang);
  return co.size;
}
function* tep(d) {
  for (const t of readdirSync(d)) {
    if (t === 'node_modules' || t === '__pycache__' || t.startsWith('.')) continue;
    const p = join(d, t), s = statSync(p);
    if (s.isDirectory()) yield* tep(p); else if (DUOI.test(t)) yield p;
  }
}
export function quet(ds) {
  const loi = [];
  for (const g of QUET) for (const p of tep(join(GOC, g))) {
    const r = relative(GOC, p);
    readFileSync(p, 'utf8').split('\n').forEach((dong, i) => { if (dong.includes(MIEN)) return; const n = demDang(dong, ds); if (n >= 3) loi.push(`${r}:${i + 1} tự khai bảng dạng (${n} dạng) — đọc sổ ${SO} (Python: apps/etp/so_dang.py)`); });
  }
  const dp = readFileSync(join(GOC, 'apps/etp/dong_phim.py'), 'utf8'), ma = new Set(ds.map((x) => x.dong).filter(Boolean));
  const m = dp.match(/^TINH = \{([^\n]*)\}/m);
  if (!m) loi.push('apps/etp/dong_phim.py: không thấy dòng TINH = {…}');
  else for (const [, k] of m[1].matchAll(/"([A-Z]+)": \(/g)) if (!ma.has(k)) loi.push(`apps/etp/dong_phim.py TINH dùng mã dòng "${k}" không có trong sổ`);
  // mỗi mã dòng trong sổ phải có mục form chọn loại ở trang Sản xuất (etp-dong.ts LOAI: { ma: '<mã>' …})
  const form = readFileSync(join(GOC, 'apps/web/src/lib/actions/etp-dong.ts'), 'utf8');
  for (const k of ma) if (!form.includes(`{ ma: '${k}',`)) loi.push(`apps/web/src/lib/actions/etp-dong.ts LOAI thiếu mục form cho mã dòng "${k}" (sổ dạng có, form không)`);
  return loi;
}

if (process.argv.includes('--tu-kiem')) {
  const { ds } = docSo(), sai = [];
  if (demDang(`X = {"ke chuyen": "kể chuyện", "canh that": "cảnh thật", "anh tinh": "ảnh tĩnh"}`, ds) !== 3) sai.push('bảng 3 dạng không bị bắt');   // so-dang: chính sách (mẫu tự kiểm của chính lưới)
  if (demDang('# ghi: kể chuyện và cảnh thật, ảnh tĩnh', ds) !== 0) sai.push('câu chữ không nháy bị bắt oan');
  if (!docSo(JSON.stringify({ dang: [{ dang: 'a', ma: 'X', mau: '#0', khong_dau: 'a' }, { dang: 'b', ma: 'X', mau: '#0', khong_dau: 'b' }] })).loi.length) sai.push('mã trùng không bị bắt');
  if (sai.length) { console.error(sai.map((x) => `✗ tự kiểm: ${x}`).join('\n')); process.exit(1); }
  console.log('✓ kiem-so-dang tự kiểm: bắt bảng tự khai · không bắt câu chữ · bắt mã trùng');
} else if (import.meta.url === `file://${process.argv[1]}`) {
  const { ds, loi } = docSo(); loi.push(...quet(ds));
  if (loi.length) { console.error(loi.map((x) => `✗ ${x}`).join('\n')); process.exit(1); }
  console.log(`✓ sổ dạng: ${ds.length} dạng, không nơi nào tự khai lại`);
}
