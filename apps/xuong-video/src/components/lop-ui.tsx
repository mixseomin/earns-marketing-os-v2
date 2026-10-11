'use client';
// Lớp phủ tự do trên timeline (11/10/2026, anh: "thêm các thành phần, layer custom như ảnh, text, objects… như các công cụ làm video").
// Xem trước dựng bằng CSS theo CÙNG số đo với bản xuất (lop.ts): toạ độ tâm chuẩn hoá, cỡ chữ theo rộng khung, hiệu ứng vào/ra 0,3s.
// Mọi sửa lưu tự động (gom 0,7s) qua luuLop — có ↶ Hoàn tác ở đầu trang.
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as PE } from 'react';
import { luuLop, taiAnhLen } from '@/lib/actions';
import { FONT_CHU, type Lop } from '@/lib/xuong-video/kieu';
import { lopHien, hieuUngTai, lopMoi, tenLop, MAU_LOP } from '@/lib/xuong-video/lop';
import { Menu, MucMenu, mono } from './ui';

const ICON_LOAI: Record<Lop['loai'], string> = { chu: 'T', anh: '🖼', hinh: '◼' };
const fontCss = (f?: string) => (!f || f === 'DejaVu Sans' ? '"DejaVu Sans", system-ui, sans-serif' : `"${f}", "Montserrat", system-ui, sans-serif`);
const lam = (v: number, n = 3) => Math.round(v * 10 ** n) / 10 ** n;

/** Danh sách lớp của tập + lưu tự động. Server đổi (máy khác sửa / hoàn tác) mà mình không đang sửa → nhận bản server. */
export function useLop(tapId: number, tuServer: Lop[]) {
  const [lop, setLop] = useState<Lop[]>(tuServer);
  const dangSua = useRef(false);
  const hen = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loi, setLoi] = useState('');
  const [luu, setLuu] = useState<'' | 'dang' | 'xong'>('');
  const khoa = JSON.stringify(tuServer);
  useEffect(() => { if (!dangSua.current) setLop(tuServer); }, [khoa]); // eslint-disable-line react-hooks/exhaustive-deps
  const dat = (fn: (ds: Lop[]) => Lop[]) => setLop((ds) => {
    const moi = fn(ds);
    dangSua.current = true; setLuu('dang');
    if (hen.current) clearTimeout(hen.current);
    hen.current = setTimeout(() => { void luuLop(tapId, moi).then((r) => { dangSua.current = false; setLoi(r.ok ? '' : r.loi); setLuu(r.ok ? 'xong' : ''); }).catch(() => { dangSua.current = false; setLoi('không lưu được lớp phủ'); setLuu(''); }); }, 700);
    return moi;
  });
  const doi = (id: string, p: Partial<Lop>) => dat((ds) => ds.map((l) => (l.id === id ? { ...l, ...p } : l)));
  return { lop, dat, doi, loi, luu };
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
          opacity: ngoaiGio ? 0.35 : hu.mo, pointerEvents: 'auto', cursor: 'move', outline: dangChon ? '1.5px dashed var(--cyan)' : undefined, outlineOffset: 2, touchAction: 'none' };
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
            {dangChon && <div onPointerDown={keo(l, 'co')} title="Kéo để đổi cỡ" style={{ position: 'absolute', right: -6, bottom: -6, width: 10, height: 10, background: 'var(--cyan)', borderRadius: 2, cursor: 'nwse-resize' }} />}
          </div>
        );
      })}
    </div>
  );
}

/** Thanh công cụ kiểu After Effects: T Chữ · ◼ Hình · 🖼 Ảnh từ máy · ✨ Mẫu ▾ — lớp mới bắt đầu ở đầu phát. */
export function LopCongCu({ t, tiLe, onThem }: { t: number; tiLe: number; onThem: (ds: Lop[]) => void }) {
  const [dang, setDang] = useState(false); const [loi, setLoi] = useState('');
  const tai = (f: File) => {
    const r = new FileReader();
    r.onload = async () => { setDang(true); setLoi(''); const k = await taiAnhLen(String(r.result)); setDang(false); if (k.ok) onThem([lopMoi('anh', t, { url: k.data, ten: f.name.slice(0, 30) })]); else setLoi(k.loi); };
    r.readAsDataURL(f);
  };
  const mau = (k: string) => MAU_LOP.find((m) => m.key === k)!;
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      <button type="button" className="xv-btn" title="Thêm lớp chữ ở giây đang đứng" onClick={() => onThem(mau('chu').tao(t, tiLe))}>T Chữ</button>
      <button type="button" className="xv-btn" title="Thêm hình khối (chữ nhật / bo góc / tròn)" onClick={() => onThem(mau('hinh').tao(t, tiLe))}>◼ Hình</button>
      <label className="xv-btn" style={{ cursor: 'pointer' }} title="Thêm ảnh từ máy làm lớp (PNG nền trong suốt đẹp nhất)">{dang ? '⏳' : '🖼'} Ảnh
        <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) tai(f); e.target.value = ''; }} />
      </label>
      <Menu nhan="✨ Mẫu ▾">
        {MAU_LOP.filter((m) => m.key !== 'chu' && m.key !== 'hinh').map((m) => <MucMenu key={m.key} onClick={() => onThem(m.tao(t, tiLe))}>{m.ten}</MucMenu>)}
      </Menu>
      {loi && <span className="xv-loi">{loi}</span>}
    </span>
  );
}

