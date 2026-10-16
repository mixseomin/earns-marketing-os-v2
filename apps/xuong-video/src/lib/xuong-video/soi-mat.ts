// 🙂 SOI MẶT cả tập trên máy chủ (chuẩn bị phim người thật — anh 16/10/2026 "nhân vật làm sao giữ được đúng khuôn mặt"). 0đ: OpenCV YuNet + SFace
// (scripts/soi-mat/soi-mat.py, cài bằng scripts/soi-mat/cai.sh). Mỗi shot có keyframe chưa soi (hoặc đã đổi) → so mặt trong khung với ảnh mẫu của
// các nhân vật gắn shot (anh_ref + ảnh biến thể) → ghi xv_canh.soi_mat. Nhân vật ảnh mẫu không có mặt người (hoạt hình, đồ vật) không theo dõi.
// Luật thuần + cổng ở khung.ts (trangThaiMat · chanKhung).
import 'server-only';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { chatLieuPhim, locNhanh, type KinhThanh, type NhanVat, type SoiMat } from './kieu';
import { uploadToR2 } from '../r2';
import { kemBienThe, mapCanh, mapNhanVat, type Db, type Row } from './doc-db';

const PY = process.env.XV_SOI_MAT_PY || '/opt/xv-soi-mat/bin/python';
const KICH_BAN = () => [path.join(process.cwd(), 'scripts/soi-mat/soi-mat.py'), '/opt/earns-marketing-os-v2/apps/xuong-video/scripts/soi-mat/soi-mat.py'].find((p) => existsSync(p));
type Ra = { mau: Record<string, number>; anh: { id: number; mat?: number; ket?: SoiMat['ket']; loi?: string }[] };

function chay(vao: unknown): Promise<Ra> {
  const kb = KICH_BAN();
  if (!kb || !existsSync(PY)) return Promise.reject(new Error('chưa cài soi mặt trên máy chủ — chạy apps/xuong-video/scripts/soi-mat/cai.sh'));
  return new Promise((ok, hong) => {
    const p = execFile(PY, [kb], { maxBuffer: 16 << 20, timeout: 10 * 60_000 }, (e, out) => { if (e) return hong(e); try { ok(JSON.parse(out) as Ra); } catch (x) { hong(x); } });
    p.stdin?.end(JSON.stringify(vao));
  });
}

