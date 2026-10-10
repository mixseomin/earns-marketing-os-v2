import { notFound, redirect } from 'next/navigation';
import { getCurrentUser, loginUrl } from '@/lib/auth';
import { phong, dsNhanSu, soDo, KHUON } from '@/lib/cong-ty';
import { TheNhanSu } from '@/components/the-nhan-su';
import { Md } from '@/components/md';

export const dynamic = 'force-dynamic';

export default async function TrangPhong({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getCurrentUser();
  if (!me) redirect(loginUrl(`/phong/${id}`));
  const p = phong(id); if (!p) notFound();
  const ns = dsNhanSu().filter((d) => d.fm.phong === id);
  const k = KHUON[String(p.fm.khuon)];
  const svg = p.fm.so_do ? soDo(String(p.fm.so_do)) : '';
  return (
    <>
      <p className="cty-mono cty-muted"><a href="/">sơ đồ</a> › phòng</p>
      <h1>{String(p.fm.ten)}</h1>
      <dl className="cty-kv">
        <dt>Khuôn</dt><dd>{k ? `${k.ten} — ${k.mota}` : String(p.fm.khuon)}</dd>
        <dt>Trưởng phòng</dt><dd>{String(p.fm.truong ?? '')}</dd>
        <dt>Đơn vị việc</dt><dd>{String(p.fm.don_vi_viec ?? '')}</dd>
        <dt>Cổng người</dt><dd>{String(p.fm.cong_nguoi ?? '')}</dd>
        <dt>Trạng thái</dt><dd><span className="cty-pill cty-pill-off">{String(p.fm.trang_thai ?? 'tham quan · chưa hoạt động')}</span></dd>
      </dl>
      {svg && <figure className="cty-so-do" dangerouslySetInnerHTML={{ __html: svg }} />}
      <h2>Nhân sự</h2>
      <div className="cty-grid">{ns.map((d) => <TheNhanSu key={d.id} d={d} />)}</div>
      <Md>{p.body}</Md>
    </>
  );
}
