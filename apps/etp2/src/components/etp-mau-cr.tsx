'use client';
// TAB MẪU CREATIVE (anh 19/11/2026: "Tạo 1 tab mới là Mẫu Creative và tổng hợp vào đó. Có bộ lọc đầy đủ").
// LUẬT (anh 19/11/2026): mọi creative tải lên phải gắn MỘT công thức trong sổ (cổng len-creative.py + apps/etp/so_mau.py) — số Creative / Camp / ROI của công thức đo theo etp.creative_mau.
// Một danh sách gộp: công thức máy dựng · dạng creative nhà (sổ etp-dang.json + số thật) · bố cục ảnh nhà (bo-cuc-po.py) · mẫu học từ QC đối thủ (sổ etp-mau-cr.json).
// Lọc: Loại · Nguồn · Trạng thái (chip) · Dùng cho dạng · Thể loại (chọn nhiều, có tìm) — mọi lọc trên URL (?mcl ?mcn ?mct ?mcd ?mctl) + ô tìm + lọc theo cột số của DataTable (cột chữ lọc bằng chip / ô chọn ở trên, không dựng bộ thứ hai).
// Xem Thẻ (mặc định, có ảnh mẫu) hoặc Bảng (đủ cột số). CHỈ ĐỌC. Dữ liệu: lib/actions/etp-mau-cr.ts.
// tra-repo-ok: màn nội bộ dựng từ khối dùng chung của etp2 (DataTable thẻ / bảng, FilterChips, MultiSelect, useSoNho)
import { useEffect, useMemo, useState } from 'react';
import { DataTable, FilterChips, MultiSelect, type DataColumn } from '@/components/ui';
import { Dem, MO_SO } from '@/components/etp-so';
import { useSoNho } from '@/lib/so-nho';
import { openEntityDrawer } from '@/lib/entity-drawer';
import { SU_KIEN_MAU } from '@/lib/etp-mau-su-kien';
import { DS_DANG } from '@/lib/etp-dang';
import { docMauCr, type DungMau, type LoaiMau, type MauCr, type NguonMau, type PhimSx, type TrangThaiMau } from '@/lib/actions/etp-mau-cr';
import { DO, XANH, gioVn } from './etp-doi-thu';

const thuVienQc = (id: string) => `https://href.li/?https://www.facebook.com/ads/library/?id=${id}`;   // link ra ngoài che referrer
const TEN_LOAI: Record<LoaiMau, string> = { cong_thuc: 'Công thức máy dựng', dang: 'Dạng creative', bo_cuc: 'Bố cục ảnh', lop_phu: 'Lớp phủ chữ / nút' };
const TEN_NGUON: Record<NguonMau, string> = { nha: 'Nhà', doi_thu: 'Học từ đối thủ' };
// màu chỉ cho TRẠNG THÁI (tín hiệu thật) — loại / nguồn để xám (YDNI kỷ luật màu)
const TEN_TT: Record<TrangThaiMau, [string, string, string]> = {
  chay: ['Đang chạy', '#4ade80', 'có camp đang chạy bằng dạng này'],
  may: ['Đã vào máy', '#60a5fa', 'máy đang dựng theo mẫu này / đã từng lên camp — hiện không camp nào chạy'],
  thu: ['Có mã dựng', '#fbbf24', 'đã có mã dựng (dựng thử được), chưa vào máy lên camp'],
  chua: ['Chưa dựng', '#94a3b8', 'mới là mẫu tham chiếu từ QC đối thủ — chưa có mã dựng'],
};
const roi = (s: MauCr['so']) => (s && s.chi > 0.5 ? ((s.thu - s.chi) / s.chi) * 100 : null);
const LOAI: LoaiMau[] = ['cong_thuc', 'dang', 'bo_cuc', 'lop_phu'], NGUON: NguonMau[] = ['nha', 'doi_thu'], TT: TrangThaiMau[] = ['chay', 'may', 'thu', 'chua'];
const DANG_TEN = DS_DANG.map((d) => d.dang);
/** mẫu áp được cho dạng nào: dạng → chính nó; bố cục / lớp phủ → danh sách dung_cho */
const choDang = (m: MauCr) => (m.loai === 'dang' ? [m.ten] : m.dung_cho);

