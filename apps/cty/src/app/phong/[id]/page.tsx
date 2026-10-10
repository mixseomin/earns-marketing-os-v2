import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser, loginUrl } from '@/lib/auth';
import { phong, dsNhanSu, soDo, KHUON } from '@/lib/cong-ty';
import { Avatar, hueOf } from '@/components/avatar';
import { SoDoKhuon } from '@/components/so-do-khuon';
import { SvgTuongTac } from '@/components/svg-tuong-tac';
import { PhongThu } from '@/components/phong-thu';
import { DoDac } from '@/components/do-dac';
import { Md } from '@/components/md';

export const dynamic = 'force-dynamic';

export default async function TrangPhong({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getCurrentUser();
  if (!me) redirect(loginUrl(`/phong/${id}`));
  const p = phong(id); if (!p) notFound();
  const tatCa = dsNhanSu(); const ns = tatCa.filter((d) => d.fm.phong === id);
  const ten = Object.fromEntries(tatCa.map((d) => [String(d.fm.ten), d.id]));
  const k = KHUON[String(p.fm.khuon)];
  const svg = p.fm.so_do ? soDo(String(p.fm.so_do)) : '';
  return (
    <>
      <p className="cty-mono cty-muted" style={{ margin: 0 }}><a href="/">sơ đồ</a> › {String(p.fm.ten)} · <span className="cty-pill">{k?.ten ?? String(p.fm.khuon)}</span> <span className="cty-pill cty-pill-off">chưa hoạt động</span></p>
      <SvgTuongTac ten={ten}>{svg ? <figure className="cty-so-do" dangerouslySetInnerHTML={{ __html: svg }} /> : <SoDoKhuon p={p} ns={ns} />}</SvgTuongTac>
      <div className="cty-row">
        {ns.map((d) => (
          <Link key={d.id} href={`/nhan-su/${d.id}`} className="cty-nguoi">
            <Avatar seed={d.id} hue={hueOf(id)} size={36} />
            <span><b>{String(d.fm.ten)}</b><br /><small className="cty-muted">{String(d.fm.chuc_danh)}</small></span>
          </Link>
        ))}
      </div>
      <DoDac p={p} ns={ns} />
      {String(p.fm.thu_nghiem) === 'true' && <PhongThu admin={me.role === 'admin'} />}
      <details className="cty-details"><summary>Chi tiết phòng</summary>
        <dl className="cty-kv">
          <dt>Khuôn</dt><dd>{k ? `${k.ten} — ${k.mota}` : String(p.fm.khuon)}</dd>
          <dt>Trưởng phòng</dt><dd>{String(p.fm.truong ?? '')}</dd>
          <dt>Đơn vị việc</dt><dd>{String(p.fm.don_vi_viec ?? '')}</dd>
          <dt>Cổng người</dt><dd>{String(p.fm.cong_nguoi ?? '')}</dd>
        </dl>
        <Md>{p.body}</Md>
      </details>
    </>
  );
}
