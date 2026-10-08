'use client';

// Timeline kiểu CapCut cho một tập: màn xem trước ở trên, các track ở dưới chạy chung một thước giây.
//   Hình   — mỗi cảnh một clip, dài đúng số giây; dải ảnh keyframe/clip; kéo mép phải đổi số giây, kéo thả clip đổi thứ tự.
//   Thoại  — lời thoại từng cảnh, màu theo nhân vật nói; có file giọng (thoai_url) thì phát file, chưa có thì đọc thử bằng giọng máy.
//   Âm thanh — hiệu ứng/âm nền từng cảnh (am_thanh / am_thanh_url).
//   Nhạc   — nhạc nền cả tập (nhac_url / nhac_mo_ta).
// Nét đứt = mới có mô tả trong kịch bản, chưa sinh file. Toàn bộ chạy ở trình duyệt, không tốn tiền.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as PE, type ReactNode } from 'react';
import type { Canh, NhanVat, Tap } from '@/lib/xuong-video/kieu';

const MAU_NV = ['#22d3ee', '#a78bfa', '#f472b6', '#facc15', '#4ade80', '#fb923c', '#60a5fa'];
const NHAN_W = 74;
const mono: CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--fg-3)' };
const dongHo = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${(s % 60).toFixed(1).padStart(4, '0')}`;

/** Ai nói câu thoại: "Lio: ..." → Lio; không ghi thì lấy nhân vật đầu tiên của cảnh. */
function nguoiNoi(c: Canh, nv: NhanVat[]): NhanVat | null {
  const m = c.loi_thoai.match(/^\s*([^:"“]{1,40}?)\s*:/);
  if (m) { const ten = m[1]!.toLowerCase(); const v = nv.find((x) => x.ten.toLowerCase() === ten) ?? nv.find((x) => ten.includes(x.ten.toLowerCase())); if (v) return v; }
  return nv.find((x) => x.loai === 'nhan_vat' && c.nhan_vat.includes(x.id)) ?? null;
}

export function Timeline({ canh, nhanVat, tap, tiLe, ngonNgu, chon, onChon, onDoiGiay, onXep, onToanManHinh }: {
  canh: Canh[]; nhanVat: NhanVat[]; tap: Tap; tiLe: string; ngonNgu: string; chon: number | null;
  onChon: (id: number) => void; onDoiGiay: (id: number, giay: number) => void; onXep: (ids: number[]) => void; onToanManHinh: () => void;
}) {
  // Số giây tạm khi đang kéo mép clip (chưa ghi) — timeline co giãn theo tay ngay.
  const [giayTam, setGiayTam] = useState<Record<number, number>>({});
  const dur = (c: Canh) => giayTam[c.id] ?? (c.thoi_luong_s || 4);
  const batDau = useMemo(() => { let a = 0; return canh.map((c) => { const s = a; a += dur(c); return s; }); }, [canh, giayTam]); // eslint-disable-line react-hooks/exhaustive-deps
  const tong = canh.reduce((a, c) => a + dur(c), 0);

  const [t, setT] = useState(0);
  const [chay, setChay] = useState(false);
  const [docThu, setDocThu] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [rong, setRong] = useState(800);
  const vungRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = vungRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setRong(el.clientWidth)); ro.observe(el); setRong(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const pps = Math.max(12, ((rong - NHAN_W - 16) / Math.max(tong, 1)) * zoom);   // pixel mỗi giây: vừa khít bề ngang × zoom

  const idx = Math.max(0, batDau.reduce((k, s, i) => (s <= t + 1e-6 ? i : k), 0));
  const c = canh[idx];
  const tTrong = c ? t - batDau[idx]! : 0;

  // Đồng hồ phát: requestAnimationFrame đẩy t, hết tập thì dừng.
  useEffect(() => {
    if (!chay) return;
    let raf = 0; let truoc = performance.now();
    const buoc = (bay: number) => {
      const dt = (bay - truoc) / 1000; truoc = bay;
      setT((x) => { const y = x + dt; if (y >= tong) { setChay(false); return tong; } return y; });
      raf = requestAnimationFrame(buoc);
    };
    raf = requestAnimationFrame(buoc);
    return () => cancelAnimationFrame(raf);
  }, [chay, tong]);

  // Video + file âm thanh bám theo t: đổi cảnh hoặc tua thì đặt lại currentTime; dừng thì pause.
  const vidRef = useRef<HTMLVideoElement>(null);
  const thoaiRef = useRef<HTMLAudioElement>(null);
  const sfxRef = useRef<HTMLAudioElement>(null);
  const nhacRef = useRef<HTMLAudioElement>(null);
  const tuaRef = useRef(0);   // tăng mỗi lần người dùng tua → ép đồng bộ lại
  const [tua, setTua] = useState(0);
  const dongBo = (el: HTMLMediaElement | null, vt: number, coDuoc: boolean) => {
    if (!el) return;
    if (!coDuoc || vt < 0 || (el.duration && vt > el.duration)) { el.pause(); return; }
    if (Math.abs(el.currentTime - vt) > 0.3) el.currentTime = vt;
    if (chay) void el.play().catch(() => {}); else el.pause();
  };
  useEffect(() => {
    dongBo(vidRef.current, tTrong, true);
    dongBo(thoaiRef.current, tTrong, true);
    dongBo(sfxRef.current, tTrong, true);
    dongBo(nhacRef.current, t, true);
  }, [idx, chay, tua]); // eslint-disable-line react-hooks/exhaustive-deps

  // Chưa có file giọng → đọc thử bằng giọng máy của trình duyệt khi vào cảnh (chỉ để nghe nhịp, không phải giọng thật).
  useEffect(() => {
    if (!chay || !docThu || !c?.loi_thoai || c.thoai_url || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(c.loi_thoai.replace(/^[^:"“]*:\s*/, '').replace(/["“”]/g, ''));
    u.lang = ngonNgu === 'vi' ? 'vi-VN' : 'en-US'; u.rate = 1.05;
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
    return () => window.speechSynthesis.cancel();
  }, [idx, chay, docThu]); // eslint-disable-line react-hooks/exhaustive-deps

  const tuaToi = (giay: number) => { setT(Math.max(0, Math.min(tong, giay))); tuaRef.current++; setTua(tuaRef.current); };
  const tuaTheoChuot = (e: PE<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    tuaToi((e.clientX - r.left + e.currentTarget.scrollLeft) / pps);
  };

  // Phím tắt: Space chạy/dừng, ←/→ lùi/tới 1 cảnh — bỏ qua khi đang gõ trong ô nhập.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tg = e.target as HTMLElement;
      if (tg.closest('input, textarea, select, [contenteditable="true"]') || document.querySelector('.xv-drawer.nho, [data-animatic]')) return;
      if (e.key === ' ') { e.preventDefault(); setChay((x) => { if (!x && t >= tong) setT(0); return !x; }); }
      if (e.key === 'ArrowRight') tuaToi(batDau[Math.min(canh.length - 1, idx + 1)] ?? 0);
      if (e.key === 'ArrowLeft') tuaToi(batDau[Math.max(0, tTrong > 0.5 ? idx : idx - 1)] ?? 0);
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  // Kéo mép phải clip hình → đổi số giây (bước 1s, 1–15s); thả tay mới ghi.
  const keoMep = (cc: Canh) => (e: PE<HTMLDivElement>) => {
    e.stopPropagation(); e.preventDefault();
    const x0 = e.clientX; const g0 = cc.thoi_luong_s || 4; let g = g0;
    const move = (ev: PointerEvent) => { g = Math.max(1, Math.min(15, Math.round(g0 + (ev.clientX - x0) / pps))); setGiayTam((m) => ({ ...m, [cc.id]: g })); };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      if (g !== g0) onDoiGiay(cc.id, g);
      setTimeout(() => setGiayTam((m) => { const n = { ...m }; delete n[cc.id]; return n; }), 1500);
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  const [keo, setKeo] = useState<number | null>(null);
  const [tha, setTha] = useState<number | null>(null);
  const thaVao = (dichId: number) => {
    if (keo == null || keo === dichId) return;
    const ids = canh.map((x) => x.id).filter((x) => x !== keo);
    ids.splice(ids.indexOf(dichId), 0, keo);
    onXep(ids);
  };

  const doc916 = tiLe === '9:16';
  const vid = c ? c.video_cuoi_url || c.video_url : null;
  const p = c ? Math.min(1, tTrong / dur(c)) : 0;
  const kb = idx % 2 === 0 ? `scale(${1 + 0.08 * p}) translate(${-1.5 * p}%, ${-1 * p}%)` : `scale(${1.08 - 0.08 * p}) translate(${1.5 * p}%, 0)`;
  const nv = c ? nguoiNoi(c, nhanVat) : null;
  const mauNv = (v: NhanVat | null) => (v ? MAU_NV[nhanVat.filter((x) => x.loai === 'nhan_vat').findIndex((x) => x.id === v.id) % MAU_NV.length] ?? '#94a3b8' : '#94a3b8');
  const W = tong * pps;

  const track = (nhan: string, mo: string, noiDung: ReactNode, cao = 26) => (
    <div style={{ display: 'flex', alignItems: 'stretch', height: cao, marginTop: 3 }}>
      <div title={mo} style={{ width: NHAN_W, flexShrink: 0, position: 'sticky', left: 0, zIndex: 3, background: 'var(--bg-1)', ...mono, display: 'flex', alignItems: 'center', paddingLeft: 4 }}>{nhan}</div>
      <div style={{ position: 'relative', width: W, flexShrink: 0 }}>{noiDung}</div>
    </div>
  );
  const khoiAm = (x: number, w: number, co: boolean, mau: string, chu: string, title: string, key: number | string, onClick?: () => void) => (
    <div key={key} title={title} onClick={onClick}
      style={{ position: 'absolute', left: x + 1, width: Math.max(4, w - 2), top: 2, bottom: 2, borderRadius: 4, overflow: 'hidden', cursor: onClick ? 'pointer' : 'default',
        background: co ? `${mau}33` : 'transparent', border: `1px ${co ? 'solid' : 'dashed'} ${mau}${co ? '' : '99'}`,
        color: co ? mau : 'var(--fg-3)', fontSize: 10, lineHeight: '20px', padding: '0 5px', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
      {co ? '♪ ' : ''}{chu}
    </div>
  );

  if (!canh.length) return null;
  return (
    <div className="xv-panel" style={{ marginTop: 8, padding: 10 }}>
      {/* Màn xem trước */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: doc916 ? 190 : 480, aspectRatio: doc916 ? '9 / 16' : '16 / 9', overflow: 'hidden', borderRadius: 8, background: '#000', flexShrink: 0 }}>
          {c && (vid ? <video ref={vidRef} key={vid} src={vid} playsInline preload="auto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : c.keyframe_url ? <img src={c.keyframe_url} alt="" data-khong-phong-to="" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: kb }} />
            : <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: '#666', fontSize: 12 }}>#{c.thu_tu} chưa có hình</div>)}
          {c?.loi_thoai && <div style={{ position: 'absolute', left: '5%', right: '5%', bottom: '6%', textAlign: 'center', color: '#fff', fontSize: doc916 ? 11 : 14, fontWeight: 600, textShadow: '0 2px 6px #000, 0 0 2px #000' }}>{c.loi_thoai}</div>}
          {c?.thoai_url && <audio ref={thoaiRef} key={c.thoai_url} src={c.thoai_url} preload="auto" />}
          {c?.am_thanh_url && <audio ref={sfxRef} key={c.am_thanh_url} src={c.am_thanh_url} preload="auto" />}
          {tap.nhac_url && <audio ref={nhacRef} src={tap.nhac_url} preload="auto" />}
        </div>
        <div style={{ flex: 1, minWidth: 220, display: 'grid', gap: 6, alignContent: 'start' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="xv-btn" onClick={() => tuaToi(batDau[Math.max(0, idx - 1)] ?? 0)}>⏮</button>
            <button type="button" className="xv-btn chinh" style={{ minWidth: 80 }} onClick={() => { if (!chay && t >= tong - 0.05) setT(0); setChay(!chay); }}>{chay ? '⏸ Dừng' : '▶ Chạy'}</button>
            <button type="button" className="xv-btn" onClick={() => tuaToi(batDau[Math.min(canh.length - 1, idx + 1)] ?? 0)}>⏭</button>
            <span style={{ ...mono, fontSize: 12, color: 'var(--fg-1)' }}>{dongHo(t)} / {dongHo(tong)}</span>
            <button type="button" className="xv-btn" onClick={onToanManHinh} title="Xem cả tập toàn màn hình">⛶</button>
          </div>
          {c && <div style={{ fontSize: 12 }}><b>#{c.thu_tu} {c.canh}</b> <span style={mono}>· {dur(c)}s · {vid ? (c.video_cuoi_url ? 'bản cuối' : 'nháp') : c.keyframe_url ? 'keyframe' : 'chưa có hình'}</span></div>}
          {c?.hanh_dong && <div style={{ fontSize: 11.5, color: 'var(--fg-2)' }}>{c.hanh_dong}</div>}
          {c?.loi_thoai && <div style={{ fontSize: 11.5 }}><span style={{ color: mauNv(nv) }}>🗣 {nv?.ten ?? 'Lời dẫn'}</span>{nv?.giong ? <span style={mono}> · giọng: {nv.giong}</span> : null}{!c.thoai_url && <span style={{ ...mono, color: 'var(--amber)' }}> · chưa sinh giọng{docThu ? ', đang đọc thử bằng giọng máy' : ''}</span>}</div>}
          {c?.am_thanh && <div style={{ fontSize: 11.5, color: 'var(--fg-2)' }}>🔊 {c.am_thanh}{!c.am_thanh_url && <span style={{ ...mono, color: 'var(--amber)' }}> · chưa sinh</span>}</div>}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', ...mono }}>
            <label style={{ display: 'inline-flex', gap: 4, alignItems: 'center', cursor: 'pointer' }}><input type="checkbox" checked={docThu} onChange={(e) => setDocThu(e.target.checked)} /> đọc thử thoại chưa có giọng</label>
            <label style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>zoom <input type="range" min={1} max={6} step={0.25} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} style={{ width: 90 }} /></label>
            <span>Space chạy/dừng · ←/→ đổi cảnh · kéo mép clip đổi giây · kéo clip đổi thứ tự · nét đứt = chưa sinh</span>
          </div>
        </div>
      </div>

      {/* Các track */}
      <div ref={vungRef} style={{ marginTop: 10, overflowX: 'auto', position: 'relative', paddingBottom: 4 }}>
        <div style={{ width: W + NHAN_W, position: 'relative' }}>
          {/* Thước giây — bấm/kéo để tua */}
          <div style={{ display: 'flex', height: 18 }}>
            <div style={{ width: NHAN_W, flexShrink: 0, position: 'sticky', left: 0, zIndex: 3, background: 'var(--bg-1)' }} />
            <div style={{ position: 'relative', width: W, cursor: 'pointer' }}
              onPointerDown={(e) => { const r = e.currentTarget.getBoundingClientRect(); tuaToi((e.clientX - r.left) / pps); }}>
              {Array.from({ length: Math.floor(tong) + 1 }, (_, s) => {
                const nhan = pps >= 40 || s % (pps >= 20 ? 2 : 5) === 0;
                return <div key={s} style={{ position: 'absolute', left: s * pps, bottom: 0, height: nhan ? 10 : 5, borderLeft: '1px solid var(--line)' }}>{nhan && <span style={{ ...mono, fontSize: 9, position: 'absolute', left: 2, top: -9 }}>{s}s</span>}</div>;
              })}
            </div>
          </div>

          {track('🎬 Hình', 'Mỗi cảnh một clip, dài đúng số giây', canh.map((cc, i) => {
            const x = batDau[i]! * pps; const w = dur(cc) * pps; const anh = cc.keyframe_url;
            const dangChon = chon === cc.id; const coVid = !!(cc.video_cuoi_url || cc.video_url);
            return (
              <div key={cc.id} draggable onDragStart={() => setKeo(cc.id)} onDragEnd={() => { setKeo(null); setTha(null); }}
                onDragOver={(e) => { e.preventDefault(); setTha(cc.id); }} onDrop={() => { thaVao(cc.id); setKeo(null); setTha(null); }}
                onClick={() => { onChon(cc.id); tuaToi(batDau[i]!); }}
                title={`#${cc.thu_tu} ${cc.canh} · ${dur(cc)}s`}
                style={{ position: 'absolute', left: x + 1, width: Math.max(6, w - 2), top: 0, bottom: 0, borderRadius: 5, overflow: 'hidden', cursor: 'grab',
                  border: `2px solid ${dangChon ? 'var(--cyan)' : tha === cc.id && keo !== cc.id ? 'var(--amber)' : coVid ? '#4ade8088' : 'var(--line)'}`,
                  background: anh ? `url(${anh}) left center / auto 100% repeat-x, #111` : 'var(--bg-2)', opacity: keo === cc.id ? 0.4 : 1 }}>
                <span style={{ position: 'absolute', left: 3, top: 2, fontSize: 10, color: '#fff', textShadow: '0 1px 3px #000', whiteSpace: 'nowrap' }}>{coVid ? '▶ ' : ''}#{cc.thu_tu} · {dur(cc)}s</span>
                <div onPointerDown={keoMep(cc)} title="Kéo để đổi số giây" style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 7, cursor: 'ew-resize', background: 'rgba(255,255,255,.25)' }} />
              </div>
            );
          }), 48)}

          {track('🗣 Thoại', 'Lời thoại từng cảnh — màu theo nhân vật nói', canh.map((cc, i) => {
            if (!cc.loi_thoai.trim()) return null;
            const v = nguoiNoi(cc, nhanVat);
            return khoiAm(batDau[i]! * pps, dur(cc) * pps, !!cc.thoai_url, mauNv(v), `${v ? `${v.ten}: ` : ''}${cc.loi_thoai.replace(/^[^:"“]*:\s*/, '')}`,
              `${v?.ten ?? 'Lời dẫn'}${v?.giong ? ` (giọng: ${v.giong})` : ''}\n${cc.loi_thoai}\n${cc.thoai_url ? 'đã có file giọng' : 'chưa sinh giọng'}`, cc.id, () => { onChon(cc.id); tuaToi(batDau[i]!); });
          }))}

          {track('🔊 Âm thanh', 'Hiệu ứng / âm nền từng cảnh', canh.map((cc, i) => {
            if (!cc.am_thanh.trim()) return null;
            return khoiAm(batDau[i]! * pps, dur(cc) * pps, !!cc.am_thanh_url, '#fb923c', cc.am_thanh, `${cc.am_thanh}\n${cc.am_thanh_url ? 'đã có file' : 'chưa sinh'}`, cc.id, () => { onChon(cc.id); tuaToi(batDau[i]!); });
          }))}

          {track('🎵 Nhạc', 'Nhạc nền cả tập', khoiAm(0, W, !!tap.nhac_url, '#a78bfa', tap.nhac_mo_ta || 'Nhạc nền cả tập: chưa có', tap.nhac_mo_ta || 'chưa có nhạc nền', 'nhac'))}

          {/* Đầu phát */}
          <div style={{ position: 'absolute', left: NHAN_W + t * pps, top: 0, bottom: 0, width: 2, background: '#ef4444', pointerEvents: 'none', zIndex: 4 }}>
            <div style={{ position: 'absolute', top: 0, left: -4, width: 10, height: 10, background: '#ef4444', borderRadius: '0 0 5px 5px' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
