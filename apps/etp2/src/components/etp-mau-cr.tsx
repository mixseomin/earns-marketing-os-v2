'use client';
// TAB MẪU CREATIVE (anh 19/11/2026: "Tạo 1 tab mới là Mẫu Creative và tổng hợp vào đó. Có bộ lọc đầy đủ").
// LUẬT (anh 19/11/2026): mọi creative tải lên phải gắn MỘT công thức trong sổ (cổng len-creative.py + apps/etp/so_mau.py) — số Creative / Camp / ROI của công thức đo theo etp.creative_mau.
// Một danh sách gộp: công thức máy dựng · dạng creative nhà (sổ etp-dang.json + số thật) · bố cục ảnh nhà (bo-cuc-po.py) · mẫu học từ QC đối thủ (sổ etp-mau-cr.json).
// Lọc: Loại · Nguồn · Trạng thái (chip) · Dùng cho dạng · Thể loại (chọn nhiều, có tìm) — mọi lọc trên URL (?mcl ?mcn ?mct ?mcd ?mctl) + ô tìm + lọc theo cột số của DataTable (cột chữ lọc bằng chip / ô chọn ở trên, không dựng bộ thứ hai).
// Xem Thẻ (mặc định, có ảnh mẫu) hoặc Bảng (đủ cột số). CHỈ ĐỌC. Dữ liệu: lib/actions/etp-mau-cr.ts.
// tra-repo-ok: màn nội bộ dựng từ khối dùng chung của etp2 (DataTable thẻ / bảng, FilterChips, MultiSelect, useSoNho)
import { useEffect, useMemo, useState } from 'react';
import { DataTable, FilterChips, MultiSelect, type DataColumn } from '@/components/ui';
import { Cay, NutCay } from '@/components/ui/cay';
import { Dem, MO_SO } from '@/components/etp-so';
import { useSoNho } from '@/lib/so-nho';
import { openEntityDrawer } from '@/lib/entity-drawer';
import { SU_KIEN_MAU } from '@/lib/etp-mau-su-kien';
import { loiThuongMau } from '@/lib/etp-mau-loi';
import { DS_DANG } from '@/lib/etp-dang';
import { docMauCr, type DungMau, type LoaiMau, type MauCr, type NguonMau, type PhimSx, type TrangThaiMau } from '@/lib/actions/etp-mau-cr';
import { DO, XANH, gioVn } from './etp-doi-thu';
import { ChiTietMau, DauMau } from './etp-mau-drawer';

const thuVienQc = (id: string) => `https://href.li/?https://www.facebook.com/ads/library/?id=${id}`;   // link ra ngoài che referrer
export const TEN_LOAI: Record<LoaiMau, string> = { cong_thuc: 'Công thức máy dựng', dang: 'Dạng creative', bien_the: 'Biến thể của dạng', bo_cuc: 'Bố cục ảnh', lop_phu: 'Lớp phủ chữ / nút' };
export const TEN_NGUON: Record<NguonMau, string> = { nha: 'Nhà', doi_thu: 'Học từ đối thủ' };
// màu chỉ cho TRẠNG THÁI (tín hiệu thật) — loại / nguồn để xám (YDNI kỷ luật màu)
export const TEN_TT: Record<TrangThaiMau, [string, string, string]> = {
  chay: ['Đang chạy', '#4ade80', 'có camp đang chạy bằng dạng này'],
  may: ['Đã vào máy', '#60a5fa', 'máy đang dựng theo mẫu này / đã từng lên camp — hiện không camp nào chạy'],
  chuan: ['Đã chuẩn hoá', '#2dd4bf', 'quy trình dựng đã chuẩn hoá và anh đã duyệt bản mẫu — chọn phim là dựng được, chưa có camp nào'],
  thu: ['Có mã dựng', '#fbbf24', 'đã có mã dựng (dựng thử được), chưa vào máy lên camp'],
  chua: ['Chưa dựng', '#94a3b8', 'mới là mẫu tham chiếu từ QC đối thủ — chưa có mã dựng'],
};
const roi = (s: MauCr['so']) => (s && s.chi > 0.5 ? ((s.thu - s.chi) / s.chi) * 100 : null);
const LOAI: LoaiMau[] = ['cong_thuc', 'dang', 'bien_the', 'bo_cuc', 'lop_phu'], NGUON: NguonMau[] = ['nha', 'doi_thu'], TT: TrangThaiMau[] = ['chay', 'may', 'chuan', 'thu', 'chua'];
const DANG_TEN = DS_DANG.map((d) => d.dang);
/** mẫu áp được cho dạng nào: dạng → chính nó; bố cục / lớp phủ → danh sách dung_cho */
const choDang = (m: MauCr) => (m.loai === 'dang' ? [m.ten] : m.dung_cho);
export const TEN_GIONG: Record<string, string> = { thuong: 'thường', ky_di: 'kỳ dị', gao: 'gào', cam_xuc: 'cảm xúc', hao_hung: 'hào hứng' };

export const docUrl = (k: string) => (typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get(k));
export function ghiUrl(k: string, v: string | null) {
  const u = new URL(window.location.href);
  if ((u.searchParams.get(k) ?? null) === v) return;
  if (v) u.searchParams.set(k, v); else u.searchParams.delete(k);
  window.history.replaceState(window.history.state, '', `${u.pathname}${u.search}${u.hash}`);
}
/** một bộ lọc chọn nhiều giữ trên URL (rời tab thì bỏ khỏi URL) */
function useLoc(k: string) {
  const [v, setV] = useState<string[]>(() => (docUrl(k) ?? '').split(',').filter(Boolean));
  useEffect(() => { ghiUrl(k, v.length ? v.join(',') : null); }, [k, v]);
  useEffect(() => () => ghiUrl(k, null), [k]);
  return [v, setV] as const;
}

/** MỌI creative mẫu hiện NGUYÊN ngay trong thẻ (anh 19/11/2026 "cái này phải show ngay ra chứ ko phải bấm vào mới thấy" · "full creative"):
 *  lưới cạnh nhau, đúng khổ 9:16 không cắt, có video thì phát được tại chỗ (ảnh làm poster); nhãn = số ngày chạy (đối thủ) / thu (nhà) */
