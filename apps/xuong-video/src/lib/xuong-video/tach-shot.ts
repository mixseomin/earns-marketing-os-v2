// TÁCH / CHÈN SHOT theo khuôn chuỗi (anh 18/10/2026: "timeline phải show được chuỗi đó ở các vị trí phù hợp — có thể phải tách shot").
//   tachShotDb : một shot dồn nhiều nhịp ("Vivian ném giấy; Hạ quỳ nhặt; đồng nghiệp xì xào") → N shot liền nhau, mỗi shot một nhịp; khuôn
//                đang gán shot đó vào [b0, b1, b2] thì mỗi shot mới nhận đúng một bước.
//   chenShotDb : bước khuôn bị THIẾU (vd "Mặt kẻ thua" sau đòn quyết định) → chèn một shot trống đúng chỗ khuôn chỉ, gắn sẵn vào bước đó.
// Shot mới chỉ có chữ + vai kể (0đ) — chưa keyframe / clip; sinh hình là bước riêng, có giá trên nút như mọi shot. Thứ tự cũ + khuôn cũ được
// chụp trước (hoan-tac.ts) nên ↶ hoàn tác được; shot thêm vào bỏ bằng 🗑 (thùng rác).
import { sql } from 'drizzle-orm';
import type { getDb } from '@mos2/db';
import { chupTruoc } from './hoan-tac';
import { khoaPhat } from './kieu';
import { buocCua, khuonTheoKey, kiemKhuon, type ApKhuon, type ShotKhuon } from './khuon-chuoi';

type Db = NonNullable<ReturnType<typeof getDb>>;
type Row = Record<string, unknown>;

/** Dời các shot đứng SAU `thuTu` xuống `so` chỗ (chụp thứ tự cũ trước) rồi chèn `so` shot mới ngay sau. Trả id shot mới theo thứ tự. */
async function chenSau(db: Db, tapId: number, goc: Row, so: number, moi: { canh: string; hanh_dong: string; ky_thuat: Record<string, unknown> }[], nguoi: string, moTa: string): Promise<number[]> {
  const thuTu = Number(goc.thu_tu);
  const sau = (await db.execute(sql`SELECT id FROM xv_canh WHERE tap_id = ${tapId} AND thu_tu > ${thuTu}`)) as unknown as Row[];
  const nhom = await chupTruoc(db, { bang: 'xv_tap', id: tapId, cot: ['khuon_chuoi', 'khong_gian', 'phan_canh_ve'], moTa, nguoi });
  for (const r of sau) await chupTruoc(db, { bang: 'xv_canh', id: Number(r.id), cot: ['thu_tu'], moTa, nguoi, nhom });
  await db.execute(sql`UPDATE xv_canh SET thu_tu = thu_tu + ${so}, updated_at = now() WHERE tap_id = ${tapId} AND thu_tu > ${thuTu}`);
  // DỒN CẢ những gì ghi THEO SỐ SHOT của tập (01/11/2026, chèn #2.9 phim #353): sổ đồ vật + sổ dáng (khong_gian › so_vat / so_dang, mốc `tu` = thu_tu)
  // và khối phân cảnh vẽ (phan_canh_ve › khoi tu/den). Không dồn thì mọi sự kiện sau chỗ chèn xảy ra SỚM một shot (giật thẻ, cúi nhìn…).
  const tap = ((await db.execute(sql`SELECT khong_gian, phan_canh_ve FROM xv_tap WHERE id = ${tapId}`)) as unknown as Row[])[0];
  const kg = dOnSoShot(tap?.khong_gian, thuTu, so); const pcv = dOnKhoi(tap?.phan_canh_ve, thuTu, so);
  if (kg || pcv) await db.execute(sql`UPDATE xv_tap SET khong_gian = coalesce(${kg ? JSON.stringify(kg) : null}::jsonb, khong_gian), phan_canh_ve = coalesce(${pcv ? JSON.stringify(pcv) : null}::jsonb, phan_canh_ve), updated_at = now() WHERE id = ${tapId}`);
  const ids: number[] = [];
  for (const [i, m] of moi.entries()) {
    // MANG THEO 3D + chỉ đạo của shot gốc (19/10/2026: shot tách ra không có may_3d / dan_dung → không dựng được khung 3D, không chấm được, tập 135 #5):
    // cùng set, cùng chỗ đứng, cùng máy — sửa máy / động tác cho nhịp mới sau. Mã shot nối hậu tố (1.5 → 1.5b) để không trùng. Thoại ở lại shot gốc.
    const dd = goc.dan_dung && typeof goc.dan_dung === 'object' ? { ...(goc.dan_dung as Record<string, unknown>), ...((goc.dan_dung as { ma?: string }).ma ? { ma: `${(goc.dan_dung as { ma: string }).ma}${'bcdefghij'[i]}` } : {}) } : null;
    const r = (await db.execute(sql`INSERT INTO xv_canh (tap_id, thu_tu, canh, hanh_dong, phan_doan, nhan_vat, bien_the, ky_thuat, thoi_luong_s, may_3d, dan_dung, cam_xuc, trang_phuc, bieu_cam)
      VALUES (${tapId}, ${thuTu + 1 + i}, ${m.canh}, ${m.hanh_dong}, ${goc.phan_doan ?? ''}, ${JSON.stringify(goc.nhan_vat ?? [])}::jsonb, ${JSON.stringify(goc.bien_the ?? [])}::jsonb,
        ${JSON.stringify(m.ky_thuat)}::jsonb, ${Number(goc.thoi_luong_s) || 4}, ${goc.may_3d ? JSON.stringify(goc.may_3d) : null}::jsonb, ${dd ? JSON.stringify(dd) : null}::jsonb,
        ${Number(goc.cam_xuc) || 0}, ${String(goc.trang_phuc ?? '')}, ${goc.bieu_cam ? JSON.stringify(goc.bieu_cam) : null}::jsonb) RETURNING id`)) as unknown as Row[];
    ids.push(Number(r[0]!.id));
  }
  return ids;
}