const docUrl = (k: string) => (typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get(k));
function ghiUrl(k: string, v: string | null) {
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
function BanMauLuoi({ m }: { m: MauCr }) {
  if (!m.ban.length) return <div style={{ aspectRatio: '9 / 16', maxHeight: 300, display: 'grid', placeItems: 'center', background: 'var(--bg-2)', color: MO_SO, fontSize: 11.5, borderRadius: 6 }}>chưa có creative mẫu</div>;
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))'   /* MỌI creative mẫu cùng một cỡ (anh 19/11/2026 "ko cho hiển thị nơi to nơi bé") — luôn 3 cột, không giãn theo số bản */, gap: 6 }}>
    {m.ban.map((b, i) => <div key={i} title={b.goi_y} style={{ position: 'relative', aspectRatio: '9 / 16', background: '#000', borderRadius: 6, overflow: 'hidden', outline: b.vai === 'dung' ? '2px solid rgba(37,99,235,0.9)' : undefined }}>
      {b.video
        ? <video src={b.video} poster={b.anh ?? undefined} controls muted loop playsInline preload="none" onClick={(e) => e.stopPropagation()} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
        : b.anh ? <img src={b.anh} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} /> : null}
      <span style={{ position: 'absolute', left: 4, top: 4, display: 'inline-flex', gap: 4, pointerEvents: 'none' }}>
        {b.nhan ? <span style={{ fontSize: 10.5, padding: '0 6px', borderRadius: 8, background: b.vai === 'dung' ? 'rgba(37,99,235,0.92)' : b.vai === 'goc' ? 'rgba(194,65,12,0.92)' : 'rgba(0,0,0,0.7)', color: b.con_chay && b.vai !== 'goc' ? XANH : '#fff', fontWeight: b.vai ? 600 : undefined, fontVariantNumeric: 'tabular-nums' }}>{b.nhan}{b.con_chay ? ' ●' : ''}</span> : null}
      </span>
      {b.link ? <a href={b.link.startsWith('https://www.facebook.com') ? `https://href.li/?${b.link}` : b.link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
        title={b.link.startsWith('https://www.facebook.com') ? 'mở QC trong Thư viện QC Meta' : 'mở creative cỡ gốc'}
        style={{ position: 'absolute', right: 4, top: 4, fontSize: 11, padding: '0 6px', borderRadius: 8, background: 'rgba(0,0,0,0.7)', color: '#fff', textDecoration: 'none' }}>↗</a> : null}
    </div>)}
  </div>;
}
type DsPhim = { id: number; ten: string }[];
const TT_DONG: Record<string, [string, string]> = { chay: ['đang sinh', '#fbbf24'], xong: ['xong', '#4ade80'], dung: ['dừng', '#f87171'], loi: ['lỗi', '#f87171'] };
/** CHÂN THẺ — phim sản xuất theo mẫu + creative thật của từng phim (anh 19/11/2026: "Ở footer mỗi card sẽ là danh sách creative thực của mỗi phim được lựa chọn
 *  để sản xuất từ creative mẫu tương ứng … Mỗi phim có thể có nhiều creative"). Chọn phim → chonPhimMau (mẫu có máy dựng: tạo dòng phim; chưa có: ghi chờ). */
