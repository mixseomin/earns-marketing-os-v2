'use client';
// Lớp phủ tự do trên timeline (11/10/2026, anh: "thêm các thành phần, layer custom như ảnh, text, objects… như các công cụ làm video").
// Xem trước dựng bằng CSS theo CÙNG số đo với bản xuất (lop.ts): toạ độ tâm chuẩn hoá, cỡ chữ theo rộng khung, hiệu ứng vào/ra 0,3s.
// Mọi sửa lưu tự động (gom 0,7s) qua luuLop — có ↶ Hoàn tác ở đầu trang.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as PE } from 'react';
import { luuLop, taiAnhLen } from '@/lib/actions';
import { FONT_CHU, type Lop } from '@/lib/xuong-video/kieu';
import { lopHien, hieuUngTai, lopMoi, tenLop, soKyTuGo, MAU_LOP, HIEU_UNG, nhomCua, bienDoiNhom } from '@/lib/xuong-video/lop';
import { Chon } from './chon';
import { Menu, MucMenu, Xoa, mono } from './ui';

const ICON_LOAI: Record<Lop['loai'], string> = { chu: 'T', anh: '🖼', hinh: '◼', hieu_ung: '✦' };
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

/** Lớp đang hiện ở giây t, vẽ đè lên khung xem trước. Lớp đang chọn: viền nét đứt + góc kéo đổi cỡ; kéo thân để dời.
 *  Chọn nhiều (#1289): Shift/⌘ + bấm = thêm/bớt; bấm lớp trong nhóm = chọn cả nhóm; kéo một lớp đang chọn = dời cả vùng chọn. */
