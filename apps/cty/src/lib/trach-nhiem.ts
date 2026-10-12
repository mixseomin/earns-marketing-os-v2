import 'server-only';
// TRÁCH NHIỆM từng nhân sự (anh 12/10/2026: "mỗi nhân sự cần danh sách công việc được uỷ nhiệm và chịu trách nhiệm chính … phải nhìn thấy ở
// phần nhân sự"). Một nguồn, không chép tay:
//   · quy trình của mọi phòng (cong-ty/quy-trinh/*/danh-sach.json): chu_tri = MỘT người chịu trách nhiệm chính, lam = ai/máy làm thật;
//     mã vai giải ra người ĐANG giữ vai (đổi người = đổi hồ sơ phòng / sổ bổ nhiệm, danh sách tự theo);
//   · việc đang mở quy về người: việc ở tab Dây chuyền (vai → người; việc máy làm thay → người chủ trì quy trình của việc đó, nên máy
//     trễ là việc của một người cụ thể), card plays còn mở của phòng (trưởng phòng), kênh kéo khách đang cần (chủ trì quy trình gom kênh).
import { dsQuyTrinh, giaiNguoi, phongFm } from '../../worker/quy-trinh.mjs';
import { dayChuyen } from '../../worker/sach.mjs';
import { hrefSach, hrefThe } from './ngan';
import { dsPhong, dsNhanSu } from './cong-ty';
import { theViecMo, kenhKeoKhach } from './do-dac';

export type MucQt = { phong: string; khoa: string; ten: string; so_hoa: string; kich_hoat: string; chuTri: boolean; lam: string[] };
export type ViecMo = { phong: string; chu: string; ten?: string; link?: string; qua?: number | null; tre?: boolean; mayLam: boolean; /** một dòng thay cho bấy nhiêu việc (dòng "+N card nữa") */ so?: number };
const TRAN_CARD = 5;   // card mỗi phòng kéo về để hiện; phần còn lại thành MỘT dòng "+N card" (đếm đủ trong demTn)
export const soViec = (ds: ViecMo[]) => ds.reduce((t, v) => t + (v.so ?? 1), 0);
export type TrachNhiem = Record<string, { qt: MucQt[]; viec: ViecMo[] }>;

/** Mã trong quy trình → người: vai của phòng → người đang giữ; mã người / 'may' / 'giam-doc' giữ nguyên; vai chưa ai giữ → null.
 *  Phòng chưa tách vai (chưa khai vai_truong_phong) thì trưởng phòng = người có tên ở `truong:` của hồ sơ phòng. */
export function giaiMa(phong: string, ma: string): string | null {
  if (ma === 'may' || ma === 'giam-doc') return ma;
  try { return (giaiNguoi(phong, ma) as { nguoi: string }).nguoi; }
  catch {
    if (ma !== 'truong-phong') return null;
    const ten = String((phongFm(phong) as Record<string, unknown>).truong ?? '');
    return dsNhanSu().find((d) => String(d.fm.ten) === ten)?.id ?? null;
  }
}

const NEN: Record<string, string> = { kdp: 'KDP', etsy: 'Etsy', gumroad: 'Gumroad' };
type Qt = { phong: string; khoa: string; ten: string; so_hoa: string; kich_hoat: string; chu_tri?: string; lam?: string[] };
type Dc = { loi?: string; nhom?: { tua: string; dong: { id: string; nen: string; viec: { ai: string | null; chu: string; qua?: number | null; tre?: boolean; qt?: string | null } }[] }[] } | null;

