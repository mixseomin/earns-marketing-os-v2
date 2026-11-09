#!/usr/bin/env node
// CHỐNG QUAY VỀ BẢN CŨ cho góp ý etp2 (cùng khuôn scripts/check-etp-gop-y.mjs của etp, tệp riêng trong app vì etp2 tách khỏi apps/web 09/11/2026).
//   { card, tep (tính từ gốc repo), mot | co | cam: '<chuỗi>', vi: '<anh muốn gì>' }   mot = đúng một lần · co = phải có · cam = không được có
// Chạy: node apps/etp2/kiem-gop-y.mjs   (trước khi submit card /tasks-etp2)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const GOC = new URL('../..', import.meta.url).pathname;
const LUAT = [
  { card: 1553, tep: 'apps/etp2/src/lib/actions/etp-tay.ts', co: "chay(['lam-ethopex.py', ...lenh, '--luat', luat, '--ai', AI", vi: 'bật / tắt / bậc ngân sách tay đi đúng máy Nhà lam-ethopex.py' },
  { card: 1553, tep: 'apps/etp2/src/lib/actions/etp-tay.ts', co: "spawn('python3', ['nhan-ban.py', String(campId), '--tay', ...t, '--that'", vi: 'nhân bản tay đi đúng nhan-ban.py' },
  { card: 1553, tep: 'apps/etp2/src/components/etp-view.tsx', mot: 'function DieuKhienCamp({ c, lon, boDs, choDs, lsDk }', vi: 'bảng điều khiển camp (⚙ cạnh ngân sách) trên tab Camp' },
  { card: 1553, tep: 'apps/etp2/src/components/etp-view.tsx', co: "<DieuKhienCamp c={c} lon boDs=", vi: 'ngăn camp (điện thoại) có nút Điều khiển camp' },
  { card: 1553, tep: 'apps/etp2/src/components/etp-view.tsx', co: '<b>Ép (sửa tay là chính)</b>', vi: 'ưu tiên sửa tay: ô Ép bỏ chặn mềm' },
  { card: 1553, tep: 'apps/etp2/src/components/etp-view.tsx', co: "{ k: 'roas', ten: 'Camp ROAS'", vi: 'nhân bản ROAS có mô tả' },
  { card: 'cho-ap-0911', tep: 'apps/etp2/src/lib/actions/etp-tay.ts', co: "await ghiCho({ camp_id: campId, viec", vi: 'lệnh tay xong ghi ngay sổ chờ áp (anh 09/11/2026 show vết khi chưa áp)' },
  { card: 'cho-ap-0911', tep: 'apps/etp2/src/components/etp-view.tsx', mot: 'function DauCho({ ds }', vi: '⏳ cạnh ô ngân sách khi lệnh tay chưa vào kho' },
  { card: 'ls-0911', tep: 'apps/etp2/src/components/etp-view.tsx', co: "{ value: 'ls', label: '🕘 Lịch sử' }", vi: 'bảng điều khiển camp có tab Lịch sử thay đổi (anh 09/11/2026)' },
];

const loi = [];
for (const l of LUAT) {
  let s = '';
  try { s = readFileSync(join(GOC, l.tep), 'utf8'); } catch { loi.push(`#${l.card} ${l.vi} — không đọc được ${l.tep}`); continue; }
  const n = (x) => s.split(x).length - 1;
  if (l.mot && n(l.mot) !== 1) loi.push(`#${l.card} ${l.vi} — cần đúng 1 lần (đang ${n(l.mot)}): ${l.mot}`);
  if (l.co && !s.includes(l.co)) loi.push(`#${l.card} ${l.vi} — mất: ${l.co}`);
  if (l.cam && s.includes(l.cam)) loi.push(`#${l.card} ${l.vi} — dạng cũ quay lại: ${l.cam}`);
}
if (loi.length) { console.error(`✗ góp ý etp2 bị quay về bản cũ (${loi.length}):\n${loi.join('\n')}`); process.exit(1); }
console.log(`✓ kiem-gop-y etp2: ${LUAT.length} điều kiện giữ nguyên`);
