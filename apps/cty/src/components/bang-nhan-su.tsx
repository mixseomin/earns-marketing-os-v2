// BẢNG NHÂN SỰ — một bản cho trang Đội ngũ (/nhan-su, cả công ty) lẫn tab Nhân sự trong từng phòng (#1305): người · vai · bộ não ·
// điểm đo 3 vai · giá · đề xuất (dữ liệu src/lib/doi-ngu.ts) · phụ trách (quy trình chủ trì + việc đang mở, src/lib/trach-nhiem.ts).
// Trong phòng bỏ cột Phòng, vai = vai người đó giữ Ở phòng này, phụ trách chỉ tính trong phòng.
import Link from 'next/link';
import { Nguoi } from './nguoi';
import { tenModel, pc, VAI, TEN_VAI, COT_VAI, type TK, type Nguoi as NS } from '@/lib/doi-ngu';
import { demTn, type TrachNhiem } from '@/lib/trach-nhiem';
import { vaiCuaPhong, theVai } from '../../worker/quy-trinh.mjs';
import { NHIP, NHIP_MAY, TEN_NHIP, docChinh, lanLam, tanSuat, dauViec } from '../../worker/nhip.mjs';
import { hrefNhip } from '@/lib/ngan';
import { viecMayCua, hong, nhipMay, lichNguoi, tenViec, moHinh, dangChay, henAp } from '../../worker/viec-may.mjs';
import { ChinhCa } from './chinh-ca';
import { ChinhLich, type Lich } from './chinh-lich';
import { docLich, choAp, lichCua, KHONG_TAT } from '../../worker/lich-may.mjs';
import { NutTuLam } from './nut-tu-lam';
import { getCurrentUser } from '@/lib/auth';
import { mocCuoiCa } from '../../worker/gio-lam.mjs';
import { nhanSu, type Doc } from '@/lib/cong-ty';
import { soChi } from '@/lib/do-dac';
import { docLog } from '../../worker/log.mjs';
import { TruocDay } from './truoc-day';

// số nhỏ (nhịp glm ~$0,0001/lần) giữ đủ chữ số có nghĩa — làm tròn 3 số lẻ thì tiền thật hiện thành $0,000 như chưa tiêu
export const tien = (x: number) => `$${x.toFixed(x >= 1 ? 2 : x === 0 || x >= 0.001 ? 3 : 5).replace('.', ',')}`;
export const usd = (moiGoi: number) => tien(moiGoi * 1000);   // giá 1.000 lời gọi
export const Diem = ({ s, chinh }: { s: TK | null; chinh?: boolean }) =>
  s ? <span className={chinh ? 'cty-dn-chinh' : 'cty-muted'} title={`${s.dung}/${s.n} đúng · khoảng tin cậy 95%: ${pc(s.kt95[0])}–${pc(s.kt95[1])}`}>{pc(s.ti_le)}</span> : <span className="cty-muted">—</span>;
const NHAN_MUC = { giu: 'Giữ', doi: 'Nên đổi', 'chua-do': 'Chưa đo' } as const;
/** Tên vai người đó giữ Ở phòng này theo hồ sơ phòng (Thị trường, Kênh kéo khách…) — TEN_VAI chỉ có 3 vai được đo điểm. */
const vaiO = (phong: string, id: string) => Object.entries(vaiCuaPhong(phong) as Record<string, string>).filter(([, ai]) => ai === id).map(([v]) => (theVai(v) as { ten?: string } | null)?.ten ?? v).join(' · ');

