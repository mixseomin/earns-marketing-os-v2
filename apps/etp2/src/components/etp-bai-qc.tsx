'use client';
// KHUNG BÀI QUẢNG CÁO (anh 20/11/2026: "creative đang ko show Primary Text và các thứ xung quanh — cần show giống như cách người dùng sẽ nhìn thấy"):
// đầu bài (ảnh Page · tên Page · Được tài trợ) → chữ QC (cắt "… Xem thêm" như Facebook, nhiều bản thì lật ‹ 1/5 ›) → hình / video → dải dưới
// (tên miền · tiêu đề · mô tả · nút CTA đúng loại của camp). Chữ THẬT từ kho (docBaiQc ← apps/etp/bai-qc.py), không chữ mẫu.
// Chấm điểm / lý do chặn KHÔNG nằm trong khung — chỗ gọi đặt TheCr bên ngoài.
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { docBaiQc, type BaiQc, type NoiDungCr } from '@/lib/actions/etp-bai';
import { layDich, trungGoc } from '@/components/etp-co-vi';
import { VideoXem } from '@/components/ui/video-xem';

const CACHE = new Map<string, Promise<BaiQc | { loi: string }>>();
const lay = (cr: number, camp?: number | null) => {
  const k = `${cr}:${camp ?? ''}`; let p = CACHE.get(k);
  if (!p) { p = docBaiQc(cr, camp ?? null); CACHE.set(k, p); p.then((r) => { if ('loi' in r) CACHE.delete(k); }, () => CACHE.delete(k)); }
  return p;
};

// nút CTA của Meta: mã Ethopex → chữ người xem thấy trên nút (thị trường EN/ES nên ghi bản tiếng Anh như Meta hiện)
const CTA: Record<string, string> = { LEARN_MORE: 'Learn more', WATCH_MORE: 'Watch more', WATCH_VIDEO: 'Watch video', SHOP_NOW: 'Shop now', SIGN_UP: 'Sign up', DOWNLOAD: 'Download',
  INSTALL_MOBILE_APP: 'Install now', PLAY_GAME: 'Play game', GET_OFFER: 'Get offer', SUBSCRIBE: 'Subscribe', SEE_MORE: 'See more', APPLY_NOW: 'Apply now', CONTACT_US: 'Contact us', NO_BUTTON: '' };
const chuCta = (c: string | null) => (c == null ? '' : CTA[c] ?? c.toLowerCase().replace(/_/g, ' ').replace(/^./, (x) => x.toUpperCase()));
// MỘT NGUỒN VỚI KHỐI CẤU HÌNH (anh #1867 "Fix ngay !!": cấu hình ghi WATCH_MORE mà Ad preview hiện "Learn more", Page / tên miền / headline của camp đội khác):
// ngăn camp bọc khung bằng DeBaiQc = đúng giá trị khối cấu hình đang hiện (chữ form với camp dự kiến, chữ camp thật mang với camp đã lên) → khung lấy CTA,
// chữ QC, tiêu đề, mô tả, tên miền, Page từ đó; chỉ hình / video / nội dung video còn đọc theo creative. Ngoài ngăn camp (thẻ rê, chờ duyệt) không có Provider → giữ như cũ.
export type DeBai = { cta: string | null; chinh: string[]; tieuDe: string[]; moTa: string[]; tenMien: string | null; page: { ten: string | null; anh: string | null } | null; chuaCamp?: boolean };
export const DeBaiQc = createContext<DeBai | null>(null);
export const tachChu = (s: string | null) => (s ?? '').split('\n').map((x) => x.trim()).filter(Boolean);
function deLen(b: BaiQc | null, de: DeBai | null): BaiQc | null {
  if (!b || !de) return b;
  const dich = { ...b.dich }; for (const s of [...de.chinh, ...de.tieuDe, ...de.moTa]) if (!(s in dich)) dich[s] = '';
  return { ...b, dich, cta: de.cta ?? b.cta, chinh: de.chinh.length ? de.chinh : b.chinh, tieuDe: de.tieuDe.length ? de.tieuDe : b.tieuDe, moTa: de.moTa.length ? de.moTa : b.moTa,
    tenMien: de.tenMien ?? b.tenMien, page: de.page?.ten ? { ten: de.page.ten, anh: de.page.anh ?? null, link: null } : b.page, chuaCamp: de.chuaCamp ?? b.chuaCamp };
}
const CAT = 125;   // Facebook cắt chữ QC ở khoảng 125 ký tự rồi hiện "… Xem thêm"
const XAM = '#65676b', DEN = '#050505';
const NUT_LAT: React.CSSProperties = { border: '1px solid #ccd0d5', background: '#fff', color: DEN, borderRadius: 4, width: 20, height: 18, lineHeight: '14px', cursor: 'pointer', padding: 0 };
const MOT_DONG: React.CSSProperties = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

