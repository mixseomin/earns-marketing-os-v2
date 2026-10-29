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
  // 29/10/2026 — lý do chặn của máy chấm: tên tiêu chí tiếng Việt + điểm /10, mỗi lý do một dòng (không in mã meta.bao_luc trần)
  { card: 0, tep: V, mot: 'function LyDoChan(', vi: 'lý do chặn đọc được trong thẻ creative' },
  { card: 0, tep: V, cam: '`chặn: ${ch.chan_boi}`', vi: 'không in chuỗi mã chặn trần' },
  // 29/10/2026 — một camp một quyết định: luật tắt thắng mọi luật khác (ở nguồn) + lệnh tắt hỏng vì lỗi máy thì nhịp sau thử lại
  // kiểm Ý chứ không kiểm nguyên dòng: thêm luật tắt mới vào tập (vd tat_l3) vẫn xanh; bỏ lọc ở danh sách tăng / giảm / nhân bản là đỏ
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/luat-ethopex.py', co: '_SE_TAT = {int(x[0] or 0) for v in (tat2, tat_d24', vi: 'có tập camp trong danh sách tắt (T2 · D24 · …)' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/luat-ethopex.py', co: 'not in _SE_TAT] for v in (tu_choi, dau_phien, dat, giam, ha, nb, thang_nb, tang30, moc30))', vi: 'camp sắp tắt bị gỡ khỏi tăng / giảm / nhân bản / thay creative / lên ROAS' },
  { card: 0, tep: 'apps/cty/worker/ethopex.mjs', co: 'if (seTat.has(m.id)) continue;   // không nhân bản camp đang trong danh sách tắt', vi: 'không nhân bản camp sắp tắt' },
  { card: 0, tep: 'apps/cty/worker/ethopex.mjs', co: 'if (!ok && ly) giu.ds[m.id]', vi: 'tắt hỏng vì lỗi máy không bị giữ tới hết ngày' },
  { card: 0, tep: 'apps/cty/worker/ethopex.mjs', co: "'-f', '-'], { timeout: 60_000", vi: 'SQL qua stdin (không E2BIG)' },
  { card: 0, tep: V, cam: "<span style={{ width: 24, display: 'inline-flex', gap: 2 }}>{dau.slice(0, 2)", vi: 'ô ngân sách không còn dấu luật ↑ ↓ ✕ sau thước (anh 29/10/2026)' },
  { card: 0, tep: V, co: "{ key: 'chi', header: `Chi ${tenKy.toLowerCase()}`", vi: 'bảng Cây có cột tổng chi theo khung thời gian (anh 29/10/2026)' },
  { card: 0, tep: V, cam: "<span style={{ position: 'relative', width: W, height: 8, borderRadius: 4", vi: 'ô ngân sách không còn thước ROI (anh 29/10/2026 "bỏ cái này đi cơ mà?")' },
  { card: 0, tep: 'packages/bang/src/data-table.tsx', co: 'className="dt-chan"', vi: 'DataTable dòng tổng dính chân màn (anh 29/10/2026)' },
  { card: 0, tep: 'packages/bang/src/data-table.tsx', co: 'Tổng <span style={{ color: \'var(--fg-3)\', fontWeight: 400 }}>· {shownRows.length} dòng</span>', vi: 'dòng tổng có nhãn Tổng · N dòng' },
  { card: 0, tep: 'packages/bang/src/data-table.tsx', co: '<tr className="dt-tong" style={{ background: TONG_BG }}>', vi: 'dòng tổng nền riêng' },
  { card: 0, tep: 'apps/web/src/components/gop-y-mos2.tsx', co: "top: '50%', transform: 'translateY(-50%)'", vi: 'nút góp ý mos2 ở mép phải giữa, không đè dòng tổng' },
  { card: 0, tep: 'apps/etp/dong-bo.py', co: 'goc = EA.goc_tu_ten(c.get("name"))', vi: 'camp gốc đọc từ tên qua hàm chung (nhân bản · bản thang · ROAS)' },
  { card: 0, tep: 'apps/etp/ethopex_api.py', co: '(?:nhan ban \\d+|thang \\$\\d+) cua', vi: 'hàm camp gốc nhận cả bản thang' },
  // 29/10/2026 — lên ROAS: lãi 30 ngày ≥ $75 là đủ, máy tự lên (anh: "đủ điều kiện lên roas thì lên luôn. Nới điều kiện lên roas là ROI >= 75$")
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/luat-ethopex.py', co: 'L4_CHI, L4_NGAY, L4_ROI = 5.0, 4, -20', vi: 'luật L4 (anh 29/10/2026 "L4 bật đi"): ≥ 4 ngày có chi, ROI < −20% → tắt' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/luat-ethopex.py', co: 'L7_CHI, L7_NGAY, L7_ROI = 5.0, 5, -30\ntat_l7 = []\n', vi: 'L7 đang dừng (thay bằng L4) — không xếp camp nào' },
  { card: 0, tep: 'apps/cty/worker/ethopex.mjs', co: "{ khoa: 'tat_l4', tep: 'ethopex-tat-l4.json'", cam: "khoa: 'tat_l7'", vi: 'worker tắt theo L4, không còn đường tắt L7' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/luat-ethopex.py', co: 'T30N_ROI, T30N_SP, T30N_NGAY = 50, 60, 5', vi: 'T30 camp thường nới (anh 29/10/2026 "Nới đi"): 5 ngày ROI ≥ 50%, chi TB ≥ 60% ngân sách' },
  // CAMP THAY THẾ (anh 29/10/2026): phim còn 1 camp sắp tắt → lên camp thay ngay, rút kinh nghiệm, lên theo bộ định dạng, dòng mờ trên Cây
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/luat-ethopex.py', co: 'else "gan" if thieu == 1 and lo is not False else "xa"', vi: 'luật tắt: camp đang lãi không bao giờ "gần chạm" (L4 hiện trên camp +177%, 29/10/2026)' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/thay-the.py', co: 'ghi="camp cũ không còn sắp tắt"', vi: 'camp thay tự huỷ khi camp cũ hết sắp tắt' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/thay-the.py', co: 'TAT_MA = ("l3", "l4", "t2", "off", "d24")', vi: 'camp thay: sắp tắt = luật tắt hẳn đạt / gần chạm' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/thay-the.py', co: 'for x in ung_vien(content, c0.get("creative_id"), bh["huong"])', vi: 'camp thay chọn creative theo hướng rút kinh nghiệm (chẩn đoán camp cũ)' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/thay-the.py', co: 'nhom.setdefault(x.get("dang") or "?", [])', vi: 'camp thay lên theo bộ: mỗi dạng một camp' },
  { card: 0, tep: 'apps/cty/worker/ethopex.mjs', co: "'apps/xuong-video/scripts/ethopex/thay-the.py'), ['--that'", vi: 'nhịp ethopex chạy máy thay camp' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/sua-cta.py', co: 'if m.get("thay"):', vi: 'góc mới cho camp thay không nhân bản camp cũ đang lỗ' },
  { card: 0, tep: 'apps/web/src/lib/etp-doc.ts', co: "from etp.thay_the where buoc not in ('chay', 'huy')", vi: 'trang etp đọc camp thay đang chuẩn bị' },
  { card: 0, tep: 'apps/web/src/components/etp-view.tsx', co: "return { opacity: THAY_BUOC[t?.buoc ?? '']?.[1] ?? 0.3", vi: 'dòng camp thay mờ, đậm dần theo bước' },
  // KT CHO PHIM ĐANG CHẠY (anh 29/10/2026 "làm đi"): máy sinh VideoExpress → creative → chấm → camp
  { card: 0, tep: 'apps/xuong-video/scripts/videoexpress.mjs', co: 'process.env.BR_PROFILE ||= PROFILE;', vi: 'máy sinh KT gắn profile br riêng (không phụ thuộc br use dùng chung)' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/hang-ke-chuyen.mts', co: "!coKt.has(id) && live.has(id) ? 2000 + lai", vi: 'hàng KT ưu tiên phim đang chạy chưa có KT' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/may-sinh-ke-chuyen.mjs', co: "scripts/ethopex/thu-vien-len.py`, ...tv]", vi: 'máy sinh tự đưa bản sẵn sàng lên creative' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/may-sinh-ke-chuyen.mjs', co: "dongTv(d, mayLoi ? 'loi_may' : 'loai'", vi: 'lỗi máy không bỏ oan phim' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/ghi-studio-canh-that.mts', co: "the_loai: THE_LOAI, qc,", cam: "the_loai: 'qc_canh_that', qc,", vi: 'studio ghi đúng dạng (KT không bị xếp cảnh thật)' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/vx-ke-chuyen.mts', co: 'if (r.data?.mediaPath) {', vi: 'giọng VideoExpress trả thẳng tệp (data.mediaPath) — không kẹt chờ websocket' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/vx-ke-chuyen.mts', co: 'g(c).anhUuid && g(c).anh && g(c).am && !g(c).vid', vi: 'chỉ dựng clip khi đã có giọng' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/hang-ke-chuyen.mts', co: 'const bo = chan18(id) ?? (', vi: 'không sinh KT cho phim bị cấm / chưa soát 18+ (KT #61967 không lên được camp)' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/vx-ke-chuyen.mts', co: "match the reference photo faces and hair ONLY", cam: 'faces, hair and wardrobe', vi: 'ảnh KT không chép trang phục poster (khoả thân #62014)' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/cat-canh.py', co: 'nut_tu = L if _nt == "cuoi" else float(_nt)', vi: 'nút CTA có thể chỉ hiện ở thẻ cuối (nút giả #62014)' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/may-sinh-ke-chuyen.mjs', co: 'if (!so.dang && so.lam_lai?.length)', vi: 'máy sinh làm lại bản KT bị chấm chặn' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/thu-vien-len.py', co: 'env={**os.environ, "ETP_KHONG_CAT": "1"}', vi: 'đưa thư viện lên creative không chạy quét Drive (giữ chân máy sinh > 36 phút)' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/thu-vien-len.py', co: 'l = next((k for i, k in enumerate(kq) if i not in da and str(k.get("content_id")) == str(x["content_id"])), {})', vi: 'thư viện → creative khớp theo phim (len.json không có den — khớp độ dài làm tạo trùng)' },
  { card: 0, tep: 'apps/cty/worker/ethopex.mjs', co: "or (r.dang = 'kể chuyện' and exists (select 1 from etp.camp c where c.content_id = r.content_id and c.trang_thai = 'ACTIVE')", vi: 'nhịp ethopex lên camp KT cho phim đang chạy' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/luat-ethopex.py', co: 'ROAS_LAI = 75;', vi: 'ngưỡng lên ROAS = lãi 30 ngày $75 (máy luật)' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/luat-ethopex.py', co: 'if a["thu"] - a["chi"] >= ROAS_LAI:', vi: 'đủ lên ROAS chỉ xét lãi 30 ngày' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/luat-ethopex.py', co: 'moc30 = [x for x in moc30 if int(x[0] or 0) not in _goc_roas]', vi: 'gốc đã có camp ★ không lên ROAS lại' },
  { card: 0, tep: 'apps/web/src/lib/etp-doc.ts', co: 'const ROAS_LAI = 75;', vi: 'trang etp cùng ngưỡng lên ROAS $75' },
  { card: 0, tep: 'apps/cty/worker/ethopex.mjs', co: "chay(NB, [String(v.m.id), '--roas', String(v.muc)", vi: 'máy tự lên ROAS camp đủ điều kiện' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/nhan-ban.py', cam: 'if ly and mien_cham: kq["mien_cham"] = ly; ly = None', vi: 'camp ROAS không qua cổng chấm (anh 29/10/2026 "Camp roas lên ko cần chấm lại")' },
  { card: 0, tep: 'apps/etp/lich-gio.py', co: "KHONG_ROAS = \"not (c.ten like '★%' or c.ten like '% duplicate by %')\"", vi: 'luật chấm không tắt camp ★ ROAS' },
  { card: 0, tep: 'apps/cty/worker/ethopex.mjs', co: 'fs.utimesSync(khoa, t, t)', vi: 'khoá nhịp có nhịp tim (nhịp dài lên ROAS không bị nhịp khác chen)' },
  // 28–29/10/2026 — bộ lọc trang Camp (chat): Luật theo đúng thẻ đang hiện, Tuổi, Cây dùng DataTable
  { card: 0, tep: V, mot: 'const chipCamp = (du: DuLieuEtp', vi: 'thẻ luật và bộ lọc Luật cùng một nguồn' },
  { card: 0, tep: V, co: '.filter(hopLuat)', vi: 'bộ lọc Luật áp lên danh sách camp' },
  { card: 0, tep: V, co: '{laiSel()}{tuoiSel()}{luatSel()}', vi: 'ô lọc Tuổi trên thanh lọc' },
  { card: 0, tep: V, co: 'const bangCay = hep ? null : <DataTable', vi: 'Cây máy tính dùng DataTable (lọc từng cột)' },
  { card: 0, tep: 'packages/bang/src/col-filter.ts', co: "case 'KHOẢNG':", vi: 'DataTable lọc khoảng số từ–đến (29/10/2026)' },
  { card: 0, tep: 'packages/bang/src/data-table.tsx', co: "op: laSo ? 'KHOẢNG' : 'LIKE %%'", vi: 'cột số mở lọc mặc định là khoảng' },
  { card: 0, tep: 'packages/bang/src/data-table.tsx', co: "(col?.align ?? 'right') !== 'left'", vi: 'cột chữ / mã (canh trái) mặc định LIKE %%, không KHOẢNG (anh 29/10/2026)' },
  { card: 1477, tep: 'apps/web/src/components/etp-view.tsx', cam: "d.canh.map((x, i)", vi: 'thẻ hover ngân sách không lặp dòng luật (cột Luật đã có)' },
  { card: 1477, tep: 'apps/web/src/components/etp-view.tsx', cam: "'→ vùng giảm'", vi: 'thẻ hover ngân sách không còn chữ vùng giảm / tăng' },
  { card: 1479, tep: 'apps/web/src/lib/etp-doc.ts', co: "etp.creative_cua(c.creative_id, c.ten) creative_id", vi: 'camp ROAS (creative 0) lấy creative của camp gốc' },
  { card: 1480, tep: 'apps/web/src/components/etp-view.tsx', cam: "{ds.length ? '▸' : ''}</span><Hex bo={c.bo} info={c.bo ? du.boTk[c.bo] : undefined} co={12} /> <b style={laRoas(c.ten) ? { color: MAU_ROAS } : undefined}>#{c.camp_id}</b><BadgeDangNgan", vi: 'dòng camp điện thoại không có nhãn loại CT/CC' },
  { card: 1481, tep: 'apps/web/src/components/etp-view.tsx', co: "tatCa.every((k) => moCay.has(k))", vi: 'Mở hết xét cả camp có bản nhân, không chỉ phim' },
  { card: 1482, tep: 'apps/web/src/components/etp-view.tsx', co: "color: `rgba(196,181,253,${(0.55 + 0.45 * (bac / (BAC_NS.length - 1))).toFixed(2)})`", cam: 'rgba(103,232,249,${(0.35', vi: 'số ngân sách cột bậc màu tím nhẹ, bậc $1 không chìm' },
  { card: 1483, tep: 'apps/web/src/components/etp-view.tsx', co: "const top = y - CHONG + h <= H - 8 ? y - CHONG", cam: 'const top = y + 12 + h <= H - 8', vi: 'thẻ nổi đè lên con trỏ, không còn khe phải băng qua dòng khác' },
  { card: 1483, tep: 'apps/web/src/components/etp-view.tsx', co: "window.addEventListener('mousemove', (e) => { CHUOT.x = e.clientX; CHUOT.y = e.clientY; }", vi: 'thẻ đặt theo vị trí chuột lúc mở' },
  { card: 1484, tep: 'apps/web/src/components/etp-view.tsx', co: "max={maxLai(sd)} mo nhom />", vi: 'biểu đồ dòng phim (tổng) vẽ cột rỗng viền màu, khác cột đặc của camp' },
  { card: 0, tep: 'apps/web/src/components/etp-view.tsx', co: '.etp-cay tr.dt-nhom>td::after{content:', vi: 'dòng phim sáng hơn + bóng mờ dưới chân (anh chat 29/10/2026)' },
  // phim QC kể chuyện VideoExpress (chat 29/10/2026 — anh: "lần sau kiểu đéo gì mày cũng lặp lại lỗi này?")
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/cat-canh.py', cam: 'Image.open(poster).convert("RGBA").resize((W, H))', vi: 'thẻ cuối không kéo méo poster khác 9:16 (mất tên phim)' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/cat-canh.py', co: 'abs(goc.width / goc.height - W / H)', vi: 'thẻ cuối giữ tỉ lệ poster' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/cat-canh.py', co: 'os.environ.get("ETP_LOI_DAN")', vi: 'phim có lời kể: giọng CTA vào sau câu kể cuối' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/vx-ke-chuyen.mts', co: "ETP_LOI_DAN: '1'", vi: 'vx-ke-chuyen gọi cat-canh với ETP_LOI_DAN=1' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/vx-ke-chuyen.mts', co: 'CỔNG BẢN CTA', vi: 'bản CTA tự đo câm / giọng đè trước khi trả tệp' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/vx-ke-chuyen.mts', cam: "option_speed: '0'", vi: 'tốc độ đọc TTS không gửi 0 (bị kẹp 0,5 = đọc chậm gấp đôi)' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/vx-ke-chuyen.mts', co: 'vaiCua(c)', vi: 'ảnh cảnh chỉ tả nhân vật cảnh gọi tên (không cả dàn vai)' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/vx-nap-tap.mts', co: 'thoai = ${JSON.stringify(thoai)}', vi: 'giọng nạp vào thoai[].url — chỉ thoai_url thì MP4 câm' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/vx-nap-tap.mts', co: 'bản xuất CÂM', vi: 'vx-nap-tap đo bản xuất, câm thì đỏ' },
  { card: 1485, tep: 'packages/bang/src/data-table.tsx', co: '{nhDinh ? <tbody>{dongNhomTr(nhDinh, true)}</tbody> : null}', vi: 'dòng phim (dòng nhóm) dính trong khối tiêu đề khi cuộn qua' },
  { card: 1485, tep: 'packages/bang/src/data-table.tsx', mot: "className={dinh ? 'dt-nhom dt-nhom-dinh' : 'dt-nhom'}", vi: 'dòng nhóm vẽ một chỗ (dongNhomTr), không chép tay thêm bản thứ hai' },
  // anh 29/10/2026: cờ nước giao trên camp + nhóm gốc phim (Trung / Ấn / hoạt hình…) — hoạt hình chỉ khi nhìn ra tranh vẽ
  { card: 0, tep: 'apps/etp/cong.py', co: "if ng and ng != 'au_my': return", vi: 'cổng chung chặn tăng chi / lên camp cho phim ngoài Âu-Mỹ (anh 29/10/2026)' },
  { card: 0, tep: 'apps/etp/cong.py', co: 'if ct and not ng:', vi: 'phim chưa chấm nhóm gốc thì cổng chấm ngay, không chấm được thì chặn (làm cho kín)' },
  { card: 0, tep: 'apps/etp/nhom_goc.py', co: 'if a.get("kieu_anh") == "tranh_ve": a["nhom"] = "hoat_hinh"', vi: 'tranh vẽ → hoạt hình (Haiku đọc tranh fantasy thành ảnh chụp nếu không hỏi riêng)' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/nhan-ban.py', co: 'str(bo) if bo else None, content_id=cid)', vi: 'nhân bản / tạo camp truyền phim vào cổng chặn nhóm gốc' },
  { card: 0, tep: 'apps/web/src/components/etp-view.tsx', co: '<CoNuoc nuoc={c.nuoc ?? []} />', vi: 'camp hiện cờ nước giao nhiều chi nhất' },
  { card: 0, tep: 'apps/web/src/components/etp-view.tsx', co: '<NhomGoc g={nhomCua.get(Number(k))} />', vi: 'dòng phim hiện nhóm gốc' },
  { card: 0, tep: 'apps/etp/dong-bo.py', co: '"group_by": ["campaign_name", "geo"]', vi: 'đồng bộ nước giao theo camp (gom geo trần không tách được nhà)' },
  { card: 0, tep: 'apps/web/src/components/etp-view.tsx', cam: "maxWidth: 1600, margin: '0 auto'", vi: 'trang etp tràn hết bề ngang màn, không khoá 1600px (anh chat 29/10/2026)' },
  { card: 0, tep: 'packages/bang/src/data-table.tsx', co: 'colSpan={ci === 0 && gop > 1 ? gop : undefined}', vi: 'tên phim (dòng nhóm) tràn sang cột Trạng thái + Tuổi (anh chat 29/10/2026)' },
  { card: 1485, tep: 'apps/web/src/components/etp-view.tsx', co: 'const H = nhom ? 22 : 15', vi: 'cột ROI camp nhỏ hơn cột ROI phim' },
  // anh 29/10/2026 "mày đc tự nâng đến $30 rồi nên gộp lại": một quyền tự tăng trần $30, không tách nhánh T30 riêng
  { card: 0, tep: 'apps/cty/worker/ethopex.mjs', cam: "k === 'tang30' ? d !== 30", vi: 'tự tăng một quyền một trần (T30 không còn nhánh riêng ngoài trần)' },
  { card: 0, tep: 'apps/cty/worker/ethopex.mjs', co: 'if (!d || d > tuTang ||', vi: 'mọi lần tự tăng (bậc + T30) đều xét chung trần tuTang' },
  // anh 29/10/2026 "sso thêm 1 người nữa chỉ vào đc riêng page này … chỉ view": khách một trang = users.chi_host, gác ở getCurrentUser
  { card: 0, tep: 'apps/web/src/lib/auth.ts', mot: 'if (r.chi_host && String(r.chi_host).toLowerCase() !== await hostHienTai()) continue;', vi: 'phiên khách một trang chỉ sống trên đúng host của họ' },
  { card: 0, tep: 'apps/web/src/app/api/auth/verify/route.ts', co: "if (u.role === 'viewer' && !u.chiHost) return", vi: 'cổng SSO cho khách một trang qua, viewer thường vẫn 403' },
  { card: 0, tep: 'apps/etp/deploy/etp.on.tc.nginx', co: 'proxy_set_header Cookie $http_cookie; proxy_set_header Host $host; }', vi: 'cổng auth_request etp gửi Host thật (khách etp mới qua được)' },
  { card: 0, tep: 'apps/web/src/app/etp/page.tsx', co: '<EtpView chiXem={me.role !== \'admin\'}', vi: 'khách etp chỉ xem — ẩn nút ghi' },
  { card: 0, tep: 'apps/web/src/lib/actions/etp-lich.ts', co: "me.role === 'admin' ? me.email : null", vi: 'đặt lịch giờ chỉ admin' },
  // năm kiểu dựng 0đ không theo góc spy (anh 29/10/2026): một sổ nhãn trên etp + sổ điểm chạm; nút CTA chỉ ở thẻ cuối; thư viện nhận bản không từ tập VideoExpress
  { card: 0, tep: 'apps/web/src/components/etp-view.tsx', co: "'chọn phe': 'CP', 'bình luận': 'BL', 'ba khoảnh khắc': 'BK', 'trước sau': 'TS', 'tin nhắn': 'TI'", vi: 'mã ngắn năm kiểu mới' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/diem_cham.py', co: '"chon phe": "chọn phe", "binh luan": "bình luận"', vi: 'sổ điểm chạm nhận nhãn kiểu mới' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/kieu-moi.py', co: 'os.environ["ETP_NUT_TU"] = "cuoi"', vi: 'kiểu mới: nút CTA chỉ ở thẻ cuối (bài học #62014)' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/kieu-moi.py', co: 'kiem_thoai(src, cac_doan(kh[kieu]))', vi: 'kiểu mới qua cổng thoại' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/thu-vien-len.py', co: 'lf, ma, dang, "--da-soat"]', vi: 'đưa lên giữ đúng dạng của bản thư viện' },
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
