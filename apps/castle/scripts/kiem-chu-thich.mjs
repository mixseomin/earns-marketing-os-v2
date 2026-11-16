#!/usr/bin/env node
// CHÚ THÍCH // NUỐT MÃ: một lệnh thay chuỗi gắn "// chú thích" vào giữa dòng mã → phần mã phía sau thành chú thích. Hay gặp nhất khi sửa tệp
// bằng thay chuỗi (Edit / python replace) mà đoạn thay không kết thúc ở cuối dòng. node --check KHÔNG bắt được nếu phần bị nuốt vẫn đúng cú pháp
// (nan-google.mjs 16/11/2026: nuốt lệnh đặt camera + khung ảnh, công cụ chạy sai mà không báo lỗi). Đã xảy ra 4 lần trong một ngày.
// Dò: trong phần chú thích của mỗi dòng có MÃ thật (câu lệnh JS sau dấu ; / } như "; const x =", "); foo(", "} else {", "a.b = c;").
//   node apps/castle/scripts/kiem-chu-thich.mjs [thư mục / tệp…]   (mặc định apps/castle) — thoát 1 khi có dòng nghi
//   node apps/castle/scripts/kiem-chu-thich.mjs --tu-kiem          — mẫu hỏng thật phải bị bắt, chú thích thường không bị bắt
// Chạy SAU MỌI LẦN SỬA mã castle (QUY-TRINH.md §5) và trước khi commit.
// tra-repo-ok: lint nội bộ cho một lỗi thao tác cụ thể, eslint không có luật tương ứng.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// phần chú thích // của một dòng (bỏ // trong chuỗi '…' "…" `…` và URL http://)
export function chuThich(dong) {
  let q = null;
  for (let i = 0; i < dong.length; i++) {
    const c = dong[i];
    if (q) { if (c === '\\') { i++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '/' && dong[i + 1] === '/' && dong[i - 1] !== ':') return dong.slice(i + 2);
  }
  return null;
}
// mẫu MÃ trong chú thích: câu lệnh JS đứng sau ; hoặc }
const MA = [
  /;\s*(const|let|var|return|if|for|while|await|throw)\b\s*[\w$[{(]/,
  /;\s*[A-Za-z_$][\w$]*(\.[\w$]+|\[[^\]]+\])*\s*(=[^=>]|\+=|-=|\()/,
  /\)\s*;\s*[A-Za-z_$][\w$.]*\s*[(=]/,
  /}\s*(else|catch)\b\s*[{(]/,
  /\b(const|let)\s+[A-Za-z_$][\w$]*\s*=\s*[^=].*;/,
  /\)\s*;\s*}\s*$/,
];
export const coMa = (cmt) => MA.some((r) => r.test(cmt));

const MAU_HONG = [ // dòng hỏng thật đã gặp (rút gọn)
  "    const suong = n.scene.fog; suong.near = suong.far = 1e7; // tắt sương bằng đẩy xa n.scene.background = null; r.setClearColor(0xff00ff, 1); a3.goc.visible = true; r.setSize(w, h, false);",
  "      if (Math.max(d2(A, Bq), d2(Bq, C)) <= 2.25) { nho.push(A, Bq, C); continue; } // ≤ 1,5 m = ô lưới đất mịn const m = (p, q) => [(p[0] + q[0]) / 2], ab = m(A, Bq); tg.push([A, ab]); }",
  "  if (r) { kq[k.id] = r.cum; // bỏ khối lệch > 3 m console.log(`${k.id}`); }",
  "    for (const x of ds) { x.y = 1; // đỉnh trong nhà cũng đặt } else { x.y = 0; }",
  "    if (trongDa(x, z, v)) continue; // đỉnh trong nhà sát sân: góc ô mép trong.push(id(i, j)); if (!o) continue;",
];
const MAU_DUNG = [ // chú thích thường — không được bắt
  "  const a = 1; // độ cao 0,22 m; lưới 1,5 m chéo khác nội suy → đường 6 cm bị đất trùm (anh 16/11/2026)",
  "  x += 2; // xem scripts/kiem-ke.mjs; QUY-TRINH.md §3b",
  "  const y = f(); // tia bắt đầu trong vật → pháp tuyến 0, bỏ; gọi lại tiaN(p) sau",
  "  fetch('https://x.y/z'); // tải ảnh",
  "  // trước: hộp rời 2 m, có khe; sau: mẫu 1 m nối liền",
  "  return g; // dài a dọc cạnh (ux, uz), cao h, sâu d theo pháp tuyến",
];

if (process.argv.includes('--tu-kiem')) {
  let loi = 0;
  for (const d of MAU_HONG) if (!coMa(chuThich(d) ?? '')) { console.error('✗ bỏ sót mẫu hỏng:', d.slice(0, 90)); loi++; }
  for (const d of MAU_DUNG) if (coMa(chuThich(d) ?? '')) { console.error('✗ bắt oan chú thích thường:', d.slice(0, 90)); loi++; }
  console.log(loi ? `tự kiểm: ${loi} lỗi` : `tự kiểm: ${MAU_HONG.length} mẫu hỏng bị bắt, ${MAU_DUNG.length} mẫu thường không bị bắt`); process.exit(loi ? 1 : 0);
}

const GOC = join(dirname(fileURLToPath(import.meta.url)), '..');
const goc = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const ds = [], duyet = (p) => { const s = statSync(p); if (s.isDirectory()) { for (const f of readdirSync(p)) if (!['node_modules', 'vendor', 'du-lieu', 'tai-san'].includes(f) && !f.startsWith('.')) duyet(join(p, f)); } else if (['.js', '.mjs'].includes(extname(p)) && !/\.min\.js$/.test(p)) ds.push(p); };
for (const g of goc.length ? goc : [GOC]) duyet(g);
let n = 0;
// chỉ dòng có MÃ đứng trước // (dòng toàn chú thích không nuốt được gì — mô tả API có dấu = trong đó là bình thường)
for (const f of ds) readFileSync(f, 'utf8').split('\n').forEach((d, i) => { const c = chuThich(d); if (c && d.slice(0, d.length - c.length - 2).trim() && coMa(c)) { n++; console.log(`${f}:${i + 1}: mã nằm trong chú thích → //${c.slice(0, 110)}`); } });
console.log(n ? `✗ ${n} dòng có mã bị chú thích nuốt (${ds.length} tệp)` : `✓ không có chú thích nuốt mã (${ds.length} tệp)`); process.exit(n ? 1 : 0);
