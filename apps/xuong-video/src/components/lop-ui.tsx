'use client';
// Lớp phủ tự do trên timeline (11/10/2026, anh: "thêm các thành phần, layer custom như ảnh, text, objects… như các công cụ làm video").
// Xem trước dựng bằng CSS theo CÙNG số đo với bản xuất (lop.ts): toạ độ tâm chuẩn hoá, cỡ chữ theo rộng khung, hiệu ứng vào/ra 0,3s.
// Mọi sửa lưu tự động (gom 0,7s) qua luuLop — có ↶ Hoàn tác ở đầu trang.
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as PE } from 'react';
import { luuLop, taiAnhLen } from '@/lib/actions';
import { FONT_CHU, type Lop } from '@/lib/xuong-video/kieu';
import { lopHien, hieuUngTai, lopMoi, MAU_LOP } from '@/lib/xuong-video/lop';
import { mono } from './ui';

const MAU_LOAI: Record<Lop['loai'], string> = { chu: '#f5b638', anh: '#38d9f5', hinh: '#a78bfa' };
const tenLop = (l: Lop) => l.ten || (l.loai === 'chu' ? (l.chu ?? '').split('\n')[0]!.slice(0, 24) || 'Chữ' : l.loai === 'anh' ? 'Ảnh' : 'Hình');
const fontCss = (f?: string) => (!f || f === 'DejaVu Sans' ? '"DejaVu Sans", system-ui, sans-serif' : `"${f}", "Montserrat", system-ui, sans-serif`);
const lam = (v: number, n = 3) => Math.round(v * 10 ** n) / 10 ** n;

/** Danh sách lớp của tập + lưu tự động. Server đổi (máy khác sửa / hoàn tác) mà mình không đang sửa → nhận bản server. */
export function useLop(tapId: number, tuServer: Lop[]) {
  const [lop, setLop] = useState<Lop[]>(tuServer);
  const dangSua = useRef(false);
  const hen = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loi, setLoi] = useState('');
  const khoa = JSON.stringify(tuServer);
  useEffect(() => { if (!dangSua.current) setLop(tuServer); }, [khoa]); // eslint-disable-line react-hooks/exhaustive-deps
  const dat = (fn: (ds: Lop[]) => Lop[]) => setLop((ds) => {
    const moi = fn(ds);
    dangSua.current = true;
    if (hen.current) clearTimeout(hen.current);
    hen.current = setTimeout(() => { void luuLop(tapId, moi).then((r) => { dangSua.current = false; setLoi(r.ok ? '' : r.loi); }).catch(() => { dangSua.current = false; setLoi('không lưu được lớp phủ'); }); }, 700);
    return moi;
  });
  const doi = (id: string, p: Partial<Lop>) => dat((ds) => ds.map((l) => (l.id === id ? { ...l, ...p } : l)));
  return { lop, dat, doi, loi };
}

