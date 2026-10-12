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
  return (
    <div style={{ display: 'grid', gap: 14, marginTop: 8 }}>
      <div style={mono}>{canh.length} shot · {gio(tong)} · {khoi.length} khối phân cảnh — bấm một thẻ để mở shot đó trên timeline</div>
      {khoi.map((k, ki) => {
        const pc = tap.phan_canh?.find((x) => x.ten === k.ten);
        const tu = k.ds[0]!.tu; const den = tu + k.ds.reduce((a, x) => a + giayPhat(x.c), 0);
        return (
          <section key={`${k.ten}-${ki}`} style={{ display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', borderBottom: '1px solid var(--line)', paddingBottom: 4 }}>
              <b style={{ fontSize: 13 }}>{k.ten || 'Chưa đặt phân cảnh'}</b>
              {pc?.beat && <span className="xv-mono" style={{ fontSize: 10.5, color: 'var(--cyan)' }}>{pc.beat}</span>}
              <span style={mono}>{gio(tu)}–{gio(den)} · {k.ds.length} shot</span>
              {pc?.muc_tieu && <span style={{ fontSize: 11.5, color: 'var(--fg-3)', flexBasis: '100%' }}>{pc.muc_tieu}</span>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${doc ? 150 : 220}px, 1fr))`, gap: 8 }}>
              {k.ds.map(({ c, tu: tc }) => {
                const anh = c.keyframe_url; const coVid = !!(c.video_cuoi_url || c.video_url);
                const loi = dongThoai(c, nhanVat).map((d) => d.loi).filter(Boolean).join(' ');
                const chu = chuManHien(c.chu_man);
                return (
                  <button key={c.id} type="button" onClick={() => onMo(c.id)} title={`#${c.thu_tu} ${c.canh}\n${c.hanh_dong}`}
                    style={{ all: 'unset', cursor: 'pointer', display: 'grid', alignContent: 'start', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--line)', background: 'var(--bg-1)' }}>
                    <div style={{ position: 'relative', aspectRatio: doc ? '9 / 16' : '16 / 9', background: anh ? `center / cover no-repeat url(${anh}), #111` : 'var(--bg-2)' }}>
                      <span className="xv-mono" style={{ position: 'absolute', left: 5, top: 5, fontSize: 10, padding: '1px 5px', borderRadius: 4, background: 'rgba(0,0,0,.65)', color: '#fff' }}>{gio(tc)}</span>
                      <span className="xv-mono" style={{ position: 'absolute', right: 5, top: 5, fontSize: 10, padding: '1px 5px', borderRadius: 4, background: 'rgba(0,0,0,.65)', color: coVid ? '#4ade80' : '#fff' }}>{coVid ? '▶ ' : ''}#{c.thu_tu} · {giayPhat(c)}s</span>
                      {!anh && <span style={{ ...mono, position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>chưa có hình</span>}
                      {chu && <span style={{ position: 'absolute', left: 6, right: 6, bottom: 6, textAlign: 'center', fontSize: 11, fontWeight: 800, color: '#facc15', textShadow: '0 1px 3px #000, 0 0 2px #000' }}>{chu}</span>}
                    </div>
                    <div style={{ padding: '6px 8px', display: 'grid', gap: 3 }}>
                      <span style={{ fontSize: 11.5, lineHeight: 1.35, color: loi ? 'var(--fg-1)' : 'var(--fg-4)' }}>{loi || c.canh || '—'}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
