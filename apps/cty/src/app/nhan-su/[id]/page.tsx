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
      <p className="cty-mono cty-muted" style={{ margin: 0 }}><a href="/">sơ đồ</a> › {p ? <Link href={`/phong/${p.id}`}>{String(p.fm.ten)}</Link> : String(f.phong)}</p>
      <div className="cty-head-nhan-su">
        <Avatar seed={id} hue={hueOf(String(f.phong))} size={72} />
        <div>
          <h1 style={{ margin: 0 }}>{String(f.ten)}</h1>
          <div>{String(f.chuc_danh)}</div>
          <div className="cty-pills">
            <span className="cty-pill cty-pill-kind">{f.kind === 'ai' ? '🤖 AI' : f.kind === 'human' ? '👤 người' : '🏷 vendor'}</span>
            <span className="cty-pill">{String(f.model)}</span>
            <span className="cty-pill">mức {String(f.muc_quyet)} · {MUC[Number(f.muc_quyet)] ?? ''}</span>
            <span className="cty-pill">{KHUON[String(f.room)]?.ten ?? String(f.room)}</span>
            <span className="cty-pill cty-pill-off">heartbeat tắt{f.lich ? ` · khi bật: ${String(f.lich)}` : ''}</span>
            {f.tran_usd_thang ? <span className="cty-pill">trần ${String(f.tran_usd_thang)}/tháng</span> : null}
            {f.bao_cao_cho ? <Link className="cty-pill" href={`/nhan-su/${String(f.bao_cao_cho)}`}>báo cáo → {String(f.bao_cao_cho)}</Link> : <span className="cty-pill">báo cáo → Giám đốc</span>}
          </div>
        </div>
      </div>
      <details className="cty-details"><summary>Vai · KPI · quyền · cấm</summary><Md>{d.body}</Md></details>
      <details className="cty-details"><summary>Kỹ năng · gói số</summary>
        <dl className="cty-kv"><dt>Kỹ năng</dt><dd className="cty-mono">{arr('skills').join(' · ') || '—'}</dd><dt>Gói số đọc</dt><dd className="cty-mono">{arr('data').join(' · ') || '—'}</dd></dl>
      </details>
      {hb && <details className="cty-details"><summary>HEARTBEAT.md</summary><Md>{hb}</Md></details>}
    </>
  );
}
