'use client';
// Khối giao diện nhỏ của studio (không mượn primitive của mos2 — app riêng) + kiểu dùng chung giữa các màn.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { tien } from '@/lib/xuong-video/kieu';
import { useViTriNoi } from './vi-tri-noi';
import { useXacNhanTien } from './xac-nhan-tien';
import { anhNho, nacNho } from '@/lib/xuong-video/anh-nho';

export type Khoa = { google: boolean; anthropic: boolean; r2: boolean; openai: boolean; fal: boolean; /** cổng giá rẻ (cong-ai.ts) */ ckey?: boolean; shopaikey?: boolean };

/** Drawer phim chia tab (audit 09/10/2026: một cuộn dài 0→1→2→3→timeline không vừa một màn): kịch bản · storyboard & timeline · âm thanh · xuất. */
export type TabPhim = 'phim' | 'so_do' | 'kich_ban' | 'thanh_phan' | 'ho_so' | 'storyboard' | 'am_thanh' | 'xuat';

/** Khâu của một tập — nút con dưới tập trên CÂY PHIM (cay-phim.tsx); 'phim' / 'so_do' giữ cho link cũ. Không còn thanh tab (anh 31/10/2026). */

export type KqChay = { ok: boolean; loi?: string } | void;
/** Gọi một server action từ nút: trả { loi: câu lỗi ('' = được), kq }. Ném (mạng rớt / studio vừa cập nhật, action cũ không còn) → câu bảo
 *  tải lại. MỘT chỗ cho mọi nút — trước đây chép 5 bản (tap, nhan-vat, poster, kiểm người xem ×2), lệch câu chữ dần. */
export async function goiAction<R extends KqChay>(fn: () => Promise<R>): Promise<{ loi: string; kq: R | null }> {
  try { const kq = await fn(); return { loi: kq && !kq.ok ? (kq.loi ?? 'lỗi') : '', kq }; }
  catch (e) { return { loi: `Không gọi được máy chủ (${e instanceof Error ? e.message.slice(0, 80) : 'lỗi mạng'}) — studio vừa cập nhật thì bấm ↻ Tải lại.`, kq: null }; }
}

// ── Khối giao diện nhỏ của app (không mượn primitive của mos2 — app riêng) ─────────────────────────────────────────

// Nhãn một dòng (cắt bằng … , đủ chữ khi rê) → các ô cùng hàng luôn thẳng nhau, không ô nào bị nhãn hai dòng đẩy xuống (#1220).
export function O({ label, hint, children, span }: { label?: ReactNode; hint?: ReactNode; children: ReactNode; span?: boolean }) {
  return <div className="xv-field" style={span ? { gridColumn: '1 / -1' } : undefined}>{label && <label className="xv-lbl" title={typeof label === 'string' ? label : undefined}>{label}</label>}{children}{hint && <div className="xv-hint">{hint}</div>}</div>;
}

/** nhat = trạng thái "chưa có / trống": viền gạch, chữ mờ (kho template: khuôn chưa có template) — một tham số, không đẻ chip thứ hai. */
export function Pill({ color, nhat, children, title }: { color: string; nhat?: boolean; children: ReactNode; title?: string }) { return <span className="xv-pill" title={title} style={{ color, ...(nhat ? { borderStyle: 'dashed', opacity: 0.55 } : {}) }}>{children}</span>; }

export function Seg<T extends string | number>({ options, value, onChange }: { options: { value: T; label: string; title?: string }[]; value: T; onChange: (v: T) => void }) {
  return <span className="xv-seg">{options.map((o) => <button key={String(o.value)} type="button" title={o.title} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>{o.label}</button>)}</span>;
}