export function LopXem({ lop, t, rong, cao, chonIds, onChon, onDoi, dangChay = true }: { lop: Lop[]; t: number; rong: number; cao: number; chonIds: string[]; onChon: (id: string, them: boolean) => void; onDoi: (id: string, p: Partial<Lop>) => void;
  /** Đang phát → chạy hiệu ứng vào/ra; dừng để chỉnh → vẽ lớp ở trạng thái ĐẦY ĐỦ (như After Effects). Trước đây lớp mới "hiện dần"
   *  có độ đậm 0 đúng giây vừa thêm → thêm xong không thấy gì, phải kéo đầu phát (#1279). */
  dangChay?: boolean }) {
  const [sua, setSua] = useState<string | null>(null);   // lớp chữ đang sửa chữ ngay trên khung (nhấp đúp)
  // Mọi thao tác ngay trên khung (#1280): dời · đổi cỡ (góc) · rộng (cạnh phải) · cao (cạnh dưới) · xoay (núm trên, Shift = nấc 15°).
  // Sau khi xoay vẫn đúng cảm giác (#1287): cỡ theo KHOẢNG CÁCH tới tâm (không phụ thuộc góc), rộng/cao chiếu độ dời lên TRỤC đã xoay của lớp.
  const lopEl = useRef<Record<string, HTMLDivElement | null>>({});
  const gocRef = useRef<HTMLDivElement>(null);
  const keo = (l: Lop, kieu: 'doi' | 'co' | 'rong' | 'cao' | 'xoay') => (e: PE<HTMLDivElement>) => {
    if (sua === l.id && kieu === 'doi') return;
    e.preventDefault(); e.stopPropagation();
    if (kieu === 'doi') {
      if (e.shiftKey || e.metaKey || e.ctrlKey) { onChon(l.id, true); return; }
      // Kéo lớp đang nằm trong vùng chọn = dời cả vùng chọn; lớp ngoài vùng chọn = chọn (cả nhóm của nó) rồi dời.
      const ids = chonIds.includes(l.id) ? chonIds : nhomCua(lop, l.id);
      if (!chonIds.includes(l.id)) onChon(l.id, false);
      const goc = lop.filter((x) => ids.includes(x.id)); const x0 = e.clientX, y0 = e.clientY;
      const el = e.currentTarget; el.setPointerCapture(e.pointerId);
      const di = (ev: PointerEvent) => { const px = (ev.clientX - x0) / rong, py = (ev.clientY - y0) / cao; for (const g of goc) onDoi(g.id, { x: lam(g.x + px), y: lam(g.y + py) }); };
      const xong = () => { el.removeEventListener('pointermove', di); el.removeEventListener('pointerup', xong); el.removeEventListener('pointercancel', xong); };
      el.addEventListener('pointermove', di); el.addEventListener('pointerup', xong); el.addEventListener('pointercancel', xong);
      return;
    }
    const el = e.currentTarget; el.setPointerCapture(e.pointerId);
    const x0 = e.clientX, y0 = e.clientY; const goc = { ...l };
    const r = (lopEl.current[l.id] ?? el).getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const d0 = Math.max(4, Math.hypot(x0 - cx, y0 - cy));
    const rad = (goc.xoay * Math.PI) / 180, cos = Math.cos(rad), sin = Math.sin(rad);
    const di = (ev: PointerEvent) => {
      const px = ev.clientX - x0, py = ev.clientY - y0;
      if (kieu === 'xoay') { let a = (Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180) / Math.PI + 90; if (a > 180) a -= 360; if (ev.shiftKey) a = Math.round(a / 15) * 15; onDoi(l.id, { xoay: Math.round(a) }); }
      else if (kieu === 'rong') { const dc = px * cos + py * sin; onDoi(l.id, { w: lam(Math.max(0.02, goc.w + (dc * 2) / rong)) }); }
      else if (kieu === 'cao') { const dc = -px * sin + py * cos; onDoi(l.id, { h: lam(Math.max(0.005, goc.h + (dc * 2) / cao)) }); }
      else { const k = Math.max(0.1, Math.hypot(ev.clientX - cx, ev.clientY - cy) / d0); onDoi(l.id, { w: lam(goc.w * k), ...(l.loai === 'hinh' ? { h: lam(Math.max(0.005, goc.h * k)) } : {}), ...(l.loai === 'chu' && goc.co ? { co: lam(goc.co * k, 4) } : {}) }); }
    };
    const xong = () => { el.removeEventListener('pointermove', di); el.removeEventListener('pointerup', xong); el.removeEventListener('pointercancel', xong); };
    el.addEventListener('pointermove', di); el.addEventListener('pointerup', xong); el.addEventListener('pointercancel', xong);
  };
  const hien = lopHien(lop, t);
  const dsChon = lop.filter((l) => chonIds.includes(l.id) && !l.an && l.loai !== 'hieu_ung');
  const ve = [...hien, ...dsChon.filter((l) => !hien.includes(l))];   // lớp đang chọn hiện mờ cả ngoài giờ của nó, để kéo chỉnh được
  const chon = dsChon.length === 1 ? dsChon[0] : undefined;
  return (
    <div ref={gocRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {ve.map((l) => {
        const hu = dangChay ? hieuUngTai(l, t) : { mo: l.mo, dy: 0, scale: 1 };
        const ngoaiGio = t < l.tu || t >= l.den;
        const goc: CSSProperties = { position: 'absolute', left: `${l.x * 100}%`, top: `${(l.y + hu.dy) * 100}%`, transform: `translate(-50%, -50%) rotate(${l.xoay}deg) scale(${hu.scale})`,
          opacity: ngoaiGio ? 0.35 : hu.mo, pointerEvents: 'auto', cursor: sua === l.id ? 'text' : 'move', touchAction: 'none' };
        const fs = (l.co ?? 0.07) * rong;
        const kieuChu: CSSProperties = { fontFamily: fontCss(l.font), fontWeight: 900, fontStyle: l.nghieng ? 'italic' : undefined, fontSize: fs, lineHeight: 1.15, color: l.mau ?? '#fff', whiteSpace: 'pre', textAlign: 'center',
          ...(l.nen ? { background: l.nen, padding: '0.15em 0.3em' } : { WebkitTextStroke: `${Math.max(0, (l.vien_day ?? 0.08) * fs * 2)}px ${l.vien ?? '#000'}`, paintOrder: 'stroke fill' }) };
        const noi = l.loai === 'chu'
          ? (sua === l.id
            ? <div contentEditable suppressContentEditableWarning autoFocus ref={(el) => { if (el && document.activeElement !== el) { el.focus(); document.getSelection()?.selectAllChildren(el); } }}
                onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') (e.currentTarget as HTMLElement).blur(); }}
                onBlur={(e) => { onDoi(l.id, { chu: e.currentTarget.innerText.replace(/\n$/, '') }); setSua(null); }} style={{ ...kieuChu, outline: 'none', minWidth: 20 }}>{l.chu}</div>
            : <div style={kieuChu}>{dangChay && l.vao === 'go_chu' && !ngoaiGio ? (l.chu ?? '').slice(0, soKyTuGo(l, t)) : l.chu}</div>)
          : l.loai === 'anh'
            ? (l.url ? <img src={l.url} alt="" data-khong-phong-to="" draggable={false} style={{ width: l.w * rong, display: 'block' }} /> : <div style={{ width: l.w * rong, height: l.w * rong * 0.6, border: '1px dashed #fff', color: '#fff', fontSize: 10, display: 'grid', placeItems: 'center' }}>chưa có ảnh</div>)
            : <div style={{ width: l.w * rong, height: l.h * cao, background: l.mau ?? '#6B4FD8', borderRadius: l.dang === 'tron' ? '50%' : l.dang === 'bo_goc' ? Math.min(l.w * rong, l.h * cao) * 0.22 : 0,
                border: l.vien_day ? `${Math.max(1, rong * l.vien_day * 0.05)}px solid ${l.vien ?? '#000'}` : undefined, boxSizing: 'border-box' }} />;
        return (
          <div key={l.id} ref={(el) => { lopEl.current[l.id] = el; }} style={goc} onPointerDown={keo(l, 'doi')} onDoubleClick={() => { if (l.loai === 'chu') setSua(l.id); }}
            title={`${tenLop(l)} — kéo để dời${l.loai === 'chu' ? ' · nhấp đúp để sửa chữ' : ''}`}>
            {noi}
          </div>
        );
      })}
      {/* Khung chọn + tay nắm vẽ RIÊNG trên mọi lớp và chữ màn (#1287): lớp đang chọn nằm dưới vẫn kéo/xoay/đổi cỡ được. */}
      {chon && sua !== chon.id && ve.includes(chon) && <KhungChon l={chon} el={lopEl.current[chon.id] ?? null} t={t} dangChay={dangChay} keo={keo} />}
      {dsChon.length > 1 && <KhungNhom ds={dsChon} lopEl={lopEl.current} goc={gocRef.current} rong={rong} cao={cao} onDoi={onDoi} />}
    </div>
  );
}

/** Khung chọn kiểu After Effects/Figma: cùng tâm + góc xoay với lớp, cỡ đo từ phần tử thật (offsetWidth/Height — chưa xoay). */
function KhungChon({ l, el, t, dangChay, keo }: { l: Lop; el: HTMLDivElement | null; t: number; dangChay: boolean; keo: (l: Lop, k: 'co' | 'rong' | 'cao' | 'xoay') => (e: PE<HTMLDivElement>) => void }) {
  const [, ve] = useState(0);
  useEffect(() => { if (!el) return; const ro = new ResizeObserver(() => ve((x) => x + 1)); ro.observe(el); return () => ro.disconnect(); }, [el]);
  const w = el?.offsetWidth ?? 0, h = el?.offsetHeight ?? 0;
  const hu = dangChay ? hieuUngTai(l, t) : { dy: 0, scale: 1 };
  const tay = (kieu: 'co' | 'rong' | 'cao', vt: CSSProperties, con: string, title: string) =>
    <div onPointerDown={keo(l, kieu)} title={title} style={{ position: 'absolute', width: 9, height: 9, background: 'var(--cyan)', border: '1px solid #000', borderRadius: 2, cursor: con, pointerEvents: 'auto', ...vt }} />;
  return (
    <div style={{ position: 'absolute', left: `${l.x * 100}%`, top: `${(l.y + hu.dy) * 100}%`, width: w * hu.scale, height: h * hu.scale, transform: `translate(-50%, -50%) rotate(${l.xoay}deg)`, outline: '1.5px dashed var(--cyan)', outlineOffset: 2, pointerEvents: 'none', zIndex: 20 }}>
      {tay('co', { right: -6, bottom: -6 }, 'nwse-resize', 'Kéo để đổi cỡ (giữ tỉ lệ)')}
      {l.loai !== 'chu' && tay('rong', { right: -6, top: 'calc(50% - 5px)' }, 'ew-resize', 'Kéo để đổi bề rộng')}
      {l.loai === 'hinh' && tay('cao', { bottom: -6, left: 'calc(50% - 5px)' }, 'ns-resize', 'Kéo để đổi bề cao')}
      <div style={{ position: 'absolute', left: '50%', top: -20, width: 1, height: 14, background: 'var(--cyan)' }} />
      <div onPointerDown={keo(l, 'xoay')} title={`Kéo để xoay (${l.xoay}°) · giữ Shift = nấc 15°`} style={{ position: 'absolute', left: 'calc(50% - 6px)', top: -30, width: 12, height: 12, borderRadius: '50%', background: 'var(--cyan)', border: '1px solid #000', cursor: 'grab', pointerEvents: 'auto' }} />
    </div>
  );
}

/** Khung bao vùng chọn nhiều lớp (#1289): hộp nét đứt ôm mọi lớp đang chọn; góc = đổi cỡ cả nhóm, núm trên = xoay cả nhóm quanh tâm chung. */
function KhungNhom({ ds, lopEl, goc, rong, cao, onDoi }: { ds: Lop[]; lopEl: Record<string, HTMLDivElement | null>; goc: HTMLDivElement | null; rong: number; cao: number; onDoi: (id: string, p: Partial<Lop>) => void }) {
  const [hop, setHop] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    if (!goc) return;
    const g = goc.getBoundingClientRect(); let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    for (const l of ds) { const r = lopEl[l.id]?.getBoundingClientRect(); if (!r) continue; a = Math.min(a, r.left); b = Math.min(b, r.top); c = Math.max(c, r.right); d = Math.max(d, r.bottom); }
    const moi = a === Infinity ? null : { x: Math.round(a - g.left), y: Math.round(b - g.top), w: Math.round(c - a), h: Math.round(d - b) };
    setHop((cu) => (JSON.stringify(cu) === JSON.stringify(moi) ? cu : moi));
  });
  if (!hop || !goc) return null;
  const keo = (kieu: 'co' | 'xoay') => (e: PE<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
    const el = e.currentTarget; el.setPointerCapture(e.pointerId);
    const g = goc.getBoundingClientRect(); const cx = g.left + hop.x + hop.w / 2, cy = g.top + hop.y + hop.h / 2;
    const tamX = (cx - g.left) / rong, tamY = (cy - g.top) / cao; const truoc = ds.map((l) => ({ ...l }));
    const d0 = Math.max(4, Math.hypot(e.clientX - cx, e.clientY - cy)); const a0 = Math.atan2(e.clientY - cy, e.clientX - cx);
    const di = (ev: PointerEvent) => {
      const k = kieu === 'co' ? Math.max(0.1, Math.hypot(ev.clientX - cx, ev.clientY - cy) / d0) : 1;
      let a = kieu === 'xoay' ? ((Math.atan2(ev.clientY - cy, ev.clientX - cx) - a0) * 180) / Math.PI : 0;
      if (ev.shiftKey) a = Math.round(a / 15) * 15;
      const p = bienDoiNhom(truoc, tamX, tamY, k, a, rong, cao); for (const id of Object.keys(p)) onDoi(id, p[id]!);
    };
    const xong = () => { el.removeEventListener('pointermove', di); el.removeEventListener('pointerup', xong); el.removeEventListener('pointercancel', xong); };
    el.addEventListener('pointermove', di); el.addEventListener('pointerup', xong); el.addEventListener('pointercancel', xong);
  };
  const nhom = ds.every((l) => l.nhom && l.nhom === ds[0]!.nhom);
  return (
    <div style={{ position: 'absolute', left: hop.x, top: hop.y, width: hop.w, height: hop.h, outline: `1.5px ${nhom ? 'solid' : 'dashed'} var(--cyan)`, outlineOffset: 3, pointerEvents: 'none', zIndex: 20 }}>
      <span style={{ position: 'absolute', left: 0, top: -17, fontSize: 10, color: 'var(--cyan)', whiteSpace: 'nowrap', textShadow: '0 1px 2px #000' }}>{nhom ? `⛓ nhóm ${ds.length} lớp` : `${ds.length} lớp`}</span>
      <div onPointerDown={keo('co')} title="Kéo để đổi cỡ cả vùng chọn" style={{ position: 'absolute', right: -7, bottom: -7, width: 9, height: 9, background: 'var(--cyan)', border: '1px solid #000', borderRadius: 2, cursor: 'nwse-resize', pointerEvents: 'auto' }} />
      <div style={{ position: 'absolute', left: '50%', top: -20, width: 1, height: 14, background: 'var(--cyan)' }} />
      <div onPointerDown={keo('xoay')} title="Kéo để xoay cả vùng chọn · giữ Shift = nấc 15°" style={{ position: 'absolute', left: 'calc(50% - 6px)', top: -30, width: 12, height: 12, borderRadius: '50%', background: 'var(--cyan)', border: '1px solid #000', cursor: 'grab', pointerEvents: 'auto' }} />
    </div>
  );
}