/** Lớp đang hiện ở giây t, vẽ đè lên khung xem trước. Lớp đang chọn: viền nét đứt + góc kéo đổi cỡ; kéo thân để dời. */
export function LopXem({ lop, t, rong, cao, chonId, onChon, onDoi }: { lop: Lop[]; t: number; rong: number; cao: number; chonId: string | null; onChon: (id: string) => void; onDoi: (id: string, p: Partial<Lop>) => void }) {
  const keo = (l: Lop, kieu: 'doi' | 'co') => (e: PE<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); onChon(l.id);
    const el = e.currentTarget; el.setPointerCapture(e.pointerId);
    const x0 = e.clientX, y0 = e.clientY; const goc = { ...l };
    const di = (ev: PointerEvent) => {
      const dx = (ev.clientX - x0) / rong, dy = (ev.clientY - y0) / cao;
      if (kieu === 'doi') onDoi(l.id, { x: lam(goc.x + dx), y: lam(goc.y + dy) });
      else { const k = Math.max(0.1, (goc.w + dx * 2) / goc.w); onDoi(l.id, { w: lam(goc.w * k), ...(l.loai === 'hinh' ? { h: lam(Math.max(0.005, goc.h + dy * 2)) } : {}), ...(l.loai === 'chu' && goc.co ? { co: lam(goc.co * k, 4) } : {}) }); }
    };
    const xong = () => { el.removeEventListener('pointermove', di); el.removeEventListener('pointerup', xong); el.removeEventListener('pointercancel', xong); };
    el.addEventListener('pointermove', di); el.addEventListener('pointerup', xong); el.addEventListener('pointercancel', xong);
  };
  const hien = lopHien(lop, t);
  const chon = chonId ? lop.find((l) => l.id === chonId && !l.an) : undefined;
  const ve = chon && !hien.includes(chon) ? [...hien, chon] : hien;   // lớp đang chọn hiện mờ cả ngoài giờ của nó, để kéo chỉnh được
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {ve.map((l) => {
        const hu = hieuUngTai(l, t); const ngoaiGio = t < l.tu || t >= l.den; const dangChon = l.id === chonId;
        const goc: CSSProperties = { position: 'absolute', left: `${l.x * 100}%`, top: `${(l.y + hu.dy) * 100}%`, transform: `translate(-50%, -50%) rotate(${l.xoay}deg) scale(${hu.scale})`,
          opacity: ngoaiGio ? 0.35 : hu.mo, pointerEvents: 'auto', cursor: 'move', outline: dangChon ? '1.5px dashed #38d9f5' : undefined, outlineOffset: 2, touchAction: 'none' };
        const fs = (l.co ?? 0.07) * rong;
        const noi = l.loai === 'chu'
          ? <div style={{ fontFamily: fontCss(l.font), fontWeight: 900, fontStyle: l.nghieng ? 'italic' : undefined, fontSize: fs, lineHeight: 1.15, color: l.mau ?? '#fff', whiteSpace: 'pre', textAlign: 'center',
              ...(l.nen ? { background: l.nen, padding: '0.15em 0.3em' } : { WebkitTextStroke: `${Math.max(0, (l.vien_day ?? 0.08) * fs * 2)}px ${l.vien ?? '#000'}`, paintOrder: 'stroke fill' }) }}>{l.chu}</div>
          : l.loai === 'anh'
            ? (l.url ? <img src={l.url} alt="" data-khong-phong-to="" draggable={false} style={{ width: l.w * rong, display: 'block' }} /> : <div style={{ width: l.w * rong, height: l.w * rong * 0.6, border: '1px dashed #fff', color: '#fff', fontSize: 10, display: 'grid', placeItems: 'center' }}>chưa có ảnh</div>)
            : <div style={{ width: l.w * rong, height: l.h * cao, background: l.mau ?? '#6B4FD8', borderRadius: l.dang === 'tron' ? '50%' : l.dang === 'bo_goc' ? Math.min(l.w * rong, l.h * cao) * 0.22 : 0,
                border: l.vien_day ? `${Math.max(1, rong * l.vien_day * 0.05)}px solid ${l.vien ?? '#000'}` : undefined, boxSizing: 'border-box' }} />;
        return (
          <div key={l.id} style={goc} onPointerDown={keo(l, 'doi')} title={`${tenLop(l)} — kéo để dời${dangChon ? ', kéo góc để đổi cỡ' : ''}`}>
            {noi}
            {dangChon && <div onPointerDown={keo(l, 'co')} title="Kéo để đổi cỡ" style={{ position: 'absolute', right: -6, bottom: -6, width: 10, height: 10, background: '#38d9f5', borderRadius: 2, cursor: 'nwse-resize' }} />}
          </div>
        );
      })}
    </div>
  );
}

