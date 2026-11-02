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
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/luat-ethopex.py', co: '_SE_TAT = {int(x[0] or 0) for v in (tat2, tat1, tat_d24', vi: 'có tập camp trong danh sách tắt (T2 · D24 · …)' },
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
  { card: 0, tep: 'apps/web/src/lib/etp-bang-luat.json', co: '"tep": "ethopex-tat-l4.json"', cam: '"tat_l7"', vi: 'worker tắt theo L4 (sổ luật chung), không còn đường tắt L7' },
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
  { card: 0, tep: 'apps/etp/lich-gio.py', co: 'KHONG_ROAS = "not c.la_roas"', vi: 'luật chấm không tắt camp ★ ROAS' },
  { card: 0, tep: 'apps/cty/worker/ethopex.mjs', co: 'fs.utimesSync(khoa, t, t)', vi: 'khoá nhịp có nhịp tim (nhịp dài lên ROAS không bị nhịp khác chen)' },
  // 28–29/10/2026 — bộ lọc trang Camp (chat): Luật theo đúng thẻ đang hiện, Tuổi, Cây dùng DataTable
  { card: 0, tep: V, mot: 'const chipCamp = (du: DuLieuEtp', vi: 'thẻ luật và bộ lọc Luật cùng một nguồn' },
  { card: 0, tep: V, co: "['luat', hopLuat]", vi: 'bộ lọc Luật áp lên danh sách camp' },
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
  { card: 1484, tep: 'apps/web/src/components/etp-view.tsx', co: "max={maxLai(sd)} mo nhom n=", vi: 'biểu đồ dòng phim (tổng) vẽ cột rỗng viền màu, khác cột đặc của camp' },
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
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/nhan-ban.py', co: 'str(bo) if bo else None, content_id=cid', vi: 'nhân bản / tạo camp truyền phim vào cổng chặn nhóm gốc' },
  { card: 0, tep: 'apps/web/src/components/etp-view.tsx', co: '<CoNuoc nuoc={c.nuoc ?? []} />', vi: 'camp hiện cờ nước giao nhiều chi nhất' },
  { card: 0, tep: 'apps/web/src/components/etp-view.tsx', co: '<NhomGoc g={nhomCua.get(Number(k))} />', vi: 'dòng phim hiện nhóm gốc' },
  { card: 0, tep: 'apps/etp/dong-bo.py', co: '"group_by": ["campaign_name", "geo", "date"]', vi: 'đồng bộ nước giao theo camp (gom geo trần không tách được nhà) + ngày để cổng chia được, không lật trang' },
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
  { card: 0, tep: 'apps/web/src/app/etp/page.tsx', co: "chiXem={quyen.vai !== 'chu'}", vi: 'không phải chủ (admin mos2) thì ẩn nút ghi của nhà' },
  { card: 0, tep: 'apps/web/src/lib/actions/etp-lich.ts', co: "me.role === 'admin' ? me.email : null", vi: 'đặt lịch giờ chỉ admin' },
  { card: 1486, tep: 'apps/web/src/components/etp-view.tsx', co: "label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><BadgeDang d={d} ngan />", vi: 'ô lọc Loại hiện badge màu như cột LOẠI' },
  { card: 1486, tep: 'apps/web/src/components/etp-view.tsx', cam: "label: `${m} · ${d}`, dem:", vi: 'ô lọc Loại không quay lại chữ trơn' },
  // bộ 2: camp tự thắng được miễn khoá bộ lỗ (anh 30/10/2026 "camp thắng phải thu được tối đa doanh thu")
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/nhan-ban.py', co: "etp.bo_chan_mo_camp('{bo}', {int(goc)})", vi: 'nhân bản / thang: cổng bộ lỗ theo từng camp' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/luat-ethopex.py', co: "etp.bo_chan_mo_camp(", vi: 'luật thang: cổng bộ lỗ theo từng camp' },
  // năm kiểu dựng 0đ không theo góc spy (anh 29/10/2026): một sổ nhãn trên etp + sổ điểm chạm; nút CTA chỉ ở thẻ cuối; thư viện nhận bản không từ tập VideoExpress
  { card: 0, tep: 'apps/web/src/components/etp-view.tsx', co: "'chọn phe': 'CP', 'bình luận': 'BL', 'ba khoảnh khắc': 'BK', 'trước sau': 'TS', 'tin nhắn': 'TI'", vi: 'mã ngắn năm kiểu mới' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/diem_cham.py', co: '"chon phe": "chọn phe", "binh luan": "bình luận"', vi: 'sổ điểm chạm nhận nhãn kiểu mới' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/kieu-moi.py', co: 'os.environ["ETP_NUT_TU"] = "cuoi"', vi: 'kiểu mới: nút CTA chỉ ở thẻ cuối (bài học #62014)' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/kieu-moi.py', co: 'kiem_thoai(src, cac_doan(kh[kieu]))', vi: 'kiểu mới qua cổng thoại' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/thu-vien-len.py', co: 'lf, ma, dang, "--da-soat"]', vi: 'đưa lên giữ đúng dạng của bản thư viện' },
  // anh 29/10/2026 "cột trạng thái cho gọn lại … hạn chế phải scroll ngang": cột TT của Cây có bề rộng cố định, không ăn khoảng thừa
  { card: 0, tep: 'apps/web/src/components/etp-view.tsx', co: "{ key: 'tt', header: 'TT', align: 'left', width: 74,", vi: 'cột trạng thái Cây hẹp cố định' },
  // anh 30/10/2026 "chậm quá" → "làm tối ưu triệt để đi": trang gửi bản nhẹ, phần nặng tải theo tab
  { card: 0, tep: 'apps/web/src/app/etp/page.tsx', co: "docEtp(ngCua(quyen, mot('ng')), true)", vi: 'trang etp gửi bản nhẹ' },
  { card: 0, tep: 'apps/web/src/components/etp-view.tsx', co: "const canNang = (tab === 'creative' && (xemCr === 'soat' || xemCr === 'dc')) || tab === 'tv';", vi: 'tab cần phần nặng mới tải bù' },
  { card: 0, tep: 'apps/web/src/lib/etp-doc.ts', co: 'with g as (select coalesce(p.the_loai', vi: 'câu khung giờ gộp theo giờ trước khi gọi khung_vn' },
  // anh 30/10/2026 "vậy điều chỉnh đi": ★ ROAS thắng $20 → $30 cần ROI các ngày tiêu > $16 trên 50% (trước 80%)
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/luat-ethopex.py', co: 'T30_SP, T30_ROI, T30_NGAY = 80, 50, 2', vi: '★ ROAS thắng: ngưỡng ROI 50%' },
  // anh 30/10/2026 "theo dõi … thời điểm lên bậc … chỉ đề xuất": sổ lên bậc team ghi bằng trigger trên camp_ngoai (mọi đường ghi đều vào sổ)
  // đề xuất bậc cho team: máy luật nhà chạy chế độ xem người — cổng chung chặn MỌI lệnh ghi ở chế độ này
  { card: 0, tep: 'apps/etp/ethopex_api.py', co: 'if XEM and body is not None and not duong.startswith("/api/v1/report"): raise NgoaiNha(', vi: 'chế độ xem người chặn mọi lệnh ghi' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/luat-ethopex.py', co: 'K_CAMP, K_SO = ("etp.camp_ngoai", "etp.so_ngay_ngoai") if EA.XEM else ("etp.camp", "etp.so_ngay")', vi: 'máy luật đọc kho theo chế độ (nhà / xem người)' },
  { card: 0, tep: 'apps/web/src/components/etp-view.tsx', co: "deXuat ? ' · máy đề xuất (chỉ đề xuất, không làm)' : ' · máy đã xếp làm'", vi: 'camp người khác: bảng xét ghi là đề xuất' },
  { card: 0, tep: 'apps/web/src/lib/etp-doc.ts', co: 'from etp.xet_luat_ngoai where ${cuaNg(sql`nguoi_id`)}', vi: 'xem người: cột Luật đọc đề xuất của máy luật nhà' },
  { card: 0, tep: 'apps/web/src/lib/etp-doc.ts', co: "'máy chưa đề xuất') end luat", vi: 'xem người: lịch sử bậc so với lúc máy đề xuất' },
  // anh 30/10/2026 "Show nhiều nhất data có thể": kiểu xem Lên bậc (bảng phẳng mọi mốc + ROI trước / sau) + nạp lịch sử từ bản sao lưu
  { card: 0, tep: 'apps/web/src/components/etp-view.tsx', co: "const XEM_CAMP_V = ['cay', 'bang', 'lich', 'bac'] as const;", vi: 'tab Camp có kiểu xem Lên bậc' },
  { card: 0, tep: 'apps/web/src/components/etp-view.tsx', co: "<LenBac du={du} hep={hep} />", vi: 'kiểu xem Lên bậc được vẽ' },
  { card: 0, tep: 'apps/etp/bac-ngoai-lich-su.py', co: 'glob.glob("/var/backups/mos2/mos2_prod-*.sql.gz")', vi: 'sổ lên bậc nạp lịch sử từ bản sao lưu hằng ngày' },
  { card: 0, tep: 'packages/db/migrations/0373_etp_bac_ngoai.sql', co: 'after insert or update of ngan_sach on etp.camp_ngoai', vi: 'sổ lên bậc team: trigger bắt mọi lần đổi ngân sách / nhân bản' },
  { card: 1487, tep: 'apps/web/src/components/etp-view.tsx', co: "width: gon ? '100%' : 'auto', fontSize: 11.5", vi: 'bảng xét luật rộng theo nội dung, không giãn cột Điều kiện' },
  { card: 1487, tep: 'apps/web/src/components/etp-view.tsx', co: "t.xet ? { width: 'max-content', minWidth: 340, maxWidth: R }", vi: 'khung nổi xét luật rộng theo nội dung' },
  { card: 1488, tep: 'apps/web/src/components/etp-view.tsx', co: 'dauThanh={nutCay} thanhDinh="var(--etp-dinh, 0px)"', vi: 'Mở hết / Chú giải dính khi cuộn (đứng đầu thanh tìm dính của bảng cây, bố cục 31/10)' },
  { card: 1488, tep: 'packages/bang/src/data-table.tsx', co: "data-comp={thanhDinh ? 'ui.StickyBar' : undefined}", vi: 'thanh tìm bảng dính được — tiêu đề cột dính ngay dưới' },
  // anh 31/10/2026 "bố cục lại chỗ này" (YDNI): tab gãy hai dòng vì một hàng nhồi tab + kỳ + kiểu xem + 6 ô lọc; hai bộ lọc trùng nghĩa
  { card: 0, tep: 'apps/web/src/components/etp-view.tsx', co: '.etp-thanh [data-comp="ui.Segmented"] button,.etp-thanh [data-comp="ui.Segmented"] a{white-space:nowrap}', vi: 'nhãn tab không gãy dòng' },
  { card: 0, tep: 'apps/web/src/components/etp-view.tsx', co: "<span className=\"etp-xuong\" style={{ flexBasis: '100%', height: 0 }} />", vi: 'kiểu xem + bộ lọc xuống hàng 2, tab + kỳ hàng 1' },
  { card: 0, tep: 'apps/web/src/components/etp-view.tsx', mot: 'locTuDong={false} onTimDoi={onTimDoi} khiTimTrong={khiTimTrong} />;   // TT / Luật / Loại tự sinh', vi: 'cây camp không có bộ lọc tự sinh trùng ô Lọc / Luật / Loại' },
  // anh 31/10/2026 PHÂN QUYỀN: Sơn admin (xem hết + sửa camp của Sơn), Kiên chỉ phần của Kiên — dữ liệu cắt TRÊN MÁY CHỦ, một chỗ gác
  { card: 0, tep: 'apps/web/src/app/etp/page.tsx', co: "du={quyen.vai === 'nguoi' ? catChoNguoi(du, quyen.nguoiId!) : du}", vi: 'vai người nhận dữ liệu đã cắt trên máy chủ' },
  { card: 0, tep: 'apps/web/src/app/etp/page.tsx', co: "docEtp(ngCua(quyen, mot('ng')), true)", vi: 'vai người không đổi được ?ng= sang người khác' },
  { card: 0, tep: 'apps/web/src/lib/actions/etp-nang.ts', co: 'if (!xemNha(q)) return { chamCt: {}, pheu: [], diemCham: {}, thuVien: [] };', vi: 'phần nặng (dữ liệu nhà) không tới vai người' },
  { card: 0, tep: 'apps/web/src/lib/actions/etp-cham.ts', co: 'if (!q || !xemNha(q)) return {};', vi: 'chữ chấm creative nhà không tới vai người' },
  { card: 0, tep: 'apps/web/src/lib/etp-quyen.ts', co: "const GIU = ['nhe', 'luc', 'nay', 'ngay', 'camps', 'creatives', 'phims', 'soNgay', 'demNgay', 'theLoai', 'xetLuat', 'xetLuc', 'lsBac'] as const;", vi: 'vai người: danh sách CHO PHÉP, trường mới mặc định rỗng' },
  { card: 0, tep: 'apps/web/src/lib/etp-quyen.ts', cam: "chiHost !== 'etp.on.tc')", vi: 'không gác bằng chi_host — gác bằng sổ etp.quyen' },
  { card: 0, tep: 'apps/etp/ethopex_api.py', co: 'if XEM and body is not None and not duong.startswith("/api/v1/report"): raise NgoaiNha(', vi: 'chế độ xem người vẫn chặn mọi lệnh ghi (chế độ sửa là biến khác)' },
  { card: 0, tep: 'apps/etp/sua-ngoai.py', co: 'os.environ["ETP_SUA_NGUOI"] = str(NG); os.environ.pop("ETP_XEM_NGUOI", None)', vi: 'sửa camp người đi cổng chung chế độ sửa của người (camp ngoài tài khoản người đó bị chặn)' },
  { card: 0, tep: 'apps/web/src/lib/actions/etp-sua.ts', co: 'where c.camp_id = ${campId} and t.nguoi_id = ${ng} and not t.nha', vi: 'sửa camp: camp phải thuộc tài khoản của người sửa' },
  // anh 31/10/2026 "Sơn ko thể sửa camp thông qua api của tao": token Nhà chỉ được XEM tài khoản người khác → chế độ sửa đi bằng phiên Ethopex RIÊNG của người đó
  { card: 0, tep: 'apps/etp/ethopex_api.py', co: 'if SUA: T = khoa_nguoi(SUA)', vi: 'chế độ sửa của người dùng phiên Ethopex của chính người đó, không dùng token Nhà' },
  { card: 0, tep: 'apps/etp/ethopex_api.py', co: 'if not T: raise NgoaiNha(', vi: 'chưa kết nối phiên riêng → không gửi gì (không rơi về token Nhà)' },
  { card: 0, tep: 'apps/etp/sua-ngoai.py', co: 'if t.get("user_id") is not None and t.get("user_id") == nha.get("user_id"): ra(ok=False', vi: 'kết nối: chặn dán phiên của tài khoản Nhà' },
  { card: 0, tep: 'apps/etp/sua-ngoai.py', co: 'input=cau, capture_output=True', vi: 'phiên cất qua STDIN, không qua tham số dòng lệnh' },
  { card: 0, tep: 'apps/web/src/lib/actions/etp-sua.ts', co: 'p.stdin?.end(chuoi);', vi: 'phiên gửi xuống tiến trình con qua STDIN' },
  { card: 0, tep: 'apps/web/src/components/etp-view.tsx', co: '{!het || doiPhien ? <KetNoiEthopex het={het}', vi: '✎ chưa có phiên riêng → hiện ô kết nối thay vì nút sửa' },
  { card: 0, tep: 'apps/web/src/components/etp-view.tsx', co: "    </span>\n    {sua ? <SuaCamp c={c} /> : null}\n  </span>);", vi: '✎ nằm ngoài vùng rê thẻ bậc (không mở chồng thẻ lịch sử bậc)' },
  { card: 0, tep: 'apps/web/src/components/etp-view.tsx', co: "background: 'var(--bg-1)', border: '1px solid var(--accent-line, var(--line))', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.45)' }}>{/* AnchoredPopover không tự có nền", vi: 'ô ✎ có nền (không trong suốt lẫn vào bảng)' },
  // anh 31/10/2026 "cho các tk quyền bật tắt Luật tự động hay chỉ thông báo qua Telegram" — Chat riêng với bot; Tự động chỉ tk Sơn (vai admin etp)
  { card: 0, tep: 'apps/web/src/lib/etp-quyen.ts', co: "return { bao: true, tuDong: adm && q.vai !== 'nguoi' };", vi: 'Tự động chỉ cho người có vai admin etp; vai người chỉ Chỉ báo' },
  { card: 0, tep: 'apps/web/src/lib/actions/etp-sua.ts', co: "if (cheDo === 'tu_dong' && !(await hetPhienEthopex(nguoiId)))", vi: 'Tự động cần phiên Ethopex riêng còn hạn' },
  { card: 0, tep: 'apps/cty/worker/tg-phong.mjs', co: "if (process.env.TG_CHAT && chatTin != null && String(chatTin) !== String(process.env.TG_CHAT)) {", vi: 'tin chat riêng với bot không vào phòng / thư ký (không thành lệnh của anh)' },
  { card: 0, tep: 'apps/cty/worker/etp-rieng.mjs', co: "where d.bao_luc is null and d.lan_dau > coalesce(c.tg_luc, now()) and d.lan_cuoi > now() - interval '2 hours'", vi: 'nhắn riêng chỉ đề xuất mới sau lúc nối, mỗi đề xuất một lần' },
  { card: 0, tep: 'apps/cty/worker/tg-nghe.mjs', co: "await xuTinRieng(tg)", vi: 'dịch vụ nghe xử tin chat riêng + gửi đề xuất' },
  { card: 0, tep: 'deploy.sh', co: 'systemctl restart cty-tg-nghe && echo', vi: 'worker đổi thì deploy khởi động lại dịch vụ nghe' },
  // anh 31/10/2026 Bước 4 "Ngân sách + tắt trước": Luật tự động cho Sơn — luật Nhà, phiên Ethopex của Sơn, gác như Nhà
  { card: 0, tep: 'apps/cty/worker/etp-tu-dong.mjs', co: "and exists (select 1 from etp.quyen q where q.vai = 'admin' and q.nguoi_id = c.nguoi_id)", vi: 'tự động chỉ chạy cho người có vai admin etp (Sơn)' },
  { card: 0, tep: 'apps/cty/worker/etp-tu-dong.mjs', co: "'--may', '--luat', String(v.luat || '').slice(0, 300)", vi: 'máy tự làm đi sua-ngoai.py --may (gác thang / camp chạy / nhịp tăng giảm)' },
  { card: 0, tep: 'apps/cty/worker/etp-tu-dong.mjs', co: "ns(k, luat, (_m, d) => d <= Math.min(cfg.tran, 30))", vi: 'tự tăng theo trần của Nhà, không quá $30' },
  { card: 0, tep: 'apps/etp/sua-ngoai.py', co: 'ly = NT.chan_tang(lambda p: EA.api(p), CID) if ns > cu else NT.chan_giam(lambda p: EA.api(p), CID)', vi: 'máy tự làm qua nhịp tăng / giảm như Nhà' },
  { card: 0, tep: 'apps/cty/worker/nhip.mjs', co: "(await import('./etp-tu-dong.mjs')).nhipTuDong(", vi: 'nhịp Ethopex chạy luật tự động cho team' },
  // Bước 4b (anh 31/10/2026): nhân bản + lên ROAS cho tài khoản team trên khuôn camp gốc, bằng phiên của người đó, không dính sổ bộ nhà
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/nhan-ban.py', co: 'bo = None if NGOAI else (bo or bo_cua_camp(c) or "1")', vi: 'camp team không bị đổi sang tài khoản / Page bộ nhà' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/nhan-ban.py', co: '**({"nguoi": EA.SUA or EA.XEM} if NGOAI else {})})', vi: 'nhân bản camp team ghi nhật ký kèm nguoi — không tính vào đếm trần Nhà (02/11/2026)' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/nhan-ban.py', co: 'content_id=cid, ngoai=bool(NGOAI))', vi: 'camp team bỏ trần ngày / bộ của nhà, vẫn dừng khẩn / Âu-Mỹ' },
  { card: 0, tep: 'apps/cty/worker/etp-tu-dong.mjs', co: "const nbEnv = { ETP_SUA_NGUOI: String(ng) }", vi: 'nhân bản / ROAS team đi phiên Ethopex của chính người đó' },
  { card: 0, tep: 'apps/cty/worker/etp-tu-dong.mjs', co: "m.id > 0 && !seTat.has(m.id) && !giu[`nb:${m.id}`]", vi: 'không nhân bản camp đang chờ tắt' },
  { card: 0, tep: 'apps/cty/worker/etp-tu-dong.mjs', co: "import { ROAS_MUC, ghiG10, daGuiG10, LUAT_TAT_SO, LUAT_HA_SO } from './ethopex.mjs';", vi: 'một danh sách mức ROAS + một chỗ ghi ngày G10 + sổ luật chung cho nhà và team' },
  { card: 0, tep: 'apps/etp/cong.py', co: 'return " duplicate by " in ten or ten.lstrip().startswith("★") or bool(_ROAS_TEAM.search(ten))', vi: 'nhận camp ROAS team đặt tên kiểu _ROAS1 / (ROAS) / Dup by' },
  // hàng góp ý 31/10/2026
  { card: 1492, tep: 'apps/etp/dong-bo.py', co: "g.camp_id = substring(lower(n.ten) from '(?:duplicate by|dup by|_d)", vi: 'bản nhân bản của team thừa hưởng phim + creative từ camp gốc ghi trong tên' },
  { card: 1493, tep: 'apps/web/src/components/etp-view.tsx', co: "<span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, flex: 'none' }}><BadgeDangNgan d={c.dang} />", vi: 'loại + số bản nhân dạt phải ô camp ở cây' },
  { card: 1493, tep: 'packages/bang/src/data-table.tsx', co: "paddingLeft: sau * 14, width: '100%', boxSizing: 'border-box' }}>", vi: 'ô cây giãn đủ bề rộng để nội dung dạt phải được' },
  { card: 1494, tep: 'apps/web/src/components/etp-view.tsx', co: '<TheBac ls={ls ?? []} d={d} c={c} /></KhungNoi>', vi: 'thẻ lịch sử bậc ghi số + tên camp' },
  { card: 1494, tep: 'apps/web/src/components/etp-view.tsx', mot: 'function DauCamp(', vi: 'một đầu thẻ camp dùng chung' },
  { card: 1495, tep: 'apps/web/src/components/etp-view.tsx', co: '<span style={{ color: \'var(--fg-2)\' }}>Người </span><b style={{ fontSize: 14, color: du.nguoi.ngoai', vi: 'dải số gọn khi cuộn ghi người đang xem' },
  { card: 1496, tep: 'apps/web/src/components/ui/chon2.tsx', co: "if (href && (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)) return;", vi: 'ô chọn: ⌘ / Ctrl / ⇧-click mở tab mới' },
  { card: 1496, tep: 'apps/web/src/components/etp-view.tsx', co: 'href={(v) => urlNguoi(v).href}', vi: 'ô Người ⌘ / Ctrl-click mở tab mới' },
  { card: 1497, tep: 'apps/web/src/lib/actions/etp-lam-moi.ts', co: "execFile('systemctl', ['start', '--no-block', 'etp-dong-bo.service']", vi: 'nút Làm mới chạy đúng unit đồng bộ (systemd gộp lượt đang chạy, không chạy song song)' },
  { card: 1497, tep: 'apps/web/src/components/etp-view.tsx', mot: '{chiXem ? null : <NutLamMoi dongBo={du.dongBo} gon={hep} />}', vi: 'nút Làm mới cạnh dòng "đồng bộ HH:MM", một chỗ' },
  { card: 1497, tep: 'apps/web/src/components/etp-view.tsx', co: 'if (lanNay > cho.lan || Date.now() - cho.tu > 600_000)', vi: 'chờ tới khi kho có lượt đồng bộ mới hơn lúc bấm mới thôi đọc lại' },
  { card: 1497, tep: 'apps/web/src/lib/actions/etp-lam-moi.ts', co: "if (tt === 'activating' || tt === 'active') return { ok: true, chay: false, ban:", vi: 'máy đang chạy phần sau của lượt → không để nút chờ một lượt systemd không mở' },
  { card: 1498, tep: 'apps/web/src/components/etp-view.tsx', co: "{hep ? <O0 v={roi(sx)} t={`${t} — tổng các camp đang hiện`}", vi: 'điện thoại: ROI tổng nằm trong dòng tiêu đề dính, không thêm hàng dính' },
  { card: 1498, tep: 'apps/web/src/components/etp-view.tsx', co: 'Tổng {phim.length} phim · $', vi: 'điện thoại: ô đầu dòng tiêu đề ghi số phim + ngân sách đang bật' },
  { card: 1499, tep: 'apps/web/src/components/etp-view.tsx', co: '{nguoiSel()}{coBo ? boSel() : null}{coKy ? kySel() : null}</span>', vi: 'cuộn xuống: ô kỳ lên dòng dính, liền sau Người · TK, vẫn chọn được' },
  { card: 1499, tep: 'apps/web/src/components/etp-view.tsx', co: '{gon && coKy ? kySel() : null}', vi: 'máy tính: hàng tab không còn ô kỳ (đã lên cụm Người · TK · kỳ)' },
  { card: 1499, tep: 'apps/web/src/components/etp-view.tsx', co: '{nguoiSel()}{!gon && coBo ? boSel() : null}{!gon && coKy ? kySel() : null}', vi: 'tiêu đề: ô kỳ liền sau Người · TK (anh 01/11/2026 cùng dòng)' },
  { card: 1499, tep: 'apps/web/src/components/etp-view.tsx', mot: '<ChonKhoang tu={khK.tu}', vi: 'ô kỳ dựng MỘT chỗ (kySel), không chép tay' },
  { card: 1500, tep: 'apps/web/src/components/etp-view.tsx', co: '{lenDinh ? <><span style={{ display: \'inline-flex\', gap: 6, alignItems: \'center\' }}>{nguoiSel()}{coBo ? boSel() : null}', vi: 'dòng dính: đổi Người ngay trên đó + ô TK sau ô Người' },
  { card: 1500, tep: 'apps/web/src/components/etp-view.tsx', co: '{nguoiSel()}{!gon && coBo ? boSel() : null}', vi: 'tiêu đề: ô TK đứng ngay sau ô Người' },
  { card: 1499, tep: 'apps/web/src/components/etp-view.tsx', co: 'e.currentTarget.scrollTop > (gon ? h.offsetTop + h.offsetHeight : 12)', vi: 'máy tính: dòng dính bật ngay khi tiêu đề bắt đầu trôi khỏi màn, không đợi hero' },
  { card: 1498, tep: 'apps/web/src/components/etp-view.tsx', co: "      {gon ? null : thanhTren}\n      </div>\n      {gon ? thanhTren : null}", vi: 'điện thoại chỉ 1–2 dòng dính: hàng tab · kỳ · Lọc nằm ngoài khung dính (anh 01/11/2026)' },
  { card: 1498, tep: 'apps/web/src/components/etp-view.tsx', co: "position: gon ? undefined : 'sticky', top: 0, zIndex: 5,", vi: 'hàng tab không tự dính trên điện thoại' },
  { card: 'bo2-0111', tep: 'apps/xuong-video/scripts/ethopex/luat-ethopex.py', co: 't2_chi = lambda ns: min(T2_CHI, round(T2_PHAN * 2 * float(ns or 0), 2)) if ns else T2_CHI', vi: 'T2 ngưỡng chi theo ngân sách — camp $1 không lọt luật tắt (anh 01/11/2026)' },
  { card: 'bo2-0111', tep: 'apps/xuong-video/scripts/ethopex/luat-ethopex.py', cam: 'if _c2 >= T2_CHI and _r2 < T2_ROI', vi: 'T2 không quay lại ngưỡng $2.5 cố định' },
  { card: 'token-0211', tep: 'apps/web/src/components/etp-view.tsx', co: 'href="https://app.ethopex.dev/profile"', vi: 'kết nối Ethopex hướng dẫn lấy Token chính thức ở trang Profile (anh 02/11/2026)' },
  { card: 'token-0211', tep: 'apps/web/src/components/etp-view.tsx', cam: 'copy(localStorage.access_token)', vi: 'không quay lại đường F12 / localStorage' },
  { card: 'tran30-0211', tep: 'packages/db/migrations/0400_etp_tran_phim_30.sql', co: "('tran_phim', '30'::jsonb", vi: 'trần 30 camp đang chạy mỗi phim (anh 02/11/2026 "Set lại 30 cho mọi camp nhà")' },
  { card: 'tran30-0211', tep: 'apps/xuong-video/scripts/ethopex/nhan-ban.py', co: '(ntk := dem_tk(cid, pl.get("ad_account_id"))) >= TRAN_PHIM', vi: 'trần phim đếm theo TỪNG tài khoản nhà, tài khoản team không áp' },
  { card: 'tran30-0211', tep: 'apps/xuong-video/scripts/ethopex/nhan-ban.py', cam: 'if n >= TRAN_PHIM and not ep', vi: 'không quay lại đếm trần trên cả phim mọi tài khoản' },
  { card: 'tran30-0211', tep: 'apps/xuong-video/scripts/ethopex/luat-ethopex.py', co: 'dang_chay.get((p, tk_cua.get(cid)), 0) >= TRAN_PHIM_CHAY', vi: 'luật NB đếm trần theo (phim, tài khoản)' },
  { card: 'tran30-0211', tep: 'apps/xuong-video/scripts/ethopex/luat-ethopex.py', co: 'TRAN_PHIM_CHAY = (10**6 if EA.XEM else', vi: 'luật NB chạy cho người team không áp trần' },
  { card: 'tran30-0211', tep: 'apps/etp/canh-bao.py', co: 'bao("tran_phim_vuot"', vi: 'cảnh báo phim vượt trần trong một tài khoản' },
  { card: 'tran30-0211', tep: 'apps/etp/canh-bao.py', co: 'if nha and on == so:', vi: 'chỉ đề xuất mở thêm chỗ khi MỌI camp đang chạy của phim lãi đều (anh 02/11/2026)' },
  { card: 'bh-0211', tep: 'apps/etp/canh-bao.py', co: 'chan = f"bão hoà theo dõi: lên thêm {sum(lm.values())} camp mà ROI phim cả hệ', vi: 'phim lên thêm camp mà ROI cả hệ giảm = bão hoà theo dõi (anh 02/11/2026)' },
  { card: 'bh-0211', tep: 'apps/etp/canh-bao.py', co: 'from ({_SO}) s', vi: 'số phim của cổng bão hoà tính trên nhà + team' },
  { card: 'bh-0211', tep: 'apps/etp/canh-bao.py', co: 'bao("bao_hoa_team"', vi: 'tài khoản team lên camp cho phim bão hoà: chỉ cảnh báo' },
  { card: 'bh-0211', tep: 'apps/xuong-video/scripts/ethopex/nhan-ban.py', co: 'if bh and (not moi or bh.startswith("bão hoà")): raise ChanLuat', vi: 'nhà: phim bão hoà chặn cả creative mới; luật khác chỉ chặn nhân bản' },
  { card: 'bh-0211', tep: 'apps/xuong-video/scripts/ethopex/nhan-ban.py', co: 'if not ep and not NGOAI:   # CỔNG BÃO HOÀ PHIM', vi: 'team không bị cổng bão hoà chặn (anh: chỉ cảnh báo); camp ROAS đi roas_main không qua cổng' },
  { card: 'bh-0211', tep: 'apps/xuong-video/scripts/ethopex/luat-ethopex.py', co: 'chan_phim = {} if EA.XEM else', vi: 'luật NB chạy cho team không bị cổng bão hoà chặn' },
  // anh 02/11/2026 "đổi đi để nhận diện đầy đủ. Camp của Kiên nhiều cái ko set tên": camp ROAS nhận theo CHIẾN LƯỢC THẦU THẬT (source_bidding_strategy), tên chỉ khi chưa có
  { card: 'roas-cl-0211', tep: 'packages/db/migrations/0401_etp_la_roas_chien_luoc.sql', co: "case when chien_luoc is not null then chien_luoc = 'LOWEST_COST_WITH_MIN_ROAS'", vi: 'cột la_roas: chiến lược thầu trước tên' },
  { card: 'roas-cl-0211', tep: 'apps/etp/dong-bo.py', co: '"chien_luoc": c.get("source_bidding_strategy")} for c in ngoai]', vi: 'kho team lưu chiến lược thầu' },
  { card: 'roas-cl-0211', tep: 'apps/etp/dong-bo.py', co: 'chien_luoc = coalesce(x.cl, c.chien_luoc)', vi: 'kho nhà cập nhật chiến lược thầu mỗi lượt' },
  { card: 'roas-cl-0211', tep: 'apps/etp/cong.py', co: 'if cl: return cl == "LOWEST_COST_WITH_MIN_ROAS"', vi: 'máy luật: chiến lược thật thắng tên' },
  { card: 'roas-cl-0211', tep: 'apps/web/src/lib/etp-roas.ts', co: "if (x.chien_luoc) return x.chien_luoc === 'LOWEST_COST_WITH_MIN_ROAS';", vi: 'giao diện: chiến lược thật thắng tên' },
  { card: 'roas-cl-0211', tep: 'apps/xuong-video/scripts/ethopex/nhan-ban.py', cam: "ten not like '★%'", vi: 'nhân bản không lọc camp ROAS theo tên' },
  { card: 'roas-cl-0211', tep: 'apps/etp/canh-bao.py', cam: "ten not like '★%'", vi: 'cảnh báo không lọc camp ROAS theo tên' },
  { card: 'roas-cl-0211', tep: 'apps/web/src/lib/etp-doc.ts', cam: "c.ten like '★%'", vi: 'màn etp không lọc camp ROAS theo tên' },
  { card: 'roas-cl-0211', tep: 'apps/web/src/components/etp-view.tsx', cam: 'laRoas(c.ten)', vi: 'màn etp truyền cả camp (chiến lược) vào laRoas' },
  // anh 02/11/2026 "Đồng bộ và làm theo đề xuất vào đây" (tab Phim): trang phim workspace Ethopex — đồng bộ, cổng nhan-ban, cảnh báo, cột Trang phim
  { card: 'trang-phim-0211', tep: "packages/db/migrations/0403_etp_trang_phim.sql", co: "create or replace view etp.trang_phim_v", vi: "view trang phim + cột thiếu" },
  { card: 'trang-phim-0211', tep: "apps/etp/dong-bo.py", co: "import trang_phim; kq.update(trang_phim.chay(q, EA.T_NHA))", vi: "đồng bộ trang phim workspace mỗi lượt" },
  { card: 'trang-phim-0211', tep: "apps/etp/trang_phim.py", co: "return (False, f\"HTTP {e.code}\") if e.code in (404, 410) else (None, f\"HTTP {e.code}\")", vi: "chỉ 404/410 là link chết; 403/429/mạng không chặn" },
  { card: 'trang-phim-0211', tep: "apps/xuong-video/scripts/ethopex/nhan-ban.py", co: "if not ep and (ly_ := trang_chua_san(cid, pl.get(\"ad_account_id\"))", vi: "cổng trang phim trước khi lên camp thường" },
  { card: 'trang-phim-0211', tep: "apps/xuong-video/scripts/ethopex/nhan-ban.py", co: "interval '2 hours' from etp.trang_phim\") != \"t\": return None", vi: "kho trang phim cũ thì cổng không chặn" },
  { card: 'trang-phim-0211', tep: "apps/etp/canh-bao.py", co: "bao(\"trang_phim_thieu\", \"vang\"", vi: "cảnh báo trang phim thiếu" },
  { card: 'trang-phim-0211', tep: "apps/web/src/components/etp-view.tsx", co: "{ key: 'trang', header: 'Trang phim'", vi: "tab Phim có cột Trang phim" },
  { card: 'trang-phim-0211', tep: "apps/web/src/lib/etp-doc.ts", co: "trang: tp(r), ws_moi: true });", vi: "tab Phim hiện phim mới thêm chưa có camp" },
  { card: 'trang-phim-0211', tep: "apps/etp/trang_phim.py", co: "it[\"_link\"] = dr if dr.startswith(\"http\") else (pg.get(dr)", vi: "link tập 1 theo chuỗi detail → trang con" },
  { card: 'trang-phim-0211', tep: "apps/etp/trang_phim.py", co: "mo_ta = len(it.get(\"description\") or \"\") if it is not None else so_cu(1)", vi: "bản chưa đọc chi tiết = chưa biết, không tính thiếu" },
  { card: 'trang-phim-0211', tep: "packages/db/migrations/0404_etp_trang_phim_chua_doc.sql", co: "alter column mo_ta drop not null", vi: "mô tả NULL = chưa đọc" },
  { card: 'trang-phim-0211', tep: "apps/etp/trang_phim.py", co: "if not url.startswith(\"http\"): return (None, f\"trang Ethopex: {url}\")", vi: "bước Movie của Ethopex không bị coi là link chết" },
  { card: 'trang-phim-0211', tep: "apps/etp/trang_phim.py", co: "urllib.parse.quote(url, safe=\":/?&=%#@+,;~\")", vi: "link NetShort có dấu được mã hoá" },
  { card: 'trang-phim-0211', tep: "apps/xuong-video/scripts/ethopex/nhan-ban.py", co: "— tài khoản nhà chỉ lên camp phim đã thêm\" if nha_ == \"t\" else None", vi: 'chưa thêm bản chỉ chặn tài khoản nhà (đội chạy được phim không có bản)' },
  { card: 'trang-phim-0211', tep: "apps/xuong-video/scripts/ethopex/nhan-ban.py", co: "case when nha then 't' else 'f' end", vi: 'cổng đọc đúng cờ nhà (boolean nối chuỗi ra true, không phải t)' },
  // anh 02/11/2026 "làm mới thư viện đi. Và phim nào có thể test thì đánh dấu vào. phim cất cũng thế"
  { card: 'thu-vien-0211', tep: "apps/etp/thu_vien_phim.py", co: "/api/v2/contents?page={p}&page_size=100&content_type_id=1&is_ref=0&hl={hl}", vi: "làm mới thư viện phim EN/ES từ Ethopex" },
  { card: 'thu-vien-0211', tep: "apps/etp/thu_vien_phim.py", cam: "nguon, ma_goc, nap_luc)", vi: "không ghi cột tự tính nguon / ma_goc" },
  { card: 'thu-vien-0211', tep: "apps/etp/dong-bo.py", co: "import thu_vien_phim; kq.update(thu_vien_phim.chay(EA.T_NHA))", vi: "đồng bộ thư viện mỗi lượt" },
  { card: 'thu-vien-0211', tep: "apps/etp/dong-bo.py", co: "\"chon-phim-moi.py\"), \"--co-the-test\"]", vi: "chấm phim có thể test mỗi lượt" },
  { card: 'thu-vien-0211', tep: "apps/xuong-video/scripts/ethopex/chon-phim-moi.py", co: "if \"--co-the-test\" in sys.argv:", vi: "chế độ có thể test không đụng hàng chờ 200 phim" },
  { card: 'thu-vien-0211', tep: "apps/xuong-video/scripts/ethopex/chon-phim-moi.py", co: ".get(\"tt\", \"\")).endswith(\"_loai\")]", vi: "phim bị quy trình phim mới loại không còn là có thể test" },
  { card: 'thu-vien-0211', tep: "apps/xuong-video/scripts/ethopex/chon-phim-moi.py", co: "da = {int(x) for x in q(\"select distinct content_id from etp.camp where content_id > 0\").split() if x.isdigit()}", vi: "phim đã lên đọc từ kho etp" },
  { card: 'thu-vien-0211', tep: "apps/web/src/components/etp-view.tsx", co: "{ key: 'hang', header: 'Hạng'", vi: "tab Phim: Trạng thái gộp + cột Hạng số (không lặp cặp Trạng thái / Test)" },
  { card: 'thu-vien-0211', tep: "apps/web/src/lib/etp-doc.ts", co: "trang: null, test, ung_vien: true });", vi: "tab Phim hiện 200 phim có thể test chưa có camp" },
  { card: 'thu-vien-0211', tep: "apps/web/src/components/etp-so.tsx", co: "color: !v ? MO_SO : undefined", vi: "số đếm 0 in mờ (YDNI) — component chung" },
  { card: 'thu-vien-0211', tep: "apps/web/src/components/etp-view.tsx", cam: "cell: (p) => p.creative,", vi: "tab Phim không in số đếm trần" },
  { card: 'thu-vien-0211', tep: "apps/web/src/components/etp-view.tsx", cam: "cell: (r) => r.camp,", vi: "bảng ngày không in số đếm trần" },
  { card: 'thu-vien-0211', tep: "apps/web/src/components/etp-tong2-widget.tsx", cam: "cell: (k) => k.camp }", vi: "Tổng quan 2 không in số đếm trần" },
  { card: 'thu-vien-0211', tep: "apps/web/src/components/etp-view.tsx", co: "{ key: 'nguon_ph', header: 'Nguồn'", vi: "lọc theo nguồn phim" },
  { card: 'thu-vien-0211', tep: "apps/web/src/components/etp-view.tsx", co: "{ key: 'nhom_ph', header: 'Nhóm chọn phim'", vi: "lọc theo nhóm thể loại chọn phim" },
  { card: 'thu-vien-0211', tep: "apps/web/src/components/etp-view.tsx", co: "{ key: 'tt_ph', header: 'Trạng thái'", vi: "lọc theo trạng thái có thể test / đã cất / có camp" },
  { card: 'thu-vien-0211', tep: "apps/xuong-video/scripts/ethopex/chon-phim-moi.py", co: "def loai(x): return x[\"id\"] in ws_ban or", vi: "bản workspace không phải phim thư viện" },
  { card: 'thu-vien-0211', tep: "apps/etp/thu_vien_phim.py", co: "and not x.get(\"ref_id\") and not x.get(\"user_id\")]", vi: "không nạp bản workspace vào thư viện" },
  { card: 'qc-fb-0211', tep: "apps/xuong-video/scripts/ethopex/qc-fb-phim.py", co: "insert into tu_khoa (tu, nuoc, bat, tao, ngach, nguon) select tu, 'US', true, now(), 'phim_ngan', 'etp_phim'", vi: "tên phim vào từ khoá spy để tra Thư viện QC Meta" },
  { card: 'qc-fb-0211', tep: "apps/xuong-video/scripts/ethopex/qc-fb-phim.py", co: "like '%' || k.c || '%'", vi: "chỉ đếm QC có đúng tên phim" },
  { card: 'qc-fb-0211', tep: "apps/xuong-video/scripts/ethopex/chon-phim-moi.py", co: "if fb and fb[\"qc_dang\"] >= QC_NHIEU: return None", vi: "phim nhiều QC FB (≥ 25) bị loại" },
  { card: 'qc-fb-0211', tep: "apps/xuong-video/scripts/ethopex/chon-phim-moi.py", co: "it = (20 if fb[\"qc_dang\"] == 0 else 10 if fb[\"qc_dang\"] <= 5 else 0) if fb else 0", vi: "ít QC FB được cộng điểm" },
  { card: 'qc-fb-0211', tep: "apps/xuong-video/scripts/ethopex/chon-phim-moi.py", cam: "spy = min(20, int(x.get(\"so_qc_dang\") or 0) + 2 * int(x.get(\"so_page\") or 0))", vi: "bỏ điểm cộng cho phim nhiều QC" },
  { card: 'qc-fb-0211', tep: "apps/etp/dong-bo.py", co: "\"qc-fb-phim.py\"), \"--dem\"]", vi: "đếm QC FB theo tên phim mỗi lượt" },
  { card: 'qc-fb-0211', tep: "apps/web/src/components/etp-view.tsx", co: "title={p.test ? 'chưa tra — máy cào spy chưa tới phim này' : undefined}>—</span>", vi: "phim chưa tra QC FB hiện — mờ, không hiện 0" },
  { card: 'phim-ydni-0211', tep: "apps/web/src/components/etp-view.tsx", cam: "🧪", vi: 'tab Phim không emoji, không lặp chữ có thể test' },
  { card: 'phim-ydni-0211', tep: "apps/web/src/components/etp-view.tsx", cam: "— chưa thêm</span>", vi: 'trang phim trống in — mờ' },
  { card: 'phim-ydni-0211', tep: "apps/web/src/components/etp-view.tsx", cam: "{p.ten ?? p.content_id} <span style={{ color: 'var(--fg-2)', fontSize: 11 }}>{p.locale ?? ''} {p.nguon ?? ''}</span>", vi: 'ô tên phim không lặp tiếng / nguồn' },
  { card: 'ngan-phim-0211', tep: "apps/web/src/lib/entity-drawer.ts", co: "'contact', 'etp-phim']", vi: "ngăn phim etp đăng ký vào host chung (xếp chồng, URL)" },
  { card: 'ngan-phim-0211', tep: "apps/web/src/components/entity-drawer-host.tsx", co: "case 'etp-phim': return <EtpPhimDrawer id={id} onClose={onClose} />;", vi: "host mở ngăn phim theo mã" },
  { card: 'ngan-phim-0211', tep: "apps/web/src/components/etp-view.tsx", co: "onClick={() => openEntityDrawer('etp-phim', p.content_id)}", vi: "bấm tên phim mở ngăn nội dung" },
  { card: 'ngan-phim-0211', tep: "apps/web/src/lib/actions/etp-phim.ts", co: "/api/v2/movie/groups/${encodeURIComponent(String(tv.nhom_id))}", vi: "ngăn phim đọc nội dung thật từ Ethopex" },
  { card: 'ngan-phim-0211', tep: "apps/etp/thu_vien_phim.py", co: "insert into etp.thu_vien_phim (content_id, nhom_id", vi: "thư viện ghi group_id + poster cho ngăn phim" },
  { card: 'ngan-phim-0211', tep: "apps/xuong-video/scripts/ethopex/chon-phim-moi.py", co: "x[\"diem_ct\"] = ", vi: "bảng điểm từng tiêu chí" },
  { card: 'ngan-phim-0211', tep: "apps/web/src/components/etp-view.tsx", co: "defaultSort={[{ key: 'hang', dir: 'asc' }]}", vi: "tab Phim xếp theo hạng điểm" },
  { card: 'ngan-phim-0211', tep: "apps/web/src/lib/actions/etp-phim.ts", cam: "from etp.thu_vien where", vi: 'ngăn phim không đọc nhầm bảng thư viện creative' },
  { card: 'nhan-phim-0211', tep: "packages/db/migrations/0407_etp_phim_nhan.sql", co: "when n.het_luc > now() then 'giu'", vi: "nhận phim giữ 24 giờ, quá hạn tự nhả" },
  { card: 'nhan-phim-0211', tep: "apps/web/src/lib/actions/etp-phim.ts", co: "export async function nhanPhimEtp(id: number)", vi: "thành viên nhận phim" },
  { card: 'nhan-phim-0211', tep: "apps/web/src/lib/actions/etp-phim.ts", co: "if (g && g.nguoi_id !== ng.nguoiId) return { loi:", vi: "không nhận phim người khác đang giữ" },
  { card: 'nhan-phim-0211', tep: "apps/web/src/components/etp-phim-drawer.tsx", co: "Nhận phim (giữ 24 giờ)", vi: "nút nhận phim trong ngăn phim" },
  { card: 'nhan-phim-0211', tep: "apps/web/src/components/etp-view.tsx", co: "{ key: 'nhan', header: 'Người nhận'", vi: "tab Phim cột Người nhận" },
  { card: 'nhan-phim-0211', tep: "apps/xuong-video/scripts/ethopex/nhan-ban.py", co: "or giu_boi_nguoi_khac(cid, pl.get(\"ad_account_id\"))): raise ChanLuat(ly_)", vi: "máy không lên camp phim người khác đang giữ" },
  { card: 'nhan-phim-0211', tep: "apps/web/src/lib/actions/etp-phim.ts", co: "// DỰ PHÒNG: Ethopex chỉ trả chi tiết cho bản trong WORKSPACE", vi: "ngăn phim đọc mô tả trang nguồn khi Ethopex 404" },
  { card: 'nhan-phim-0211', tep: "apps/web/src/lib/etp-doc.ts", co: "for (const [ma, r] of nhTheo) if (!coDong.has(ma))", vi: 'phim đang nhận luôn có dòng trên tab Phim' },
  { card: 'nhan-phim-0211', tep: "apps/web/src/components/etp-view.tsx", co: "p.nhan?.trang_thai === 'giu' ? 'Đang nhận'", vi: 'trạng thái Đang nhận lọc được' },
  { card: 'nhan-tu-dong-0211', tep: "packages/db/migrations/0408_etp_phim_nhan_tien_do.sql", co: "create or replace view etp.phim_nhan_td", vi: "view tiến độ phim nhận" },
  { card: 'nhan-tu-dong-0211', tep: "apps/etp/soat_18_ai.py", co: "subprocess.run([\"python3\", K18, \"--soat\", str(int(content_id)), \"ok\" if a[\"dat\"] else \"cam\", ly]", vi: "soát 18+ AI ghi qua đúng lệnh kiem-phim-18 --soat" },
  { card: 'nhan-tu-dong-0211', tep: "apps/etp/nhan_tu_dong.py", co: "where buoc = 'cho_soat' order by id limit {SOAT_LUOT}", vi: "bộ điều phối soát phim mới nhận" },
  { card: 'nhan-tu-dong-0211', tep: "apps/etp/nhan_tu_dong.py", co: "\"khoa\": f\"nhan_phim:{i}:{b}\"", vi: "báo bước hỏng một lần mỗi lượt nhận × bước" },
  { card: 'nhan-tu-dong-0211', tep: "apps/etp/dong-bo.py", co: "import nhan_tu_dong; kq.update(nhan_tu_dong.chay(q))", vi: "điều phối nhận phim mỗi lượt đồng bộ" },
  { card: 'nhan-tu-dong-0211', tep: "apps/xuong-video/scripts/ethopex/hang-ke-chuyen.mts", co: "const diem = nhan.has(p.id) ? 4000 :", vi: "phim nhận tự động đứng đầu hàng đợi máy sinh" },
  { card: 'nhan-tu-dong-0211', tep: "apps/cty/worker/ethopex.mjs", co: "env: { ...process.env, ETP_SUA_NGUOI: String(x.nguoi_id) }", vi: "phim đội nhận lên camp ở tài khoản người nhận" },
  { card: 'nhan-tu-dong-0211', tep: "apps/cty/worker/ethopex.mjs", co: "where content_id = ${Number(d.x.content_id)} and tra_luc is null and het_luc > now()", vi: "lỗi lên camp nhánh nhà ghi vào sổ nhận phim" },
  { card: 'nhan-tu-dong-0211', tep: "apps/web/src/components/etp-view.tsx", co: "{ key: 'td_nhan', header: 'Tiến độ nhận'", vi: "tab Phim cột tiến độ nhận + lỗi" },
  { card: 'menu-phim-0211', tep: "apps/web/src/components/etp-view.tsx", co: "</button><MenuPhim p={p} /></span>, sortValue: (p) => p.ten ?? '' },", vi: 'cột khoá Phim có menu ⋯ (primitive MenuBaCham) Nhận / Trả phim' },
  { card: 'menu-phim-0211', tep: "apps/web/src/components/etp-view.tsx", co: "label: 'Nhận phim (giữ 24 giờ)', emoji: '＋', onClick: () => void lam(() => nhanPhimEtp(p.content_id))", vi: 'menu phim gọi cùng server action nhận phim' },
  { card: 'nhan-tu-dong-0211', tep: "apps/cty/worker/ethopex.mjs", co: "order by exists (select 1 from etp.phim_nhan_v n where n.content_id = r.content_id and n.trang_thai = 'giu') desc, h.luc limit 4", vi: 'phim đang nhận đứng đầu hàng lên camp nhánh nhà' },
  { card: 'nhan-tu-dong-0211', tep: "apps/cty/worker/ethopex.mjs", co: "n.trang_thai = 'giu' and n.nguoi_id not in (select nguoi_id from etp.tai_khoan where nha))", cam: "join etp.tai_khoan t on t.nguoi_id = n.nguoi_id and not t.nha", vi: 'hàng nhà: người nhà = có tài khoản nhà (không coi Tuấn David là đội vì có tk ngoài)' },
  { card: 'nhan-tu-dong-0211', tep: "apps/xuong-video/scripts/ethopex/vx-nap-tap.mts", co: "SELECT id, coalesce(so_hien, thu_tu)::float8 AS thu_tu, thoai, loi_thoai FROM xv_canh", vi: 'máy sinh nạp tập: thu_tu numeric ép số (tên tệp + chiThuTu)' },
  // anh 02/11/2026 duyệt review luật (mục 2, 3, 7 + T30 ROAS): chấm creative không tắt camp lãi · ROAS trước clone · dừng clone đổi creative · nhật ký team · sổ luật đối chứng + 7 ngày
  { card: 'review-luat-0211', tep: "apps/etp/lich-gio.py", co: "where c.trang_thai = 'ACTIVE' and g.tat and {KHONG_ROAS} and {KHONG_LAI3} order by 1", vi: "luật chấm không tắt camp lãi 3 ngày đã khép" },
  { card: 'review-luat-0211', tep: "apps/etp/lich-gio.py", cam: "tự tắt mọi loại camp, kể cả đang lãi", vi: "luật chấm không còn tắt camp đang lãi" },
  { card: 'review-luat-0211', tep: "apps/xuong-video/scripts/ethopex/luat-ethopex.py", co: "_roas_truoc = {int(x[0] or 0) for x in moc30}; nb = [x for x in nb if int(x[0] or 0) not in _roas_truoc]", vi: "ROAS trước nhân bản" },
  { card: 'review-luat-0211', tep: "apps/xuong-video/scripts/ethopex/luat-ethopex.py", co: "T30_THUONG_DUNG, T30_ROAS_DUNG = True, False", vi: "T30 camp thường dừng, ★ ROAS chạy (anh 02/11/2026)" },
  { card: 'review-luat-0211', tep: "apps/xuong-video/scripts/ethopex/luat-ethopex.py", co: "if T30_THUONG_DUNG: tang30 = []", vi: "T30 camp thường không vào danh sách tăng" },
  { card: 'review-luat-0211', tep: "apps/etp/so-luat.py", co: "if m == \"t30\" and h[\"camp_id\"] in la_roas: m = \"t30_roas\"", vi: "sổ luật tách T30 ROAS để theo dõi" },
  { card: 'review-luat-0211', tep: "apps/web/src/lib/etp-bang-luat.json", co: "\"t30_roas\":  [\"★ $30\"", vi: "bản luật có dòng T30 ROAS" },
  { card: 'review-luat-0211', tep: "apps/xuong-video/scripts/ethopex/nhan-ban.py", co: "if dt.date.today() <= CLONE_KHAC_CR_DEN:", vi: "tạm dừng clone sang creative khác" },
  { card: 'review-luat-0211', tep: "apps/xuong-video/scripts/ethopex/nhan-ban.py", co: "    if that: ghi_nhat_ky(kq, luat, ai)", vi: "nhân bản team cũng ghi nhật ký" },
  { card: 'review-luat-0211', tep: "apps/xuong-video/scripts/ethopex/nhan-ban.py", co: "and x->>'nguoi' is null", vi: "dòng nhật ký team không tính vào trần Nhà" },
  { card: 'review-luat-0211', tep: "apps/etp/sua-ngoai.py", co: "nhat_ky.ghi(q, {\"viec\": viec, \"id\": CID", vi: "việc tài khoản team ghi etp.nhat_ky" },
  { card: 'review-luat-0211', tep: "apps/cty/worker/etp-tu-dong.mjs", co: "'--may', '--luat', String(v.luat", vi: "máy team truyền luật vào nhật ký" },
  { card: 'review-luat-0211', tep: "apps/etp/so-luat.py", co: "hieu_qua=round(dl - dc, 2)", vi: "sổ luật đo có đối chứng" },
  { card: 'review-luat-0211', tep: "apps/etp/so-luat.py", co: "so_[\"k7\"] = ", vi: "sổ luật thêm cửa sổ 7 ngày" },
  { card: 'review-luat-0211', tep: "apps/web/src/lib/etp-bang-luat.json", co: "\"nhat_ky\": [\"tat\", \"^PL \\\\(\"]", vi: "PL máy tách khỏi lô tắt tay \"PL bộ 2\"" },
  { card: 'review-luat-0211', tep: "apps/web/src/components/etp-view.tsx", co: "c('hq', 'Hiệu quả thật'", vi: "bản luật hiện hiệu quả có đối chứng" },
  // anh 02/11/2026 "bật phần góp ý cho tk của Sơn": người có quyền etp thấy nút Góp ý trên etp.on.tc, chỉ đụng card mình gửi
  { card: 'gopy-son-0211', tep: 'apps/web/src/app/layout.tsx', co: "const coGopY = u?.role === 'admin' || (host === 'etp.on.tc' && !!(await quyenEtp(u)));", vi: 'nút góp ý cho người team etp' },
  { card: 'gopy-son-0211', tep: 'apps/web/src/lib/actions/gop-y-mos2.ts', co: "if (me.role !== 'admin' && !(hom === 'mos2' && laTrangEtp(String(input.trang || '')) && (await quyenEtp(me))))", vi: 'gửi góp ý: người team chỉ từ trang etp' },
  { card: 'gopy-son-0211', tep: 'apps/web/src/lib/actions/gop-y-mos2.ts', co: "AND lower(prep_payload->'trao_doi'->0->>'nguoi') = lower(${me.email})`}\n    RETURNING id, project_id", vi: 'người team chỉ trả lời card của mình' },
  { card: 1501, tep: 'apps/web/src/components/etp-tong2.tsx', cam: "borderColor: ra ?", vi: 'widget Tổng quan 2 không ghi đè borderColor lên shorthand border của Panel (React xoá viền → trắng gắt)' },
  { card: 1501, tep: 'apps/web/src/components/etp-tong2.tsx', co: "border: `1px solid ${ra ? '#f87171' : sua ? 'var(--accent)' : 'var(--line)'}`", vi: 'viền widget viết đủ shorthand, mặc định var(--line)' },
  { card: 1502, tep: 'apps/web/src/components/ui/chon2.tsx', co: "autoFocus={typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches}", vi: 'ô chọn không tự focus ô tìm trên màn cảm ứng (bàn phím điện thoại bật che danh sách)' },
  { card: 1502, tep: 'apps/web/src/components/ui/chon2.tsx', cam: '<input autoFocus value={q}', vi: 'không quay lại autoFocus vô điều kiện' },
  { card: 'bo2-0211', tep: 'apps/xuong-video/scripts/ethopex/luat-ethopex.py', co: 'BO_PL = [] if EA.XEM else [str(x) for x in _ch("bo_tat_phim_lo", [])]', vi: 'luật PL tắt camp nhỏ của phim lỗ 7 ngày ở bộ trong etp.cau_hinh.bo_tat_phim_lo (anh 02/11/2026)' },
  { card: 'bo2-0211', tep: 'apps/xuong-video/scripts/ethopex/luat-ethopex.py', co: '"tat_pl": m(tat_pl)', vi: 'PL xuất ra --json để worker tắt (báo trước một nhịp)' },
  { card: 'bo2-0211', tep: 'apps/web/src/lib/etp-bang-luat.json', co: '"tat_pl":    { "ma": "pl"', vi: 'PL có mục trong sổ luật chung (worker, trang etp đọc từ đây)' },
  { card: 'bo2-0211', tep: 'apps/xuong-video/scripts/ethopex/nhan-ban.py', co: 'if not NGOAI and not ep and str(bo) in BO_CHI_PHIM_LAI and not nhan_boi_chu_tk(cid, pl.get("ad_account_id")):', vi: 'bộ 2 chỉ mở camp cho phim đã lãi 7 ngày ở bộ đó (etp.cau_hinh.bo_chi_phim_lai); phim chủ tài khoản đang nhận thì miễn (anh 02/11/2026 "Bộ 2")' },
  { card: 'l3-69314', tep: 'apps/xuong-video/scripts/ethopex/luat-ethopex.py', co: 'l3_chi = lambda ns: min(L3_CHI, round(L3_PHAN * float(ns), 2)) if ns else L3_CHI', vi: 'L3 ngưỡng chi mỗi ngày theo ngân sách — camp $1 chi $0.7–0.98 lỗ liền không lọt (anh 01/11/2026 #69314)' },
  { card: 'l3-69314', tep: 'apps/xuong-video/scripts/ethopex/luat-ethopex.py', cam: '_m[k][1] >= L3_CHI and', vi: 'L3 không quay lại ngưỡng $1 cố định' },
  { card: 'bo2-0111', tep: 'apps/xuong-video/scripts/ethopex/nhan-ban.py', co: 'if moi and not NGOAI and BO_DANG_CHAN.get(str(bo)):', vi: 'bộ 2 chỉ lên cảnh cuối — cổng dạng creative theo etp.cau_hinh.bo_dang_chan' },
  { card: 1500, tep: 'apps/web/src/components/etp-view.tsx', cam: '{!gon ? <>{laiSel()}{tuoiSel()}{luatSel()}{dangSel()}{boSel()}</> : null}', vi: 'máy tính: ô TK không quay lại hàng lọc' },
  // anh 01/11/2026 "việc này quan trọng, fix ngay" (#70177: 15 dòng lỗi giống hệt): nhật ký máy một đường ghi, chặn dòng lỗi lặp; kho khoá NULL bằng nhau
  { card: 0, tep: 'apps/etp/nhat_ky.py', co: "where ten = 'ethopex_nhat_ky' and not {lap}", vi: 'nhật ký studio: dòng lỗi trùng trong 24 giờ không ghi lại' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/lam-ethopex.py', cam: "jsonb_build_array('{v}'::jsonb)", vi: 'lam-ethopex ghi nhật ký qua nhat_ky.ghi, không tự chép câu update' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/nhan-ban.py', cam: "jsonb_build_array('{v}'::jsonb)", vi: 'nhan-ban ghi nhật ký qua nhat_ky.ghi, không tự chép câu update' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/thay-tu-choi.py', cam: "jsonb_build_array('{v}'::jsonb)", vi: 'thay-tu-choi ghi nhật ký qua nhat_ky.ghi, không tự chép câu update' },
  { card: 0, tep: 'packages/db/migrations/0392_etp_nhat_ky_khong_trung.sql', co: 'nulls not distinct', vi: 'etp.nhat_ky khoá một dòng, NULL coi là bằng nhau' },
  { card: 0, tep: 'apps/etp/cong.py', mot: 'LY_CAT = "', vi: 'một câu lý do phim đã cất dùng chung cho kiem() và phim_chan_len()' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/thay-the.py', co: 'CHAN = cong.phim_chan_len()', vi: 'máy thay camp lọc phim cổng chắc chắn chặn (ngoài Âu-Mỹ · đã cất) trước khi thử lên' },
  { card: 0, tep: 'apps/etp/cong.py', mot: 'LY_AU_MY = "', vi: 'một câu lý do Âu-Mỹ dùng chung cho kiem() và phim_chan_len()' },
  // anh 31/10/2026 "các camp roas của kiên ko thấy đánh dấu vàng": giao diện nhận ROAS team bằng một hàm chung, không chép luật riêng
  { card: 0, tep: 'apps/web/src/lib/etp-roas.ts', mot: 'const ROAS_TEAM = /(?:^|[\\s_(])ROAS[\\d.]*(?=$|[\\s_)])/;', vi: 'giao diện nhận ROAS team cùng luật với cong.py' },
  { card: 0, tep: 'apps/web/src/components/etp-view.tsx', co: "import { laRoas, mucRoas, gocRoas } from '@/lib/etp-roas';", vi: 'tô vàng / tab ROAS dùng hàm chung' },
  { card: 0, tep: 'apps/web/src/components/etp-view.tsx', cam: 'const laRoas = (', vi: 'không chép lại luật nhận ROAS chỉ hiểu kiểu nhà' },
  { card: 0, tep: 'apps/web/src/components/etp-view.tsx', cam: '.match(/roas ([\\d.]+) duplicate by (\\d+)/);', vi: 'tab ROAS đọc mức / gốc bằng hàm chung' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/luat-ethopex.py', co: '_goc_roas = CONG.goc_roas(ds_camp)', vi: 'gốc team đã có ROAS không lên ROAS trùng' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/luat-ethopex.py', cam: 'theo cách tk Nguyễn Sơn chạy', vi: 'mô tả luật (cột Luật mọi người thấy) không mang tên người — bộ chống lộ etp-quyen.kiem.mts bắt 31/10/2026' },
  { card: 0, tep: 'apps/web/src/components/etp-view.tsx', co: "{ key: 'tuoi', header: 'Tuổi', width: 52,", vi: 'cột Tuổi Cây hẹp cố định (không ăn khoảng thừa)' },
  { card: 0, tep: 'apps/web/src/components/etp-view.tsx', co: 'persistKey="etp-cay" minWidth={1100} fixedLayout', vi: 'Cây table-layout fixed: bề rộng cột theo khai báo, máy nào cũng như nhau' },
  { card: 0, tep: 'apps/web/src/components/etp-view.tsx', co: "{ key: 'dem', header: '', align: 'left', cell: () => null },", vi: 'Cây: cột đệm cuối nhận khoảng thừa, không hở giữa bảng' },
  // anh 30/10/2026 "?ng=115…&b=2 sao ko thấy data": ?b= còn sót lọc camp người khác (không thuộc bộ nào) ra 0 dòng
  { card: 0, tep: 'apps/web/src/components/etp-view.tsx', co: "['bo', (c) => !boHieu || c.bo === boHieu]", vi: 'lọc bộ chỉ áp khi bộ có trong dữ liệu đang xem' },
  { card: 0, tep: 'apps/web/src/components/etp-view.tsx', cam: ".filter((c) => !boLoc || c.bo === boLoc)", vi: 'không lọc bộ thẳng theo URL' },
  // anh 30/10/2026 lên Dragon Lord bằng creative tk Sơn: dòng hàng chấm lỗi 'không có trong kho' phải tự về hàng chờ khi creative vào kho
  { card: 0, tep: 'apps/web/src/app/api/ext/etp-cham/route.ts', co: "where trang_thai = 'loi' and loi like 'creative không có trong kho%'", vi: 'hàng chấm tự gỡ lỗi không-có-trong-kho khi creative đã vào kho' },
  // #1489 dòng phim/tổng: ô NAY đọc đúng ô cuối của tongNgay, không số cứng [7]
  { card: 1489, tep: V, co: 'const sd = tongNgay(rs), sn = sd[ngay.length];', vi: 'NAY dòng phim tính từ ô hôm nay' },
  { card: 1489, tep: V, cam: 'roi(sd[7])', vi: 'không đọc hôm nay bằng chỉ số cứng 7' },
  // #1490 kỳ "All time" đứng cuối danh sách mốc
  { card: 1490, tep: V, co: "mocThem={[{ ma: 'tat_ca', nhan: 'All time' }]}", vi: 'mốc All time' },
  { card: 1490, tep: 'apps/web/src/components/ui/chon-khoang.tsx', co: "{m.nhan}</button>)}\n            {(mocThem ?? []).map(", vi: 'mốc riêng đứng sau mốc sẵn' },
  // #1491 thẻ thư viện thiếu ảnh bìa → khung hình video
  { card: 1491, tep: V, co: ": x.video ? <video src={`${x.video}#t=1`} muted playsInline preload=\"metadata\"", vi: 'thẻ thư viện thiếu ảnh thì xem trước bằng video' },
  // anh 30/10: All time lệch Ethopex — số ngày camp team (so_ngay_ngoai) thiếu 19–24/10 vì chỉ kiểm bảng nhà khi quyết kéo lại từ đầu
  { card: 0, tep: 'apps/etp/dong-bo.py', co: "select min(ngay) d from etp.so_ngay union all select min(ngay) from etp.so_ngay_ngoai", vi: 'kéo số ngày từ đầu khi bảng nhà HOẶC bảng team chưa phủ từ đầu' },
  { card: 0, tep: 'apps/etp/ethopex_api.py', cam: 'for tr in range(2, int(d.get("total_pages") or 1) + 1): rows += _goi(', vi: 'report Ethopex không lật trang (máy chủ trả thứ tự lộn → trùng / mất dòng), chia khoảng ngày' },
  { card: 0, tep: 'apps/etp/ethopex_api.py', co: 'phan = [{**b, "filters": {**(b.get("filters") or {}), "hour": h}}', vi: 'report quá một trang thì chia đôi khoảng ngày, một ngày thì chia theo giờ' },
  { card: 0, tep: 'apps/etp/ethopex_api.py', co: 'elif len(cid := list((b.get("filters") or {}).get("campaign_id") or [])) > 1:', vi: 'report một ngày vẫn quá trang thì chia theo lô camp' },
  { card: 0, tep: 'apps/etp/dong-bo.py', co: '"filters": {"campaign_id": ds_camp}, "metric_conditions": []', vi: 'nước giao theo camp lọc camp trong kho (chú thích giữa dòng từng nuốt filters / limit)' },
  // anh 30/10/2026 "Thêm luật tắt cho khớp mọi thứ để nhìn rõ trên màn hình. Ko đc để luật ngầm nào": RL (★ ROAS lỗ) máy tự tắt qua LUAT_TAT, điều kiện hiện trên thẻ xét luật
  { card: 0, tep: 'apps/web/src/lib/etp-bang-luat.json', mot: '"tep": "ethopex-tat-rl.json"', vi: 'RL đi đường báo trước một nhịp rồi máy tắt (sổ luật chung)' },
  { card: 0, tep: 'apps/cty/worker/ethopex.mjs', cam: 'Máy không tự tắt — anh quyết', vi: 'không còn luật ROAS chỉ báo chờ anh' },
  { card: 0, tep: 'apps/cty/worker/ethopex.mjs', cam: 'Camp ROI cộng dồn &gt; 20% máy không tắt', vi: 'tin sắp tắt không hứa cổng không có' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/luat-ethopex.py', co: 'ls.append(L("rl", "RL · ROAS lỗ 2 ngày"', vi: 'thẻ xét luật camp ROAS có điều kiện RL' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/luat-ethopex.py', cam: 'ls.append(L("roas", "Luật ROAS (camp ★)"', vi: 'không còn luật ROAS dk rỗng ghi Đạt' },
  { card: 0, tep: 'apps/web/src/lib/etp-bang-luat.json', co: '"rl":        ["✕ RL", "#f87171", "tat"', vi: 'bản luật nhóm Tắt có RL' },
  // anh 31/10/2026 G10 theo hướng dẫn team (ảnh bộ lọc Ethopex: Active · Budget Daily > 15 · ROI < 15): hạ thẳng về $10, 2 ngày đã khép sau đó vẫn < 15% thì tắt, áp cả ★ ROAS
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/luat-ethopex.py', co: 'G10_NS, G10_DICH, G10_ROI, G10_THEO = 15, 10, 15, 2', vi: 'G10: ngân sách > $15, về $10, ROI < 15%, theo dõi 2 ngày' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/luat-ethopex.py', co: '        if ns <= G10_NS: continue', vi: 'G10 lọc ngân sách > $15 đúng bộ lọc team' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/luat-ethopex.py', co: 'if len(x3) < 3 or c3 < ns', vi: 'G10 chỉ xét camp chạy đủ 3 ngày (anh 31/10/2026)' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/luat-ethopex.py', co: '"đủ 3 ngày", len(_x) >= 3]', vi: 'thẻ G10: chưa đủ 3 ngày là Không áp, không phải Gần' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/luat-ethopex.py', co: 'ls.append(L_g10(cid, ns)); ls.append(L_g10k(cid, ns)); ra[int(cid)] = ls; continue', vi: 'thẻ G10 (cả nhánh kém đi) có ở camp ★ ROAS' },
  { card: 0, tep: 'apps/web/src/lib/etp-bang-luat.json', co: '"g10":       ["↓ G10 về $10", "#fb923c", "giam"]', vi: 'bản luật có nhóm Giảm chứa G10' },
  // anh 31/10/2026 "Bộ lọc, danh sách,.... phải có G10 chứ?": chip sắp chạm / dải lọc, chế độ Tự động tk team đều có G10
  { card: 0, tep: V, co: "const XET_CHIP: Record<string, [string, string]> = Object.fromEntries(Object.entries(BANG_LUAT.the)", vi: 'chip + dải lọc lấy từ sổ luật chung (có G10)' },
  // anh 01/11/2026 "lọc thế nào hiện ra các camp đã tắt theo 1 luật nào đó": nhóm "Đã tắt theo" trong ô Luật + dải luật, từ nhật ký tắt (etp-doc tatLuat)
  { card: 0, tep: 'apps/web/src/lib/etp-doc.ts', co: "ma: luatDaLam(r.viec, r.luat)", vi: 'luật máy đã làm nhận bằng regex nhat_ky của sổ luật chung' },
  { card: 0, tep: V, co: "const NHOM_LAM: Record<string, string> = { tat: 'Đã tắt theo', giam: 'Đã hạ theo' };", vi: 'ô lọc Luật có nhóm Đã tắt theo + Đã hạ theo' },
  { card: 0, tep: V, co: 'filter((t) => t.ngay >= khK.tu && t.ngay <= khK.den)', vi: 'đã tắt theo luật lọc theo kỳ số liệu (anh 01/11/2026)' },
  { card: 0, tep: V, co: "loc === 'all' || luatLoc.startsWith(`${DA_LAM}tat:`) || (loc === 'chay'", vi: 'lọc Đã tắt theo không bắt đổi ô Lọc khỏi Đang chạy (anh 01/11/2026)' },
  { card: 0, tep: V, cam: "dauVao?.lu?.startsWith(TAT_LUAT) ? 'all'", vi: 'mặc định ô Lọc luôn Đang chạy' },
  { card: 0, tep: V, co: "if (luatLoc.startsWith(DA_LAM)) return lamSet.has(", vi: 'lọc camp theo luật máy đã làm (tắt / hạ)' },
  { card: 0, tep: 'apps/web/src/lib/etp-bang-luat.json', co: '"g10":       { "ma": "g10", "huong": "giam"', vi: 'lọc Gần giảm / Gần tắt tính G10 (huong trong sổ)' },
  { card: 0, tep: 'apps/cty/worker/etp-tu-dong.mjs', co: "for (const h of LUAT_HA_SO) ns(h.khoa, h.ten);", vi: 'tk team Tự động hạ theo luật hạ của sổ (G10)' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/luat-ethopex.py', co: 'ngay_ha = _g10.get(int(cid)) if ns <= G10_DICH else None', vi: 'G10 chỉ theo dõi camp ngân sách thật đã về $10' },
  { card: 0, tep: 'apps/cty/worker/etp-tu-dong.mjs', co: "export const TAT = LUAT_TAT_SO.filter((x) => !x.nha)", vi: 'tk team Tự động tắt theo mọi luật tắt của sổ (có G10)' },
  // anh 31/10/2026 "Bên tk của Sơn ko thấy danh sách Luật & cảnh báo à?": người trong team đọc đề xuất máy luật (de_xuat_bac) + bản luật chung
  { card: 0, tep: 'apps/web/src/lib/etp-doc.ts', co: 'select d.luat nhom, d.camp_id, d.chu, d.lan_cuoi::text luc from etp.de_xuat_bac d', vi: 'luật & cảnh báo của người team đọc de_xuat_bac' },
  { card: 0, tep: 'apps/web/src/lib/etp-doc.ts', co: 'run<{ ma: string; luc: string; so: Omit<SoLuat', vi: 'bản luật hiện cho mọi tài khoản' },
  { card: 0, tep: V, cam: "du.nguoi.ngoai ? '—' : <ChipLuat", vi: 'cột Luật không để trống ở tk team' },
  { card: 0, tep: 'apps/web/src/lib/etp-bang-luat.json', mot: '"tep": "ethopex-tat-g10.json"', vi: 'G10 bước tắt đi đường báo trước một nhịp' },
  { card: 0, tep: 'apps/cty/worker/ethopex.mjs', co: "'--luat', `${LH.ten} · ${m.chu}`", vi: 'máy tự hạ theo luật hạ của sổ (G10)' },
  { card: 0, tep: 'apps/web/src/lib/etp-bang-luat.json', co: '"nhat_ky": ["tat", "^RL "]', vi: 'số luật RL đếm từ nhật ký (sổ luật chung)' },
  // SỔ LUẬT CHUNG (anh 01/11/2026 "chắp vá à. Tìm nguyên nhân gốc"): danh sách luật chỉ ở etp-bang-luat.json — cấm chép tay lại ở 7 tệp đọc nó
  { card: 0, tep: V, cam: "const LUAT_NHAN: Record<string, [string, string, string, 'dang' | 'gan']> = {", vi: 'thẻ luật không chép tay — đọc sổ' },
  { card: 0, tep: V, cam: "const NHOM_LUAT: [string, string, string[]][] = [", vi: 'nhóm bản luật không chép tay — đọc sổ' },
  { card: 0, tep: V, cam: "const BAO_HUONG: Record<string, 'tang' | 'giam' | 'tat'> = {", vi: 'hướng Gần tăng / giảm / tắt không chép tay — đọc sổ' },
  { card: 0, tep: 'apps/cty/worker/ethopex.mjs', cam: "const LUAT_TAT = [", vi: 'luật tắt worker không chép tay — đọc sổ' },
  { card: 0, tep: 'apps/cty/worker/ethopex.mjs', co: "const seTat = new Set(LUAT_TAT_SO.flatMap(", vi: 'seTat theo mọi luật tắt của sổ' },
  { card: 0, tep: 'apps/cty/worker/etp-tu-dong.mjs', cam: "export const TAT = [", vi: 'luật tắt team không chép tay — đọc sổ' },
  { card: 0, tep: 'apps/etp/de-xuat-ngoai.py', co: 'LOAI = {k: v["de_xuat"] for k, v in', vi: 'loại đề xuất team đọc sổ' },
  { card: 0, tep: 'apps/etp/so-luat.py', co: 'MA = [(v["nhat_ky"][0], v["nhat_ky"][1], v["ma"]) for v in BANG["khoa"].values()', vi: 'so-luat nhận luật bằng sổ' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/luat-ethopex.py', co: '_thieu = sorted(k for k in ra_ if k != "luc" and k not in BANG_LUAT["khoa"])', vi: 'máy luật tự báo khoá chưa có trong sổ' },
  { card: 0, tep: 'apps/web/src/lib/etp-bang-luat.json', co: '"g10_theo":  { "ma": "g10", "huong": "giam", "nhan": ["⏸", "G10 theo dõi"', vi: 'camp G10 đang theo dõi có thẻ riêng (anh 01/11/2026 "Thiếu luật G10 vừa áp dụng?")' },
  // anh 31/10/2026 "Sửa máy luật. Cái này quan trọng": report 30 ngày 2.159 dòng > trang 1.000 người gọi xin → máy luật dừng hẳn từ 16:41 30/10
  { card: 0, tep: 'apps/etp/ethopex_api.py', co: 'b = {**body, "page": 1, "page_size": TRANG_BC, "limit": TRANG_BC}', vi: 'report luôn xin trang tối đa máy chủ, không theo cỡ người gọi' },
  { card: 0, tep: 'apps/etp/ethopex_api.py', co: '"campaign_id": sorted(int(c["id"]) for c in ds_tat_ca())', vi: 'report dòng camp quá trang thì cổng tự chia lô camp' },
  // anh 31/10/2026 "creative thiếu poster thì có dùng video thumb nào đó đc ko?": nhóm gốc phim thiếu poster chấm trên khung video creative đã chấm
  { card: 0, tep: 'apps/etp/nhom_goc.py', co: 'jsonb_array_elements_text(x.k) with ordinality e(u, n) where n in (3, 7, 11, 15)', vi: 'nhóm gốc thiếu poster lấy 4 khung video creative đã chấm' },
  { card: 0, tep: 'apps/etp/nhom_goc.py', cam: 'if not anh: return None, 0, "không có poster trong kho Ethopex"', vi: 'thiếu poster không chặn thẳng — lấy khung video creative' },
  // anh 31/10/2026 "sau nhiều lần thử mà ko có camp lãi, film lởm, thị trường… thì làm thế nào" → "Đc làm đi": thang chuyển hướng / cất phim
  { card: 0, tep: 'apps/etp/cong.py', co: "where content_id = {int(ct)} and thu_vong = 'cat'", vi: 'cổng chặn tạo / nhân bản camp phim đã cất' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/thay-the.py', co: 'b_cp, d_cp = CP.xet(that=THAT)', vi: 'máy thay camp chạy thang chuyển hướng mỗi nhịp' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/thay-the.py', co: '"--bo", bo_len,', vi: 'camp thay lên bộ đích khi phim ở vòng đổi bộ' },
  { card: 0, tep: 'apps/xuong-video/scripts/ethopex/thay-the.py', co: 'if int(x["content_id"]) in CHAN: continue', vi: 'phim đã cất (và phim ngoài Âu-Mỹ) không mở dòng thay mới' },
  { card: 0, tep: 'apps/etp/cat_phim.py', co: 'if p.get("lai") or (vong == "cat" and team_lai):', vi: 'phim cất tự mở lại khi camp nhà / team lãi' },
  // anh 31/10/2026 "film đã chạm mốc ko nên mở thêm mà trong đội vẫn còn chạy thì có cảnh báo ở film đó cho mọi người nắm đc"
  { card: 0, tep: 'apps/web/src/lib/etp-doc.ts', co: "case when thu_vong = 'cat' then thu_luc end moc, thu_vong, thu_ly from etp.phim", vi: 'dữ liệu phim mang mốc cất' },
  { card: 0, tep: 'apps/web/src/components/etp-view.tsx', co: "<MocPhim ph={phCua.get(Number(k))}", vi: 'nhãn chạm mốc ở dòng phim bảng camp' },
  { card: 0, tep: 'apps/web/src/components/etp-view.tsx', co: "<MocPhim ph={du.phims.find((x) => x.content_id === Number(p.k))}", vi: 'nhãn chạm mốc ở dòng phim cây' },
  { card: 0, tep: 'apps/etp/cat_phim.py', co: 'đội còn {p[\'doi_chay\']} camp chạy phim này', vi: 'tin cất phim báo số camp đội còn chạy' },
  // anh 31/10/2026 "hãy bổ sung bước chấm điểm Creative cho mọi thành viên"
  { card: 0, tep: 'apps/etp/dong-bo.py', co: '"nap-creative-ngoai.py"), "--tu-dong"]', vi: 'dong-bo gọi chấm creative mọi thành viên mỗi lượt' },
  { card: 0, tep: 'apps/etp/nap-creative-ngoai.py', co: 'if not ch["bat"] and "--kho" not in sys.argv:', vi: 'chấm đội chỉ chạy khi cham_doi.bat (tiền AI)' },
  { card: 0, tep: 'apps/etp-cham-worker/src/index.ts', co: "vnd: typeof j.usage?.x_ckey?.cost === 'number' ? j.usage.x_ckey.cost : null", vi: 'Worker chấm ghi tiền thật ckey mỗi lượt' },
  // anh 31/10/2026 "ko bao giờ đc để thiếu hình creative"
  { card: 0, tep: 'apps/web/src/lib/etp-doc.ts', co: "anh: (i.anh as string) || anhCr.get(c.creative_id)?.a || null", vi: 'ô creative lấy ảnh dự phòng etp.anh_cr' },
  { card: 0, tep: 'apps/etp/dong-bo.py', co: '"anh-creative.py"), "--so", "60"]', vi: 'dong-bo điền ảnh creative thiếu mỗi lượt' },
  { card: 0, tep: 'apps/etp-cham-worker/src/index.ts', co: "if (a && req.method === 'GET') { const o = await env.R2.get(`anh/${a[1]}.jpg`)", vi: 'Worker phát ảnh creative cắt từ video' },
  // anh 31/10/2026 "và creative thì phải xem đc chi tiết chứ ?": thẻ chi tiết mở cả khi chưa có ảnh, bấm (điện thoại) cũng mở, video creative đội từ etp.anh_cr
  { card: 0, tep: 'apps/web/src/components/etp-view.tsx', co: "if (r) noiAnh.mo({ anh: r.anh ?? '', video: r.video, cr }, e);", vi: 'thẻ chi tiết creative không đòi phải có ảnh' },
  { card: 0, tep: 'apps/web/src/components/etp-view.tsx', cam: "if (r?.anh) noiAnh.mo({ anh: r.anh, video: r.video, cr }, e);", vi: 'không chặn thẻ chi tiết khi thiếu ảnh' },
  { card: 0, tep: 'apps/web/src/components/etp-view.tsx', co: "onClick={c.creative_id && moCr ? (e) => { e.stopPropagation(); e.preventDefault(); moCr(c.creative_id!, e); } : undefined}", vi: 'bấm ô creative mở thẻ chi tiết (điện thoại)' },
  { card: 0, tep: 'apps/web/src/lib/etp-doc.ts', co: "video: (i.video as string) || anhCr.get(c.creative_id)?.v || null", vi: 'creative đội có video cho thẻ chi tiết' },
  // anh 31/10/2026 "Chưa thấy chấm creatives của các thành viên à?": xem người khác (?ng=) phải đọc bản chấm creative trong camp người đó — runNha trả rỗng
  { card: 0, tep: 'apps/web/src/lib/etp-doc.ts', co: "using (creative_id)${crNguoi(sql`c.creative_id`)}", vi: 'bản chấm hiện khi xem thành viên' },
  { card: 0, tep: 'apps/web/src/lib/etp-doc.ts', cam: "runNha<Record<string, unknown>>(sql`select c.creative_id, c.luc::text luc, c.may, c.ket", vi: 'bản chấm không được đọc chỉ-nhà' },
  // TỔNG QUAN 2 dạng widget (anh 01/11/2026 "kéo thả… template riêng… template mặc định theo mục đích"): khối Tổng quan dùng chung một bản, widget đi từ sổ
  { card: 'chat', tep: V, mot: "const bieuDoNgay = (h: number) => <CotAmDuong ", vi: 'biểu đồ ngày một bản cho Tổng quan + widget' },
  { card: 'chat', tep: V, mot: "const bangNgay = <DataTable ", vi: 'bảng ngày một bản cho Tổng quan + widget' },
  { card: 'chat', tep: V, mot: "<CotAmDuong data={ngayGanNhat", vi: 'không chép tay biểu đồ ngày lần hai' },
  { card: 'chat', tep: 'apps/web/src/components/etp-tong2.tsx', co: "from '@/lib/etp-widget'", vi: 'lưới widget đọc sổ widget' },
  { card: 'chat', tep: 'apps/web/src/lib/actions/etp-bo-cuc.ts', co: 'const v = hopLe(o); if (!v)', vi: 'máy chủ kiểm bố cục trước khi lưu' },
  { card: 'chat', tep: V, co: "...(tab === 'tong2' ? { display: 'none' } : {})", vi: 'Tổng quan 2 ẩn dải số đầu trang để lưới vừa một màn' },
  { card: 'chat', tep: 'apps/web/src/components/etp-tong2.tsx', co: 'const hep = kt.w < 700;', vi: 'Tổng quan 2 điện thoại: một widget một lúc, không lưới 12 cột' },
  { card: 'chat', tep: 'apps/web/src/lib/actions/etp-tong2.ts', co: 'const cua = (n: number | undefined) => chiNg == null || n === chiNg;', vi: 'Tổng quan 2: vai người chỉ nhận số của mình' },
  { card: 'chat', tep: V, co: "chiXem ? TABS.filter((t) => t !== 'tong2')", vi: 'Tổng quan 2 chỉ chủ thấy (bản thử)' },
  { card: 'chat', tep: V, co: "options={[{ value: 'team', label:", vi: 'ô Người có mục Team (cả đội) đứng đầu' },
  { card: 'chat', tep: 'apps/web/src/lib/etp-doc.ts', co: "const doi = ng === 'team' && nguoiDs.length > 1;", vi: 'Team = nhà + mọi người gộp (?ng=team)' },
  { card: 'chat', tep: 'apps/web/src/lib/etp-quyen.ts', co: "export const ngCua = (q: QuyenEtp, ng?: string) => (q.vai === 'nguoi' ? String(q.nguoiId) : ng);", vi: 'vai người không chọn được Team / người khác (ép ?ng về chính mình)' },
  { card: 'chat', tep: V, co: 'max={maxLai(sd)} nhom n={demCamp(rs)[i]} />', vi: 'dòng phim: số camp có chi mỗi ngày dưới cột hiệu suất' },
  { card: 'chat', tep: V, co: 'mo nhom n={demCamp(rs)[ngay.length]} />', vi: 'dòng phim: số camp có chi hôm nay dưới cột nay' },
  { card: 'chat', tep: 'apps/xuong-video/scripts/ethopex/luat-ethopex.py', co: 'T1_ROI, T1_CHI, T1_PHAN = -30, 1.0, 0.8', vi: 'luật T1: ngày đầu ROI < −30%, chi ≥ min($1, 80% ngân sách) → tắt (02/11)' },
  { card: 'chat', tep: 'apps/xuong-video/scripts/ethopex/luat-ethopex.py', co: '"tat2": m(tat2), "tat1": m(tat1),', vi: 'luật T1 xuất ra cho worker (báo trước một nhịp rồi tắt)' },
  { card: 'chat', tep: 'apps/xuong-video/scripts/ethopex/luat-ethopex.py', co: 'dat = [(cid, chu) for cid, chu in dat if not _ts_ly(cid)]', vi: 'luật TS siết tăng bậc: không tăng 07–15h VN, không tăng khi hôm qua lãi 0–50% (02/11)' },
  { card: 'chat', tep: 'apps/web/src/lib/etp-bang-luat.json', co: '"tat1":      { "ma": "t1",', vi: 'sổ luật chung có T1' },
  { card: 'chat', tep: 'apps/xuong-video/scripts/ethopex/luat-ethopex.py', co: 'T1_CHO, T1_THA = 6, 30', vi: 'T1 chờ ngày mới chạy đủ 6 giờ (13:00 VN), tha camp hôm nay ROI ≥ 30%' },
  { card: 'chat', tep: 'apps/xuong-video/scripts/ethopex/luat-ethopex.py', co: 'if _rn is not None and _rn >= T1_THA: continue', vi: 'T1 tha camp hôm nay lãi ≥ 30%' },
  { card: 1506, tep: V, co: "['ro', (c) => !roLoc || (roLoc === 'co') === laRoas(c)]", vi: 'ô lọc ROAS (★ ROAS / không ROAS) nằm trong danh sách bộ lọc chung' },
  { card: 1506, tep: V, co: '{laiSel()}{tuoiSel()}{luatSel()}{dangSel()}{roSel()}</> : null}', vi: 'ô lọc ROAS hiện trên hàng lọc máy tính' },
  { card: 1507, tep: V, co: 'return bac?.length ? <ONgayBac bac={bac} tieu={tieu}>{o}</ONgayBac> : o;', vi: 'đổi bậc trong ngày = thẻ nổi (KhungNoi + DongBac), không tooltip chữ thô' },
  { card: 1507, tep: V, co: "title={bac?.length ? undefined : tieu}", vi: 'ô có đổi bậc không kèm tooltip trình duyệt chồng lên thẻ' },
  { card: 1508, tep: V, co: "{ key: 'lai_nay', header: 'Lãi nay',", vi: 'cột cố định Lãi nay trong cây camp' },
  { card: 'chat', tep: 'apps/xuong-video/scripts/ethopex/lam-ethopex.py', co: 'for c in kq["chua"]:\n        ghi_nhat_ky({"viec": "tat", "id": c, "ok": False, "loi": "đã gửi lệnh tắt', vi: 'tắt hàng loạt: Ethopex áp chậm vẫn ghi nhật ký luật (#73533 L3 bị ghi tắt ngoài máy)' },
  { card: 'chat', tep: 'apps/web/src/lib/etp-doc.ts', co: "for (const c of cs) if (c.trang_thai !== 'ACTIVE') c.dong = dongCua.get(c.camp_id) ?? null;", vi: 'camp dừng mang lý do dừng (lúc · lý do · ai) từ ghi chép máy luật' },
  { card: 'chat', tep: V, co: "{ chu: 'dừng', mau: 'var(--fg-2)', t: lyDoDung(c) }", vi: 'hover trạng thái dừng hiện lý do dừng, ai dừng, lúc nào' },
  { card: 'chat', tep: 'apps/etp/cong.py', co: 'if tr: return LY_TRUNG.format(ct, tr[0], tr[1])', vi: 'không lên camp mới trùng phim với người trong đội (hai chiều)' },
  { card: 'chat', tep: 'apps/xuong-video/scripts/ethopex/chon-phim-moi.py', co: 'NGUON = {"reelshort": 100, "netshort": 35}   # DramaBox / dramaboxdb: loại', vi: 'chọn phim mới: lọc nguồn ReelShort / NetShort, bỏ DramaBox' },
  { card: 'chat', tep: 'apps/xuong-video/scripts/ethopex/chon-phim-moi.py', co: 'da |= {int(x) for x in q("select distinct content_id from etp.camp_ngoai where content_id > 0").split() if x.isdigit()}', vi: 'chọn phim mới: bỏ phim đội đã lên' },
  { card: 'chat', tep: 'apps/web/src/lib/actions/etp-tong2.ts', co: "select khoa, gia_tri from etp.cau_hinh where khoa in ('phan_bo', 'tran_ngay')", vi: 'Tổng quan 2 phân bổ ngân sách: mục tiêu đọc cấu hình phan_bo + trần ngày' },
  { card: 'chat', tep: 'apps/xuong-video/scripts/ethopex/luat-ethopex.py', co: 'R0_NGAY, R0_CHI, R0_PHAN = 3, 0.5, 0.05', vi: 'luật R0: camp ★ ROAS 3 ngày đã khép chi < max($0.5, 5% ngân sách) → báo trước rồi tắt (#72924)' },
  { card: 'chat', tep: 'apps/xuong-video/scripts/ethopex/luat-ethopex.py', co: '"tat_roas": m(tat_roas), "tat_r0": m(tat_r0),', vi: 'luật R0 xuất ra cho worker' },
  { card: 'chat', tep: 'apps/etp/cat_phim.py', co: 'if not team_lai and so_thu >= N:   # thử đủ N camp có chi, chưa camp nào lãi', vi: 'cất phim khi thử đủ 4 camp có chi mà chưa camp nào lãi' },
  { card: 'chat', tep: 'apps/etp/cat_phim.py', co: 'if ct in bh:   # bão hoà mà lỗ: cất kể cả phim từng có camp lãi', vi: 'cất phim bão hoà mà ROI phim cả hệ âm' },
  { card: 'chat', tep: V, co: '? <ChipPhim ph={phCua.get(k)} bh={bhCua.get(k)} /> : null; } },', vi: 'cột Luật dòng phim: thẻ vòng thử (đã cất / sắp cất / đổi bộ) + bão hoà' },
  { card: 1509, tep: V, co: "header: <NgayNhan d={d} />, align: 'center',", vi: 'cột ngày Chủ nhật đánh dấu khác (tô cam, gạch chân)' },
  { card: 1509, tep: V, co: "const laCN = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay() === 0;", vi: 'nhận Chủ nhật theo ngày Ethopex' },
  { card: 1510, tep: V, co: "{the.length > 1 ? <span style={{ flex: 'none', fontSize: 10, color: 'var(--fg-2)', border: '1px solid var(--line)', borderRadius: 8, padding: '0 4px' }}>+{the.length - 1}</span> : null}", vi: 'ô Luật dòng phim: một thẻ + "+N", không nhồi nhiều thẻ bị cắt' },
  { card: 1510, tep: V, co: "{noi.v ? <KhungNoi x={noi.v.x} y={noi.v.y} rong={340} cao={320} noi={noi}>", vi: 'hover thẻ phim = thẻ nổi khuôn chung, không tooltip thô' },
  { card: 'chat', tep: 'apps/xuong-video/scripts/ethopex/luat-ethopex.py', co: 'kem = r3_ >= G10_ROI and r4_ is not None and c4 >= ns and r3_ < G10_KEM_ROI and r3_ < G10_KEM_TI * r4_', vi: 'G10 nhánh kém đi: ROI 3 ngày < nửa ROI 4 ngày trước và < 30% → hạ $10, theo dõi, tắt' },
  { card: 1503, tep: V, co: "textAlign: 'center', lineHeight: 1.15 }}>{x.n}<br /><span style={{ fontSize: 9, opacity: 0.75 }}>camp</span></span>", vi: 'số camp dưới biểu đồ ngăn phim: số trên, chữ camp dưới, canh giữa cột' },
  { card: 1504, tep: V, co: 'max={maxLai([...sd, c.nay])} bac={bacO(c.camp_id, d)} />', vi: 'ô ngày của camp: chấm màu + hover liệt kê tăng / giảm bậc trong ngày' },
  { card: 1504, tep: V, co: '<div style={{ fontSize: 11, color: \'var(--fg-3, #777)\', margin: \'0 0 6px\' }}>Đổi bậc trong ngày</div>', vi: 'hover ô ngày có mục Đổi bậc trong ngày (thẻ nổi #1507)' },
  { card: 'chat', tep: 'apps/etp/dong-bo.py', co: "where not exists (select 1 from etp.so_luat s where s.ma = e->>'ma')) from etp.so_luat", vi: 'luật mới lên tab Luật ngay lượt đầu, không đợi tròn giờ' },
  { card: 'chat', tep: V, co: 'const camps = useMemo(() => du.camps.filter((c) => BO_LOC.every(([, f]) => f(c))), [du.camps, BO_LOC]);', vi: 'cây / bảng camp lọc qua MỘT danh sách bộ lọc có tên (BO_LOC) — để chỉ ra ô nào ẩn camp đang tìm' },
  { card: 'chat', tep: V, co: '<Chon2 chan={chanLoc.loc} value={loc}', vi: 'ô Lọc viền đỏ khi đang ẩn camp người dùng tìm' },
  { card: 'chat', tep: V, co: 'onTimDoi={setTimCay} khiTimTrong={giaiTim()}', vi: 'tìm ra 0 dòng: nói bộ lọc nào ẩn / camp ở người nào (link mở)' },
  { card: 'chat', tep: V, co: '<PhamViLuu value={phamViNg(du)}>', vi: 'bảng / ô tìm / lọc cột / độ rộng lưu riêng theo người đang xem (không thông nhau)' },
  { card: 'chat', tep: 'apps/web/src/app/etp/page.tsx', co: "<EtpView key={du.nguoi.doi ? 'team' : `ng${du.nguoi.dang ?? 'nha'}`}", vi: 'đổi người = dựng lại trang, bộ lọc không mang sang' },
  { card: 'chat', tep: V, co: "['b', 'ngan', 'l', 'lu', 'd', 'll', 'tu', 'p', 'ro'].includes(k)", vi: 'đổi người bỏ bộ lọc trang + tham số bảng của phạm vi cũ trên URL' },
  { card: 'chat', tep: 'packages/bang/src/data-table.tsx', co: "data-dang-loc={q.trim() ? (sortedRows.length ? '1' : '0') : undefined}", vi: 'ô tìm có chữ sáng viền như ô lọc đang chọn, 0 dòng thì đỏ' },
  { card: 'chat', tep: 'packages/bang/src/data-table.tsx', co: 'const persistKey = useKhoaLuu(persistKeyGoc);', vi: 'DataTable lưu theo phạm vi của trang (PhamViLuu)' },
  { card: 'chat', tep: 'apps/web/src/lib/actions/etp-tim.ts', co: "if (!qu || qu.vai === 'nguoi' || k.length < 3) return [];", vi: 'tìm camp người khác: vai người không được biết camp người khác' },
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
