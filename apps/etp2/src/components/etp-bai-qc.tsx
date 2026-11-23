'use client';
// KHUNG BÀI QUẢNG CÁO (anh 20/11/2026: "creative đang ko show Primary Text và các thứ xung quanh — cần show giống như cách người dùng sẽ nhìn thấy"):
// đầu bài (ảnh Page · tên Page · Được tài trợ) → chữ QC (cắt "… Xem thêm" như Facebook, nhiều bản thì lật ‹ 1/5 ›) → hình / video → dải dưới
// (tên miền · tiêu đề · mô tả · nút CTA đúng loại của camp). Chữ THẬT từ kho (docBaiQc ← apps/etp/bai-qc.py), không chữ mẫu.
// Chấm điểm / lý do chặn KHÔNG nằm trong khung — chỗ gọi đặt TheCr bên ngoài.
import { useEffect, useState } from 'react';
import { docBaiQc, type BaiQc, type NoiDungCr } from '@/lib/actions/etp-bai';
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
const CAT = 125;   // Facebook cắt chữ QC ở khoảng 125 ký tự rồi hiện "… Xem thêm"
const XAM = '#65676b', DEN = '#050505';
const NUT_LAT: React.CSSProperties = { border: '1px solid #ccd0d5', background: '#fff', color: DEN, borderRadius: 4, width: 20, height: 18, lineHeight: '14px', cursor: 'pointer', padding: 0 };
const MOT_DONG: React.CSSProperties = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

// NỘI DUNG TRONG VIDEO + ĐIỂM CHẤM NỘI DUNG (anh #1774: "show thêm hook, text nội dung trong video ở đây + chấm điểm"): hook (câu mở video),
// chữ trên hình, lời đọc — bản máy chấm đọc ra từ chính video (etp.cham) — rồi điểm từng tiêu chí Meta + AFS, lý do nằm ở rê chuột.
// Đặt TRÊN khung bài để mở thẻ là thấy ngay, không phải cuộn qua video. Chữ dài cắt dòng, đủ chữ ở rê chuột (YDNI: chữ phụ vào hover).
const mauTc = (d: number) => (d >= 8 ? 'var(--fg-2, #aaa)' : d >= 5 ? '#f59e0b' : '#f87171');
const DONG = (n: number): React.CSSProperties => ({ display: '-webkit-box', WebkitLineClamp: n, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' });
function NoiDungVideo({ nd }: { nd: NoiDungCr | null }) {
  const nhan: React.CSSProperties = { color: 'var(--fg-3, #888)', marginRight: 4 };
  if (!nd) return <div data-noi-dung-video="chua" style={{ fontSize: 11, color: 'var(--fg-3, #888)' }} title="Máy chấm chưa đọc video này nên chưa có hook, chữ trong video và điểm">Chưa chấm — chưa có hook, chữ video, điểm</div>;
  const chuVideo = nd.chuVideo?.replace(/\s*\n\s*/g, ' / ') ?? null;
  return <div data-noi-dung-video style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12, lineHeight: 1.35 }}>
    <div style={DONG(2)} title={nd.hook ?? ''}><span style={nhan}>🎣 Hook</span><b>{nd.hook ?? '—'}</b></div>
    <div style={DONG(2)} title={nd.chuVideo ?? ''}><span style={nhan}>🔤 Chữ trên video</span>{chuVideo ?? '—'}</div>
    <div style={DONG(2)} title={[nd.loiDoc, nd.tomTat ? `Tóm tắt: ${nd.tomTat}` : ''].filter(Boolean).join('\n\n')}><span style={nhan}>🎙 Lời đọc</span>{nd.loiDoc ?? 'không có giọng'}</div>
    {nd.diem.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 2 }}
      title="Điểm nội dung máy chấm từ chính video (thang 10, dưới 5 là chặn) — rê vào từng ô để xem lý do">
      <span style={{ ...nhan, fontSize: 11 }}>📝 Chấm nội dung</span>
      {nd.diem.map((d) => <span key={`${d.nhom}.${d.ma}`} data-tc={`${d.nhom}.${d.ma}`} title={`${d.nhom === 'meta' ? 'Meta' : 'AFS'} · ${d.ten}: ${d.diem}/10${d.lyDo ? `\n${d.lyDo}` : ''}`}
        style={{ fontSize: 11, border: `1px solid ${mauTc(d.diem)}`, color: mauTc(d.diem), borderRadius: 4, padding: '0 4px', whiteSpace: 'nowrap' }}>{d.ten} {d.diem}</span>)}
    </div> : null}
  </div>;
}

export function KhungBaiQc({ cr, camp, anh, video, caoMedia }: { cr: number; camp?: number | null; anh: string | null; video: string | null; /** cao vùng hình; bỏ trống = khổ 9:16 */ caoMedia?: number | string }) {
  const [b, setB] = useState<BaiQc | null>(null); const [loi, setLoi] = useState<string | null>(null);
  const [i, setI] = useState(0); const [mo, setMo] = useState(false);
  useEffect(() => {
    let huy = false; setB(null); setLoi(null); setI(0); setMo(false);
    lay(cr, camp).then((r) => { if (huy) return; if ('loi' in r) setLoi(r.loi); else setB(r); }, (e) => { if (!huy) setLoi(String(e?.message ?? e)); });
    return () => { huy = true; };
  }, [cr, camp]);
  const ds = b?.chinh ?? []; const chu = ds[i] ?? ''; const dai = chu.length > CAT;
  const tieuDe = b?.tieuDe[0] ?? null, moTa = b?.moTa[0] ?? null, cta = b ? chuCta(b.cta) : '';
  const lat = (d: number) => { setI((x) => (x + d + ds.length) % ds.length); setMo(false); };
  return <div data-bai-qc={cr} style={{ display: 'flex', flexDirection: 'column', gap: 4, minHeight: 0 }}>
    {b ? <NoiDungVideo nd={b.noiDung} /> : null}
    {b?.chuaCamp ?<div style={{ fontSize: 11, color: 'var(--fg-2, #aaa)' }}>chưa lên camp — chữ dự kiến</div> : null}
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
          : <>{dai && !mo ? chu.slice(0, CAT).trimEnd() : chu}{dai ? <button type="button" onClick={() => setMo((x) => !x)} style={{ border: 0, background: 'none', padding: 0, marginLeft: 2, color: XAM, fontWeight: 600, cursor: 'pointer', font: 'inherit' }}>{mo ? ' Thu gọn' : '… Xem thêm'}</button> : null}</>}
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
        </div>
        {cta ? <span style={{ flex: 'none', background: '#e4e6eb', color: DEN, fontWeight: 600, fontSize: 12, borderRadius: 6, padding: '6px 10px', whiteSpace: 'nowrap' }}>{cta}</span> : null}
      </div>
    </div>
  </div>;
}
