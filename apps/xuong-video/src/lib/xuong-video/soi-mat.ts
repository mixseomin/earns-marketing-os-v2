// 🙂 SOI MẶT cả tập trên máy chủ (chuẩn bị phim người thật — anh 16/10/2026 "nhân vật làm sao giữ được đúng khuôn mặt"). 0đ: OpenCV YuNet + SFace
// (scripts/soi-mat/soi-mat.py, cài bằng scripts/soi-mat/cai.sh). Mỗi shot có keyframe chưa soi (hoặc đã đổi) → so mặt trong khung với ảnh mẫu của
// các nhân vật gắn shot (anh_ref + ảnh biến thể) → ghi xv_canh.soi_mat. Nhân vật ảnh mẫu không có mặt người (hoạt hình, đồ vật) không theo dõi.
// Luật thuần + cổng ở khung.ts (trangThaiMat · chanKhung).
import 'server-only';
import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { chatLieuPhim, docKinhThanh, locNhanh, type KinhThanh, type NhanVat, type SoiMat } from './kieu';
import { uploadToR2 } from '../r2';
import { GIA_SUA_MAT_VND, SUA_MAT_TOI_DA } from './khung';
import { VND_MOI_USD } from './cong-ai';
import { kemBienThe, mapCanh, mapNhanVat, taoJob, type Db, type Row } from './doc-db';

const PY = process.env.XV_SOI_MAT_PY || '/opt/xv-soi-mat/bin/python';
const KICH_BAN = () => [path.join(process.cwd(), 'scripts/soi-mat/soi-mat.py'), '/opt/earns-marketing-os-v2/apps/xuong-video/scripts/soi-mat/soi-mat.py'].find((p) => existsSync(p));
type Ra = { mau: Record<string, number>; anh: { id: number; mat?: number; ket?: SoiMat['ket']; loi?: string }[] };