/** NHỊP của một người (anh 13/10/2026: "phải có tần suất heartbeat, cost hàng tháng — mọi bảng nhân sự"): việc · tần suất · ca, hoặc tắt. */
export function nhipChu(fm0: Record<string, unknown>, id?: string) {
  const c = id ? ((docChinh() as Record<string, Record<string, unknown>>)[id] ?? {}) : {};   // chỉnh của admin đè hồ sơ (worker/nhip.mjs)
  const fm: Record<string, unknown> = { ...fm0, ...(c.ca ? { ca: c.ca } : {}), ...(c.diem_danh !== undefined ? { diem_danh: c.diem_danh } : {}), ...(c.kiem_moi ? { kiem_moi: c.kiem_moi } : {}) };
  type DV = { ma: string; ten: string; lich: string; gio?: string };
  type Nhip = { chu: string; bat: boolean; coNut?: boolean; chiXem?: boolean; soChay?: number; box?: boolean; viec: string; ds: DV[]; tanSuat?: string; ca?: string; diemDanh?: string; kiemMoi?: number; nhipMay?: string };
  // không có nhịp cty mà có VIỆC MÁY đang chạy (timer/cron/LaunchAgent, worker/viec-may.mjs) → người đó đang làm: bật, nhịp = việc chạy dày nhất
  const nm = id ? nhipMay(id) as { so: number; chay: number; nhanh: string } : { so: 0, chay: 0, nhanh: '' };
  // chấm của người chỉ có việc máy = bật/tắt MỌI việc máy người đó (nút muc nguoi:<id>); tắt hết vẫn giữ chấm xám để bật lại
  const theoMay = (): Nhip => ({ chu: nm.chay ? `${nm.chay}/${nm.so} việc máy đang chạy · nhịp ${nm.nhanh}` : `${nm.so} việc máy đều đang tắt`, bat: nm.chay > 0, coNut: true, chiXem: true, soChay: nm.chay,
    viec: nm.chay ? `${nm.chay}/${nm.so} việc máy đang chạy` : `${nm.so} việc máy đều đang tắt`, ds: [], nhipMay: nm.chay ? nm.nhanh : undefined });
  const hb = String(fm.heartbeat ?? 'off'); if (hb === 'off') return (nm.so ? theoMay() : { chu: 'tắt', bat: false, viec: 'tắt', ds: [] }) as Nhip;
  const may = hb.split(',').map((v) => v.trim()).filter((v) => v in NHIP || v in NHIP_MAY);
  if (!may.length) return (nm.so ? theoMay() : { chu: hb, bat: true, viec: hb, ds: [] }) as Nhip;
  const tat = c.bat === false;   // admin tắt ở cột Tự làm (nút NutTuLam) — hồ sơ vẫn khai việc, chỉ không chạy
  const ca = fm.ca ? String(fm.ca) : 'cả ngày';
  const ten = may.map((v) => (TEN_NHIP as Record<string, string>)[v] ?? v).join(' · ') + (fm.diem_danh ? ` · điểm danh ${String(fm.diem_danh)} · báo cáo cuối ngày ${mocCuoiCa(fm.ca)}` : '');
  const ts = tanSuat(Number(fm.kiem_moi || 1));
  const ds = dauViec({ viec: may, ca: fm.ca, diemDanh: fm.diem_danh ? String(fm.diem_danh) : '', kiemMoi: Number(fm.kiem_moi || 1), gio: c.gio ? String(c.gio) : '' }) as DV[];
  return { chu: tat ? `${ten} · đang tắt` : `${ten} · máy kiểm ${ts} · ca ${ca}`, bat: !tat, coNut: true, box: may.some((v) => v in NHIP), viec: ten, ds, nhipMay: nm.chay ? nm.nhanh : undefined, tanSuat: ts, ca, diemDanh: String(fm.diem_danh ?? ''), kiemMoi: Number(fm.kiem_moi || 1) };
}
type ViecMay = { id: string; ma: string; ten: string; may: string; loai: string; lich: string; ket?: string; tiep?: string; chua_gan?: boolean };
/** Lịch một việc máy, chỉnh tại chỗ (ô dùng chung ChinhLich): ý muốn còn chờ áp thì hiện ý muốn đó + "chờ áp"; áp lỗi thì đỏ. Chạy liền → chỉ chữ. */
export function LichViec({ v, admin }: { v: ViecMay; admin: boolean }) {
  const goc = moHinh(v) as Lich | { kieu: 'lien' } | null; const x = (docLich() as Record<string, { luc: string; ap?: { ok: boolean; loi: string } }>)[v.id];
  if (goc?.kieu === 'lien') return <span className="cty-lich-o" title="Việc chạy liền (KeepAlive) — không có lịch">chạy liền</span>;
  const cho = choAp(x); const lich = cho ? (lichCua(x) as Lich) : (goc as Lich | null);
  return <ChinhLich muc={`may:${v.id}`} lich={lich} chu={lichNguoi(v) as string} admin={admin} apSau={henAp(v.may) as string} trang={{ cho, loi: !cho && x?.ap && !x.ap.ok ? x.ap.loi : undefined }} />;
}
/** Tên một việc máy kèm chấm bật/tắt riêng của việc đó (bảng nhân sự + ngăn việc máy). */
export function TenViecMay({ v, admin, href }: { v: ViecMay; admin: boolean; href: string }) {
  const x = (docLich() as Record<string, { luc: string; bat?: boolean; ap?: { luc: string } }>)[v.id]; const cho = choAp(x) && x!.bat !== undefined;
  return <span className="cty-ten-viec"><NutTuLam muc={`viec:${v.id}`} bat={cho ? !!x!.bat : (dangChay(v) as boolean)} cho={cho} admin={admin} khoa={(KHONG_TAT as Record<string, string>)[v.id]} />
    <Link href={href} title={`${tenViec(v)} — ${v.ma}`}>{tenViec(v)}</Link></span>;
}
/** Lần làm việc gần nhất của từng người: dòng nhật ký mới nhất do chính người đó phát ra (gọi mô hình, gửi tin) — nhịp chạy mà không có
 *  việc thì không ghi nhật ký, nên không tính là "làm". Một lượt đọc cho cả bảng. */
