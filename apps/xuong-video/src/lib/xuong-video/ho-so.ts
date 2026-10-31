// HỒ SƠ TIỀN KỲ — khuôn CHUẨN của studio (14/10/2026, anh chốt từ Tango & Lint tập 1: "dùng cái này làm tiêu chuẩn cho cả studio").
// Ngành tách bảy tài liệu, mỗi cái của một người — KHÔNG gộp:
//   1. Kịch bản (biên kịch)             — screenplay: tiêu đề cảnh, hành động, nhân vật + diễn xuất + lời/âm hiệu, chuyển cảnh. KHÔNG máy.
//   2. Phân tích cảnh (đạo diễn)         — mục tiêu, xung đột, giá trị đổi, điểm xoay, nhịp hành động → phản ứng.
//   3. Bóc tách sản xuất (breakdown)     — bối cảnh / nhân vật / đạo cụ RÚT TỪ anchor gắn ở shot + hiệu ứng.
//   4. Shot list (đạo diễn + quay phim)  — vai kể, cỡ cảnh, góc, chuyển động, ống kính, giây, chuyển cảnh, máy làm gì·vì sao, mã luật.
//   5. Bảng liên tục (thư ký trường quay) — trạng thái mở/kết, hướng, bố cục 3 lớp, motif.
//   6. Color script                      — ánh sáng + màu từng cảnh theo cung cảm xúc.
//   7. Bảng âm thanh (cue sheet)          — âm + âm hiệu từng shot theo mốc giây, nhạc từng cảnh.
// Đọc THẲNG dữ liệu tập (xv_tap.phan_canh + ho_so) và shot (xv_canh: ky_thuat, dan_dung, phat_s, nhan_vat…). MỘT chỗ dựng cho: nút 📋 Hồ sơ của tập của
// studio (iframe), trang duyệt gửi anh (scripts/kich-ban-the.mts) và chữ kịch bản (hoSoKichBan). kiemHoSo = cổng: mã theo thư viện, anchor
// theo phim, nhịp đọc + nhịp hình + vai kể + thẻ shot bằng đúng cổng studio. Thuần (client lẫn server import được).
import { kyThuat, type NhomKyThuat, type KyThuatShot } from './dien-anh';
import { luatDung, LUAT_DUNG_CANH } from './luat-dung';
import { giayDoc, kiemNhipHinh, kiemVaiKe, kiemTheShot, kiemNutDong, kiemKetTap } from './nhip-hinh';
import type { DanDung, DongThoai, PhanCanh, Series, TapHoSo } from './kieu';
import { maBan } from './nguoi-xem';

export type ShotHoSo = { thu_tu: number; phan_doan: string; nhanh?: string; hanh_dong: string; goc_may: string; am_thanh: string; phat_s: number | null; thoi_luong_s: number;
  ky_thuat: KyThuatShot; dan_dung?: DanDung; nhan_vat: number[]; thoai: Pick<DongThoai, 'nhan_vat' | 'dien_xuat' | 'loi'>[]; chu_man?: string };
export type HoSoVao = { series?: Series | null; phim: string; ten: string; so: number; khong_loi?: boolean; ho_so: TapHoSo; phan_canh: PhanCanh[]; canh: ShotHoSo[]; nhanVat: { id: number; ten: string; loai: string }[] };

const giay = (s: ShotHoSo) => (s.phat_s && s.phat_s > 0 ? s.phat_s : s.thoi_luong_s || 4);
const tenKt = (k: string | undefined, n: NhomKyThuat) => (k ? kyThuat(k, n)?.ten.replace(/\s*\(.*\)$/, '') ?? k : '—');
const tenLuat = (k: string) => luatDung(k)?.ten.replace(/\s*\(.*\)$/, '') ?? k;
/** Shot của nhánh dựng (thân chung + hook A), theo thứ tự. */
/** Mã ANIMATIC: keyframe + giây phát của nhánh dựng theo thứ tự — duyệt animatic ghi mã này; keyframe hay giây đổi là phải duyệt lại. */
export const maAnimatic = (ds: { thu_tu: number; nhanh?: string; keyframe_url?: string | null; phat_s: number | null; thoi_luong_s: number }[]): string =>
  maBan(ds.filter((c) => !c.nhanh || c.nhanh === 'A').sort((a, b) => a.thu_tu - b.thu_tu).map((c) => `${c.keyframe_url ?? '-'}@${giay(c as ShotHoSo)}`).join('|'));
