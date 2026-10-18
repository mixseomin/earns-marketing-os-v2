// TÁCH / CHÈN SHOT theo khuôn chuỗi (anh 18/10/2026: "timeline phải show được chuỗi đó ở các vị trí phù hợp — có thể phải tách shot").
//   tachShotDb : một shot dồn nhiều nhịp ("Vivian ném giấy; Hạ quỳ nhặt; đồng nghiệp xì xào") → N shot liền nhau, mỗi shot một nhịp; khuôn
//                đang gán shot đó vào [b0, b1, b2] thì mỗi shot mới nhận đúng một bước.
//   chenShotDb : bước khuôn bị THIẾU (vd "Mặt kẻ thua" sau đòn quyết định) → chèn một shot trống đúng chỗ khuôn chỉ, gắn sẵn vào bước đó.
// Shot mới chỉ có chữ + vai kể (0đ) — chưa keyframe / clip; sinh hình là bước riêng, có giá trên nút như mọi shot. Thứ tự cũ + khuôn cũ được
// chụp trước (hoan-tac.ts) nên ↶ hoàn tác được; shot thêm vào bỏ bằng 🗑 (thùng rác).
import { sql } from 'drizzle-orm';
import type { getDb } from '@mos2/db';
import { chupTruoc } from './hoan-tac';
import { buocCua, khuonTheoKey, kiemKhuon, type ApKhuon, type ShotKhuon } from './khuon-chuoi';

type Db = NonNullable<ReturnType<typeof getDb>>;
type Row = Record<string, unknown>;

/** Dời các shot đứng SAU `thuTu` xuống `so` chỗ (chụp thứ tự cũ trước) rồi chèn `so` shot mới ngay sau. Trả id shot mới theo thứ tự. */
async function chenSau(db: Db, tapId: number, goc: Row, so: number, moi: { canh: string; hanh_dong: string; ky_thuat: Record<string, unknown> }[], nguoi: string, moTa: string): Promise<number[]> {
  const thuTu = Number(goc.thu_tu);
  const sau = (await db.execute(sql`SELECT id FROM xv_canh WHERE tap_id = ${tapId} AND thu_tu > ${thuTu}`)) as unknown as Row[];
  const nhom = await chupTruoc(db, { bang: 'xv_tap', id: tapId, cot: ['khuon_chuoi'], moTa, nguoi });
  for (const r of sau) await chupTruoc(db, { bang: 'xv_canh', id: Number(r.id), cot: ['thu_tu'], moTa, nguoi, nhom });
  await db.execute(sql`UPDATE xv_canh SET thu_tu = thu_tu + ${so}, updated_at = now() WHERE tap_id = ${tapId} AND thu_tu > ${thuTu}`);
  const ids: number[] = [];
  for (const [i, m] of moi.entries()) {
    const r = (await db.execute(sql`INSERT INTO xv_canh (tap_id, thu_tu, canh, hanh_dong, phan_doan, nhan_vat, bien_the, ky_thuat, thoi_luong_s)
      VALUES (${tapId}, ${thuTu + 1 + i}, ${m.canh}, ${m.hanh_dong}, ${goc.phan_doan ?? ''}, ${JSON.stringify(goc.nhan_vat ?? [])}::jsonb, ${JSON.stringify(goc.bien_the ?? [])}::jsonb,
        ${JSON.stringify(m.ky_thuat)}::jsonb, ${Number(goc.thoi_luong_s) || 4}) RETURNING id`)) as unknown as Row[];
    ids.push(Number(r[0]!.id));
  }
  return ids;
}

const docKhuon = async (db: Db, tapId: number) => ((await db.execute(sql`SELECT khuon_chuoi FROM xv_tap WHERE id = ${tapId}`)) as unknown as { khuon_chuoi: ApKhuon[] }[])[0]?.khuon_chuoi ?? [];
const ghiKhuon = (db: Db, tapId: number, ds: ApKhuon[]) => db.execute(sql`UPDATE xv_tap SET khuon_chuoi = ${JSON.stringify(ds)}::jsonb, updated_at = now() WHERE id = ${tapId}`);

