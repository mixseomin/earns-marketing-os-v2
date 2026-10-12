'use client';
// Lưới kịch bản (13/10/2026 — "trình bày kiểu này để nắm được kịch bản tổng thể"): cả tập trên một màn, mỗi shot một thẻ — hình (bản cuối /
// nháp / keyframe), mốc giờ trong phim, chữ màn, lời đọc — xếp theo phân cảnh (tên · beat · mục tiêu). Bấm thẻ = mở shot đó trên timeline.
import { chuManHien, giayPhat, type Canh, type NhanVat, type Tap } from '@/lib/xuong-video/kieu';
import { dongThoai } from '@/lib/xuong-video/am-thanh';
import { mono } from './ui';

const gio = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function LuoiKichBan({ canh, nhanVat, tap, tiLe, onMo }: { canh: Canh[]; nhanVat: NhanVat[]; tap: Pick<Tap, 'phan_canh'>; tiLe?: string; onMo: (id: number) => void }) {
  const doc = tiLe !== '16:9';
  // Khối phân cảnh = các shot liền nhau cùng phan_doan (một phân cảnh có thể quay lại sau, mỗi lần là một khối).
  const khoi: { ten: string; ds: { c: Canh; tu: number }[] }[] = [];
  let t = 0;
  for (const c of canh) { const l = khoi[khoi.length - 1]; if (l && l.ten === c.phan_doan) l.ds.push({ c, tu: t }); else khoi.push({ ten: c.phan_doan, ds: [{ c, tu: t }] }); t += giayPhat(c); }
  const tong = t;
  // MỘT lưới liền (không xuống hàng theo phân cảnh — 2 thẻ một hàng thì không thấy tổng thể): mỗi thẻ có dải phân cảnh trên đầu,
  // thẻ đầu khối ghi tên + beat (màu theo khối), các thẻ sau cùng màu nhạt hơn — mắt vẫn thấy ranh giới phân cảnh.
  const MAU = ['#22d3ee', '#f472b6', '#a78bfa', '#facc15', '#4ade80', '#fb923c', '#60a5fa', '#f87171'];
  return (
    <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
      <div style={mono}>{canh.length} shot · {gio(tong)} · {khoi.length} khối phân cảnh — bấm một thẻ để mở shot đó trên timeline</div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${doc ? 132 : 210}px, 1fr))`, gap: 8 }}>
        {khoi.flatMap((k, ki) => {
          const pc = tap.phan_canh?.find((x) => x.ten === k.ten); const mau = MAU[ki % MAU.length]!;
          return k.ds.map(({ c, tu: tc }, i) => {
            const anh = c.keyframe_url; const coVid = !!(c.video_cuoi_url || c.video_url);
            const loi = dongThoai(c, nhanVat).map((d) => d.loi).filter(Boolean).join(' ');
            const chu = chuManHien(c.chu_man);
            return (
              <button key={c.id} type="button" onClick={() => onMo(c.id)} title={[`#${c.thu_tu} ${c.canh}`, c.hanh_dong, `Phân cảnh: ${k.ten}${pc?.beat ? ` (${pc.beat})` : ''}`, pc?.muc_tieu].filter(Boolean).join('\n')}
                style={{ all: 'unset', cursor: 'pointer', display: 'grid', alignContent: 'start', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--line)', borderTop: `3px solid ${mau}`, background: 'var(--bg-1)' }}>
                <div style={{ height: 18, padding: '0 6px', display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, whiteSpace: 'nowrap', overflow: 'hidden', background: i === 0 ? `color-mix(in srgb, ${mau} 18%, transparent)` : undefined }}>
                  {i === 0 ? <><b style={{ color: mau, overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.ten || 'Chưa đặt phân cảnh'}</b>{pc?.beat && <span className="xv-mono" style={{ color: 'var(--fg-3)' }}>{pc.beat}</span>}</> : <span style={{ color: 'var(--fg-4)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.ten}</span>}
                </div>
                <div style={{ position: 'relative', aspectRatio: doc ? '9 / 16' : '16 / 9', background: anh ? `center / cover no-repeat url(${anh}), #111` : 'var(--bg-2)' }}>
                  <span className="xv-mono" style={{ position: 'absolute', left: 4, top: 4, fontSize: 10, padding: '1px 4px', borderRadius: 4, background: 'rgba(0,0,0,.65)', color: '#fff' }}>{gio(tc)}</span>
                  <span className="xv-mono" style={{ position: 'absolute', right: 4, top: 4, fontSize: 10, padding: '1px 4px', borderRadius: 4, background: 'rgba(0,0,0,.65)', color: coVid ? '#4ade80' : '#fff' }}>{coVid ? '▶ ' : ''}#{c.thu_tu} · {giayPhat(c)}s</span>
                  {!anh && <span style={{ ...mono, position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>chưa có hình</span>}
                  {chu && <span style={{ position: 'absolute', left: 5, right: 5, bottom: 6, textAlign: 'center', fontSize: 10.5, fontWeight: 800, color: '#facc15', textShadow: '0 1px 3px #000, 0 0 2px #000' }}>{chu}</span>}
                </div>
                <div style={{ padding: '5px 7px', fontSize: 11, lineHeight: 1.35, color: loi ? 'var(--fg-1)' : 'var(--fg-4)' }}>{loi || c.canh || '—'}</div>
              </button>
            );
          });
        })}
      </div>
    </div>
  );
}
