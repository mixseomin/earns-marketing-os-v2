'use client';
// Sơ đồ nguồn của một shot (drawer 🔗) — dạng NODE nối dây như MuseFlow: ảnh tham chiếu + câu lệnh ảnh → Keyframe → (khung đầu)
// Clip ← (khung cuối) keyframe shot sau ← câu lệnh video. Màu dây = trạng thái: xanh khớp · đỏ đã đổi sau lúc sinh · vàng câu lệnh khác ·
// xám nét đứt = không biết (job cũ không ghi) / không có. Bấm node → chi tiết bên dưới (model, giá, giờ, câu thêm/bớt). Chỉ đọc, 0đ.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { nguonCuaShot } from '@/lib/actions';
import { gioVN, tien } from '@/lib/xuong-video/kieu';
import type { BuocNguon, NguonShot } from '@/lib/xuong-video/phu-thuoc';
import { moNgan } from './ngan-chung';
import { mono } from './ui';
import { anhNho, nacNho } from '@/lib/xuong-video/anh-nho';

type TT = 'ok' | 'doi' | 'cau' | 'mo';
const KHOA_VT = 'xv-nguon-vi-tri';
const MAU: Record<TT, string> = { ok: 'var(--lime)', doi: 'var(--red)', cau: 'var(--amber)', mo: 'var(--fg-3)' };
const NHAN_TT: Record<TT, string> = { ok: 'khớp', doi: 'đã đổi', cau: 'câu lệnh khác', mo: 'không rõ' };
type Day = { tu: string; den: string; tt: TT; nhan?: string };
const ttBuoc = (b: BuocNguon | null): TT => (!b ? 'mo' : b.doi.length ? 'doi' : b.cauLenh ? 'cau' : 'ok');

/** Thẻ node: đầu thẻ (tiêu đề + chấm trạng thái), thân; cổng vào bên trái do `cong` vẽ, cổng ra là mép phải giữa thẻ. */
function The({ id, tieuDe, tt, chon, onChon, w = 150, children, dat, lech, onKeo }: { id: string; tieuDe: string; tt?: TT; chon: boolean; onChon: () => void; w?: number; children: ReactNode; dat: (id: string, el: HTMLElement | null) => void;
  /** độ dời do kéo (px) + hàm kéo: kéo ĐẦU thẻ để dời, thân thẻ vẫn bấm chọn / rê xem ảnh */ lech?: { x: number; y: number }; onKeo: (id: string, e: React.PointerEvent) => void }) {
  return (
    <div ref={(el) => dat(id, el)} onClick={onChon} style={{ transform: lech ? `translate(${lech.x}px, ${lech.y}px)` : undefined, width: w, background: 'var(--bg-1)', border: `1px solid ${chon ? 'var(--cyan)' : 'var(--line)'}`, borderRadius: 8, boxShadow: chon ? '0 0 0 1px var(--cyan)' : '0 2px 8px rgba(0,0,0,.35)', cursor: 'pointer', position: 'relative', zIndex: 1 }}>
      <div onPointerDown={(e) => onKeo(id, e)} title="Kéo để dời thẻ" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 7px', borderBottom: '1px solid var(--line)', fontSize: 10.5, fontWeight: 600, cursor: 'grab', touchAction: 'none', userSelect: 'none' }}>
        {tt && <span title={NHAN_TT[tt]} style={{ width: 7, height: 7, borderRadius: '50%', background: MAU[tt], flexShrink: 0 }} />}
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tieuDe}</span>
      </div>
      <div style={{ padding: 6, display: 'grid', gap: 4 }}>{children}</div>
    </div>
  );
}