/** Đo tập theo THAM CHIẾU của series: độ dài (không tính cảnh intro) + số gag/phút. */
export function doTheoThamChieu(v: HoSoVao): { giay: number; gag: number; gagPhut: number } {
  const giayTap = v.phan_canh.filter((p) => !p.intro).flatMap((p) => cuaCanh(v, p)).reduce((a, s) => a + giay(s), 0);
  const gag = v.phan_canh.reduce((a, p) => a + (p.gag?.length ?? 0), 0);
  return { giay: giayTap, gag, gagPhut: giayTap ? Math.round((gag / (giayTap / 60)) * 10) / 10 : 0 };
}
const shotDung = (v: HoSoVao) => v.canh.filter((c) => !c.nhanh || c.nhanh === 'A').sort((a, b) => a.thu_tu - b.thu_tu);
const cuaCanh = (v: HoSoVao, pc: PhanCanh) => shotDung(v).filter((s) => s.phan_doan === pc.ten);

/** Bóc tách của một cảnh: anchor gắn ở các shot của cảnh, chia theo loại (thứ tự xuất hiện). */
export function bocTach(v: HoSoVao, pc: PhanCanh): { boi_canh: string[]; nhan_vat: string[]; dao_cu: string[]; hieu_ung: string[] } {
  const ids = [...new Set(cuaCanh(v, pc).flatMap((s) => s.nhan_vat))];
  const theo = (loai: string[]) => ids.map((id) => v.nhanVat.find((x) => x.id === id)).filter((x) => x && loai.includes(x.loai)).map((x) => x!.ten);
  return { boi_canh: theo(['boi_canh']), nhan_vat: theo(['nhan_vat']), dao_cu: theo(['dao_cu', 'san_pham']), hieu_ung: pc.hieu_ung ?? [] };
}

