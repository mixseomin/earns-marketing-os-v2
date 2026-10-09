'use client';

// Timeline kiểu CapCut cho một tập: màn xem trước ở trên, các track ở dưới chạy chung một thước giây.
//   Hình   — mỗi cảnh một clip, dài bằng số giây THỰC PHÁT (phat_s: cắt từ đầu clip 4/6/8s); kéo mép phải = cắt, kéo thả clip đổi thứ tự.
//   Chữ    — chữ trên màn của từng shot (hook, số liệu, CTA) — bản xuất vẽ đúng chữ này.
//   Thoại  — MỘT làn cho mỗi người nói (#1237), màu theo nhân vật; có file giọng (thoai_url) thì phát file, chưa có thì đọc thử bằng giọng máy.
//   Âm thanh — hiệu ứng/âm nền từng cảnh (am_thanh / am_thanh_url).
//   Nhạc   — nhạc nền cả tập (nhac_url / nhac_mo_ta).
// Nét đứt = mới có mô tả trong kịch bản, chưa sinh file. Toàn bộ chạy ở trình duyệt, không tốn tiền.
import { useEffect, useMemo, useRef, useState, type PointerEvent as PE, type ReactNode } from 'react';
import { giayPhat, tenCamXuc, type Canh, type NhanVat, type Tap } from '@/lib/xuong-video/kieu';
import { kyThuat } from '@/lib/xuong-video/dien-anh';
import { dongThoai, coTiengRieng, tenNoi, cungTen, timNv } from '@/lib/xuong-video/am-thanh';
import { BangSinh, type YeuCauBang } from './bang-sinh';
import type { TuyGiong, TuyAm } from '@/lib/actions';
import { mono } from './ui';
import { docLT, ghiLT } from '@/lib/luu-tru';

