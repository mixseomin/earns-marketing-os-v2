'use client';
// Sổ chi phí — mọi lần gọi AI (chữ, ảnh, video, âm), giờ Việt Nam. Dùng chung cho drawer 💰 và trang /log; lọc tại chỗ, không điều hướng.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { soChiPhi, dsPhim } from '@/lib/actions';
import { tien, gioVN, type Phim } from '@/lib/xuong-video/kieu';
import { moNgan } from './ngan-chung';

const LOAI: Record<string, string> = { chu: 'Chữ (Claude)', anh: 'Ảnh', video: 'Video', am: 'Âm thanh', xuat: 'Bản xuất' };

export function SoChiPhi({ phimDau }: { phimDau?: number }) {
  const router = useRouter();
  const [phimId, setPhimId] = useState<number | undefined>(phimDau);
  const [ngay, setNgay] = useState(30);
  const [so, setSo] = useState<Awaited<ReturnType<typeof soChiPhi>> | null>(null);
  const [phim, setPhim] = useState<Phim[]>([]);
  useEffect(() => { void dsPhim().then(setPhim); }, []);
  useEffect(() => { setSo(null); void soChiPhi({ phimId, ngay }).then(setSo); }, [phimId, ngay]);
  const tong = so?.jobs.reduce((a, j) => a + j.chi_phi_cents, 0) ?? 0;
  return (
    <div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
        {[1, 7, 30, 90].map((d) => <button key={d} type="button" className={`xv-btn${d === ngay ? ' chinh' : ''}`} onClick={() => setNgay(d)}>{d === 1 ? 'Hôm nay' : `${d} ngày`}</button>)}
        <span style={{ width: 8 }} />
        <button type="button" className={`xv-btn${phimId == null ? ' chinh' : ''}`} onClick={() => setPhimId(undefined)}>Mọi phim</button>
        {phim.map((p) => <button key={p.id} type="button" className={`xv-btn${phimId === p.id ? ' chinh' : ''}`} onClick={() => setPhimId(p.id)}>{p.ten} · {tien(p.chi_phi_cents)}</button>)}
      </div>
      {!so ? <span className="xv-mono">đang tải…</span> : (<>
        <div className="xv-stats">
          <div className="xv-stat"><div className="l">Tổng {ngay === 1 ? 'hôm nay' : `${ngay} ngày`}</div><div className="v">{tien(tong)}</div><div className="s">{so.jobs.length} lần gọi</div></div>
          {so.theoLoai.map((l) => <div key={l.loai} className="xv-stat"><div className="l">{LOAI[l.loai] ?? l.loai}</div><div className="v">{tien(l.tien)}</div><div className="s">{l.so} lần</div></div>)}
        </div>
        <div className="xv-panel" style={{ padding: 0 }}>
          <table className="xv-tbl">
            <thead><tr><th>Giờ</th><th>Phim</th><th>Việc</th><th>Model</th><th>Kết quả</th><th className="n">Chi phí</th></tr></thead>
            <tbody>{so.jobs.map((j) => (
              <tr key={j.id}>
                <td className="xv-mono" style={{ whiteSpace: 'nowrap' }}>{gioVN(j.created_at, { giay: true })}</td>
                <td>{j.phim_id ? <button type="button" className="xv-lienket" onClick={() => router.push(`/?m=phim&mId=${j.phim_id}`)}>{j.phim_ten || `#${j.phim_id}`}</button> : '—'}</td>
                <td title={LOAI[j.loai] ?? j.loai}>{j.nhan || LOAI[j.loai] || j.loai}</td>
                <td className="xv-mono" title={j.tokens_in || j.tokens_out ? `token ${j.tokens_in} / ${j.tokens_out}` : undefined}>{j.model}</td>
                <td>{j.loi ? <span className="xv-loi" title={j.loi}>lỗi: {j.loi.slice(0, 60)}</span> : j.output_url ? <button type="button" className="xv-lienket" onClick={() => moNgan({ loai: 'xem', url: j.output_url!, ten: j.nhan })}>{/\.(mp4|webm|mov)$/i.test(j.output_url) ? '▶ xem' : /\.(mp3|wav|m4a)$/i.test(j.output_url) ? '♪ nghe' : '🖼 xem'}</button> : j.trang_thai === 'xong' ? '✓' : <span className="xv-mono">đang chạy</span>}</td>
                <td className="n"><b>{tien(j.chi_phi_cents)}</b></td>
              </tr>
            ))}</tbody>
          </table>
          {so.jobs.length === 0 && <p className="xv-mono" style={{ padding: 12 }}>Chưa có lần gọi nào trong khoảng này.</p>}
        </div>
      </>)}
    </div>
  );
}