function lanCuoi(ids: string[]) {
  const ra: Record<string, { luc: string; ket?: string }> = {}; const can = new Set(ids);
  for (const e of docLog({ n: 5000 }) as { tu?: string; ts?: string; loai?: string }[]) if (e.tu && can.has(e.tu) && !ra[e.tu] && e.ts) ra[e.tu] = { luc: e.ts, ket: e.loai === 'goi' ? 'gọi mô hình' : String(e.loai ?? '') };
  for (const id of ids) { const m = nhipMay(id) as { cuoi: string }; if (m.cuoi && (!ra[id] || m.cuoi > ra[id]!.luc)) ra[id] = { luc: m.cuoi, ket: 'việc máy chạy' }; }
  for (const id of ids) { const n = lanLam(id) as { luc: string; ket?: string } | null; if (n && (!ra[id] || n.luc > ra[id]!.luc)) ra[id] = n; }   // mỗi nhịp chạy (kiểm hòm, gửi tin) cũng là làm việc
  return ra;
}
// YDNI (anh 14/10/2026 "page này cần YDNI"): mặt bảng chỉ còn cột VẬN HÀNH (người · vai · bộ não · nhịp · tần suất · ca · làm lần cuối · chi ·
// trần); điểm đo bộ não (giao việc · làm · kiểm · giá · đề xuất) gập sau một bấm, dòng tóm tắt vẫn đếm "nên đổi". Trong phòng bỏ cột Phụ trách
// vì khung Trách nhiệm ngay dưới đã có đúng số đó.
export async function BangNhanSu({ ds, trongPhong = false, tn, phong }: { ds: NS[]; trongPhong?: boolean; tn?: TrachNhiem; phong?: string }) {
  const docs = ds.map((d) => nhanSu(d.id)).filter(Boolean) as Doc[];
  const so = await soChi(docs, trongPhong ? phong : undefined);   // trong phòng: chỉ tiền làm cho phòng này · null = không nối DB → "?" chứ không phải $0
  const chi = (id: string) => so ? so.ds.filter((r) => r.nguoi === id).reduce((t, r) => t + (r.usd ?? 0), 0) : null;
  const admin = (await getCurrentUser())?.role === 'admin';
  const cuoi = lanCuoi(ds.map((d) => d.id)); const nenDoi = ds.filter((d) => d.deXuat.muc === 'doi').length; const thang = new Date().getUTCMonth() + 1;   // sổ chi tính date_trunc('month', now()) ở DB (UTC)
  return (
    <div className="cty-dn-cuon">
      <table className="cty-viec cty-dn">
        <thead><tr><th>Người</th>{!trongPhong && <th>Phòng</th>}<th>{trongPhong ? 'Vai ở phòng' : 'Vai chính'}</th><th>Bộ não</th>
          <th title="Việc người đó tự làm, không cần ai nhắc (worker/nhip.mjs)">Tự làm</th><th title="Nhịp cty: máy kiểm có việc chưa bao lâu một lần (KHÔNG phải số lần gọi mô hình). Người có việc máy: nhịp của việc chạy dày nhất — chỉnh từng việc ở cột Tự làm">Máy kiểm</th><th title="Giờ làm, giờ VN">Ca</th>
          <th title="Lần gần nhất người đó thật sự làm việc (gọi mô hình / gửi tin) — theo nhật ký">Làm lần cuối</th>
          <th className="cty-so" title={`Tiền mô hình thật THÁNG LỊCH ${thang} (từ 01/${thang} tới giờ — cơ sở lương)${trongPhong ? ', chỉ phần làm cho phòng này' : ', mọi phòng'} · sổ ai_usage`}>{trongPhong ? 'Chi ở phòng' : 'Chi'} tháng {thang}<br /><span className="cty-muted">từ 01/{thang}</span></th>
          <th className="cty-so" title="Trần chi tháng của người đó (mọi phòng cộng lại) — chạm trần thì proxy chặn">Trần / tháng</th>
          {tn && !trongPhong && <th className="cty-so" title="Số quy trình chịu trách nhiệm chính · số việc đang mở (kể cả việc máy làm thay)">Phụ trách</th>}</tr></thead>
        <tbody>{ds.map((d) => { const fm = nhanSu(d.id)?.fm ?? {}; const n = nhipChu(fm, d.id); const c = chi(d.id); const tr = Number(fm.tran_usd_thang || 0); return (
          <tr key={d.id}>
            <td><span className="cty-den-o"><Nguoi id={d.id} />{'coNut' in n && n.coNut && <NutTuLam muc={n.chiXem ? `nguoi:${d.id}` : `nhip:${d.id}`} bat={n.bat} admin={admin}
              hoi={n.chiXem ? `Tắt ${n.soChay} việc máy đang chạy của ${String(fm.ten ?? d.id)}?` : undefined} />}</span></td>{!trongPhong && <td className="cty-muted">{d.phongTen}</td>}<td title={d.giuVai.join(' · ') || d.chucDanh}>{(phong && vaiO(phong, d.id)) || TEN_VAI[d.vai]}</td>
            <td className="cty-nho">{tenModel(d.model)}</td>
            <td className={`cty-nho cty-dn-tulam${n.bat ? '' : ' cty-muted'}`}>{n.ds.length   // đầu việc tách dòng, bấm mở ngăn mô tả + nhật ký (anh 14/10/2026)
              ? <ul className="cty-dn-viec">{n.ds.map((v) => <li key={v.ma}><Link href={hrefNhip(d.id, v.ma)} title={v.ten}>{v.ten}</Link>{v.gio ? <ChinhLich muc={`gio:${d.id}`} lich={{ kieu: 'luc', gio: [v.gio], thu: [] }} chu={v.lich} kieu={['luc']} motGio admin={admin} apSau="MacBook áp trong 10 phút" /> : <span className="cty-lich-o" title={v.lich}>{v.lich}</span>}<span /></li>)}</ul>
              : n.viec}{((vm) => vm.length > 0 && <div>{!n.ds.length && <ul className="cty-dn-viec">{vm.slice(0, 4).map((v) => <li key={v.id}><TenViecMay v={v} admin={admin} href={hrefNhip(d.id, 'may')} /><LichViec v={v} admin={admin} /><span className="cty-muted">{v.may}</span></li>)}</ul>}
                <Link href={hrefNhip(d.id, 'may')} title="Timer / cron / LaunchAgent chạy trên box và Mac mà người này phụ trách">{vm.length > 4 && !n.ds.length ? `tất cả ${vm.length} việc máy` : `${vm.length} việc máy`}</Link>
                {vm.some(hong) && <span className="cty-thu-loi"> · {vm.filter(hong).length} lỗi</span>}{vm.some((v) => v.chua_gan) && <span className="cty-thu-loi"> · {vm.filter((v) => v.chua_gan).length} chưa xếp phòng</span>}</div>)(viecMayCua(d.id) as ViecMay[])}</td>
            {n.bat && n.ca && ('box' in n ? n.box : true) ? <><td className="cty-nho"><ChinhLich muc={`nhip:${d.id}`} lich={{ kieu: 'moi', phut: n.kiemMoi ?? 1 }} chu={n.tanSuat ?? ''} kieu={['moi']} admin={admin} apSau="áp từ nhịp kế tiếp" /></td>
              <ChinhCa   /* máy kiểm + ca chỉ nghĩa với nhịp box; việc trên Mac có lịch riêng (cột Tự làm) */ id={d.id} ca={n.ca} diemDanh={n.diemDanh ?? ''} admin={admin} /></>
              : n.nhipMay ? <><td className="cty-nho" title="Nhịp của việc máy chạy dày nhất người này phụ trách — chỉnh lịch từng việc ở cột Tự làm">{n.nhipMay}<div className="cty-muted">việc dày nhất</div></td><td className="cty-nho cty-muted" title="Việc máy chạy theo lịch riêng của máy, không theo ca">theo lịch máy</td></>
              : <><td className="cty-nho"><span className="cty-muted">—</span></td><td className="cty-nho"><span className="cty-muted">—</span></td></>}
            <td className="cty-nho" title={cuoi[d.id]?.ket}>{cuoi[d.id] ? <TruocDay iso={cuoi[d.id]!.luc} /> : <span className="cty-muted">chưa làm</span>}</td>
            <td className="cty-so" title={so ? `${so.ds.filter((r) => r.nguoi === d.id).reduce((t, r) => t + r.luot, 0)} lời gọi tháng này` : 'không nối được DB'}>{c === null ? <span className="cty-thu-loi">?</span> : tien(c)}</td>
            <td className="cty-so cty-muted">{tr ? tien(tr) : '—'}</td>
            {tn && !trongPhong && ((x) => <td className="cty-so" title={`${x.chuTri} quy trình chủ trì · ${x.lam} được giao làm · ${x.viec} việc đang mở${x.tre ? ` (${x.tre} máy trễ)` : ''}`}>
              <b>{x.chuTri}</b> · <b className={x.tre ? 'cty-thu-loi' : ''}>{x.viec}</b></td>)(demTn(tn, d.id, phong))}
          </tr>); })}</tbody>
      </table>
      <details className="cty-dn-do">
        <summary>Chỉ số bộ não <span className="cty-muted cty-nho">giao việc · làm · kiểm · giá · đề xuất</span>{nenDoi > 0 && <span className="cty-pill cty-pill-off">{nenDoi} nên đổi</span>}</summary>
        <table className="cty-viec cty-dn">
          <thead><tr><th>Người</th><th>Bộ não</th>{VAI.map((v) => <th key={v} className="cty-so" title={TEN_VAI[v]}>{COT_VAI[v]}</th>)}
            <th className="cty-so" title="Giá 1.000 lời gọi ở vai đang tính của người đó">$/1.000 lời gọi</th><th>Đề xuất</th></tr></thead>
          <tbody>{ds.map((d) => (
            <tr key={d.id}><td><Nguoi id={d.id} /></td><td className="cty-nho">{tenModel(d.model)}</td>
              {VAI.map((v) => <td key={v} className="cty-so"><Diem s={d.chiSo[v]} chinh={v === d.vai} /></td>)}
              <td className="cty-so cty-muted">{d.chiSo[d.vai] ? usd(d.chiSo[d.vai]!.usd_goi) : '—'}</td>
              <td title={[d.deXuat.chu, ...d.deXuat.them].join(' · ')}><span className={`cty-pill${d.deXuat.muc === 'doi' ? ' cty-pill-off' : d.deXuat.muc === 'chua-do' ? ' cty-pill-kind' : ''}`}>{NHAN_MUC[d.deXuat.muc]}</span></td></tr>))}</tbody>
        </table>
        <p className="cty-muted cty-nho">Số đậm = vai {trongPhong ? 'người đó giữ ở phòng này' : 'chính của người đó'}. Rê chuột lên số để xem số câu đúng và khoảng tin cậy; lên nhãn đề xuất để xem lý do.{trongPhong && <> So cả công ty: <Link href="/nhan-su">Đội ngũ</Link>.</>}</p>
      </details>
    </div>
  );
}