function ChanThe({ m }: { m: MauCr }) {
  return <div onClick={(e) => e.stopPropagation()} style={{ borderTop: '1px solid var(--line)', paddingTop: 7, display: 'flex', flexDirection: 'column', gap: 6 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 11.5, color: MO_SO, flex: 1 }}>Phim sản xuất · {m.phim_sx.length} phim · {m.phim_sx.reduce((a, f) => a + f.cr.length, 0)} creative</span>
      <button type="button" onClick={() => openEntityDrawer('etp-mau-phim', m.ma)} title="bảng phim đủ số (nhà / đội / đối thủ / creative mẫu này) — chọn phim để máy sinh creative theo mẫu"
        style={{ fontSize: 11.5, padding: '2px 10px', borderRadius: 6, border: '1px solid var(--accent, #60a5fa)', background: 'transparent', color: 'var(--accent, #60a5fa)', cursor: 'pointer' }}>＋ Chọn phim</button>
    </div>
    {!m.dong && !m.may_mau ? <div style={{ fontSize: 11, color: MO_SO }}>mẫu chưa có máy dựng — chọn phim chỉ ghi lại, dựng mã mẫu xong máy mới sinh creative</div> : null}
    {m.phim_sx.map((f) => <DongPhimSx key={f.content_id} f={f} />)}
  </div>;
}
// các bước máy dựng theo mẫu (dung-mau.py) — thanh tiến độ trong chân thẻ
const BUOC_DUNG: [string, string][] = [['cho', 'chờ máy'], ['tai_tap', 'tải tập'], ['chon_khung', 'chọn khung'], ['ve_mau', 'vẽ mẫu'], ['giong', 'giọng'], ['video', 'video'], ['thu_vien', 'thư viện'], ['creative', 'tải creative'], ['xong', 'xong']];
const gioNgan = (s: string) => new Date(s).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
function TienDoDung({ d }: { d: DungMau }) {
  const i = Math.max(0, BUOC_DUNG.findIndex(([k]) => k === d.buoc)), loi = d.trang_thai === 'loi', xong = d.trang_thai === 'xong';
  const mau = loi ? DO : xong ? XANH : '#fbbf24';
  return <div title={`${d.ghi ?? ''} · cập nhật ${gioNgan(d.cap_nhat)}`} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${BUOC_DUNG.length - 1}, 1fr)`, gap: 2 }}>
      {BUOC_DUNG.slice(1).map(([k, nh], j) => <span key={k} title={nh} style={{ height: 4, borderRadius: 2, background: xong || j < i - 1 ? XANH : j === i - 1 ? mau : 'var(--line)' }} />)}
    </div>
    <div style={{ fontSize: 11, color: loi ? DO : 'var(--fg-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {loi ? '✕ lỗi' : xong ? '✓ xong' : `● ${BUOC_DUNG[i]?.[1] ?? d.buoc}`} · {d.ghi ?? ''} · {gioNgan(d.cap_nhat)}</div>
  </div>;
}
function DongPhimSx({ f }: { f: PhimSx }) {
  const tt = f.dong_tt ? TT_DONG[f.dong_tt] : null;
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={`${f.ten ?? ''} · phim #${f.content_id}`}>{f.ten ?? `phim #${f.content_id}`}</span>
      {tt ? <span title={f.dong_ly ?? `dòng phim #${f.dong_id}`} style={{ fontSize: 10.5, color: tt[1], whiteSpace: 'nowrap' }}>● dòng #{f.dong_id} {tt[0]}</span>
        : f.chon && !f.cr.length && !f.dung ? <span style={{ fontSize: 10.5, color: MO_SO }}>chờ dựng</span> : null}
      <span style={{ fontSize: 11, color: MO_SO, fontVariantNumeric: 'tabular-nums' }}>{f.cr.length} cr</span>
    </div>
    {f.dung ? <TienDoDung d={f.dung} /> : null}
    {f.cr.length ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 4 }}>
      {f.cr.map((c) => { const r = c.chi > 0.5 ? ((c.thu - c.chi) / c.chi) * 100 : null; return <a key={c.id} href={c.video ?? c.anh ?? undefined} target="_blank" rel="noreferrer"
        title={`creative #${c.id} · ${c.camp} camp${c.chay ? ' (đang chạy)' : ''} · chi $${c.chi.toFixed(2)} · thu $${c.thu.toFixed(2)}${r != null ? ` · ROI ${r.toFixed(0)}%` : ''} — mở video`}
        style={{ position: 'relative', aspectRatio: '9 / 16', background: '#000', borderRadius: 4, overflow: 'hidden', display: 'block' }}>
        {c.anh ? <img src={c.anh} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} /> : null}
        <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, fontSize: 9.5, padding: '0 3px', background: 'rgba(0,0,0,0.7)', color: c.chay ? XANH : r != null ? (r >= 0 ? XANH : DO) : '#fff', fontVariantNumeric: 'tabular-nums', textAlign: 'center' }}>
          {c.chay ? '● ' : ''}{r != null ? `${r.toFixed(0)}%` : `#${c.id}`}</span>
      </a>; })}
    </div> : null}
  </div>;
}
const Nhan = ({ children, mau = 'var(--fg-3)', title }: { children: React.ReactNode; mau?: string; title?: string }) =>
  <span title={title} style={{ fontSize: 10.5, padding: '1px 7px', borderRadius: 9, border: `1px solid ${mau}`, color: mau, whiteSpace: 'nowrap' }}>{children}</span>;
