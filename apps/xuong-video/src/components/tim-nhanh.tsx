'use client';
// 🔎 TÌM NHANH (anh 17/10/2026: "có nhiều chức năng rồi — thêm search nhanh trên màn hình hiện tại; muốn xem Sổ liền mạch thì bấm vào hiện ra
// drawer của sổ này, đóng thì không ảnh hưởng các drawer đang mở"). ⌘K / Ctrl+K hoặc nút 🔎 trên đầu trang → gõ (không cần dấu) → Enter / bấm =
// mở ngăn CHỒNG lên (ngan-chung.tsx — chồng ngăn trên URL, đóng chỉ đóng tầng đó). Mục theo tập / phim đang xem lấy từ ngu-canh.ts.
// Nguồn mục: các sổ / ngăn chung + MỌI luật dựng (luat-dung.ts) + MỌI kỹ thuật điện ảnh (dien-anh.ts) — thêm ngăn mới thì thêm một dòng ở SO_NGAN.
import { useEffect, useMemo, useRef, useState } from 'react';
import { moNgan, type YeuCauNgan } from './ngan-chung';
import { nguCanh, ngheNguCanh, type NguCanh } from '@/lib/ngu-canh';
import { LUAT_DUNG_CANH } from '@/lib/xuong-video/luat-dung';
import { THU_VIEN, NHOM_KY_THUAT } from '@/lib/xuong-video/dien-anh';

const SU_KIEN = 'xv-tim-nhanh';
export const moTimNhanh = () => window.dispatchEvent(new Event(SU_KIEN));
type Muc = { ic: string; ten: string; mo: string; nhom: string; tu?: string; y: YeuCauNgan | null; can?: string };

/** Sổ / ngăn chung: y(n) = yêu cầu mở theo ngữ cảnh; null = thiếu ngữ cảnh (can = cần mở gì trước). */
const SO_NGAN: { ic: string; ten: string; mo: string; tu: string; y: (n: NguCanh | null) => YeuCauNgan | null; can?: string }[] = [
  { ic: '📒', ten: 'Sổ liền mạch', mo: 'script supervisor: chỗ / dáng / hướng / trạng thái / trang phục / đồ cầm từng shot, điểm liền mạch, bảng bề ngoài theo ngày', tu: 'continuity script supervisor so lien mach trang phuc hookup', y: (n) => (n ? { loai: 'lien-mach', tapId: n.tapId } : null), can: 'mở một tập' },
  { ic: '🧊', ten: 'Bộ set 3D', mo: 'xoay, phóng, nhìn qua máy từng shot, đường đi nhân vật', tu: 'blender 3d set may quay', y: (n) => (n ? { loai: 'bo-set', tapId: n.tapId } : null), can: 'mở một tập' },
  { ic: '⛓', ten: 'Nối khung cả tập', mo: 'sơ đồ nguồn nối khung giữa các shot', tu: 'noi khung keyframe', y: (n) => (n ? { loai: 'noi-khung', tapId: n.tapId } : null), can: 'mở một tập' },
  { ic: '🎬', ten: 'Thư viện điện ảnh', mo: 'kỹ thuật máy, ánh sáng, chuyển cảnh, âm thanh + luật dựng cảnh', tu: 'thu vien ky thuat luat dung', y: () => ({ loai: 'thu-vien' }) },
  { ic: '💰', ten: 'Sổ chi phí', mo: 'tiền AI đã tiêu theo phim / job', tu: 'chi phi tien cost', y: (n) => ({ loai: 'so-chi-phi', ...(n ? { phim: n.phimId } : {}) }) },
  { ic: '🔌', ten: 'Sổ nguồn AI', mo: 'cổng / model / giá thật VNĐ', tu: 'nguon ai model gia fal ckey', y: () => ({ loai: 'nguon-ai' }) },
  { ic: '📦', ten: 'Kho tài sản', mo: 'clip, ảnh, nhạc dùng lại', tu: 'kho tai san asset', y: () => ({ loai: 'kho' }) },
];
const bo = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd').toLowerCase();