/** Dồn mốc `tu` > thuTu của mọi sổ theo số shot (so_vat, so_dang) trong khong_gian của tập; null = không có gì để dồn. Thuần. */
export function dOnSoShot(kgRaw: unknown, thuTu: number, so: number): Record<string, unknown> | null {
  if (!kgRaw || typeof kgRaw !== 'object') return null;
  let doi = false;
  const kg = Object.fromEntries(Object.entries(kgRaw as Record<string, Record<string, unknown>>).map(([canh, k]) => {
    if (!k || typeof k !== 'object') return [canh, k];
    const ra = { ...k };
    for (const so_ of ['so_vat', 'so_dang'] as const) {
      const sv = k[so_] as Record<string, { tu: number }[]> | undefined; if (!sv) continue;
      ra[so_] = Object.fromEntries(Object.entries(sv).map(([mon, ds]) => [mon, ds.map((m) => (m.tu > thuTu ? (doi = true, { ...m, tu: m.tu + so }) : m))]));
    }
    return [canh, ra];
  }));
  return doi ? kg : null;
}
/** Dồn khối phân cảnh vẽ (tu/den theo số shot) sau chỗ chèn. Thuần. */
export function dOnKhoi(pcvRaw: unknown, thuTu: number, so: number): unknown[] | null {
  if (!Array.isArray(pcvRaw)) return null; let doi = false;
  const ra = pcvRaw.map((p: { khoi?: { tu: number; den: number }[] }) => (p?.khoi ? { ...p, khoi: p.khoi.map((k) => { const t = k.tu > thuTu ? k.tu + so : k.tu, d = k.den > thuTu ? k.den + so : k.den; if (t !== k.tu || d !== k.den) doi = true; return { ...k, tu: t, den: d }; }) } : p));
  return doi ? ra : null;
}

/** Chèn MỘT shot đã soạn sẵn ngay SAU shot `idTruoc` (dồn số các shot sau + mọi sổ theo số shot). Shot mới mang cảnh / nhân vật / look / 3D của shot trước,
 *  đè bằng các trường truyền vào (hành động, kỹ thuật, chỉ đạo khung mở / kết, giây phát). */
export async function chenShotSauDb(db: Db, idTruoc: number, moi: { hanh_dong: string; ky_thuat: Record<string, unknown>; dan_dung?: Record<string, unknown> | null; phat_s?: number | null }, nguoi: string): Promise<{ ok: true; id: number } | { ok: false; loi: string }> {
  const g = ((await db.execute(sql`SELECT * FROM xv_canh WHERE id = ${idTruoc}`)) as unknown as Row[])[0];
  if (!g) return { ok: false, loi: 'không thấy shot đứng trước' };
  const [id] = await chenSau(db, Number(g.tap_id), g, 1, [{ canh: String(g.canh ?? ''), hanh_dong: moi.hanh_dong, ky_thuat: moi.ky_thuat }], nguoi, `chèn shot sau #${g.thu_tu}`);
  await db.execute(sql`UPDATE xv_canh SET dan_dung = coalesce(${moi.dan_dung ? JSON.stringify(moi.dan_dung) : null}::jsonb, dan_dung), phat_s = coalesce(${moi.phat_s ?? null}, phat_s), nhanh = ${g.nhanh ?? null} WHERE id = ${id!}`);
  return { ok: true, id: id! };
}

/** SHOT CON: shot có số hiện lẻ (so_hien 2.9 / 3.1) là đoạn của shot số nguyên cùng nhánh — 2.9 thuộc #2 (đoạn cuối), 3.1 thuộc #3 (đoạn đầu)
 *  → con_cua = id shot cha. Gọi sau mọi lần dựng / cập nhật tập. */