const OTT = ({ m }: { m: MauCr }) => { const [t, c, ti] = TEN_TT[m.trang_thai]; return <Nhan mau={c} title={ti}>{t}</Nhan>; };
const ORoi = ({ s }: { s: MauCr['so'] }) => { const r = roi(s); return r == null ? <span style={{ color: MO_SO }}>—</span>
  : <span title={`chi $${s!.chi.toFixed(0)} · thu $${s!.thu.toFixed(0)} · lãi $${(s!.thu - s!.chi).toFixed(0)}`} style={{ color: r >= 0 ? XANH : DO, fontVariantNumeric: 'tabular-nums' }}>{r.toFixed(0)}%</span>; };
function ThamChieu({ m }: { m: MauCr }) {
  if (!m.tham_chieu.length) return <span style={{ color: MO_SO }}>—</span>;
  return <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>{m.tham_chieu.map((t) =>
    <a key={t.id} href={thuVienQc(t.id)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} title={`${t.phim ?? 'QC đối thủ'} · chạy ${t.ngay ?? '?'} ngày${t.con_chay ? ' · còn chạy' : ''} — mở Thư viện QC Meta`}
      style={{ fontSize: 11.5, fontVariantNumeric: 'tabular-nums', color: t.con_chay ? XANH : 'var(--fg-2)' }}>{t.ngay ?? '?'} ngày{t.con_chay ? ' ●' : ''}</a>)}</span>;
}

function The({ m }: { m: MauCr }) {
  const s = m.so;
  return <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', gap: 7, height: '100%' }}>
    <BanMauLuoi m={m} />
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {m.mau ? <span title="màu nhận diện của dạng (cùng màu badge ở các tab Creative)" style={{ width: 9, height: 9, borderRadius: 5, background: m.mau, flex: 'none' }} /> : null}
      <b style={{ fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.ten}</b><span style={{ fontSize: 11, color: MO_SO, flex: 'none' }}>{m.ma}</span>
    </div>
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}><Nhan>{TEN_LOAI[m.loai]}</Nhan><Nhan>{TEN_NGUON[m.nguon]}</Nhan><OTT m={m} /></div>
    <div style={{ fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.45 }}>{m.mo_ta}</div>
    {m.dung_cho.length ? <div style={{ fontSize: 11.5 }}><span style={{ color: MO_SO }}>Dùng cho: </span>{m.dung_cho.join(' · ')}</div> : null}
    {m.the_loai.length ? <div style={{ fontSize: 11.5 }}><span style={{ color: MO_SO }}>Hợp thể loại: </span>{m.the_loai.join(' · ')}</div> : null}
    {s ? <div style={{ fontSize: 11.5, display: 'flex', gap: 10, flexWrap: 'wrap', fontVariantNumeric: 'tabular-nums' }}>
      <span title="số creative nhà của dạng"><span style={{ color: MO_SO }}>Creative </span><Dem v={s.cr} /></span>
      <span title="camp đang chạy / đã lên"><span style={{ color: MO_SO }}>Camp </span>{s.dang_chay}/{s.camp}</span>
      <span><span style={{ color: MO_SO }}>Chi </span>${s.chi.toFixed(0)}</span><span><span style={{ color: MO_SO }}>ROI </span><ORoi s={s} /></span>
    </div> : null}
    {m.tham_chieu.length ? <div style={{ fontSize: 11.5 }}><span style={{ color: MO_SO }}>QC đối thủ: </span><ThamChieu m={m} /></div> : null}
    {m.may ? <div style={{ fontSize: 10.5, color: MO_SO, overflowWrap: 'anywhere' }}>máy dựng: {m.may}</div> : null}
    <div style={{ marginTop: 'auto' }}><ChanThe m={m} /></div>
  </div>;
}

