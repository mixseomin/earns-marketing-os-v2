// ĐỘI NGŨ: toàn bộ nhân sự + chỉ số đo được của bộ não từng người + đề xuất (dữ liệu: các đợt dò model đã trả tiền, src/lib/doi-ngu.ts).
import { redirect } from 'next/navigation';
import { getCurrentUser, loginUrl } from '@/lib/auth';
import { ChongNgan } from '@/components/ngan/chong';
import { TabPhong } from '@/components/tab-phong';
import { Nguoi } from '@/components/nguoi';
import { doiNgu, tongChiDo, tacDungTinhCach, ketVanDai, canhBao, tenModel, pc, VAI, TEN_VAI, NGUONG_CANH_BAO, type TK, type Nguoi as NS, COT_VAI } from '@/lib/doi-ngu';
import { TINH_CACH } from '../../../worker/tinh-cach.mjs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Đội ngũ' };

const tien = (x: number) => `$${x.toFixed(x >= 1 ? 2 : 3).replace('.', ',')}`;
const usd = (moiGoi: number) => tien(moiGoi * 1000);   // giá 1.000 lời gọi
const Diem = ({ s, chinh }: { s: TK | null; chinh?: boolean }) =>
  s ? <span className={chinh ? 'cty-dn-chinh' : 'cty-muted'} title={`${s.dung}/${s.n} đúng · khoảng tin cậy 95%: ${pc(s.kt95[0])}–${pc(s.kt95[1])}`}>{pc(s.ti_le)}</span> : <span className="cty-muted">—</span>;
const NHAN_MUC = { giu: 'Giữ', doi: 'Nên đổi', 'chua-do': 'Chưa đo' } as const;

