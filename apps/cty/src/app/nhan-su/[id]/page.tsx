import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser, loginUrl } from '@/lib/auth';
import { nhanSu, heartbeat, phong, KHUON, MUC } from '@/lib/cong-ty';
import { Avatar, hueOf } from '@/components/avatar';
import { Md } from '@/components/md';

export const dynamic = 'force-dynamic';

export default async function TrangNhanSu({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getCurrentUser();
  if (!me) redirect(loginUrl(`/nhan-su/${id}`));
  const d = nhanSu(id); if (!d) notFound();
  const f = d.fm; const p = phong(String(f.phong));
  const arr = (k: string) => (Array.isArray(f[k]) ? (f[k] as string[]) : []);
  const hb = heartbeat(id);
  return (
    <>
      <p className="cty-mono cty-muted"><a href="/">sơ đồ</a> › {p ? <Link href={`/phong/${p.id}`}>{String(p.fm.ten)}</Link> : String(f.phong)} › nhân sự</p>
      <div className="cty-head-nhan-su">
        <Avatar seed={id} hue={hueOf(String(f.phong))} size={64} />
        <div><h1>{String(f.ten)}</h1><div>{String(f.chuc_danh)} <span className="cty-pill cty-pill-kind">{f.kind === 'ai' ? '🤖 AI' : f.kind === 'human' ? '👤 người' : '🏷 vendor'}</span></div></div>
      </div>
      <dl className="cty-kv">
        <dt>Mô hình</dt><dd className="cty-mono">{String(f.model)}</dd>
        <dt>Báo cáo cho</dt><dd>{f.bao_cao_cho ? <Link href={`/nhan-su/${String(f.bao_cao_cho)}`}>{String(f.bao_cao_cho)}</Link> : 'Giám đốc'}</dd>
        <dt>Khuôn phòng</dt><dd>{KHUON[String(f.room)]?.ten ?? String(f.room)}</dd>
        <dt>Mức quyết định</dt><dd>mức {String(f.muc_quyet)} ({MUC[Number(f.muc_quyet)] ?? ''}) · approval: {String(f.approval ?? 'STRICT')}</dd>
        <dt>Heartbeat</dt><dd><span className="cty-pill cty-pill-off">{f.heartbeat === 'off' ? 'tắt (tham quan)' : String(f.heartbeat)}</span> {f.lich ? <span className="cty-mono cty-muted">khi bật: {String(f.lich)}</span> : null}</dd>
        <dt>Kỹ năng</dt><dd className="cty-mono">{arr('skills').join(' · ') || '—'}</dd>
        <dt>Gói số đọc</dt><dd className="cty-mono">{arr('data').join(' · ') || '—'}</dd>
        {f.pay ? <><dt>Trả công</dt><dd>{String(f.pay)}</dd></> : null}
        <dt>Trần chi tháng</dt><dd>{f.tran_usd_thang != null && f.tran_usd_thang !== '' ? `$${String(f.tran_usd_thang)}` : '—'}</dd>
      </dl>
      <Md>{d.body}</Md>
      {hb && <><h2>HEARTBEAT.md</h2><Md>{hb}</Md></>}
    </>
  );
}