/** Thanh thêm lớp: mẫu dựng sẵn + ảnh (tải lên / ảnh sản phẩm / logo) — lớp mới bắt đầu ở đầu phát. */
export function LopThem({ t, tiLe, anhSan, onThem }: { t: number; tiLe: number; anhSan: { url: string; ten: string }[]; onThem: (ds: Lop[]) => void }) {
  const [dang, setDang] = useState(false); const [loi, setLoi] = useState('');
  const tai = (f: File) => {
    const r = new FileReader();
    r.onload = async () => { setDang(true); setLoi(''); const k = await taiAnhLen(String(r.result)); setDang(false); if (k.ok) onThem([lopMoi('anh', t, { url: k.data, ten: f.name.slice(0, 30) })]); else setLoi(k.loi); };
    r.readAsDataURL(f);
  };
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' }}>
      <span style={mono}>🧩 thêm lớp:</span>
      {MAU_LOP.map((m) => <button key={m.key} type="button" className="xv-btn" style={{ padding: '1px 7px' }} title={`Thêm ${m.ten} ở giây đang đứng`} onClick={() => onThem(m.tao(t, tiLe))}>＋ {m.ten}</button>)}
      <label className="xv-btn" style={{ padding: '1px 7px', cursor: 'pointer' }} title="Tải ảnh lên làm lớp (PNG nền trong suốt đẹp nhất)">{dang ? '⏳' : '＋ Ảnh'}
        <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) tai(f); e.target.value = ''; }} />
      </label>
      {anhSan.slice(0, 6).map((a) => <button key={a.url} type="button" title={`Thêm ${a.ten} làm lớp`} onClick={() => onThem([lopMoi('anh', t, { url: a.url, ten: a.ten })])} style={{ padding: 0, border: '1px solid var(--line)', borderRadius: 4, background: 'none', cursor: 'pointer' }}><img src={a.url} alt="" data-khong-phong-to="" style={{ width: 26, height: 26, objectFit: 'contain', display: 'block' }} /></button>)}
      {loi && <span className="xv-loi">{loi}</span>}
    </div>
  );
}