/** CREATIVE HIỆN Ở NGOÀI (thẻ / bảng) — anh 19/11/2026: "ko đc để creative lên đây. Tao đã duyệt đéo đâu. Tao sẽ đặt lên nếu muốn. Ở ngoài chỉ đc để creative từ nguồn".
 *  Mẫu học từ đối thủ: creative gốc của đối thủ + bản anh ĐÃ DUYỆT làm mẫu (mau_duyet). Bản máy dựng thử + creative máy sinh cho phim chưa được anh duyệt làm mẫu → chỉ nằm trong ngăn
 *  (tab Phim sản xuất, dải So với gốc). Mẫu nhà: creative nhà chính là nguồn → giữ. */
export const banNguon = (m: MauCr) => { if (m.nguon !== 'doi_thu') return m.ban;
  // THỨ TỰ (20/11/2026 rà tổ chức): nguồn đối thủ đầu tiên · bản nhà đã duyệt đầu tiên đứng NGAY CẠNH để so · rồi nguồn còn lại · rồi bản duyệt còn lại — thẻ 3 ô không còn đẩy khuất QC gốc
  const g = m.ban.filter((b) => b.vai === 'goc'), d = m.ban.filter((b) => b.vai === 'duyet'); return [...g.slice(0, 1), ...d.slice(0, 1), ...g.slice(1), ...d.slice(1)]; };
/** đếm theo vai của một mẫu học từ đối thủ — chữ dùng chung cho thẻ / cây */
export const demBan = (m: MauCr) => ({ goc: m.ban.filter((b) => b.vai === 'goc').length, duyet: m.ban.filter((b) => b.vai === 'duyet').length });
export function BanMauLuoi({ m: mGoc, cot = 3, nhom = false, oRong }: { m: MauCr; cot?: number; /** ô rộng cố định (px) thay cho chia đều theo cột */ oRong?: number; /** chi tiết mẫu: chia HAI NHÓM có nhãn (nguồn đối thủ / nhà đã duyệt), mỗi nhóm một dải */ nhom?: boolean }) {
  if (nhom && mGoc.nguon === 'doi_thu') { const g = mGoc.ban.filter((b) => b.vai === 'goc'), d = mGoc.ban.filter((b) => b.vai === 'duyet');
    // hai nhóm CẠNH NHAU trên một hàng, ô nhỏ cố định 128px (ô to chia theo cột đẩy mô tả + quy trình xuống dưới màn — đo 20/11/2026); hẹp thì nhóm sau tự xuống dòng
    if (g.length && d.length) return <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 22px' }}>
      {([['Nguồn đối thủ', g, 'QC gốc của đối thủ mà mẫu này học theo'], ['Nhà đã duyệt', d, 'creative máy dựng theo mẫu, anh đã duyệt làm mẫu']] as const).map(([ten, ds, goi]) => <div key={ten} style={{ maxWidth: '100%', minWidth: 0 }}>
        <div title={goi} style={{ fontSize: 11.5, color: MO_SO, marginBottom: 4 }}>{ten} · <Dem v={ds.length} /></div>
        <BanMauLuoi m={{ ...mGoc, nguon: 'nha', ban: [...ds] }} cot={cot} oRong={128} /></div>)}
    </div>; }
  const m = { ...mGoc, ban: banNguon(mGoc) };
  if (!m.ban.length) return <div style={{ aspectRatio: '9 / 16', maxHeight: 300, display: 'grid', placeItems: 'center', background: 'var(--bg-2)', color: MO_SO, fontSize: 11.5, borderRadius: 6 }}>chưa lưu creative gốc</div>;
  // SLIDES MỘT DÒNG (anh 19/11/2026 #1703 "Trình bày dạng slides 1 dòng thôi") — mọi bản nằm trên MỘT hàng, quá 3 bản thì trượt ngang (bám từng ô),
  // không xuống dòng; ô vẫn cùng một cỡ = 1/3 bề ngang thẻ (anh 19/11/2026 "ko cho hiển thị nơi to nơi bé")
  return <div style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: oRong ? `${oRong}px` : `calc((100% - ${(cot - 1) * 6}px) / ${cot})`, overflowX: 'auto', scrollSnapType: 'x mandatory', overscrollBehaviorX: 'contain', paddingBottom: m.ban.length > cot ? 4 : 0, gap: 6 }}
    title={m.ban.length > cot ? `${m.ban.length} creative mẫu — kéo ngang / lăn chuột để xem hết` : undefined}>
    {m.ban.map((b, i) => <div key={i} title={b.goi_y} style={{ scrollSnapAlign: 'start', position: 'relative', aspectRatio: '9 / 16', background: '#000', borderRadius: 6, overflow: 'hidden', outline: b.vai === 'dung' ? '2px solid rgba(37,99,235,0.9)' : b.vai === 'duyet' ? '2px solid rgba(22,163,74,0.9)' : undefined }}>
      {b.video
        ? <video src={b.video} poster={b.anh ?? undefined} controls muted loop playsInline preload="none" onClick={(e) => e.stopPropagation()} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
        : b.anh ? <img src={b.anh} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} /> : null}
      <span style={{ position: 'absolute', left: 4, top: 4, display: 'inline-flex', gap: 4, pointerEvents: 'none' }}>
        {b.nhan ? <span style={{ fontSize: 10.5, padding: '0 6px', borderRadius: 8, background: b.vai === 'dung' ? 'rgba(37,99,235,0.92)' : b.vai === 'duyet' ? 'rgba(22,163,74,0.92)' : b.vai === 'goc' ? 'rgba(194,65,12,0.92)' : 'rgba(0,0,0,0.7)', color: b.con_chay && b.vai !== 'goc' ? XANH : '#fff', fontWeight: b.vai ? 600 : undefined, fontVariantNumeric: 'tabular-nums' }}>{b.nhan}{b.con_chay ? ' ●' : ''}</span> : null}
      </span>
      {b.link ? <a href={b.link.startsWith('https://www.facebook.com') ? `https://href.li/?${b.link}` : b.link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
        title={b.link.startsWith('https://www.facebook.com') ? 'mở QC trong Thư viện QC Meta' : 'mở creative cỡ gốc'}
        style={{ position: 'absolute', right: 4, top: 4, fontSize: 11, padding: '0 6px', borderRadius: 8, background: 'rgba(0,0,0,0.7)', color: '#fff', textDecoration: 'none' }}>↗</a> : null}
    </div>)}
  </div>;
}
type DsPhim = { id: number; ten: string }[];
const TT_DONG: Record<string, [string, string]> = { chay: ['đang sinh', '#fbbf24'], xong: ['xong', '#4ade80'], dung: ['dừng', '#f87171'], loi: ['lỗi', '#f87171'] };
/** máy nào dựng mẫu này — lời thường (YDNI 9a: không tên tệp, không mã) */
export const mayDung = (m: MauCr) => (m.dong ? 'Máy dòng phim dựng — chọn phim là máy bắt đầu sinh creative' : m.may_mau ? 'Máy dựng theo mẫu — chọn phim là vào hàng chờ (hàng chờ chưa có lịch tự chạy)' : 'Chưa có máy dựng — chọn phim chỉ ghi lại, có máy rồi mới sinh creative');
/** phim cần nhìn trước: lỗi → đang làm → chờ → đã có creative */
const uuTien = (f: PhimSx) => (f.dung?.trang_thai === 'loi' || f.dong_tt === 'loi' ? 0 : f.dung && f.dung.trang_thai !== 'xong' ? 1 : f.dong_tt === 'chay' ? 1 : f.cr.length ? 3 : 2);
/** CHÂN THẺ — phim sản xuất theo mẫu + creative thật của từng phim (anh 19/11/2026: "Ở footer mỗi card sẽ là danh sách creative thực của mỗi phim được lựa chọn
 *  để sản xuất từ creative mẫu tương ứng … Mỗi phim có thể có nhiều creative"). YDNI mục 10: mỗi phim MỘT dòng (đèn trạng thái · tên · bước · ảnh creative nhỏ),
 *  tối đa 3 phim cần nhìn nhất, còn lại + chi tiết từng bước nằm trong ngăn mẫu (tab Phim sản xuất). */
