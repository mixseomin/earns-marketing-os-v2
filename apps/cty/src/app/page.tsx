// cty.on.tc — sơ đồ tổ chức: phòng ban → nhân sự. Đợt 1 là tham quan: mọi heartbeat tắt, không gọi mô hình.
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser, loginUrl } from '@/lib/auth';
import { dsPhong, dsNhanSu, KHUON } from '@/lib/cong-ty';
import { TheNhanSu } from '@/components/the-nhan-su';

export const dynamic = 'force-dynamic';

export default async function Trang() {
  const me = await getCurrentUser();
  if (!me) redirect(loginUrl('/'));
  const phong = dsPhong(); const ns = dsNhanSu();
  const soAi = ns.filter((d) => d.fm.kind === 'ai').length;
  return (
    <>
      <div className="cty-banner"><b>Chế độ tham quan.</b> {ns.length} nhân sự ({soAi} AI) trong {phong.length} phòng đã có hồ sơ; heartbeat tắt, chưa gọi mô hình, chưa tốn tiền. Chưa có cơ chế bật: worker, proxy mô hình, bảng việc chưa dựng (<a href="https://mos2.on.tc/plays?view=tiendo&tdp=adfond&td=hm&tdId=115">sổ C06, bước 5</a>).</div>
      <h1>Sơ đồ tổ chức</h1>
      <p className="cty-muted">Giám đốc: anh — nhận một tin sáng, ký tối đa 3 quyết định/ngày. Luồng báo cáo: nhân viên → trưởng phòng → Minh → anh.</p>
      {phong.map((p) => {
        const nguoi = ns.filter((d) => d.fm.phong === p.id);
        const k = KHUON[String(p.fm.khuon)];
        return (
          <section key={p.id} className="cty-phong">
            <div className="cty-phong-head">
              <h2><Link href={`/phong/${p.id}`}>{String(p.fm.ten)}</Link></h2>
              {k && <span className="cty-pill">{k.ten}</span>}
              {p.fm.trang_thai && <span className="cty-pill cty-pill-off">{String(p.fm.trang_thai)}</span>}
              <span className="cty-mono cty-muted">{String(p.fm.tom_tat ?? '')}</span>
            </div>
            <div className="cty-grid">{nguoi.map((d) => <TheNhanSu key={d.id} d={d} />)}</div>
          </section>
        );
      })}
    </>
  );
}
