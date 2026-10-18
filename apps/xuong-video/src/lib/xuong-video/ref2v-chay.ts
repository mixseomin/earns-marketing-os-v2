// Phần máy chủ của THỬ "nhiều shot trong một clip" (ref2v-canh.ts): nạp shot + ảnh mẫu của một phân cảnh, xem trước (0đ), gửi một lượt THỬ (tốn tiền —
// chỉ từ nút trong studio, anh bấm), liệt kê kết quả. Job gắn vào shot đầu cảnh để vòng nhận kết quả của tập (sinh-video.ts › kiemVideoTap) hỏi tới, nhưng
// request.ref2v = true → vòng đó KHÔNG đụng clip / trạng thái của shot nào, chỉ ghi url + tiền vào job.
import 'server-only';
import { sql } from 'drizzle-orm';
import { mapCanh, mapNhanVat, taoJob, xongJob, type Db, type Row } from './doc-db';
import { guiFal } from './fal';
import { docKinhThanh, type KinhThanh } from './kieu';
import { dungRef2v, MODEL_REF2V, type GoiRef2v } from './ref2v-canh';

type Kq<T> = { ok: true; data: T } | { ok: false; loi: string };

export async function napRef2v(db: Db, tapId: number, phanDoan: string, tieng = false): Promise<(GoiRef2v & { dauId: number | null }) | null> {
  const shots = ((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} AND phan_doan = ${phanDoan} AND coalesce(nhanh, '') IN ('', 'A') ORDER BY thu_tu, id`)) as unknown as Row[]).map(mapCanh);
  if (!shots.length) return null;
  const ids = [...new Set(shots.flatMap((c) => c.nhan_vat))];
  const nv = ids.length ? ((await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE id = ANY(${`{${ids.join(',')}}`}::int[])`)) as unknown as Row[]).map(mapNhanVat) : [];
  const kt = docKinhThanh(((await db.execute(sql`SELECT p.kinh_thanh FROM xv_tap t JOIN xv_phim p ON p.id = t.phim_id WHERE t.id = ${tapId}`)) as unknown as Row[])[0]?.kinh_thanh as KinhThanh);
  return { ...dungRef2v(shots, nv, { tiLe: kt.ti_le, tieng }), dauId: shots[0]!.id };
}

export async function guiRef2v(db: Db, tapId: number, phanDoan: string, tieng = false): Promise<Kq<number>> {
  const g = await napRef2v(db, tapId, phanDoan, tieng);
  if (!g || g.dauId == null) return { ok: false, loi: 'không thấy phân cảnh' };
  if (g.loi.length) return { ok: false, loi: g.loi.join(' · ') };
  const job = await taoJob(db, { cents: g.cents, nhan: `🧪 THỬ nhiều shot / một clip · cảnh ${phanDoan} · ${g.giay}s · ${g.shots.length} shot${tieng ? '' : ' · không tiếng'}`, canh_id: g.dauId, loai: 'video', provider: 'fal', model: `fal:${MODEL_REF2V}`,
    request: { ref2v: true, phan_doan: phanDoan, giay: g.giay, cents: g.cents, tieng, shots: g.shots, tham_chieu: g.tham_chieu.map((t) => ({ ten: t.ten, ma: t.ma })), prompt: g.shots.map((x) => `[${x.giay}s] ${x.prompt}`).join(' | ') } });
  const kq = await guiFal(MODEL_REF2V, g.input);
  if (!kq.ok) { await xongJob(db, job, { loi: kq.loi }); return { ok: false, loi: kq.loi }; }
  await db.execute(sql`UPDATE xv_job SET trang_thai = 'chay', task_id = ${kq.taskId}, updated_at = now() WHERE id = ${job}`);
  return { ok: true, data: job };
}

export type KetRef2v = { id: number; phan_doan: string; trang_thai: string; output_url: string | null; loi: string; cents: number; giay: number; luc: string };
export async function dsRef2v(db: Db, tapId: number): Promise<KetRef2v[]> {
  const r = (await db.execute(sql`SELECT j.id, j.trang_thai, j.output_url, j.loi, j.chi_phi_cents, j.request, j.created_at FROM xv_job j JOIN xv_canh c ON c.id = j.canh_id
    WHERE c.tap_id = ${tapId} AND j.request->>'ref2v' = 'true' ORDER BY j.id DESC LIMIT 30`)) as unknown as Row[];
  return r.map((x) => { const rq = (x.request ?? {}) as { phan_doan?: string; giay?: number; cents?: number };
    return { id: Number(x.id), phan_doan: rq.phan_doan ?? '', trang_thai: String(x.trang_thai), output_url: x.output_url == null ? null : String(x.output_url), loi: String(x.loi ?? ''), cents: Number(x.chi_phi_cents) || rq.cents || 0, giay: rq.giay ?? 0, luc: String(x.created_at) }; });
}