/** bản giữ trong máy đúng khuôn hiện tại (mỗi mẫu có mảng ban + tham_chieu + dung_cho + the_loai) — bản khuôn cũ thì bỏ, chờ bản mới */
// khuôn bản giữ: đổi khuôn BanMau (thêm vai gốc / máy dựng) không cần đổi — trường tuỳ chọn
const hopKhuon = (v: unknown) => { const ds = (v as { mau?: unknown })?.mau; return Array.isArray((v as { phim?: unknown })?.phim) && Array.isArray(ds) && ds.every((m) => typeof (m as Record<string, unknown>)?.may_mau === 'boolean' && ['ban', 'tham_chieu', 'dung_cho', 'the_loai', 'phim_sx'].every((k) => Array.isArray((m as Record<string, unknown>)?.[k]))); };

export function TabMauCr() {
  const { so: duNho, loi } = useSoNho<{ mau: MauCr[]; phim: DsPhim; luc: string }>('mau-cr', docMauCr, 20_000, hopKhuon);   // 20 giây: trạng thái máy dựng ở chân thẻ đổi từng bước
  const [moi, setMoi] = useState<{ mau: MauCr[]; phim: DsPhim; luc: string } | null>(null);   // bản tải lại ngay sau khi chọn phim (khỏi chờ nhịp)
  const du = moi ?? duNho;
  // ngăn chọn phim (etp-mau-phim-drawer) sinh xong → tải lại chân thẻ ngay, khỏi chờ nhịp
  useEffect(() => { const f = () => { void docMauCr().then((r) => { if (!('loi' in r)) setMoi(r); }); }; window.addEventListener(SU_KIEN_MAU, f); return () => window.removeEventListener(SU_KIEN_MAU, f); }, []);
  const [loai, setLoai] = useLoc('mcl'), [nguon, setNguon] = useLoc('mcn'), [tt, setTt] = useLoc('mct'), [dang, setDang] = useLoc('mcd'), [tl, setTl] = useLoc('mctl');
  const tatCa = useMemo(() => du?.mau ?? [], [du]);
  const dsTl = useMemo(() => [...new Set(tatCa.flatMap((m) => m.the_loai))].sort(), [tatCa]);
  // bo = nhóm lọc bỏ qua khi đếm số trên chip của chính nhóm đó (số = bấm thêm chip đó thì còn bao nhiêu mẫu)
  const qua = (m: MauCr, bo?: string) => (bo === 'l' || !loai.length || loai.includes(m.loai)) && (bo === 'n' || !nguon.length || nguon.includes(m.nguon))
    && (bo === 't' || !tt.length || tt.includes(m.trang_thai)) && (bo === 'd' || !dang.length || choDang(m).some((d) => dang.includes(d)))
    && (bo === 'tl' || !tl.length || m.the_loai.some((x) => tl.includes(x)));
  const rows = tatCa.filter((m) => qua(m));
  const dem = (bo: string, ds: readonly string[], f: (m: MauCr, v: string) => boolean) => Object.fromEntries(ds.map((v) => [v, tatCa.filter((m) => qua(m, bo) && f(m, v)).length]));
  const cot: DataColumn<MauCr>[] = useMemo(() => [
    { key: 'ten', header: 'Mẫu', align: 'left', width: 220, sortValue: (m) => m.ten, cell: (m) => <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {m.mau ? <span style={{ width: 8, height: 8, borderRadius: 4, background: m.mau, flex: 'none' }} /> : null}<b>{m.ten}</b><span style={{ color: MO_SO, fontSize: 11 }}>{m.ma}</span></span> },
    { key: 'anh', header: 'Creative mẫu', align: 'left', width: 200, cell: (m) => (m.ban.length ? <span style={{ display: 'inline-flex', gap: 4 }}>{m.ban.map((b, i) => <a key={i} href={b.video ?? b.anh ?? undefined} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} title={`${b.nhan ?? ''} — mở cỡ gốc`}><img src={b.anh ?? undefined} alt="" loading="lazy" style={{ width: 36, height: 64, objectFit: 'contain', background: '#000', borderRadius: 3, display: 'block' }} /></a>)}</span> : <span style={{ color: MO_SO }}>—</span>) },
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
    { key: 'may', header: 'Máy dựng', align: 'left', width: 240, cell: (m) => <span style={{ fontSize: 11, color: MO_SO }}>{m.may ?? '—'}</span> },
  ], []);
  if (loi && !du) return <div style={{ padding: 16, color: DO }}>{loi}</div>;
  if (!du) return <div style={{ padding: 16, color: MO_SO }}>đang đọc sổ mẫu creative…</div>;
  const demD = dem('d', DANG_TEN, (m, v) => choDang(m).includes(v)), demTl = dem('tl', dsTl, (m, v) => m.the_loai.includes(v));
  return (
    <DataTable rows={rows} columns={cot} getRowKey={(m) => `${m.loai}:${m.ma}`} persistKey="etp-mau-cr" minWidth={1500} pageSize={100}
      locTuDong={false}   /* thanh lọc tự động của DataTable tách sai cột nhiều giá trị (Thể loại, Dùng cho) và trùng chip ở trên → một bộ lọc */
      card={{ render: (m) => <The m={m} />, minWidth: 340 }} defaultView="card" defaultSort={[{ key: 'tt', dir: 'asc' }]}
      searchText={(m) => `${m.ten} ${m.ma} ${m.mo_ta} ${choDang(m).join(' ')} ${m.the_loai.join(' ')} ${m.tham_chieu.map((t) => t.phim ?? '').join(' ')}`} searchPlaceholder="Tìm mẫu, dạng, thể loại, phim đối thủ…"
      dauThanh={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <FilterChips<LoaiMau> options={LOAI.map((v) => ({ value: v, label: TEN_LOAI[v] }))} values={loai as LoaiMau[]} onToggle={(v) => setLoai(v)} counts={dem('l', LOAI, (m, v) => m.loai === v)} donVi="mẫu" urlKey="mcl" />
        <FilterChips<NguonMau> options={NGUON.map((v) => ({ value: v, label: TEN_NGUON[v] }))} values={nguon as NguonMau[]} onToggle={(v) => setNguon(v)} counts={dem('n', NGUON, (m, v) => m.nguon === v)} donVi="mẫu" urlKey="mcn" />
        <FilterChips<TrangThaiMau> options={TT.map((v) => ({ value: v, label: TEN_TT[v][0], title: TEN_TT[v][2] }))} values={tt as TrangThaiMau[]} onToggle={(v) => setTt(v)} counts={dem('t', TT, (m, v) => m.trang_thai === v)} donVi="mẫu" urlKey="mct" />
        <MultiSelect<string> label="Dùng cho dạng" options={DANG_TEN.map((v) => ({ value: v, label: v, count: demD[v] }))} selected={dang} onChange={setDang} searchPlaceholder="Tìm dạng…" compact portal />
        <MultiSelect<string> label="Thể loại" options={dsTl.map((v) => ({ value: v, label: v, count: demTl[v] }))} selected={tl} onChange={setTl} searchPlaceholder="Tìm thể loại…" compact portal />
        <span style={{ fontSize: 11.5, color: MO_SO }} title={`đọc lúc ${gioVn(du.luc)}`}>{rows.length}/{tatCa.length} mẫu</span>
      </span>} />
  );
}