/** Bảng thuộc tính khi chọn nhiều lớp: gộp / bỏ nhóm / xoá — cùng phím tắt ⌘G · ⇧⌘G · Del. */
export function LopNhieu({ ds, onGop, onBoNhom, onXoa, onDong }: { ds: Lop[]; onGop: () => void; onBoNhom: () => void; onXoa: () => void; onDong: () => void }) {
  const nhom = ds.every((l) => l.nhom && l.nhom === ds[0]!.nhom);
  const nut = (chu: string, title: string, f: () => void) => <button type="button" className="xv-btn" style={{ padding: '0 6px', lineHeight: '20px' }} title={title} onClick={f}>{chu}</button>;
  return (
    <div style={{ display: 'grid', gap: 6, textAlign: 'left' }}>
      <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
        <b style={{ fontSize: 12, flex: 1 }}>{nhom ? `⛓ Nhóm ${ds.length} lớp` : `${ds.length} lớp đang chọn`}</b>{nut('✕', 'Bỏ chọn (Esc)', onDong)}
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {nhom ? nut('Bỏ nhóm', 'Tách nhóm thành từng lớp (⇧⌘G)', onBoNhom) : nut('⛓ Gộp nhóm', 'Gộp thành một đối tượng (⌘G)', onGop)}
        {nut('🗑 Xoá', 'Xoá các lớp đang chọn (Del)', onXoa)}
      </div>
      <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>{ds.map((l) => `${ICON_LOAI[l.loai]} ${tenLop(l)}`).join(' · ')}</div>
      <div style={{ ...mono }}>Kéo một lớp = dời cả vùng chọn · góc khung = đổi cỡ · núm trên = xoay. Shift/⌘ + bấm = thêm/bớt lớp.</div>
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
      <Menu nhan="✦ Hiệu ứng ▾">
        <div style={{ ...mono, padding: '2px 4px' }}>Hiệu ứng khung kiểu CapCut — áp lên video ở giây {t.toFixed(1)}, dài 1s</div>
        {HIEU_UNG.map((h) => <MucMenu key={h.key} onClick={() => onThem([lopMoi('hieu_ung', t, { hu: h.key })])}>{h.ten} <span style={mono}>· {h.mo}</span></MucMenu>)}
      </Menu>
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
  const nut = (chu: string, title: string, f: () => void) => <button type="button" className="xv-btn" style={{ padding: '0 5px', lineHeight: '18px' }} title={title} onClick={f}>{chu}</button>;
  if (l.loai === 'hieu_ung') return (
    <div style={{ display: 'grid', gap: 6, textAlign: 'left' }}>
      <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
        <b style={{ fontSize: 12, flex: 1 }}>{ICON_LOAI[l.loai]} {tenLop(l)}</b>
        {nut('⧉', 'Nhân bản', onNhanBan)}{nut(l.an ? '🙈' : '👁', l.an ? 'Bật lại' : 'Tắt (không xuất)', () => onDoi({ an: !l.an }))}<Xoa gon nhan="hiệu ứng" noiKhoiPhuc="↶ Hoàn tác" onXoa={onXoa} />{nut('✕', 'Đóng', onDong)}
      </div>
      <label style={o}>Hiệu ứng<Chon value={l.hu ?? 'rung'} onChange={(v) => onDoi({ hu: v as Lop['hu'], ten: undefined })} options={HIEU_UNG.map((h) => ({ value: h.key, label: h.ten, title: h.mo }))} minWidth={200} /></label>
      <label style={o}>Cường độ {Math.round((l.cuong ?? 0.6) * 100)}%<input type="range" min={0.05} max={1} step={0.05} value={l.cuong ?? 0.6} onChange={(e) => onDoi({ cuong: Number(e.target.value) })} /></label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, alignItems: 'end' }}>
        <label style={o}>Vào (s)<span style={{ display: 'flex', gap: 2 }}><input className="xv-in" type="number" step={0.1} min={0} value={l.tu} onChange={(e) => onDoi({ tu: Number(e.target.value) })} style={{ width: '100%', minWidth: 0 }} />{nut('▸', 'Lấy giây đang đứng', () => onDoi({ tu: lam(t, 2), den: Math.max(lam(t, 2) + 0.2, l.den) }))}</span></label>
        <label style={o}>Ra (s)<span style={{ display: 'flex', gap: 2 }}><input className="xv-in" type="number" step={0.1} min={0} value={l.den} onChange={(e) => onDoi({ den: Number(e.target.value) })} style={{ width: '100%', minWidth: 0 }} />{nut('▸', 'Lấy giây đang đứng', () => onDoi({ den: Math.max(l.tu + 0.2, lam(t, 2)) }))}</span></label>
      </div>
      <div style={mono}>Áp lên video + lớp ảnh bên dưới, chữ vẫn nằm trên. Bấm ▶ để xem hiệu ứng chạy.</div>
    </div>
  );
  return (
    <div style={{ display: 'grid', gap: 6, textAlign: 'left' }}
      title="Kéo lớp trên khung để dời · kéo ô xanh ở góc để đổi cỡ · kéo khối trên làn 🧩 để đổi giờ. Tự lưu, ↶ Hoàn tác ở đầu trang.">
      <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
        <b style={{ fontSize: 12, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ICON_LOAI[l.loai]} {tenLop(l)}</b>
        {nut('⧉', 'Nhân bản', onNhanBan)}{nut(l.an ? '🙈' : '👁', l.an ? 'Hiện lại' : 'Ẩn (không xuất)', () => onDoi({ an: !l.an }))}<Xoa gon nhan="lớp" noiKhoiPhuc="↶ Hoàn tác" onXoa={onXoa} />{nut('✕', 'Đóng', onDong)}
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
          <label style={o}>Hiệu ứng vào<select className="xv-in" value={l.vao} onChange={(e) => onDoi({ vao: e.target.value as Lop['vao'] })}><option value="khong">Không</option><option value="mo">Hiện dần</option><option value="pop">Bật ra</option><option value="truot">Trượt lên</option>{l.loai === 'chu' && <><option value="nay">Nảy</option><option value="go_chu">Gõ chữ</option></>}</select></label>
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
export function KhoiLop({ l, pps, chon, cung, onChon, onDoi }: { l: Lop; pps: number; chon: boolean;
  /** các lớp dời giờ CÙNG khi kéo thân (vùng chọn / nhóm có lớp này) */ cung: Lop[]; onChon: (them: boolean) => void; onDoi: (id: string, p: Partial<Lop>) => void }) {
  const keo = (kieu: 'than' | 'trai' | 'phai') => (e: PE<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
    if (e.shiftKey || e.metaKey || e.ctrlKey) { onChon(true); return; }
    if (!chon) onChon(false);
    const el = e.currentTarget; el.setPointerCapture(e.pointerId);
    const x0 = e.clientX; const tu0 = l.tu, den0 = l.den; const goc = (cung.length ? cung : [l]).map((x) => ({ id: x.id, tu: x.tu, den: x.den }));
    const tuMin = Math.min(...goc.map((x) => x.tu));
    const di = (ev: PointerEvent) => {
      const d = lam((ev.clientX - x0) / pps, 2);
      if (kieu === 'than') { const dd = Math.max(-tuMin, d); for (const g of goc) onDoi(g.id, { tu: lam(g.tu + dd, 2), den: lam(g.den + dd, 2) }); }
      else if (kieu === 'trai') onDoi(l.id, { tu: lam(Math.max(0, Math.min(den0 - 0.2, tu0 + d)), 2) });
      else onDoi(l.id, { den: lam(Math.max(tu0 + 0.2, den0 + d), 2) });
    };
    const xong = () => { el.removeEventListener('pointermove', di); el.removeEventListener('pointerup', xong); el.removeEventListener('pointercancel', xong); };
    el.addEventListener('pointermove', di); el.addEventListener('pointerup', xong); el.addEventListener('pointercancel', xong);
  };
  return (
    <div onPointerDown={keo('than')} data-goi-y={`${tenLop(l)}\nvào ${l.tu}s · ra ${l.den}s\nkéo để dời · kéo mép để đổi giờ`}
      style={{ position: 'absolute', left: l.tu * pps, width: Math.max(6, (l.den - l.tu) * pps), top: 2, bottom: 2, borderRadius: 4, cursor: 'grab', touchAction: 'none', opacity: l.an ? 0.4 : 1,
        background: 'var(--bg-2)', border: `1px solid ${chon ? 'var(--cyan)' : 'var(--line)'}`, outline: chon ? '1px solid var(--cyan)' : undefined, color: chon ? 'var(--fg-1)' : 'var(--fg-2)', fontSize: 10, lineHeight: '14px', padding: '0 8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
      <div onPointerDown={keo('trai')} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, cursor: 'ew-resize' }} />
      {l.nhom ? '⛓ ' : ''}{ICON_LOAI[l.loai]} {tenLop(l)}
      <div onPointerDown={keo('phai')} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 6, cursor: 'ew-resize' }} />
    </div>
  );
}
