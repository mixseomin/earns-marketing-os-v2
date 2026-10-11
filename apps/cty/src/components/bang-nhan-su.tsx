// BẢNG NHÂN SỰ — một bản cho trang Đội ngũ (/nhan-su, cả công ty) lẫn tab Nhân sự trong từng phòng (#1305): người · vai · bộ não ·
// điểm đo 3 vai · giá · đề xuất (dữ liệu src/lib/doi-ngu.ts). Trong phòng bỏ cột Phòng; vai = vai người đó giữ Ở phòng này.
import Link from 'next/link';
import { Nguoi } from './nguoi';
import { tenModel, pc, VAI, TEN_VAI, COT_VAI, type TK, type Nguoi as NS } from '@/lib/doi-ngu';

export const tien = (x: number) => `$${x.toFixed(x >= 1 ? 2 : 3).replace('.', ',')}`;
export const usd = (moiGoi: number) => tien(moiGoi * 1000);   // giá 1.000 lời gọi
export const Diem = ({ s, chinh }: { s: TK | null; chinh?: boolean }) =>
  s ? <span className={chinh ? 'cty-dn-chinh' : 'cty-muted'} title={`${s.dung}/${s.n} đúng · khoảng tin cậy 95%: ${pc(s.kt95[0])}–${pc(s.kt95[1])}`}>{pc(s.ti_le)}</span> : <span className="cty-muted">—</span>;
const NHAN_MUC = { giu: 'Giữ', doi: 'Nên đổi', 'chua-do': 'Chưa đo' } as const;

export function BangNhanSu({ ds, trongPhong = false }: { ds: NS[]; trongPhong?: boolean }) {
  return (
    <div className="cty-dn-cuon">
      <table className="cty-viec cty-dn">
        <thead><tr><th>Người</th>{!trongPhong && <th className="cty-an-hep">Phòng</th>}<th className="cty-an-hep">{trongPhong ? 'Vai ở phòng' : 'Vai chính'}</th><th className="cty-an-hep">Bộ não</th>
          {VAI.map((v) => <th key={v} className="cty-so" title={TEN_VAI[v]}>{COT_VAI[v]}</th>)}
          <th className="cty-so cty-an-hep" title="Giá 1.000 lời gọi ở vai đang tính của người đó">$/1.000 lời gọi<br />{trongPhong ? 'vai ở phòng' : 'vai chính'}</th><th>Đề xuất</th></tr></thead>
        <tbody>{ds.map((d) => (
          <tr key={d.id}>
            <td><Nguoi id={d.id} /></td>{!trongPhong && <td className="cty-muted cty-an-hep">{d.phongTen}</td>}<td className="cty-an-hep" title={d.giuVai.join(' · ') || d.chucDanh}>{TEN_VAI[d.vai]}</td>
            <td className="cty-nho cty-an-hep">{tenModel(d.model)}</td>
            {VAI.map((v) => <td key={v} className="cty-so"><Diem s={d.chiSo[v]} chinh={v === d.vai} /></td>)}
            <td className="cty-so cty-muted cty-an-hep">{d.chiSo[d.vai] ? usd(d.chiSo[d.vai]!.usd_goi) : '—'}</td>
            <td title={[d.deXuat.chu, ...d.deXuat.them].join(' · ')}><span className={`cty-pill${d.deXuat.muc === 'doi' ? ' cty-pill-off' : d.deXuat.muc === 'chua-do' ? ' cty-pill-kind' : ''}`}>{NHAN_MUC[d.deXuat.muc]}</span></td>
          </tr>))}</tbody>
      </table>
      <p className="cty-muted cty-nho">Số đậm = vai {trongPhong ? 'người đó giữ ở phòng này' : 'chính của người đó'}. Rê chuột lên số để xem số câu đúng và khoảng tin cậy; lên nhãn đề xuất để xem lý do.{trongPhong && <> So cả công ty: <Link href="/nhan-su">Đội ngũ</Link>.</>}</p>
    </div>
  );
}