/** Panel "Dự án" (như Project của After Effects): nguyên liệu bấm là thành lớp ở giây đang đứng. */
export function LopNguyenLieu({ t, anh, onThem }: { t: number; anh: { url: string; ten: string }[]; onThem: (ds: Lop[]) => void }) {
  if (!anh.length) return <div style={mono}>Chưa có ảnh sản phẩm / logo ở mục sản phẩm của phim.</div>;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(44px, 1fr))', gap: 4 }}>
      {anh.map((a) => <button key={a.url} type="button" title={`${a.ten} — bấm để thêm làm lớp ở giây ${t.toFixed(1)}`} onClick={() => onThem([lopMoi('anh', t, { url: a.url, ten: a.ten })])}
        style={{ padding: 0, border: '1px solid var(--line)', borderRadius: 4, background: 'var(--bg-2)', cursor: 'copy' }}><img src={a.url} alt="" data-khong-phong-to="" style={{ width: '100%', aspectRatio: '1', objectFit: 'contain', display: 'block' }} /></button>)}
    </div>
  );
}

/** Bảng thuộc tính gọn: thứ hay sửa (nội dung, màu, cỡ, giờ) hiện sẵn; vị trí · xoay · độ đậm · hiệu ứng gấp trong "Nâng cao". */
export function LopBang({ l, t, onDoi, onXoa, onNhanBan, onLenXuong, onDong }: { l: Lop; t: number; onDoi: (p: Partial<Lop>) => void; onXoa: () => void; onNhanBan: () => void; onLenXuong: (d: 1 | -1) => void; onDong: () => void }) {
  const o: CSSProperties = { display: 'grid', gap: 2, fontSize: 10.5, color: 'var(--fg-3)', minWidth: 0 };
  const so = (nhan: string, k: keyof Lop, buoc = 0.01, a = 0, b = 1) => (
    <label style={o}>{nhan}<input className="xv-in" type="number" step={buoc} min={a} max={b} value={Number(l[k] ?? 0)} onChange={(e) => onDoi({ [k]: Number(e.target.value) } as Partial<Lop>)} style={{ width: '100%', minWidth: 0 }} /></label>
  );
  const mau = (nhan: string, k: 'mau' | 'vien' | 'nen') => (
    <label style={o} title={k === 'nen' ? 'Nền sau chữ — để trống = không nền' : undefined}>{nhan}
      <span style={{ display: 'flex', gap: 2 }}><input type="color" value={l[k] || '#000000'} onChange={(e) => onDoi({ [k]: e.target.value })} style={{ width: 34, height: 24, padding: 0, border: 0, background: 'none' }} />
        {k === 'nen' && l.nen && <button type="button" className="xv-btn" style={{ padding: '0 4px' }} onClick={() => onDoi({ nen: undefined })} title="Bỏ nền">✕</button>}</span>
    </label>
  );
  const nut = (chu: string, title: string, f: () => void, nguy?: boolean) => <button type="button" className={`xv-btn${nguy ? ' nguy' : ''}`} style={{ padding: '0 5px', lineHeight: '18px' }} title={title} onClick={f}>{chu}</button>;
  return (
    <div style={{ display: 'grid', gap: 6, textAlign: 'left' }}
      title="Kéo lớp trên khung để dời · kéo ô xanh ở góc để đổi cỡ · kéo khối trên làn 🧩 để đổi giờ. Tự lưu, ↶ Hoàn tác ở đầu trang.">
      <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
        <b style={{ fontSize: 12, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ICON_LOAI[l.loai]} {tenLop(l)}</b>
        {nut('⧉', 'Nhân bản', onNhanBan)}{nut(l.an ? '🙈' : '👁', l.an ? 'Hiện lại' : 'Ẩn (không xuất)', () => onDoi({ an: !l.an }))}{nut('🗑', 'Bỏ lớp (↶ Hoàn tác được)', onXoa, true)}{nut('✕', 'Đóng', onDong)}
      </div>
      {l.loai === 'chu' && <textarea className="xv-in" rows={2} value={l.chu ?? ''} onChange={(e) => onDoi({ chu: e.target.value })} placeholder="chữ (xuống dòng = dòng mới)" />}
      {l.loai === 'chu' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 6, alignItems: 'end' }}>
          <label style={o}>Font<select className="xv-in" value={l.font ?? 'Montserrat Black'} onChange={(e) => onDoi({ font: e.target.value })} style={{ minWidth: 0 }}>{FONT_CHU.map((f) => <option key={f.key} value={f.key}>{f.key}</option>)}</select></label>
          {mau('Màu', 'mau')}{mau('Viền', 'vien')}{mau('Nền', 'nen')}
        </div>
      )}
      {l.loai === 'hinh' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 6, alignItems: 'end' }}>
          <label style={o}>Dạng<select className="xv-in" value={l.dang ?? 'bo_goc'} onChange={(e) => onDoi({ dang: e.target.value as Lop['dang'] })}><option value="chu_nhat">Chữ nhật</option><option value="bo_goc">Bo góc</option><option value="tron">Tròn / elip</option></select></label>
          {mau('Màu', 'mau')}{mau('Viền', 'vien')}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, alignItems: 'end' }}>
        {l.loai === 'chu' ? so('Cỡ chữ', 'co', 0.005, 0.01, 0.4) : so('Rộng', 'w', 0.01, 0.01, 2)}
        {l.loai === 'hinh' ? so('Cao', 'h', 0.005, 0.005, 2) : so('Độ đậm', 'mo', 0.05, 0, 1)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, alignItems: 'end' }}>
        <label style={o}>Vào (s)<span style={{ display: 'flex', gap: 2 }}><input className="xv-in" type="number" step={0.1} min={0} value={l.tu} onChange={(e) => onDoi({ tu: Number(e.target.value) })} style={{ width: '100%', minWidth: 0 }} />{nut('▸', 'Lấy giây đang đứng', () => onDoi({ tu: lam(t, 2), den: Math.max(lam(t, 2) + 0.3, l.den) }))}</span></label>
        <label style={o}>Ra (s)<span style={{ display: 'flex', gap: 2 }}><input className="xv-in" type="number" step={0.1} min={0} value={l.den} onChange={(e) => onDoi({ den: Number(e.target.value) })} style={{ width: '100%', minWidth: 0 }} />{nut('▸', 'Lấy giây đang đứng', () => onDoi({ den: Math.max(l.tu + 0.3, lam(t, 2)) }))}</span></label>
      </div>
      <details>
        <summary style={{ fontSize: 11, color: 'var(--fg-3)', cursor: 'pointer' }}>Nâng cao — vị trí, xoay, hiệu ứng, thứ tự</summary>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6, alignItems: 'end' }}>
          {so('Tâm X', 'x', 0.01, -0.5, 1.5)}{so('Tâm Y', 'y', 0.01, -0.5, 1.5)}
          {l.loai === 'chu' ? so('Rộng', 'w', 0.01, 0.01, 2) : l.loai === 'hinh' ? so('Độ đậm', 'mo', 0.05, 0, 1) : <span />}{so('Xoay (°)', 'xoay', 1, -180, 180)}
          {l.loai !== 'anh' && so('Dày viền', 'vien_day', 0.01, 0, 0.3)}
          {l.loai === 'chu' && <label style={{ ...o, alignSelf: 'center' }}><span><input type="checkbox" checked={!!l.nghieng} onChange={(e) => onDoi({ nghieng: e.target.checked })} /> Nghiêng</span></label>}
          <label style={o}>Hiệu ứng vào<select className="xv-in" value={l.vao} onChange={(e) => onDoi({ vao: e.target.value as Lop['vao'] })}><option value="khong">Không</option><option value="mo">Hiện dần</option><option value="pop">Bật ra</option><option value="truot">Trượt lên</option></select></label>
          <label style={o}>Khi ra<select className="xv-in" value={l.ra} onChange={(e) => onDoi({ ra: e.target.value as Lop['ra'] })}><option value="khong">Cắt</option><option value="mo">Mờ dần</option></select></label>
          {l.loai === 'anh' && <label style={{ ...o, gridColumn: 'span 2' }}>Đường dẫn ảnh<input className="xv-in" value={l.url ?? ''} onChange={(e) => onDoi({ url: e.target.value })} /></label>}
          <label style={{ ...o, gridColumn: 'span 2' }}>Tên lớp<input className="xv-in" value={l.ten ?? ''} placeholder={tenLop(l)} onChange={(e) => onDoi({ ten: e.target.value })} /></label>
          <span style={{ display: 'flex', gap: 4, gridColumn: 'span 2' }}>{nut('⬆ Lên trên', 'Đưa lớp lên trên', () => onLenXuong(1))}{nut('⬇ Xuống dưới', 'Đưa lớp xuống dưới', () => onLenXuong(-1))}</span>
        </div>
      </details>
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
  return (
    <div onPointerDown={keo('than')} data-goi-y={`${tenLop(l)}\nvào ${l.tu}s · ra ${l.den}s\nkéo để dời · kéo mép để đổi giờ`}
      style={{ position: 'absolute', left: l.tu * pps, width: Math.max(6, (l.den - l.tu) * pps), top: 2, bottom: 2, borderRadius: 4, cursor: 'grab', touchAction: 'none', opacity: l.an ? 0.4 : 1,
        background: 'var(--bg-2)', border: `1px solid ${chon ? 'var(--cyan)' : 'var(--line)'}`, outline: chon ? '1px solid var(--cyan)' : undefined, color: chon ? 'var(--fg-1)' : 'var(--fg-2)', fontSize: 10, lineHeight: '14px', padding: '0 8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
      <div onPointerDown={keo('trai')} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, cursor: 'ew-resize' }} />
      {ICON_LOAI[l.loai]} {tenLop(l)}
      <div onPointerDown={keo('phai')} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 6, cursor: 'ew-resize' }} />
    </div>
  );
}