function ChanThe({ m }: { m: MauCr }) {
  const ds = [...m.phim_sx].sort((a, b) => uuTien(a) - uuTien(b)), n = m.phim_sx.length;
  return <div onClick={(e) => e.stopPropagation()} style={{ borderTop: '1px solid var(--line)', paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 11.5, color: MO_SO, flex: 1 }} title={`${n} phim đã chọn cho mẫu này · ${m.phim_sx.reduce((a, f) => a + f.cr.length, 0)} creative đã ra`}>Phim sản xuất{n ? <> · <Dem v={n} /></> : null}</span>
      <button type="button" onClick={() => openEntityDrawer('etp-mau-phim', m.ma)} title={`Chọn phim để sinh creative theo mẫu này. ${mayDung(m)}`}
        style={{ fontSize: 11.5, padding: '1px 9px', borderRadius: 6, border: '1px solid var(--accent, #60a5fa)', background: 'transparent', color: 'var(--accent, #60a5fa)', cursor: 'pointer' }}>＋ Chọn phim</button>
    </div>
    {ds.slice(0, 3).map((f) => <DongPhimGon key={f.content_id} f={f} ma={m.ma} anAnh={m.nguon === 'doi_thu'} />)}
    {n > 3 ? <a onClick={() => { ghiUrl('mxt', 'phim'); openEntityDrawer('etp-mau', `${m.loai}:${m.ma}`); }} style={{ fontSize: 11, color: 'var(--accent, #60a5fa)', cursor: 'pointer' }}>xem cả {n} phim ›</a> : null}
  </div>;
}
/** trạng thái một phim sản xuất → [màu đèn, chữ ngắn, chữ rê chuột] */
export function ttPhim(f: PhimSx): [string, string, string] {
  if (f.dung) { const i = BUOC_DUNG.findIndex(([k]) => k === f.dung!.buoc), b = BUOC_DUNG[i]?.[1] ?? 'đang làm', g = `${loiThuongMau(f.dung.ghi)} · cập nhật ${gioNgan(f.dung.cap_nhat)}`;
    return f.dung.trang_thai === 'loi' ? [DO, `lỗi ở ${b}`, g] : f.dung.trang_thai === 'xong' ? [XANH, 'xong', g] : f.dung.buoc === 'cho' ? ['#94a3b8', 'chờ máy', g] : ['#fbbf24', b, g]; }
  if (f.dong_tt) { const t = TT_DONG[f.dong_tt]; return [t?.[1] ?? '#94a3b8', t?.[0] ?? 'đang làm', f.dong_ly ?? 'máy dòng phim đang sinh creative']; }
  return f.cr.length ? [XANH, 'đã có creative', ''] : ['#94a3b8', 'chờ máy', 'đã chọn phim, máy chưa nhận việc'];
}
const moPhimSx = (f: PhimSx, ma: string) => (f.dung || !f.dong_id ? () => openEntityDrawer('etp-mau-dung', `${ma}:${f.content_id}`) : () => openEntityDrawer('etp-sx', f.content_id));
function DongPhimGon({ f, ma, anAnh = false }: { f: PhimSx; ma: string; /** mẫu học từ đối thủ: creative máy sinh CHƯA được anh duyệt → ngoài thẻ chỉ ghi số, ảnh nằm trong ngăn */ anAnh?: boolean }) {
  const [mau, chu, goi] = ttPhim(f);
  return <div onClick={moPhimSx(f, ma)} title={`${f.ten ?? ''} — ${chu}${goi ? ` · ${goi}` : ''} · bấm xem từng bước`} className="mau-dong-phim"
    style={{ display: 'grid', gridTemplateColumns: '8px minmax(0, 1fr) auto auto', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', borderRadius: 5, padding: '2px 4px', margin: '0 -4px', height: 24 }}>
    <span style={{ width: 7, height: 7, borderRadius: 4, background: mau }} />
    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.ten ?? 'phim chưa có tên'}</span>
    <span style={{ fontSize: 11, color: mau === DO ? DO : MO_SO, whiteSpace: 'nowrap' }}>{chu}</span>
    {anAnh ? <span style={{ fontSize: 11, color: MO_SO, whiteSpace: 'nowrap' }}>{f.cr.length ? `${f.cr.length} creative` : ''}</span>
    : <span style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }}>{f.cr.slice(0, 3).map((c) => <span key={c.id} style={{ width: 11, height: 20, borderRadius: 2, overflow: 'hidden', background: '#000', display: 'block' }}>{c.anh ? <img src={c.anh} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : null}</span>)}
      {f.cr.length > 3 ? <span style={{ fontSize: 10.5, color: MO_SO }}>+{f.cr.length - 3}</span> : null}</span>}
  </div>;
}
// các bước máy dựng theo mẫu (dung-mau.py) — thanh tiến độ trong chân thẻ
export const BUOC_DUNG: [string, string][] = [['cho', 'chờ máy'], ['trang_phim', 'chờ link tập'], ['tai_tap', 'tải tập'], ['chon_khung', 'chọn khung'], ['ve_mau', 'vẽ mẫu'], ['giong', 'giọng'], ['video', 'video'], ['thu_vien', 'thư viện'], ['creative', 'tải creative'], ['xong', 'xong']];
const gioNgan = (s: string) => new Date(s).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
function TienDoDung({ d }: { d: DungMau }) {
  const i = Math.max(0, BUOC_DUNG.findIndex(([k]) => k === d.buoc)), loi = d.trang_thai === 'loi', xong = d.trang_thai === 'xong';
  const mau = loi ? DO : xong ? XANH : '#fbbf24';
  return <div title={`${loiThuongMau(d.ghi)} · cập nhật ${gioNgan(d.cap_nhat)}`} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${BUOC_DUNG.length - 1}, 1fr)`, gap: 2 }}>
      {BUOC_DUNG.slice(1).map(([k, nh], j) => <span key={k} title={nh} style={{ height: 4, borderRadius: 2, background: xong || j < i - 1 ? XANH : j === i - 1 ? mau : 'var(--line)' }} />)}
    </div>
    <div style={{ fontSize: 11, color: loi ? DO : 'var(--fg-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {loi ? '✕ lỗi' : xong ? '✓ xong' : `● ${BUOC_DUNG[i]?.[1] ?? 'đang làm'}`} · {loiThuongMau(d.ghi)} · {gioNgan(d.cap_nhat)}</div>
  </div>;
}
export function DongPhimSx({ f, ma }: { f: PhimSx; ma: string }) {
  const tt = f.dong_tt ? TT_DONG[f.dong_tt] : null;
  // BẤM PHIM = XEM CHI TIẾT CÁC BƯỚC THEO DÒNG THỜI GIAN (anh 19/11/2026): việc dựng theo mẫu → ngăn etp-mau-dung · dòng phim → ngăn Sản xuất phim (etp-sx) sẵn có
  const mo = moPhimSx(f, ma);
  return <div onClick={mo} title="bấm xem chi tiết các bước + vấn đề theo dòng thời gian" style={{ display: 'flex', flexDirection: 'column', gap: 4, cursor: 'pointer', borderRadius: 6, padding: '3px 4px', margin: '0 -4px' }}
    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={f.ten ?? ''}>{f.ten ?? 'phim chưa có tên'}</span>
      {tt ? <span title={f.dong_ly ?? 'máy dòng phim đang sinh creative'} style={{ fontSize: 10.5, color: tt[1], whiteSpace: 'nowrap' }}>● {tt[0]}</span>
        : f.chon && !f.cr.length && !f.dung ? <span style={{ fontSize: 10.5, color: MO_SO }}>chờ máy</span> : null}
      <span style={{ fontSize: 11, color: MO_SO, fontVariantNumeric: 'tabular-nums' }}>{f.cr.length} creative</span>
    </div>
    {f.dung ? <TienDoDung d={f.dung} /> : null}
    {f.cr.length ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 4 }}>
      {f.cr.map((c) => { const r = c.chi > 0.5 ? ((c.thu - c.chi) / c.chi) * 100 : null; return <a key={c.id} href={c.video ?? c.anh ?? undefined} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
        title={`${c.camp} camp${c.chay ? ' (đang chạy)' : ''} · chi $${c.chi.toFixed(2)} · thu $${c.thu.toFixed(2)}${r != null ? ` · ROI ${r.toFixed(0)}%` : ''} — mở video`}
        style={{ position: 'relative', aspectRatio: '9 / 16', background: '#000', borderRadius: 4, overflow: 'hidden', display: 'block' }}>
        {c.anh ? <img src={c.anh} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} /> : null}
        <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, fontSize: 9.5, padding: '0 3px', background: 'rgba(0,0,0,0.7)', color: c.chay ? XANH : r != null ? (r >= 0 ? XANH : DO) : '#fff', fontVariantNumeric: 'tabular-nums', textAlign: 'center' }}>
          {c.chay ? '● ' : ''}{r != null ? `${r.toFixed(0)}%` : 'mới'}</span>
      </a>; })}
    </div> : null}
  </div>;
}
const Nhan = ({ children, mau = 'var(--fg-3)', title }: { children: React.ReactNode; mau?: string; title?: string }) =>
  <span title={title} style={{ fontSize: 10.5, padding: '1px 7px', borderRadius: 9, border: `1px solid ${mau}`, color: mau, whiteSpace: 'nowrap' }}>{children}</span>;
const OTT = ({ m }: { m: MauCr }) => { const [t, c, ti] = TEN_TT[m.trang_thai]; return <Nhan mau={c} title={ti}>{t}</Nhan>; };
export const ORoi = ({ s }: { s: MauCr['so'] }) => { const r = roi(s); return r == null ? <span style={{ color: MO_SO }}>—</span>
  : <span title={`chi $${s!.chi.toFixed(0)} · thu $${s!.thu.toFixed(0)} · lãi $${(s!.thu - s!.chi).toFixed(0)}`} style={{ color: r >= 0 ? XANH : DO, fontVariantNumeric: 'tabular-nums' }}>{r.toFixed(0)}%</span>; };
export function ThamChieu({ m }: { m: MauCr }) {
  if (!m.tham_chieu.length) return <span style={{ color: MO_SO }}>—</span>;
  return <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>{m.tham_chieu.map((t) =>
    <a key={t.id} href={thuVienQc(t.id)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} title={`${t.phim ?? 'QC đối thủ'} · chạy ${t.ngay ?? '?'} ngày${t.con_chay ? ' · còn chạy' : ''} — mở Thư viện QC Meta`}
      style={{ fontSize: 11.5, fontVariantNumeric: 'tabular-nums', color: t.con_chay ? XANH : 'var(--fg-2)' }}>{t.ngay ?? '?'} ngày{t.con_chay ? ' ●' : ''}</a>)}</span>;
}

/** THẺ MẪU — YDNI: chỉ thứ để CHỌN mẫu (creative mẫu · tên · đèn trạng thái · một dòng loại · 2 dòng mô tả · số nhà) + việc đang chạy (phim sản xuất).
 *  Thông số biến thể giữ trên thẻ (anh 19/11/2026 "mở cái nào là sẽ biết mình sx loại creative nào"). Giọng đọc, dùng cho dạng nào, hợp thể loại, QC đối thủ gốc,
 *  máy dựng → ngăn mẫu, bấm thẻ là mở (?ed=etp-mau~…). */
function The({ m }: { m: MauCr }) {
  const s = m.so, [, mauTt, goiTt] = TEN_TT[m.trang_thai];
  return <div onClick={() => openEntityDrawer('etp-mau', `${m.loai}:${m.ma}`)} title="bấm xem đủ thông số mẫu + mọi phim sản xuất"
    style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', gap: 6, height: '100%', cursor: 'pointer' }}>
    <BanMauLuoi m={m} />
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span title={`${TEN_TT[m.trang_thai][0]} — ${goiTt}`} style={{ width: 8, height: 8, borderRadius: 4, background: mauTt, flex: 'none' }} />
      <b style={{ fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={m.ten}>{m.ten}</b>
      {s ? <span style={{ fontSize: 11.5, flex: 'none', fontVariantNumeric: 'tabular-nums' }} title={`${s.cr} creative nhà · camp đang chạy ${s.dang_chay} / đã lên ${s.camp} · chi $${s.chi.toFixed(0)}`}><span style={{ color: MO_SO }}>{s.dang_chay}/{s.camp} camp · ROI </span><ORoi s={s} /></span> : null}
    </div>
    <div style={{ fontSize: 11.5, color: MO_SO, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(m.nguon === 'doi_thu' ? [m.vai ?? TEN_LOAI[m.loai], `${demBan(m).goc} QC gốc đối thủ`, demBan(m).duyet ? `${demBan(m).duyet} đã duyệt` : null] : [TEN_LOAI[m.loai], m.vai, TEN_NGUON[m.nguon], s ? `${s.cr} creative nhà` : null]).filter(Boolean).join(' · ')}</div>
    <div title={m.mo_ta} style={{ fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 34 }}>{m.mo_ta}</div>
    {m.spec?.length ? <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: '2px 10px', fontSize: 11.5 }}>
      {m.spec.map((x) => [<span key={`a${x.nhan}`} style={{ color: MO_SO, whiteSpace: 'nowrap' }}>{x.nhan}</span>, <span key={`b${x.nhan}`} title={x.gia} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.gia}</span>])}</div> : null}
    <div style={{ marginTop: 'auto' }}><ChanThe m={m} /></div>
  </div>;
}

/** bản giữ trong máy đúng khuôn hiện tại (mỗi mẫu có mảng ban + tham_chieu + dung_cho + the_loai) — bản khuôn cũ thì bỏ, chờ bản mới */
// khuôn bản giữ: đổi khuôn BanMau (thêm vai gốc / máy dựng) không cần đổi — trường tuỳ chọn
export const hopKhuon = (v: unknown) => { const ds = (v as { mau?: unknown })?.mau; return Array.isArray((v as { phim?: unknown })?.phim) && Array.isArray(ds) && ds.every((m) => typeof (m as Record<string, unknown>)?.may_mau === 'boolean' && typeof (m as Record<string, unknown>)?.nhom_tk === 'string' && ['ban', 'tham_chieu', 'dung_cho', 'the_loai', 'phim_sx', 'spec', 'giong', 'quy_trinh'].every((k) => Array.isArray((m as Record<string, unknown>)?.[k]))); };

/** nhóm tầng 2 trong cây: Dạng creative · Công thức máy dựng · Format · <vai> */
const nhom2 = (m: MauCr) => (m.loai === 'dang' ? 'Dạng creative' : m.loai === 'cong_thuc' ? 'Công thức máy dựng' : `Format · ${m.vai ?? 'khác'}`);
export const CHAM_TT: Record<TrangThaiMau, string> = { chay: '#4ade80', may: '#60a5fa', chuan: '#2dd4bf', thu: '#fbbf24', chua: '#94a3b8' };

/** CÂY TỔNG QUÁT bên trái (anh 19/11/2026 "Ở tab Mẫu Creative, phải có tree view để còn nắm đc tổng quát"): Tất cả → thể loại → nhóm (dạng / công thức / format theo vai)
 *  → từng mẫu; số đếm theo bộ lọc đang bật; bấm nút = lọc lưới bên phải (?mcc=); cột kéo đổi rộng, nhớ theo máy. Mở / gập nhóm giữ trên URL (?mco=). */
function CayMau({ rows, chon, setChon, mo, setMo }: { rows: MauCr[]; chon: string; setChon: (v: string) => void; mo: string[]; setMo: (v: string[]) => void }) {
  const [rong, setRong] = useState(() => { try { return Number(localStorage.getItem('etp-mau-cay-rong')) || 280; } catch { return 280; } });
  const keo = (e: React.PointerEvent) => {
    e.preventDefault(); const x0 = e.clientX, r0 = rong; let cuoi = r0;
    const di = (ev: PointerEvent) => { cuoi = Math.max(200, Math.min(520, r0 + ev.clientX - x0)); setRong(cuoi); };
    const tha = () => { window.removeEventListener('pointermove', di); window.removeEventListener('pointerup', tha); document.body.style.userSelect = ''; try { localStorage.setItem('etp-mau-cay-rong', String(cuoi)); } catch { /* kho chặn */ } };
    document.body.style.userSelect = 'none'; window.addEventListener('pointermove', di); window.addEventListener('pointerup', tha);
  };
  const theoTl = new Map<string, Map<string, MauCr[]>>();
  for (const m of rows) { if (m.loai === 'bien_the') continue; const a = theoTl.get(m.nhom_tk) ?? new Map<string, MauCr[]>(); theoTl.set(m.nhom_tk, a); a.set(nhom2(m), [...(a.get(nhom2(m)) ?? []), m]); }
  const conCua = (m: MauCr) => (m.loai === 'dang' ? rows.filter((x) => x.loai === 'bien_the' && x.cha === m.ma) : []);
  const doiMo = (k: string) => setMo(mo.includes(k) ? mo.filter((x) => x !== k) : [...mo, k]);
  const so = (n: number) => <span style={{ color: MO_SO, fontSize: 11.5, fontVariantNumeric: 'tabular-nums' }}>{n}</span>;
  // CỘT DÍNH NGAY DƯỚI HÀNG TAB (--etp-dinh) và CAO TRỌN MÀN (anh 19/11/2026 "cho resize toàn bộ cột đó. Fix cả sticky của nó"): trước dính ở top 8 → chui dưới hàng tab,
  // và cao bằng nội dung → tay kéo chỉ dài bằng cây. Nay khung ngoài cố định cao, cây cuộn bên trong, tay kéo là dải dọc suốt mép phải (nằm ngoài vùng cuộn).
  return <div data-cot="cay-mau" style={{ width: rong, flex: 'none', position: 'sticky', top: 'calc(var(--etp-dinh, 0px) + 6px)', alignSelf: 'flex-start', height: 'calc(100vh - var(--etp-dinh, 0px) - 18px)', marginRight: 12 }}>
    <div style={{ height: '100%', overflowY: 'auto', borderRight: '1px solid var(--line)', paddingRight: 6 }}>
    <Cay label="cây mẫu creative">
      <NutCay ten={<b>Tất cả mẫu</b>} phai={so(rows.length)} chon={!chon} onChon={() => setChon('')} />
      {[...theoTl].map(([tl, nhom]) => { const kt = `t:${tl}`, tong = [...nhom.values()].reduce((a, x) => a + x.length, 0);
        return <NutCay key={kt} ten={<b>{tl}</b>} phai={so(tong)} chon={chon === kt} onChon={() => setChon(kt)} mo={mo.includes(kt)} onDoi={() => doiMo(kt)}>
          {[...nhom].map(([n2, ds]) => { const kn = `n:${tl}|${n2}`;
            return <NutCay key={kn} ten={<span>{n2}</span>} phai={so(ds.length)} chon={chon === kn} onChon={() => setChon(kn)} mo={mo.includes(kn)} onDoi={() => doiMo(kn)}>
              {ds.map((m) => { const km = `m:${m.loai}:${m.ma}`, con = conCua(m);
                return <NutCay key={km} chon={chon === km} onChon={() => setChon(km)} mo={con.length ? mo.includes(km) : undefined} onDoi={con.length ? () => doiMo(km) : undefined}
                  dau={<span title={TEN_TT[m.trang_thai][0]} style={{ width: 7, height: 7, borderRadius: 4, background: CHAM_TT[m.trang_thai], flex: 'none' }} />}
                  ten={<span style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.mo_ta}>{m.ten}</span>}
                  phai={m.phim_sx.length ? <span title={`${m.phim_sx.length} phim đã chọn để sản xuất theo mẫu này`} style={{ fontSize: 11, color: MO_SO, whiteSpace: 'nowrap' }}>{m.phim_sx.length} phim</span> : undefined}>
                  {con.length ? con.map((b) => { const kb = `m:${b.loai}:${b.ma}`;
                    return <NutCay key={kb} chon={chon === kb} onChon={() => setChon(kb)} dau={<span style={{ width: 6, height: 6, borderRadius: 3, background: CHAM_TT[b.trang_thai], flex: 'none' }} />}
                      ten={<span style={{ fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b.spec.map((x) => `${x.nhan}: ${x.gia}`).join('\n')}>{b.ten.replace(/^\S+ · /, '')}</span>} />; }) : null}
                </NutCay>; })}
            </NutCay>; })}
        </NutCay>; })}
    </Cay>
    </div>
    <span onPointerDown={keo} onDoubleClick={() => { setRong(280); try { localStorage.removeItem('etp-mau-cay-rong'); } catch { /* */ } }} title="kéo để đổi rộng · nhấp đúp về mặc định"
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(96,165,250,0.35)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      style={{ position: 'absolute', top: 0, right: -5, width: 10, height: '100%', cursor: 'col-resize', zIndex: 3, borderRadius: 3 }} />
  </div>;
}

export function TabMauCr() {
  const { so: duNho, loi } = useSoNho<{ mau: MauCr[]; phim: DsPhim; luc: string }>('mau-cr', docMauCr, 20_000, hopKhuon);   // 20 giây: trạng thái máy dựng ở chân thẻ đổi từng bước
  const [moi, setMoi] = useState<{ mau: MauCr[]; phim: DsPhim; luc: string } | null>(null);   // bản tải lại ngay sau khi chọn phim (khỏi chờ nhịp)
  const du = moi ?? duNho;
  // ngăn chọn phim (etp-mau-phim-drawer) sinh xong → tải lại chân thẻ ngay, khỏi chờ nhịp
  useEffect(() => { const f = () => { void docMauCr().then((r) => { if (!('loi' in r)) setMoi(r); }); }; window.addEventListener(SU_KIEN_MAU, f); return () => window.removeEventListener(SU_KIEN_MAU, f); }, []);
  const [loai, setLoai] = useLoc('mcl'), [nguon, setNguon] = useLoc('mcn'), [tt, setTt] = useLoc('mct'), [dang, setDang] = useLoc('mcd'), [tl, setTl] = useLoc('mctl');
  const tatCa = useMemo(() => du?.mau ?? [], [du]);
  const [cayChon, setCayChon] = useState<string>(() => docUrl('mcc') ?? '');
  useEffect(() => { ghiUrl('mcc', cayChon || null); }, [cayChon]);
  useEffect(() => () => ghiUrl('mcc', null), []);
  const [cayMo, setCayMo] = useLoc('mco');
  const quaCay = (m: MauCr) => !cayChon || (cayChon.startsWith('t:') ? m.nhom_tk === cayChon.slice(2) : cayChon.startsWith('n:') ? `${m.nhom_tk}|${nhom2(m)}` === cayChon.slice(2) : (`m:${m.loai}:${m.ma}` === cayChon || (m.loai === 'bien_the' && cayChon === `m:dang:${m.cha}`)));
  const dsTl = useMemo(() => [...new Set(tatCa.flatMap((m) => m.the_loai))].sort(), [tatCa]);
  // bo = nhóm lọc bỏ qua khi đếm số trên chip của chính nhóm đó (số = bấm thêm chip đó thì còn bao nhiêu mẫu)
  const qua = (m: MauCr, bo?: string) => (bo === 'l' || !loai.length || loai.includes(m.loai)) && (bo === 'n' || !nguon.length || nguon.includes(m.nguon))
    && (bo === 't' || !tt.length || tt.includes(m.trang_thai)) && (bo === 'd' || !dang.length || choDang(m).some((d) => dang.includes(d)))
    && (bo === 'tl' || !tl.length || m.the_loai.some((x) => tl.includes(x)));
  // KHOA HỌC (anh 19/11/2026): gom theo NHÓM THIẾT KẾ 1 → 7; trong nhóm, mẫu có QC gốc chạy lâu nhất / chi nhiều nhất đứng trước (bảng dùng chung gom nhóm theo thứ tự xuất hiện)
  const manh = (m: MauCr) => Math.max(0, ...m.tham_chieu.map((t) => t.ngay ?? 0)) * 1000 + (m.so?.chi ?? 0);
  // tầng 2 trong mỗi thể loại: dạng → công thức máy dựng → format theo vai (tên phim → nút → băng chữ → bố cục) → mạnh trước
  const THU_LOAI: Record<LoaiMau, number> = { dang: 0, bien_the: 0, cong_thuc: 1, lop_phu: 2, bo_cuc: 3 }, THU_VAI = ['Tên phim', 'Nút / CTA', 'Băng chữ / câu nhử', 'Bố cục / key-art', 'Bố cục ảnh nhà'];
  const tang2 = (m: MauCr) => THU_LOAI[m.loai] * 10 + (m.vai ? Math.max(0, THU_VAI.indexOf(m.vai)) : 0);
  const TL = ['Cắt cảnh', 'Kể chuyện', 'Chèn khung', 'Ảnh tĩnh', 'Poster động'], tl1 = (m: MauCr) => { const i = TL.indexOf(m.nhom_tk); return i < 0 ? 99 : i; };
  const locRows = tatCa.filter((m) => qua(m));
  // biến thể đứng NGAY SAU dạng cha (khoá chung = mã dạng cha), dạng trước biến thể
  const cha = (m: MauCr) => (m.loai === 'bien_the' ? m.cha ?? '' : m.loai === 'dang' ? m.ma : '');
  const rows = locRows.filter(quaCay).sort((a, b) => tl1(a) - tl1(b) || tang2(a) - tang2(b) || cha(a).localeCompare(cha(b)) || Number(a.loai === 'bien_the') - Number(b.loai === 'bien_the') || manh(b) - manh(a) || a.ten.localeCompare(b.ten));
  const dem = (bo: string, ds: readonly string[], f: (m: MauCr, v: string) => boolean) => Object.fromEntries(ds.map((v) => [v, tatCa.filter((m) => qua(m, bo) && f(m, v)).length]));
  const cot: DataColumn<MauCr>[] = useMemo(() => [
    { key: 'ten', header: 'Mẫu', align: 'left', width: 220, sortValue: (m) => m.ten, cell: (m) => <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {m.mau ? <span style={{ width: 8, height: 8, borderRadius: 4, background: m.mau, flex: 'none' }} /> : null}<b>{m.ten}</b></span> },
    { key: 'anh', header: 'Creative mẫu', align: 'left', width: 200, cell: (m) => (banNguon(m).length ? <span style={{ display: 'inline-flex', gap: 4 }}>{banNguon(m).map((b, i) => <a key={i} href={b.video ?? b.anh ?? undefined} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} title={`${b.nhan ?? ''} — mở cỡ gốc`}><img src={b.anh ?? undefined} alt="" loading="lazy" style={{ width: 36, height: 64, objectFit: 'contain', background: '#000', borderRadius: 3, display: 'block' }} /></a>)}</span> : <span style={{ color: MO_SO }}>—</span>) },
    { key: 'loai', header: 'Loại', align: 'left', sortValue: (m) => TEN_LOAI[m.loai], cell: (m) => TEN_LOAI[m.loai] },
    { key: 'nguon', header: 'Nguồn', align: 'left', sortValue: (m) => TEN_NGUON[m.nguon], cell: (m) => TEN_NGUON[m.nguon] },
    { key: 'tt', header: 'Trạng thái', align: 'left', sortValue: (m) => TT.indexOf(m.trang_thai), cell: (m) => <OTT m={m} /> },
    { key: 'cho', header: 'Dùng cho', align: 'left', width: 220, sortValue: (m) => choDang(m).join(', '), cell: (m) => <span style={{ fontSize: 11.5 }}>{choDang(m).join(' · ') || '—'}</span> },
    { key: 'tl', header: 'Thể loại', align: 'left', sortValue: (m) => m.the_loai.join(', '), cell: (m) => <span style={{ fontSize: 11.5 }}>{m.the_loai.join(' · ') || <span style={{ color: MO_SO }}>mọi thể loại</span>}</span> },
    { key: 'cr', header: 'Creative', title: 'số creative nhà của dạng', loc: 'so', sortValue: (m) => m.so?.cr ?? null, cell: (m) => (m.so ? <Dem v={m.so.cr} /> : <span style={{ color: MO_SO }}>—</span>) },
    { key: 'camp', header: 'Camp', title: 'camp đang chạy / đã lên', loc: 'so', sortValue: (m) => m.so?.camp ?? null, cell: (m) => (m.so ? `${m.so.dang_chay}/${m.so.camp}` : <span style={{ color: MO_SO }}>—</span>) },
    { key: 'chi', header: 'Chi $', loc: 'so', sortValue: (m) => m.so?.chi ?? null, cell: (m) => (m.so ? m.so.chi.toFixed(0) : <span style={{ color: MO_SO }}>—</span>) },
    { key: 'thu', header: 'Thu $', loc: 'so', sortValue: (m) => m.so?.thu ?? null, cell: (m) => (m.so ? m.so.thu.toFixed(0) : <span style={{ color: MO_SO }}>—</span>) },
    { key: 'roi', header: 'ROI', title: '(thu − chi) / chi — mọi camp nhà của dạng từ trước tới nay', loc: 'so', sortValue: (m) => roi(m.so), cell: (m) => <ORoi s={m.so} /> },
    { key: 'dt', header: 'QC đối thủ', title: 'QC đối thủ tham chiếu: số ngày chạy (● còn chạy) — bấm mở Thư viện QC Meta', align: 'left', sortValue: (m) => (m.tham_chieu.length ? Math.max(...m.tham_chieu.map((t) => t.ngay ?? 0)) : null), cell: (m) => <ThamChieu m={m} /> },
    { key: 'mo_ta', header: 'Mô tả', align: 'left', width: 420, cell: (m) => <span style={{ fontSize: 11.5, color: 'var(--fg-2)' }}>{m.mo_ta}</span> },
    { key: 'may', header: 'Máy dựng', align: 'left', width: 300, cell: (m) => <span style={{ fontSize: 11, color: MO_SO }}>{mayDung(m)}</span> },
  ], []);
  const motMau = cayChon.startsWith('m:') && rows.length === 1 ? rows[0] : null;   // lá đã chọn (dạng có biến thể ra nhiều dòng → vẫn là lưới)
  if (loi && !du) return <div style={{ padding: 16, color: DO }}>{loi}</div>;
  if (!du) return <div style={{ padding: 16, color: MO_SO }}>đang đọc sổ mẫu creative…</div>;
  const demL = dem('l', LOAI, (m, v) => m.loai === v), demN = dem('n', NGUON, (m, v) => m.nguon === v);
  const demD = dem('d', DANG_TEN, (m, v) => choDang(m).includes(v)), demTl = dem('tl', dsTl, (m, v) => m.the_loai.includes(v));
  return (<div style={{ display: 'flex', alignItems: 'flex-start' }}>
    <CayMau rows={[...locRows].sort((a, b) => tl1(a) - tl1(b) || tang2(a) - tang2(b) || manh(b) - manh(a))} chon={cayChon} setChon={setCayChon} mo={cayMo} setMo={setCayMo} />
    {motMau ? <div style={{ flex: 1, minWidth: 0, maxWidth: 1040, border: '1px solid var(--line)', borderRadius: 10 }}>
      {/* CHỌN MỘT MẪU TRÊN CÂY = XEM LUÔN CHI TIẾT (20/11/2026: trước đây cả khung phải chỉ có một thẻ 360px, muốn xem phải bấm thêm lần nữa mở ngăn) */}
      <div style={{ padding: '12px 16px 4px', display: 'flex', alignItems: 'flex-start', gap: 10 }}><DauMau m={motMau} />
        <a onClick={() => setCayChon(`n:${motMau.nhom_tk}|${nhom2(motMau)}`)} title="về lưới các mẫu cùng nhóm" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--accent, #60a5fa)', cursor: 'pointer', whiteSpace: 'nowrap' }}>‹ cả nhóm {nhom2(motMau).replace(/^Format · /, '')}</a></div>
      <ChiTietMau key={`${motMau.loai}:${motMau.ma}`} m={motMau} />
    </div> : <div style={{ flex: 1, minWidth: 0 }}>
    <DataTable rows={rows} columns={cot} getRowKey={(m) => `${m.loai}:${m.ma}`} persistKey="etp-mau-cr" minWidth={1500} pageSize={24} onRowClick={(m) => openEntityDrawer('etp-mau', `${m.loai}:${m.ma}`)} thanhDinh="var(--etp-dinh, 0px)"
      locTuDong={false}   /* thanh lọc tự động của DataTable tách sai cột nhiều giá trị (Thể loại, Dùng cho) và trùng chip ở trên → một bộ lọc */
      card={{ render: (m) => <The m={m} />, minWidth: 320 }} defaultView="card"
      groupBy={{ value: (m) => m.nhom_tk, label: (v, rs) => <span style={{ fontWeight: 700 }}>{v} <span style={{ color: MO_SO, fontWeight: 400 }}>· {rs.filter((x) => x.loai === 'dang').length} dạng · {rs.filter((x) => x.loai === 'cong_thuc').length} công thức · {rs.filter((x) => x.loai !== 'dang' && x.loai !== 'cong_thuc').length} format</span></span> }}
      searchText={(m) => `${m.ten} ${m.mo_ta} ${choDang(m).join(' ')} ${m.the_loai.join(' ')} ${m.tham_chieu.map((t) => t.phim ?? '').join(' ')}`} searchPlaceholder="Tìm mẫu, dạng, phim…"
      dauThanh={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <FilterChips<TrangThaiMau> options={TT.map((v) => ({ value: v, label: TEN_TT[v][0], title: TEN_TT[v][2] }))} values={tt as TrangThaiMau[]} onToggle={(v) => setTt(v)} counts={dem('t', TT, (m, v) => m.trang_thai === v)} donVi="mẫu" urlKey="mct" />
        <MultiSelect<string> label="Loại" options={LOAI.map((v) => ({ value: v, label: TEN_LOAI[v], count: demL[v] }))} selected={loai} onChange={setLoai} compact portal />
        <MultiSelect<string> label="Nguồn" options={NGUON.map((v) => ({ value: v, label: TEN_NGUON[v], count: demN[v] }))} selected={nguon} onChange={setNguon} compact portal />
        <MultiSelect<string> label="Dạng" options={DANG_TEN.map((v) => ({ value: v, label: v, count: demD[v] }))} selected={dang} onChange={setDang} searchPlaceholder="Tìm dạng…" compact portal />
        <MultiSelect<string> label="Thể loại" options={dsTl.map((v) => ({ value: v, label: v, count: demTl[v] }))} selected={tl} onChange={setTl} searchPlaceholder="Tìm thể loại…" compact portal />
        <span style={{ fontSize: 11.5, color: MO_SO }} title={`đọc lúc ${gioVn(du.luc)}`}>{rows.length}/{tatCa.length} mẫu</span>
      </span>} />
    </div>}</div>
  );
}