/** Nút bị gate: `ly` có chữ = khoá + hiện lý do khi rê chuột (không im lặng vô hiệu). */
/** gia (cents): lượt sinh trên ngưỡng ($0.5) phải bấm lại lần hai ngay tại nút (#1214). */
/** Link RA NGOÀI app (spy.on.tc, trang bán, nguồn tham khảo…): mở tab mới, không mang referrer. Luật "không mở tab mới" (khong-tab-moi.mjs) là cho
 *  điều hướng TRONG studio (dùng ngăn); ra app khác mà thay trang đang làm thì mất ngăn đang mở (anh 15/10/2026: "link sang spy phải mở tab mới").
 *  Mọi link ngoài đi qua đây — máy kiểm (khong-tab-moi.mjs) chỉ cho mở tab mới ở đúng dòng đánh dấu LinkNgoai bên dưới. */
export function LinkNgoai({ href, title, className, style, children }: { href: string; title?: string; className?: string; style?: CSSProperties; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" title={title} className={className} style={style}>{children}</a>;   // LinkNgoai
}

export function Nut({ ly, ban, chinh, nguy, title, onClick, children, gia }: { ly?: string | false | null; ban?: boolean; chinh?: boolean; nguy?: boolean; title?: string; onClick: () => void; children: ReactNode; gia?: number }) {
  const why = ly ? String(ly) : '';
  const xn = useXacNhanTien(gia);
  return <button type="button" className={`xv-btn${chinh ? ' chinh' : ''}${nguy || xn.dangHoi ? ' nguy' : ''}`} disabled={!!why || ban} title={why || title} onClick={() => xn.bam(onClick)}>{xn.dangHoi ? `⚠ ${tien(gia ?? 0)} — bấm lại để xác nhận` : children}</button>;
}

/** Bỏ vào thùng rác hai nhịp: bấm lần một = cảnh báo, bấm lần hai trong 4s = chuyển vào thùng rác (khôi phục được, #1192). */
/** noiKhoiPhuc: chỗ lấy lại sau khi bỏ (mặc định thùng rác; lớp phủ = ↶ Hoàn tác). gon: chỉ icon 🗑 nhỏ (bảng thuộc tính). */
export function Xoa({ nhan, onXoa, ban, noiKhoiPhuc = 'nút 🗑 Thùng rác', gon }: { nhan: string; onXoa: () => Promise<void> | void; ban?: boolean; noiKhoiPhuc?: string; gon?: boolean }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 4000); return () => clearTimeout(t); }, [armed]);
  return <button type="button" className="xv-btn nguy" disabled={ban} style={gon ? { padding: '0 5px', lineHeight: '18px' } : undefined} title={`Bỏ ${nhan} — lấy lại được ở ${noiKhoiPhuc}`} onClick={() => { if (armed) { setArmed(false); void onXoa(); } else setArmed(true); }}>{armed ? `⚠ bấm lại để bỏ ${nhan}` : '🗑'}</button>;
}

/** Đèn trạng thái (YDNI: trạng thái là DẤU HIỆU, chữ nằm ở hover): ok xanh · cho cam (chờ / còn treo) · loi đỏ · tat xám. */
export function Den({ muc, title }: { muc: 'ok' | 'cho' | 'loi' | 'tat'; title?: string }) { return <span className="xv-den" data-muc={muc} title={title} aria-label={title} />; }

export function Loi({ children }: { children: ReactNode }) { return children ? <div className="xv-loi">{children}</div> : null; }

/** Ảnh nhỏ có nút ⋯ (hiện khi rê chuột) mở menu thao tác. Bấm ẢNH chỉ để XEM (onClick) — mọi thao tác đổi dữ liệu (đặt làm chính, chọn keyframe)
 *  đi vào `menu` (các <MucMenu>), xoá luôn là mục cuối; không có đổi dữ liệu nào bằng một cú bấm vào ảnh (anh 31/10/2026). */
