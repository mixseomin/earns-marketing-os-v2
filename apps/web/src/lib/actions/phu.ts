'use server';

// Server actions cho trang PHỦ: sửa trạng thái/bước kế của nền tảng, thêm-sửa nguồn traffic,
// campaign, và nhập chi phí tay. Chỉ admin. Mọi thay đổi revalidate đúng trang.

import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';

async function guard() {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') throw new Error('chỉ admin');
  const db = getDb();
  if (!db) throw new Error('DATABASE_URL chưa cấu hình');
  return db;
}
const t = (v: unknown) => { const x = String(v ?? '').trim(); return x ? x : null; };

export async function luuPhuPlatform(projectId: string, id: number, d: { trangThai: string; chuongTrinh?: string; hoaHong?: string; linkMau?: string; cuaRa?: string; buocKe?: string; ghiChu?: string; cardId?: string; accountId?: string }) {
  const db = await guard();
  await db.execute(sql`
    UPDATE phu_platforms SET trang_thai = ${d.trangThai}, chuong_trinh = ${t(d.chuongTrinh)}, hoa_hong = ${t(d.hoaHong)},
           link_mau = ${t(d.linkMau)}, cua_ra = ${t(d.cuaRa)}, buoc_ke = ${t(d.buocKe)}, ghi_chu = ${t(d.ghiChu)},
           card_id = ${d.cardId && /^\d+$/.test(d.cardId) ? Number(d.cardId) : null}, account_id = ${d.accountId && /^\d+$/.test(d.accountId) ? Number(d.accountId) : null},
           updated_at = now()
     WHERE id = ${id} AND project_id = ${projectId}`);
  revalidatePath(`/p/${projectId}/phu`);
}

export async function luuPhuNguon(projectId: string, d: { id?: number; key: string; name: string; loai: string; trangThai: string; macroClick?: string; macroChi?: string; accountId?: string; napUsd?: string; ghiChu?: string }) {
  const db = await guard();
  const key = String(d.key).trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  if (!key) throw new Error('thiếu key');
  // Token postback sinh một lần lúc tạo, giữ nguyên khi sửa — mạng đã cấu hình URL rồi.
  await db.execute(sql`
    INSERT INTO phu_nguon (project_id, key, name, loai, trang_thai, macro_click, macro_chi, account_id, nap_usd, ghi_chu, postback_token)
    VALUES (${projectId}, ${key}, ${d.name}, ${d.loai}, ${d.trangThai}, ${t(d.macroClick)}, ${t(d.macroChi)},
            ${d.accountId && /^\d+$/.test(d.accountId) ? Number(d.accountId) : null}, ${Number(d.napUsd) || 0}, ${t(d.ghiChu)},
            encode(gen_random_bytes(12), 'hex'))
    ON CONFLICT (project_id, key) DO UPDATE SET name = EXCLUDED.name, loai = EXCLUDED.loai, trang_thai = EXCLUDED.trang_thai,
      macro_click = EXCLUDED.macro_click, macro_chi = EXCLUDED.macro_chi, account_id = EXCLUDED.account_id, nap_usd = EXCLUDED.nap_usd,
      ghi_chu = EXCLUDED.ghi_chu, updated_at = now()`);
  revalidatePath(`/p/${projectId}/phu`);
}

export async function luuPhuCamp(projectId: string, d: { nguonKey: string; ten: string; sidPrefix: string; lander?: string; target?: string; nganSachNgay?: string; trangThai: string; ghiChu?: string }) {
  const db = await guard();
  const prefix = String(d.sidPrefix).trim().replace(/[^A-Za-z0-9-]+/g, '_').replace(/^_+|_+$/g, '');
  if (!prefix || prefix.split('_').length !== 2) throw new Error('sid_prefix phải là <nguồn>_<camp>, đúng hai mẩu');
  let target: unknown = {};
  try { target = d.target ? JSON.parse(d.target) : {}; } catch { throw new Error('target phải là JSON'); }
  await db.execute(sql`
    INSERT INTO phu_camp (project_id, nguon_key, ten, sid_prefix, lander, target, ngan_sach_ngay, trang_thai, bat_dau, ghi_chu)
    VALUES (${projectId}, ${d.nguonKey}, ${d.ten}, ${prefix}, ${t(d.lander)}, ${JSON.stringify(target)}::jsonb,
            ${d.nganSachNgay ? Number(d.nganSachNgay) : null}, ${d.trangThai}, ${d.trangThai === 'chay' ? sql`now()` : null}, ${t(d.ghiChu)})
    ON CONFLICT (project_id, sid_prefix) DO UPDATE SET nguon_key = EXCLUDED.nguon_key, ten = EXCLUDED.ten, lander = EXCLUDED.lander,
      target = EXCLUDED.target, ngan_sach_ngay = EXCLUDED.ngan_sach_ngay, trang_thai = EXCLUDED.trang_thai,
      bat_dau = COALESCE(phu_camp.bat_dau, EXCLUDED.bat_dau), ghi_chu = EXCLUDED.ghi_chu, updated_at = now()`);
  revalidatePath(`/p/${projectId}/phu`);
}

export async function luuPhuChi(projectId: string, d: { ngay: string; sidPrefix: string; chiUsd: string; clicks?: string; impressions?: string }) {
  const db = await guard();
  const prefix = String(d.sidPrefix).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.ngay) || !prefix) throw new Error('cần ngày YYYY-MM-DD và sid_prefix');
  await db.execute(sql`
    INSERT INTO phu_chi (project_id, ngay, nguon_key, sid_prefix, chi_usd, clicks, impressions, nguon_du_lieu)
    VALUES (${projectId}, ${d.ngay}::date, ${prefix.split('_')[0]}, ${prefix}, ${Number(d.chiUsd) || 0},
            ${d.clicks ? Number(d.clicks) : null}, ${d.impressions ? Number(d.impressions) : null}, 'tay')
    ON CONFLICT (project_id, ngay, sid_prefix) DO UPDATE SET chi_usd = EXCLUDED.chi_usd, clicks = EXCLUDED.clicks,
      impressions = EXCLUDED.impressions, nguon_du_lieu = 'tay', updated_at = now()`);
  revalidatePath(`/p/${projectId}/phu`);
}
