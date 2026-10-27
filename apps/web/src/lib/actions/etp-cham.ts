'use server';
// NÚT "CHẤM" trên etp.on.tc › Creative › Quét nội dung (anh 25/10/2026: "thêm nút để tao có thể chủ động chạy chấm 1 creative cụ thể").
// Chỉ xếp hàng etp.cham_hang — Worker Cloudflare etp-cham nhận trong ~1 phút.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { spawn } from 'node:child_process';

export async function xepHangCham(ids: number[]): Promise<{ ok: true; so: number } | { loi: string }> {
  const me = await getCurrentUser();
  if (!me) return { loi: 'chưa đăng nhập' };
  if (me.role !== 'admin') return { loi: 'chỉ admin' };
  const ds = [...new Set(ids.map(Number).filter((x) => Number.isInteger(x) && x > 0))].slice(0, 200);
  if (!ds.length) return { loi: 'không có creative' };
  await getDb()!.execute(sql`insert into etp.cham_hang (creative_id, nguon, ai)
    select unnest(${`{${ds.join(',')}}`}::int[]), 'nut', ${me.email}
    on conflict (creative_id) do update set luc = now(), nguon = 'nut', ai = excluded.ai, trang_thai = 'cho', bat_dau = null, xong = null, loi = null,
      buoc = 'chờ Cloudflare nhận', nhat_ky = jsonb_build_array(jsonb_build_object('b', 'anh bấm Chấm', 'luc', now()))
    where etp.cham_hang.trang_thai <> 'dang'`);
  return { ok: true, so: ds.length };
}

// THÊM / SỬA TIÊU CHÍ CHẤM (anh 27/10/2026: "nếu tao thêm 1 tiêu chí = text …" — "Chỉ thêm và ko chấm lại hàng loạt nếu tao ko cho phép. Chỉ áp dụng cho lượt chấm mới!").
// Ghi thẳng etp.tieu_chi — máy chấm (Worker etp-cham) đọc bảng này mỗi lượt nên lượt chấm SAU áp ngay. TUYỆT ĐỐI không xếp chấm lại: creative đã chấm giữ nguyên điểm.
export async function luuTieuChi(x: { nhom: string; ma?: string; ten: string; mo_ta: string }): Promise<{ ok: true; ma: string } | { loi: string }> {
  const me = await getCurrentUser();
  if (!me) return { loi: 'chưa đăng nhập' };
  if (me.role !== 'admin') return { loi: 'chỉ admin' };
  const nhom = x.nhom === 'afs' ? 'afs' : x.nhom === 'meta' ? 'meta' : null;
  const ten = (x.ten ?? '').trim(), mo = (x.mo_ta ?? '').trim();
  if (!nhom) return { loi: 'nhóm phải là meta hoặc afs' };
  if (ten.length < 2 || ten.length > 60) return { loi: 'tên 2–60 ký tự' };
  if (mo.length < 20 || mo.length > 4000) return { loi: 'mô tả 20–4000 ký tự (máy chấm đọc mô tả này để cho điểm)' };
  const db = getDb()!;
  if (x.ma) {
    const r = await db.execute(sql`update etp.tieu_chi set ten = ${ten}, mo_ta = ${mo} where nhom = ${nhom} and ma = ${x.ma} returning ma`);
    return (r as unknown as unknown[]).length ? { ok: true, ma: x.ma } : { loi: 'không thấy tiêu chí' };
  }
  const goc = ten.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24) || 'tieu_chi';
  const co = new Set(((await db.execute(sql`select ma from etp.tieu_chi where nhom = ${nhom}`)) as unknown as { ma: string }[]).map((r) => r.ma));
  let ma = goc; for (let i = 2; co.has(ma); i++) ma = `${goc}_${i}`;
  await db.execute(sql`insert into etp.tieu_chi (nhom, ma, ten, mo_ta, thu_tu) select ${nhom}, ${ma}, ${ten}, ${mo}, coalesce(max(thu_tu), 0) + 1 from etp.tieu_chi where nhom = ${nhom}`);
  return { ok: true, ma };
}

// DUYỆT CREATIVE 5 ĐIỂM (anh 26/10/2026: "5 điểm thì sẽ cần review người thật" · "không duyệt qua tele — gửi 1 tin tổng hợp rồi link đến page trên etp.on.tc"):
// Đạt = cho lên / chạy tiếp; Loại = chặn lên + máy tắt mọi camp dùng creative này ở lượt lịch giờ kế (≤ 10 phút, apps/etp/lich-gio.py tat_cham). Một nguồn: view etp.cham_cong (0341).
export async function duyetCham(id: number, ok: boolean): Promise<{ ok: true } | { loi: string }> {
  const me = await getCurrentUser();
  if (!me) return { loi: 'chưa đăng nhập' };
  if (me.role !== 'admin') return { loi: 'chỉ admin' };
  if (!Number.isInteger(id) || id <= 0) return { loi: 'creative sai' };
  await getDb()!.execute(sql`insert into etp.cham_duyet (creative_id, ok, ai, ghi) values (${id}, ${ok}, ${me.email}, 'etp.on.tc')
    on conflict (creative_id) do update set ok = excluded.ok, ai = excluded.ai, ghi = excluded.ghi, luc = now()`);
  return { ok: true };
}

// ĐÈN + NÚT TẮT CAMP Ở BẢNG SOÁT (anh 26/10/2026: "creative thuộc camp active … đèn xanh, cho tắt tại đây"; bật KHÔNG làm ở đây — "còn nhiều rule xung quanh").
// Đi qua lam-ethopex.py tat-loat (đọc lại, nhật ký luật) — chạy nền, trang tự làm mới. Tắt mọi camp ACTIVE dùng creative, kể cả bản nhân ★ (etp.creative_cua, 0347).
const LAM = `${process.env.REPO_DIR ?? '/opt/earns-marketing-os-v2'}/apps/xuong-video/scripts/ethopex/lam-ethopex.py`;
export async function tatCreative(id: number): Promise<{ ok: true; so: number } | { loi: string }> {
  const me = await getCurrentUser();
  if (!me) return { loi: 'chưa đăng nhập' };
  if (me.role !== 'admin') return { loi: 'chỉ admin' };
  if (!Number.isInteger(id) || id <= 0) return { loi: 'creative sai' };
  const ids = ((await getDb()!.execute(sql`select c.camp_id from etp.camp c where c.trang_thai = 'ACTIVE' and etp.creative_cua(c.creative_id, c.ten) = ${id}`)) as unknown as { camp_id: number }[]).map((r) => Number(r.camp_id));
  if (!ids.length) return { loi: 'không có camp đang chạy' };
  const p = spawn('python3', [LAM, 'tat-loat', ids.join(','), '--ep', '--luat', `anh bấm Tắt ở etp.on.tc › Soát creative #${id}`, '--ai', `anh (etp.on.tc ${me.email})`], { detached: true, stdio: 'ignore', env: process.env });
  p.unref();
  return { ok: true, so: ids.length };
}