/** Bảng thuộc tính của lớp đang chọn. */
export function LopBang({ l, t, onDoi, onXoa, onNhanBan, onLenXuong, onDong }: { l: Lop; t: number; onDoi: (p: Partial<Lop>) => void; onXoa: () => void; onNhanBan: () => void; onLenXuong: (d: 1 | -1) => void; onDong: () => void }) {
  const so = (nhan: string, k: keyof Lop, buoc = 0.01, a = 0, b = 1, title?: string) => (
    <label style={{ display: 'grid', gap: 1, fontSize: 10.5, color: 'var(--fg-3)' }} title={title}>{nhan}
      <input className="xv-in" type="number" step={buoc} min={a} max={b} value={Number(l[k] ?? 0)} onChange={(e) => onDoi({ [k]: Number(e.target.value) } as Partial<Lop>)} style={{ width: '100%' }} />
    </label>
  );
  const mau = (nhan: string, k: 'mau' | 'vien' | 'nen') => (
    <label style={{ display: 'grid', gap: 1, fontSize: 10.5, color: 'var(--fg-3)' }}>{nhan}
      <span style={{ display: 'flex', gap: 3, alignItems: 'center' }}><input type="color" value={l[k] || '#000000'} onChange={(e) => onDoi({ [k]: e.target.value })} />{k === 'nen' && l.nen && <button type="button" className="xv-btn" style={{ padding: '0 5px' }} onClick={() => onDoi({ nen: undefined })} title="Bỏ nền">✕</button>}</span>
    </label>
  );
  return (
    <div className="xv-panel" style={{ padding: 8, display: 'grid', gap: 6, textAlign: 'left' }}>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <b style={{ fontSize: 12, color: MAU_LOAI[l.loai], flex: 1 }}>🧩 {tenLop(l)}</b>
        <button type="button" className="xv-btn" style={{ padding: '0 6px' }} title="Đưa lên trên" onClick={() => onLenXuong(1)}>⬆</button>
        <button type="button" className="xv-btn" style={{ padding: '0 6px' }} title="Đưa xuống dưới" onClick={() => onLenXuong(-1)}>⬇</button>
        <button type="button" className="xv-btn" style={{ padding: '0 6px' }} title="Nhân bản" onClick={onNhanBan}>⧉</button>
        <button type="button" className="xv-btn" style={{ padding: '0 6px' }} title={l.an ? 'Hiện lại' : 'Ẩn (không xuất)'} onClick={() => onDoi({ an: !l.an })}>{l.an ? '🙈' : '👁'}</button>
        <button type="button" className="xv-btn nguy" style={{ padding: '0 6px' }} title="Bỏ lớp (↶ Hoàn tác được)" onClick={onXoa}>🗑</button>
        <button type="button" className="xv-btn" style={{ padding: '0 6px' }} onClick={onDong}>✕</button>
      </div>
      <input className="xv-in" placeholder="tên lớp" value={l.ten ?? ''} onChange={(e) => onDoi({ ten: e.target.value })} />
      {l.loai === 'chu' && <textarea className="xv-in" rows={2} value={l.chu ?? ''} onChange={(e) => onDoi({ chu: e.target.value })} placeholder="chữ (xuống dòng = dòng mới)" />}
      {l.loai === 'anh' && <input className="xv-in" placeholder="https://… ảnh" value={l.url ?? ''} onChange={(e) => onDoi({ url: e.target.value })} />}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
        {so('Vào (s)', 'tu', 0.1, 0, 3600)}{so('Ra (s)', 'den', 0.1, 0, 3600)}
        <button type="button" className="xv-btn" style={{ alignSelf: 'end', padding: '1px 4px' }} title="Lớp bắt đầu ở đầu phát" onClick={() => onDoi({ tu: lam(t, 2), den: Math.max(lam(t, 2) + 0.3, l.den) })}>vào = ▸</button>
        <button type="button" className="xv-btn" style={{ alignSelf: 'end', padding: '1px 4px' }} title="Lớp kết thúc ở đầu phát" onClick={() => onDoi({ den: Math.max(l.tu + 0.3, lam(t, 2)) })}>ra = ▸</button>
        {so('Tâm X', 'x', 0.01, -0.5, 1.5)}{so('Tâm Y', 'y', 0.01, -0.5, 1.5)}{so('Rộng', 'w', 0.01, 0.01, 2)}
        {l.loai === 'hinh' ? so('Cao', 'h', 0.005, 0.005, 2) : l.loai === 'chu' ? so('Cỡ chữ', 'co', 0.005, 0.01, 0.4, 'phần của bề rộng khung') : <span />}
        {so('Xoay°', 'xoay', 1, -180, 180)}{so('Độ đậm', 'mo', 0.05, 0, 1)}
        <label style={{ display: 'grid', gap: 1, fontSize: 10.5, color: 'var(--fg-3)' }}>Hiệu ứng vào
          <select className="xv-in" value={l.vao} onChange={(e) => onDoi({ vao: e.target.value as Lop['vao'] })}><option value="khong">không</option><option value="mo">hiện dần</option><option value="pop">bật ra</option><option value="truot">trượt lên</option></select>
        </label>
        <label style={{ display: 'grid', gap: 1, fontSize: 10.5, color: 'var(--fg-3)' }}>Ra
          <select className="xv-in" value={l.ra} onChange={(e) => onDoi({ ra: e.target.value as Lop['ra'] })}><option value="khong">cắt</option><option value="mo">mờ dần</option></select>
        </label>
      </div>
      {l.loai === 'chu' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, alignItems: 'end' }}>
          <label style={{ display: 'grid', gap: 1, fontSize: 10.5, color: 'var(--fg-3)', gridColumn: 'span 2' }}>Font
            <select className="xv-in" value={l.font ?? 'Montserrat Black'} onChange={(e) => onDoi({ font: e.target.value })}>{FONT_CHU.map((f) => <option key={f.key} value={f.key}>{f.ten}</option>)}</select>
          </label>
          {mau('Màu', 'mau')}{mau('Viền', 'vien')}
          {so('Dày viền', 'vien_day', 0.01, 0, 0.3)}{mau('Nền', 'nen')}
          <label style={{ fontSize: 10.5, color: 'var(--fg-3)' }}><input type="checkbox" checked={!!l.nghieng} onChange={(e) => onDoi({ nghieng: e.target.checked })} /> nghiêng</label>
        </div>
      )}
      {l.loai === 'hinh' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, alignItems: 'end' }}>
          <label style={{ display: 'grid', gap: 1, fontSize: 10.5, color: 'var(--fg-3)' }}>Dạng
            <select className="xv-in" value={l.dang ?? 'bo_goc'} onChange={(e) => onDoi({ dang: e.target.value as Lop['dang'] })}><option value="chu_nhat">chữ nhật</option><option value="bo_goc">bo góc</option><option value="tron">tròn / elip</option></select>
          </label>
          {mau('Màu', 'mau')}{mau('Viền', 'vien')}{so('Dày viền', 'vien_day', 0.01, 0, 0.3)}
        </div>
      )}
      <div style={mono}>Kéo lớp trên khung để dời · kéo góc xanh để đổi cỡ · kéo khối trên làn 🧩 để đổi giờ. Tự lưu, ↶ Hoàn tác ở đầu trang.</div>
    </div>
  );
}

