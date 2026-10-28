#!/usr/bin/env node
/* LUẬT: góp ý etp đã sửa thì KHÔNG được quay về bản cũ.
 *
 * Vì sao có tệp này. 29/10/2026 con chuyển Camp › Cây sang DataTable và chép tay ô creative từ một
 * bản cũ — mất luôn "chỉ mã + điểm chấm + ×N" anh đã sửa ở #1465 / #1474. Anh phải tự phát hiện
 * (#1476) rồi hỏi: "lần sau tao không để ý mày lại khôi phục cái cũ thì sao?". Câu trả lời đúng
 * không phải một lời hứa mà là máy chặn: mỗi góp ý đã sửa ghi một ĐIỀU KIỆN ở đây; bản nào làm
 * điều kiện đó sai thì CI + deploy.sh dừng, bản đang chạy giữ nguyên.
 *
 * Cách thêm (bắt buộc với mọi card etp đã sửa — xem .claude/commands/tasks-etp.md):
 *   { card: <id>, tep: <tệp>, mot | co | cam: '<chuỗi>', vi: '<anh muốn gì>' }
 *   mot = xuất hiện ĐÚNG một lần (một chỗ định nghĩa — chép thêm bản thứ hai là đỏ)
 *   co  = phải có · cam = không được có (dạng cũ anh đã bỏ)
 *
 * TẦM VỚI: đọc CHUỖI trong mã, không nhìn màn hình. Bắt được: chép lại khối cũ, xoá chỗ sửa, đẻ
 * bản thứ hai. Không bắt được: chỗ sửa còn nguyên nhưng bị một điều kiện luôn sai vô hiệu hoá.
 * `--tu-kiem` phá thử từng điều kiện (bỏ chuỗi / nhân đôi / chèn dạng cũ) — phải đỏ hết.
 */
import { readFileSync } from 'node:fs';

const V = 'apps/web/src/components/etp-view.tsx';
const LUAT = [
  // #1465 #1474 #1476 — ô creative: MỘT hàm dùng chung cho cây + bảng; mã + điểm chấm M/A + ×N; đoạn giây chỉ ở hover
  { card: 1476, tep: V, mot: 'const oCr = (c: CampEtpKho)', vi: 'ô creative chỉ một định nghĩa (oCr) cho cây và bảng' },
  { card: 1476, tep: V, mot: 'data-cot="creative"', vi: 'không có bản chép thứ hai của ô creative' },
  { card: 1465, tep: V, co: 'du.cham[c.creative_id]', vi: 'ô creative hiện điểm chấm Meta · AFS' },
  { card: 1474, tep: V, co: 'const n = giongHet(c)', vi: 'ô creative hiện ×N số lần nhân bản giống hệt' },
  { card: 1465, tep: V, cam: "cr #{c.creative_id ?? '?'} · {c.doan", vi: 'không in đoạn giây cạnh mã creative (dạng cũ)' },
  { card: 1476, tep: V, co: "width: 30, flex: 'none', textAlign: 'right' }}>${c.ngan_sach}", vi: '$ ngân sách camp ô 30px canh phải' },
  { card: 1476, tep: V, co: "display: 'inline-block', width: 30, textAlign: 'right'", vi: '$ tổng phim cùng ô 30px canh phải với $ camp' },
  // #1475 — tô dòng: vạch xanh chỉ ở ô đầu
  { card: 1475, tep: V, co: '.dang-noi>td:first-child{box-shadow', vi: 'vạch tô dòng chỉ ở ô đầu' },
  { card: 1475, tep: V, cam: '.dang-noi>td{background:var(--hover,rgba(255,255,255,.09))!important;box-shadow', vi: 'không đặt vạch lên mọi ô của dòng' },
  // 28–29/10/2026 — bộ lọc trang Camp (chat): Luật theo đúng thẻ đang hiện, Tuổi, Cây dùng DataTable
  { card: 0, tep: V, mot: 'const chipCamp = (du: DuLieuEtp', vi: 'thẻ luật và bộ lọc Luật cùng một nguồn' },
  { card: 0, tep: V, co: '.filter(hopLuat)', vi: 'bộ lọc Luật áp lên danh sách camp' },
  { card: 0, tep: V, co: '{laiSel()}{tuoiSel()}{luatSel()}', vi: 'ô lọc Tuổi trên thanh lọc' },
  { card: 0, tep: V, co: 'const bangCay = hep ? null : <DataTable', vi: 'Cây máy tính dùng DataTable (lọc từng cột)' },
];

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
for (const l of LUAT) { const e = sai(l, readFileSync(l.tep, 'utf8')); if (e) loi.push(`  #${l.card || 'chat'} ${l.vi} — ${e}`); }
if (loi.length) {
  console.error(`✗ góp ý etp đã sửa bị quay về bản cũ (${loi.length}):\n${loi.join('\n')}\n  Sửa mã cho đúng lại — KHÔNG xoá điều kiện trong scripts/check-etp-gop-y.mjs trừ khi anh đổi ý.`);
  process.exit(1);
}
console.log(`✓ check-etp-gop-y: ${LUAT.length} điều kiện giữ nguyên`);
