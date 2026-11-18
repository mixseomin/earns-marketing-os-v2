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
import { MoRong } from './mo-rong';
import { docLich, choAp, lichCua, lichNen, KHONG_TAT } from '../../worker/lich-may.mjs';
import { NutTuLam } from './nut-tu-lam';
import { getCurrentUser } from '@/lib/auth';
import { mocCuoiCa } from '../../worker/gio-lam.mjs';
import { nhanSu, dsNhanSu, type Doc } from '@/lib/cong-ty';
import { ChinhModel } from './chinh-model';
import { soChi } from '@/lib/do-dac';
import { docLog } from '../../worker/log.mjs';
import { TruocDay } from './truoc-day';
import { trangThai, nhatKyCuoi, tranPhut, phutLich, cacLan } from '../../worker/trang-thai.mjs';
import { DemNguoc } from './dem-nguoc';
import { VIEC_NHIP } from '../../worker/nhip.mjs';
import { LocNhanSu, LOAI_NS, type LocNS } from './loc-nhan-su';
import { BangNhanSuDT, type DongNS, type CotNS } from './bang-nhan-su-dt';
import { cayCua } from '@/lib/repo-ky-su';

/** Loại nhân sự cho bộ lọc: người thật (kind human / vendor) · kỹ sư CLI (chạy bằng Claude Code) · gọi API (mô hình qua proxy, hoặc máy thuần). */
export const loaiNS = (fm: Record<string, unknown>): keyof typeof LOAI_NS =>
  fm.kind && fm.kind !== 'ai' ? 'nguoi' : String(fm.model ?? '').startsWith('claude-code') || fm.model_cli ? 'cli' : 'api';
/** Kỹ sư CLI chạy QUA CỔNG AI: dòng model SOUL có `qua:cong` → bộ chạy (may/gop-y-ky-su.mjs) đặt ANTHROPIC_BASE_URL về spy /api/ai/cc/<người>, không dùng gói Claude.
 *  Bộ lọc "Qua cổng AI" (loai=cong) là tập con của Kỹ sư CLI — góp ý #giao-20261117-0000-nhan-cong. */
export const quaCong = (fm: Record<string, unknown>): boolean => loaiNS(fm) === 'cli' && /\bqua:cong\b/.test(String(fm.model ?? ''));
/** Đọc bộ lọc từ URL (/nhan-su?q=&phong=&loai=&tt=&nhom=phong). */
export function docLocNS(sp: Record<string, string | string[] | undefined>): LocNS {
  const s = (k: string) => { const v = sp[k]; return String(Array.isArray(v) ? v[0] ?? '' : v ?? ''); };
  return { q: s('q'), phong: s('phong'), loai: s('loai'), tt: s('tt'), nhom: s('nhom') === 'phong' };
}
const GIO_VN = (iso: string) => new Date(Date.parse(iso) + 7 * 3600_000).toISOString().slice(11, 16);   // HH:MM giờ VN (GMT+7)
const ngayVN = (iso: string) => new Date(Date.parse(iso) + 7 * 3600_000).toISOString().slice(0, 10);
type TT = { kieu: 'lam' | 'ranh' | 'tat' | 'chua'; viec?: string; tu?: string; phut?: number; them?: number; xong?: string; vua?: { luc: string; ket: string } | null; ket: string[] };
/** TRẠNG THÁI THẬT của một người (worker/trang-thai.mjs): đang làm gì từ lúc nào · rảnh từ lúc nào · kẹt vì sao. */
function trangThaiCua(id: string, fm: Record<string, unknown>, bat: boolean, cuoiKhac?: { luc: string; ket?: string }): TT {
  const viec = String(fm.heartbeat ?? '').split(',').map((v) => v.trim()).filter((v) => v in NHIP_MAY);
  const lichDay = Object.fromEntries(viec.flatMap((v) => { const p = phutLich((VIEC_NHIP as Record<string, { lich: (n: object) => string }[]>)[v]?.[0]?.lich({})); return p ? [[v, p]] : []; }));
  return trangThai(nhatKyCuoi(id), { bat, tran: tranPhut, lichDay, cuoiKhac: cuoiKhac ? { luc: cuoiKhac.luc, ket: cuoiKhac.ket ?? '' } : undefined }) as TT;
}
/** GIỜ KIỂM KẾ từng việc của một người: { viec: { tiep?, tu? } } — tiep = trường "tiep" mới nhất bộ điều phối đẩy kèm nhật ký nhịp,
 *  tu = lần đang chạy (▶ chưa có ■ / ✗) thì đếm "đang chạy" thay đếm ngược. */
