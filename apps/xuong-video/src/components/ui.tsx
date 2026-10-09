'use client';
// Khối giao diện nhỏ của studio (không mượn primitive của mos2 — app riêng) + kiểu dùng chung giữa các màn.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { tien } from '@/lib/xuong-video/kieu';
import { useViTriNoi } from './vi-tri-noi';
import { useXacNhanTien } from './xac-nhan-tien';

export type Khoa = { google: boolean; anthropic: boolean; r2: boolean; openai: boolean; fal: boolean };

/** Drawer phim chia tab (audit 09/10/2026: một cuộn dài 0→1→2→3→timeline không vừa một màn): kịch bản · storyboard & timeline · âm thanh · xuất. */
export type TabPhim = 'kich_ban' | 'storyboard' | 'am_thanh' | 'xuat';

export const TAB_PHIM: { key: TabPhim; label: string; mo: string }[] = [
  { key: 'kich_ban', label: '📝 Kịch bản', mo: 'Mục 0 sản phẩm · 1 kinh thánh · 2 tuyến nhân vật · 3a brief · 3b kịch bản → tách cảnh' },
  { key: 'storyboard', label: '🎞 Storyboard & Timeline', mo: 'Keyframe → duyệt → video, kéo thả, cắt giây phát, chữ màn, bộ kiểm' },
  { key: 'am_thanh', label: '🔊 Âm thanh', mo: 'Giọng nhân vật, hiệu ứng, nhạc theo phân cảnh' },
  { key: 'xuat', label: '⬇ Xuất', mo: 'Bộ kiểm đạt chưa · dựng MP4 theo nhánh hook · chi phí' },
];

export type KqChay = { ok: boolean; loi?: string } | void;

// ── Khối giao diện nhỏ của app (không mượn primitive của mos2 — app riêng) ─────────────────────────────────────────

// Nhãn một dòng (cắt bằng … , đủ chữ khi rê) → các ô cùng hàng luôn thẳng nhau, không ô nào bị nhãn hai dòng đẩy xuống (#1220).
export function O({ label, hint, children, span }: { label?: ReactNode; hint?: ReactNode; children: ReactNode; span?: boolean }) {
  return <div className="xv-field" style={span ? { gridColumn: '1 / -1' } : undefined}>{label && <label className="xv-lbl" title={typeof label === 'string' ? label : undefined}>{label}</label>}{children}{hint && <div className="xv-hint">{hint}</div>}</div>;
}

export function Pill({ color, children }: { color: string; children: ReactNode }) { return <span className="xv-pill" style={{ color }}>{children}</span>; }

export function Seg<T extends string | number>({ options, value, onChange }: { options: { value: T; label: string; title?: string }[]; value: T; onChange: (v: T) => void }) {
  return <span className="xv-seg">{options.map((o) => <button key={String(o.value)} type="button" title={o.title} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>{o.label}</button>)}</span>;
}

/** Nút bị gate: `ly` có chữ = khoá + hiện lý do khi rê chuột (không im lặng vô hiệu). */
/** gia (cents): lượt sinh trên ngưỡng ($0.5) phải bấm lại lần hai ngay tại nút (#1214). */
export function Nut({ ly, ban, chinh, nguy, title, onClick, children, gia }: { ly?: string | false | null; ban?: boolean; chinh?: boolean; nguy?: boolean; title?: string; onClick: () => void; children: ReactNode; gia?: number }) {
  const why = ly ? String(ly) : '';
  const xn = useXacNhanTien(gia);
  return <button type="button" className={`xv-btn${chinh ? ' chinh' : ''}${nguy || xn.dangHoi ? ' nguy' : ''}`} disabled={!!why || ban} title={why || title} onClick={() => xn.bam(onClick)}>{xn.dangHoi ? `⚠ ${tien(gia ?? 0)} — bấm lại để xác nhận` : children}</button>;
}

/** Bỏ vào thùng rác hai nhịp: bấm lần một = cảnh báo, bấm lần hai trong 4s = chuyển vào thùng rác (khôi phục được, #1192). */
export function Xoa({ nhan, onXoa, ban }: { nhan: string; onXoa: () => Promise<void>; ban?: boolean }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 4000); return () => clearTimeout(t); }, [armed]);
  return <button type="button" className="xv-btn nguy" disabled={ban} title={`Chuyển ${nhan} vào thùng rác — khôi phục được ở nút 🗑 Thùng rác`} onClick={() => { if (armed) { setArmed(false); void onXoa(); } else setArmed(true); }}>{armed ? `⚠ bấm lại để bỏ ${nhan} vào thùng rác` : '🗑'}</button>;
}

