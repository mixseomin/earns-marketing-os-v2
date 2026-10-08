'use server';

// Anh DUYỆT bản xem một sản phẩm ngay trong MOS2 (drawer sản phẩm, tab Tài sản) — ghi listing_config.duyet = hôm nay
// cho MỌI dòng sổ cùng tên (một cuốn = nhiều dòng: Etsy · Gumroad · KDP). Máy sản xuất (puzzle-books quy-trinh.mjs) đọc
// ngày này để qua bước 6 và mở khoá bật bán; dựng lại sau ngày duyệt thì phải duyệt lại.
import { revalidateTag } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { THE_SO_SP } from '@/lib/products/data';
import { writeFile } from 'node:fs/promises';

// Đánh thức bot Telegram MINE (scripts/bao-sp-telegram.mjs) NGAY sau khi sổ đổi: systemd bao-sp-telegram.path canh tệp này
// → chạy bot liền (xoá tin "Sản xuất xong" của sách vừa duyệt). Không có tệp/thư mục (máy dev) thì thôi: timer 1 phút trên box3 vẫn đỡ.
const KICH = process.env.BAO_SP_KICH || '/var/lib/mine-tg/kich';
const danhThucBot = () => writeFile(KICH, new Date().toISOString()).catch(() => undefined);

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'https://as.on.tc';
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN || '';

export async function duyetSanPham(id: string): Promise<{ ok: boolean; soDong?: number; error?: string }> {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') return { ok: false, error: 'Chỉ admin duyệt được.' };
  if (!DIRECTUS_TOKEN) return { ok: false, error: 'Máy chủ thiếu DIRECTUS_TOKEN.' };
  const h = { Authorization: `Bearer ${DIRECTUS_TOKEN}`, 'Content-Type': 'application/json' };
  const goc = await fetch(`${DIRECTUS_URL}/items/products/${encodeURIComponent(id)}?fields=title`, { headers: h, cache: 'no-store' });
  if (!goc.ok) return { ok: false, error: `Không đọc được sản phẩm (${goc.status}).` };
  const title = ((await goc.json()) as { data?: { title?: string } }).data?.title;
  if (!title) return { ok: false, error: 'Sản phẩm không có tên.' };
  const ds = await fetch(`${DIRECTUS_URL}/items/products?limit=-1&fields=id,listing_config&filter[title][_eq]=${encodeURIComponent(title)}`, { headers: h, cache: 'no-store' });
  const rows = ((await ds.json()) as { data?: { id: string; listing_config: Record<string, unknown> | null }[] }).data ?? [];
  const ngay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  for (const r of rows) {
    const res = await fetch(`${DIRECTUS_URL}/items/products/${r.id}`, { method: 'PATCH', headers: h,
      body: JSON.stringify({ listing_config: { ...(r.listing_config ?? {}), duyet: ngay, duyetLuc: new Date().toISOString(), duyetBam: (r.listing_config?.xem as { bam?: string } | undefined)?.bam ?? null, duyetBoi: me.email ?? me.id } }) });
    if (!res.ok) return { ok: false, error: `Ghi duyệt thất bại ở dòng ${r.id} (${res.status}).` };
  }
  revalidateTag(THE_SO_SP);   // trang đọc lại sổ ngay, không đợi bộ đệm 15s
  await danhThucBot();
  return { ok: true, soDong: rows.length };
}

/** Trạng thái sổ cái Directus (`products.status`) — cùng bộ khoá với ~/bin/sanpham. Card #1160: anh cần đổi tay ngay trong MOS2. */
const TT_SO = ['planned', 'draft', 'owner_review', 'ready', 'in_review', 'published', 'unlisted', 'archived'] as const;
export async function datTrangThaiSp(id: string, status: string): Promise<{ ok: boolean; error?: string }> {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') return { ok: false, error: 'Chỉ admin đổi được trạng thái.' };
  if (!DIRECTUS_TOKEN) return { ok: false, error: 'Máy chủ thiếu DIRECTUS_TOKEN.' };
  if (!(TT_SO as readonly string[]).includes(status)) return { ok: false, error: `Trạng thái lạ: ${status}` };
  const res = await fetch(`${DIRECTUS_URL}/items/products/${encodeURIComponent(id)}`, { method: 'PATCH',
    headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
  if (!res.ok) return { ok: false, error: `Sổ cái từ chối (${res.status}): ${(await res.text()).slice(0, 160)}` };
  revalidateTag(THE_SO_SP);
  await danhThucBot();   // đổi tay sang published / khỏi chờ duyệt → báo hoặc xoá tin Telegram ngay
  return { ok: true };
}
