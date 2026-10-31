'use server';
// SỬA CAMP CỦA MÌNH trên etp.on.tc (anh 31/10/2026: Sơn "được edit camp của Sơn"): ô Ngân sách ✎ → đổi ngân sách / bật / tắt.
// Hai lớp gác: (1) ở đây — vai admin etp có nguoi_id, camp thuộc tài khoản QC của người đó trong kho; (2) cổng Ethopex chế độ ETP_SUA_NGUOI (apps/etp/sua-ngoai.py)
// đọc danh sách camp THẬT của tài khoản người đó từ Ethopex — camp nhà / người khác bị chặn kể cả khi kho lệch.
import { execFile } from 'node:child_process';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { quyenEtp, suaNguoi } from '@/lib/etp-quyen';

/** KẾT NỐI ETHOPEX (anh 31/10/2026: "Sơn ko thể sửa camp thông qua api của tao" — token Nhà chỉ được XEM tài khoản người khác):
 *  người tự dán phiên Ethopex của mình (localStorage access_token trên app.ethopex.dev) → sua-ngoai.py ket kiểm (đúng người, còn hạn, thấy camp của mình) rồi cất.
 *  Phiên đi qua STDIN của tiến trình con, không qua tham số / log; trang không bao giờ đọc lại chuỗi đó — chỉ ngày hết hạn. */
export async function ketNoiEthopex(phien: string): Promise<{ ok: true; het: string; soCamp: number } | { loi: string }> {
  const q = await quyenEtp(await getCurrentUser());
  const ng = q ? suaNguoi(q) : null;
  if (!ng) return { loi: 'không có quyền sửa camp' };
  const chuoi = String(phien ?? '').trim();
  if (chuoi.length < 40 || chuoi.length > 4000) return { loi: 'chuỗi dán vào không phải phiên Ethopex' };
  const tep = `${process.env.REPO_DIR ?? '/opt/earns-marketing-os-v2'}/apps/etp/sua-ngoai.py`;
  const ra = await new Promise<string>((ok) => { const p = execFile('python3', [tep, String(ng), 'ket'], { timeout: 90_000, env: process.env }, (_e, out) => ok(String(out ?? ''))); p.stdin?.end(chuoi); });
  const dong = ra.trim().split('\n').reverse().find((l) => l.startsWith('{'));
  if (!dong) return { loi: 'máy kết nối không trả kết quả' };
  const k = JSON.parse(dong) as { ok?: boolean; loi?: string | null; het?: string; so_camp?: number };
  return k.ok && k.het ? { ok: true, het: k.het, soCamp: Number(k.so_camp ?? 0) } : { loi: k.loi || 'không kết nối được' };
}

export type KetSua = { ok: true; truoc: { ns: number | null; tt: string | null }; sau: { ns: number | null; tt: string | null } } | { loi: string };

export async function suaCampNgoai(campId: number, viec: 'ns' | 'bat' | 'tat', ns?: number): Promise<KetSua> {
  const q = await quyenEtp(await getCurrentUser());
  const ng = q ? suaNguoi(q) : null;
  if (!ng) return { loi: 'không có quyền sửa camp' };
  if (!Number.isInteger(campId) || campId <= 0 || !['ns', 'bat', 'tat'].includes(viec)) return { loi: 'lệnh không hợp lệ' };
  if (viec === 'ns' && (!Number.isInteger(ns) || ns! < 1 || ns! > 1000)) return { loi: 'ngân sách phải là số nguyên $1–$1000' };
  const cua = ((await getDb()!.execute(sql`select 1 from etp.camp_ngoai c join etp.tai_khoan t on t.ad_account_id = c.ad_account_id
    where c.camp_id = ${campId} and t.nguoi_id = ${ng} and not t.nha`)) as unknown as unknown[]).length;
  if (!cua) return { loi: `camp ${campId} không thuộc tài khoản QC của bạn` };
  const tep = `${process.env.REPO_DIR ?? '/opt/earns-marketing-os-v2'}/apps/etp/sua-ngoai.py`;   // cùng khuôn LAM ở etp-cham.ts
  const args = [tep, String(ng), viec, String(campId), ...(viec === 'ns' ? [String(ns)] : [])];
  const ra = await new Promise<string>((ok) => execFile('python3', args, { timeout: 90_000, env: process.env }, (_e, out) => ok(String(out ?? ''))));
  const dong = ra.trim().split('\n').reverse().find((l) => l.startsWith('{'));
  if (!dong) return { loi: 'máy sửa không trả kết quả' };
  const k = JSON.parse(dong) as { ok?: boolean; loi?: string | null; truoc?: { ns: unknown; tt: unknown }; sau?: { ns: unknown; tt: unknown } };
  const so = (x?: { ns: unknown; tt: unknown }) => ({ ns: x?.ns == null ? null : Number(x.ns), tt: x?.tt == null ? null : String(x.tt) });
  return k.ok ? { ok: true, truoc: so(k.truoc), sau: so(k.sau) } : { loi: k.loi || 'không sửa được' };
}
