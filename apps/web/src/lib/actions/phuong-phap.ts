'use server';

// Ghi THƯ VIỆN phương pháp (phuong_phap) và ô sản phẩm × phương pháp sửa tay (kenh_sp, project null) — admin-only, từ tab Tài sản.
// Ô do máy repo ghi (kenh_sp.project ≠ null) KHÔNG sửa tay ở đây: kenh.mjs upsert đè lại ở lần chạy kế, sửa tay là mất im lặng.
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import type { PhuongPhap } from '@/lib/tai-san/kieu';

const KEY_RE = /^[a-z0-9][a-z0-9_-]{1,40}$/;
async function admin(): Promise<string | null> {
  const me = await getCurrentUser();
  return me?.role === 'admin' ? null : 'Chỉ admin sửa được.';
}

export async function luuPhuongPhap(pp: PhuongPhap): Promise<{ ok: boolean; error?: string }> {
  const loi = await admin(); if (loi) return { ok: false, error: loi };
  const d = getDb(); if (!d) return { ok: false, error: 'no db' };
  const key = pp.key.trim().toLowerCase();
  if (!KEY_RE.test(key)) return { ok: false, error: 'Khoá: chữ thường, số, gạch (2–40 ký tự).' };
  const nhan = pp.nhan.trim(); if (!nhan) return { ok: false, error: 'Thiếu tên.' };
  const buoc = pp.buoc.map((b) => b.trim()).filter(Boolean);
  if (buoc.length < 2) return { ok: false, error: 'Cần ít nhất 2 bước (bước đầu là "chưa làm").' };
  const nham = [...new Set(pp.nham.map((x) => x.trim()).filter(Boolean))];
  const noi = { tk: (pp.noi.tk ?? []).filter((t) => Number.isInteger(t.id) && t.nhan.trim()).map((t) => ({ id: t.id, nhan: t.nhan.trim() })),
    ...(pp.noi.url?.trim() ? { url: pp.noi.url.trim() } : {}) };
  await d.execute(sql`INSERT INTO phuong_phap (key, nhan, mo_ta, nham, buoc, noi, may, thu_tu, bat, cap_nhat)
    VALUES (${key}, ${nhan}, ${pp.moTa.trim()}, ${nham}::text[], ${buoc}::text[], ${JSON.stringify(noi)}::jsonb, ${pp.may?.trim() || null}, ${pp.thuTu | 0}, ${!!pp.bat}, now())
    ON CONFLICT (key) DO UPDATE SET nhan = EXCLUDED.nhan, mo_ta = EXCLUDED.mo_ta, nham = EXCLUDED.nham, buoc = EXCLUDED.buoc, noi = EXCLUDED.noi,
      may = EXCLUDED.may, thu_tu = EXCLUDED.thu_tu, bat = EXCLUDED.bat, cap_nhat = now()`);
  revalidatePath('/');
  return { ok: true };
}

/** Ô sửa tay: tựa = sản phẩm trên cây (khoá cây) hoặc tựa sổ có sẵn (nếu dòng đó không do máy ghi). */
export async function datApDung(input: { sanPham: string; ten: string; kenh: string; muc: number; dich: string | null; ngayDang: string | null; canhBao: string | null })
  : Promise<{ ok: boolean; error?: string }> {
  const loi = await admin(); if (loi) return { ok: false, error: loi };
  const d = getDb(); if (!d) return { ok: false, error: 'no db' };
  const sanPham = input.sanPham.trim(), kenh = input.kenh.trim();
  if (!sanPham || !kenh) return { ok: false, error: 'Thiếu sản phẩm / phương pháp.' };
  const co = (await d.execute(sql`SELECT project FROM kenh_sp WHERE san_pham = ${sanPham} AND kenh = ${kenh} LIMIT 1`)) as unknown as { project: string | null }[];
  if (co[0]?.project) return { ok: false, error: `Ô này do máy của repo ${co[0].project} ghi — sửa ở repo đó (kenh.mjs), không sửa tay.` };
  const pp = (await d.execute(sql`SELECT array_length(buoc, 1) AS n FROM phuong_phap WHERE key = ${kenh}`)) as unknown as { n: number }[];
  if (!pp[0]) return { ok: false, error: 'Phương pháp không có trong thư viện.' };
  const muc = Math.max(0, Math.min(input.muc | 0, pp[0].n - 1));
  const ngay = input.ngayDang && /^\d{4}-\d{2}-\d{2}$/.test(input.ngayDang) ? input.ngayDang : null;
  const dich = input.dich?.trim() && /^https?:\/\//.test(input.dich.trim()) ? input.dich.trim() : null;
  await d.execute(sql`INSERT INTO kenh_sp (san_pham, kenh, ten, khop, muc, dich, canh_bao, ngay_dang, project, cap_nhat)
    VALUES (${sanPham}, ${kenh}, ${input.ten.slice(0, 200)}, NULL, ${muc}, ${dich}, ${input.canhBao?.trim() || null}, ${ngay}, NULL, now())
    ON CONFLICT (san_pham, kenh) DO UPDATE SET muc = EXCLUDED.muc, dich = EXCLUDED.dich, canh_bao = EXCLUDED.canh_bao, ngay_dang = EXCLUDED.ngay_dang, cap_nhat = now()`);
  revalidatePath('/');
  return { ok: true };
}