function ChiTiet({ b, tieuDe }: { b: BuocNguon; tieuDe: string }) {
  return (
    <div style={{ display: 'grid', gap: 5 }}>
      <b style={{ fontSize: 12 }}>{tieuDe}</b>
      <div style={mono}>{b.nguon || b.model.replace(/^fal:/, '')} · {tien(b.chi_phi_cents)} · {gioVN(b.luc)} · job #{b.job}</div>
      {b.doi.map((x) => <div key={x} style={{ fontSize: 11.5, color: 'var(--red)' }}>⚠ {x}</div>)}
      {b.cauLenh && <div style={{ display: 'grid', gap: 3 }}>
        <div style={{ fontSize: 11.5, color: 'var(--amber)' }}>Câu lệnh giờ khác lúc sinh: +{b.cauLenh.them.length} câu · −{b.cauLenh.bot.length} câu</div>
        {b.cauLenh.them.map((c, i) => <div key={`t${i}`} style={{ ...mono, color: 'var(--lime)' }}>+ {c}</div>)}
        {b.cauLenh.bot.map((c, i) => <div key={`b${i}`} style={{ ...mono, color: 'var(--red)' }}>− {c}</div>)}
      </div>}
      {!b.doi.length && !b.cauLenh && <div style={{ fontSize: 11.5, color: 'var(--lime)' }}>✓ khớp nguồn hiện tại</div>}
      <details><summary style={{ fontSize: 11, color: 'var(--fg-3)', cursor: 'pointer' }}>Toàn bộ câu lệnh đã gửi</summary><div style={{ ...mono, whiteSpace: 'pre-wrap', marginTop: 4 }}>{b.prompt || '(job không ghi câu lệnh)'}</div></details>
    </div>
  );
}