/** Series còn tập sau tập `so` → kết tập phải móc. */
export const conTapSau = (series: Series | null | undefined, so?: number): boolean => !!series?.dong_co?.trim() && (series.tap ?? []).some((x) => (x.so ?? 0) > (so ?? 0));
/** Khung kết viết THỜI GIAN 'sau khi' (after a high-five, sau khi đập tay, After …) — không bắt 'after the gummy' (đuổi theo). */
export const KET_SAU_KHI = /^\W*after\b|\bafter an? \b|\bsau khi\b/i;
/** Cổng hồ sơ: thiếu tài liệu nào, mã nào lệch thư viện, shot nào lạc cảnh. Rỗng = đủ chuẩn studio. */
export function kiemHoSo(v: HoSoVao): string[] {
  const loi: string[] = []; const ds = shotDung(v);
  const ma = (k: string | undefined, n: NhomKyThuat, o: string) => { if (!k) loi.push(`${o}: thiếu ${n}`); else if (!kyThuat(k, n)) loi.push(`${o}: ${n} "${k}" không có trong thư viện`); };
  for (const pc of v.phan_canh) {
    const o = `cảnh "${pc.ten}"`;
    if (!cuaCanh(v, pc).length) loi.push(`${o}: không có shot`);
    if (!pc.kich_ban?.length) loi.push(`${o}: thiếu đoạn kịch bản`);
    for (const k of ['luc', 'gia_tri_doi', 'diem_xoay', 'mau_mo_ta'] as const) if (!(pc[k] ?? '').trim()) loi.push(`${o}: thiếu ${k}`);
    if (!pc.nhip_hd?.length) loi.push(`${o}: thiếu nhịp hành động → phản ứng`);
    ma(pc.anh_sang, 'anh_sang', o); ma(pc.mau, 'mau', o); ma(pc.nhac, 'nhac', o);
    if (!bocTach(v, pc).boi_canh.length) loi.push(`${o}: shot chưa gắn anchor Bối cảnh`);
  }
  ds.forEach((s, i) => {
    const o = `shot #${s.thu_tu}`;
    if (!v.phan_canh.some((p) => p.ten === s.phan_doan)) loi.push(`${o}: không thuộc cảnh nào`);
    for (const n of ['vai', 'co_canh', 'goc', 'chuyen_dong', 'ong_kinh', 'chuyen_canh'] as const) ma(s.ky_thuat?.[n], n, o);
    for (const l of s.ky_thuat?.luat ?? []) if (!luatDung(l)) loi.push(`${o}: luật "${l}" không có trong thư viện`);
    if (!s.goc_may.trim()) loi.push(`${o}: thiếu mô tả máy (máy làm gì, vì sao)`);
    if (v.khong_loi && giay(s) < giayDoc({ khong_loi: true }) - 0.05) loi.push(`${o}: ${giay(s)}s dưới nhịp đọc`);
    // KHUNG KẾT chụp ĐỈNH hành động, không chụp 'sau khi' (15/10/2026: 7.6a 'after a high-five' → keyframe không có cú đập tay, video cũng không).
    if (KET_SAU_KHI.test(s.dan_dung?.ket ?? '')) loi.push(`${o}: trạng thái kết viết "after / sau khi" — khung kết phải chụp đúng khoảnh khắc đỉnh (tay đang chạm, đang rơi), không phải lúc đã xong`);
    void i;
  });
  // Chuẩn series: tham chiếu + khuôn nhận diện phải khai; tập đo theo tham chiếu (độ dài ±25%, mật độ gag ≥ 75% chuẩn).
  const tc = v.series?.tham_chieu; const kh = v.series?.khuon;
  if (v.series) {
    if (!tc?.tac_pham?.trim() || !tc.do_dai_s || !tc.gag_moi_phut || !tc.rut_ra?.length) loi.push('series chưa khai THAM CHIẾU (tác phẩm mẫu, độ dài chuẩn, gag/phút, điều rút ra) — mục Kinh thánh series');
    if (!kh?.intro?.trim() || !kh.the_tua?.trim() || !kh.the_ket?.trim() || !kh.nhac_chu_de?.trim()) loi.push('series chưa khai KHUÔN NHẬN DIỆN (intro dùng chung, thẻ tựa, thẻ kết, câu nhạc chủ đề)');
    if (tc?.do_dai_s) {
      const d = doTheoThamChieu(v);
      if (d.giay > tc.do_dai_s * 1.25 || d.giay < tc.do_dai_s * 0.75) loi.push(`tập dài ${Math.round(d.giay)}s (không tính intro) — chuẩn ${tc.do_dai_s}s theo ${tc.tac_pham} (±25%)`);
      if (tc.gag_moi_phut && d.gagPhut < tc.gag_moi_phut * 0.75) loi.push(`mật độ gag ${d.gagPhut}/phút — chuẩn ${tc.gag_moi_phut}/phút theo ${tc.tac_pham}`);
    }
  }
  for (const pc of v.phan_canh) {
    if (pc.intro) continue;
    if (!pc.gag?.length && v.khong_loi) loi.push(`cảnh "${pc.ten}": chưa có gag (gài → bùng) — phim không lời kể bằng gag`);
    const ss = cuaCanh(v, pc);
    for (const g of pc.gag ?? []) { const s = ss[g.o_shot - 1]; if (!s) loi.push(`cảnh "${pc.ten}": gag "${g.ten}" trỏ shot thứ ${g.o_shot} không có`); else if (!(s.dan_dung?.nhan ?? '').trim()) loi.push(`shot #${s.thu_tu}: có cú bùng của gag "${g.ten}" mà chưa ghi điểm nhấn âm–hình`); }
  }
  const p = { laQc: false, khong_loi: v.khong_loi };
  loi.push(...kiemTheShot(ds, p), ...kiemVaiKe(ds, p), ...kiemNhipHinh(ds));
  // Dựng truyện: nút đóng giữa hai mạch trong một cảnh + kết ba nhịp (bùng → giữ → móc).
  loi.push(...kiemNutDong(v.phan_canh, ds, p), ...kiemKetTap(v.phan_canh, ds, { ...p, coMoc: conTapSau(v.series, v.so) }));
  return loi;
}

/** Tài liệu 1 — chữ KỊCH BẢN thuần (screenplay) cho ô Kịch bản của tập. */
export function hoSoKichBan(v: HoSoVao): string {
  const tong = shotDung(v).reduce((a, s) => a + giay(s), 0);
  return [`**${v.ten.toUpperCase()}**`, `*${v.phim} — Tập ${v.so}${v.khong_loi ? ' · phim không lời' : ''} · ~${Math.round(tong)} giây*`, '',
    ...v.phan_canh.flatMap((pc, i) => ['---', `**CẢNH ${i + 1}**`, `**NỘI. ${(pc.noi || pc.ten).toUpperCase()} – ${(pc.luc ?? '').toUpperCase()}**`, '',
      ...(pc.kich_ban ?? []).flatMap((d) => d.loai === 'nv' ? [d.ten, ...(d.dien ? [`  (${d.dien})`] : []), `  ${d.loi}`, ''] : d.loai === 'chuyen' ? [`${' '.repeat(40)}${d.chu}`, ''] : d.loai === 'am' ? [`*${d.chu}*`, ''] : [d.chu, ''])]),
    '**HẾT**'].join('\n');
}