// NỘI DUNG TRONG VIDEO + ĐIỂM CHẤM NỘI DUNG (anh #1774: "show thêm hook, text nội dung trong video ở đây + chấm điểm"): hook (câu mở video),
// chữ trên hình, lời đọc — bản máy chấm đọc ra từ chính video (etp.cham) — rồi điểm từng tiêu chí Meta + AFS, lý do nằm ở rê chuột.
// Đặt TRÊN khung bài để mở thẻ là thấy ngay, không phải cuộn qua video. Chữ dài cắt dòng, đủ chữ ở rê chuột (YDNI: chữ phụ vào hover).
const mauTc = (d: number) => (d >= 8 ? 'var(--fg-2, #aaa)' : d >= 5 ? '#f59e0b' : '#f87171');
const DONG = (n: number): React.CSSProperties => ({ display: '-webkit-box', WebkitLineClamp: n, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' });
// DỊCH (anh #1778 "các hook đều có thêm phần hiển thị tiếng Việt" + "mở rộng thêm phần dịch cho các nội dung khác trong đó"): mọi chữ ngoại ngữ của thẻ —
// hook, chữ trên video, lời đọc, tóm tắt, lý do chấm, chữ QC, tiêu đề, mô tả — có MỘT dòng 🇻🇳 nghiêng cùng một kiểu ngay dưới chữ gốc (lý do chấm vốn ở rê chuột
// thì bản dịch nối vào rê chuột). Bản đã nhớ (etp.dich) đi kèm thẻ; chữ chưa dịch gom MỘT lượt dichChu cho cả thẻ (nhớ trong trang), lỗi hiện đỏ ngay dòng dịch.
type Dv = { vi: string } | { loi: string } | 'cho' | null;
type LayVi = (goc: string | null | undefined) => Dv;
const viCua = (d: Dv) => (d && typeof d === 'object' && 'vi' in d ? d.vi : null);
function useDich(b: BaiQc | null): LayVi {
  const [vi, setVi] = useState<Record<string, string>>({}); const [loi, setLoi] = useState<string | null>(null);
  useEffect(() => {
    setLoi(null);
    if (!b) { setVi({}); return; }
    const co: Record<string, string> = {}; const thieu: string[] = [];
    for (const [g, v] of Object.entries(b.dich)) { if (v) co[g] = v; else thieu.push(g); }
    setVi(co);
    if (!thieu.length) return;
    let song = true;
    layDich(thieu).then((r) => { if (!song) return; if ('loi' in r) setLoi(r.loi); else setVi((x) => ({ ...x, ...r.vi })); },
      (e) => { if (song) setLoi(`không dịch được: ${String(e?.message ?? e)}`); });
    return () => { song = false; };
  }, [b]);
  return (g) => { if (!g || !b || !(g in b.dich)) return null; const v = vi[g]; return v ? (trungGoc(g, v) ? null : { vi: v }) : loi ? { loi } : 'cho'; };
}
// bản dịch y hệt chữ gốc (tên phim, tên riêng: "Get Out of My Bugatti" → "Get Out of My Bugatti") = dòng thừa, không hiện (anh #1778 "trình bày cho hợp lý")
/** dòng dịch dưới chữ gốc — sang = nằm trong khung bài trắng (chữ xám tối).
 *  #1862 (anh: "Phần dịch chỉ hiện cờ vn. Hover vào mới lên nội dung tương ứng"): mặc định CHỈ một lá cờ 🇻🇳; rê chuột (máy tính) hoặc chạm (điện thoại,
 *  không có rê chuột) vào cờ mới mở bản dịch ngay dưới — YDNI chữ phụ gập vào rê. Lỗi dịch vẫn hiện đỏ đủ câu (lỗi phải kêu to, không gập). */
function DongVi({ d, dong = 2, sang = false, hien }: { d: Dv; dong?: number; sang?: boolean; hien?: (s: string) => string }) {
  const [re, setRe] = useState(false); const [cham, setCham] = useState(false);
  if (!d) return null;
  const nhat = sang ? XAM : 'var(--fg-3, #888)';
  if (d === 'cho') return <div data-vi="cho" title="đang dịch…" style={{ fontSize: 11, color: nhat, opacity: 0.5, lineHeight: 1.2 }}>🇻🇳</div>;
  if ('loi' in d) return <div data-vi="loi" style={{ fontSize: 11, color: sang ? '#dc2626' : '#f87171', whiteSpace: 'normal' }}>🇻🇳 {d.loi}</div>;
  const mo = re || cham;
  return <div data-vi={mo ? 'mo' : 'gap'} onMouseEnter={() => setRe(true)} onMouseLeave={() => setRe(false)}
    onClick={(e) => { e.stopPropagation(); setCham((x) => !x); }} title={mo ? undefined : d.vi}
    style={{ ...(mo ? DONG(dong) : {}), fontSize: 12, color: sang ? XAM : 'var(--fg-2, #bbb)', whiteSpace: sang ? 'pre-wrap' : 'normal', fontWeight: 400, cursor: 'pointer', lineHeight: mo ? undefined : 1.2, width: mo ? undefined : 'fit-content' }}>
    <span style={{ marginRight: mo ? 4 : 0, fontStyle: 'normal' }}>🇻🇳</span>{mo ? <i>{hien ? hien(d.vi) : d.vi}</i> : null}</div>;
}
const goiLai = (s: string) => s.replace(/\s*\n\s*/g, ' / ');
const viTitle = (v: LayVi, s: string | null) => { const t = viCua(v(s)); return t ? `\n🇻🇳 ${t}` : ''; };
function NoiDungVideo({ nd, v }: { nd: NoiDungCr | null; v: LayVi }) {
  const nhan: React.CSSProperties = { color: 'var(--fg-3, #888)', marginRight: 4 };
  if (!nd) return <div data-noi-dung-video="chua" style={{ fontSize: 11, color: 'var(--fg-3, #888)' }} title="Máy chấm chưa đọc video này nên chưa có hook, chữ trong video và điểm">Chưa chấm — chưa có hook, chữ video, điểm</div>;
  const chuVideo = nd.chuVideo ? goiLai(nd.chuVideo) : null;
  const loiSau = nd.sauHook ?? nd.loiDoc;
  // #1777: điểm hook giữ người xem quá 3s — tiêu chí nhóm 'hut' (không thuộc Meta / AFS, không vào cổng chặn), hiện ngay trên dòng Hook
  const giu = nd.diem.find((d) => d.nhom === 'hut' && d.ma === 'giu_3s') ?? null;
  const diemNd = nd.diem.filter((d) => d.nhom !== 'hut');
  return <div data-noi-dung-video style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12, lineHeight: 1.35 }}>
    <div style={DONG(2)} title={nd.hook ?? ''}><span style={nhan}>🎣 Hook</span>
      {giu ? <span data-giu-3s={giu.diem} title={`Hook giữ người xem quá 3s: ${giu.diem}/10 — máy chấm 3 giây đầu video (khung hình, chữ, câu đọc đầu)${giu.lyDo ? `\n${giu.lyDo}${viTitle(v, giu.lyDo)}` : ''}`}
          style={{ fontSize: 11, border: `1px solid ${mauTc(giu.diem)}`, color: mauTc(giu.diem), borderRadius: 4, padding: '0 4px', marginRight: 4, whiteSpace: 'nowrap', fontWeight: 700 }}>giữ 3s {giu.diem}/10</span>
        : <span data-giu-3s="chua" title="Creative này chấm trước khi có tiêu chí giữ người xem quá 3s — chỉ lượt chấm mới có điểm, không chấm lại hàng loạt"
          style={{ fontSize: 11, color: 'var(--fg-3, #888)', marginRight: 4, whiteSpace: 'nowrap' }}>giữ 3s: chưa chấm</span>}
      {nd.hookTu === 'chu' && nd.giong !== 'khong' ? <span data-hook-tu="chu" title={`Giọng trong video chưa chép được nên hook đang tạm lấy dòng chữ đầu trên hình — chép xong giọng thì hook là câu đọc đầu${nd.giongLoi ? `\n${nd.giongLoi}` : ''}`}
          style={{ fontSize: 11, color: '#f59e0b', marginRight: 4, whiteSpace: 'nowrap' }}>tạm lấy chữ trên hình</span> : null}
      <b>{nd.hook ?? '—'}</b></div>
    <DongVi d={v(nd.hook)} />
    <div style={DONG(2)} title={nd.chuVideo ?? ''}><span style={nhan}>🔤 Chữ trên video</span>{chuVideo ?? '—'}</div>
    <DongVi d={v(nd.chuVideo)} hien={goiLai} />
    {/* #1779: lời đọc SAU câu hook (phần thoại còn lại của video) — không lặp câu hook, hiện tới 6 dòng (không hộp cuộn lồng trong thẻ nổi), rê vào xem đủ cả lời đọc + tóm tắt */}
    <div data-sau-hook={nd.sauHook ? 'co' : 'khong'} style={{ ...DONG(6), wordBreak: 'break-word' }}
      title={[nd.sauHook ?? nd.loiDoc, nd.tomTat ? `Tóm tắt: ${nd.tomTat}` : ''].filter(Boolean).join('\n\n')}>
      <span style={nhan}>🎙 Lời đọc sau hook</span>{nd.sauHook ?? (nd.loiDoc ? 'không còn lời nào sau câu hook'
        : nd.giong === 'chep_lai' ? <span data-giong="chep_lai" style={{ color: '#f59e0b' }} title={nd.giongLoi ?? ''}>⏳ máy đang chép lại giọng (lượt trước Cloudflare từ chối)</span>
        : nd.giong === 'loi' ? <span data-giong="loi" style={{ color: '#f87171' }} title={nd.giongLoi ?? ''}>⚠ chép giọng lỗi — {nd.giongLoi}</span>
        : 'video không có lời đọc')}</div>
    {nd.sauHook ? <DongVi d={v(loiSau)} dong={4} /> : null}
    {nd.tomTat ? <div data-tom-tat style={DONG(2)} title={nd.tomTat}><span style={nhan}>🧾 Tóm tắt</span>{nd.tomTat}</div> : null}
    <DongVi d={v(nd.tomTat)} />
    {diemNd.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 2 }}
      title="Điểm nội dung máy chấm từ chính video (thang 10, dưới 5 là chặn) — rê vào từng ô để xem lý do">
      <span style={{ ...nhan, fontSize: 11 }}>📝 Chấm nội dung</span>
      {diemNd.map((d) => <span key={`${d.nhom}.${d.ma}`} data-tc={`${d.nhom}.${d.ma}`} title={`${d.nhom === 'meta' ? 'Meta' : 'AFS'} · ${d.ten}: ${d.diem}/10${d.lyDo ? `\n${d.lyDo}${viTitle(v, d.lyDo)}` : ''}`}
        style={{ fontSize: 11, border: `1px solid ${mauTc(d.diem)}`, color: mauTc(d.diem), borderRadius: 4, padding: '0 4px', whiteSpace: 'nowrap' }}>{d.ten} {d.diem}</span>)}
    </div> : null}
  </div>;
}

