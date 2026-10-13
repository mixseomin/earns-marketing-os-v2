// Máy chủ của bản phụ đề Việt (phu-de.ts): dịch chữ màn + câu nói sang tiếng Việt (1 lượt Claude), xuất MP4 có phụ đề, ghi vào danh sách
// bản xuất của tập với nhãn "phụ đề Việt" — KHÔNG thay bản xuất chính (video_url giữ nguyên). Một chỗ cho nút (actions.ts) và script.
import 'server-only';
import { sql } from 'drizzle-orm';
import { dichChuoi } from './claude';
import { chuoiCanDich, apDich } from './phu-de';
import { chayXuat } from './xuat-chay';
import { docKinhThanh, locNhanh } from './kieu';
import { boiCanhTap, mapCanh, ghiTienChu, xongJob, type Db, type Row } from './doc-db';

/** khongDich = dựng bằng câu gốc, bỏ lượt Claude (0đ) — script dùng để thử đường dựng phụ đề mà không tiêu tiền. */
export async function xuatPhuDeViTap(db: Db, tapId: number, job: number, khongDich = false): Promise<{ ok: true; url: string } | { ok: false; loi: string }> {
  const bc = await boiCanhTap(db, tapId);
  if (!bc) return { ok: false, loi: 'không thấy tập' };
  const kt = docKinhThanh(bc.kt);
  if (kt.ngon_ngu === 'vi') return { ok: false, loi: 'phim đã là tiếng Việt — xuất bản thường là đủ' };
  const canh = locNhanh(((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu, id`)) as unknown as Row[]).map(mapCanh), 'A');
  if (!canh.length) return { ok: false, loi: 'tập chưa có shot' };
  const ds = chuoiCanDich(canh);
  const dich = new Map<string, string>();
  if (ds.length && !khongDich) {
    const kq = await dichChuoi({ kinhThanh: bc.kt, sang: 'vi', ds, thuatNgu: [] });
    if (!kq.ok) return kq;
    await ghiTienChu(db, bc.tap.phim_id, `Dịch phụ đề Việt · tập ${bc.tap.so}`, kq.model, kq.tokens);
    ds.forEach((x, i) => dich.set(x, kq.data[i] ?? x));
  }
  const { canh: canhVi, phuDe } = apDich(canh, dich);
  const kq = await chayXuat({ loai: bc.loai, tiLe: kt.ti_le, canh: canhVi, nhanVat: bc.nhanVat, tap: bc.tap, qc: kt.qc, nhanh: null, choThieuNhac: true, phuDe });
  if (!kq.ok) return kq;
  const ban = { url: kq.url, nhanh: '', phu_de: 'vi', giay: Math.round(kq.giay * 10) / 10, luc: new Date().toISOString(), job, canh_bao: kq.canhBao };
  await db.execute(sql`UPDATE xv_tap SET xuat = coalesce(xuat, '[]'::jsonb) || ${JSON.stringify([ban])}::jsonb, updated_at = now() WHERE id = ${tapId}`);
  await xongJob(db, job, { output_url: kq.url });
  return { ok: true, url: kq.url };
}
