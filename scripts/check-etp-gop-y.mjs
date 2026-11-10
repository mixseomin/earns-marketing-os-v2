#!/usr/bin/env node
/* LUẬT: góp ý etp đã sửa thì KHÔNG được quay về bản cũ.
 *
 * Vì sao có tệp này. 29/10/2026 con chuyển Camp › Cây sang DataTable và chép tay ô creative từ một
 * bản cũ — mất luôn "chỉ mã + điểm chấm + ×N" anh đã sửa ở #1465 / #1474. Anh phải tự phát hiện
 * (#1476) rồi hỏi: "lần sau tao không để ý mày lại khôi phục cái cũ thì sao?". Câu trả lời đúng
 * không phải một lời hứa mà là máy chặn: mỗi góp ý đã sửa ghi một ĐIỀU KIỆN ở đây; bản nào làm
 * điều kiện đó sai thì CI + deploy.sh dừng, bản đang chạy giữ nguyên.
 *
 * Cách thêm (bắt buộc với mọi card etp đã sửa — xem .claude/commands/tasks-etp.md): ghi vào apps/etp/gop-y-luat.mjs (danh sách nằm trong app etp từ 10/11/2026)
 *   { card: <id>, tep: <tệp>, mot | co | cam: '<chuỗi>', vi: '<anh muốn gì>' }
 *   mot = xuất hiện ĐÚNG một lần (một chỗ định nghĩa — chép thêm bản thứ hai là đỏ)
 *   co  = phải có · cam = không được có (dạng cũ anh đã bỏ)
 *
 * TẦM VỚI: đọc CHUỖI trong mã, không nhìn màn hình. Bắt được: chép lại khối cũ, xoá chỗ sửa, đẻ
 * bản thứ hai. Không bắt được: chỗ sửa còn nguyên nhưng bị một điều kiện luôn sai vô hiệu hoá.
 * `--tu-kiem` phá thử từng điều kiện (bỏ chuỗi / nhân đôi / chèn dạng cũ) — phải đỏ hết.
 */
import { readFileSync } from 'node:fs';

// danh sách điều kiện nằm trong app etp (apps/etp/gop-y-luat.mjs, anh 10/11/2026) — tệp này chỉ còn máy chấm
import { LUAT, V } from '../apps/etp/gop-y-luat.mjs';

const dem = (s, x) => s.split(x).length - 1;
const sai = (l, s) => (l.mot != null ? (dem(s, l.mot) === 1 ? null : `cần đúng 1 lần, đang ${dem(s, l.mot)}: ${l.mot}`)
  : l.co != null ? (s.includes(l.co) ? null : `mất: ${l.co}`)
  : s.includes(l.cam) ? `quay lại dạng cũ: ${l.cam}` : null);

if (process.argv.includes('--tu-kiem')) {
  let lot = 0;
  for (const l of LUAT) {
    const s = readFileSync(l.tep, 'utf8');
    const pha = l.mot != null ? [s.split(l.mot).join(''), s + l.mot] : l.co != null ? [s.split(l.co).join('')] : [s + l.cam];
    for (const x of pha) if (!sai(l, x)) { lot++; console.error(`✗ phá thử mà vẫn xanh: #${l.card} ${l.vi}`); }
    if (sai(l, s)) { lot++; console.error(`✗ bản hiện tại đã đỏ: #${l.card} ${l.vi}`); }
  }
  if (lot) process.exit(1);
  console.log(`✓ check-etp-gop-y tự kiểm: ${LUAT.length} điều kiện, phá thử đều đỏ`);
  process.exit(0);
}

const loi = [];
// SỔ LUẬT CHUNG phủ mọi danh sách máy luật xuất ra (đọc dòng ra_ = {...} của luat-ethopex.py)
{ const so = JSON.parse(readFileSync('apps/web/src/lib/etp-bang-luat.json', 'utf8')).khoa, src = readFileSync('apps/xuong-video/scripts/ethopex/luat-ethopex.py', 'utf8');
  const dong = src.split('\n').find((l) => l.trimStart().startsWith('ra_ = {"luc"')) ?? '';
  const khoa = [...dong.matchAll(/"([a-z0-9_]+)": m\(/g)].map((x) => x[1]);
  if (!khoa.length) loi.push('  #chat sổ luật chung — không đọc được dòng ra_ = {...} của luat-ethopex.py');
  for (const k of khoa) if (!so[k]) loi.push(`  #chat sổ luật chung thiếu khoá máy luật xuất ra: ${k} (thêm mục vào apps/web/src/lib/etp-bang-luat.json)`);
  for (const [k, v] of Object.entries(so)) if (v.nhat_ky) try { new RegExp(v.nhat_ky[1]); } catch { loi.push(`  #chat sổ luật chung: regex nhat_ky của ${k} hỏng`); } }
// SỔ WIDGET Tổng quan 2: mọi widget trong sổ có hàm vẽ (khoá trong ve={{...}} của <Tong2>), không hàm vẽ nào ngoài sổ, template chỉ dùng widget trong sổ
{ const so = JSON.parse(readFileSync('apps/web/src/lib/etp-widget.json', 'utf8')), v = readFileSync(V, 'utf8'), vs = readFileSync('apps/web/src/components/etp-tong2-widget.tsx', 'utf8');
  const ve = new Set([...(v.match(/<Tong2 [^\n]*/)?.[0] ?? '').matchAll(/([a-z0-9_]+): \(/g), ...vs.matchAll(/^    ([a-z0-9_]+): \(/gm)].map((x) => x[1]));
  for (const k of Object.keys(so.widget)) if (!ve.has(k)) loi.push(`  #chat sổ widget: ${k} chưa có hàm vẽ (ve của <Tong2> trong etp-view.tsx hoặc useVeSo trong etp-tong2-widget.tsx)`);
  for (const k of ve) if (!so.widget[k]) loi.push(`  #chat sổ widget: hàm vẽ ${k} không có trong apps/web/src/lib/etp-widget.json`);
  for (const [t, x] of Object.entries(so.template)) for (const o of x.o) if (!so.widget[o.ma]) loi.push(`  #chat template ${t} dùng widget ngoài sổ: ${o.ma}`); }
for (const l of LUAT) { const e = sai(l, readFileSync(l.tep, 'utf8')); if (e) loi.push(`  #${l.card || 'chat'} ${l.vi} — ${e}`); }
if (loi.length) {
  console.error(`✗ góp ý etp đã sửa bị quay về bản cũ (${loi.length}):\n${loi.join('\n')}\n  Sửa mã cho đúng lại — KHÔNG xoá điều kiện trong scripts/check-etp-gop-y.mjs trừ khi anh đổi ý.`);
  process.exit(1);
}
console.log(`✓ check-etp-gop-y: ${LUAT.length} điều kiện giữ nguyên`);
