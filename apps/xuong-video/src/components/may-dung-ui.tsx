'use client';
// Khối 🎞 MÁY DỰNG trong tab Phim của phim thể loại 'may_dung' (may-dung.ts): đề (từ đích + 36 ô, ô đúng tô màu), ảnh nền theo chủ đề, chữ đăng.
// Dựng keyframe / clip / bản xuất = nút ⬇ Xuất của tập (0đ). Sinh nền = ~65–110₫ (bấm hai nhịp), xong thì xuất lại để nền vào bản dựng.
import { useState } from 'react';
import { sinhNenMayDungUi } from '@/lib/actions-may-dung';
import { banHien, gioVN, type Canh, type Phim, type Tap } from '@/lib/xuong-video/kieu';
import { luoi } from '@/lib/xuong-video/may-dung-do-chu';
import { MAU_MAY_DUNG } from '@/lib/xuong-video/may-dung-mau';
import { AnhNho, Loi, Nut, mono } from './ui';
import { moNgan } from './ngan-chung';

const GIA_NEN = 0.5;   // ¢ — trần ước để xác nhận (ckey thật ~65–110₫)

export function MayDungPanel({ phim, onChanged }: { phim: Phim; onChanged: () => void }) {
  const k = phim.kinh_thanh?.may_dung;
  const [ban, setBan] = useState(false);
  const [loi, setLoi] = useState('');
  if (!k) return null;
  const L = luoi(k.de);
  return (
    <div className="xv-panel" style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <b>🎞 Máy Dựng · {MAU_MAY_DUNG[k.mau]?.ten ?? k.mau}</b>
        <span style={mono}>{k.du_an} · {k.slug} · chủ đề {k.chu_de} — dựng bằng máy, không AI; keyframe / clip / bản xuất bấm ⬇ Xuất ở tập (0đ)</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: 14, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 6, justifyItems: 'center' }}>
          {k.nen_url ? <AnhNho url={k.nen_url} kich={110} title={k.nen_prompt ?? ''} onClick={() => moNgan({ loai: 'xem', url: k.nen_url!, ten: `Nền · ${k.chu_de}` })} />
            : <div style={{ width: 62, height: 110, borderRadius: 6, background: k.de.mau.sau, display: 'grid', placeItems: 'center', ...mono, color: k.de.mau.truoc }}>dải màu</div>}
          <Nut gia={GIA_NEN} ban={ban} title="Sinh ảnh nền AI theo chủ đề (không chữ) — xong thì ⬇ Xuất lại" onClick={async () => { setBan(true); setLoi(''); const r = await sinhNenMayDungUi(phim.id); if (!r.ok) setLoi(r.loi ?? 'lỗi'); setBan(false); onChanged(); }}>{ban ? 'đang sinh…' : k.nen_url ? 'Nền mới' : 'Sinh nền'}</Nut>
        </div>
        <div style={{ display: 'grid', gap: 8, minWidth: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 2, color: k.de.mau.nhan }}>{k.de.dich}</div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${L.cot}, minmax(0, 1fr))`, gap: 2, maxWidth: 520 }}>
            {k.de.o.map((w, i) => <span key={i} style={{ ...mono, fontSize: 10.5, padding: '1px 4px', borderRadius: 3, textAlign: 'center', background: i === k.de.cho ? k.de.mau.nhan : 'transparent', color: i === k.de.cho ? '#111' : 'var(--fg-2)' }}>{w}</span>)}
          </div>
          {k.dang.title && <div style={{ fontSize: 12.5 }}><span style={mono}>Tiêu đề đăng:</span> {k.dang.title}</div>}
          {k.dang.link && <div style={mono}>Link: {k.dang.link}</div>}
        </div>
      </div>
      <Loi>{loi}</Loi>
    </div>
  );
}

/** Tab Storyboard của phim MÁY DỰNG (anh 17/10/2026: "không giống gì cả… rối quá"): chữ / đồng hồ / đáp án đã nằm SẴN trong hình do máy dựng,
 *  nên không đi timeline của phim AI (lớp chữ màn đè lên keyframe = chữ hai lần, nút sinh keyframe / video / giọng không dùng tới). Chỉ có:
 *  video sẽ đăng (bản xuất mới nhất) + 3 thẻ shot — clip cắt từ bản dựng, chưa xuất thì khung xem trước cùng bộ lọc (may-dung.ts › khungXemTruoc). */
export function MayDungStoryboard({ tap, canh }: { tap: Tap; canh: Canh[] }) {
  const ban = banHien(tap.xuat).chinh;
  const giay = (c: Canh) => c.phat_s ?? c.thoi_luong_s ?? 0;
  const khung = { width: '100%', aspectRatio: '9 / 16', borderRadius: 8, background: '#000', objectFit: 'cover' as const };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 300px) minmax(0, 1fr)', gap: 14, marginTop: 8, alignItems: 'start' }}>
      <div className="xv-panel" style={{ display: 'grid', gap: 6 }}>
        <b style={{ fontSize: 12 }}>Video sẽ đăng</b>
        {ban ? <video key={ban.url} src={ban.url} controls preload="metadata" style={khung} />
          : <span style={mono}>Chưa xuất. Khung bên phải cắt đúng từ bản dựng; bấm ⬇ Xuất ở tab Xuất để ra video (0đ).</span>}
        {ban && <span style={mono}>{ban.giay}s · xuất {gioVN(ban.luc)}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${canh.length}, minmax(0, 1fr))`, gap: 10 }}>
        {canh.map((c, i) => {
          const clip = c.video_cuoi_url || c.video_url, t0 = canh.slice(0, i).reduce((a, x) => a + giay(x), 0);
          return (
            <div key={c.id} className="xv-panel" style={{ display: 'grid', gap: 6, alignContent: 'start' }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>#{c.thu_tu} {c.canh}</span>
              <span style={mono}>{t0.toFixed(1)}–{(t0 + giay(c)).toFixed(1)}s</span>
              {clip ? <video src={clip} poster={c.keyframe_url ?? undefined} controls muted playsInline preload="none" style={khung} />
                : c.keyframe_url ? <img src={c.keyframe_url} alt={c.canh} style={khung} />
                : <div style={{ ...khung, display: 'grid', placeItems: 'center', ...mono }}>chưa có khung</div>}
              <span style={{ fontSize: 12, lineHeight: 1.45 }}>{c.hanh_dong_vi || c.hanh_dong}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