// Nhớ 60 giây (như sổ sản phẩm ở worker/sach.mjs): ngăn nhân sự, tab phòng, trang Đội ngũ đều gọi; chồng 5 ngăn = 5 lần tính, mỗi lần ~30
// truy vấn — không nhớ thì mở ngăn chậm vài giây. Nhớ LỜI HỨA để các lần gọi cùng lúc dùng chung một lần tính; lỗi thì bỏ nhớ.
let NHO: { luc: number; p: Promise<TrachNhiem> } | null = null;
export function trachNhiem(): Promise<TrachNhiem> {
  if (!NHO || Date.now() - NHO.luc > 60_000) { const p = tinhTrachNhiem(); NHO = { luc: Date.now(), p }; p.catch(() => { NHO = null; }); }
  return NHO.p;
}
async function tinhTrachNhiem(): Promise<TrachNhiem> {
  const tn: TrachNhiem = {}; const cua = (id: string) => (tn[id] ??= { qt: [], viec: [] });
  const chuTri: Record<string, string | null> = {};   // khoá quy trình → người chủ trì
  for (const q of dsQuyTrinh() as Qt[]) {
    const ct = q.chu_tri ? giaiMa(q.phong, q.chu_tri) : null; chuTri[q.khoa] = ct;
    const lam = (q.lam ?? []).map((m) => giaiMa(q.phong, m) ?? `?${m}`);   // ?vai = vai chưa ai giữ (hiện ra, không giấu)
    const muc = { phong: q.phong, khoa: q.khoa, ten: q.ten, so_hoa: q.so_hoa, kich_hoat: q.kich_hoat, lam };
    if (ct) cua(ct).qt.push({ ...muc, chuTri: true });
    for (const n of new Set(lam)) if (n !== ct && n !== 'may' && !n.startsWith('?')) cua(n).qt.push({ ...muc, chuTri: false });
  }
  await Promise.all(dsPhong().map(async (p) => {
    const dc = (await dayChuyen(p.id)) as Dc;
    for (const g of dc?.nhom ?? []) for (const d of g.dong) {
      const v = d.viec; if (!v.ai || v.ai === 'san') continue;
      const ai = v.ai === 'may' ? (v.qt ? chuTri[`${p.id}/${v.qt}`] : null) : giaiMa(p.id, v.ai);
      if (ai) cua(ai).viec.push({ phong: p.id, chu: `${NEN[d.nen] ?? d.nen}: ${v.chu}`, ten: g.tua, link: hrefSach(p.id, d.id), qua: v.qua, tre: v.tre, mayLam: v.ai === 'may' });
    }
    const [the, kenh] = await Promise.all([theViecMo(p, TRAN_CARD), kenhKeoKhach(p)]);
    const tp = giaiMa(p.id, 'truong-phong');
    if (tp && the) {
      for (const c of the.ds) cua(tp).viec.push({ phong: p.id, chu: `card #${c.id} · ${c.status}`, ten: c.title, link: hrefThe(c.id), mayLam: false });
      if (the.tong > the.ds.length) cua(tp).viec.push({ phong: p.id, chu: `+${the.tong - the.ds.length} card nữa trên plays`, link: `/phong/${p.id}`, mayLam: false, so: the.tong - the.ds.length });
    }
    const gom = chuTri[`${p.id}/kenh-keo-khach`];
    if (gom) for (const k of (kenh ?? []).filter((x) => x.canh_bao)) cua(gom).viec.push({ phong: p.id, chu: `kênh ${k.kenh}: ${k.canh_bao}`, ten: k.ten, link: k.the_id ? hrefThe(k.the_id) : undefined, mayLam: false });
  }));
  for (const x of Object.values(tn)) x.viec.sort((a, b) => Number(!!b.tre) - Number(!!a.tre) || (b.qua ?? -999) - (a.qua ?? -999));
  return tn;
}
/** Số trên cột "Phụ trách" / nhãn tab: quy trình chủ trì · việc đang mở (lọc theo phòng khi xem trong phòng). */
export const demTn = (tn: TrachNhiem, id: string, phong?: string) => {
  const x = tn[id]; const qt = (x?.qt ?? []).filter((q) => !phong || q.phong === phong); const viec = (x?.viec ?? []).filter((v) => !phong || v.phong === phong);
  return { chuTri: qt.filter((q) => q.chuTri).length, lam: qt.filter((q) => !q.chuTri).length, viec: soViec(viec), tre: viec.filter((v) => v.tre).length };
};