function keTiep(id: string): Record<string, { tiep?: string; tu?: string }> {
  const nk = nhatKyCuoi(id) as { viec?: string; tiep?: string }[]; const ra: Record<string, { tiep?: string; tu?: string }> = {};
  for (const e of nk) { const v = String(e.viec ?? ''); if (v && e.tiep && !ra[v]?.tiep) ra[v] = { ...ra[v], tiep: e.tiep }; }
  for (const x of cacLan(nk) as { viec: string; tu?: string; dang: boolean }[]) if (x.dang && x.tu) ra[x.viec] = { ...ra[x.viec], tu: x.tu };
  return ra;
}
/** Ô trạng thái: bấm mở ngăn "Nhật ký công việc" của người đó (nhip:<id>/nhat-ky). */
function OTrangThai({ id, t }: { id: string; t: TT }) {
  const homNay = ngayVN(new Date().toISOString());
  const gio = (iso: string) => `${GIO_VN(iso)}${ngayVN(iso) === homNay ? '' : ` ${ngayVN(iso).slice(8, 10)}/${ngayVN(iso).slice(5, 7)}`}`;
  return (
    <Link href={hrefNhip(id, 'nhat-ky')} className="cty-tt-o" title="Mở nhật ký công việc">
      {t.kieu === 'lam' ? <><b className="cty-tt-lam">ĐANG LÀM</b> {t.viec}{t.them ? ` (+${t.them} việc)` : ''}<div className="cty-nho">từ {gio(t.tu!)} ({t.phut} phút)</div></>
        : t.kieu === 'ranh' ? <><span className="cty-tt-ranh">RẢNH</span><span className="cty-nho"> · xong {gio(t.xong!)} · <TruocDay iso={t.xong!} /></span></>
        : t.kieu === 'tat' ? <><span className="cty-muted">TẮT</span>{t.xong && <span className="cty-nho cty-muted"> · lần cuối {gio(t.xong)}</span>}</>
        : <span className="cty-muted" title="Nhật ký nhịp chưa có dòng nào của người này — việc Mac mở trước 17/11 14:27 chỉ có dòng khi lượt đó xong">chưa có dòng nhật ký</span>}
      {t.ket.length > 0 && <div><span className="cty-tt-ket">KẸT</span> <span className="cty-nho cty-tt-ket-chu">{t.ket.join(' · ')}</span></div>}
      {t.vua?.ket && <div className="cty-nho cty-muted cty-tt-vua" title={t.vua.ket}>vừa: {t.vua.ket.slice(0, 160)}</div>}
    </Link>
  );
}

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
/** Lịch một việc NHỊP chạy trên Mac qua bộ điều phối (sổ cong-ty/viec-nen.json): chữ = lịch đang chạy thật (hen trong sổ, hoặc ý muốn admin đã áp),
 *  chỉnh tại chỗ (anh 17/11/2026 "phải cho tao sửa các chỗ này"). Bộ điều phối đọc ý muốn mỗi phút, áp rồi báo về → hết "chờ áp". */