export async function ganShotCha(db: Db, tapId: number): Promise<void> {
  await db.execute(sql`UPDATE xv_canh c SET con_cua = p.id FROM xv_canh p WHERE c.tap_id = ${tapId} AND p.tap_id = c.tap_id AND c.so_hien IS NOT NULL AND c.so_hien <> floor(c.so_hien)
    AND p.so_hien IS NULL AND p.thu_tu = floor(c.so_hien) AND coalesce(p.nhanh, '') = coalesce(c.nhanh, '') AND c.con_cua IS DISTINCT FROM p.id`);
  await db.execute(sql`UPDATE xv_canh SET con_cua = NULL WHERE tap_id = ${tapId} AND (so_hien IS NULL OR so_hien = floor(so_hien)) AND con_cua IS NOT NULL`);
}

/** Thêm SHOT CON số hiện `so` (2.9 = đoạn cuối #2 · 3.1 = đoạn đầu #3) — KHÔNG dồn số shot khác, sổ theo số shot giữ nguyên.
 *  Shot con mang cảnh / nhân vật / look của shot cha (shot số nguyên floor/ceil tương ứng). */
export async function themShotConDb(db: Db, tapId: number, so: number, moi: { hanh_dong: string; ky_thuat: Record<string, unknown>; phat_s?: number | null; nhanh?: string | null }): Promise<{ ok: true; id: number } | { ok: false; loi: string }> {
  if (so === Math.floor(so)) return { ok: false, loi: 'shot con phải có số lẻ (vd 2.9 hoặc 3.1)' };
  const soCha = Math.floor(so);
  const g = ((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} AND thu_tu = ${soCha} AND so_hien IS NULL AND coalesce(nhanh, '') = coalesce(${moi.nhanh ?? null}, '')`)) as unknown as Row[])[0];
  if (!g) return { ok: false, loi: `không thấy shot cha #${soCha}` };
  const trung = (await db.execute(sql`SELECT 1 FROM xv_canh WHERE tap_id = ${tapId} AND so_hien = ${so} AND coalesce(nhanh, '') = coalesce(${moi.nhanh ?? null}, '')`)) as unknown as Row[];
  if (trung.length) return { ok: false, loi: `đã có shot #${so}` };
  const r = (await db.execute(sql`INSERT INTO xv_canh (tap_id, thu_tu, so_hien, con_cua, nhanh, canh, hanh_dong, phan_doan, nhan_vat, bien_the, ky_thuat, thoi_luong_s, phat_s, cam_xuc, trang_phuc, bieu_cam)
    VALUES (${tapId}, ${khoaPhat(so)}, ${so}, ${Number(g.id)}, ${moi.nhanh ?? null}, ${String(g.canh ?? '')}, ${moi.hanh_dong}, ${g.phan_doan ?? ''}, ${JSON.stringify(g.nhan_vat ?? [])}::jsonb, ${JSON.stringify(g.bien_the ?? [])}::jsonb,
      ${JSON.stringify(moi.ky_thuat)}::jsonb, ${Number(g.thoi_luong_s) || 4}, ${moi.phat_s ?? null}, ${Number(g.cam_xuc) || 0}, ${String(g.trang_phuc ?? '')}, ${g.bieu_cam ? JSON.stringify(g.bieu_cam) : null}::jsonb) RETURNING id`)) as unknown as Row[];
  return { ok: true, id: Number(r[0]!.id) };
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
  // Khuôn: shot gánh [b0, b1, …] → gốc giữ b0, shot mới thứ k nhận b(k). Thiếu bước: nhận BƯỚC KẾ TIẾP CÒN TRỐNG của khuôn (chưa shot nào gánh) nếu có,
  // không thì giữ bước cuối — 23/10/2026 #132 tách #15 (giật thẻ) ra cận chèn: shot mới chép lại "Kẻ ác gây sự" (bước chỉ một shot, vai sai) trong khi
  // bước kế "Chi tiết nỗi nhục" (cận tấm thẻ bị giật) đang trống.
  const khuon = (await docKhuon(db, tapId)).map((a) => {
    const bs = buocCua(a.shots[String(id)]); if (!bs.length) return a;
    const shots = { ...a.shots, [String(id)]: bs[0]! };
    const daGanh = new Set(Object.entries(a.shots).filter(([sid]) => sid !== String(id)).flatMap(([, b]) => buocCua(b)));
    let tiep = Math.max(...bs) + 1;
    moi.forEach((nid, k) => {
      if (k + 1 < bs.length) { shots[String(nid)] = bs[k + 1]!; return; }
      const so = khuonTheoKey(a.khuon)?.buoc.length ?? 0;
      while (tiep < so && daGanh.has(tiep)) tiep++;
      shots[String(nid)] = tiep < so ? tiep++ : bs[bs.length - 1]!;
    });
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
