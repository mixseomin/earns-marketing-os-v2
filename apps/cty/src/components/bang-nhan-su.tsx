// BẢNG NHÂN SỰ — một bản cho trang Đội ngũ (/nhan-su, cả công ty) lẫn tab Nhân sự trong từng phòng (#1305): người · vai · bộ não ·
// điểm đo 3 vai · giá · đề xuất (dữ liệu src/lib/doi-ngu.ts) · phụ trách (quy trình chủ trì + việc đang mở, src/lib/trach-nhiem.ts).
// Trong phòng bỏ cột Phòng, vai = vai người đó giữ Ở phòng này, phụ trách chỉ tính trong phòng.
import Link from 'next/link';
import { Nguoi } from './nguoi';
import { tenModel, pc, VAI, TEN_VAI, COT_VAI, type TK, type Nguoi as NS } from '@/lib/doi-ngu';
import { demTn, type TrachNhiem } from '@/lib/trach-nhiem';
import { vaiCuaPhong, theVai } from '../../worker/quy-trinh.mjs';
import { NHIP, TAN_SUAT } from '../../worker/nhip.mjs';
import { nhanSu, type Doc } from '@/lib/cong-ty';
import { soChi } from '@/lib/do-dac';

// số nhỏ (nhịp glm ~$0,0001/lần) giữ đủ chữ số có nghĩa — làm tròn 3 số lẻ thì tiền thật hiện thành $0,000 như chưa tiêu
export const tien = (x: number) => `$${x.toFixed(x >= 1 ? 2 : x === 0 || x >= 0.001 ? 3 : 5).replace('.', ',')}`;
export const usd = (moiGoi: number) => tien(moiGoi * 1000);   // giá 1.000 lời gọi
export const Diem = ({ s, chinh }: { s: TK | null; chinh?: boolean }) =>
  s ? <span className={chinh ? 'cty-dn-chinh' : 'cty-muted'} title={`${s.dung}/${s.n} đúng · khoảng tin cậy 95%: ${pc(s.kt95[0])}–${pc(s.kt95[1])}`}>{pc(s.ti_le)}</span> : <span className="cty-muted">—</span>;
const NHAN_MUC = { giu: 'Giữ', doi: 'Nên đổi', 'chua-do': 'Chưa đo' } as const;
/** Tên vai người đó giữ Ở phòng này theo hồ sơ phòng (Thị trường, Kênh kéo khách…) — TEN_VAI chỉ có 3 vai được đo điểm. */
const vaiO = (phong: string, id: string) => Object.entries(vaiCuaPhong(phong) as Record<string, string>).filter(([, ai]) => ai === id).map(([v]) => (theVai(v) as { ten?: string } | null)?.ten ?? v).join(' · ');

