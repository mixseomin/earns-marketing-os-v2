'use client';
import { ChuManXem } from './chu-man';
import type { ThongTinQc } from '@/lib/xuong-video/kieu';
// Animatic: xem cả tập từ keyframe/clip đã có, đúng thứ tự + số giây, 0 đồng.
import { useEffect, useState } from 'react';
import { type Canh } from '@/lib/xuong-video/kieu';
import { mono } from './ui';

export function Animatic({ canh, tiLe, ngonNgu, onClose, qc }: { canh: Canh[]; tiLe: string; ngonNgu: string; onClose: () => void; qc?: ThongTinQc | null }) {
  const ds = canh.filter((c) => c.keyframe_url || c.video_url);
  const [i, setI] = useState(0);
  const [chay, setChay] = useState(true);
  const [doc, setDoc] = useState(true);
  const [t, setT] = useState(0);
  const tong = ds.reduce((a, c) => a + (c.thoi_luong_s || 4), 0);
  const c = ds[i];
  const dai = (c?.thoi_luong_s || 4) * 1000;
  useEffect(() => { setT(0); }, [i]);
  useEffect(() => {
    if (!chay || !c) return;
    const bd = Date.now() - t;
    const id = setInterval(() => {
      const da = Date.now() - bd;
      if (da >= dai) { clearInterval(id); if (i < ds.length - 1) setI(i + 1); else setChay(false); } else setT(da);
    }, 100);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chay, i]);
  useEffect(() => {
    if (!doc || !chay || !c?.loi_thoai || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(c.loi_thoai.replace(/^[^:"“]*[:]\s*/, '').replace(/["“”]/g, ''));
    u.lang = ngonNgu === 'vi' ? 'vi-VN' : 'en-US'; u.rate = 1.05;
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
    return () => window.speechSynthesis.cancel();
  }, [i, chay, doc, c?.loi_thoai, ngonNgu]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); if (e.key === ' ') { e.preventDefault(); setChay((x) => !x); } if (e.key === 'ArrowRight') setI((x) => Math.min(ds.length - 1, x + 1)); if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1)); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [ds.length, onClose]);
  if (!c) return null;
  const daQua = ds.slice(0, i).reduce((a, x) => a + (x.thoi_luong_s || 4), 0) + t / 1000;
  const vid = c.video_cuoi_url || c.video_url;
  const doc916 = tiLe === '9:16';
  const p = Math.min(1, t / dai);
  const kb = i % 2 === 0 ? `scale(${1 + 0.08 * p}) translate(${-1.5 * p}%, ${-1 * p}%)` : `scale(${1.08 - 0.08 * p}) translate(${1.5 * p}%, 0)`;
  return (
    <div data-animatic="" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.92)', zIndex: 900, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      <div style={{ position: 'relative', height: doc916 ? '78vh' : 'auto', width: doc916 ? 'calc(78vh * 9 / 16)' : 'min(92vw, 1200px)', aspectRatio: doc916 ? '9 / 16' : '16 / 9', overflow: 'hidden', borderRadius: 10, background: '#000' }}>
        {vid ? <video key={vid} src={vid} autoPlay muted={false} playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <img src={c.keyframe_url!} alt="" data-khong-phong-to="" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: kb, transition: 'transform .1s linear' }} />}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, padding: '8px 12px', background: 'linear-gradient(rgba(0,0,0,.6), transparent)', color: '#fff', fontSize: 12 }}>
          #{c.thu_tu} {c.canh} · {c.thoi_luong_s}s · {vid ? (c.video_cuoi_url ? 'bản cuối' : 'nháp') : 'keyframe'}
        </div>
        {c.chu_man && <ChuManXem chu={c.chu_man} giay={t / 1000} rong={typeof window === 'undefined' ? 360 : (doc916 ? window.innerHeight * 0.78 * 9 / 16 : Math.min(window.innerWidth * 0.92, 1200))} qc={qc} />}
      </div>
      {/* Trên hình CHỈ có chữ màn (thứ bản xuất vẽ thật); lời thoại ghi bên ngoài khung, chỉ lời — không tên, không diễn xuất (#1229, #1231). */}
      <div style={{ width: doc916 ? 'calc(78vh * 9 / 16)' : 'min(92vw, 1200px)', minHeight: 20, textAlign: 'center', color: 'var(--fg-2)', fontSize: 13 }}>{c.thoai.length ? c.thoai.map((d) => d.loi).join(' ') : c.loi_thoai.replace(/^[^:"“]*:\s*/gm, '').replace(/["“”]/g, '')}</div>
      <div style={{ width: doc916 ? 'calc(78vh * 9 / 16)' : 'min(92vw, 1200px)', display: 'flex', gap: 2 }}>
        {ds.map((x, k) => (
          <div key={x.id} onClick={() => setI(k)} title={`#${x.thu_tu} ${x.canh}`} style={{ flex: x.thoi_luong_s || 4, height: 6, borderRadius: 3, cursor: 'pointer', background: k < i ? 'var(--cyan)' : k === i ? `linear-gradient(90deg, var(--cyan) ${p * 100}%, #444 ${p * 100}%)` : '#444' }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#ddd', fontSize: 12 }}>
        <button type="button" className="xv-btn" onClick={() => setI(Math.max(0, i - 1))}>⏮</button>
        <button type="button" className="xv-btn chinh" onClick={() => { if (!chay && i === ds.length - 1 && p >= 1) { setI(0); } setChay(!chay); }}>{chay ? '⏸ Dừng' : '▶ Chạy'}</button>
        <button type="button" className="xv-btn" onClick={() => setI(Math.min(ds.length - 1, i + 1))}>⏭</button>
        <span style={{ fontFamily: 'var(--font-mono)' }}>{daQua.toFixed(1)}s / {tong}s · cảnh {i + 1}/{ds.length}</span>
        <label style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><input type="checkbox" checked={doc} onChange={(e) => setDoc(e.target.checked)} /> đọc lời thoại</label>
        <button type="button" className="xv-btn" onClick={onClose}>Đóng (Esc)</button>
      </div>
      {canh.length > ds.length && <div style={{ ...mono, color: 'var(--amber)' }}>{canh.length - ds.length} cảnh chưa có keyframe nên bị bỏ qua trong animatic.</div>}
    </div>
  );
}

// ── Một cảnh ────────────────────────────────────────────────────────────────────────────────────────────────────