const e = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const MAU_DAI: Record<string, string> = { am: 'linear-gradient(90deg,#f2b35b,#e07b39)', lanh: 'linear-gradient(90deg,#4a6b8a,#1f3448)', teal_cam: 'linear-gradient(90deg,#1d6f74,#e07b39)', xanh_benh: 'linear-gradient(90deg,#3f6b5a,#1c2f2a)', pastel: 'linear-gradient(90deg,#f5d0d8,#cfe3f2)', tu_nhien: 'linear-gradient(90deg,#b7a68a,#6f7f63)', tuong_phan_cao: 'linear-gradient(90deg,#111,#f4f4f4)', den_trang: 'linear-gradient(90deg,#222,#bbb)' };

/** Trang HTML 7 tab (title + style + nội dung + script) — dùng cho iframe studio và trang duyệt. */
export function hoSoHtml(v: HoSoVao): string {
  const ds = shotDung(v); const tong = ds.reduce((a, s) => a + giay(s), 0);
  let t = 0; const moc = new Map(ds.map((s) => { const a = t; t += giay(s); return [s, [a, t] as const]; }));
  const the = (xs: string[], lop: string) => (xs.length ? xs.map((x) => `<span class="the ${lop}">${e(x)}</span>`).join('') : '<span class="trong">—</span>');
  const nvTen = (id: number) => v.nhanVat.find((x) => x.id === id)?.ten ?? '';

  const tabKb = v.phan_canh.map((pc, i) => `<section class="sp-canh"><p class="sp-dau">${i + 1}. NỘI. ${e((pc.noi || pc.ten).toUpperCase())} – ${e((pc.luc ?? '').toUpperCase())}</p>${(pc.kich_ban ?? []).map((d) => d.loai === 'nv'
    ? `<div class="sp-thoai"><p class="sp-ten">${e(d.ten)}</p>${d.dien ? `<p class="sp-dien">(${e(d.dien)})</p>` : ''}<p class="sp-loi">${e(d.loi)}</p></div>`
    : d.loai === 'chuyen' ? `<p class="sp-chuyen">${e(d.chu)}</p>` : d.loai === 'am' ? `<p class="sp-am">${e(d.chu)}</p>` : `<p class="sp-hd">${e(d.chu)}</p>`).join('')}</section>`).join('');
  const tabDd = v.phan_canh.map((pc, i) => `<section class="khoi"><h3>Cảnh ${i + 1} · ${e(pc.ten)} <span class="phu">${e(pc.beat)}</span></h3><dl class="cap">
    <div><dt>Mục tiêu</dt><dd>${e(pc.muc_tieu)}</dd></div><div><dt>Xung đột</dt><dd>${e(pc.xung_dot)}</dd></div>
    <div><dt>Giá trị đổi</dt><dd>${e(pc.gia_tri_doi ?? '')} <span class="phu">(${pc.cam_xuc_dau} → ${pc.cam_xuc_cuoi})</span></dd></div><div><dt>Điểm xoay</dt><dd>${e(pc.diem_xoay ?? '')}</dd></div></dl>
    <p class="nhan-nho">Nhịp (hành động → phản ứng)</p><ol class="nhip">${(pc.nhip_hd ?? []).map((n) => `<li>${e(n)}</li>`).join('')}</ol>
    ${pc.gag?.length ? `<p class="nhan-nho">Gag (gài → bùng)</p><ul class="nhip">${pc.gag.map((g) => { const s = cuaCanh(v, pc)[g.o_shot - 1]; return `<li><b>${e(g.ten)}</b>: ${e(g.gai)} → <b>${e(g.bung)}</b> <span class="phu">(bùng ở shot #${s?.thu_tu ?? '?'})</span></li>`; }).join('')}</ul>` : pc.intro ? '<p class="phu">Cảnh mở series — không có gag.</p>' : ''}</section>`).join('');
  const tabBt = `<div class="cuon"><table class="bang"><thead><tr><th>Cảnh</th><th>Bối cảnh</th><th>Nhân vật</th><th>Đạo cụ</th><th>Hiệu ứng</th><th>Shot</th><th>Giây</th></tr></thead><tbody>${v.phan_canh.map((pc, i) => { const b = bocTach(v, pc); const ss = cuaCanh(v, pc); return `<tr>
    <td><b>${i + 1}</b> ${e(pc.ten)}<br><span class="phu">${e(pc.luc ?? '')}</span></td><td>${the(b.boi_canh, 'bc')}</td><td>${the(b.nhan_vat, 'nv')}</td><td>${the(b.dao_cu, 'dc')}</td>
    <td>${b.hieu_ung.length ? `<ul class="gon">${b.hieu_ung.map((h) => `<li>${e(h)}</li>`).join('')}</ul>` : '<span class="trong">—</span>'}</td><td class="so">${ss.length}</td><td class="so">${ss.reduce((a, s) => a + giay(s), 0)}</td></tr>`; }).join('')}</tbody></table></div>
    <p class="phu">Rút từ anchor gắn ở từng shot — <span class="the bc">bối cảnh</span> <span class="the nv">nhân vật</span> <span class="the dc">đạo cụ</span> đều có ảnh mẫu; keyframe tham chiếu đúng các ảnh đó.</p>`;
  const tabSl = `<div class="cuon"><table class="bang sl"><thead><tr><th>#</th><th>Cảnh</th><th>Giây</th><th>Vai kể</th><th>Cỡ cảnh</th><th>Góc</th><th>Chuyển động</th><th>Ống kính</th><th>Thấy gì</th><th>Máy làm gì · vì sao</th><th>Sang shot sau</th><th>Luật</th></tr></thead><tbody>${ds.map((s) => { const [a, b] = moc.get(s)!; const k = s.ky_thuat ?? {}; return `<tr>
    <td class="so"><b>${s.thu_tu}</b></td><td>${e(s.phan_doan)}</td><td class="so">${giay(s)}<br><span class="phu">${a.toFixed(1)}–${b.toFixed(1)}</span></td>
    <td>${e(tenKt(k.vai, 'vai'))}</td><td>${e(tenKt(k.co_canh, 'co_canh'))}</td><td>${e(tenKt(k.goc, 'goc'))}</td><td>${e(tenKt(k.chuyen_dong, 'chuyen_dong'))}</td><td>${e(tenKt(k.ong_kinh, 'ong_kinh'))}</td>
    <td class="rong">${e(s.hanh_dong)}</td><td class="rong">${e(s.goc_may)}</td><td>${e(tenKt(k.chuyen_canh, 'chuyen_canh'))}</td>
    <td>${(k.luat ?? []).map((l) => `<span class="the luat" title="${e(luatDung(l)?.luat ?? '')}">${e(tenLuat(l))}</span>`).join('')}</td></tr>`; }).join('')}</tbody></table></div>`;
  const tabLt = `<p class="phu">Trạng thái kết của shot trước phải khớp trạng thái mở của shot sau. Bốn cột đầu viết tiếng Anh vì đi thẳng vào prompt ảnh và video.</p>
    <div class="cuon"><table class="bang lt"><thead><tr><th>#</th><th>Trạng thái mở</th><th>Trạng thái kết</th><th>Hướng nhìn · hướng đi</th><th>Bố cục (tiền / trung / hậu)</th><th>Diễn xuất</th><th>Cảm xúc</th><th>Motif · gài</th></tr></thead><tbody>${ds.map((s) => { const d = s.dan_dung ?? {}; return `<tr><td class="so"><b>${s.thu_tu}</b></td><td lang="en">${e(d.mo ?? '')}</td><td lang="en">${e(d.ket ?? '')}</td><td lang="en">${e(d.huong ?? '')}</td><td lang="en">${e(d.bo_cuc ?? '')}</td><td lang="en">${e(d.dien ?? '')}</td><td>${e(d.muc_dich ?? '')}</td><td>${e(d.motif || '—')}</td></tr>`; }).join('')}</tbody></table></div>`;
  const tabMau = `${v.ho_so.cung ? `<p class="phu">${e(v.ho_so.cung)}</p>` : ''}<div class="dai-mau">${v.phan_canh.map((pc, i) => `<div class="o-mau"><div class="vet" style="background:${MAU_DAI[pc.mau ?? ''] ?? '#777'}"></div><p class="tieu"><b>${i + 1}. ${e(pc.ten)}</b></p><p class="phu">${e(tenKt(pc.anh_sang, 'anh_sang'))} · ${e(tenKt(pc.mau, 'mau'))}</p><p>${e(pc.mau_mo_ta ?? '')}</p></div>`).join('')}</div>`;
  const tabAm = `<div class="cuon"><table class="bang"><thead><tr><th>#</th><th>Mốc</th><th>Âm thanh</th><th>Điểm nhấn âm–hình</th><th>Âm hiệu / lời</th><th>Nhạc của cảnh</th></tr></thead><tbody>${v.phan_canh.map((pc) => cuaCanh(v, pc).map((s, j, arr) => { const [a, b] = moc.get(s)!; return `<tr><td class="so"><b>${s.thu_tu}</b></td><td class="so">${a.toFixed(1)}–${b.toFixed(1)}</td><td lang="en">${e(s.am_thanh)}</td><td>${e(s.dan_dung?.nhan || '—')}</td><td>${s.thoai.length ? s.thoai.map((d) => `<b>${e(d.nhan_vat)}</b>${d.dien_xuat ? ` <span class="phu">(${e(d.dien_xuat)})</span>` : ''} ${e(d.loi)}`).join('<br>') : '<span class="trong">—</span>'}</td>${j === 0 ? `<td rowspan="${arr.length}">${e(tenKt(pc.nhac, 'nhac'))}<br><span class="phu">${e(pc.ten)}</span></td>` : ''}</tr>`; }).join('')).join('')}</tbody></table></div>`;
  void nvTen;
  // Tài liệu 0 — chuẩn series: tham chiếu + khuôn nhận diện + tập này đo theo tham chiếu + animatic.
  const tc = v.series?.tham_chieu; const kh = v.series?.khuon; const d0 = doTheoThamChieu(v);
  const tabChuan = `<section class="khoi"><h3>Tham chiếu${tc ? ` · ${e(tc.tac_pham)}` : ''}</h3>${tc ? `<dl class="cap">
    <div><dt>Độ dài chuẩn</dt><dd>${tc.do_dai_s}s / tập — tập này ${Math.round(d0.giay)}s (không tính intro)</dd></div>
    <div><dt>Mật độ gag</dt><dd>${tc.gag_moi_phut}/phút — tập này ${d0.gag} gag, ${d0.gagPhut}/phút</dd></div></dl>
    <p class="nhan-nho">Rút ra từ tham chiếu</p><ul class="nhip">${tc.rut_ra.map((x) => `<li>${e(x)}</li>`).join('')}</ul>` : '<p class="phu">Chưa khai tham chiếu.</p>'}</section>
    <section class="khoi"><h3>Khuôn nhận diện series</h3>${kh ? `<dl class="cap"><div><dt>Intro dùng chung</dt><dd>${e(kh.intro)}</dd></div><div><dt>Thẻ tựa</dt><dd>${e(kh.the_tua)}</dd></div><div><dt>Thẻ kết</dt><dd>${e(kh.the_ket)}</dd></div><div><dt>Câu nhạc chủ đề</dt><dd>${e(kh.nhac_chu_de)}</dd></div></dl>` : '<p class="phu">Chưa khai khuôn.</p>'}</section>
    <section class="khoi"><h3>Animatic</h3><p>${v.ho_so.animatic ? `Đã duyệt ${e(v.ho_so.animatic.luc.slice(0, 10))} — <a href="${e(v.ho_so.animatic.url)}">xem bản animatic</a>` : 'Chưa duyệt. Sau khi đủ keyframe: xuất bản dựng từ keyframe (đúng số giây + âm), xem nhịp cả phim, duyệt — rồi mới mở cổng sinh video.'}</p></section>`;

  const TAB = [['chuan', 'Chuẩn series', 'Tham chiếu · khuôn nhận diện · đo tập theo chuẩn · animatic'], ['kich-ban', 'Kịch bản', 'Biên kịch · chỉ có truyện, không ghi máy'], ['dao-dien', 'Phân tích cảnh', 'Đạo diễn · mỗi cảnh đổi giá trị qua một điểm xoay'], ['boc-tach', 'Bóc tách', 'Sản xuất · mọi thứ cần dựng, ref đúng anchor'], ['shot-list', 'Shot list', 'Đạo diễn + quay phim · máy cho từng shot'], ['lien-tuc', 'Bảng liên tục', 'Thư ký trường quay · nối shot với shot'], ['mau', 'Color script', 'Ánh sáng + màu theo cung cảm xúc'], ['am', 'Âm thanh', 'Âm thanh · cue sheet']] as const;
  const NOI: Record<string, string> = { chuan: tabChuan, 'kich-ban': `<div class="sp"><p class="sp-tieu">${e(v.ten.toUpperCase())}</p><p class="sp-phu">${e(v.phim)} — Tập ${v.so}</p>${tabKb}<p class="sp-chuyen">HẾT</p></div>`, 'dao-dien': tabDd, 'boc-tach': tabBt, 'shot-list': tabSl, 'lien-tuc': tabLt, mau: tabMau, am: tabAm };
  const loi = kiemHoSo(v);
  return `<title>${e(v.ten)} · Tập ${v.so}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;700;800&family=Courier+Prime:wght@400;700&display=swap">
<style>
/* Bố cục: bìa hồ sơ tiền kỳ — bảy tài liệu là bảy tab (mỗi tab ghi rõ của ai); kịch bản kiểu trang máy chữ screenplay, bảng sản xuất kiểu shot list. */
:root { --nen: #f2f1ee; --giay: #fffefb; --chu: #22201d; --chu-2: #6b655d; --vien: #dedad3; --cam: #c8611c; --cam-nhat: #faeadf; --xanh: #2b5c88; --tim: #6a4c93; --la: #3f7a4a; --do: #b3261e;
  --f-than: "Be Vietnam Pro", system-ui, sans-serif; --f-may: "Courier Prime", ui-monospace, monospace; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --nen: #16140f; --giay: #1f1c17; --chu: #ebe6dd; --chu-2: #a39b90; --vien: #38322a; --cam: #ef8a3f; --cam-nhat: #3a2615; --xanh: #8db9e2; --tim: #b79be0; --la: #8cc797; --do: #f2b8b5; color-scheme: dark; } }
:root[data-theme="dark"] { --nen: #16140f; --giay: #1f1c17; --chu: #ebe6dd; --chu-2: #a39b90; --vien: #38322a; --cam: #ef8a3f; --cam-nhat: #3a2615; --xanh: #8db9e2; --tim: #b79be0; --la: #8cc797; --do: #f2b8b5; color-scheme: dark; }
body { background: var(--nen); color: var(--chu); font-family: var(--f-than); font-size: 15px; line-height: 1.55; margin: 0; }
.trang { max-width: 1240px; margin: 0 auto; padding-inline: 16px; padding-block: 22px 64px; }
h1 { font-weight: 800; font-size: clamp(26px, 5vw, 38px); margin: 0; letter-spacing: -0.015em; }
.phu { color: var(--chu-2); font-size: 13px; margin: 4px 0; font-variant-numeric: tabular-nums; font-weight: 400; }
.kinh { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px; margin: 14px 0 6px; }
.kinh div { background: var(--giay); border: 1px solid var(--vien); border-radius: 8px; padding: 10px 12px; min-width: 0; }
.kinh dt { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--cam); font-weight: 700; } .kinh dd { margin: 2px 0 0; font-size: 13.5px; }
.canh-bao { border: 1px solid var(--do); color: var(--do); border-radius: 8px; padding: 8px 12px; margin: 10px 0; font-size: 13px; } .canh-bao ul { margin: 4px 0 0; padding-left: 18px; }
.tabs { position: sticky; top: 0; z-index: 2; background: var(--nen); display: flex; gap: 4px; overflow-x: auto; padding-block: 10px; border-bottom: 1px solid var(--vien); margin-top: 12px; }
.tabs button { font: inherit; font-size: 13.5px; white-space: nowrap; border: 1px solid var(--vien); background: var(--giay); color: var(--chu-2); padding: 6px 12px; border-radius: 999px; cursor: pointer; }
.tabs button[aria-selected="true"] { background: var(--chu); color: var(--giay); border-color: var(--chu); } .tabs button:focus-visible { outline: 2px solid var(--cam); outline-offset: 2px; }
.ai { margin: 14px 0 10px; font-size: 13px; color: var(--cam); font-weight: 700; }
.sp { background: var(--giay); border: 1px solid var(--vien); border-radius: 4px; max-width: 760px; margin: 0 auto; padding: 40px clamp(16px, 7vw, 72px); font-family: var(--f-may); font-size: 15px; line-height: 1.5; }
.sp-tieu { text-align: center; font-weight: 700; margin: 0 0 4px; } .sp-phu { text-align: center; margin: 0 0 30px; color: var(--chu-2); }
.sp-canh { margin-bottom: 26px; } .sp-dau { font-weight: 700; margin: 0 0 12px; } .sp-hd { margin: 0 0 12px; } .sp-am { margin: 0 0 12px; font-style: italic; color: var(--chu-2); }
.sp-thoai { margin: 0 auto 12px; max-width: 34ch; } .sp-thoai p { margin: 0; } .sp-ten { text-align: center; font-weight: 700; } .sp-dien { text-align: center; color: var(--chu-2); } .sp-loi { text-align: center; }
.sp-chuyen { text-align: right; font-weight: 700; margin: 0 0 12px; }
.cuon { overflow-x: auto; border: 1px solid var(--vien); border-radius: 8px; background: var(--giay); }
.bang { border-collapse: collapse; width: 100%; font-size: 13px; }
.bang th { text-align: left; font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--chu-2); background: var(--nen); padding: 8px 10px; border-bottom: 1px solid var(--vien); white-space: nowrap; }
.bang td { padding: 8px 10px; border-bottom: 1px solid var(--vien); vertical-align: top; } .bang tr:last-child td { border-bottom: 0; }
.bang td.so { font-variant-numeric: tabular-nums; white-space: nowrap; } .sl td { min-width: 96px; } .sl td.rong { min-width: 240px; } .lt td { min-width: 190px; } .lt td.so { min-width: 0; }
td[lang="en"] { font-family: var(--f-may); font-size: 12.5px; }
.the { display: inline-block; font-size: 12px; border-radius: 999px; padding: 1px 8px; margin: 0 4px 4px 0; border: 1px solid currentColor; white-space: nowrap; }
.the.bc { color: var(--la); } .the.nv { color: var(--cam); } .the.dc { color: var(--xanh); } .the.luat { color: var(--tim); cursor: help; } .trong { color: var(--chu-2); } ul.gon { margin: 0; padding-left: 16px; }
.khoi { background: var(--giay); border: 1px solid var(--vien); border-radius: 8px; padding: 14px 16px; margin-bottom: 10px; } .khoi h3 { margin: 0 0 8px; font-size: 16px; }
.cap { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px; margin: 0; }
.cap div { border-left: 3px solid var(--cam); background: var(--cam-nhat); padding: 6px 10px; border-radius: 0 6px 6px 0; min-width: 0; }
.cap dt { font-size: 11px; font-weight: 700; color: var(--chu-2); text-transform: uppercase; letter-spacing: 0.06em; } .cap dd { margin: 0; font-size: 14px; }
.nhan-nho { font-size: 12px; color: var(--chu-2); margin: 10px 0 4px; } .nhip { margin: 0; padding-left: 20px; font-size: 14px; }
.dai-mau { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; }
.o-mau { background: var(--giay); border: 1px solid var(--vien); border-radius: 8px; overflow: hidden; min-width: 0; } .o-mau .vet { height: 72px; } .o-mau p { margin: 6px 12px; font-size: 13px; } .o-mau .tieu { margin-top: 10px; }
[hidden] { display: none !important; }
</style>
<div class="trang">
  <h1>${e(v.ten)}</h1>
  <p class="phu">${e(v.phim)} · Tập ${v.so}${v.khong_loi ? ' · không lời' : ''} · ${v.phan_canh.length} cảnh · ${ds.length} shot · ~${Math.round(tong)} giây</p>
  ${[v.ho_so.thoi_gian && ['Thời gian', v.ho_so.thoi_gian], v.ho_so.duong_di && ['Đường đi', v.ho_so.duong_di], v.ho_so.motif && ['Motif', v.ho_so.motif]].filter(Boolean).length ? `<dl class="kinh">${([['Thời gian', v.ho_so.thoi_gian], ['Đường đi', v.ho_so.duong_di], ['Motif', v.ho_so.motif]] as const).filter(([, x]) => x).map(([k, x]) => `<div><dt>${k}</dt><dd>${e(x!)}</dd></div>`).join('')}</dl>` : ''}
  ${loi.length ? `<div class="canh-bao"><b>Hồ sơ chưa đủ chuẩn studio (${loi.length})</b><ul>${loi.slice(0, 12).map((x) => `<li>${e(x)}</li>`).join('')}</ul></div>` : ''}
  <div class="tabs" role="tablist">${TAB.map(([id, chu], i) => `<button id="t-${id}" role="tab" aria-selected="${i === 0}" aria-controls="p-${id}" data-tab="${id}">${i + 1}. ${chu}</button>`).join('')}</div>
  ${TAB.map(([id, , ai], i) => `<section id="p-${id}" role="tabpanel" aria-labelledby="t-${id}"${i ? ' hidden' : ''}><p class="ai">${ai}</p>${NOI[id]}</section>`).join('')}
  <p class="phu" style="margin-top:24px">Rê chuột lên nhãn luật để đọc nội dung. Thư viện: ${LUAT_DUNG_CANH.length} luật dựng cảnh.</p>
</div>
<script>
const nut = [...document.querySelectorAll('[data-tab]')];
function mo(id) { nut.forEach((b) => { const on = b.dataset.tab === id; b.setAttribute('aria-selected', on); document.getElementById('p-' + b.dataset.tab).hidden = !on; }); }
nut.forEach((b) => b.addEventListener('click', () => { mo(b.dataset.tab); try { history.replaceState(null, '', '#' + b.dataset.tab); } catch (_) {} }));
const h = location.hash.slice(1); if (nut.some((b) => b.dataset.tab === h)) mo(h);
</script>
`;
}