export function Loi({ children }: { children: ReactNode }) { return children ? <div className="xv-loi">{children}</div> : null; }

/** Ảnh nhỏ có nút ✕ xoá (hiện khi rê chuột, hỏi lại trước khi xoá). Dùng cho ảnh gốc, ảnh biến thể, ứng viên keyframe. */
export function AnhNho({ url, kich = 40, vien, nhan, title, onClick, onXoa, soSanh }: { url: string; kich?: number; vien?: string; nhan?: string; title?: string; onClick?: () => void; onXoa?: () => void | Promise<void>; soSanh?: string }) {
  return (
    <span className="xv-anh-nho" title={title} style={{ position: 'relative', display: 'inline-block', flexShrink: 0 }}>
      <img src={url} alt="" onClick={onClick} data-so-sanh={soSanh} style={{ width: kich, height: kich, objectFit: 'cover', borderRadius: 5, display: 'block', cursor: onClick ? 'pointer' : 'default', border: `2px solid ${vien ?? 'transparent'}` }} />
      {nhan && <span style={{ position: 'absolute', left: 3, bottom: 2, fontSize: 8.5, color: '#fff', textShadow: '0 1px 2px #000', pointerEvents: 'none' }}>{nhan}</span>}
      {onXoa && <button type="button" className="xv-x" title="Bỏ ảnh vào thùng rác (khôi phục được)" onClick={(e) => { e.stopPropagation(); if (window.confirm('Bỏ ảnh này vào thùng rác? Khôi phục được ở nút 🗑 Thùng rác.')) void onXoa(); }}>✕</button>}
    </span>
  );
}

/** Lớp phủ "đang sinh" có sọc chạy — dùng chung cho thẻ anchor, biến thể, cảnh, clip timeline. */
export function DangSinh({ chu = 'đang sinh' }: { chu?: string }) {
  return <div className="xv-dang"><span>⏳ {chu}</span></div>;
}

/** Một nhóm nút cùng việc (vd 🖼 Ảnh: model + sinh + duyệt) — viền mảnh + nhãn nhỏ để các nhóm tách nhau rõ (#1245). */
export function NhomNut({ nhan, children }: { nhan: string; children: ReactNode }) {
  return <div className="xv-nhom-nut"><span className="xv-nhom-nut-nhan">{nhan}</span>{children}</div>;
}
/** Chữ phụ (mono, nhỏ, xám) — một định nghĩa cho mọi màn studio. */
export const mono: CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--fg-3)' };

/** Menu "⋯" gom thao tác phụ (YDNI: mặt ngoài chỉ giữ việc kế tiếp). */
export function Menu({ children, nhan = '⋯' }: { children: ReactNode; nhan?: string }) {
  const [mo, setMo] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const viTri = useViTriNoi(ref, mo, { rong: 420, canPhai: true, caoToiDa: 560 });
  useEffect(() => {
    if (!mo) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setMo(false); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, [mo]);
  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" className="xv-btn" onClick={() => setMo(!mo)} title="Thêm thao tác">{nhan}</button>
      {mo && <div onClick={(e) => { if ((e.target as HTMLElement).closest('[data-dong]')) setMo(false); }} style={{ ...viTri, background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 8, boxShadow: '0 10px 30px rgba(0,0,0,.5)', padding: 6, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 4, alignContent: 'start', overflowX: 'hidden' }}>{children}</div>}
    </span>
  );
}

export function MucMenu({ onClick, children, ly, nguy, gia }: { onClick: () => void; children: ReactNode; ly?: string | false | null; nguy?: boolean; gia?: number }) {
  const xn = useXacNhanTien(gia);
  // Đang hỏi xác nhận thì KHÔNG mang data-dong — menu không đóng ở lần bấm đầu.
  return <button type="button" {...(xn.canHoi && !xn.dangHoi ? {} : { 'data-dong': '' })} disabled={!!ly} title={ly || undefined} onClick={() => xn.bam(onClick)} className="xv-btn" style={{ textAlign: 'left', whiteSpace: 'normal', color: nguy || xn.dangHoi ? 'var(--red)' : undefined, opacity: ly ? 0.5 : 1 }}>{xn.dangHoi ? `⚠ ${tien(gia ?? 0)} — bấm lại để xác nhận` : children}</button>;
}