/** Tách shot `id` thành phan.length shot: shot gốc giữ nhịp đầu (giữ hình cũ), các nhịp sau thành shot mới ngay sau nó. */
export async function tachShotDb(db: Db, id: number, phan: string[], nguoi: string): Promise<{ ok: true; ids: number[] } | { ok: false; loi: string }> {
  const ds = phan.map((x) => x.trim()).filter(Boolean);
  if (ds.length < 2) return { ok: false, loi: 'cần ít nhất 2 nhịp để tách' };
  const g = ((await db.execute(sql`SELECT * FROM xv_canh WHERE id = ${id}`)) as unknown as Row[])[0];
  if (!g) return { ok: false, loi: 'không thấy shot' };
  const tapId = Number(g.tap_id);
  const kt = (g.ky_thuat && typeof g.ky_thuat === 'object' ? g.ky_thuat : {}) as Record<string, unknown>;
  const moTa = `tách shot #${g.thu_tu} thành ${ds.length} nhịp`;
  const moi = await chenSau(db, tapId, g, ds.length - 1, ds.slice(1).map((h) => ({ canh: String(g.canh ?? ''), hanh_dong: h, ky_thuat: { ...kt, luat: [] } })), nguoi, moTa);
  await chupTruoc(db, { bang: 'xv_canh', id, cot: ['hanh_dong'], moTa, nguoi });
  await db.execute(sql`UPDATE xv_canh SET hanh_dong = ${ds[0]!}, updated_at = now() WHERE id = ${id}`);
  // Khuôn: shot gánh [b0, b1, …] → gốc giữ b0, shot mới thứ k nhận b(k) (thiếu bước thì giữ bước cuối).
  const khuon = (await docKhuon(db, tapId)).map((a) => {
    const bs = buocCua(a.shots[String(id)]); if (!bs.length) return a;
    const shots = { ...a.shots, [String(id)]: bs[0]! };
    moi.forEach((nid, k) => { shots[String(nid)] = bs[Math.min(k + 1, bs.length - 1)]!; });
    return { ...a, shots };
  });
  await ghiKhuon(db, tapId, khuon);
  return { ok: true, ids: [id, ...moi] };
}

/** Chèn một shot cho bước THIẾU `buoc` của lần áp khuôn thứ `apIdx`, đúng chỗ kiemKhuon chỉ (sau shot `thieu.sau`, hoặc trước shot đầu). */
export async function chenShotKhuonDb(db: Db, tapId: number, apIdx: number, buoc: number, moTa: string, nguoi: string): Promise<{ ok: true; id: number } | { ok: false; loi: string }> {
  const ds = await docKhuon(db, tapId);
  const ap = ds[apIdx]; const kh = ap && khuonTheoKey(ap.khuon); const b = kh?.buoc[buoc];
  if (!ap || !kh || !b) return { ok: false, loi: 'không thấy lần áp / bước khuôn' };
  const canh = (await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu`)) as unknown as Row[];
  const k = kiemKhuon(ap, canh.map((c) => ({ id: Number(c.id), thu_tu: Number(c.thu_tu), ky_thuat: c.ky_thuat as ShotKhuon['ky_thuat'] })));
  const th = k?.thieu.find((t) => t.buoc === buoc);
  if (!th) return { ok: false, loi: `bước "${b.ten}" không thiếu` };
  // Đứng sau shot th.sau; không có thì đứng TRƯỚC shot đầu của khuôn = sau shot liền trước nó.
  const dau = k!.shots[0]?.id;
  const goc = th.sau != null ? canh.find((c) => Number(c.id) === th.sau) : canh[canh.findIndex((c) => Number(c.id) === dau) - 1] ?? canh.find((c) => Number(c.id) === dau);
  if (!goc) return { ok: false, loi: 'không định được chỗ chèn' };
  const truocDau = th.sau == null && Number(goc.id) === dau;   // khuôn mở từ shot đầu tập: chèn vào thứ tự 0 rồi dồn
  const neo = truocDau ? { ...goc, thu_tu: Number(goc.thu_tu) - 1 } : goc;
  const [id] = await chenSau(db, tapId, neo, 1, [{ canh: String(goc.canh ?? ''), hanh_dong: moTa.trim() || `[${b.ten}] ${b.ghi}`, ky_thuat: { vai: b.vai[0], luat: b.luat ?? [] } }], nguoi, `chèn shot "${b.ten}" (khuôn ${kh.ten})`);
  ds[apIdx] = { ...ap, shots: { ...ap.shots, [String(id)]: buoc } };
  await ghiKhuon(db, tapId, ds);
  return { ok: true, id: id! };
}