/** Khối thời gian của một lớp trên làn timeline: kéo thân = dời, kéo hai mép = đổi giờ vào/ra. */
export function KhoiLop({ l, pps, chon, onChon, onDoi }: { l: Lop; pps: number; chon: boolean; onChon: () => void; onDoi: (p: Partial<Lop>) => void }) {
  const keo = (kieu: 'than' | 'trai' | 'phai') => (e: PE<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); onChon();
    const el = e.currentTarget; el.setPointerCapture(e.pointerId);
    const x0 = e.clientX; const tu0 = l.tu, den0 = l.den;
    const di = (ev: PointerEvent) => {
      const d = lam((ev.clientX - x0) / pps, 2);
      if (kieu === 'than') { const dd = Math.max(-tu0, d); onDoi({ tu: lam(tu0 + dd, 2), den: lam(den0 + dd, 2) }); }
      else if (kieu === 'trai') onDoi({ tu: lam(Math.max(0, Math.min(den0 - 0.2, tu0 + d)), 2) });
      else onDoi({ den: lam(Math.max(tu0 + 0.2, den0 + d), 2) });
    };
    const xong = () => { el.removeEventListener('pointermove', di); el.removeEventListener('pointerup', xong); el.removeEventListener('pointercancel', xong); };
    el.addEventListener('pointermove', di); el.addEventListener('pointerup', xong); el.addEventListener('pointercancel', xong);
  };
  const mau = MAU_LOAI[l.loai];
  return (
    <div onPointerDown={keo('than')} data-goi-y={`${tenLop(l)}\nvào ${l.tu}s · ra ${l.den}s\nkéo để dời · kéo mép để đổi giờ`}
      style={{ position: 'absolute', left: l.tu * pps, width: Math.max(6, (l.den - l.tu) * pps), top: 2, bottom: 2, borderRadius: 4, cursor: 'grab', touchAction: 'none', opacity: l.an ? 0.4 : 1,
        background: `${mau}${chon ? '55' : '2a'}`, border: `1px solid ${mau}`, outline: chon ? `1.5px solid ${mau}` : undefined, color: mau, fontSize: 10, lineHeight: '14px', padding: '0 8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
      <div onPointerDown={keo('trai')} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, cursor: 'ew-resize' }} />
      {l.loai === 'chu' ? '✎' : l.loai === 'anh' ? '🖼' : '◼'} {tenLop(l)}
      <div onPointerDown={keo('phai')} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 6, cursor: 'ew-resize' }} />
    </div>
  );
}
