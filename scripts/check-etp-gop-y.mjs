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
import { spawnSync } from 'node:child_process';

// danh sách điều kiện nằm trong app etp (apps/etp/gop-y-luat.mjs, anh 10/11/2026) — tệp này chỉ còn máy chấm
import { LUAT as TAT_CA, V } from '../apps/etp/gop-y-luat.mjs';

// LUẬT TRÊN MÃ cty (apps/cty/… — máy Ethopex nằm trong worker cty) — cty tách repo riêng 18/11/2026 (github.com/mixseomin/cty). Luật vẫn MỘT chỗ ở đây,
// nhưng chấm ở đâu có mã thật: monorepo bỏ qua các luật apps/cty/*; GHA của repo cty chạy chính tệp này với --chi-cty + LUAT_GOC_CTY=<gốc repo cty>
// (đường apps/cty/x → <gốc cty>/x). Không bao giờ âm thầm bỏ: lượt monorepo in rõ số luật chuyển sang cty.
const CTY_PREFIX = 'apps/cty/', CHI_CTY = process.argv.includes('--chi-cty'), GOC_CTY = process.env.LUAT_GOC_CTY;
if (CHI_CTY && !GOC_CTY) { console.error('✗ --chi-cty cần LUAT_GOC_CTY=<gốc repo cty>'); process.exit(1); }
const laCty = (l) => l.tep.startsWith(CTY_PREFIX);
const LUAT = (CHI_CTY ? TAT_CA.filter(laCty) : TAT_CA.filter((l) => !laCty(l))).map((l) => (CHI_CTY ? { ...l, tep: `${GOC_CTY}/${l.tep.slice(CTY_PREFIX.length)}` } : l));
const SANG_CTY = CHI_CTY ? 0 : TAT_CA.length - LUAT.length;

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
  console.log(`✓ check-etp-gop-y tự kiểm${CHI_CTY ? ' (mã cty)' : ''}: ${LUAT.length} điều kiện, phá thử đều đỏ`);
  process.exit(0);
}

const loi = [];
if (!CHI_CTY) {   // hai sổ dưới nằm trong web / studio — chỉ monorepo chấm
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
// LƯỚI XUNG ĐỘT LUẬT TĂNG (việc #125 phần C, anh 19/11/2026): ma trận 180 ô máy luật / cổng / etp2 (+ worker khi có /opt/cty) — chạy mỗi lần máy chấm này chạy (GHA Kiểm tĩnh mỗi lần đẩy, deploy.sh)
{ const r = spawnSync('python3', ['apps/etp/kiem-xung-dot-luat.py'], { encoding: 'utf8', timeout: 180_000 });
  process.stdout.write(r.stdout || '');
  if (r.status !== 0) loi.push(`  #ra-xung-dot-luat-1911 lưới xung đột luật tăng đỏ:\n${(r.stdout || '').split('\n').filter((x) => x.startsWith('ĐỎ')).slice(0, 12).map((x) => `    ${x}`).join('\n')}\n    ${(r.stderr || r.error?.message || '').trim().slice(-400)}`); }
}
// BIẾN TẦNG NGOÀI ĐÈ HÀM (22/11/2026): luật RN gán ke = … đè hàm ke() → thẻ xét luật 'int' object is not callable trên 8 camp — gác cả lớp ở mọi máy Ethopex
if (!CHI_CTY) { const r = spawnSync('python3', ['apps/etp/kiem-de-ham.py'], { encoding: 'utf8', timeout: 60_000 });
  if (r.status !== 0) loi.push(`  #de-ham-2211 biến tầng ngoài đè hàm trong máy Ethopex:\n${(r.stdout || r.stderr || '').split('\n').filter(Boolean).slice(0, 12).map((x) => `    ${x}`).join('\n')}`); }
for (const l of LUAT) { const e = sai(l, readFileSync(l.tep, 'utf8')); if (e) loi.push(`  #${l.card || 'chat'} ${l.vi} — ${e}`); }
if (loi.length) {
  console.error(`✗ góp ý etp đã sửa bị quay về bản cũ (${loi.length}):\n${loi.join('\n')}\n  Sửa mã cho đúng lại — KHÔNG xoá điều kiện trong scripts/check-etp-gop-y.mjs trừ khi anh đổi ý.`);
  process.exit(1);
}
console.log(`✓ check-etp-gop-y${CHI_CTY ? ' (mã cty)' : ''}: ${LUAT.length} điều kiện giữ nguyên${SANG_CTY ? ` · ${SANG_CTY} điều kiện trên mã cty chấm ở GHA repo cty` : ''}`);