export default async function TrangDoiNgu({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!(await getCurrentUser())) redirect(loginUrl('/nhan-su'));
  const { k, ds } = doiNgu(); const chi = tongChiDo(); const tc = tacDungTinhCach(); const van = ketVanDai();
  const models = k ? [...new Set(VAI.flatMap((v) => Object.keys(k.theo_vai[v] ?? {})))] : [];
  const tb = (m: string) => VAI.reduce((s, v) => s + (k?.theo_vai[v]?.[m]?.ti_le ?? 0), 0) / VAI.length;
  const giaTb = (m: string) => VAI.reduce((s, v) => s + (k?.theo_vai[v]?.[m]?.usd_goi ?? 0), 0) / VAI.length;
  const aiDung = (m: string) => ds.filter((d) => d.model === m);
  const nhom = (muc: NS['deXuat']['muc']) => ds.filter((d) => d.deXuat.muc === muc);
  const diem = (x: number) => Math.round(x * 100);
  const chenhModel = k ? Math.max(...VAI.map((v) => { const ts = Object.values(k.theo_vai[v] ?? {}).filter((s) => s.n).map((s) => s.ti_le); return ts.length ? Math.max(...ts) - Math.min(...ts) : 0; })) : 0;
  const chenhTc = tc.length ? Math.max(...tc.map((x) => Math.abs(x.chenh))) : 0; const tcNhieu = tc.filter((x) => x.p >= 0.05).length;
  return (
    <>
      <h1>Đội ngũ</h1>
      <p className="cty-muted cty-nho" style={{ margin: '0 0 .5rem' }}>
        {ds.length} nhân sự · chỉ số gốc = điểm đo của bộ não (model) trên bộ đo chuẩn, hồ sơ trung tính · {k ? `đợt ${k.dot}, ${k.so_goi.toLocaleString('vi-VN')} lời gọi` : 'chưa có đợt đo'} · mọi đợt đo đã chi {tien(chi.usd)} ({chi.goi.toLocaleString('vi-VN')} lời gọi)
      </p>
      {!k ? <p>Chưa có kết quả dò model trên máy chủ (worker/do-model.mjs).</p> : (
        <TabPhong khoa="doi-ngu" tabs={[{ key: 'ns', nhan: 'Nhân sự', so: ds.length }, { key: 'ss', nhan: 'So sánh bộ não', so: models.length }, { key: 'dx', nhan: 'Đề xuất', so: nhom('doi').length }]}>
          <div className="cty-dn-cuon">
            <table className="cty-viec cty-dn cty-dn-ns">
              <thead><tr><th>Người</th><th>Phòng</th><th>Vai chính</th><th>Bộ não</th>{VAI.map((v) => <th key={v} className="cty-so" title={TEN_VAI[v]}>{COT_VAI[v]}</th>)}<th className="cty-so" title="Giá 1.000 lời gọi ở vai chính của người đó">$/1.000 lời gọi vai chính</th><th>Đề xuất</th></tr></thead>
              <tbody>{ds.map((d) => (
                <tr key={d.id}>
                  <td><Nguoi id={d.id} /></td><td className="cty-muted">{d.phongTen}</td><td title={d.giuVai.join(' · ') || d.chucDanh}>{TEN_VAI[d.vai]}</td>
                  <td className="cty-nho">{tenModel(d.model)}</td>
                  {VAI.map((v) => <td key={v} className="cty-so"><Diem s={d.chiSo[v]} chinh={v === d.vai} /></td>)}
                  <td className="cty-so cty-muted">{d.chiSo[d.vai] ? usd(d.chiSo[d.vai]!.usd_goi) : '—'}</td>
                  <td title={d.deXuat.chu}><span className={`cty-pill${d.deXuat.muc === 'doi' ? ' cty-pill-off' : d.deXuat.muc === 'chua-do' ? ' cty-pill-kind' : ''}`}>{NHAN_MUC[d.deXuat.muc]}</span></td>
                </tr>))}</tbody>
            </table>
            <p className="cty-muted cty-nho">Số đậm = vai người đó đang giữ. Rê chuột lên số để xem số câu đúng và khoảng tin cậy.</p>
          </div>
          <div className="cty-dn-cuon">
            <table className="cty-viec cty-dn cty-dn-ss">
              <thead><tr><th>Bộ não</th><th>Ai đang dùng</th>{VAI.map((v) => <th key={v} className="cty-so" title={TEN_VAI[v]}>{COT_VAI[v]}</th>)}<th className="cty-so" title="Trung bình giá 1.000 lời gọi của ba vai">$/1.000 lời gọi TB 3 vai</th><th>Đáng chú ý</th></tr></thead>
              <tbody>{models.sort((a, b) => tb(b) - tb(a)).map((m) => {
                const dung = aiDung(m); const chu = VAI.flatMap((v) => canhBao(v, k.theo_vai[v][m])).join(' · ');
                return (
                  <tr key={m}>
                    <td>{tenModel(m)}</td>
                    <td>{dung.length ? <span className="cty-nho">{dung.slice(0, 3).map((d, i) => <span key={d.id}>{i > 0 && ', '}<Nguoi id={d.id} anh={false} /></span>)}{dung.length > 3 && ` +${dung.length - 3}`}</span> : <span className="cty-pill cty-pill-kind">ứng viên</span>}</td>
                    {VAI.map((v) => <td key={v} className="cty-so"><Diem s={k.theo_vai[v][m] ?? null} chinh={k.de_xuat[v]?.model === m} /></td>)}
                    <td className="cty-so cty-muted">{usd(giaTb(m))}</td><td className="cty-muted cty-nho">{chu}</td>
                  </tr>);
              })}</tbody>
            </table>
            <p className="cty-muted cty-nho">Số đậm = lựa chọn đáng tiền nhất của vai (kém người giỏi nhất ≤ 5 điểm, lấy rẻ nhất). &quot;Ứng viên&quot; = bộ não đã đo, chưa ai dùng. &quot;Đáng chú ý&quot; = thói xấu gặp ở từ {pc(NGUONG_CANH_BAO)} số mẫu trở lên.</p>
            <h3>Tính cách có đổi điểm không</h3>
            <table className="cty-viec cty-dn">
              <thead><tr><th>Chỉ số · mức</th>{VAI.map((v) => <th key={v} className="cty-so" title={TEN_VAI[v]}>{COT_VAI[v]}</th>)}</tr></thead>
              <tbody>{[...new Set(tc.map((x) => `${x.chi_so}|${x.muc}`))].sort().map((key) => {
                const [cs, muc] = key.split('|'); const xs = tc.filter((x) => x.chi_so === cs && String(x.muc) === muc);
                return (<tr key={key}><td>{(TINH_CACH as Record<string, { ten: string }>)[cs!]?.ten ?? cs} {muc}</td>
                  {VAI.map((v) => { const ys = xs.filter((x) => x.vai === v).sort((a, b) => a.model.localeCompare(b.model)); const lon = ys.filter((y) => y.p < 0.05);
                    return <td key={v} className="cty-so cty-nho">{ys.length ? <>{ys.map((y) => `${y.chenh >= 0 ? '+' : ''}${Math.round(y.chenh * 100)}`).join(' / ')}{lon.length > 0 && <b title={lon.map((y) => `${tenModel(y.model)} p=${y.p.toFixed(3)}`).join(', ')}> ★</b>}</> : '—'}</td>; })}</tr>);
              })}</tbody>
            </table>
            <p className="cty-muted cty-nho">Chênh điểm so với hồ sơ trung tính, theo thứ tự {[...new Set(tc.map((x) => x.model))].sort().map(tenModel).join(' / ')}. ★ = chênh thật (p &lt; 0,05), còn lại nằm trong nhiễu.
              {van && <> Văn dài, giám khảo máy chấm mù Sáng tạo 9 / 2 / ngang: {Object.entries(van).map(([m, v]) => `${tenModel(m)} ${v.s9}/${v.s2}/${v.ngang}`).join(' · ')}.</>}</p>
          </div>
          <div className="cty-dn-cuon cty-dn-dx">
            <h3>Theo vai</h3>
            <ul>{VAI.map((v) => { const c = k.de_xuat[v]; return c && <li key={v}><b>{TEN_VAI[v]}</b>: đáng tiền nhất {tenModel(c.model)} {pc(c.ti_le)} ({usd(c.usd_goi)}/1.000 lời gọi; giỏi nhất đo được {pc(c.gioi_nhat)}) · đường biên giá–điểm: {k.duong_bien[v].map(tenModel).join(' → ')}</li>; })}</ul>
            {(['doi', 'giu', 'chua-do'] as const).map((muc) => nhom(muc).length > 0 && (
              <section key={muc}>
                <h3>{muc === 'doi' ? 'Nên đổi bộ não' : muc === 'giu' ? 'Giữ nguyên' : 'Chưa đo được'} <span className="cty-tab-so">{nhom(muc).length}</span></h3>
                <ul>{nhom(muc).map((d) => (
                  <li key={d.id}><Nguoi id={d.id} /> <span className="cty-muted">· {TEN_VAI[d.vai]} · {tenModel(d.model)}</span> — {d.deXuat.chu}
                    {d.deXuat.re && muc === 'doi' && <span className="cty-muted">. {d.deXuat.re}</span>}
                    {d.deXuat.them.length > 0 && <span className="cty-muted"> ({d.deXuat.them.join('; ')})</span>}</li>))}</ul>
              </section>))}
            <h3>Tính cách</h3>
            <ul>
              {tc.length > 0 && <li>Bộ não quyết định năng lực: đổi model chênh tới {diem(chenhModel)} điểm, đổi tính cách chỉ tới ±{diem(chenhTc)} điểm ({tcNhieu}/{tc.length} phép so nằm trong nhiễu).</li>}
              <li>Tính cách chỉ có tác dụng ở model chịu nghe lời dặn (glm, haiku): Mềm mỏng 9 làm lời bác kèm cách sửa 27–41% → 76–87%; Sáng tạo 9 đổi bài viết dài ở glm. gpt-4o-mini gần như không đổi (đọc câu trả lời đợt tính cách 11/10/2026, không phải số máy tính lại).</li>
            </ul>
            <p className="cty-muted cty-nho">Đổi bộ não hay đổi người giữ vai là mức 3: Giám đốc ký.</p>
          </div>
        </TabPhong>
      )}
      <ChongNgan ngan={(await searchParams).ngan} />
    </>
  );
}
