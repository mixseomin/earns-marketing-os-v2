'use server';
// HÀNH ĐỘNG của outreach.on.tc (nhịp 2–4, 20/11/2026) — lớp gác quyền quản trị quanh lõi lib/outreach (van-hanh, nap, soan-thu, thu-den, gui).
// Mọi hàm trả { ok: false, loi } bằng câu đọc được; màn hình in câu đó ngay dưới nút vừa bấm.
import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { chaoTuReport, datCachGui, docMotChienDich, guiThuThu, taoChienDich, type MotChienDich } from '@/lib/outreach/van-hanh';
import { dsNgachSpy, napCsv, napTuSpy, type KetNap, type NgachSpy } from '@/lib/outreach/nap';
import { soanChuoi, type KetSoan, type LoiChao } from '@/lib/outreach/soan-thu';
import { doThuDen, type KetThuDen } from '@/lib/outreach/thu-den';

type Loi = { ok: false; loi: string };
const CAM: Loi = { ok: false, loi: 'Chỉ quản trị mới làm được việc này.' };
async function quanTri() { const me = await getCurrentUser(); return me?.role === 'admin' ? me : null; }
const moi = () => revalidatePath('/outreach');

export async function obNgach(): Promise<{ ok: true; ngach: NgachSpy[] } | Loi> {
  if (!(await quanTri())) return CAM;
  try { return { ok: true, ngach: await dsNgachSpy() }; } catch (e) { return { ok: false, loi: `Không đọc được kho spy: ${String((e as Error).message ?? e).slice(0, 160)}` }; }
}
export async function obMotChienDich(id: number): Promise<{ ok: true; cd: MotChienDich } | Loi> {
  if (!(await quanTri())) return CAM;
  const cd = await docMotChienDich(id, 8);
  return cd ? { ok: true, cd } : { ok: false, loi: 'Không thấy chiến dịch này.' };
}
/** tạo chiến dịch; có spId (dự án bán report theo ngách) thì dựng luôn lời chào từ report của ngách đó */
export async function obTao(o: { da: string; ten: string; kieu: string; tuEmail: string; tuTen: string; tran: number; spId?: number; benGui?: string; kyTen?: string; gocSite?: string; banGi?: string; gia?: string }): Promise<{ ok: true; id: number } | Loi> {
  if (!(await quanTri())) return CAM;
  let chao: LoiChao | null = null, ngach = null;
  if (o.spId) {
    if (!o.benGui || !o.kyTen || !o.gocSite || !o.banGi) return { ok: false, loi: 'Lấy lời chào từ report cần đủ: bên gửi, tên ký, địa chỉ site, một câu bán gì.' };
    const r = await chaoTuReport(o.spId, { benGui: o.benGui, kyTen: o.kyTen, gocSite: o.gocSite, banGi: o.banGi, gia: o.gia });
    if (!r.ok) return r;
    chao = r.chao; ngach = r.ngach;
  }
  const kq = await taoChienDich({ da: o.da, ten: o.ten, kieu: o.kieu, tuEmail: o.tuEmail, tuTen: o.tuTen, tran: o.tran, chao, ngach });
  if (kq.ok) moi();
  return kq;
}
export async function obNapSpy(cd: number, spId: number, so: number): Promise<KetNap> {
  if (!(await quanTri())) return { ok: false, them: 0, khongEmail: 0, daCo: 0, xet: 0, conLai: 0, loi: CAM.loi };
  const kq = await napTuSpy(cd, spId, Math.max(1, Math.min(25, so)));   // mỗi lượt bấm một mẻ nhỏ: dò web ~40 giây, màn hình gọi lặp và hiện tiến độ
  moi(); return kq;
}
export async function obNapCsv(cd: number, chu: string) {
  if (!(await quanTri())) return { ok: false as const, them: 0, daCo: 0, hong: 0, loi: CAM.loi };
  const kq = await napCsv(cd, chu); moi(); return kq;
}
export async function obSoan(cd: number, so: number, lai?: number): Promise<KetSoan> {
  if (!(await quanTri())) return { ok: false, xong: 0, loai: 0, hong: 0, con: 0, usd: 0, loi: CAM.loi };
  const kq = await soanChuoi(cd, Math.max(1, Math.min(10, so)), lai); moi(); return kq;
}
export async function obGuiThu(cd: number, toi: string) {
  if (!(await quanTri())) return CAM;
  return guiThuThu(cd, toi);
}
export async function obCachGui(cd: number, o: { tuGui?: boolean; tran?: number }) {
  if (!(await quanTri())) return CAM;
  const kq = await datCachGui(cd, o); if (kq.ok) moi(); return kq;
}
export async function obThuDen(): Promise<KetThuDen> {
  if (!(await quanTri())) return { ok: false, doc: 0, moi: 0, traLoi: 0, thoi: 0, doi: 0, khongKhop: 0, loi: CAM.loi };
  const kq = await doThuDen(); moi(); return kq;
}
/** sửa lời chào của chiến dịch (ngăn vận hành) */
export async function obLuuChao(cd: number, chao: LoiChao): Promise<{ ok: true } | Loi> {
  if (!(await quanTri())) return CAM;
  const db = getDb(); if (!db) return { ok: false, loi: 'Chưa nối được cơ sở dữ liệu.' };
  const c: LoiChao = { ...chao, ben_gui: String(chao.ben_gui ?? '').trim(), ky_ten: String(chao.ky_ten ?? '').trim(), ban_gi: String(chao.ban_gi ?? '').trim(), phat_hien: (chao.phat_hien ?? []).map((x) => String(x).trim()).filter(Boolean) };
  if (!c.ben_gui || !c.ky_ten || !c.ban_gi) return { ok: false, loi: 'Lời chào cần đủ: bên gửi, tên ký, một câu bán gì.' };
  if (c.phat_hien.length < 2) return { ok: false, loi: 'Cần ít nhất 2 phát hiện để máy có cái nêu trong thư đầu và thư nhắc.' };
  await db.execute(sql`update outreach_campaigns set cau_hinh = jsonb_set(coalesce(cau_hinh, '{}'::jsonb), '{chao}', ${JSON.stringify(c)}::jsonb), updated_at = now() where id = ${cd}`);
  return { ok: true };
}