export function TimNhanh() {
  const [mo, setMo] = useState(false); const [q, setQ] = useState(''); const [chon, setChon] = useState(0);
  const [nc, setNc] = useState<NguCanh | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const bat = () => { setNc(nguCanh()); setQ(''); setChon(0); setMo(true); };
    const phim = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); bat(); } };
    window.addEventListener(SU_KIEN, bat); window.addEventListener('keydown', phim);
    const bo1 = ngheNguCanh(() => setNc(nguCanh()));
    return () => { window.removeEventListener(SU_KIEN, bat); window.removeEventListener('keydown', phim); bo1(); };
  }, []);
  useEffect(() => { if (mo) setTimeout(() => input.current?.focus(), 0); }, [mo]);
  const tatCa = useMemo<Muc[]>(() => [
    ...SO_NGAN.map((x) => ({ ic: x.ic, ten: x.ten, mo: x.mo, nhom: 'Sổ & ngăn', tu: x.tu, y: x.y(nc), can: x.can })),
    ...LUAT_DUNG_CANH.map((l) => ({ ic: '📐', ten: l.ten, mo: l.luat, nhom: 'Luật dựng', tu: `${l.key} ${l.nganh?.ten_nganh ?? ''}`, y: { loai: 'ky-thuat', ma: `luat.${l.key}` } as YeuCauNgan })),
    ...THU_VIEN.map((k) => ({ ic: NHOM_KY_THUAT.find((g) => g.key === k.nhom)?.icon ?? '🎬', ten: k.ten, mo: k.mo_ta, nhom: NHOM_KY_THUAT.find((g) => g.key === k.nhom)?.ten ?? 'Kỹ thuật', tu: `${k.key} ${k.nganh?.ten_nganh ?? ''}`, y: { loai: 'ky-thuat', ma: `${k.nhom}.${k.key}` } as YeuCauNgan })),
  ], [nc]);
  const ds = useMemo(() => {
    const t = bo(q.trim());
    if (!t) return tatCa.filter((m) => m.nhom === 'Sổ & ngăn');
    const diem = (m: Muc) => { const ten = bo(m.ten); return ten.startsWith(t) ? 0 : ten.includes(t) ? 1 : bo(m.tu ?? '').includes(t) ? 2 : bo(m.mo).includes(t) ? 3 : 9; };
    return tatCa.map((m) => [m, diem(m)] as const).filter(([, d]) => d < 9).sort((a, b) => a[1] - b[1]).slice(0, 40).map(([m]) => m);
  }, [q, tatCa]);
  if (!mo) return null;
  const dong = () => setMo(false);
  const chay = (m: Muc | undefined) => { if (!m?.y) return; moNgan(m.y); dong(); };
  return (
    <div onClick={dong} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.45)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '10vh' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(640px, 94vw)', background: 'var(--bg-1, #111)', border: '1px solid var(--line)', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,.6)', overflow: 'hidden' }}>
        <input ref={input} value={q} placeholder={`Tìm chức năng, sổ, luật, kỹ thuật…${nc ? ` · đang ở tập ${nc.soTap} · ${nc.tenTap}` : ''}`}
          onChange={(e) => { setQ(e.target.value); setChon(0); }}
          onKeyDown={(e) => {
            // Esc / phím điều hướng chỉ cho ô tìm — không lọt ra ngăn đang mở (Esc của ngăn đóng tầng trên cùng)
            if (e.key === 'Escape') { e.stopPropagation(); dong(); }
            else if (e.key === 'ArrowDown') { e.preventDefault(); setChon((c) => Math.min(ds.length - 1, c + 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setChon((c) => Math.max(0, c - 1)); }
            else if (e.key === 'Enter') { e.preventDefault(); chay(ds[chon]); }
          }}
          style={{ width: '100%', boxSizing: 'border-box', padding: '14px 16px', fontSize: 15, border: 'none', borderBottom: '1px solid var(--line)', background: 'transparent', color: 'inherit', outline: 'none' }} />
        <div style={{ maxHeight: '55vh', overflowY: 'auto' }}>
          {!ds.length && <div className="xv-mono" style={{ padding: 14, color: 'var(--fg-4)' }}>Không thấy “{q}”.</div>}
          {ds.map((m, i) => (
            <button key={`${m.nhom}:${m.ten}:${i}`} type="button" disabled={!m.y} onMouseEnter={() => setChon(i)} onClick={() => chay(m)}
              title={m.y ? m.mo : `Cần ${m.can} trước`}
              style={{ all: 'unset', boxSizing: 'border-box', width: '100%', display: 'grid', gridTemplateColumns: '24px 1fr auto', gap: 10, alignItems: 'baseline', padding: '8px 14px', cursor: m.y ? 'pointer' : 'not-allowed', opacity: m.y ? 1 : 0.45, background: i === chon ? 'var(--bg-3, rgba(255,255,255,.07))' : undefined }}>
              <span>{m.ic}</span>
              <span style={{ minWidth: 0 }}><b style={{ fontSize: 13.5 }}>{m.ten}</b>
                <span style={{ display: 'block', fontSize: 11.5, color: 'var(--fg-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.y ? m.mo : `cần ${m.can} trước`}</span></span>
              <span className="xv-mono" style={{ fontSize: 10.5, color: 'var(--fg-4)' }}>{m.nhom}</span>
            </button>
          ))}
        </div>
        <div className="xv-mono" style={{ padding: '6px 14px', fontSize: 10.5, color: 'var(--fg-4)', borderTop: '1px solid var(--line)' }}>↑↓ chọn · Enter mở (chồng lên, không đóng ngăn đang mở) · Esc đóng · ⌘K / Ctrl+K mở lại</div>
      </div>
    </div>
  );
}

/** Nút 🔎 NỔI, LUÔN HIỆN (anh 17/10/2026 "nút đó phải luôn hiện"): góc trái dưới (góc phải dưới là hòm góp ý), nằm TRÊN mọi ngăn kéo
 *  (ngăn chồng z 51–6x) — đang mở bao nhiêu tầng, cuộn tới đâu vẫn bấm được. Dưới hộp tìm (z 200). */
export function NutTimNhanh() {
  return <button type="button" onClick={moTimNhanh} title="Tìm nhanh chức năng, sổ, luật, kỹ thuật (⌘K / Ctrl+K) — mở ngăn chồng lên, không đóng ngăn đang mở"
    style={{ position: 'fixed', left: 16, bottom: 16, zIndex: 150, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 999, border: '1px solid var(--line)', background: 'var(--bg-2, #1b1b1b)', color: 'inherit', cursor: 'pointer', boxShadow: '0 6px 20px rgba(0,0,0,.45)', fontSize: 13 }}>
    🔎 <span className="xv-mono" style={{ fontSize: 11, opacity: 0.75 }}>⌘K</span>
  </button>;
}
