// Ghi bộ cảnh Claude vừa tách vào DB — MỘT đường cho server action (tachCanhTap) lẫn script dựng phim từ mẫu (scripts/dung-phim-mau.mts).
// Cảnh nháp cũ vào thùng rác (khôi phục được, #1192); tên anchor/biến thể trong kết quả nối về id theo tên (không phân biệt hoa thường).
import 'server-only';
import { sql } from 'drizzle-orm';
import type { getDb } from '@mos2/db';
import { boVaoThungRac } from './thung-rac';
import { lamSachKyThuat } from './dien-anh';
import { ghepThoai, type NhanVat } from './kieu';
import type { tachCanh } from './claude';

type Db = NonNullable<ReturnType<typeof getDb>>;
type KqTach = Extract<Awaited<ReturnType<typeof tachCanh>>, { ok: true }>;

export async function luuCanhTach(db: Db, o: { tapId: number; tenTap: string; kq: KqTach; nhanVat: NhanVat[]; nguoi: string; thoiLuongS?: number | null }): Promise<number> {
  const { tapId, kq } = o;
  if (o.thoiLuongS) await db.execute(sql`UPDATE xv_tap SET thoi_luong_s = ${o.thoiLuongS} WHERE id = ${tapId}`);
  const tenToId = new Map(o.nhanVat.map((v) => [v.ten.trim().toLowerCase(), v.id]));
  const btToId = new Map(o.nhanVat.flatMap((v) => (v.bien_the ?? []).map((b) => [`${v.ten} · ${b.ten}`.trim().toLowerCase(), b.id] as [string, number])));
  const nhapCu = (await db.execute(sql`SELECT id FROM xv_canh WHERE tap_id = ${tapId} AND trang_thai = 'nhap'`)) as unknown as { id: unknown }[];
  await boVaoThungRac(db, 'canh', nhapCu.map((x) => Number(x.id)), o.nguoi, `${nhapCu.length} cảnh nháp cũ (tách lại cảnh · ${o.tenTap})`);
  const giu = (await db.execute(sql`SELECT coalesce(max(thu_tu), 0) AS m FROM xv_canh WHERE tap_id = ${tapId}`)) as unknown as { m: unknown }[];
  let thuTu = Number(giu[0]?.m ?? 0);
  for (const c of kq.canh) {
    thuTu += 1;
    const ids = c.nhan_vat.map((t) => tenToId.get(t.trim().toLowerCase())).filter((x): x is number => typeof x === 'number');
    const bts = (c.bien_the ?? []).map((t) => btToId.get(t.replace(/\s*[·\-–|]\s*/, ' · ').trim().toLowerCase())).filter((x): x is number => typeof x === 'number');
    const thoai = (c.thoai ?? []).filter((d) => d.loi.trim());
    await db.execute(sql`INSERT INTO xv_canh (tap_id, thu_tu, canh, goc_may, hanh_dong, loi_thoai, thoai, am_thanh, thoi_luong_s, nhan_vat, bien_the, prompt_anh, prompt_video, phan_doan, cam_xuc, ky_thuat, trang_phuc, phat_s, chu_man, nhanh)
      VALUES (${tapId}, ${thuTu}, ${c.canh}, ${c.goc_may}, ${c.hanh_dong}, ${thoai.length ? ghepThoai(thoai) : c.loi_thoai}, ${JSON.stringify(thoai)}::jsonb, ${c.am_thanh}, ${c.thoi_luong_s}, ${JSON.stringify(ids)}::jsonb, ${JSON.stringify(bts)}::jsonb, ${c.prompt_anh}, ${c.prompt_video},
        ${c.phan_doan}, ${c.cam_xuc}, ${JSON.stringify(lamSachKyThuat(c.ky_thuat as unknown as Record<string, unknown>))}::jsonb, ${c.trang_phuc ?? ''}, ${c.phat_s}, ${c.chu_man ?? ''}, ${c.nhanh ?? ''})`);
  }
  await db.execute(sql`UPDATE xv_tap SET tom_tat = CASE WHEN tom_tat = '' THEN ${kq.tomTat} ELSE tom_tat END, beats = ${JSON.stringify(kq.beats)}::jsonb,
    phan_canh = ${JSON.stringify(kq.phanCanh)}::jsonb, trang_thai = 'storyboard', updated_at = now() WHERE id = ${tapId}`);
  return kq.canh.length;
}
