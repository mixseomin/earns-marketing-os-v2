// VIỆC NỀN (anh 11/11/2026: "bấm chạy xong là chết toi ko biết đang làm cái gì"): việc AI chạy lâu (kiểm người xem ~1 phút, hai lượt Opus) không chạy
// TRONG lệnh bấm nữa. chayViecNen ghi một dòng theo dõi (xv_job loai 'viec_nen', tinh_chi = false — tiền thật vẫn ghi ở dòng job riêng như cũ), trả mã
// ngay, chạy việc phía sau, ghi BƯỚC đang làm; trang hỏi docViecNen mỗi 2 s → bước + giây đã chạy + giây thường mất (trung bình 5 lần xong gần nhất).
// Studio khởi động lại (deploy) giữa chừng → dòng còn 'chay' mang boot cũ → docViecNen đổi thành lỗi kèm lý do, không treo im.
// Nút AI chạy lâu khác: bọc hàm cũ bằng chayViecNen + trang dùng useViecNen (components/viec-nen-ui.tsx).
import { sql } from 'drizzle-orm';
import type { getDb } from '@mos2/db';

type Db = NonNullable<ReturnType<typeof getDb>>;
type Row = Record<string, unknown>;
export const LOAI_VIEC_NEN = 'viec_nen';
/** lúc tiến trình này khởi động — mỗi lần deploy một giá trị */
const BOOT = new Date(Date.now() - process.uptime() * 1000).toISOString();

export type ViecNen = { id: number; viec: string; nhan: string; buoc: string; trang_thai: 'chay' | 'xong' | 'loi'; loi: string; giay: number; uoc_giay: number | null };

export async function chayViecNen(db: Db, o: { phimId: number | null; tapId: number | null; viec: string; nhan: string },
  lam: (buoc: (s: string) => Promise<void>) => Promise<{ ok: true } | { ok: false; loi: string }>): Promise<number> {
  const req = { viec: o.viec, tap_id: o.tapId, buoc: 'bắt đầu', boot: BOOT };
  const r = (await db.execute(sql`INSERT INTO xv_job (phim_id, nhan, loai, provider, model, trang_thai, chi_phi_cents, tinh_chi, request)
    VALUES (${o.phimId}, ${o.nhan}, ${LOAI_VIEC_NEN}, 'studio', ${o.viec}, 'chay', 0, false, ${JSON.stringify(req)}::jsonb) RETURNING id`)) as unknown as Row[];
  const id = Number(r[0]!.id);
  const buoc = async (s: string) => { await db.execute(sql`UPDATE xv_job SET request = jsonb_set(request, '{buoc}', to_jsonb(${s}::text)), updated_at = now() WHERE id = ${id}`); };
  void (async () => {
    let kq: { ok: true } | { ok: false; loi: string };
    try { kq = await lam(buoc); } catch (e) { console.error(`[việc nền ${o.viec} #${id}]`, e); kq = { ok: false, loi: `lỗi máy chủ: ${e instanceof Error ? e.message : String(e)}` }; }
    await db.execute(sql`UPDATE xv_job SET trang_thai = ${kq.ok ? 'xong' : 'loi'}, loi = ${kq.ok ? '' : kq.loi}, updated_at = now() WHERE id = ${id}`).catch((e) => console.error('[việc nền] ghi kết quả', e));
  })();
  return id;
}

/** Trạng thái một việc nền (theo mã, hoặc việc gần nhất của tập theo tên việc). Dòng 'chay' của tiến trình cũ → lỗi "bị ngắt do khởi động lại". */
export async function docViecNenDb(db: Db, q: { id: number } | { tapId: number; viec: string }): Promise<ViecNen | null> {
  const giay = sql`extract(epoch FROM (CASE WHEN trang_thai = 'chay' THEN now() ELSE updated_at END) - created_at) AS giay`;
  const rs = (await db.execute('id' in q
    ? sql`SELECT *, ${giay} FROM xv_job WHERE id = ${q.id} AND loai = ${LOAI_VIEC_NEN}`
    : sql`SELECT *, ${giay} FROM xv_job WHERE loai = ${LOAI_VIEC_NEN} AND model = ${q.viec} AND request->>'tap_id' = ${String(q.tapId)} ORDER BY id DESC LIMIT 1`)) as unknown as Row[];
  const r = rs[0]; if (!r) return null;
  const req = (r.request ?? {}) as { viec?: string; buoc?: string; boot?: string };
  let tt = String(r.trang_thai) as ViecNen['trang_thai']; let loi = r.loi == null ? '' : String(r.loi);
  if (tt === 'chay' && req.boot !== BOOT) {
    loi = `studio vừa khởi động lại (cập nhật bản mới) khi việc đang ở bước "${req.buoc ?? '?'}" — lượt bị ngắt, bấm chạy lại`;
    await db.execute(sql`UPDATE xv_job SET trang_thai = 'loi', loi = ${loi}, updated_at = now() WHERE id = ${Number(r.id)} AND trang_thai = 'chay'`);
    tt = 'loi';
  }
  const u = (await db.execute(sql`SELECT avg(extract(epoch FROM updated_at - created_at)) AS g FROM (SELECT * FROM xv_job WHERE loai = ${LOAI_VIEC_NEN} AND model = ${String(r.model)} AND trang_thai = 'xong' ORDER BY id DESC LIMIT 5) x`)) as unknown as Row[];
  return { id: Number(r.id), viec: String(r.model), nhan: String(r.nhan ?? ''), buoc: req.buoc ?? '', trang_thai: tt, loi, giay: Math.round(Number(r.giay)), uoc_giay: u[0]?.g == null ? null : Math.round(Number(u[0].g)) };
}
