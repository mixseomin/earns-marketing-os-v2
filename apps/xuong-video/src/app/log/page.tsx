// /log — sổ chi phí: mọi lần gọi AI (chữ Claude, ảnh Gemini/OpenAI, video Veo), giờ Việt Nam, tổng theo ngày + theo loại.
import { redirect } from 'next/navigation';
import { getCurrentUser, loginUrl } from '@/lib/auth';
import { soChiPhi, dsPhim } from '@/lib/actions';
import { tien } from '@/lib/xuong-video/kieu';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sổ chi phí' };

const gio = (iso: string) => new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit' });
const LOAI: Record<string, string> = { chu: 'Chữ (Claude)', anh: 'Ảnh', video: 'Video (Veo)' };

export default async function Log({ searchParams }: { searchParams: Promise<{ phim?: string; ngay?: string }> }) {
  const me = await getCurrentUser();
  if (!me) redirect(loginUrl('/log'));
  if (me.role !== 'admin') return <p className="xv-mono">Chỉ admin.</p>;
  const sp = await searchParams;
  const phimId = sp.phim ? Number(sp.phim) : undefined;
  const ngay = sp.ngay ? Number(sp.ngay) : 30;
  const [so, phim] = await Promise.all([soChiPhi({ phimId, ngay }), dsPhim()]);
  const tong = so.jobs.reduce((a, j) => a + j.chi_phi_cents, 0);
  const qs = (p: Record<string, string | number | undefined>) => '?' + Object.entries({ phim: phimId, ngay, ...p } as Record<string, string | number | undefined>).filter(([, v]) => v != null && String(v) !== '').map(([k, v]) => `${k}=${v}`).join('&');
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>💰 Sổ chi phí</h2>
        <span className="xv-mono">mỗi lần gọi AI một dòng · giá niêm yết · giờ Việt Nam</span>
        <span style={{ flex: 1 }} />
        <span className="xv-seg">{[1, 7, 30, 90].map((d) => <a key={d} href={qs({ ngay: d })}><button type="button" className={d === ngay ? 'on' : ''}>{d === 1 ? 'Hôm nay' : `${d} ngày`}</button></a>)}</span>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        <a href={qs({ phim: '' })} className="xv-btn" style={{ textDecoration: 'none', ...(phimId ? {} : { borderColor: 'var(--cyan)', color: 'var(--cyan)' }) }}>Mọi phim</a>
        {phim.map((p) => <a key={p.id} href={qs({ phim: p.id })} className="xv-btn" style={{ textDecoration: 'none', ...(phimId === p.id ? { borderColor: 'var(--cyan)', color: 'var(--cyan)' } : {}) }}>{p.ten} · {tien(p.chi_phi_cents)}</a>)}
      </div>
      <div className="xv-stats">
        <div className="xv-stat"><div className="l">Tổng {ngay === 1 ? 'hôm nay' : `${ngay} ngày`}</div><div className="v">{tien(tong)}</div><div className="s">{so.jobs.length} lần gọi</div></div>
        {so.theoLoai.map((l) => <div key={l.loai} className="xv-stat"><div className="l">{LOAI[l.loai] ?? l.loai}</div><div className="v">{tien(l.tien)}</div><div className="s">{l.so} lần</div></div>)}
      </div>
      {so.theoNgay.length > 1 && (
        <div className="xv-panel" style={{ padding: 0 }}>
          <table className="xv-tbl"><thead><tr><th>Ngày</th><th className="n">Lần gọi</th><th className="n">Chi phí</th></tr></thead>
            <tbody>{so.theoNgay.map((d) => <tr key={d.ngay}><td>{d.ngay.split('-').reverse().join('/')}</td><td className="n">{d.so}</td><td className="n">{tien(d.tien)}</td></tr>)}</tbody></table>
        </div>
      )}
      <div className="xv-panel" style={{ padding: 0 }}>
        <table className="xv-tbl">
          <thead><tr><th>Giờ</th><th>Phim</th><th>Loại</th><th>Việc</th><th>Model</th><th className="n">Token in/out</th><th>Kết quả</th><th className="n">Chi phí</th></tr></thead>
          <tbody>{so.jobs.map((j) => (
            <tr key={j.id}>
              <td className="xv-mono" style={{ whiteSpace: 'nowrap' }}>{gio(j.created_at)}</td>
              <td>{j.phim_id ? <a href={`/?m=phim&mId=${j.phim_id}`}>{j.phim_ten || `#${j.phim_id}`}</a> : '—'}</td>
              <td>{LOAI[j.loai] ?? j.loai}</td>
              <td>{j.nhan || '—'}</td>
              <td className="xv-mono">{j.provider} · {j.model}</td>
              <td className="n">{j.tokens_in || j.tokens_out ? `${j.tokens_in} / ${j.tokens_out}` : ''}</td>
              <td>{j.loi ? <span className="xv-loi" title={j.loi}>lỗi: {j.loi.slice(0, 70)}</span> : j.output_url ? <a href={j.output_url} target="_blank" rel="noreferrer">{j.loai === 'video' ? '▶ mp4' : '🖼 ảnh'}</a> : j.trang_thai === 'xong' ? '✓' : <span style={{ color: 'var(--violet)' }}>đang chạy</span>}</td>
              <td className="n"><b>{tien(j.chi_phi_cents)}</b></td>
            </tr>
          ))}</tbody>
        </table>
        {so.jobs.length === 0 && <p className="xv-mono" style={{ padding: 12 }}>Chưa có lần gọi nào trong khoảng này.</p>}
      </div>
    </div>
  );
}
