'use client';
// Sơ đồ nguồn của một shot (drawer 🔗, ý lấy từ MuseFlow): nguyên liệu → keyframe → clip, mỗi bước ghi model · giá · giờ và cờ đỏ khi nguồn
// đã đổi sau lúc sinh. Shot ra lệch (quần không giống mẫu, nối không liền) thì nhìn đây là biết thiếu/đổi chỗ nào. Chỉ đọc, 0đ.
import { useEffect, useState, type ReactNode } from 'react';
import { nguonCuaShot } from '@/lib/actions';
import { gioVN, tien } from '@/lib/xuong-video/kieu';
import type { BuocNguon, NguonShot } from '@/lib/xuong-video/phu-thuoc';
import { moNgan } from './ngan-chung';
import { mono } from './ui';

const anhNho = (url: string | null, nhan: string, w = 64, tl = '9 / 16') => url
  ? <button type="button" title={nhan} onClick={() => moNgan({ loai: 'xem', url, ten: nhan })} style={{ padding: 0, border: '1px solid var(--line)', borderRadius: 4, background: '#000', cursor: 'zoom-in', width: w }}>
      <img src={url} alt="" data-khong-phong-to="" style={{ width: '100%', aspectRatio: tl, objectFit: 'cover', display: 'block', borderRadius: 3 }} /></button>
  : <div title={nhan} style={{ width: w, aspectRatio: tl, border: '1px dashed var(--line)', borderRadius: 4, display: 'grid', placeItems: 'center', fontSize: 10, color: 'var(--fg-3)', textAlign: 'center' }}>không có</div>;

function Cot({ tieuDe, children }: { tieuDe: string; children: ReactNode }) {
  return <div style={{ flex: '1 1 220px', minWidth: 0, display: 'grid', gap: 6, alignContent: 'start', border: '1px solid var(--line)', borderRadius: 8, padding: 8 }}>
    <div style={{ ...mono, letterSpacing: 0.5 }}>{tieuDe}</div>{children}</div>;
}
const Mui = () => <div style={{ alignSelf: 'center', color: 'var(--fg-3)', fontSize: 18 }}>→</div>;

function ThongTin({ b }: { b: BuocNguon }) {
  return <>
    <div style={mono}>{b.model.replace(/^fal:/, '')} · {tien(b.chi_phi_cents)} · {gioVN(b.luc)} · job #{b.job}</div>
    {b.doi.map((d) => <div key={d} style={{ fontSize: 11.5, color: 'var(--red)' }}>⚠ {d}</div>)}
    {b.cauLenh && <details><summary style={{ fontSize: 11.5, color: 'var(--amber)', cursor: 'pointer' }}>Câu lệnh giờ khác lúc sinh: +{b.cauLenh.them.length} câu · −{b.cauLenh.bot.length} câu</summary>
      <div style={{ display: 'grid', gap: 3, marginTop: 4 }}>
        {b.cauLenh.them.map((c, i) => <div key={`t${i}`} style={{ ...mono, color: 'var(--lime)' }}>+ {c}</div>)}
        {b.cauLenh.bot.map((c, i) => <div key={`b${i}`} style={{ ...mono, color: 'var(--red)' }}>− {c}</div>)}
      </div></details>}
    {!b.doi.length && !b.cauLenh && <div style={{ fontSize: 11.5, color: 'var(--lime)' }}>✓ khớp nguồn hiện tại</div>}
    <details><summary style={{ fontSize: 11, color: 'var(--fg-3)', cursor: 'pointer' }}>Câu lệnh đã gửi</summary><div style={{ ...mono, whiteSpace: 'pre-wrap', marginTop: 4 }}>{b.prompt || '(job không ghi câu lệnh)'}</div></details>
  </>;
}