export async function soiMatTap(db: Db, tapId: number, o: { tatCa?: boolean; /** false = chạy thử, không ghi DB */ ghi?: boolean } = {}): Promise<{ ok: true; data: { soi: number; lech: { thu_tu: number; chu: string }[]; theo_doi: string[] } } | { ok: false; loi: string }> {
  const t = (await db.execute(sql`SELECT t.phim_id, p.kinh_thanh FROM xv_tap t JOIN xv_phim p ON p.id = t.phim_id WHERE t.id = ${tapId}`)) as unknown as Row[];
  if (!t[0]) return { ok: false, loi: 'không thấy tập' };
  // Phim HOẠT HÌNH: không soi mặt (bộ so mặt người chấm mặt hoạt hình không tin được) — ghi "không theo dõi" đè kết quả cũ để lưới / cổng không đọc nhầm.
  const nguoiThat = chatLieuPhim(t[0].kinh_thanh as KinhThanh) === 'nguoi_that';
  const nv = await kemBienThe(db, ((await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${Number(t[0].phim_id)} AND loai = 'nhan_vat' ORDER BY id`)) as unknown as Row[]).map(mapNhanVat));
  const ds = locNhanh(((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu, id`)) as unknown as Row[]).map(mapCanh), 'A')
    .filter((c) => c.keyframe_url && (o.tatCa || c.soi_mat?.url !== c.keyframe_url));
  if (!ds.length) return { ok: true, data: { soi: 0, lech: [], theo_doi: [] } };
  if (!nguoiThat) {
    const luc = new Date().toISOString();
    if (o.ghi !== false) for (const c of ds) await db.execute(sql`UPDATE xv_canh SET soi_mat = ${JSON.stringify({ url: c.keyframe_url!, luc, mat: 0, ket: [], dat: true } satisfies SoiMat)}::jsonb WHERE id = ${c.id}`);
    return { ok: true, data: { soi: ds.length, lech: [], theo_doi: [] } };
  }
  await damBaoAnhMat(db, nv).catch((e: unknown) => console.error('[ảnh sát mặt]', e));
  const mau = Object.fromEntries(nv.map((v) => [v.ten, [...v.anh_ref, ...(v.bien_the ?? []).map((b) => b.anh_url)].filter((u): u is string => !!u)] as const).filter(([, u]) => u.length > 0));
  const tenCua = (ids: number[]) => ids.map((id) => nv.find((v) => v.id === id)?.ten).filter((x): x is string => !!x);
  let ra: Ra;
  try { ra = await chay({ mau, anh: ds.map((c) => ({ id: c.id, url: c.keyframe_url, ten: tenCua(c.nhan_vat) })) }); }
  catch (e) { return { ok: false, loi: `soi mặt lỗi: ${e instanceof Error ? e.message : String(e)}` }; }
  const luc = new Date().toISOString(); const lech: { thu_tu: number; chu: string }[] = [];
  for (const c of ds) {
    const a = ra.anh.find((x) => x.id === c.id); if (!a) continue;
    const ket = a.ket ?? [];
    const sm: SoiMat = { url: c.keyframe_url!, luc, mat: a.mat ?? 0, ket, dat: !a.loi && ket.every((k) => k.dat), ...(a.loi ? { loi: a.loi } : {}) };
    if (o.ghi !== false) await db.execute(sql`UPDATE xv_canh SET soi_mat = ${JSON.stringify(sm)}::jsonb WHERE id = ${c.id}`);
    if (!sm.dat && ket.length) lech.push({ thu_tu: c.thu_tu, chu: ket.filter((k) => !k.dat).map((k) => `${k.ten} ${Math.round((k.giong ?? 0) * 100)}%`).join(', ') });
  }
  return { ok: true, data: { soi: ds.length, lech, theo_doi: Object.entries(ra.mau).filter(([, n]) => n > 0).map(([ten]) => ten) } };
}

/** Người nhận một khung máy báo lệch mặt (máy báo nhầm: góc nghiêng gắt, ánh sáng lạ) — 0đ. Keyframe đổi thì soi lại từ đầu. */
export async function duyetMatTay(db: Db, canhId: number, nguoi: string): Promise<void> {
  await db.execute(sql`UPDATE xv_canh SET soi_mat = soi_mat || ${JSON.stringify({ duyet_tay: nguoi })}::jsonb WHERE id = ${canhId} AND soi_mat IS NOT NULL`);
}

/** ẢNH SÁT MẶT cho các nhân vật (phim người thật): cắt từ ảnh mẫu bằng soi-mat.py (mặt điển hình + một mặt khác góc), đẩy kho, ghi xv_nhan_vat.anh_mat.
 *  Chỉ cắt lại khi bộ ảnh mẫu đổi (tu = mã các URL). Sửa thẳng nv[] truyền vào để lượt sinh đang chạy dùng ngay. 0đ. */
export async function damBaoAnhMat(db: Db, nv: NhanVat[]): Promise<void> {
  const ma = (v: NhanVat) => createHash('sha1').update([...v.anh_ref, ...(v.bien_the ?? []).map((b) => b.anh_url ?? '')].join('|')).digest('hex').slice(0, 12);
  const can = nv.filter((v) => v.loai === 'nhan_vat' && v.anh_ref.length && v.anh_mat?.tu !== ma(v));
  if (!can.length) return;
  const ra = await chay({ cat: true, mau: Object.fromEntries(can.map((v) => [v.ten, v.anh_ref.slice(0, 4)])), anh: [] }) as Ra & { cat?: Record<string, string[]> };
  for (const v of can) {
    const tu = ma(v); const url: string[] = [];
    for (const [i, b] of (ra.cat?.[v.ten] ?? []).entries()) { const u = await uploadToR2(`xuong-video/mat/${v.id}-${tu}-${i}.jpg`, Buffer.from(b, 'base64'), 'image/jpeg'); if (u) url.push(u); }
    v.anh_mat = { tu, url };
    await db.execute(sql`UPDATE xv_nhan_vat SET anh_mat = ${JSON.stringify(v.anh_mat)}::jsonb WHERE id = ${v.id}`);
  }
}
