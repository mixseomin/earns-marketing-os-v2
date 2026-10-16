// 🙂 SOI MẶT cả tập trên máy chủ (chuẩn bị phim người thật — anh 16/10/2026 "nhân vật làm sao giữ được đúng khuôn mặt"). 0đ: OpenCV YuNet + SFace
// (scripts/soi-mat/soi-mat.py, cài bằng scripts/soi-mat/cai.sh). Mỗi shot có keyframe chưa soi (hoặc đã đổi) → so mặt trong khung với ảnh mẫu của
// các nhân vật gắn shot (anh_ref + ảnh biến thể) → ghi xv_canh.soi_mat. Nhân vật ảnh mẫu không có mặt người (hoạt hình, đồ vật) không theo dõi.
// Luật thuần + cổng ở khung.ts (trangThaiMat · chanKhung).
import 'server-only';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { locNhanh, type SoiMat } from './kieu';
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
  const t = (await db.execute(sql`SELECT phim_id FROM xv_tap WHERE id = ${tapId}`)) as unknown as Row[];
  if (!t[0]) return { ok: false, loi: 'không thấy tập' };
  const nv = await kemBienThe(db, ((await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${Number(t[0].phim_id)} AND loai = 'nhan_vat' ORDER BY id`)) as unknown as Row[]).map(mapNhanVat));
  const ds = locNhanh(((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu, id`)) as unknown as Row[]).map(mapCanh), 'A')
    .filter((c) => c.keyframe_url && (o.tatCa || c.soi_mat?.url !== c.keyframe_url));
  if (!ds.length) return { ok: true, data: { soi: 0, lech: [], theo_doi: [] } };
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