/** NHỊP của một người (anh 13/10/2026: "phải có tần suất heartbeat, cost hàng tháng — mọi bảng nhân sự"): việc · tần suất · ca, hoặc tắt. */
export function nhipChu(fm: Record<string, unknown>) {
  const hb = String(fm.heartbeat ?? 'off'); if (hb === 'off') return { chu: 'tắt', bat: false, viec: 'tắt' } as { chu: string; bat: boolean; viec: string; tanSuat?: string; ca?: string };
  const may = hb.split(',').map((v) => v.trim()).filter((v) => v in NHIP);
  if (!may.length) return { chu: hb, bat: true, viec: hb };
  const ca = fm.ca ? String(fm.ca) : 'cả ngày';
  return { chu: `${may.join(', ')} · ${TAN_SUAT} · ca ${ca}`, bat: true, viec: may.join(', '), tanSuat: TAN_SUAT, ca };
}
export async function BangNhanSu({ ds, trongPhong = false, tn, phong }: { ds: NS[]; trongPhong?: boolean; tn?: TrachNhiem; phong?: string }) {
  const docs = ds.map((d) => nhanSu(d.id)).filter(Boolean) as Doc[];
  const so = await soChi(docs, trongPhong ? phong : undefined);   // trong phòng: chỉ tiền làm cho phòng này (anh 13/10/2026)   // null = không nối DB → ô báo "?" chứ không phải $0
  const chi = (id: string) => so ? so.ds.filter((r) => r.nguoi === id).reduce((t, r) => t + (r.usd ?? 0), 0) : null;
  return (
    <div className="cty-dn-cuon">
      <table className="cty-viec cty-dn">
        <thead><tr><th>Người</th>{!trongPhong && <th className="cty-an-hep">Phòng</th>}<th className="cty-an-hep">{trongPhong ? 'Vai ở phòng' : 'Vai chính'}</th><th className="cty-an-hep">Bộ não</th>
          {VAI.map((v) => <th key={v} className="cty-so" title={TEN_VAI[v]}>{COT_VAI[v]}</th>)}
          <th className="cty-so cty-an-hep" title="Giá 1.000 lời gọi ở vai đang tính của người đó">$/1.000 lời gọi<br />{trongPhong ? 'vai ở phòng' : 'vai chính'}</th><th>Đề xuất</th><th className="cty-an-hep" title="Việc tự làm theo nhịp (worker/nhip.mjs)">Nhịp</th><th className="cty-an-hep">Tần suất</th><th className="cty-an-hep" title="Giờ làm, giờ VN">Ca</th><th className="cty-so cty-an-hep" title={trongPhong ? 'Tiền mô hình thật tháng này người đó tiêu CHO PHÒNG NÀY (sổ ai_usage) / trần tháng của người đó (mọi phòng cộng lại) — chạm trần thì proxy chặn' : 'Tiền mô hình thật tháng này, mọi phòng (sổ ai_usage) / trần tháng trong hồ sơ — chạm trần thì proxy chặn'}>{trongPhong ? 'Chi ở phòng này' : 'Chi tháng này'}</th><th className="cty-so cty-an-hep" title="Trần chi tháng của người đó (mọi phòng cộng lại) — chạm trần thì proxy chặn">Trần / tháng</th>{tn && <th className="cty-so cty-an-hep" title="Số quy trình chịu trách nhiệm chính · số việc đang mở (kể cả việc máy làm thay)">Phụ trách</th>}</tr></thead>
        <tbody>{ds.map((d) => (
          <tr key={d.id}>
            <td><Nguoi id={d.id} /></td>{!trongPhong && <td className="cty-muted cty-an-hep">{d.phongTen}</td>}<td className="cty-an-hep" title={d.giuVai.join(' · ') || d.chucDanh}>{(phong && vaiO(phong, d.id)) || TEN_VAI[d.vai]}</td>
            <td className="cty-nho cty-an-hep">{tenModel(d.model)}</td>
            {VAI.map((v) => <td key={v} className="cty-so"><Diem s={d.chiSo[v]} chinh={v === d.vai} /></td>)}
            <td className="cty-so cty-muted cty-an-hep">{d.chiSo[d.vai] ? usd(d.chiSo[d.vai]!.usd_goi) : '—'}</td>
            <td title={[d.deXuat.chu, ...d.deXuat.them].join(' · ')}><span className={`cty-pill${d.deXuat.muc === 'doi' ? ' cty-pill-off' : d.deXuat.muc === 'chua-do' ? ' cty-pill-kind' : ''}`}>{NHAN_MUC[d.deXuat.muc]}</span></td>
            {((fm) => { const n = nhipChu(fm); const c = chi(d.id); const tr = Number(fm.tran_usd_thang || 0); return <>
              <td className={`cty-nho cty-an-hep${n.bat ? '' : ' cty-muted'}`}>{n.viec}</td>
              <td className="cty-nho cty-an-hep">{n.tanSuat ?? <span className="cty-muted">—</span>}</td>
              <td className="cty-nho cty-an-hep">{n.ca ?? <span className="cty-muted">—</span>}</td>
              <td className="cty-so cty-an-hep" title={so ? `${so.ds.filter((r) => r.nguoi === d.id).reduce((t, r) => t + r.luot, 0)} lời gọi tháng này` : 'không nối được DB'}>{c === null ? <span className="cty-thu-loi">?</span> : tien(c)}</td>
              <td className="cty-so cty-an-hep cty-muted">{tr ? tien(tr) : '—'}</td></>; })(nhanSu(d.id)?.fm ?? {})}
            {tn && ((x) => <td className="cty-so cty-an-hep" title={`${x.chuTri} quy trình chủ trì · ${x.lam} được giao làm · ${x.viec} việc đang mở${x.tre ? ` (${x.tre} máy trễ)` : ''}`}>
              <b>{x.chuTri}</b> · <b className={x.tre ? 'cty-thu-loi' : ''}>{x.viec}</b></td>)(demTn(tn, d.id, phong))}
          </tr>))}</tbody>
      </table>
      <p className="cty-muted cty-nho">Số đậm = vai {trongPhong ? 'người đó giữ ở phòng này' : 'chính của người đó'}. Rê chuột lên số để xem số câu đúng và khoảng tin cậy; lên nhãn đề xuất để xem lý do.{trongPhong && <> So cả công ty: <Link href="/nhan-su">Đội ngũ</Link>.</>}</p>
    </div>
  );
}
