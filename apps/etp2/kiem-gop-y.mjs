#!/usr/bin/env node
// CHỐNG QUAY VỀ BẢN CŨ cho góp ý etp2 (cùng khuôn scripts/check-etp-gop-y.mjs của etp, tệp riêng trong app vì etp2 tách khỏi apps/web 09/11/2026).
//   { card, tep (tính từ gốc repo), mot | co | cam: '<chuỗi>', vi: '<anh muốn gì>' }   mot = đúng một lần · co = phải có · cam = không được có
// Chạy: node apps/etp2/kiem-gop-y.mjs   (trước khi submit card /tasks-etp2)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const GOC = new URL('../..', import.meta.url).pathname;
const LUAT = [
  { card: 'so-nho-1311', tep: 'apps/etp2/src/components/etp-view-khach.tsx', cam: 'caches.open(', vi: 'giữ số trong máy chỉ qua lib/so-nho, không dựng kho thứ hai (/audit 13/11/2026)' },
  { card: 'so-nho-1311', tep: 'apps/etp2/src/lib/so-nho.ts', cam: 'localStorage', vi: 'một kho Cache API duy nhất cho số giữ trong máy' },
  { card: 'so-nho-1311', tep: 'apps/etp2/src/components/etp-tong2-widget.tsx', co: "useSoNho<SoTong2>('tong2', taiTong2, 120_000)", vi: 'widget Người / Tài khoản hiện ngay bản lần trước, không đứng "đang tải số…" (anh 13/11/2026 ảnh iPhone)' },
  { card: 'so-nho-1311', tep: 'apps/etp2/src/components/etp-insight.tsx', co: "useSoNho<DuInsight>('insight', docInsight)", vi: 'tab Insight hiện ngay bản lần trước' },
  { card: 'so-nho-1311', tep: 'apps/etp2/src/components/etp-tong2.tsx', co: "void docNho('bocuc').then(", vi: 'bố cục Tổng quan vẽ ngay từ bản giữ trong máy' },
  { card: 'du-may-1311', tep: 'apps/etp2/src/components/etp-view-khach.tsx', cam: 'Số liệu mới chưa tải được ({loi}) — đang hiện bản trước. <button', vi: 'trạng thái số liệu là nút tròn nhỏ góc dưới, không chiếm dòng (anh 13/11/2026 "Chỉ cần hiện gọn nút refresh. Tốn diện tích quá")' },
  { card: 'du-may-1311', tep: 'apps/etp2/src/components/etp-view-khach.tsx', co: "position: 'fixed', left: 12, bottom: 12", vi: 'nút trạng thái số liệu nổi góc dưới trái' },
  { card: 'du-may-1311', tep: 'apps/etp2/src/components/etp-view-khach.tsx', co: 'const may = await docMay(duUrl);', vi: 'mở / tải lại etp2 hiện ngay bản số giữ trong máy, bản mới tải ngầm (anh 13/11/2026 "Có giải pháp nào hợp lý và nhanh hơn?")' },
  { card: 'du-rieng-1311', tep: 'apps/etp2/src/lib/etp-du-kho.ts', co: '.finally(() => DOC.delete(n));', cam: 'DOC_MS', vi: 'gộp lượt đọc kho đang chạy, KHÔNG dùng lại kết quả đã xong — thao tác rồi làm mới phải thấy số mới (/audit 13/11/2026)' },
  { card: 'du-rieng-1311', tep: 'apps/etp2/src/app/etp/page.tsx', cam: ' du={gonXet(', vi: 'số liệu trang KHÔNG đi làm props trong HTML — iPhone hết RAM với trang 11 MB, Safari tự tải lại (anh 13/11/2026 "Etp2 đang lỗi. Fix triệt để")' },
  { card: 'du-rieng-1311', tep: 'apps/etp2/src/app/etp/page.tsx', co: 'await catDu(quyen, du, phien);', vi: 'trang cất bản nén theo mã phiên bản, trình duyệt tải /etp/du?p=<mã>' },
  { card: 'du-rieng-1311', tep: 'apps/etp2/src/components/etp-view-khach.tsx', co: 'const r = await fetch(url);', vi: 'khung khach tải số liệu riêng, lỗi tải hiện ô đỏ + nút thử lại' },
  { card: 'du-rieng-1311', tep: 'apps/etp2/src/app/etp/du/route.ts', co: "'content-encoding': br ? 'br' : 'gzip'", vi: '/etp/du trả bản nén sẵn, brotli khi trình duyệt nhận (anh 13/11/2026 22:00 "Ko load nổi", mạng iPhone ~20 KB/giây)' },
  { card: 'du-rieng-1311', tep: 'apps/etp2/src/lib/etp-du-kho.ts', cam: 'brMuc(s, 11)', vi: 'KHÔNG nén brotli 11 nền — chiếm luồng zlib, trang chờ 13–22 s (anh 13/11/2026 22:30)' },
  { card: 'du-rieng-1311', tep: 'apps/etp2/src/components/etp-view-khach.tsx', co: "taiPhan(urlPhan(duUrl, 'chinh'), (a, b) =>", vi: 'lần đầu tải phần chính có thanh tiến độ, dựng trang trước khi phần phụ về' },
  { card: 1585, tep: 'apps/etp2/src/components/etp-view.tsx', cam: ": `kho đồng bộ ${vn(du.dongBo?.xong ?? null)} · ngày Ethopex", vi: 'dòng tiêu đề KHÔNG in chữ phụ "kho đồng bộ … · ngày Ethopex … · tự làm mới khi số đổi" (anh 13/11/2026 "ko show ngu thế này")' },
  { card: 1585, tep: 'apps/etp2/src/components/etp-view.tsx', co: '(máy tự kéo 10 phút/lần)\\n${chuDongBo(dongBo)}', vi: 'giờ đồng bộ + ngày Ethopex gập vào chữ rê nút ↻ Làm mới (YDNI)' },
  { card: 1586, tep: 'apps/etp2/src/components/etp-view.tsx', mot: '<TuoiSo dongBo={du.dongBo} />', vi: 'tuổi số liệu (3s / 5m / 1h = bấy lâu trước) hiện ngay sau tiêu đề, mọi chế độ (anh 13/11/2026)' },
  { card: 1586, tep: 'apps/etp2/src/components/etp-view.tsx', co: "giay < 60 ? `${giay}s` : giay < 3600 ? `${Math.floor(giay / 60)}m`", vi: 'tuổi ghi dạng ngắn 3s / 5m / 1h / 2d, tự đếm' },
  { card: 1575, tep: 'apps/etp2/src/components/etp-view.tsx', co: "<span style={{ alignSelf: 'center', display: 'inline-flex', flexWrap: 'wrap', minWidth: 0, maxWidth: '100%', gap: 6, alignItems: 'center' }}>{nguoiSel()}", cam: "<span style={{ alignSelf: 'center', display: 'inline-flex', gap: 6, alignItems: 'center' }}>{nguoiSel()}", vi: 'cụm Người · Luật máy · Nối Telegram · chỉ xem tự xuống dòng, không tràn ngang trên điện thoại (anh 12/11/2026)' },
  { card: 1575, tep: 'apps/etp2/src/components/etp-view.tsx', co: "return <span style={{ display: 'inline-flex', flexWrap: 'wrap', minWidth: 0, maxWidth: '100%', gap: 6, alignItems: 'center' }}>\n    <Chon2 value={c.cheDo}", vi: 'ô Luật máy + Nối Telegram gói dòng trong màn hẹp' },
  { card: 1574, tep: 'apps/etp2/src/components/etp-view.tsx', co: "u.searchParams.set('k', kh);", cam: "useEffect(() => { try { const v = localStorage.getItem('etp-kh'); if (v) setKh(", vi: 'kỳ số liệu nằm trên URL ?k=, tab mới đổi kỳ không làm tab cũ nhảy theo (anh 12/11/2026)' },
  { card: 1574, tep: 'apps/etp2/src/app/etp/page.tsx', co: "k: mot('k')", vi: 'máy chủ đưa ?k= vào EtpView' },
  { card: 1574, tep: 'apps/etp2/src/components/etp-tong2.tsx', co: "if (tpl) u.searchParams.set('tpl', tpl);", vi: 'Template Tổng quan nằm trên URL ?tpl=, thắng bố cục chung trong sổ' },
  { card: 1574, tep: 'apps/etp2/src/components/etp-view.tsx', co: "u.searchParams.set('ln', nhom);", vi: 'nhóm luật (tab Luật) nằm trên URL ?ln=' },
  { card: 1567, tep: 'apps/etp2/src/components/etp-view.tsx', mot: 'function HexBo({ bos, boTk }', vi: 'dãy bộ tài khoản của phim: ≥ 3 bộ xếp lưới 2x2 cho gọn (anh 12/11/2026)' },
  { card: 1567, tep: 'apps/etp2/src/components/etp-view.tsx', co: "gridTemplateColumns: 'repeat(2, auto)', gap: 1", vi: 'HexBo: lưới 2 cột khi nhiều bộ' },
  { card: 1567, tep: 'apps/etp2/src/components/etp-view.tsx', cam: '.map((c) => c.bo).filter(Boolean))].map((b) => <Hex', vi: 'không vẽ dãy lục giác bộ của phim thành một hàng dài nữa — đi qua HexBo' },
  { card: 1565, tep: 'apps/etp2/src/components/etp-tong2-widget.tsx', co: "{ key: 'chi', header: 'Chi', align: 'right', cell: (p) => <KeToan v={p.k.chi} /> },", vi: 'widget Người (Tổng quan): cột Chi kiểu kế toán — 2 số lẻ, $ mép trái (anh 12/11/2026)' },
  { card: 1565, tep: 'apps/etp2/src/components/etp-tong2-widget.tsx', co: "cell: (p) => <KeToan v={p.k.thu - p.k.chi} mau={mauLai(p.k.thu - p.k.chi)} /> },", vi: 'widget Người: cột Lãi kiểu kế toán, âm trong ngoặc' },
  { card: 1565, tep: 'apps/etp2/src/components/etp-tong2-widget.tsx', cam: "cell: (p) => tien(p.k.chi)", vi: 'ô tiền trong bảng widget không in tien() làm tròn lệch số lẻ' },
  { card: 1565, tep: 'apps/etp2/src/components/etp-tong2-widget.tsx', cam: "{tien((k.thu3 - k.chi3) / 3)}</span>", vi: 'widget Phân bổ: Lãi/ngày kiểu kế toán' },
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
  { card: 'du-bao-1211', tep: 'apps/etp2/src/components/etp-tu-van.tsx', co: 'd.du_bao?.bao_dong ?', vi: 'ô Nên làm gì bây giờ hiện dự báo ngày yếu + báo động chợ (anh 12/11/2026)' },
  { card: 'tu-van-1011', tep: 'apps/etp2/src/lib/etp-doc.ts', co: "from etp.tu_van where phien = 'song' and ${cuaNg(sql`nguoi_id`)}", vi: 'tư vấn đọc bản sống, người chỉ thấy bản của mình' },
  { card: 'da-lam-1211', tep: 'apps/etp2/src/lib/etp-doc.ts', co: 'theDaLam(r.xet, r.luc, lamR.filter((x) => Number(x.c) === Number(r.camp_id)))', vi: 'thẻ xét luật biết việc máy đã làm sau lúc ghi thẻ (anh 12/11/2026 #81648: đã lên ROAS 00:50, thẻ 00:27 vẫn ghi Đạt ⏳)' },
  { card: 'da-lam-1211', tep: 'apps/etp2/src/components/etp-view.tsx', co: "if ((l.ket !== 'dat' && l.ket !== 'gan') || l.da) return null;", vi: 'thẻ máy đã làm thôi đếm giờ, hiện ✓ đã làm HH:MM' },
  { card: 'da-lam-1211', tep: 'apps/etp2/src/components/etp-view.tsx', co: '(xet ?? []).find((x) => x.vao === (daXep[0] ?? ganBao[0])!.nhom)', vi: 'ô giờ trên cây lấy thẻ xét của luật máy đã xếp (#81648 ô giờ trống)' },
  { card: 'gio-gan-1211', tep: 'apps/etp2/src/components/etp-view.tsx', co: "if (t == null || (l.ket === 'gan' && !chiNhip)) return null;", vi: 'thẻ Gần còn thiếu điều kiện thật không hiện ⏳ (anh 12/11/2026 #73232)' },
  { card: 'mo-1011', tep: 'apps/xuong-video/scripts/ethopex/luat-ethopex.py', co: 'if _ts: ls[-1]["mo"] = _ts_mo(cid)', vi: 'thẻ tăng bị Siết TS chặn mang mốc sớm nhất thôi chặn (anh 10/11/2026 "show thời gian sẽ áp dụng sau bao lâu")' },
  { card: 'mo-1011', tep: 'apps/etp2/src/components/etp-view.tsx', co: 'gioThe(t.the, hoan, t.don)', vi: 'chip luật hiện ⏳ giờ máy làm — cùng hàm gioThe với bảng xét' },
  { card: 'mo-1011', tep: 'apps/etp2/src/components/etp-view.tsx', co: '{deXuat ? null : <GioThe l={l} don={!!don} chip />}', vi: 'MỌI thẻ Đạt / Gần có giờ áp dụng ở ô tên luật (anh 10/11/2026 "gắn thời gian vào đây") — dạng ⏳ gọn, giờ đủ ở chữ rê (#1558)' },
  { card: 1558, tep: 'apps/etp2/src/components/etp-view.tsx', co: '<GhiLuat t={l.ghi} />', cam: "{l.ghi ? <div style={{ ...KHONG_GIAN, color: '#fb923c', fontSize: 10.5 }}><ChuCamp t={l.ghi} /></div> : null}", vi: 'ô tên luật không in ghi chú dài — ℹ, rê mới hiện (anh 12/11/2026 YDNI)' },
  { card: 1559, tep: 'apps/etp2/src/components/etp-view.tsx', mot: "{ key: 'gio', header: '⏳', align: 'right', width: 40,", vi: 'cây camp: giờ máy làm theo luật nằm ở cột ⏳ riêng ngay trước cột Luật (anh 11/11/2026)' },
  { card: 1559, tep: 'apps/etp2/src/components/etp-view.tsx', co: 'deXuat={du.nguoi.ngoai} khongGio />', vi: 'chip luật trên cây không in lại ⏳27p cạnh thẻ — giờ đã ở cột riêng' },
  { card: 1559, tep: 'apps/etp2/src/components/etp-view.tsx', mot: 'const gioGon = (t: number) =>', vi: 'cột ⏳ dạng gọn h:mm (0:27 · 2:15), giờ VN + điều kiện ở chữ rê' },
  { card: 1559, tep: 'apps/etp2/src/components/etp-view.tsx', co: 'const gl = gioLuat(p, t, hoan)', vi: 'chip luật và cột ⏳ cùng một hàm gioLuat — không tính hai kiểu' },
  { card: 1560, tep: 'apps/etp2/src/components/etp-lich-phim.tsx', mot: "const GON: React.CSSProperties = { whiteSpace: 'nowrap'", vi: 'bảng lịch phim: mỗi hàng camp thắng (Lên bậc / Nhân bản / ★ ROAS) một dòng, chi tiết ở chữ rê (anh 12/11/2026 "nhìn dài quá")' },
  { card: 1560, tep: 'apps/etp2/src/components/etp-lich-phim.tsx', cam: "<div style={{ color: 'var(--fg-3)' }}>Lộ trình: {b.lo", vi: 'dòng Lộ trình không in riêng — nằm trong chữ rê Lên bậc' },
  { card: 1560, tep: 'apps/etp2/src/components/etp-lich-phim.tsx', cam: "return <div key={n}><Thanh v={c.chi30 / ch}", vi: 'mỗi nấc nhân bản không in thành dòng riêng — nấc 1 ✓ · nấc 2 ○ trên một dòng' },
  { card: 1560, tep: 'apps/etp2/src/components/etp-lich-phim.tsx', cam: '!them ? `Chưa thêm: ${ke.ly}`', vi: 'Mở rộng: lý do chưa thêm nằm ở chữ rê, không in câu dài' },
  { card: 1562, tep: 'apps/etp2/src/components/ui/chon-khoang.tsx', co: 'onChange={(e) => { setOTu(e.target.value); setCho(null); }}', cam: 'haiDau(e.target.value, oDen)', vi: 'ô ngày chỉ sửa nháp, Áp dụng mới chốt — iOS bắn change giữa lúc chọn, chốt luôn là gỡ ô đang mở trình chọn (anh 12/11/2026 "bấm đổi ngày trên mobile là lỗi")' },
  { card: 1562, tep: 'apps/etp2/src/components/ui/chon-khoang.tsx', co: "const k = (s: string) => (s > homNay ? homNay : s)", vi: 'kỳ tự chọn kẹp ≤ hôm nay (iOS bỏ qua max)' },
  { card: 1562, tep: 'apps/etp2/src/components/etp-view.tsx', cam: '.map(([ten, x]) => <span key={ten}>', vi: 'dòng số Hôm nay · Hôm qua · kỳ khoá theo vị trí — kỳ Hôm nay / Hôm qua trùng nhãn' },
  { card: 1562, tep: 'apps/etp2/src/app/error.tsx', co: 'Trang ETP2 gặp lỗi', vi: 'lỗi trang hiện nguyên câu lỗi + Thử lại, không màn đen "Application error"' },
  { card: 1563, tep: 'apps/etp2/src/components/etp-view.tsx', co: "'↑ Tăng lên' : '↓ Giảm về'} $${ns}", cam: "'↑ Tăng' : '↓ Giảm'} về $${ns}", vi: 'nút bậc ngân sách: tăng ghi "Tăng lên $X", giảm ghi "Giảm về $X" (anh 12/11/2026)' },
  { card: 1555, tep: 'apps/etp2/src/components/etp-view.tsx', cam: "cr #{c.creative_id ?? '?'}</span>", vi: 'ô creative trên cây không in mã cr # — rê ô mới thấy (anh 10/11/2026)' },
  { card: 1556, tep: 'apps/etp2/src/components/etp-view.tsx', cam: '{p}% NS</span>', vi: 'Tổng quan 2: chỉ vạch % ngân sách, không in chữ % NS — rê mới hiện (anh 11/11/2026)' },
  { card: 'mo-1011', tep: 'apps/etp2/src/lib/etp-doc.ts', co: "interval '90 minutes'", cam: "from etp.xet_luat where luc > now() - interval '30 minutes'", vi: 'thẻ máy giữ 90 phút: nhịp máy luật dài không làm trang tự tính trái máy' },
  { card: 'tach-1011', tep: 'apps/etp2/src/components/etp-view.tsx', co: "(c) => (c.ban || c.giong ? [", vi: 'loại creative có dòng con theo biến thể (PO.1, ATT.KD…)' },
  { card: 1561, tep: 'apps/etp2/src/components/etp-view.tsx', co: "if (!c.creative_id && / bai-cu /.test(c.ten)) return <span data-cot=\"creative\" title={`USED POST", vi: 'Cây: bản nhân dùng bài cũ hiện nhãn used post thay ô creative xám "chưa chấm" (anh 12/11/2026)' },
  { card: 1573, tep: 'apps/etp2/src/components/etp-tong2.tsx', co: "for (const c of Array.from(cha.children))", cam: 'duoi = cha.scrollHeight - (tren + r.height)', vi: 'lưới Tổng quan phủ kín màn khi phóng to cửa sổ — phần dưới lưới đo từ con thật, không lấy scrollHeight (bằng khung khi nội dung ngắn)' },
  { card: 1581, tep: 'apps/etp2/src/components/ui/simple-table.tsx', co: "<tr data-tong=\"1\">{columns.map((c) => <td key={c.key} style={{ ...tdBase, position: 'sticky', bottom: 0", vi: 'SimpleTable có dòng Tổng dính đáy khung cuộn (anh 13/11/2026)' },
  { card: 1581, tep: 'apps/etp2/src/components/ui/simple-table.tsx', co: "overflowX: tong ? 'clip' : 'auto'", vi: 'có dòng Tổng thì vỏ bảng không thành khung cuộn — sticky bám khung cuộn của widget' },
  { card: 1581, tep: 'apps/etp2/src/components/etp-tong2-widget.tsx', co: 'getRowKey={(p) => String(p.id)} tong={tong}', vi: 'widget Người (Tổng quan) có dòng Tổng sticky ở dưới (anh 13/11/2026)' },
  { card: 1581, tep: 'apps/etp2/src/components/etp-tong2-widget.tsx', co: 'roi: roiSoTruoc(tk, tt)', vi: 'ROI dòng Tổng tính từ tổng chi/thu, không cộng %' },
  { card: 1582, tep: 'apps/etp2/src/app/etp/phien/route.ts', co: "(await dangDongBo()) ? 'dang' : (await duTrang(q, ng)).phien", vi: 'kho đang đồng bộ thì /etp/phien trả dang, không chạy docEtp (anh 13/11/2026 "load chậm quá": trang tải lại ~940 KB mỗi phút giữa lượt đồng bộ)' },
  { card: 1582, tep: 'apps/etp2/src/lib/etp-phien.ts', co: "where xong is null and bat_dau > now() - interval '12 minutes'", vi: 'lượt đồng bộ đang ghi = chưa xong, bắt đầu trong 12 phút (lượt chết không chặn làm mới mãi)' },
  { card: 1582, tep: 'apps/etp2/src/components/etp-view.tsx', co: "if (m && m !== 'dang' && m !== phien) await lamMoiAnToan(router);", cam: 'if (!m || m !== phien) await lamMoiAnToan(router);', vi: 'trang không tải lại khi kho đang đồng bộ hoặc hỏi mã lỗi mạng' },
  { card: 1587, tep: 'apps/etp2/src/components/ui/chon2.tsx', co: "width: xemRong ? 560 : 260", cam: "style={{ width: 260, maxWidth: '92vw'", vi: 'ô chọn (Luật: Đang chạm / Sắp chạm…) có nút ⤢ xem rộng — bảng rộng 560 thay 260' },
  { card: 1587, tep: 'apps/etp2/src/components/ui/chon2.tsx', co: "maxHeight: xemRong ? '72vh' : 340", vi: 'xem rộng thì danh sách cao 72% màn, thấy nhiều mục hơn' },
  { card: 1587, tep: 'apps/etp2/src/components/ui/chon2.tsx', mot: 'data-k="chon2-xem-rong" onClick={doiRong}', vi: 'nút ⤢ / ⤡ cạnh ô tìm, máy nhớ lựa chọn cho mọi ô chọn' },
  { card: 1588, tep: 'apps/etp2/src/components/etp-view.tsx', mot: '<span data-dinh-tuoi="1" style={{ display: \'inline-flex\', gap: 8, alignItems: \'center\', flex: \'none\' }}>{cumTuoi(true)}</span>', vi: 'dòng số gọn dính khi cuộn có cụm tuổi số · ↻ Làm mới · ▶ Lên camp (anh 13/11/2026 "Show cả khi sticky xuống")' },
  { card: 1588, tep: 'apps/etp2/src/components/etp-view.tsx', mot: '<NutLamMoi dongBo={du.dongBo} gon={g} />', vi: 'cụm tuổi số / Làm mới / Lên camp chỉ dựng ở MỘT hàm cumTuoi — tiêu đề và dòng dính dùng chung, không chép hai bản' },
  { card: 1561, tep: 'apps/etp2/src/components/etp-lich-phim.tsx', co: 'bản USED POST (dùng lại bài đăng camp gốc) ở nhịp kế', cam: 'bản $1 ở nhịp kế', vi: 'chữ rê Nhân bản nói máy nhân bản used post' },
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