export function AnhNho({ url, kich = 40, vien, nhan, title, onClick, onXoa, soSanh, menu }: { url: string; kich?: number; vien?: string; nhan?: string; title?: string; onClick?: () => void; onXoa?: () => void | Promise<void>; soSanh?: string; menu?: ReactNode }) {
  return (
    <span className="xv-anh-nho" title={title} style={{ position: 'relative', display: 'inline-block', flexShrink: 0 }}>
      <img src={anhNho(url, nacNho(kich))} alt="" onClick={onClick} data-so-sanh={soSanh} style={{ width: kich, height: kich, objectFit: 'cover', borderRadius: 5, display: 'block', cursor: onClick ? 'pointer' : 'default', border: `2px solid ${vien ?? 'transparent'}` }} />
      {nhan && <span style={{ position: 'absolute', left: 3, bottom: 2, fontSize: 8.5, color: '#fff', textShadow: '0 1px 2px #000', pointerEvents: 'none' }}>{nhan}</span>}
      {(onXoa || menu) && <Menu lop="xv-x" nutLop="xv-x-nut" rong={170}>
        {menu}
        {onXoa && <MucMenu nguy goiY="Bỏ vào thùng rác — lấy lại được ở nút 🗑 Thùng rác" onClick={() => void onXoa()}>🗑 Xoá ảnh</MucMenu>}
      </Menu>}
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
/** lop/nutLop: lớp riêng cho khung + nút (vd nút ⋯ nhỏ góc ảnh); rong: bề rộng menu. */
export function Menu({ children, nhan = '⋯', lop, nutLop, rong = 420 }: { children: ReactNode; nhan?: string; lop?: string; nutLop?: string; rong?: number }) {
  const [mo, setMo] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const viTri = useViTriNoi(ref, mo, { rong, caoToiDa: 560 });
  useEffect(() => {
    if (!mo) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setMo(false); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, [mo]);
  return (
    <span ref={ref} className={lop} data-mo={mo ? '' : undefined} style={lop ? undefined : { position: 'relative', display: 'inline-block' }}>
      <button type="button" className={nutLop ?? 'xv-btn'} onClick={(e) => { e.stopPropagation(); setMo(!mo); }} title="Thêm thao tác">{nhan}</button>
      {mo && <div onClick={(e) => { if ((e.target as HTMLElement).closest('[data-dong]')) setMo(false); }} style={{ ...viTri, background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 8, boxShadow: '0 10px 30px rgba(0,0,0,.5)', padding: 6, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 4, alignContent: 'start', overflowX: 'hidden' }}>{children}</div>}
    </span>
  );
}

/** goiY: chữ rê chuột giải thích mục (giữ nhãn mục ngắn). nguy: thao tác phá hoại → xác nhận TẠI CHỖ hai nhịp như <Xoa> (bấm lần một = "⚠ bấm lại",
 *  lần hai trong 4 giây mới chạy; ui-conventions §3 — cấm confirm() của trình duyệt, cấm xoá một chạm). */
export function MucMenu({ onClick, children, ly, nguy, gia, goiY }: { onClick: () => void; children: ReactNode; ly?: string | false | null; nguy?: boolean; gia?: number; goiY?: string }) {
  const xn = useXacNhanTien(gia);
  const [hoiNguy, setHoiNguy] = useState(false);
  useEffect(() => { if (!hoiNguy) return; const t = setTimeout(() => setHoiNguy(false), 4000); return () => clearTimeout(t); }, [hoiNguy]);
  const bam = () => { if (nguy && !hoiNguy) { setHoiNguy(true); return; } setHoiNguy(false); xn.bam(onClick); };
  const dangHoi = hoiNguy || xn.dangHoi;
  // Lần bấm sẽ còn hỏi tiếp (nguy chưa hỏi / tiền chưa hỏi) thì KHÔNG mang data-dong — menu không đóng ở lần bấm đầu.
  const conHoi = (nguy && !hoiNguy) || (xn.canHoi && !xn.dangHoi);
  return <button type="button" {...(conHoi ? {} : { 'data-dong': '' })} disabled={!!ly} title={ly || goiY || undefined} onClick={bam} className="xv-btn" style={{ textAlign: 'left', whiteSpace: 'normal', color: nguy || dangHoi ? 'var(--red)' : undefined, opacity: ly ? 0.5 : 1 }}>{xn.dangHoi ? `⚠ ${tien(gia ?? 0)} — bấm lại để xác nhận` : hoiNguy ? '⚠ Bấm lại để xác nhận' : children}</button>;
}
