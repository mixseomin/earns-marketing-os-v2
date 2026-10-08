// /thu-vien — thư viện ngôn ngữ điện ảnh (#1195): cỡ cảnh, góc, chuyển động máy, ống kính, ánh sáng, màu, chuyển cảnh, âm thanh, nhạc;
// lọc theo thể loại (?tl=kinh_di). Claude chọn từ đúng danh sách này cho từng shot; đoạn prompt tiếng Anh được ghép khi sinh ảnh/video.
import { redirect } from 'next/navigation';
import { getCurrentUser, loginUrl } from '@/lib/auth';
import { THE_LOAI, NHOM_KY_THUAT, THU_VIEN, CAU_TRUC, hopTheLoai, type TheLoai } from '@/lib/xuong-video/dien-anh';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Thư viện điện ảnh' };

export default async function ThuVien({ searchParams }: { searchParams: Promise<{ tl?: string }> }) {
  const me = await getCurrentUser();
  if (!me) redirect(loginUrl('/thu-vien'));
  const tl = ((await searchParams).tl || '') as TheLoai | '';
  const chip = (href: string, chon: boolean, chu: string, title?: string) => (
    <a key={href} href={href} title={title} className="xv-mono" style={{ padding: '3px 10px', borderRadius: 999, border: `1px solid ${chon ? 'var(--cyan)' : 'var(--line)'}`, color: chon ? 'var(--fg-1)' : 'var(--fg-3)', textDecoration: 'none', background: chon ? 'var(--bg-2)' : 'none' }}>{chu}</a>
  );
  return (
    <div>
      <h2 style={{ margin: '0 0 6px' }}>🎬 Thư viện điện ảnh</h2>
      <div className="xv-mono" style={{ marginBottom: 10 }}>Claude chọn kỹ thuật cho từng shot từ thư viện này theo thể loại của phim; anh đổi được trong form shot. {THU_VIEN.length} kỹ thuật · {THE_LOAI.length} thể loại.</div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 14 }}>
        {chip('/thu-vien', !tl, 'Tất cả')}
        {THE_LOAI.map((t) => chip(`/thu-vien?tl=${t.key}`, tl === t.key, t.ten, t.mo_ta))}
      </div>
      {NHOM_KY_THUAT.map((n) => {
        const ds = THU_VIEN.filter((x) => x.nhom === n.key && (!tl || hopTheLoai(x, tl)));
        if (!ds.length) return null;
        return (
          <div key={n.key} className="xv-panel">
            <h3 style={{ margin: '0 0 8px' }}>{n.icon} {n.ten} <small>{ds.length}</small></h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
              {ds.map((x) => (
                <div key={x.key} className="xv-canh">
                  <b style={{ fontSize: 12.5 }}>{x.ten}</b> <span className="xv-mono">{x.key}</span>
                  <div style={{ fontSize: 11.5, color: 'var(--fg-2)', marginTop: 3 }}>{x.mo_ta}</div>
                  {x.prompt && <div className="xv-mono" style={{ marginTop: 4, color: 'var(--fg-4)' }}>prompt: {x.prompt}</div>}
                  <div className="xv-mono" style={{ marginTop: 4 }}>{x.the_loai === 'tat_ca' ? 'mọi thể loại' : x.the_loai.map((k) => THE_LOAI.find((t) => t.key === k)?.ten).join(' · ')}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <div className="xv-panel">
        <h3 style={{ margin: '0 0 8px' }}>📖 Cấu trúc beat theo loại phim</h3>
        {Object.entries(CAU_TRUC).map(([k, c]) => (
          <div key={k} style={{ marginBottom: 8 }}><b style={{ fontSize: 12.5 }}>{c.ten}</b>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>{c.beats.map((b, i) => <span key={b.ten} className="xv-mono" title={b.mo_ta} style={{ padding: '2px 8px', border: '1px solid var(--line)', borderRadius: 6 }}>{i + 1}. {b.ten}</span>)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
