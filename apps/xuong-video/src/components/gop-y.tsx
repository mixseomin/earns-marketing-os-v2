'use client';

// HÒM GÓP Ý STUDIO — cùng khuôn hòm 💬 của mos2 (apps/web/src/components/gop-y-mos2.tsx), anh yêu cầu 08/10/2026.
// Tab "Gửi góp ý": loại · mô tả · trang · ảnh (📷 chụp trang / Ctrl+V / kéo thả / chọn file / URL), nháp + ảnh sống qua F5.
// Ngữ cảnh tự gom lúc bấm Gửi: tiêu đề màn · phim/tập/cảnh đang mở (data-ngu-canh) · vị trí timeline · lỗi đang hiện trên màn ·
// lỗi JavaScript gần nhất · thiết bị + khổ màn. Tab "Của tôi": góp ý đã gửi + luồng trao đổi ngay tại đây (trả lời / làm lại / duyệt).
// Card rơi vào mos2.on.tc/p/xuong-video/plays; Claude nhặt bằng /tasks-studio.
import { useEffect, useState, type CSSProperties } from 'react';
import { ImageAttach, discardAttachments } from './image-attach';
import { dsGopYCuaToi, docTraoDoi, guiGopY, guiTraoDoi, type GopYCuaToi, type TinTraoDoi } from '@/lib/gop-y';

const KHOA = 'studio.gop-y.nhap';
const KHOA_TAB = 'studio.gop-y.tab';
type Nhap = { loai: string; noiDung: string; anh: string[] };
const TRANG_MOI: Nhap = { loai: 'loi', noiDung: '', anh: [] };
const docNhap = (): Nhap => {
  try {
    const v = JSON.parse(localStorage.getItem(KHOA) ?? '');
    if (v && typeof v === 'object') return { loai: v.loai === 'cau_hoi' ? 'cau_hoi' : 'loi', noiDung: typeof v.noiDung === 'string' ? v.noiDung : '', anh: Array.isArray(v.anh) ? v.anh.filter((u: unknown) => typeof u === 'string') : [] };
  } catch { /* nháp hỏng */ }
  return TRANG_MOI;
};

const TT: Record<string, { nhan: string; mau: string }> = {
  review: { nhan: 'Chờ duyệt', mau: 'var(--amber)' }, pending: { nhan: 'Chờ xử', mau: 'var(--fg-3)' },
  claimed: { nhan: 'Đang làm', mau: 'var(--cyan)' }, submitted: { nhan: 'Đang làm', mau: 'var(--cyan)' },
  broken: { nhan: 'Kẹt', mau: 'var(--red)' }, completed: { nhan: 'Xong', mau: 'var(--lime)' },
  verified: { nhan: 'Xong', mau: 'var(--lime)' }, dropped: { nhan: 'Bỏ qua', mau: 'var(--fg-4)' },
};
const nhomTT = (t: string) => (t === 'submitted' ? 'claimed' : t === 'verified' ? 'completed' : t);
const DA_DONG = new Set(['completed', 'dropped']);
const cach = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 60 ? `${m} phút trước` : m < 2880 ? `${Math.round(m / 60)} giờ trước` : `${Math.round(m / 1440)} ngày trước`;
};
const gioVN = (iso: string) => new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
const lbl: CSSProperties = { fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 };
const oNhap: CSSProperties = { width: '100%', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, padding: '7px 9px', fontSize: 12.5, color: 'var(--fg-1)', fontFamily: 'inherit' };

// Lỗi JavaScript gần nhất của trang (tối đa 5) — gom từ lúc mở trang để góp ý mang theo, khỏi phải mở console.
const loiJs: string[] = [];
function ghiLoiJs(s: string) { loiJs.push(`${new Date().toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} ${s.slice(0, 200)}`); if (loiJs.length > 5) loiJs.shift(); }

