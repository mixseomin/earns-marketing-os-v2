import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser, loginUrl } from '@/lib/auth';
import { docText, cauHinh, dsPhong, dsNhanSu } from '@/lib/cong-ty';
import { Md } from '@/components/md';
export const dynamic = 'force-dynamic';
export default async function MucTieu() {
  const me = await getCurrentUser(); if (!me) redirect(loginUrl('/muc-tieu'));
  const ch = cauHinh(); const phong = dsPhong(); const ns = dsNhanSu().filter((d) => Number(d.fm.tran_usd_thang || 0) > 0);
  const tong = ns.reduce((s, d) => s + Number(d.fm.tran_usd_thang || 0), 0);
  return (
    <>
      <Md>{docText('muc-tieu.md')}</Md>
      <h3>Phong bì quý theo phòng (từ cau-hinh.md)</h3>
      <div className="cty-md"><table><thead><tr><th>Phòng</th><th>Phong bì / quý</th></tr></thead><tbody>
        {phong.map((p) => <tr key={p.id}><td><Link href={`/phong/${p.id}`}>{String(p.fm.ten)}</Link></td><td>${String(ch[`phong_bi_quy_${p.id}`] ?? 0)}</td></tr>)}
      </tbody></table></div>
      <h3>Trần chi API tháng theo người (từ SOUL.md) — tổng {`$${tong}`} / trần tổng {`$${String(ch.tran_tong_usd_thang ?? '?')}`}</h3>
      <div className="cty-md"><table><thead><tr><th>Người</th><th>Mô hình</th><th>Trần / tháng</th></tr></thead><tbody>
        {ns.map((d) => <tr key={d.id}><td><Link href={`/nhan-su/${d.id}`}>{String(d.fm.ten)}</Link></td><td className="cty-mono">{String(d.fm.model)}</td><td>${String(d.fm.tran_usd_thang)}</td></tr>)}
      </tbody></table></div>
    </>
  );
}
