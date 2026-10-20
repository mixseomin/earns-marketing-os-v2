// GỌI API ETHOPEX TỪ SERVER STUDIO (anh 20/10/2026: số liệu trang 📦 Sản phẩm phải gần realtime — "cách 1": kéo khi mở trang, không tiến trình ngầm).
// Khoá đăng nhập lưu ở xv_khoa_ngoai['ethopex'] = { access_token, refresh_token } (lấy từ phiên app.ethopex.dev của htuan82, vault #557);
// gặp 401 thì tự gọi /api/v1/auth/refresh (đúng đường app Ethopex dùng) rồi ghi khoá mới. Chỉ ĐỌC (report + campaigns), không sửa camp.
import 'server-only';
import { sql } from 'drizzle-orm';
import type { Db } from './doc-db';

const GOC = 'https://api.ethopex.dev';
type Khoa = { access_token: string; refresh_token: string };

async function docKhoa(db: Db): Promise<Khoa | null> {
  const r = (await db.execute(sql`SELECT gia_tri FROM xv_khoa_ngoai WHERE ten = 'ethopex'`)) as unknown as { gia_tri: Khoa }[];
  return r[0]?.gia_tri?.access_token ? r[0].gia_tri : null;
}
async function lamMoi(db: Db, k: Khoa): Promise<Khoa | null> {
  const r = await fetch(`${GOC}/api/v1/auth/refresh`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refresh_token: k.refresh_token }), signal: AbortSignal.timeout(20_000) }).catch(() => null);
  if (!r?.ok) return null;
  const j = (await r.json().catch(() => ({}))) as Record<string, any>;
  const d = (j.data ?? j) as Record<string, any>;
  const moi: Khoa = { access_token: d.access_token ?? d.accessToken ?? '', refresh_token: d.refresh_token ?? d.refreshToken ?? k.refresh_token };
  if (!moi.access_token) return null;
  await db.execute(sql`UPDATE xv_khoa_ngoai SET gia_tri = ${JSON.stringify(moi)}::jsonb, cap_nhat = now() WHERE ten = 'ethopex'`);
  return moi;
}
/** Gọi API Ethopex có khoá; 401/403 → làm mới khoá một lần rồi gọi lại. */
export async function goiEthopex<T>(db: Db, duong: string, o: { method?: 'GET' | 'POST'; body?: unknown } = {}): Promise<{ ok: true; data: T } | { ok: false; loi: string }> {
  let k = await docKhoa(db);
  if (!k) return { ok: false, loi: 'chưa có khoá Ethopex trong studio (xv_khoa_ngoai)' };
  for (let lan = 0; lan < 2; lan++) {
    const r = await fetch(`${GOC}${duong}`, { method: o.method ?? 'GET', headers: { authorization: `Bearer ${k.access_token}`, 'content-type': 'application/json' },
      body: o.body ? JSON.stringify(o.body) : undefined, signal: AbortSignal.timeout(30_000), cache: 'no-store' }).catch(() => null);
    if (r && (r.status === 401 || r.status === 403) && lan === 0) { const m = await lamMoi(db, k); if (!m) return { ok: false, loi: 'khoá Ethopex hết hạn, làm mới không được — cần đăng nhập lại app.ethopex.dev' }; k = m; continue; }
    if (!r?.ok) return { ok: false, loi: `Ethopex ${r?.status ?? 'mạng'} ở ${duong}` };
    return { ok: true, data: (await r.json()) as T };
  }
  return { ok: false, loi: 'Ethopex không trả' };
}