const MAU_NV = ['#22d3ee', '#a78bfa', '#f472b6', '#facc15', '#4ade80', '#fb923c', '#60a5fa'];
// Cột nhãn track: kéo mép phải để nới (#1240) — nhớ theo trình duyệt.
const NHAN_W_MAC_DINH = 150;
const KHOA_NHAN_W = 'xv-tl-nhan-w';
const dongHo = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${(s % 60).toFixed(1).padStart(4, '0')}`;

/** Sinh ngay trên timeline (#1199): khối nét đứt có nút ＋ — bấm là sinh đúng thứ đó, giá + gợi ý thời điểm ở chú thích. */
export type SinhTaiCho = {
  giong: (canhId: number, tuy: TuyGiong) => void; sfx: (canhId: number, tuy: TuyAm) => void; nhac: (phanDoan: string | undefined, model: string, moTa: string) => void;
  mhNhac: string; ban: (k: string) => boolean; dangPhanDoan: string[]; dangCaTap: boolean;
};
export function Timeline({ canh, nhanVat, tap, tiLe, ngonNgu, chon, onChon, onDoiGiay, onXep, onToanManHinh, sinh }: {
  canh: Canh[]; nhanVat: NhanVat[]; tap: Tap; tiLe: string; ngonNgu: string; chon: number | null;
  onChon: (id: number) => void; onDoiGiay: (id: number, giay: number) => void; onXep: (ids: number[]) => void; onToanManHinh: () => void; sinh?: SinhTaiCho;
}) {
  // Số giây tạm khi đang kéo mép clip (chưa ghi) — timeline co giãn theo tay ngay.
  const [giayTam, setGiayTam] = useState<Record<number, number>>({});
  const dur = (c: Canh) => giayTam[c.id] ?? giayPhat(c);
  const batDau = useMemo(() => { let a = 0; return canh.map((c) => { const s = a; a += dur(c); return s; }); }, [canh, giayTam]); // eslint-disable-line react-hooks/exhaustive-deps
  // Nhân vật của cả tập theo thứ tự xuất hiện (người nói + nhân vật có mặt mà không nói) → mỗi người MỘT nhóm làn: cảm xúc + thoại (#1244).
  const nguoiNoiTap = useMemo(() => {
    const ds: string[] = [];
    const them = (t: string) => { if (!ds.some((x) => cungTen(x, t))) ds.push(t); };
    for (const c of canh) {
      for (const d of dongThoai(c, nhanVat)) them(tenNoi(d));
      for (const id of c.nhan_vat) { const v = nhanVat.find((x) => x.id === id && x.loai === 'nhan_vat'); if (v) them(v.ten); }
    }
    return ds;
  }, [canh, nhanVat]);
  // Nút đọc thử / tắt thoại (chung cho mọi giọng) nằm ở làn thoại của người nói ĐẦU TIÊN.
  const nguoiNoiDau = useMemo(() => { for (const c of canh) { const d = dongThoai(c, nhanVat)[0]; if (d) return tenNoi(d); } return ''; }, [canh, nhanVat]);
  const tong = canh.reduce((a, c) => a + dur(c), 0);

  const [t, setT] = useState(0);
  const [chay, setChay] = useState(false);
  const [docThu, setDocThu] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [nhanW, setNhanW] = useState(() => { const v = Number(docLT(KHOA_NHAN_W)); return v >= 80 && v <= 400 ? v : NHAN_W_MAC_DINH; });
  // Mép phải của MỌI ô nhãn (cả thước) đều kéo được → bám chỗ nào cũng nới cả cột.
  const keoNhan = (e: PE<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
    const el = e.currentTarget; el.setPointerCapture(e.pointerId);
    const x0 = e.clientX, w0 = nhanW; let w = w0;
    const di = (ev: PointerEvent) => { w = Math.max(80, Math.min(400, w0 + ev.clientX - x0)); setNhanW(w); };
    const xong = () => { el.removeEventListener('pointermove', di); el.removeEventListener('pointerup', xong); el.removeEventListener('pointercancel', xong); ghiLT(KHOA_NHAN_W, String(w)); };
    el.addEventListener('pointermove', di); el.addEventListener('pointerup', xong); el.addEventListener('pointercancel', xong);
  };
  const tayNhan = <div onPointerDown={keoNhan} onDoubleClick={() => { setNhanW(NHAN_W_MAC_DINH); ghiLT(KHOA_NHAN_W, null); }} title="Kéo để nới cột nhãn · nhấp đúp = mặc định" className="xv-keo-cot" />;

  const [rong, setRong] = useState(800);
  const vungRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = vungRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setRong(el.clientWidth)); ro.observe(el); setRong(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const pps = Math.max(12, ((rong - nhanW - 16) / Math.max(tong, 1)) * zoom);   // pixel mỗi giây: vừa khít bề ngang × zoom

  const idx = Math.max(0, batDau.reduce((k, s, i) => (s <= t + 1e-6 ? i : k), 0));
  const c = canh[idx];
  const tTrong = c ? t - batDau[idx]! : 0;
  // Khối phân cảnh: shot liền nhau cùng phan_doan. Dùng cho track Phân cảnh, track Nhạc (nhạc theo phân cảnh) và phát nhạc đúng đoạn.
  const khoiPc: { ten: string; tu: number; den: number }[] = [];
  canh.forEach((cc, i) => { const l = khoiPc[khoiPc.length - 1]; if (l && l.ten === cc.phan_doan) l.den = i; else khoiPc.push({ ten: cc.phan_doan, tu: i, den: i }); });
  const pcHienTai = khoiPc.find((kh) => idx >= kh.tu && idx <= kh.den);
  const nhacPc = pcHienTai ? tap.nhac_phan_canh?.[pcHienTai.ten] : undefined;
  const tNhacPc = pcHienTai ? t - batDau[pcHienTai.tu]! : 0;
  // Bật/tắt từng lớp tiếng khi xem (clip có tiếng sẵn thì tắt bớt để khỏi chồng).
  const [tat, setTat] = useState<Record<string, boolean>>({});

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
  // Thoại nhiều dòng: phát lần lượt từng file giọng của shot (dòng sau bắt đầu khi dòng trước hết).
  const [dong, setDong] = useState(0);
  const sfxRef = useRef<HTMLAudioElement>(null);
  const nhacRef = useRef<HTMLAudioElement>(null);
  const nhacPcRef = useRef<HTMLAudioElement>(null);
  const tuaRef = useRef(0);   // tăng mỗi lần người dùng tua → ép đồng bộ lại
  const [tua, setTua] = useState(0);
  const dongBo = (el: HTMLMediaElement | null, vt: number, coDuoc: boolean) => {
    if (!el) return;
    if (!coDuoc || vt < 0 || (el.duration && vt > el.duration)) { el.pause(); return; }
    if (Math.abs(el.currentTime - vt) > 0.3) el.currentTime = vt;
    if (chay) void el.play().catch(() => { /* trình duyệt chặn tự phát khi chưa có tương tác — người dùng bấm ▶ là chạy */ }); else el.pause();
  };
  useEffect(() => {
    dongBo(vidRef.current, tTrong, true);
    if (c && vidRef.current && tTrong >= dur(c)) vidRef.current.pause();   // hết phần phát (phat_s) thì dừng dù clip còn
    if (c && dongThoai(c, nhanVat).length > 1) { setDong(0); if (thoaiRef.current) { thoaiRef.current.currentTime = 0; if (chay) void thoaiRef.current.play().catch(() => {}); else thoaiRef.current.pause(); } }
    else dongBo(thoaiRef.current, tTrong, true);
    dongBo(sfxRef.current, tTrong, true);
    dongBo(nhacRef.current, nhacPc ? tNhacPc : t, true);
    dongBo(nhacPcRef.current, tNhacPc, true);
  }, [idx, chay, tua, nhacPc]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Clip Veo/Kling có tiếng sẵn (nhân vật tự nói) — shot đã có giọng / hiệu ứng sinh riêng thì TỰ tắt tiếng clip, không chồng hai giọng (#1219).
    // Nút "tiếng clip" bật lại tiếng clip cho mọi shot (vd muốn dùng giọng của chính clip cho khớp khẩu hình).
    const tiengRieng = !!c && coTiengRieng(c, nhanVat);
    if (vidRef.current) vidRef.current.muted = tat.clip === undefined ? tiengRieng : !!tat.clip;
    if (thoaiRef.current) thoaiRef.current.muted = !!tat.thoai;
    if (sfxRef.current) sfxRef.current.muted = !!tat.sfx;
    if (nhacRef.current) nhacRef.current.muted = !!tat.nhac || !!nhacPc;
    if (nhacPcRef.current) nhacPcRef.current.muted = !!tat.nhac;
  });

  // Chưa có file giọng → đọc thử bằng giọng máy của trình duyệt khi vào cảnh (chỉ để nghe nhịp, không phải giọng thật).
  useEffect(() => {
    if (!chay || !docThu || !c?.loi_thoai || c.thoai_url || c.thoai.some((d) => d.url) || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(c.thoai.length ? c.thoai.map((d) => d.loi).join('. ') : c.loi_thoai.replace(/^[^:"“]*:\s*/, '').replace(/["“”]/g, ''));
    u.lang = ngonNgu === 'vi' ? 'vi-VN' : 'en-US'; u.rate = 1.05;
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
    return () => window.speechSynthesis.cancel();
  }, [idx, chay, docThu]); // eslint-disable-line react-hooks/exhaustive-deps

  const tuaToi = (giay: number) => { setT(Math.max(0, Math.min(tong, giay))); tuaRef.current++; setTua(tuaRef.current); };
  // Giữ chuột trên thước giây hoặc vạch đỏ rồi kéo = tua liên tục (scrub) như CapCut; đang chạy thì tạm dừng trong lúc kéo.
  const keoDauPhat = (e: PE<HTMLDivElement>, goc: number) => {
    e.preventDefault(); e.stopPropagation();
    const dangChay = chay; setChay(false);
    tuaToi((e.clientX - goc) / pps);
    const move = (ev: PointerEvent) => tuaToi((ev.clientX - goc) / pps);
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); document.body.style.cursor = ''; if (dangChay) setChay(true); };
    document.body.style.cursor = 'ew-resize';
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
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

  // Kéo mép phải clip hình → đổi số giây THỰC PHÁT (bước 0,5s, 1–15s); thả tay mới ghi. Ngắn hơn clip = cắt; dài hơn clip = sinh lại clip dài hơn.
  const keoMep = (cc: Canh) => (e: PE<HTMLDivElement>) => {
    e.stopPropagation(); e.preventDefault();
    const x0 = e.clientX; const g0 = giayPhat(cc); let g = g0;
    const move = (ev: PointerEvent) => { g = Math.max(1, Math.min(15, Math.round((g0 + (ev.clientX - x0) / pps) * 2) / 2)); setGiayTam((m) => ({ ...m, [cc.id]: g })); };
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
  const mauNv = (v: NhanVat | null) => (v ? MAU_NV[nhanVat.filter((x) => x.loai === 'nhan_vat').findIndex((x) => x.id === v.id) % MAU_NV.length] ?? '#94a3b8' : '#94a3b8');
  const W = tong * pps;

  // Nút điều khiển của track nằm NGAY ở nhãn track đó (#1230 YDNI: nút cho khối nào thì ở cạnh khối đó, không gom lên trên cùng).
  const track = (nhan: string, mo: string, noiDung: ReactNode, cao = 26, nut?: ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'stretch', height: cao, marginTop: 3 }}>
      <div title={`${nhan}\n${mo}`} style={{ width: nhanW, flexShrink: 0, position: 'sticky', left: 0, zIndex: 3, background: 'var(--bg-1)', ...mono, display: 'flex', alignItems: 'center', gap: 3, paddingLeft: 4, paddingRight: 4 }}>
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nhan}</span>{nut}{tayNhan}
      </div>
      <div style={{ position: 'relative', width: W, flexShrink: 0 }}>{noiDung}</div>
    </div>
  );
  const nutNho = (chu: string, title: string, tat: boolean, onClick: () => void) => (
    <button type="button" title={title} onClick={onClick} style={{ flexShrink: 0, fontSize: 11, lineHeight: '16px', padding: '0 3px', borderRadius: 3, border: '1px solid var(--line)', background: tat ? 'none' : 'var(--bg-2)', color: tat ? 'var(--fg-4)' : 'var(--fg-2)', cursor: 'pointer', opacity: tat ? 0.6 : 1 }}>{chu}</button>
  );
  const batTat = (k: string) => setTat((x) => ({ ...x, [k]: !x[k] }));
  // Tiếng clip ba nấc: tự (tắt khi shot có giọng/hiệu ứng riêng) → bật hết → tắt hết → tự.
  const vongClip = () => setTat((x) => { const n = { ...x }; if (x.clip === undefined) n.clip = false; else if (x.clip === false) n.clip = true; else delete n.clip; return n; });
  const [yc, setYc] = useState<YeuCauBang | null>(null);
  const ngheRef = useRef<HTMLAudioElement | null>(null);
  const [dangNghe, setDangNghe] = useState('');
  const ngheRieng = (urls: string[]) => {
    const khoa = urls.join('|');
    ngheRef.current?.pause();
    if (dangNghe === khoa) { setDangNghe(''); return; }
    setChay(false);
    let i = 0;
    const phat = () => { const a = new Audio(urls[i]!); ngheRef.current = a; a.onended = () => { i++; if (i < urls.length) phat(); else setDangNghe(''); }; void a.play().catch(() => setDangNghe('')); };
    setDangNghe(khoa); phat();
  };
  useEffect(() => () => ngheRef.current?.pause(), []);
  type NutSinh = { loai: YeuCauBang['loai']; cc?: Canh; phanDoan?: string; giay: number; title: string; dang?: boolean; nghe?: string[] };
  const khoiAm = (x: number, w: number, co: boolean, mau: string, chu: string, title: string, key: number | string, onClick?: () => void, nutSinh?: NutSinh) => (
    <div key={key} title={title} onClick={onClick}
      style={{ position: 'absolute', left: x + 1, width: Math.max(4, w - 2), top: 2, bottom: 2, borderRadius: 4, overflow: 'hidden', cursor: onClick ? 'pointer' : 'default',
        background: co ? `${mau}33` : 'transparent', border: `1px ${co ? 'solid' : 'dashed'} ${mau}${co ? '' : '99'}`,
        color: co ? mau : 'var(--fg-3)', fontSize: 10, lineHeight: '20px', padding: nutSinh ? '0 22px 0 5px' : '0 5px', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
      {nutSinh?.dang && <div className="xv-dang" style={{ borderRadius: 4 }}><span>⏳ đang sinh</span></div>}
      {nutSinh?.nghe?.length ? (
        // Nghe riêng đúng khối này (#1206) — không cần chạy cả timeline.
        <button type="button" title={dangNghe === nutSinh.nghe.join('|') ? 'Dừng' : 'Nghe riêng'} onClick={(e) => { e.stopPropagation(); ngheRieng(nutSinh.nghe!); }}
          style={{ marginRight: 4, padding: '0 5px', borderRadius: 3, border: `1px solid ${mau}`, background: dangNghe === nutSinh.nghe.join('|') ? mau : 'transparent', color: dangNghe === nutSinh.nghe.join('|') ? '#0b0b0b' : mau, fontSize: 9.5, lineHeight: '14px', cursor: 'pointer', position: 'relative', zIndex: 2 }}>
          {dangNghe === nutSinh.nghe.join('|') ? '■' : '▶'}
        </button>
      ) : co && mau !== '#38d9f5' ? '♪ ' : ''}{chu}
      {nutSinh && (
        // Nút ＋ to, sáng: mở bảng tuỳ chọn (model, giọng, nguồn, mô tả, giá) — không sinh ngay (#1202).
        <button type="button" className="xv-nut-sinh" title={nutSinh.title} disabled={nutSinh.dang}
          onClick={(e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setYc({ loai: nutSinh.loai, cc: nutSinh.cc, phanDoan: nutSinh.phanDoan, giay: nutSinh.giay, x: r.right, y: r.bottom }); }}
          style={{ position: 'absolute', right: 2, top: 3, bottom: 3, width: 16, padding: 0, borderRadius: 3, border: 0, background: mau, color: '#0b0b0b', fontWeight: 800, fontSize: 11, lineHeight: '14px', cursor: 'pointer' }}>
          {nutSinh.dang ? '⏳' : co ? '↻' : '+'}
        </button>
      )}
    </div>
  );

  if (!canh.length) return null;
  return (
    <div className="xv-panel" style={{ marginTop: 8, padding: 10 }} data-ngu-canh={`timeline ${t.toFixed(1)}s/${tong}s · cảnh #${c?.thu_tu ?? '?'} đang ở đầu phát`}>
      {/* Màn xem trước (#1246): hình ở GIỮA, nút chạy ngay dưới hình; bên trái = hình (shot, chữ màn, hành động, khán giả), bên phải = tiếng (thoại từng người, hiệu ứng). */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 1fr) auto minmax(160px, 1fr)', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 6, alignContent: 'start', textAlign: 'right' }}>
          {c && <div style={{ fontSize: 12 }}><b>#{c.thu_tu} {c.canh}</b></div>}
          {c && <div style={mono}>phát {dur(c)}s{dur(c) !== (c.thoi_luong_s || 4) ? ` / clip ${c.thoi_luong_s || 4}s` : ''} · {vid ? (c.video_cuoi_url ? 'bản cuối' : 'nháp') : c.keyframe_url ? 'keyframe' : 'chưa có hình'}{c.nhanh ? ` · hook ${c.nhanh}` : ''}</div>}
          {c?.chu_man && <div style={{ fontSize: 11.5 }}>✎ <b>{c.chu_man}</b></div>}
          {c?.hanh_dong && <div style={{ fontSize: 11.5, color: 'var(--fg-2)' }}>{c.hanh_dong}</div>}
          {c && <div style={mono}>❤ khán giả: <span style={{ color: c.cam_xuc >= 0 ? 'var(--lime)' : 'var(--red)' }}>{tenCamXuc(c.cam_xuc)}</span></div>}
        </div>
        <div style={{ display: 'grid', gap: 8, justifyItems: 'center' }}>
          <div style={{ position: 'relative', width: doc916 ? 220 : 480, aspectRatio: doc916 ? '9 / 16' : '16 / 9', overflow: 'hidden', borderRadius: 8, background: '#000', flexShrink: 0 }}>
            {c && (vid ? <video ref={vidRef} key={vid} src={vid} playsInline preload="auto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : c.keyframe_url ? <img src={c.keyframe_url} alt="" data-khong-phong-to="" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: kb }} />
              : <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: '#666', fontSize: 12 }}>#{c.thu_tu} chưa có hình</div>)}
            {c?.chu_man && <div style={{ position: 'absolute', left: '6%', right: '6%', top: '14%', textAlign: 'center', color: '#fff', fontSize: doc916 ? 13 : 18, fontWeight: 800, lineHeight: 1.15, textShadow: '0 2px 8px #000, 0 0 3px #000', textTransform: 'none' }}>{c.chu_man}</div>}
            {c && (() => {
              const ds = dongThoai(c, nhanVat).map((d) => d.url).filter((u): u is string => !!u);
              const u = ds[dong];
              return u ? <audio ref={thoaiRef} key={`${c.id}-${dong}`} src={u} preload="auto" autoPlay={chay && dong > 0} onEnded={() => setDong((x) => x + 1)} /> : null;
            })()}
            {c?.am_thanh_url && <audio ref={sfxRef} key={c.am_thanh_url} src={c.am_thanh_url} preload="auto" />}
            {tap.nhac_url && <audio ref={nhacRef} src={tap.nhac_url} preload="auto" />}
            {nhacPc && <audio ref={nhacPcRef} key={nhacPc} src={nhacPc} preload="auto" />}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="xv-btn" title="Cảnh trước" onClick={() => tuaToi(batDau[Math.max(0, idx - 1)] ?? 0)}>⏮</button>
            <button type="button" className="xv-btn chinh" style={{ minWidth: 80 }} onClick={() => { if (!chay && t >= tong - 0.05) setT(0); setChay(!chay); }}>{chay ? '⏸ Dừng' : '▶ Chạy'}</button>
            <button type="button" className="xv-btn" title="Cảnh sau" onClick={() => tuaToi(batDau[Math.min(canh.length - 1, idx + 1)] ?? 0)}>⏭</button>
            <span style={{ ...mono, fontSize: 12, color: 'var(--fg-1)' }}>{dongHo(t)} / {dongHo(tong)}</span>
            <button type="button" className="xv-btn" onClick={onToanManHinh} title="Xem cả tập toàn màn hình">⛶</button>
          </div>
        </div>
        <div style={{ display: 'grid', gap: 6, alignContent: 'start' }}>
          {c && dongThoai(c, nhanVat).map((d, i) => {
            const v = timNv(nhanVat, tenNoi(d)) ?? null;
            return <div key={i} style={{ fontSize: 11.5 }}><b style={{ color: mauNv(v) }}>🗣 {tenNoi(d)}</b>{d.dien_xuat && <i style={{ color: 'var(--fg-3)' }}> ({d.dien_xuat})</i>}: {d.loi}{!d.url && <span style={{ ...mono, color: 'var(--amber)' }}> · chưa sinh giọng{docThu ? ', đang đọc thử' : ''}</span>}</div>;
          })}
          {c?.am_thanh && <div style={{ fontSize: 11.5, color: 'var(--fg-2)' }}>🔊 {c.am_thanh}{!c.am_thanh_url && <span style={{ ...mono, color: 'var(--amber)' }}> · chưa sinh</span>}</div>}
          {c && !dongThoai(c, nhanVat).length && !c.am_thanh && <div style={mono}>shot này không có thoại / hiệu ứng</div>}
        </div>
      </div>

      {/* Các track */}
      <div ref={vungRef} style={{ marginTop: 10, overflowX: 'auto', position: 'relative', paddingBottom: 4 }}>
        <div style={{ width: W + nhanW, position: 'relative' }}>
          {/* Thước giây — bấm/kéo để tua */}
          <div style={{ display: 'flex', height: 18 }}>
            <div style={{ width: nhanW, flexShrink: 0, position: 'sticky', left: 0, zIndex: 3, background: 'var(--bg-1)', display: 'flex', alignItems: 'center', gap: 3, paddingLeft: 4, ...mono }}>
              <span title="Space chạy/dừng · ←/→ đổi cảnh · kéo mép clip = cắt giây phát · kéo clip đổi thứ tự · nét đứt = chưa sinh" style={{ cursor: 'help' }}>⌨</span>
              {nutNho('−', 'Thu nhỏ thước thời gian', false, () => setZoom((z) => Math.max(1, z - 0.5)))}
              <span title="Độ phóng thước thời gian" style={{ minWidth: 22, textAlign: 'center' }}>{zoom}×</span>
              {nutNho('+', 'Phóng to thước thời gian', false, () => setZoom((z) => Math.min(6, z + 0.5)))}
              {tayNhan}
            </div>
            <div style={{ position: 'relative', width: W, cursor: 'pointer' }}
              onPointerDown={(e) => keoDauPhat(e, e.currentTarget.getBoundingClientRect().left)}>
              {Array.from({ length: Math.floor(tong) + 1 }, (_, s) => {
                const nhan = pps >= 40 || s % (pps >= 20 ? 2 : 5) === 0;
                return <div key={s} style={{ position: 'absolute', left: s * pps, bottom: 0, height: nhan ? 10 : 5, borderLeft: '1px solid var(--line)' }}>{nhan && <span style={{ ...mono, fontSize: 9, position: 'absolute', left: 2, top: -9 }}>{s}s</span>}</div>;
              })}
            </div>
          </div>

          {/* Phân cảnh (scene): shot liền nhau cùng phan_doan gộp một khối; rê thấy beat · mục tiêu · xung đột · ẩn ý · cảm xúc đầu→cuối. */}
          {canh.some((x) => x.phan_doan) && track('🎞 Phân cảnh', 'Shot cùng phân cảnh gộp một khối — mỗi phân cảnh có mục tiêu, xung đột, cảm xúc đổi từ đầu tới cuối', (() => {
            const khoi: { ten: string; tu: number; den: number }[] = [];
            canh.forEach((cc, i) => { const l = khoi[khoi.length - 1]; if (l && l.ten === cc.phan_doan) l.den = i; else khoi.push({ ten: cc.phan_doan, tu: i, den: i }); });
            const beatMau = (b: string) => MAU_NV[Math.max(0, tap.beats.findIndex((x) => x.ten === b)) % MAU_NV.length]!;
            return khoi.map((kh, j) => {
              const pc = tap.phan_canh.find((x) => x.ten === kh.ten);
              const x = batDau[kh.tu]! * pps; const w = (batDau[kh.den]! + dur(canh[kh.den]!)) * pps - x;
              const mau = pc ? beatMau(pc.beat) : '#64748b';
              const tt = pc ? `${pc.ten}\nBeat: ${pc.beat} · nhịp ${pc.nhip}\nMục tiêu: ${pc.muc_tieu}\nXung đột: ${pc.xung_dot}${pc.an_y ? `\nẨn ý: ${pc.an_y}` : ''}\nCảm xúc: ${pc.cam_xuc_dau} → ${pc.cam_xuc_cuoi}` : kh.ten || '(chưa đặt phân cảnh)';
              return (
                <div key={j} title={tt} style={{ position: 'absolute', left: x + 1, width: Math.max(4, w - 2), top: 2, bottom: 2, borderRadius: 4, background: `${mau}26`, borderLeft: `3px solid ${mau}`, color: 'var(--fg-2)', fontSize: 10, lineHeight: '20px', padding: '0 5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {pc?.beat ? <b style={{ color: mau }}>{pc.beat} · </b> : null}{kh.ten || '—'}{pc ? ` (${pc.cam_xuc_dau > 0 ? '+' : ''}${pc.cam_xuc_dau}→${pc.cam_xuc_cuoi > 0 ? '+' : ''}${pc.cam_xuc_cuoi})` : ''}
                </div>
              );
            });
          })())}

          {track('🎬 Hình', 'Mỗi cảnh một clip, dài đúng số giây', canh.map((cc, i) => {
            const x = batDau[i]! * pps; const w = dur(cc) * pps; const anh = cc.keyframe_url;
            const dangChon = chon === cc.id; const coVid = !!(cc.video_cuoi_url || cc.video_url);
            return (
              <div key={cc.id} draggable onDragStart={() => setKeo(cc.id)} onDragEnd={() => { setKeo(null); setTha(null); }}
                onDragOver={(e) => { e.preventDefault(); setTha(cc.id); }} onDrop={() => { thaVao(cc.id); setKeo(null); setTha(null); }}
                onClick={() => { onChon(cc.id); tuaToi(batDau[i]!); }}
                title={`#${cc.thu_tu} ${cc.canh} · phát ${dur(cc)}s${dur(cc) !== (cc.thoi_luong_s || 4) ? ` (clip ${cc.thoi_luong_s || 4}s)` : ''}`}
                style={{ position: 'absolute', left: x + 1, width: Math.max(6, w - 2), top: 0, bottom: 0, borderRadius: 5, overflow: 'hidden', cursor: 'grab',
                  border: `2px solid ${dangChon ? 'var(--cyan)' : tha === cc.id && keo !== cc.id ? 'var(--amber)' : coVid ? '#4ade8088' : 'var(--line)'}`,
                  background: anh ? `url(${anh}) left center / auto 100% repeat-x, #111` : 'var(--bg-2)', opacity: keo === cc.id ? 0.4 : 1 }}>
                {(cc.dang_sinh_anh || cc.trang_thai === 'dang_sinh') && <div className="xv-dang"><span>⏳ {cc.dang_sinh_anh ? 'ảnh' : 'video'}</span></div>}
                <span style={{ position: 'absolute', left: 3, top: 2, fontSize: 10, color: '#fff', textShadow: '0 1px 3px #000', whiteSpace: 'nowrap', zIndex: 2 }}>{coVid ? '▶ ' : ''}#{cc.thu_tu} · {dur(cc)}s</span>
                <div onPointerDown={keoMep(cc)} title="Kéo để cắt / kéo dài giây phát" style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 7, cursor: 'ew-resize', background: 'rgba(255,255,255,.25)' }} />
              </div>
            );
          }), 48, nutNho(tat.clip === undefined ? '🔈' : tat.clip ? '🔇' : '🔊', `Tiếng có sẵn của clip: ${tat.clip === undefined ? 'tự (tắt khi shot có giọng/hiệu ứng sinh riêng)' : tat.clip ? 'tắt hết' : 'bật hết'} — bấm để đổi`, !!tat.clip, vongClip))}

          {/* Đường cong cảm xúc: điểm ở cuối mỗi shot, -5..+5, vạch giữa = 0. */}
          {canh.some((x) => x.cam_xuc) && track('❤ Khán giả', 'Khán giả cảm thấy gì ở cuối mỗi shot (cảm xúc ta MUỐN họ có): dưới vạch = khó chịu/đau (đúng nỗi đau của họ), trên vạch = tò mò → thích → muốn mua. QC tốt: chạm đáy ở nỗi đau rồi leo lên muốn mua.', (() => {
            const H = 40; const y = (v: number) => H / 2 - (v / 5) * (H / 2 - 4);
            const diem = canh.map((cc, i) => ({ x: (batDau[i]! + dur(cc)) * pps, y: y(cc.cam_xuc), v: cc.cam_xuc, cc }));
            const duong = [`0,${y(0)}`, ...diem.map((d) => `${d.x},${d.y}`)].join(' ');
            return (
              <svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
                <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="var(--line)" strokeDasharray="3 3" />
                <polygon points={`0,${y(0)} ${duong.split(' ').slice(1).join(' ')} ${diem.length ? `${diem[diem.length - 1]!.x},${y(0)}` : ''}`} fill="rgba(244,114,182,.12)" />
                <polyline points={duong} fill="none" stroke="#f472b6" strokeWidth={2} />
                {diem.map((d) => <circle key={d.cc.id} cx={d.x} cy={d.y} r={3.5} fill={d.v >= 0 ? '#4ade80' : '#f87171'}><title>{`#${d.cc.thu_tu} ${d.cc.canh}: ${tenCamXuc(d.v)} (${d.v > 0 ? '+' : ''}${d.v})`}</title></circle>)}
                {diem.map((d, i) => (i === 0 || diem[i - 1]!.v !== d.v) && <text key={`t${d.cc.id}`} x={d.x - 4} y={d.v >= 0 ? d.y + 12 : d.y - 6} textAnchor="end" fontSize={9} fill="var(--fg-3)">{tenCamXuc(d.v)}</text>)}
              </svg>
            );
          })(), 40)}

          {/* Máy + ánh sáng của từng shot (từ thư viện điện ảnh). */}
          {canh.some((x) => Object.keys(x.ky_thuat ?? {}).length) && track('🎥 Máy · 💡', 'Cỡ cảnh · chuyển động máy · ánh sáng của từng shot', canh.map((cc, i) => {
            const kt = cc.ky_thuat ?? {};
            const chu = [kyThuat(kt.co_canh, 'co_canh')?.ten, kyThuat(kt.chuyen_dong, 'chuyen_dong')?.ten, kyThuat(kt.anh_sang, 'anh_sang')?.ten].filter(Boolean).join(' · ');
            if (!chu) return null;
            const day = ['co_canh', 'goc', 'chuyen_dong', 'ong_kinh', 'anh_sang', 'mau', 'chuyen_canh', 'nhac'].map((n) => kyThuat((kt as Record<string, string>)[n])?.ten).filter(Boolean).join('\n');
            return khoiAm(batDau[i]! * pps, dur(cc) * pps, true, '#38d9f5', chu, day, cc.id, () => { onChon(cc.id); tuaToi(batDau[i]!); });
          }))}

          {canh.some((x) => x.chu_man.trim()) && track('✎ Chữ màn', 'Chữ hiện trên màn của từng shot (hook, số liệu, ưu đãi, CTA) — sửa ở form cảnh; bản xuất vẽ đúng chữ này', canh.map((cc, i) => {
            if (!cc.chu_man.trim()) return null;
            return khoiAm(batDau[i]! * pps, dur(cc) * pps, true, '#facc15', cc.chu_man, cc.chu_man, cc.id, () => { onChon(cc.id); tuaToi(batDau[i]!); });
          }))}

          {/* MỖI nhân vật một NHÓM làn (#1237, #1244), viền màu nhân vật: 🎭 cảm xúc/diễn xuất theo shot (có mặt mà không nói cũng hiện) · 🗣 thoại. */}
          {nguoiNoiTap.map((ten) => {
            const v = timNv(nhanVat, ten) ?? null;
            const coThoai = canh.some((cc) => dongThoai(cc, nhanVat).some((d) => cungTen(tenNoi(d), ten)));
            const camXuc = canh.map((cc, i) => {
              const cua = dongThoai(cc, nhanVat).filter((d) => cungTen(tenNoi(d), ten));
              const coMat = !!v && cc.nhan_vat.includes(v.id);
              if (!cua.length && !coMat) return null;
              const dx = [...new Set(cua.map((d) => d.dien_xuat.trim()).filter(Boolean))].join(' → ');
              const chu = dx || (cua.length ? 'nói, chưa ghi diễn xuất' : 'có mặt, không nói');
              return khoiAm(batDau[i]! * pps, dur(cc) * pps, !!dx, mauNv(v), chu, `${ten} · shot #${cc.thu_tu}\n${chu}${cc.hanh_dong ? `\nHành động: ${cc.hanh_dong}` : ''}`, `cx${cc.id}`, () => { onChon(cc.id); tuaToi(batDau[i]!); });
            });
            return (
              <div key={ten} style={{ borderLeft: `2px solid ${mauNv(v)}`, marginTop: 4 }}>
                {track(`🎭 ${ten}`, `Cảm xúc / diễn xuất của ${ten} theo từng shot (lấy từ diễn xuất của dòng thoại; nét đứt = có mặt nhưng chưa ghi cảm xúc) — sửa ở form shot`, camXuc)}
                {coThoai && track(`🗣 ${ten} · thoại`, `Thoại của ${ten} theo từng shot — bấm khối để sinh giọng cả shot`, canh.map((cc, i) => {
              const dsT = dongThoai(cc, nhanVat);
              const cua = dsT.filter((d) => cungTen(tenNoi(d), ten));
              if (!cua.length) return null;
              const co = cua.filter((d) => d.url).length;
              const tt = cua.map((d) => `${d.dien_xuat ? `(${d.dien_xuat}) ` : ''}${d.loi}${d.url ? ' ✓' : ''}`).join('\n');
              return khoiAm(batDau[i]! * pps, dur(cc) * pps, co === cua.length, mauNv(v), `${cc.dang_sinh_giong ? '⏳ ' : ''}${cua.map((d) => d.loi).join(' · ')}${co && co < cua.length ? ` (${co}/${cua.length})` : ''}`, `${ten.toUpperCase()}\n${tt}\n${co}/${cua.length} dòng có giọng`, cc.id, () => { onChon(cc.id); tuaToi(batDau[i]!); },
                sinh && { loai: 'giong', cc, giay: dur(cc), dang: cc.dang_sinh_giong || sinh.ban(`g${cc.id}`), nghe: cua.map((d) => d.url).filter((u): u is string => !!u), title: `Bấm để chọn model, giọng từng người nói, cảm xúc, phạm vi rồi sinh giọng cả shot` });
            }), 26, ten === nguoiNoiDau ? <>{nutNho('🤖', docThu ? 'Đang đọc thử thoại chưa có giọng bằng giọng máy — bấm để tắt' : 'Bấm để đọc thử thoại chưa có giọng bằng giọng máy', !docThu, () => setDocThu((x) => !x))}{nutNho(tat.thoai ? '🔇' : '🔊', tat.thoai ? 'Thoại đang tắt — bấm để bật' : 'Tắt tiếng thoại', !!tat.thoai, () => batTat('thoai'))}</> : undefined)}
              </div>
            );
          })}

          {track('🔊 Âm thanh', 'Hiệu ứng / âm nền từng cảnh', canh.map((cc, i) => {
            if (!cc.am_thanh.trim()) return null;
            return khoiAm(batDau[i]! * pps, dur(cc) * pps, !!cc.am_thanh_url, '#fb923c', cc.am_thanh, `${cc.am_thanh}\n${cc.am_thanh_url ? 'đã có file' : 'chưa sinh'}`, cc.id, () => { onChon(cc.id); tuaToi(batDau[i]!); },
              sinh && { loai: 'sfx', cc, giay: dur(cc), dang: cc.dang_sinh_sfx || sinh.ban(`s${cc.id}`), nghe: cc.am_thanh_url ? [cc.am_thanh_url] : [], title: `Bấm để chọn nguồn (clip / mô tả), model, mô tả, số giây rồi sinh` });
          }), 26, nutNho(tat.sfx ? '🔇' : '🔊', tat.sfx ? 'Hiệu ứng đang tắt — bấm để bật' : 'Tắt tiếng hiệu ứng', !!tat.sfx, () => batTat('sfx')))}

          {track('🎵 Nhạc', 'Nhạc nền: theo từng phân cảnh (ưu tiên) hoặc một bài cả tập', khoiPc.some((kh) => kh.ten)
            ? khoiPc.map((kh, j) => {
                const x = batDau[kh.tu]! * pps; const w = (batDau[kh.den]! + dur(canh[kh.den]!)) * pps - x;
                const url = tap.nhac_phan_canh?.[kh.ten];
                const giay = canh.slice(kh.tu, kh.den + 1).reduce((a, x) => a + dur(x), 0);
                return khoiAm(x, w, !!url, '#a78bfa', url ? `${kh.ten}` : `${kh.ten}: chưa có nhạc`, url ? `Nhạc phân cảnh “${kh.ten}”` : `Phân cảnh “${kh.ten}” chưa có nhạc`, `n${j}`, undefined,
                  sinh && kh.ten ? { loai: 'nhac', phanDoan: kh.ten, giay, dang: sinh.ban('nhac') || sinh.dangPhanDoan.includes(kh.ten), nghe: url ? [url] : [], title: `Bấm để chọn model nhạc, mô tả rồi sinh nhạc cho phân cảnh này` } : undefined);
              })
            : khoiAm(0, W, !!tap.nhac_url, '#a78bfa', tap.nhac_mo_ta || 'Nhạc nền cả tập: chưa có', tap.nhac_mo_ta || 'chưa có nhạc nền', 'nhac', undefined,
                sinh && { loai: 'nhac', giay: tong, dang: sinh.ban('nhac1') || sinh.dangCaTap, nghe: tap.nhac_url ? [tap.nhac_url] : [], title: `Bấm để chọn model nhạc, mô tả rồi sinh một bài cả tập` }), 26, nutNho(tat.nhac ? '🔇' : '🔊', tat.nhac ? 'Nhạc đang tắt — bấm để bật' : 'Tắt tiếng nhạc', !!tat.nhac, () => batTat('nhac')))}

          {yc && sinh && <BangSinh yc={yc} nhanVat={nhanVat} tap={tap} mhNhac={sinh.mhNhac} onClose={() => setYc(null)} onGiong={sinh.giong} onSfx={sinh.sfx} onNhac={sinh.nhac} />}
          {/* Đầu phát */}
          <div style={{ position: 'absolute', left: nhanW + t * pps - 1, top: 0, bottom: 0, width: 2, background: '#ef4444', pointerEvents: 'none', zIndex: 4 }}>
            <div title="Kéo để tua" onPointerDown={(e) => keoDauPhat(e, (vungRef.current?.getBoundingClientRect().left ?? 0) + nhanW - (vungRef.current?.scrollLeft ?? 0))}
              style={{ position: 'absolute', top: 0, left: -7, width: 16, height: 16, background: '#ef4444', borderRadius: '3px 3px 8px 8px', cursor: 'ew-resize', pointerEvents: 'auto', boxShadow: '0 1px 4px #0008' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