export function NguonShotNoiDung({ canhId }: { canhId: number }) {
  const [d, setD] = useState<NguonShot | null | undefined>(undefined);
  useEffect(() => { setD(undefined); void nguonCuaShot(canhId).then(setD); }, [canhId]);
  if (d === undefined) return <div style={mono}>đang đọc…</div>;
  if (!d) return <div style={mono}>Không thấy shot này.</div>;
  const daDung = d.keyframe?.thamChieuUrl;
  const tl = d.ti_le === '16:9' ? '16 / 9' : '9 / 16'; const rong = d.ti_le === '16:9' ? 1.8 : 1;
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ fontSize: 12 }}><b>#{d.thu_tu} {d.canh}</b> <span style={mono}>· nguyên liệu → keyframe → clip</span></div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'stretch' }}>
        <Cot tieuDe="NGUYÊN LIỆU (giờ sẽ dùng)">
          {d.thamChieu.length ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))', gap: 6 }}>
            {d.thamChieu.map((v, i) => (
              <div key={v.url + i} style={{ display: 'grid', gap: 2 }}>
                {anhNho(v.url, `${i + 1}. ${v.nhan}`)}
                <span style={{ fontSize: 10, lineHeight: 1.2, color: daDung && !daDung.includes(v.url) ? 'var(--amber)' : 'var(--fg-2)' }}>{i + 1}. {v.nhan}{daDung && !daDung.includes(v.url) ? ' · MỚI' : ''}</span>
              </div>
            ))}
          </div> : <div style={mono}>Shot không gắn đối tượng nào có ảnh — model tự vẽ theo chữ.</div>}
          {daDung === null && <div style={mono}>Keyframe sinh trước 11/10/2026 — job chưa ghi ảnh đã dùng, chỉ so được câu lệnh.</div>}
          {daDung && daDung.filter((u) => !d.thamChieu.some((v) => v.url === u)).length > 0 && <div style={{ fontSize: 11, color: 'var(--amber)' }}>Lúc sinh còn {daDung.filter((u) => !d.thamChieu.some((v) => v.url === u)).length} ảnh nay không dùng nữa.</div>}
        </Cot>
        <Mui />
        <Cot tieuDe="KEYFRAME ĐANG CHỌN">
          {anhNho(d.keyframe_url, 'Keyframe đang chọn', 110 * rong, tl)}
          {d.keyframe ? <ThongTin b={d.keyframe} /> : <div style={mono}>{d.keyframe_url ? 'Ảnh không do xưởng sinh (tải lên / lấy từ kho) — không có câu lệnh.' : 'Chưa có keyframe.'}</div>}
        </Cot>
        <Mui />
        <Cot tieuDe="CLIP ĐANG DÙNG">
          {d.video_url ? <video src={d.video_url} muted playsInline preload="metadata" onMouseEnter={(e) => void e.currentTarget.play().catch(() => {})} onMouseLeave={(e) => e.currentTarget.pause()} onClick={() => moNgan({ loai: 'xem', url: d.video_url!, ten: `Clip #${d.thu_tu}` })}
            style={{ width: 110 * rong, aspectRatio: tl, objectFit: 'cover', borderRadius: 4, background: '#000', cursor: 'zoom-in' }} /> : <div style={mono}>Chưa có clip.</div>}
          {d.video && <>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ display: 'grid', gap: 2 }}>{anhNho(d.video.khungDau, 'Khung đầu lúc sinh', 48 * rong, tl)}<span style={{ fontSize: 10 }}>khung đầu</span></div>
              <div style={{ display: 'grid', gap: 2 }}>{anhNho(d.video.khungCuoi, 'Khung cuối lúc sinh', 48 * rong, tl)}<span style={{ fontSize: 10 }}>khung cuối</span></div>
            </div>
            {d.video.xuLySau && <div style={mono}>Clip đang dùng là bản xử lý sau: {d.video.xuLySau}. Dưới là clip gốc.</div>}
            <ThongTin b={d.video} />
          </>}
          {d.video_url && !d.video && <div style={mono}>Clip không do xưởng sinh (lấy từ kho / tải lên).</div>}
        </Cot>
      </div>
    </div>
  );
}