function chay<T = Ra>(vao: unknown): Promise<T> {
  const kb = KICH_BAN();
  if (!kb || !existsSync(PY)) return Promise.reject(new Error('chưa cài soi mặt trên máy chủ — chạy apps/xuong-video/scripts/soi-mat/cai.sh'));
  return new Promise((ok, hong) => {
    const p = execFile(PY, [kb], { maxBuffer: 16 << 20, timeout: 10 * 60_000 }, (e, out) => { if (e) return hong(e); try { ok(JSON.parse(out) as T); } catch (x) { hong(x); } });
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
  const ra = await chay<Ra & { cat?: Record<string, string[]> }>({ cat: true, mau: Object.fromEntries(can.map((v) => [v.ten, v.anh_ref.slice(0, 4)])), anh: [] });
  for (const v of can) {
    const tu = ma(v); const url: string[] = [];
    for (const [i, b] of (ra.cat?.[v.ten] ?? []).entries()) { const u = await uploadToR2(`xuong-video/mat/${v.id}-${tu}-${i}.jpg`, Buffer.from(b, 'base64'), 'image/jpeg'); if (u) url.push(u); }
    v.anh_mat = { tu, url };
    await db.execute(sql`UPDATE xv_nhan_vat SET anh_mat = ${JSON.stringify(v.anh_mat)}::jsonb WHERE id = ${v.id}`);
  }
}

// ── 🩹 SỬA MẶT (bước 2b nhịp B): keyframe lệch mặt → mô hình sửa ảnh rẻ nhất của chuỗi cổng (ckey Nano Banana 2 ~110₫; cổng hỏng thì rơi
// Google ~874₫) nhận [keyframe, ảnh sát mặt] + lệnh "chỉ thay mặt X" → ảnh về thì SOI LẠI: đạt → thành keyframe (bản cũ còn trong dải
// keyframe để hoàn tác); chưa đạt → thử lại từ ẢNH GỐC, tối đa SUA_MAT_TOI_DA lần rồi dừng, ghi lỗi để người xem các bản trong dải.
const viTriMat = (o?: { x: number; y: number }) => (o ? `the face at the ${o.y < 0.36 ? 'top' : o.y > 0.64 ? 'bottom' : 'middle'}-${o.x < 0.36 ? 'left' : o.x > 0.64 ? 'right' : 'centre'} of image 1` : 'their face in image 1');

async function docShot(db: Db, canhId: number) {
  const r = (await db.execute(sql`SELECT c.*, p.kinh_thanh AS kt_phim FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id JOIN xv_phim p ON p.id = t.phim_id WHERE c.id = ${canhId}`)) as unknown as Row[];
  if (!r[0]) return null;
  const c = mapCanh(r[0]); const kt = docKinhThanh(r[0].kt_phim as KinhThanh);
  const nv = await kemBienThe(db, ((await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE loai = 'nhan_vat' AND id = ANY(${`{${c.nhan_vat.join(',') || 0}}`}::int[])`)) as unknown as Row[]).map(mapNhanVat));
  return { c, kt, nv };
}

/** Gửi MỘT lượt sửa mặt cho shot (lan = lần thử, goc = ảnh gốc để mọi lần thử đều sửa từ bản đầu, không sửa chồng lên bản đã hỏng). TỐN TIỀN ~110₫. */
export async function suaMatCanh(db: Db, canhId: number, lan = 1, goc?: string, /** chạy thử: ảnh sửa + điểm soi lại chỉ ghi vào job, shot giữ nguyên, không thử lại */ thu = false): Promise<{ ok: true; data: number } | { ok: false; loi: string }> {
  const d = await docShot(db, canhId); if (!d) return { ok: false, loi: 'không thấy shot' };
  const { c, kt, nv } = d; const sm = c.soi_mat;
  if (chatLieuPhim(kt) !== 'nguoi_that') return { ok: false, loi: 'phim hoạt hình không sửa mặt' };
  if (!c.keyframe_url || !sm || sm.url !== c.keyframe_url || sm.dat) return { ok: false, loi: `shot #${c.thu_tu} không lệch mặt (chưa soi, hoặc đã đạt)` };
  await damBaoAnhMat(db, nv);
  // Mặt lệch NẶNG nhất trước (một mặt / lượt): khung còn mặt khác lệch thì lượt sau xử tiếp.
  const x = sm.ket.filter((k) => !k.dat && k.o).sort((a, b) => (a.giong ?? 0) - (b.giong ?? 0)).map((k) => ({ k, mat: nv.find((v) => v.ten === k.ten)?.anh_mat?.url[0] })).find((y) => y.mat);
  if (!x?.mat) return { ok: false, loi: 'nhân vật lệch chưa có ảnh sát mặt (ảnh mẫu không thấy mặt rõ)' };
  const anh = goc ?? c.keyframe_url;
  // KIỂU FACE DETAILER: cắt riêng vùng đầu → mô hình chỉ sửa vùng đó (mặt to → giữ đúng người) → về thì dán lại bằng mặt nạ mờ biên (xongSuaMat).
  // Sửa cả khung thì mô hình vẽ lại hết: Jett #11 thử 16/10/2026 Frank xê dịch, khách nền đổi, mặt còn kém hơn (29% < 33%).
  const cv = await chay<{ hop: number[] | null; b64: string | null }>({ op: 'cat_vung', url: anh, o: x.k.o });
  if (!cv.hop || !cv.b64) return { ok: false, loi: `không tìm lại được mặt ${x.k.ten} trong khung để cắt` };
  const vung = await uploadToR2(`xuong-video/keyframe/${canhId}-sua-mat-vung-${randomUUID()}.jpg`, Buffer.from(cv.b64, 'base64'), 'image/jpeg');
  if (!vung) return { ok: false, loi: 'không đẩy được vùng đầu lên kho' };
  const refs = [vung, x.mat];
  const prompt = `Image 1 is a close-up crop of a photorealistic film frame showing the person ${x.k.ten}. Redraw ONLY the face so it is exactly the person in image 2: same bone structure, eyes, nose, mouth, hairline, skin tone and age. Keep image 1's head angle, expression, gaze, lighting direction, hair, ears, clothes, background, framing and scale exactly the same — the result must line up with image 1 pixel for pixel so it can be pasted back into the frame. Natural skin texture, no beauty filter, no text, no watermark.`;
  // giá THẬT của đường sẽ đi: cổng đầu chuỗi ảnh là ckey (GIA_SUA_MAT_VND), không phải giá niêm yết Google của model
  const job = await taoJob(db, { nhan: `🩹 Sửa mặt · #${c.thu_tu} · ${x.k.ten} · lần ${lan}/${SUA_MAT_TOI_DA}`, canh_id: canhId, loai: 'anh', provider: 'google', model: kt.mo_hinh_anh, cents: Math.round((GIA_SUA_MAT_VND / VND_MOI_USD) * 100 * 1000) / 1000,
    request: { prompt, thamChieu: refs, dich: 'sua_mat', lan, goc: anh, ten: [x.k.ten], hop: cv.hop, ...(thu ? { thu: true } : {}) } });
  const { dayViecAnh } = await import('./hoan-tat');   // nạp muộn: hoan-tat gọi lại xongSuaMat
  await dayViecAnh({ job, model: kt.mo_hinh_anh, prompt, thamChieuUrl: refs, tiLe: '1:1', thuMuc: `keyframe/${canhId}-sua-mat` });
  return { ok: true, data: job };
}

/** Ảnh sửa mặt về (hoan-tat.ts › hoanTatAnh, dich 'sua_mat'): soi lại → nhận / thử tiếp / dừng. */
export async function xongSuaMat(db: Db, canhId: number, url: string, gia: number, req: { lan?: string | null; goc?: string | null; thu?: string | null; job?: number; hop?: number[] | null }): Promise<void> {
  const d = await docShot(db, canhId); if (!d) return;
  const { c, nv } = d; const lan = Number(req.lan ?? 1) || 1;
  // vùng đầu đã sửa → dán lại vào ẢNH GỐC (mặt nạ elip mờ biên + khớp màu) — phần còn lại của khung giữ nguyên từng điểm ảnh
  if (req.hop && req.goc) {
    try {
      const dg = await chay<{ b64: string }>({ op: 'dan', goc: req.goc, sua: url, hop: req.hop });
      const u = await uploadToR2(`xuong-video/keyframe/${canhId}-sua-mat-${randomUUID()}.jpg`, Buffer.from(dg.b64, 'base64'), 'image/jpeg');
      if (u) url = u;
    } catch (e) { console.error('[sửa mặt › dán lại]', e); return; }
  }
  const mau = Object.fromEntries(nv.map((v) => [v.ten, [...v.anh_ref, ...(v.bien_the ?? []).map((b) => b.anh_url)].filter((u): u is string => !!u)] as const).filter(([, u]) => u.length > 0));
  let sm: SoiMat | null = null;
  try {
    const ra = await chay({ mau, anh: [{ id: canhId, url, ten: nv.map((v) => v.ten) }] }); const a = ra.anh[0];
    if (a && !a.loi) sm = { url, luc: new Date().toISOString(), mat: a.mat ?? 0, ket: a.ket ?? [], dat: (a.ket ?? []).every((k) => k.dat) };
  } catch (e) { console.error('[sửa mặt › soi lại]', e); }
  if (req.thu === 'true' && req.job) { await db.execute(sql`UPDATE xv_job SET request = request || ${JSON.stringify({ soi_lai: sm, ghep: url })}::jsonb WHERE id = ${req.job}`); return; }
  if (sm?.dat) {
    await db.execute(sql`UPDATE xv_canh SET keyframe_uv = (keyframe_uv || ${JSON.stringify([url])}::jsonb), keyframe_url = ${url}, soi_mat = ${JSON.stringify(sm)}::jsonb,
      chi_phi_cents = chi_phi_cents + ${gia}, loi = '', updated_at = now() WHERE id = ${canhId}`);
    return;
  }
  await db.execute(sql`UPDATE xv_canh SET keyframe_uv = (keyframe_uv || ${JSON.stringify([url])}::jsonb), chi_phi_cents = chi_phi_cents + ${gia}, updated_at = now() WHERE id = ${canhId}`);
  const diem = sm ? sm.ket.filter((k) => !k.dat).map((k) => `${k.ten} ${Math.round((k.giong ?? 0) * 100)}%`).join(', ') : 'soi lại lỗi';
  if (lan < SUA_MAT_TOI_DA && c.soi_mat && !c.soi_mat.dat) {
    const r = await suaMatCanh(db, canhId, lan + 1, req.goc ?? undefined);
    if (r.ok) return;
    await db.execute(sql`UPDATE xv_canh SET loi = ${`🩹 sửa mặt lần ${lan} chưa đạt (${diem}); không thử tiếp được: ${r.loi}`} WHERE id = ${canhId}`);
    return;
  }
  await db.execute(sql`UPDATE xv_canh SET loi = ${`🩹 sửa mặt ${lan} lần chưa đạt (lần cuối: ${diem}) — các bản đã nằm trong dải keyframe để xem; sinh lại keyframe hoặc nhận tay`} WHERE id = ${canhId}`);
}