/** Ngữ cảnh lúc gửi: màn · phim/tập/cảnh/timeline đang mở · lỗi đang hiện · lỗi JS · thiết bị. */
function docNguCanh(): string {
  const chu = (e: Element | null | undefined) => (e?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
  const nc = [...document.querySelectorAll('[data-ngu-canh]')].filter((d) => !d.closest('[data-gop-y]')).map((d) => d.getAttribute('data-ngu-canh')).filter(Boolean);
  const drawer = [...document.querySelectorAll('.xv-drawer')].filter((d) => !d.querySelector('[data-gop-y]')).map((d) => chu(d.querySelector('h2, h3'))).filter(Boolean);
  const loiMan = [...document.querySelectorAll('.xv-loi')].map((e) => chu(e)).filter(Boolean).slice(0, 5);
  const ua = navigator.userAgent;
  const may = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'khác';
  const tdt = /Edg\//.test(ua) ? 'Edge' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : '?';
  return [
    `màn: ${document.title}`,
    nc.length ? `đang xem: ${nc.join(' › ')}` : '',
    drawer.length ? `ngăn mở: ${drawer.join(' › ')}` : '',
    loiMan.length ? `lỗi trên màn: ${loiMan.join(' | ')}` : '',
    loiJs.length ? `lỗi JS: ${loiJs.join(' | ')}` : '',
    `${may} · ${tdt} · ${window.innerWidth}×${window.innerHeight}`,
  ].filter(Boolean).join(' · ');
}

function FormGopY({ onGui }: { onGui: () => void }) {
  const [nhap, setNhap] = useState<Nhap>(TRANG_MOI);
  const [trang, setTrang] = useState('');
  const [nc, setNc] = useState('');
  const [busy, setBusy] = useState(false);
  const [ket, setKet] = useState('');
  useEffect(() => {
    setNhap(docNhap());
    const doc = () => { setTrang(window.location.href); setNc(docNguCanh()); };
    doc(); const t = setInterval(doc, 1000); return () => clearInterval(t);
  }, []);
  const ghi = (doi: (n: Nhap) => Nhap) => setNhap((cu) => { const n = doi(cu); try { localStorage.setItem(KHOA, JSON.stringify(n)); } catch { /* đầy */ } return n; });
  const xoaNhap = () => { discardAttachments(nhap.anh); ghi(() => TRANG_MOI); try { localStorage.removeItem(KHOA); } catch { /* thôi */ } };
  const gui = async () => {
    setBusy(true); setKet('');
    const r = await guiGopY({ loai: nhap.loai, noiDung: nhap.noiDung, trang: window.location.href, anhUrls: nhap.anh, nguCanh: docNguCanh() });
    setBusy(false);
    if (!r.ok || !r.id) { setKet(`⚠ ${r.error}`); return; }
    try { localStorage.removeItem(KHOA); } catch { /* thôi */ }
    setNhap(TRANG_MOI);
    setKet(`✓ Đã lên bảng plays xuong-video — card #${r.id}`);
    onGui();
  };
  const trong = !nhap.noiDung.trim();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div style={lbl}>Loại</div>
        <select value={nhap.loai} onChange={(e) => { const v = e.target.value; ghi((n) => ({ ...n, loai: v })); }} style={{ ...oNhap, cursor: 'pointer' }}>
          <option value="loi">Báo lỗi / góp ý</option>
          <option value="cau_hoi">Câu hỏi</option>
        </select>
      </div>
      <div>
        <div style={lbl}>Mô tả</div>
        <textarea rows={5} autoFocus placeholder="Sai ở đâu, mong đợi thấy gì…" value={nhap.noiDung}
          onChange={(e) => { const v = e.target.value; ghi((n) => ({ ...n, noiDung: v })); }} style={{ ...oNhap, resize: 'vertical', outline: 'none' }} />
        <div style={{ fontSize: 10.5, color: 'var(--fg-4)', marginTop: 3 }}>Nháp và ảnh tự giữ — F5 không mất.</div>
      </div>
      <ImageAttach value={nhap.anh} onChange={(urls) => ghi((n) => ({ ...n, anh: urls }))} folder="gop-y-studio" max={6} />
      <details style={{ fontSize: 11, color: 'var(--fg-3)' }}>
        <summary style={{ cursor: 'pointer' }}>🔗 Trang + ngữ cảnh sẽ gửi kèm (tự gom)</summary>
        <div style={{ marginTop: 4, wordBreak: 'break-all' }}>{trang}</div>
        <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{nc.split(' · ').join('\n')}</div>
      </details>
      {ket && <div style={{ fontSize: 11.5, color: ket.startsWith('✓') ? 'var(--lime)' : 'var(--red)' }}>{ket}</div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="xv-btn" onClick={xoaNhap} disabled={trong && !nhap.anh.length}>Huỷ</button>
        <button type="button" className="xv-btn chinh" disabled={busy || trong} onClick={() => void gui()}>{busy ? '…' : '📨 Gửi'}</button>
      </div>
    </div>
  );
}

function Luong({ id, onXong }: { id: number; onXong: () => void }) {
  const [td, setTd] = useState<TinTraoDoi[] | null>(null);
  const [chu, setChu] = useState('');
  const [anh, setAnh] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [loi, setLoi] = useState('');
  const nap = () => { void docTraoDoi(id).then(setTd); };
  useEffect(nap, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const gui = async (xuLy: string) => {
    setBusy(true); setLoi('');
    const r = await guiTraoDoi({ taskId: id, noiDung: chu, anhUrls: anh, xuLy });
    setBusy(false);
    if (!r.ok) { setLoi(r.error ?? 'lỗi'); return; }
    setChu(''); setAnh([]); nap(); onXong();
  };
  if (!td) return <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>đang đọc…</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
      {td.map((t, i) => (
        <div key={i} style={{ borderLeft: `2px solid ${t.xuLy === 'duyet' ? 'var(--lime)' : t.xuLy === 'rework' ? 'var(--amber)' : 'var(--line)'}`, paddingLeft: 8 }}>
          <div style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
            <b style={{ color: 'var(--fg-2)' }}>{t.nguoi}</b> · {gioVN(t.luc)}{t.xuLy ? ` · ${t.xuLy === 'duyet' ? 'đã duyệt' : 'làm lại'}` : ''}
          </div>
          <div style={{ fontSize: 12.5, whiteSpace: 'pre-wrap', marginTop: 2 }}>{t.noiDung}</div>
          {t.nguCanh && <div style={{ fontSize: 10.5, color: 'var(--fg-4)', marginTop: 2 }}>{t.nguCanh}</div>}
          {!!t.anh?.length && <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>{t.anh.map((u) => <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" style={{ width: 90, height: 60, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--line)' }} /></a>)}</div>}
        </div>
      ))}
      <textarea rows={3} placeholder="Trả lời…" value={chu} onChange={(e) => setChu(e.target.value)} style={{ ...oNhap, resize: 'vertical' }} />
      <ImageAttach value={anh} onChange={setAnh} folder="gop-y-studio" max={6} />
      {loi && <div style={{ fontSize: 11.5, color: 'var(--red)' }}>⚠ {loi}</div>}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button type="button" className="xv-btn" disabled={busy || !chu.trim()} onClick={() => void gui('')}>💬 Trả lời</button>
        <button type="button" className="xv-btn" disabled={busy || !chu.trim()} onClick={() => void gui('rework')} title="Chưa đạt — card về Chờ xử">↩ Làm lại</button>
        <button type="button" className="xv-btn chinh" disabled={busy || !chu.trim()} onClick={() => void gui('duyet')} title="Đạt — đóng card">✓ Duyệt xong</button>
      </div>
    </div>
  );
}

function CuaToi({ ds, onNap }: { ds: GopYCuaToi[] | null; onNap: () => void }) {
  const [mo, setMo] = useState<number | null>(null);
  if (ds === null) return <div style={{ fontSize: 12, color: 'var(--fg-3)', padding: 8 }}>đang đọc…</div>;
  if (!ds.length) return <div style={{ fontSize: 12.5, color: 'var(--fg-3)', padding: '18px 8px', textAlign: 'center' }}>Chưa có góp ý nào.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {ds.map((b) => {
        const tt = TT[nhomTT(b.trangThai)] ?? TT.pending!;
        return (
          <div key={b.id} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', background: 'var(--bg-2)', opacity: DA_DONG.has(nhomTT(b.trangThai)) && mo !== b.id ? 0.7 : 1 }}>
            <div onClick={() => setMo(mo === b.id ? null : b.id)} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
                <span style={{ border: `1px solid ${tt.mau}`, color: tt.mau, borderRadius: 4, padding: '0 5px' }}>{tt.nhan}</span>
                <b style={{ color: 'var(--fg-2)' }}>#{b.id}</b><span>{b.loai === 'cau_hoi' ? 'hỏi' : 'lỗi'}</span>
                <span style={{ marginLeft: 'auto' }}>cập nhật {cach(b.capNhat)}{b.soTin ? ` · ${b.soTin} tin` : ''}</span>
              </div>
              <div style={{ fontSize: 12.5, marginTop: 4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: mo === b.id ? 99 : 2, WebkitBoxOrient: 'vertical' }}>{b.noiDung}</div>
              {b.tinCuoi && mo !== b.id && <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><b>{b.tinCuoi.nguoi}</b>: {b.tinCuoi.noiDung}</div>}
            </div>
            {mo === b.id && (
              <>
                <a href={`https://mos2.on.tc/plays?proj=xuong-video&task=${b.id}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--cyan)' }}>mở card trên plays ↗</a>
                <Luong id={b.id} onXong={onNap} />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function GopY() {
  const [mo, setMo] = useState(false);
  const [tab, setTab] = useState<'gui' | 'cua-toi'>('gui');
  const [ds, setDs] = useState<GopYCuaToi[] | null>(null);
  useEffect(() => {
    const e = (ev: ErrorEvent) => ghiLoiJs(ev.message || String(ev.error));
    const r = (ev: PromiseRejectionEvent) => ghiLoiJs(`promise: ${ev.reason instanceof Error ? ev.reason.message : String(ev.reason)}`);
    const m = () => setMo(true);
    window.addEventListener('error', e); window.addEventListener('unhandledrejection', r); window.addEventListener('gop-y:mo', m);
    return () => { window.removeEventListener('error', e); window.removeEventListener('unhandledrejection', r); window.removeEventListener('gop-y:mo', m); };
  }, []);
  const nap = () => { void dsGopYCuaToi().then(setDs); };
  useEffect(() => {
    if (!mo) return;
    try { if (localStorage.getItem(KHOA_TAB) === 'cua-toi') setTab('cua-toi'); } catch { /* thôi */ }
    nap();
  }, [mo]);
  const doiTab = (t: 'gui' | 'cua-toi') => { setTab(t); try { localStorage.setItem(KHOA_TAB, t); } catch { /* thôi */ } };
  const conMo = ds?.filter((b) => !DA_DONG.has(nhomTT(b.trangThai))).length ?? 0;
  return (
    <>
      <button type="button" aria-label="Góp ý / báo lỗi" title="Góp ý / báo lỗi về màn đang xem" onClick={() => setMo((v) => !v)}
        style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 60, width: 40, height: 40, borderRadius: 999, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--fg-2)', cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,0,0,.35)', fontSize: 17 }}>💬</button>
      {mo && (
        <>
          <div className="xv-backdrop nho" style={{ zIndex: 60 }} onClick={() => setMo(false)} />
          <div className="xv-drawer nho" data-gop-y="" style={{ zIndex: 61, width: 'min(560px, 96vw)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <b style={{ fontSize: 14 }}>💬 Góp ý / báo lỗi · Xưởng video</b>
              <span style={{ marginLeft: 'auto' }} />
              <button type="button" onClick={() => setMo(false)} aria-label="Đóng" style={{ background: 'none', border: 'none', color: 'var(--fg-3)', cursor: 'pointer', fontSize: 15 }}>✕</button>
            </div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
              <button type="button" className={`xv-btn${tab === 'gui' ? ' chinh' : ''}`} onClick={() => doiTab('gui')}>Gửi góp ý</button>
              <button type="button" className={`xv-btn${tab === 'cua-toi' ? ' chinh' : ''}`} onClick={() => doiTab('cua-toi')}>Của tôi{conMo ? ` (${conMo})` : ''}</button>
            </div>
            {tab === 'gui' ? <FormGopY onGui={nap} /> : <CuaToi ds={ds} onNap={nap} />}
          </div>
        </>
      )}
    </>
  );
}