export function LichNen({ nhan, chu, admin }: { nhan: string; chu: string; admin: boolean }) {
  const x = lichNen(nhan) as { dang: Lich | null; cho: boolean; loi?: string; kieu: string } | null;
  if (!x || x.kieu !== 'lich') return <span className="cty-lich-o" title={x ? (x.kieu === 'luon' ? 'Việc chạy liền — không có lịch' : 'Chỉ chạy khi gọi tay') : `${nhan} chưa có trong sổ bộ điều phối`}>{x?.kieu === 'luon' ? 'chạy liền' : x?.kieu === 'tay' ? 'khi gọi' : chu}</span>;
  return <ChinhLich muc={`nen:${nhan}`} lich={x.dang} chu={chu} coThu={false} admin={admin} apSau={`${nhan.split(':')[0]} áp trong ≤ 1 phút (bộ điều phối đọc lại mỗi phút)`} trang={{ cho: x.cho, loi: x.loi }} />;
}
/** Tên một việc máy kèm chấm bật/tắt riêng của việc đó (bảng nhân sự + ngăn việc máy). */
export function TenViecMay({ v, admin, href }: { v: ViecMay; admin: boolean; href?: string }) {
  const x = (docLich() as Record<string, { luc: string; bat?: boolean; ap?: { luc: string } }>)[v.id]; const cho = choAp(x) && x!.bat !== undefined;
  return <span className="cty-ten-viec"><NutTuLam muc={`viec:${v.id}`} bat={cho ? !!x!.bat : (dangChay(v) as boolean)} cho={cho} admin={admin} khoa={(KHONG_TAT as Record<string, string>)[v.id]} />
    {href ? <Link href={href} title={`${tenViec(v)} — ${v.ma}`}>{tenViec(v)}</Link> : <b title={v.ma}>{tenViec(v)}</b>}</span>;   // trong ngăn việc máy: không link về chính ngăn đó
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
export async function BangNhanSu({ ds: dsGoc, trongPhong = false, tn, phong, loc }: { ds: NS[]; trongPhong?: boolean; tn?: TrachNhiem; phong?: string; loc?: LocNS }) {
  // TRẠNG THÁI + BỘ LỌC (anh 17/11/2026): tính trạng thái thật cho mọi người trước, rồi lọc tên / phòng / loại / trạng thái trên URL
  const cuoiGoc = lanCuoi(dsGoc.map((d) => d.id));
  const tts = Object.fromEntries(dsGoc.map((d) => { const fm = nhanSu(d.id)?.fm ?? {}; return [d.id, trangThaiCua(d.id, fm, nhipChu(fm, d.id).bat, cuoiGoc[d.id])]; })) as Record<string, TT>;
  const boDau = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  const khop = (d: NS) => { if (!loc) return true; const t = tts[d.id]!; const fm = nhanSu(d.id)?.fm ?? {};
    return (!loc.q || boDau(`${d.ten} ${d.id} ${d.chucDanh}`).includes(boDau(loc.q))) && (!loc.phong || d.phong === loc.phong) && (!loc.loai || (loc.loai === 'cong' ? quaCong(fm) : loaiNS(fm) === loc.loai))
      && (!loc.tt || (loc.tt === 'ket' ? t.ket.length > 0 : loc.tt === 'ranh' ? t.kieu === 'ranh' || t.kieu === 'chua' : t.kieu === loc.tt)); };
  const ds = dsGoc.filter(khop);
  const phongs = [...new Map(dsGoc.map((d) => [d.phong, d.phongTen])).entries()].map(([id, ten]) => ({ id, ten })).sort((a, b) => a.ten.localeCompare(b.ten, 'vi'));
  const nhomPhong = !!loc?.nhom && !trongPhong;
  // DẠNG CÂY (góp ý #1666): chia theo phòng thì trưởng phòng là gốc, người làm rồi người kiểm là nhánh ├─ / └─ bên dưới
  const THU_VAI: Record<string, number> = { giao: 0, lam: 1, kiem: 2 };
  const nhom = nhomPhong ? phongs.map((p) => ({ ...p, ds: ds.filter((d) => d.phong === p.id).sort((a, b) => (THU_VAI[a.vai] ?? 9) - (THU_VAI[b.vai] ?? 9)) })).filter((g) => g.ds.length) : [{ id: '', ten: '', ds }];
  const nhanh: Record<string, string> = {};
  if (nhomPhong) for (const g of nhom) { const goc = g.ds[0]?.vai === 'giao' ? 1 : 0; const con = g.ds.slice(goc);
    if (goc) nhanh[g.ds[0]!.id] = '◆'; con.forEach((d, i) => { nhanh[d.id] = i === con.length - 1 ? '└─' : '├─'; }); }
  const docs = ds.map((d) => nhanSu(d.id)).filter(Boolean) as Doc[];
  const so = await soChi(docs, trongPhong ? phong : undefined);   // trong phòng: chỉ tiền làm cho phòng này · null = không nối DB → "?" chứ không phải $0
  const chi = (id: string) => so ? so.ds.filter((r) => r.nguoi === id).reduce((t, r) => t + (r.usd ?? 0), 0) : null;
  const admin = (await getCurrentUser())?.role === 'admin';
  const nenDoi = ds.filter((d) => d.deXuat.muc === 'doi').length; const thang = new Date().getUTCMonth() + 1;   // sổ chi tính date_trunc('month', now()) ở DB (UTC)
  const cotPhong = !trongPhong && !nhomPhong;
  // Gợi ý cho ô đổi mô hình: mọi dòng model đang dùng trong công ty (bỏ qua:cong — có ô tick riêng)
  const goiYModel = [...new Set(dsNhanSu().map((x) => String(x.fm.model ?? '').replace(/\s*\bqua:cong\b/g, '').trim()).filter((x) => x && x !== 'không'))].sort();
  // CỘT theo 4 NHÓM (anh 17/11/2026 "chia nhóm các cột cho khoa học"): Người · Bộ não & máy · Lịch & trạng thái · Chi phí
  const cot: CotNS[] = [
    { key: 'nguoi', group: 'nguoi', header: 'Người' },
    ...(cotPhong ? [{ key: 'phong', group: 'nguoi', header: 'Phòng' }] : []),
    { key: 'vai', group: 'nguoi', header: trongPhong ? 'Vai ở phòng' : 'Vai chính' },
    ...(tn && !trongPhong ? [{ key: 'phuTrach', group: 'nguoi', header: 'Phụ trách', so: true, title: 'Số quy trình chịu trách nhiệm chính · số việc đang mở (kể cả việc máy làm thay)' }] : []),
    { key: 'model', group: 'nao', header: 'Mô hình' },
    { key: 'noi', group: 'nao', header: 'Nơi chạy', title: 'Máy chạy việc của người đó: box3 (nhịp cty) · iMac / MacBook (bộ điều phối viec-nen, việc máy)' },
    { key: 'repo', group: 'nao', header: 'Repo', title: 'Kỹ sư CLI: repo · cây làm việc (đường dẫn tuyệt đối) · máy · nhánh — đọc từ sổ cong-ty/viec-nen.json (thu_muc / chay) + cây riêng may/cay-rieng.mjs' },
    { key: 'tuLam', group: 'lich', header: 'Tự làm', title: 'Việc người đó tự làm, không cần ai nhắc (worker/nhip.mjs) · lịch từng việc · đếm ngược tới lần kế' },
    { key: 'kiem', group: 'lich', header: 'Máy kiểm', title: 'Nhịp cty: máy kiểm có việc chưa bao lâu một lần (KHÔNG phải số lần gọi mô hình). Người có việc máy: nhịp của việc chạy dày nhất — chỉnh từng việc ở cột Tự làm' },
    { key: 'ca', group: 'lich', header: 'Ca', title: 'Giờ làm, giờ VN' },
    { key: 'tt', group: 'lich', header: 'Trạng thái', title: 'Trạng thái thật theo nhật ký công việc (giờ VN): đang làm gì từ lúc nào · rảnh từ lúc nào · vừa làm gì · KẸT khi chạy quá trần, 3 lần lỗi liền, hoặc việc lịch dày im quá 30 phút. Bấm để xem nhật ký từng lần chạy' },
    { key: 'chi', group: 'tien', header: `${trongPhong ? 'Chi phòng' : 'Chi'} T${thang}`, so: true, title: `Tiền mô hình thật THÁNG LỊCH ${thang} (từ 01/${thang} tới giờ — cơ sở lương)${trongPhong ? ', chỉ phần làm cho phòng này' : ', mọi phòng'} · sổ ai_usage` },
    { key: 'tran', group: 'tien', header: 'Trần / tháng', so: true, title: 'Trần chi tháng của người đó (mọi phòng cộng lại) — chạm trần thì proxy chặn' },
  ];
  const TT_SO = { lam: 0, ranh: 1, chua: 2, tat: 3 } as const;
  const dong: DongNS[] = nhom.flatMap((g) => g.ds).map((d) => { const fm = nhanSu(d.id)?.fm ?? {}; const n = nhipChu(fm, d.id); const c = chi(d.id); const tr = Number(fm.tran_usd_thang || 0);
    const vm = viecMayCua(d.id) as ViecMay[]; const cay = loaiNS(fm) === 'cli' ? cayCua(fm.heartbeat) : [];
    const noi = [...new Set([...('box' in n && n.box ? ['box3'] : []), ...cay.map((x) => x.may), ...vm.map((v) => v.may)])];
    const x = tn && !trongPhong ? demTn(tn, d.id, phong) : null; const vai = (phong && vaiO(phong, d.id)) || TEN_VAI[d.vai];
    return { id: d.id, phongTen: d.phongTen, ket: tts[d.id]!.ket.length > 0, lam: tts[d.id]!.kieu === 'lam',
      s: { nguoi: String(fm.ten ?? d.id), phong: d.phongTen, vai, phuTrach: x ? x.viec : null, model: tenModel(d.model), noi: noi.join(' '), repo: cay.map((k) => k.repo).join(' ') || null,
        tt: TT_SO[tts[d.id]!.kieu] - (tts[d.id]!.ket.length ? 10 : 0), chi: c, tran: tr || null },
      o: {
      nguoi: <span className="cty-den-o">{nhanh[d.id] && <span className={`cty-cay-nhanh${nhanh[d.id] === '◆' ? ' cty-cay-goc' : ''}`} aria-hidden>{nhanh[d.id]}</span>}<Nguoi id={d.id} />{'coNut' in n && n.coNut && <NutTuLam muc={n.chiXem ? `nguoi:${d.id}` : `nhip:${d.id}`} bat={n.bat} admin={admin}
        hoi={n.chiXem ? `Tắt ${n.soChay} việc máy đang chạy của ${String(fm.ten ?? d.id)}?` : undefined} />}</span>,
      phong: <span className="cty-muted cty-xuong-dong">{d.phongTen}</span>,   // góp ý #1659: tên phòng dài xuống dòng, không cắt "…"
      vai: <span title={d.giuVai.join(' · ') || d.chucDanh}>{vai}</span>,
      ...(x ? { phuTrach: <span title={`${x.chuTri} quy trình chủ trì · ${x.lam} được giao làm · ${x.viec} việc đang mở${x.tre ? ` (${x.tre} máy trễ)` : ''}`}><b>{x.chuTri}</b> · <b className={x.tre ? 'cty-thu-loi' : ''}>{x.viec}</b></span> } : {}),
      // Ký hiệu riêng khi người đó gọi mô hình qua Cổng AI API (không phải kỹ sư CLI Claude Code) — góp ý #1657
      // Kỹ sư CLI qua:cong → "🔌 cổng AI" (góp ý #giao-20261117-0000-nhan-cong: bảng không cho thấy Thắng chạy qua cổng)
      // góp ý #1661: admin bấm ✎ đổi mô hình + luồng qua cổng AI (components/chinh-model.tsx, đè SOUL ở nhip-chinh.json)
      model: <ChinhModel id={d.id} model={String(fm.model ?? '')} soul={String(fm.model_soul ?? '')} goiY={goiYModel} admin={admin} hien={<span className="cty-nho">{quaCong(fm) ? <span className="cty-pill cty-pill-kind" title={`Claude Code CLI chạy qua cổng AI spy /api/ai/cc/${d.id}, donk → ckey, KHÔNG dùng gói Claude`} aria-label="cổng AI">🔌</span> : loaiNS(fm) === 'api' && d.model ? <span className="cty-pill cty-pill-kind" title="Gọi mô hình qua Cổng AI API (spy /api/ai), không phải Claude Code CLI" aria-label="API">🔌</span> : null}{quaCong(fm) || (loaiNS(fm) === 'api' && d.model) ? ' ' : ''}{tenModel(d.model.replace(/\s*\bqua:cong\b/g, '').replace(/^claude-code:/, 'cli:'))}</span>} />,
      ...(noi.length ? { noi: <span className="cty-nho">{noi.join(' · ')}</span> } : {}),
      ...(cay.length ? { repo: <div className="cty-nho cty-repo">{cay.map((k) => <div key={k.dir}><b>{k.repo}</b> <span className="cty-muted">· {k.may}{k.nhanh ? <> · nhánh <code>{k.nhanh}</code></> : ''}</span><div><code title={`${k.dir} (${k.may})`}>{k.dir}</code></div></div>)}</div> } : {}),
      tuLam: <div className={`cty-nho cty-dn-tulam${n.bat ? '' : ' cty-muted'}`}>{((vm) => {
              // ĐẦU VIỆC (anh 14/10/2026): việc nhịp cty (chấm = nhịp của người đó) rồi việc máy (chấm riêng từng việc); 4 dòng đầu luôn hiện, còn lại
              // mở tại chỗ (#1362) — cùng một lưới nên thẳng cột. Không có đầu việc nào → chữ trạng thái (tắt / khi bấm nút).
              const ke = keTiep(d.id);   // đếm ngược tới lần kiểm kế (anh 17/11/2026)
              const nhip = n.ds.map((v) => <li key={v.ma}><span className="cty-ten-viec"><NutTuLam muc={`nhip:${d.id}`} bat={n.bat} admin={admin} /><Link href={hrefNhip(d.id, v.ma)} title={v.ten}>{v.ten}</Link></span>
                {((nm) => v.gio ? <ChinhLich muc={`gio:${d.id}`} lich={{ kieu: 'luc', gio: [v.gio], thu: [] }} chu={v.lich} kieu={['luc']} motGio admin={admin} apSau={henAp('MacBook') as string} />
                  : nm && nm.may === 'iMac' ? <><LichNen nhan={`${nm.may}:${nm.launchd}`} chu={v.lich} admin={admin} /><span className="cty-muted">{nm.may} <DemNguoc {...(ke[(v as { viec?: string }).viec ?? ''] ?? {})} cho={!!(lichNen(`${nm.may}:${nm.launchd}`) as { cho?: boolean } | null)?.cho} /></span></>
                  : <><span className="cty-lich-o" title={v.lich}>{v.lich}</span><DemNguoc {...(ke[(v as { viec?: string }).viec ?? ''] ?? {})} /></>)((NHIP_MAY as Record<string, { may: string; launchd: string }>)[(v as { viec?: string }).viec ?? ''])}</li>);
              const may = vm.map((v) => <li key={v.id}><TenViecMay v={v} admin={admin} href={hrefNhip(d.id, 'may')} /><LichViec v={v} admin={admin} /><span className="cty-muted">{v.may} <DemNguoc {...(ke[v.ma] ?? (v.tiep ? { tiep: v.tiep } : {}))} /></span></li>);
              const tat = [...nhip, ...may]; if (!tat.length) return n.viec;
              const dau = Math.max(nhip.length, Math.min(4, tat.length));
              return <>{n.chiXem && <div className="cty-muted">{n.viec}</div>}
                <MoRong dau={tat.slice(0, dau)} them={tat.slice(dau)} so={tat.length - dau} chiTiet={hrefNhip(d.id, vm.length ? 'may' : n.ds[0]!.ma)}
                  ghiChu={<>{vm.some(hong) && <span className="cty-thu-loi"> · {vm.filter(hong).length} lỗi</span>}{vm.some((v) => v.chua_gan) && <span className="cty-thu-loi"> · {vm.filter((v) => v.chua_gan).length} chưa xếp phòng</span>}</>} /></>;
            })(vm)}</div>,
      ...(n.bat && n.ca && ('box' in n ? n.box : true) ? {
        kiem: <span className="cty-nho"><ChinhLich muc={`nhip:${d.id}`} lich={{ kieu: 'moi', phut: n.kiemMoi ?? 1 }} chu={n.tanSuat ?? ''} kieu={['moi']} admin={admin} apSau="áp từ nhịp kế tiếp" /></span>,
        ca: <ChinhCa   /* máy kiểm + ca chỉ nghĩa với nhịp box; việc trên Mac có lịch riêng (cột Tự làm) */ id={d.id} ca={n.ca} diemDanh={n.diemDanh ?? ''} admin={admin} /> }
        : n.nhipMay ? { kiem: <span className="cty-nho" title="Nhịp của việc máy chạy dày nhất người này phụ trách — chỉnh lịch từng việc ở cột Tự làm">{n.nhipMay}<div className="cty-muted">việc dày nhất</div></span>,
          ca: <span className="cty-nho cty-muted" title="Việc máy chạy theo lịch riêng của máy, không theo ca">theo lịch máy</span> } : {}),
      tt: <div className="cty-nho cty-tt"><OTrangThai id={d.id} t={tts[d.id]!} /></div>,
      chi: <span title={so ? `${so.ds.filter((r) => r.nguoi === d.id).reduce((t, r) => t + r.luot, 0)} lời gọi tháng này` : 'không nối được DB'}>{c === null ? <span className="cty-thu-loi">?</span> : tien(c)}</span>,
      ...(tr ? { tran: <span className="cty-muted">{tien(tr)}</span> } : {}),
    } }; });
  return (
    <div className="cty-dn-cuon">
      {loc && !trongPhong && <LocNhanSu loc={loc} phongs={phongs} so={ds.length} tong={dsGoc.length} />}
      {ds.length ? <div className="cty-dn-dt"><BangNhanSuDT ds={dong} cot={cot} khoa={trongPhong ? 'cty-ns-phong' : 'cty-nhan-su'} nhomPhong={nhomPhong} /></div>
        : <p className="cty-muted">Không ai khớp bộ lọc.</p>}
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