// BỐ CỤC NGANG (anh #1775 "YDNI để ko phải scroll xuống trên pc"): thẻ rê chuột trên máy tính xếp HAI CỘT — trái: `ben` (dải chấm điểm TheCr của chỗ gọi)
// + hook / chữ video / lời đọc / điểm nội dung; phải: khung bài QC + video. Trước đó mọi thứ chồng một cột rộng 320px → cao ~1000px, thẻ phải cuộn mới thấy video.
// Màn hẹp / ngăn camp vẫn một cột (ngang = false).
export function KhungBaiQc({ cr, camp, anh, video, caoMedia, ngang = false, ben }: { cr: number; camp?: number | null; anh: string | null; video: string | null; /** cao vùng hình; bỏ trống = khổ 9:16 */ caoMedia?: number | string; /** hai cột: thông tin trái, bài QC phải */ ngang?: boolean; /** khối đặt đầu cột thông tin (vd TheCr) */ ben?: React.ReactNode }) {
  const [goc, setB] = useState<BaiQc | null>(null); const [loi, setLoi] = useState<string | null>(null);
  const de = useContext(DeBaiQc); const b = useMemo(() => deLen(goc, de), [goc, de]);
  const [i, setI] = useState(0); const [mo, setMo] = useState(false);
  useEffect(() => {
    let huy = false; setB(null); setLoi(null); setI(0); setMo(false);
    lay(cr, camp).then((r) => { if (huy) return; if ('loi' in r) setLoi(r.loi); else setB(r); }, (e) => { if (!huy) setLoi(String(e?.message ?? e)); });
    return () => { huy = true; };
  }, [cr, camp]);
  const ds = b?.chinh ?? []; const chu = ds[i] ?? ''; const dai = chu.length > CAT;
  const tieuDe = b?.tieuDe[0] ?? null, moTa = b?.moTa[0] ?? null, cta = b ? chuCta(b.cta) : '';
  const lat = (d: number) => { setI((x) => (x + d + ds.length) % ds.length); setMo(false); };
  const v = useDich(b);
  const thongTin = <>
    {ben}
    {b ? <NoiDungVideo nd={b.noiDung} v={v} /> : null}
    {b?.chuaCamp ?<div style={{ fontSize: 11, color: 'var(--fg-2, #aaa)' }}>chưa lên camp — chữ dự kiến</div> : null}
  </>;
  return <div data-bai-qc={cr} data-bo-cuc={ngang ? 'ngang' : 'doc'} style={ngang
    ? { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: 10, alignItems: 'start', minHeight: 0 }
    : { display: 'flex', flexDirection: 'column', gap: 4, minHeight: 0 }}>
    {ngang ? <div data-cot-thong-tin style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, paddingTop: 2 }}>{thongTin}</div> : thongTin}
    <div style={{ background: '#fff', color: DEN, borderRadius: 8, overflow: 'hidden', fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', fontSize: 13, lineHeight: 1.35 }}>
      {/* đầu bài: Page + Được tài trợ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px 6px' }}>
        {b?.page?.anh ? <img src={b.page.anh} alt="" style={{ width: 32, height: 32, borderRadius: 16, objectFit: 'cover', flex: 'none' }} />
          : <span style={{ width: 32, height: 32, borderRadius: 16, background: '#e4e6eb', flex: 'none' }} />}
        <div style={{ minWidth: 0 }}>
          {b?.page?.ten ? (b.page.link
            ? <a href={`https://href.li/?${b.page.link}`} target="_blank" rel="noreferrer" style={{ ...MOT_DONG, display: 'block', fontWeight: 600, color: DEN, textDecoration: 'none' }}>{b.page.ten}</a>
            : <div style={{ ...MOT_DONG, fontWeight: 600 }}>{b.page.ten}</div>)
            : <div style={{ fontWeight: 600, color: XAM }}>{b ? (b.chuaCamp ? 'Page chọn khi lên camp' : 'Page chưa đồng bộ') : '…'}</div>}
          <div style={{ fontSize: 11, color: XAM }}>Được tài trợ · 🌐</div>
        </div>
      </div>
      {/* chữ QC (primary text) */}
      <div style={{ padding: '0 10px 8px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {loi ? <span style={{ color: '#dc2626' }}>Không đọc được chữ QC: {loi}</span>
          : !b ? <span style={{ color: XAM }}>đang tải chữ QC…</span>
          : !chu ? <span style={{ color: XAM }}>{b.dongBo ? 'Creative này không có chữ QC.' : 'Chưa đồng bộ chữ QC của creative này — máy đồng bộ mỗi 10 phút.'}</span>
          : <>{dai && !mo ? chu.slice(0, CAT).trimEnd() : chu}{dai ? <button type="button" onClick={() => setMo((x) => !x)} style={{ border: 0, background: 'none', padding: 0, marginLeft: 2, color: XAM, fontWeight: 600, cursor: 'pointer', font: 'inherit' }}>{mo ? ' Thu gọn' : '… Xem thêm'}</button> : null}
            <div style={{ marginTop: 3 }}><DongVi d={v(chu)} dong={mo ? 40 : 3} sang /></div></>}
        {ds.length > 1 ? <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 11, color: XAM }} title="Meta tự xoay các bản chữ QC này giữa người xem">
          <button type="button" onClick={() => lat(-1)} aria-label="Bản chữ trước" style={NUT_LAT}>‹</button><span>bản {i + 1}/{ds.length}</span>
          <button type="button" onClick={() => lat(1)} aria-label="Bản chữ sau" style={NUT_LAT}>›</button></div> : null}
      </div>
      {/* hình / video */}
      <div style={{ position: 'relative', width: '100%', ...(caoMedia != null ? { height: caoMedia } : { aspectRatio: '9 / 16' }), background: '#000' }}>
        {video ? <VideoXem src={video} poster={anh ?? undefined} loop playsInline controls style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
          : anh ? <img src={anh} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} /> : null}
      </div>
      {/* dải dưới: tên miền · tiêu đề · mô tả · CTA */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: '#f0f2f5' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          {b?.tenMien ? <div style={{ ...MOT_DONG, fontSize: 11, color: XAM, textTransform: 'uppercase' }}>{b.tenMien}</div> : null}
          {tieuDe ? <div style={{ ...MOT_DONG, fontWeight: 600 }} title={tieuDe}>{tieuDe}</div> : null}
          {moTa ? <div style={{ ...MOT_DONG, fontSize: 12, color: XAM }} title={moTa}>{moTa}</div> : null}
          <div data-vi-tieu-de><DongVi d={v(tieuDe)} dong={1} sang /></div>
          <div data-vi-mo-ta><DongVi d={v(moTa)} dong={1} sang /></div>
        </div>
        {cta ? <span style={{ flex: 'none', background: '#e4e6eb', color: DEN, fontWeight: 600, fontSize: 12, borderRadius: 6, padding: '6px 10px', whiteSpace: 'nowrap' }}>{cta}</span> : null}
      </div>
    </div>
  </div>;
}