export function NguonShotNoiDung({ canhId }: { canhId: number }) {
  const [d, setD] = useState<NguonShot | null | undefined>(undefined);
  const [chon, setChon] = useState<string>('clip');
  // Vị trí thẻ do anh kéo (dời so với chỗ xếp sẵn) — nhớ theo trình duyệt, cùng một bố cục cho mọi shot (id thẻ giống nhau).
  const [vt, setVt] = useState<Record<string, { x: number; y: number }>>(() => { try { return JSON.parse(localStorage.getItem(KHOA_VT) ?? '{}') as Record<string, { x: number; y: number }>; } catch { return {}; } });
  useEffect(() => { try { localStorage.setItem(KHOA_VT, JSON.stringify(vt)); } catch { /* trình duyệt chặn lưu: vẫn kéo được, chỉ không nhớ */ } }, [vt]);
  const keo = (id: string, e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    const x0 = e.clientX, y0 = e.clientY, goc = vt[id] ?? { x: 0, y: 0 }; const tg = e.currentTarget as HTMLElement; tg.setPointerCapture(e.pointerId);
    const di = (ev: PointerEvent) => setVt((m) => ({ ...m, [id]: { x: goc.x + ev.clientX - x0, y: goc.y + ev.clientY - y0 } }));
    const xong = () => { tg.removeEventListener('pointermove', di); tg.removeEventListener('pointerup', xong); tg.removeEventListener('pointercancel', xong); };
    tg.addEventListener('pointermove', di); tg.addEventListener('pointerup', xong); tg.addEventListener('pointercancel', xong);
  };
  useEffect(() => { setD(undefined); void nguonCuaShot(canhId).then((x) => { setD(x); setChon(x?.video ? 'clip' : 'kf'); }); }, [canhId]);
  // Dây nối: đo vị trí thật của thẻ / cổng sau khi vẽ (ảnh tải xong làm thẻ cao lên → ResizeObserver đo lại).
  const khung = useRef<HTMLDivElement>(null);
  const el = useRef(new Map<string, HTMLElement>());
  const dat = (id: string, e: HTMLElement | null) => { if (e) el.current.set(id, e); else el.current.delete(id); };
  const [duong, setDuong] = useState<{ p: string; tt: TT; nhan?: string; x: number; y: number }[]>([]);
  const days: Day[] = [];
  const ve = () => {
    const k = khung.current; if (!k) return; const g = k.getBoundingClientRect();
    const ra = days.flatMap((dy) => {
      const a = el.current.get(dy.tu)?.getBoundingClientRect(), b = el.current.get(dy.den)?.getBoundingClientRect(); if (!a || !b) return [];
      const x1 = a.right - g.left, y1 = a.top + a.height / 2 - g.top, x2 = b.left - g.left + (dy.den.startsWith('cong:') ? b.width / 2 : 0), y2 = b.top + b.height / 2 - g.top;
      const cx = Math.max(30, (x2 - x1) / 2);
      return [{ p: `M${x1},${y1} C${x1 + cx},${y1} ${x2 - cx},${y2} ${x2},${y2}`, tt: dy.tt, nhan: dy.nhan, x: (x1 + x2) / 2, y: (y1 + y2) / 2 }];
    });
    setDuong((cu) => (JSON.stringify(cu) === JSON.stringify(ra) ? cu : ra));
  };
  useLayoutEffect(ve);
  useEffect(() => {
    const k = khung.current; if (!k) return;
    const ro = new ResizeObserver(() => ve()); ro.observe(k); el.current.forEach((e) => ro.observe(e));
    return () => ro.disconnect();
  }); // eslint-disable-line react-hooks/exhaustive-deps

  if (d === undefined) return <div style={mono}>đang đọc…</div>;
  if (!d) return <div style={mono}>Không thấy shot này.</div>;
  const tl = d.ti_le === '16:9' ? '16 / 9' : '9 / 16'; const ngang = d.ti_le === '16:9';
  const daDung = d.keyframe?.thamChieuUrl ?? null;
  const kf = d.keyframe, vd = d.video;
  // Dây vào keyframe: ảnh tham chiếu (xanh = đã dùng lúc sinh, vàng = mới thêm sau, xám = job cũ không ghi) + câu lệnh ảnh.
  d.thamChieu.forEach((v, i) => days.push({ tu: `ref${i}`, den: 'kf', tt: !kf ? 'mo' : !daDung ? 'mo' : daDung.includes(v.url) ? 'ok' : 'cau', nhan: kf && daDung && !daDung.includes(v.url) ? 'MỚI' : undefined }));
  days.push({ tu: 'cauAnh', den: 'kf', tt: !kf ? 'mo' : kf.cauLenh ? 'cau' : 'ok' });
  if (vd) {
    days.push({ tu: 'kf', den: 'cong:dau', tt: vd.khungDau && vd.khungDau !== d.keyframe_url ? 'doi' : 'ok', nhan: vd.khungDau && vd.khungDau !== d.keyframe_url ? 'keyframe khác' : undefined });
    if (d.khungCuoiNay || vd.khungCuoi) days.push({ tu: 'ke', den: 'cong:cuoi', tt: (vd.khungCuoi ?? null) === d.khungCuoiNay ? 'ok' : 'doi', nhan: (vd.khungCuoi ?? null) === d.khungCuoiNay ? undefined : 'đã đổi' });
    days.push({ tu: 'cauVideo', den: 'cong:lenh', tt: vd.cauLenh ? 'cau' : 'ok' });
  }
  const anh = (url: string | null, w: number, ten: string, soSanh?: { ten: string; url: string }[]) => url
    ? <img src={anhNho(url, nacNho(w))} alt="" data-so-sanh={soSanh?.length ? JSON.stringify(soSanh) : undefined} draggable={false} onDoubleClick={(e) => { e.stopPropagation(); moNgan({ loai: 'xem', url, ten }); }} title="Rê để xem to · nhấp đúp để mở" style={{ width: w, aspectRatio: tl, objectFit: 'cover', borderRadius: 4, display: 'block', background: '#000' }} />
    : <div style={{ width: w, aspectRatio: tl, border: '1px dashed var(--line)', borderRadius: 4, display: 'grid', placeItems: 'center', fontSize: 10, color: 'var(--fg-3)' }}>không có</div>;
  const cong = (id: string, nhan: string, url: string | null, tt: TT) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: -12 }}>
      <span ref={(e) => dat(`cong:${id}`, e)} style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--bg-1)', border: `2px solid ${MAU[tt]}`, flexShrink: 0 }} />
      {url && anh(url, ngang ? 34 : 20, nhan)}
      <span style={{ fontSize: 10, color: 'var(--fg-2)' }}>{nhan}</span>
    </div>
  );
  const wNho = ngang ? 112 : 64;
  const cot = (children: ReactNode, w?: number) => <div style={{ display: 'grid', gap: 10, alignContent: 'center', width: w }}>{children}</div>;
  const cauNgan = (s: string) => s.replace(/\s+/g, ' ').slice(0, 90) + (s.length > 90 ? '…' : '');
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <b style={{ fontSize: 12 }}>#{d.thu_tu} {d.canh}</b>
        <span style={{ flex: 1 }} />
        {Object.keys(vt).length > 0 && <button type="button" className="xv-lienket xv-mono" onClick={() => setVt({})} title="Đưa mọi thẻ về chỗ xếp sẵn">↺ xếp lại</button>}
        {(['ok', 'cau', 'doi', 'mo'] as TT[]).map((t) => <span key={t} style={{ ...mono, display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 14, height: 2, background: MAU[t] }} />{NHAN_TT[t]}</span>)}
      </div>
      {/* Bàn node */}
      <div style={{ overflowX: 'auto', borderRadius: 8, background: 'radial-gradient(circle, rgba(255,255,255,.07) 1px, transparent 1px) 0 0 / 16px 16px, var(--bg-0, #0b0b0d)', border: '1px solid var(--line)' }}>
        <div ref={khung} style={{ position: 'relative', display: 'flex', gap: 56, alignItems: 'center', padding: 16, minWidth: 'max-content' }}>
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}>
            {duong.map((x, i) => <g key={i}>
              <path d={x.p} fill="none" stroke={MAU[x.tt]} strokeWidth={x.tt === 'doi' ? 2.5 : 1.8} strokeDasharray={x.tt === 'mo' ? '4 4' : x.tt === 'cau' ? '7 4' : undefined} opacity={0.9} />
              {x.nhan && <text x={x.x} y={x.y - 5} textAnchor="middle" fontSize={10} fill={MAU[x.tt]} style={{ paintOrder: 'stroke', stroke: '#0b0b0d', strokeWidth: 3 }}>{x.nhan}</text>}
            </g>)}
          </svg>
          {cot(<>
            {d.thamChieu.map((v, i) => (
              <The key={v.url + i} id={`ref${i}`} tieuDe={`${i + 1}. ${v.nhan.split(' · ')[0]}`} chon={chon === `ref${i}`} onChon={() => setChon(`ref${i}`)} w={wNho + 64} dat={dat} lech={vt[`ref${i}`]} onKeo={keo}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>{anh(v.url, ngang ? 56 : 30, v.nhan)}<span style={{ fontSize: 10, color: 'var(--fg-2)', lineHeight: 1.25 }}>{v.nhan.split(' · ').slice(1).join(' · ')}</span></div>
              </The>
            ))}
            {!d.thamChieu.length && <div style={{ ...mono, width: 150 }}>Không có ảnh tham chiếu — model vẽ theo chữ.</div>}
            <The id="cauAnh" tieuDe="📝 Câu lệnh ảnh" tt={!kf ? 'mo' : kf.cauLenh ? 'cau' : 'ok'} chon={chon === 'cauAnh'} onChon={() => setChon('cauAnh')} w={wNho + 64} dat={dat} lech={vt["cauAnh"]} onKeo={keo}>
              <div style={{ ...mono, fontSize: 9.5, lineHeight: 1.3 }}>{cauNgan(d.promptAnhNay)}</div>
              {kf?.cauLenh && <div style={{ fontSize: 10, color: 'var(--amber)' }}>+{kf.cauLenh.them.length} / −{kf.cauLenh.bot.length} câu so lúc sinh</div>}
            </The>
          </>)}
          {cot(<>
            <The id="kf" tieuDe="🖼 Keyframe" tt={kf ? ttBuoc(kf) : d.keyframe_url ? 'mo' : undefined} chon={chon === 'kf'} onChon={() => setChon('kf')} w={ngang ? 210 : 130} dat={dat} lech={vt["kf"]} onKeo={keo}>
              {anh(d.keyframe_url, ngang ? 196 : 116, 'Keyframe đang chọn', d.thamChieu.map((v) => ({ ten: v.nhan, url: v.url })))}
              <div style={mono}>{kf ? `${kf.model.replace(/^fal:/, '').split('/').pop()} · ${tien(kf.chi_phi_cents)}` : d.keyframe_url ? 'không do xưởng sinh' : 'chưa có'}</div>
            </The>
            {(d.khungCuoiNay || vd?.khungCuoi) && (
              <The id="ke" tieuDe="⏭ Keyframe shot sau" tt={vd && (vd.khungCuoi ?? null) !== d.khungCuoiNay ? 'doi' : 'ok'} chon={chon === 'ke'} onChon={() => setChon('ke')} w={wNho + 16} dat={dat} lech={vt["ke"]} onKeo={keo}>
                {anh(d.khungCuoiNay, wNho, 'Keyframe shot sau (khung cuối giờ sẽ dùng)')}
              </The>
            )}
            {vd && <The id="cauVideo" tieuDe="📝 Câu lệnh video" tt={vd.cauLenh ? 'cau' : 'ok'} chon={chon === 'cauVideo'} onChon={() => setChon('cauVideo')} w={ngang ? 210 : 150} dat={dat} lech={vt["cauVideo"]} onKeo={keo}>
              <div style={{ ...mono, fontSize: 9.5, lineHeight: 1.3 }}>{cauNgan(d.promptVideoNay)}</div>
              {vd.cauLenh && <div style={{ fontSize: 10, color: 'var(--amber)' }}>+{vd.cauLenh.them.length} / −{vd.cauLenh.bot.length} câu so lúc sinh</div>}
            </The>}
          </>)}
          {cot(
            <The id="clip" tieuDe={`🎬 Clip${vd?.xuLySau ? ` · ${vd.xuLySau}` : ''}`} tt={vd ? ttBuoc(vd) : d.video_url ? 'mo' : undefined} chon={chon === 'clip'} onChon={() => setChon('clip')} w={ngang ? 240 : 150} dat={dat} lech={vt["clip"]} onKeo={keo}>
              {vd && <div style={{ display: 'grid', gap: 5, paddingBottom: 4 }}>
                {cong('dau', 'khung đầu', vd.khungDau, vd.khungDau && vd.khungDau !== d.keyframe_url ? 'doi' : 'ok')}
                {(d.khungCuoiNay || vd.khungCuoi) && cong('cuoi', 'khung cuối', vd.khungCuoi, (vd.khungCuoi ?? null) === d.khungCuoiNay ? 'ok' : 'doi')}
                {cong('lenh', 'câu lệnh', null, vd.cauLenh ? 'cau' : 'ok')}
              </div>}
              {d.video_url ? <video src={d.video_url} muted loop playsInline preload="metadata" onMouseEnter={(e) => void e.currentTarget.play().catch(() => {})} onMouseLeave={(e) => e.currentTarget.pause()} onDoubleClick={() => moNgan({ loai: 'xem', url: d.video_url!, ten: `Clip #${d.thu_tu}` })}
                style={{ width: '100%', aspectRatio: tl, objectFit: 'cover', borderRadius: 4, background: '#000', display: 'block' }} /> : <div style={mono}>chưa có clip</div>}
              <div style={mono}>{vd ? `${vd.model.replace(/^fal:/, '').split('/').slice(-2).join('/')} · ${tien(vd.chi_phi_cents)}` : d.video_url ? 'không do xưởng sinh' : ''}</div>
            </The>, ngang ? 240 : 150)}
        </div>
      </div>
      {/* Chi tiết node đang chọn */}
      <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 10 }}>
        {chon === 'kf' || chon === 'cauAnh' ? (kf ? <ChiTiet b={kf} tieuDe="Keyframe — lần sinh ra ảnh đang chọn" /> : <div style={mono}>{d.keyframe_url ? 'Keyframe không do xưởng sinh (tải lên / lấy từ kho) — không có câu lệnh.' : 'Chưa có keyframe.'}</div>)
          : chon === 'clip' || chon === 'cauVideo' ? (vd ? <ChiTiet b={vd} tieuDe={vd.xuLySau ? `Clip gốc (clip đang dùng là bản ${vd.xuLySau})` : 'Clip — lần sinh ra clip đang dùng'} /> : <div style={mono}>{d.video_url ? 'Clip không do xưởng sinh (lấy từ kho / tải lên).' : 'Chưa có clip.'}</div>)
          : chon === 'ke' ? <div style={{ fontSize: 12 }}>Khung cuối của clip = keyframe shot sau (tập bật nối khung). {vd && (vd.khungCuoi ?? null) !== d.khungCuoiNay ? <span style={{ color: 'var(--red)' }}>Lúc sinh clip dùng khung cuối khác — keyframe shot sau đã đổi, clip này nối không còn liền; sinh lại clip để khớp.</span> : 'Khớp với lúc sinh clip.'}</div>
          : (() => { const i = Number(chon.slice(3)); const v = d.thamChieu[i]; if (!v) return null; return (
              <div style={{ display: 'grid', gap: 4, fontSize: 12 }}><b>Ảnh tham chiếu {i + 1}: {v.nhan}</b>
                <div style={mono}>{!kf ? 'chưa có keyframe do xưởng sinh' : !daDung ? 'keyframe sinh trước 11/10/2026 — job không ghi ảnh đã dùng' : daDung.includes(v.url) ? '✓ đã dùng khi sinh keyframe đang chọn' : 'MỚI — thêm sau khi sinh keyframe; keyframe hiện tại chưa theo ảnh này'}</div>
                <button type="button" className="xv-lienket xv-mono" style={{ justifySelf: 'start' }} onClick={() => moNgan({ loai: 'xem', url: v.url, ten: v.nhan })}>phóng to ảnh</button>
              </div>); })()}
        {daDung && daDung.filter((u) => !d.thamChieu.some((v) => v.url === u)).length > 0 && <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: 6 }}>Lúc sinh keyframe còn {daDung.filter((u) => !d.thamChieu.some((v) => v.url === u)).length} ảnh tham chiếu nay không dùng nữa.</div>}
      </div>
    </div>
  );
}
