'use client';
// Ngăn 🧩 KHUÔN VIDEO (moNgan({ loai: 'khuon' })): video dựng bằng khuôn, không AI — Front Porch Puzzles "Only ONE is spelled right".
// Mỗi dòng: đề (từ đích, chủ đề), ảnh nền, bản xuất (bấm xem), lúc xuất, lỗi. Xuất = 0đ (ffmpeg trên box3); Sinh nền = ~110₫ (bấm hai nhịp).
// Nguồn đề: puzzle-books/scripts/day-studio.mjs; bên đăng (dang-short.mjs) lấy file_url từ đây.
import { useEffect, useMemo, useState } from 'react';
import { layKhuon, sinhNenKhuonUi, xuatKhuonUi } from '@/lib/actions-khuon';
import type { DongKhuon } from '@/lib/xuong-video/khuon';
import { AnhNho, Loi, Nut, Seg, mono } from './ui';
import { moNgan } from './ngan-chung';

type Loc = 'tat_ca' | 'chua_xuat' | 'co_nen' | 'loi';
const GIA_NEN = 0.5;   // ¢ — ckey ~110₫ ≈ $0,004; trần ước để xác nhận

export function KhuonNoiDung() {
  const [ds, setDs] = useState<DongKhuon[] | null>(null);
  const [loi, setLoi] = useState('');
  const [ban, setBan] = useState<number | string | null>(null);
  const [loc, setLoc] = useState<Loc>('tat_ca');
  const nap = () => layKhuon().then((r) => (r.ok ? setDs(r.data) : setLoi(r.loi)));
  useEffect(() => { void nap(); }, []);
  const hien = useMemo(() => (ds ?? []).filter((k) => loc === 'tat_ca' || (loc === 'chua_xuat' ? !k.file_url : loc === 'co_nen' ? !!k.nen_url : !!k.loi)), [ds, loc]);
  const dem = (f: (k: DongKhuon) => boolean) => (ds ?? []).filter(f).length;
  const chay = async (khoa: number | string, fn: () => Promise<{ ok: boolean; loi?: string }>) => { setBan(khoa); setLoi(''); const r = await fn(); if (!r.ok) setLoi(r.loi ?? 'lỗi'); await nap(); setBan(null); };

  if (!ds) return <div style={mono}>{loi || 'đang đọc…'}</div>;
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ ...mono, fontSize: 11.5 }}>Video dựng bằng khuôn — không gọi AI, xuất trên máy chủ 0đ. Ảnh nền theo chủ đề là AI (~110₫, dùng chung cho mọi video cùng chủ đề).</div>
      <Seg<Loc> value={loc} onChange={setLoc} options={[
        { value: 'tat_ca', label: 'Tất cả', title: `${ds.length} video` }, { value: 'chua_xuat', label: 'Chưa xuất', title: `${dem((k) => !k.file_url)} video` },
        { value: 'co_nen', label: 'Có ảnh nền', title: `${dem((k) => !!k.nen_url)} video` }, { value: 'loi', label: 'Lỗi', title: `${dem((k) => !!k.loi)} video` }]} />
      <Loi>{loi}</Loi>
      <div style={{ overflowX: 'auto' }}>
        <table className="xv-bang" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead><tr style={{ textAlign: 'left', ...mono }}><th>Video</th><th>Từ đích</th><th>Nền</th><th>Bản xuất</th><th>Xuất lúc</th><th /></tr></thead>
          <tbody>
            {hien.map((k) => (
              <tr key={k.id} style={{ borderTop: '1px solid var(--line)' }}>
                <td style={{ padding: '6px 4px' }}><div>{k.chu_de}</div><div style={mono}>{k.du_an} · {k.slug}</div>{k.loi && <div style={{ color: 'var(--bad, #e5484d)', fontSize: 11.5 }}>{k.loi}</div>}</td>
                <td style={{ fontWeight: 700, letterSpacing: 1 }}>{k.de.dich}</td>
                <td>{k.nen_url ? <AnhNho url={k.nen_url} kich={36} title={k.nen_prompt ?? ''} onClick={() => moNgan({ loai: 'xem', url: k.nen_url!, ten: `Nền · ${k.chu_de}` })} /> : <span style={mono}>dải màu bìa</span>}</td>
                <td>{k.file_url ? <button type="button" className="xv-lienket" onClick={() => moNgan({ loai: 'xem', url: k.file_url!, ten: k.dang.title ?? k.slug })}>▶ xem</button> : <span style={mono}>chưa xuất</span>}</td>
                <td style={mono}>{k.xuat_luc ? new Date(k.xuat_luc).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '—'}</td>
                <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                  <Nut ban={ban === k.id} title="Dựng lại MP4 từ đề + ảnh nền hiện tại (ffmpeg trên máy chủ, 0đ)" onClick={() => void chay(k.id, () => xuatKhuonUi(k.id))}>{ban === k.id ? 'đang xuất…' : k.file_url ? '↻ Xuất lại' : 'Xuất'}</Nut>{' '}
                  <Nut gia={GIA_NEN} ban={ban === `n:${k.chu_de}`} title="Sinh ảnh nền AI cho chủ đề này (dùng chung mọi video cùng chủ đề) — xong thì bấm Xuất lại" onClick={() => void chay(`n:${k.chu_de}`, () => sinhNenKhuonUi(k.du_an, k.chu_de))}>{k.nen_url ? 'Nền mới' : 'Sinh nền'}</Nut>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!hien.length && <div style={mono}>Không có video nào khớp bộ lọc.</div>}
    </div>
  );
}
