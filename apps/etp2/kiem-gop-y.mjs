#!/usr/bin/env node
// CHỐNG QUAY VỀ BẢN CŨ cho góp ý etp2 (cùng khuôn scripts/check-etp-gop-y.mjs của etp, tệp riêng trong app vì etp2 tách khỏi apps/web 09/11/2026).
//   { card, tep (tính từ gốc repo), mot | co | cam: '<chuỗi>', vi: '<anh muốn gì>' }   mot = đúng một lần · co = phải có · cam = không được có
// Chạy: node apps/etp2/kiem-gop-y.mjs   (trước khi submit card /tasks-etp2)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const GOC = new URL('../..', import.meta.url).pathname;
const LUAT = [
  { card: 'ns-ngay-1011', tep: 'apps/etp2/src/components/etp-view.tsx', co: 'ns={[...nsCuoiNgay(c.ngan_sach, du.lsBac[c.camp_id], ngay6), c.ngan_sach]}', vi: 'ngăn camp: biểu đồ 7 ngày có vạch % ngân sách đã tiêu mỗi ngày (anh 10/11/2026)' },
  { card: 1553, tep: 'apps/etp2/src/lib/actions/etp-tay.ts', co: "chay(['lam-ethopex.py', ...lenh, '--luat', luat, '--ai', AI", vi: 'bật / tắt / bậc ngân sách tay đi đúng máy Nhà lam-ethopex.py' },
  { card: 1553, tep: 'apps/etp2/src/lib/actions/etp-tay.ts', co: "spawn('python3', ['nhan-ban.py', String(campId), '--tay', '--anh', ...t, '--that'", vi: 'nhân bản tay đi đúng nhan-ban.py' },
  { card: 1553, tep: 'apps/etp2/src/components/etp-view.tsx', mot: 'function DieuKhienCamp({ c, lon, boDs, choDs, lsDk }', vi: 'bảng điều khiển camp (⚙ cạnh ngân sách) trên tab Camp' },
  { card: 1553, tep: 'apps/etp2/src/components/etp-view.tsx', co: "<DieuKhienCamp c={c} lon boDs=", vi: 'ngăn camp (điện thoại) có nút Điều khiển camp' },
  { card: 1553, tep: 'apps/etp2/src/components/etp-view.tsx', co: '<b>Ép</b>{hd ?', vi: 'ưu tiên sửa tay: ô Ép bỏ chặn mềm (chữ giải thích gập sau ℹ — YDNI 09/11/2026)' },
  { card: 1553, tep: 'apps/etp2/src/components/etp-view.tsx', co: "{ k: 'roas', ten: 'Camp ROAS'", vi: 'nhân bản ROAS có mô tả' },
  { card: 'cho-ap-0911', tep: 'apps/etp2/src/lib/actions/etp-tay.ts', co: "await ghiCho({ camp_id: campId, viec", vi: 'lệnh tay xong ghi ngay sổ chờ áp (anh 09/11/2026 show vết khi chưa áp)' },
  { card: 'cho-ap-0911', tep: 'apps/etp2/src/components/etp-view.tsx', mot: 'function DauCho({ ds }', vi: '⏳ cạnh ô ngân sách khi lệnh tay chưa vào kho' },
  { card: 'ls-0911', tep: 'apps/etp2/src/components/etp-view.tsx', co: "{ value: 'ls', label: '🕘 Lịch sử' }", vi: 'bảng điều khiển camp có tab Lịch sử thay đổi (anh 09/11/2026)' },
  { card: 'nhanh-1011', tep: 'apps/xuong-video/scripts/ethopex/nhip_tang.py', co: 'if du and trong_nhanh(now): return None, None', vi: 'khung tăng nhanh 08–12h + 21–06h: đạt cổng thì tăng ngay, không chờ nhịp 24h/3h (anh 10/11/2026)' },
  { card: 'nhanh-1011', tep: 'apps/xuong-video/scripts/ethopex/luat-ethopex.py', co: 'or tb_ngay or tb_nhanh) and _ke and _ke <= _nap and not lo_nay: dat.append', vi: 'khung tăng nhanh: ROI hôm nay ≥ 100% + tiêu ≥ 50% vào danh sách tăng' },
  { card: 'nhanh-1011', tep: 'apps/web/src/lib/etp-bang-luat.json', co: '"nhanh": [[8, 12], [21, 6]]', vi: 'sổ luật chung có khung tăng nhanh' },
  { card: 'du-doan-1111', tep: 'apps/etp2/src/lib/etp-thi-truong.ts', co: 'export function doiChieu(', vi: 'nhật ký dự đoán ↔ thực tế trên widget Thị trường (anh 11/11/2026)' },
  { card: 'du-doan-1111', tep: 'apps/etp/du_doan_cpm.py', co: 'etp-mua.json', vi: 'máy chụp dự đoán đọc chung hệ số mùa với widget (một nguồn)' },
  { card: 'du-doan-1111', tep: 'apps/etp2/src/lib/etp-thi-truong.ts', co: "import SO_MUA from './etp-mua.json';", cam: 'const MUA: [string, string, number', vi: 'hệ số mùa không chép tay trong TS' },
  { card: 'du-doan-1111', tep: 'apps/etp/dong-bo.py', co: 'def cpm_nuoc(ngay):', vi: 'CPM theo nước ghi mỗi ngày' },
  { card: 'thi-truong-1111', tep: 'apps/etp2/src/lib/etp-widget.json', co: '"thi_truong"', vi: 'Tổng quan 2 có mẫu + widget Thị trường: lịch nhiệt CPM tháng, ngày chưa tới dự đoán (anh 11/11/2026)' },
  { card: 'thi-truong-1111', tep: 'apps/etp2/src/components/etp-tong2-widget.tsx', co: 'thi_truong: ({ rong, cao }) =>', vi: 'hàm vẽ widget Thị trường' },
  { card: 'thi-truong-1111', tep: 'apps/etp2/src/lib/etp-thi-truong.ts', co: 'export function saiSo(', vi: 'dự đoán kèm biên sai máy tự đo trên số thật, ngày lễ có nguồn / giả định ghi rõ, không đoán ROI (anh 11/11/2026 "thông tin đúng hơn")' },
  { card: 'tach-1011', tep: 'apps/etp2/src/lib/etp-widget.json', co: '"phan_tach"', vi: 'Tổng quan 2 có bố cục Breakdown theo bộ lọc (anh 10/11/2026)' },
  { card: 'tach-1011', tep: 'apps/etp2/src/components/etp-view.tsx', mot: 'function BangTach({ ds, so }', vi: 'widget breakdown dùng chung cho mọi ô lọc' },
  { card: 'tpl-1011', tep: 'apps/etp2/src/components/etp-tong2.tsx', co: 'rong="Bố cục tự sửa"', cam: 'rong="Bố cục đang dùng"', vi: 'ô Template ghi tên bố cục đang hiện, không ghi chung chung (anh 10/11/2026)' },
  { card: 'tach-1011', tep: 'apps/etp2/src/components/etp-view.tsx', co: 'BO_LOC.every(([kk, f]) => kk === k || f(c))', vi: 'mỗi widget breakdown tách trên tập camp qua mọi ô lọc TRỪ ô của chính nó' },
  { card: 'tu-van-1011', tep: 'apps/etp2/src/components/etp-view.tsx', co: "nen_lam: () => <NenLam ds={du.tuVan ?? []}", vi: 'Tổng quan 2 có widget Nên làm gì bây giờ (tư vấn sống theo người, anh 10/11/2026)' },
  { card: 'tu-van-1011', tep: 'apps/etp2/src/lib/etp-doc.ts', co: "from etp.tu_van where phien = 'song' and ${cuaNg(sql`nguoi_id`)}", vi: 'tư vấn đọc bản sống, người chỉ thấy bản của mình' },
  { card: 'mo-1011', tep: 'apps/xuong-video/scripts/ethopex/luat-ethopex.py', co: 'if _ts: ls[-1]["mo"] = _ts_mo(cid)', vi: 'thẻ tăng bị Siết TS chặn mang mốc sớm nhất thôi chặn (anh 10/11/2026 "show thời gian sẽ áp dụng sau bao lâu")' },
  { card: 'mo-1011', tep: 'apps/etp2/src/components/etp-view.tsx', co: 'gioThe(t.the, hoan, t.don)', vi: 'chip luật hiện ⏳ giờ máy làm — cùng hàm gioThe với bảng xét' },
  { card: 'mo-1011', tep: 'apps/etp2/src/components/etp-view.tsx', co: '{deXuat ? null : <GioThe l={l} don={!!don} chip />}', vi: 'MỌI thẻ Đạt / Gần có giờ áp dụng ở ô tên luật (anh 10/11/2026 "gắn thời gian vào đây") — dạng ⏳ gọn, giờ đủ ở chữ rê (#1558)' },
  { card: 1558, tep: 'apps/etp2/src/components/etp-view.tsx', co: '<GhiLuat t={l.ghi} />', cam: "{l.ghi ? <div style={{ ...KHONG_GIAN, color: '#fb923c', fontSize: 10.5 }}><ChuCamp t={l.ghi} /></div> : null}", vi: 'ô tên luật không in ghi chú dài — ℹ, rê mới hiện (anh 12/11/2026 YDNI)' },
  { card: 1555, tep: 'apps/etp2/src/components/etp-view.tsx', cam: "cr #{c.creative_id ?? '?'}</span>", vi: 'ô creative trên cây không in mã cr # — rê ô mới thấy (anh 10/11/2026)' },
  { card: 1556, tep: 'apps/etp2/src/components/etp-view.tsx', cam: '{p}% NS</span>', vi: 'Tổng quan 2: chỉ vạch % ngân sách, không in chữ % NS — rê mới hiện (anh 11/11/2026)' },
  { card: 'mo-1011', tep: 'apps/etp2/src/lib/etp-doc.ts', co: "interval '90 minutes'", cam: "from etp.xet_luat where luc > now() - interval '30 minutes'", vi: 'thẻ máy giữ 90 phút: nhịp máy luật dài không làm trang tự tính trái máy' },
  { card: 'tach-1011', tep: 'apps/etp2/src/components/etp-view.tsx', co: "(c) => (c.ban || c.giong ? [", vi: 'loại creative có dòng con theo biến thể (PO.1, ATT.KD…)' },
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
// SỔ LUẬT HAI BẢN (audit 10/11/2026: máy luật đọc apps/web, etp2 đọc bản chép — nap_chi 0.4 vs 0.5 lệch cả buổi, trang ghi cổng 50% trong khi máy dùng 40%)
if (readFileSync(join(GOC, 'apps/etp2/src/lib/etp-bang-luat.json'), 'utf8') !== readFileSync(join(GOC, 'apps/web/src/lib/etp-bang-luat.json'), 'utf8'))
  loi.push('sổ luật etp2 lệch sổ máy luật — chép lại: cp apps/web/src/lib/etp-bang-luat.json apps/etp2/src/lib/etp-bang-luat.json');
if (loi.length) { console.error(`✗ góp ý etp2 bị quay về bản cũ (${loi.length}):\n${loi.join('\n')}`); process.exit(1); }
console.log(`✓ kiem-gop-y etp2: ${LUAT.length} điều kiện giữ nguyên`);
