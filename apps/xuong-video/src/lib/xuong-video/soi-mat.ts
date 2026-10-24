// 🙂 SOI MẶT cả tập trên máy chủ (chuẩn bị phim người thật — anh 16/10/2026 "nhân vật làm sao giữ được đúng khuôn mặt"). 0đ: OpenCV YuNet + SFace
// (scripts/soi-mat/soi-mat.py, cài bằng scripts/soi-mat/cai.sh). Mỗi shot có keyframe chưa soi (hoặc đã đổi) → so mặt trong khung với ảnh mẫu của
// các nhân vật gắn shot (anh_ref + ảnh biến thể) → ghi xv_canh.soi_mat. Nhân vật ảnh mẫu không có mặt người (hoạt hình, đồ vật) không theo dõi.
// Luật thuần + cổng ở khung.ts (trangThaiMat · chanKhung).
import 'server-only';
import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path, { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { chatLieuPhim, docKinhThanh, locNhanh, type Canh, type KinhThanh, type NhanVat, type SoiMat } from './kieu';
import { matTroiClip } from './soi-clip-do';
import { uploadToR2 } from '../r2';
import { GIA_SUA_MAT_VND, SUA_MAT_TOI_DA, canTheoCap, giuCanCap, canSuaMat, keHoachSuaMat, nhanSuaMat, chuLoiMat, nguoiSoiMat, GIU_VUNG_DAU } from './khung';
import { canNhin, dichNhin } from './bo-set-3d';
/** Gắn phía cần nhìn (3D) vào kết quả đo hướng nhìn của từng mặt — cổng khung.ts › loiNhin so hai thứ. */
// KHÔNG 3D: phía cần nhìn lấy từ sơ đồ cảnh — ky_thuat.huong_so (dung-phim-reelshort ghi từ so-do-canh › kyVong); 0 = nhìn thẳng máy, không gắn
const ganNhin = (ket: SoiMat['ket'], c: Pick<Canh, 'may_3d' | 'ky_thuat'>, nv: Pick<NhanVat, 'ten'>[]): SoiMat['ket'] => ket.map((k) => {
  if (!k.nhin) return k;
  const can = c.may_3d ? canNhin(c.may_3d, k.ten, (t) => nv.some((v) => v.ten === t)) : c.ky_thuat?.huong_so?.[k.ten]?.nhin || undefined;
  return can ? { ...k, nhin: { ...k.nhin, can } } : k; });
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

export async function soiMatTap(db: Db, tapId: number, o: { tatCa?: boolean; /** false = chạy thử, không ghi DB */ ghi?: boolean } = {}): Promise<{ ok: true; data: { soi: number; lech: { thu_tu: number; chu: string }[]; theo_doi: string[]; /** kết quả đo từng shot (cả khi ghi: false) */ ket?: Record<number, SoiMat> } } | { ok: false; loi: string }> {
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
  try { ra = await chay({ mau, anh: ds.map((c) => ({ id: c.id, url: c.keyframe_url, ten: nguoiSoiMat(c, tenCua(c.nhan_vat)) })) }); }
  catch (e) { return { ok: false, loi: `soi mặt lỗi: ${e instanceof Error ? e.message : String(e)}` }; }
  const luc = new Date().toISOString(); const lech: { thu_tu: number; chu: string }[] = []; const moi: Record<number, SoiMat> = {};
  for (const c of ds) {
    const a = ra.anh.find((x) => x.id === c.id); if (!a) continue;
    const ket = ganNhin(a.ket ?? [], c, nv);
    const sm: SoiMat = { url: c.keyframe_url!, luc, mat: a.mat ?? 0, ket, dat: !a.loi && ket.every((k) => k.dat), ...(a.loi ? { loi: a.loi } : {}) };
    moi[c.id] = sm;
    if (o.ghi !== false) await db.execute(sql`UPDATE xv_canh SET soi_mat = ${JSON.stringify(sm)}::jsonb WHERE id = ${c.id}`);
    if (!sm.dat && ket.length) lech.push({ thu_tu: c.thu_tu, chu: ket.filter((k) => !k.dat).map((k) => `${k.ten} ${Math.round((k.giong ?? 0) * 100)}%`).join(', ') });
  }
  // HƯỚNG NHÌN THEO CẶP SHOT (khung.ts › canTheoCap): đọc lại cả tập (shot vừa soi + shot đã soi trước) — mặt mà 3D không cho phía cần nhìn lấy ngược
  // phía người đối đáp ở shot liền kề. Chạy sau khi đã ghi kết quả đo của lượt này.
  // ghi: false (chạy thử) → luật cặp chạy trên số đo trong bộ nhớ, không ghi gì
  const tap = locNhanh(((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu, id`)) as unknown as Row[]).map(mapCanh), 'A')
    .map((c) => (moi[c.id] ? { ...c, soi_mat: moi[c.id] } : c));
  for (const [id, ket] of canTheoCap(tap)) {
    if (moi[id]) moi[id] = { ...moi[id]!, ket };
    if (o.ghi !== false) await db.execute(sql`UPDATE xv_canh SET soi_mat = jsonb_set(soi_mat, '{ket}', ${JSON.stringify(ket)}::jsonb) WHERE id = ${id}`);
  }
  return { ok: true, data: { soi: ds.length, lech, theo_doi: Object.entries(ra.mau).filter(([, n]) => n > 0).map(([ten]) => ten), ket: moi } };
}

/** Người nhận một khung máy báo lệch mặt (máy báo nhầm: góc nghiêng gắt, ánh sáng lạ) — 0đ. Keyframe đổi thì soi lại từ đầu. */
/** ĐẾM MẶT NGƯỜI trong một ảnh (YuNet, 0đ) — cổng sau bước 1 keyframe hai bước (sinh-anh.ts). null = không đếm được (chưa cài / lỗi): bên gọi
 *  bỏ qua cổng, không chặn — có ghi lý do ra log. */
/** Soi HƯỚNG trên ảnh bất kỳ — khung cuối, khung cắt từ clip (scripts/soat-huong.mts) — cùng bộ đo + ảnh mẫu soiMatTap, không ghi DB.
 *  ten = người phải có trong ảnh (để gán mặt); url là URL hoặc đường dẫn tệp trên máy chủ. */
export async function soiAnh(db: Db, tapId: number, anh: { id: number; url: string; ten: string[]; /** đo thêm tư thế tay (soi-mat.py › tu_the) */ tu_the?: boolean }[]): Promise<Map<number, SoiMat['ket']>> {
  const t = (await db.execute(sql`SELECT phim_id FROM xv_tap WHERE id = ${tapId}`)) as unknown as Row[]; if (!t[0] || !anh.length) return new Map();
  const nv = await kemBienThe(db, ((await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${Number(t[0].phim_id)} AND loai = 'nhan_vat' ORDER BY id`)) as unknown as Row[]).map(mapNhanVat));
  const mau = Object.fromEntries(nv.map((v) => [v.ten, [...v.anh_ref, ...(v.bien_the ?? []).map((b) => b.anh_url)].filter((u): u is string => !!u)] as const).filter(([, u]) => u.length > 0));
  const ra = await chay({ mau, anh });
  return new Map(ra.anh.map((a) => [a.id, a.ket ?? []]));
}
export async function demMat(url: string): Promise<number | null> {
  try { return (await chay<{ mat: number }>({ op: 'dem', url, nguong: 0.7 })).mat; }
  catch (e) { console.warn(`demMat: ${e instanceof Error ? e.message : String(e)}`); return null; }
}

export async function duyetMatTay(db: Db, canhId: number, nguoi: string): Promise<void> {
  await db.execute(sql`UPDATE xv_canh SET soi_mat = soi_mat || ${JSON.stringify({ duyet_tay: nguoi })}::jsonb WHERE id = ${canhId} AND soi_mat IS NOT NULL`);
}

/** ẢNH SÁT MẶT cho các nhân vật (phim người thật): cắt từ ảnh mẫu bằng soi-mat.py (mặt điển hình + một mặt khác góc), đẩy kho, ghi xv_nhan_vat.anh_mat.
 *  Chỉ cắt lại khi bộ ảnh mẫu đổi (tu = mã các URL). Sửa thẳng nv[] truyền vào để lượt sinh đang chạy dùng ngay. 0đ. */
export async function damBaoAnhMat(db: Db, nv: NhanVat[]): Promise<void> {
  // 'v2' (19/10/2026): thêm ảnh mặt quay trái / phải + góc quay đầu (dau); 'v3': soi-mat.py › tim_mat thấy mặt quá to trong khung — đổi khoá để mọi
  // nhân vật cắt lại một lần (0đ)
  const ma = (v: NhanVat) => createHash('sha1').update(['v3', ...v.anh_ref, ...(v.bien_the ?? []).map((b) => b.anh_url ?? '')].join('|')).digest('hex').slice(0, 12);
  const can = nv.filter((v) => v.loai === 'nhan_vat' && v.anh_ref.length && v.anh_mat?.tu !== ma(v));
  if (!can.length) return;
  const ra = await chay<Ra & { cat?: Record<string, string[]>; cat_dau?: Record<string, (number | null)[]> }>({ cat: true, mau: Object.fromEntries(can.map((v) => [v.ten, v.anh_ref.slice(0, 4)])), anh: [] });
  for (const v of can) {
    const tu = ma(v); const url: string[] = []; const dau: (number | null)[] = [];
    for (const [i, b] of (ra.cat?.[v.ten] ?? []).entries()) { const u = await uploadToR2(`xuong-video/mat/${v.id}-${tu}-${i}.jpg`, Buffer.from(b, 'base64'), 'image/jpeg'); if (u) { url.push(u); dau.push(ra.cat_dau?.[v.ten]?.[i] ?? null); } }
    v.anh_mat = { tu, url, dau };
    await db.execute(sql`UPDATE xv_nhan_vat SET anh_mat = ${JSON.stringify(v.anh_mat)}::jsonb WHERE id = ${v.id}`);
  }
}

// ── 🩹 SỬA MẶT (bước 2b nhịp B): keyframe lệch mặt → mô hình sửa ảnh rẻ nhất của chuỗi cổng (ckey Nano Banana 2 ~110₫; cổng hỏng thì rơi
// Google ~874₫) nhận [keyframe, ảnh sát mặt] + lệnh "chỉ thay mặt X" → ảnh về thì SOI LẠI: đạt → thành keyframe (bản cũ còn trong dải
// keyframe để hoàn tác); chưa đạt → thử lại từ ẢNH GỐC, tối đa SUA_MAT_TOI_DA lần rồi dừng, ghi lỗi để người xem các bản trong dải.

async function docShot(db: Db, canhId: number) {
  const r = (await db.execute(sql`SELECT c.*, p.kinh_thanh AS kt_phim FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id JOIN xv_phim p ON p.id = t.phim_id WHERE c.id = ${canhId}`)) as unknown as Row[];
  if (!r[0]) return null;
  const c = mapCanh(r[0]); const kt = docKinhThanh(r[0].kt_phim as KinhThanh);
  const nv = await kemBienThe(db, ((await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE loai = 'nhan_vat' AND id = ANY(${`{${c.nhan_vat.join(',') || 0}}`}::int[])`)) as unknown as Row[]).map(mapNhanVat));
  return { c, kt, nv };
}

/** VÙNG ĐẦU của một người (lớp độ sâu 3D `sau` chỉ ra người nào) trong ảnh `url`: ô vuông px gốc + ảnh 1024² để vẽ lại mặt (dựng tại chỗ). null = không thấy mặt. */
export async function catVungDau(url: string, sau: string): Promise<{ hop: number[]; b64: string } | null> {
  const r = await chay<{ hop: number[] | null; b64: string | null }>({ op: 'cat_vung', url, sau }).catch(() => null);
  return r?.hop && r.b64 ? { hop: r.hop, b64: r.b64 } : null;
}
/** Dán vùng đầu đã vẽ lại về đúng ô (mặt nạ elip mờ biên + khớp màu LAB) → ảnh cả khung JPEG (base64). */
export async function danVungDau(goc: string, sua: string, hop: number[]): Promise<string | null> {
  const r = await chay<{ b64: string | null }>({ op: 'dan', goc, sua, hop }).catch(() => null);
  return r?.b64 ?? null;
}

/** Gửi MỘT lượt sửa mặt cho shot (lan = lần thử, goc = ảnh gốc để mọi lần thử đều sửa từ bản đầu, không sửa chồng lên bản đã hỏng). TỐN TIỀN ~110₫. */
export async function suaMatCanh(db: Db, canhId: number, lan = 1, goc?: string, /** chạy thử: ảnh sửa + điểm soi lại chỉ ghi vào job, shot giữ nguyên, không thử lại */ thu = false, /** chạy thử với số đo chưa ghi (soiMatTap ghi: false) */ smThu?: SoiMat): Promise<{ ok: true; data: number } | { ok: false; loi: string }> {
  const d = await docShot(db, canhId); if (!d) return { ok: false, loi: 'không thấy shot' };
  const { kt, nv } = d; const c = smThu && thu ? { ...d.c, soi_mat: smThu } : d.c; const sm = c.soi_mat;
  if (chatLieuPhim(kt) !== 'nguoi_that') return { ok: false, loi: 'phim hoạt hình không sửa mặt' };
  if (!c.keyframe_url || !sm || sm.url !== c.keyframe_url || !canSuaMat(c)) return { ok: false, loi: `shot #${c.thu_tu} không lệch mặt / ánh mắt (chưa soi, hoặc đã đạt)` };
  await damBaoAnhMat(db, nv);
  // MỘT mặt / lượt (khung.ts › keHoachSuaMat): mặt lệch ảnh mẫu nặng nhất trước, rồi tới mặt nhìn sai — lượt sau xử tiếp. Người được nhìn (để câu
  // hướng nhìn gọi tên) lấy từ 3D của shot.
  const nguoi3d = (c.may_3d?.vi_tri ?? []).filter((v) => !v.cam && !v.an);
  // người được nhìn: 3D, không thì sơ đồ cảnh (ky_thuat.sd.nhin — khong-gian.ts)
  const kh = keHoachSuaMat(sm, nv, (ten) => { const v = nguoi3d.find((x) => x.ten === ten); return v ? dichNhin(v, nguoi3d)?.ten : c.ky_thuat?.sd?.nhin?.[ten]; });
  if ('loi' in kh) return { ok: false, loi: kh.loi };
  const x = { k: { ten: kh.ten, o: kh.o }, mat: kh.mau };
  const anh = goc ?? c.keyframe_url;
  // KIỂU FACE DETAILER: cắt riêng vùng đầu → mô hình chỉ sửa vùng đó (mặt to → giữ đúng người) → về thì dán lại bằng mặt nạ mờ biên (xongSuaMat).
  // Sửa cả khung thì mô hình vẽ lại hết: Jett #11 thử 16/10/2026 Frank xê dịch, khách nền đổi, mặt còn kém hơn (29% < 33%).
  const cv = await chay<{ hop: number[] | null; b64: string | null }>({ op: 'cat_vung', url: anh, o: x.k.o });
  if (!cv.hop || !cv.b64) return { ok: false, loi: `không tìm lại được mặt ${x.k.ten} trong khung để cắt` };
  const vung = await uploadToR2(`xuong-video/keyframe/${canhId}-sua-mat-vung-${randomUUID()}.jpg`, Buffer.from(cv.b64, 'base64'), 'image/jpeg');
  if (!vung) return { ok: false, loi: 'không đẩy được vùng đầu lên kho' };
  const refs = [vung, x.mat];
  const prompt = kh.prompt;
  // giá THẬT của đường sẽ đi: cổng đầu chuỗi ảnh là ckey (GIA_SUA_MAT_VND), không phải giá niêm yết Google của model
  const job = await taoJob(db, { nhan: `🩹 ${kh.che_do === 'nhin' ? 'Sửa hướng nhìn' : 'Sửa mặt'} · #${c.thu_tu} · ${x.k.ten} · lần ${lan}/${SUA_MAT_TOI_DA}`, canh_id: canhId, loai: 'anh', provider: 'google', model: kt.mo_hinh_anh, cents: Math.round((GIA_SUA_MAT_VND / VND_MOI_USD) * 100 * 1000) / 1000,
    request: { prompt, thamChieu: refs, dich: 'sua_mat', che_do: kh.che_do, lan, goc: anh, ten: [x.k.ten], hop: cv.hop, ...(thu ? { thu: true } : {}) } });
  const { dayViecAnh } = await import('./hoan-tat');   // nạp muộn: hoan-tat gọi lại xongSuaMat
  await dayViecAnh({ job, model: kt.mo_hinh_anh, prompt, thamChieuUrl: refs, tiLe: '1:1', thuMuc: `keyframe/${canhId}-sua-mat` });
  return { ok: true, data: job };
}

/** 🎭 THỬ DIỄN TRÊN MẶT (anh 19/10/2026 "liếc nhìn của Vi, nhoẻn cười của Hạ — thử sinh"): cùng đường cắt vùng đầu → mô hình sửa ảnh → dán lại như 🩹,
 *  nhưng lệnh là MỘT NHỊP DIỄN của kịch bản (liếc mắt, nhếch môi…) trên một ảnh của shot (mở / giữa / kết). Luôn CHẠY THỬ: ảnh ghép + soi lại chỉ ghi
 *  vào job, shot giữ nguyên. TỐN TIỀN ~110₫ / lượt. */
export async function thuDienMat(db: Db, canhId: number, url: string, ten: string, lenh: string): Promise<{ ok: true; data: number } | { ok: false; loi: string }> {
  const d = await docShot(db, canhId); if (!d) return { ok: false, loi: 'không thấy shot' };
  const { c, kt, nv } = d; const v = nv.find((x) => x.ten === ten); if (!v) return { ok: false, loi: `${ten} không gắn shot này` };
  await damBaoAnhMat(db, [v]);
  const mau = { [ten]: [...v.anh_ref, ...(v.bien_the ?? []).map((b) => b.anh_url)].filter((u): u is string => !!u) };
  const a = (await chay({ mau, anh: [{ id: canhId, url, ten: [ten] }] })).anh[0];
  const k = a?.ket?.find((x) => x.ten === ten); if (!k?.o) return { ok: false, loi: `không thấy mặt ${ten} trong ảnh` };
  const cv = await chay<{ hop: number[] | null; b64: string | null }>({ op: 'cat_vung', url, o: k.o });
  if (!cv.hop || !cv.b64) return { ok: false, loi: `không cắt được vùng đầu ${ten}` };
  const vung = await uploadToR2(`xuong-video/keyframe/${canhId}-thu-dien-vung-${randomUUID()}.jpg`, Buffer.from(cv.b64, 'base64'), 'image/jpeg');
  if (!vung) return { ok: false, loi: 'không đẩy được vùng đầu lên kho' };
  const refs = [vung, v.anh_mat?.url[0] ?? v.anh_ref[0]!];
  const prompt = `Image 1 is a close-up crop of a photorealistic film frame showing the person ${ten}. ${lenh.trim()} Keep the same person (image 2 shows ${ten} for identity only — ignore its pose, gaze and expression), ${GIU_VUNG_DAU}`;
  const job = await taoJob(db, { nhan: `🎭 Thử diễn · #${c.thu_tu} · ${ten}`, canh_id: canhId, loai: 'anh', provider: 'google', model: kt.mo_hinh_anh, cents: Math.round((GIA_SUA_MAT_VND / VND_MOI_USD) * 100 * 1000) / 1000,
    request: { prompt, thamChieu: refs, dich: 'sua_mat', che_do: 'dien', lan: 1, goc: url, ten: [ten], hop: cv.hop, thu: true } });
  const { dayViecAnh } = await import('./hoan-tat');
  await dayViecAnh({ job, model: kt.mo_hinh_anh, prompt, thamChieuUrl: refs, tiLe: '1:1', thuMuc: `keyframe/${canhId}-thu-dien` });
  return { ok: true, data: job };
}

/** Ảnh sửa mặt về (hoan-tat.ts › hoanTatAnh, dich 'sua_mat'): soi lại → nhận / thử tiếp / dừng. */
export async function xongSuaMat(db: Db, canhId: number, url: string, gia: number, req: { lan?: string | null; goc?: string | null; thu?: string | null; job?: number; hop?: number[] | null; ten?: string[] | null }): Promise<void> {
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
    const ra = await chay({ mau, anh: [{ id: canhId, url, ten: nguoiSoiMat(c, nv.map((v) => v.ten)) }] }); const a = ra.anh[0];
    // phía cần nhìn: 3D như lúc soi, cộng phía lấy theo cặp shot của lần đo trước (canTheoCap — đo lại một shot không thấy shot bên cạnh)
    if (a && !a.loi) sm = { url, luc: new Date().toISOString(), mat: a.mat ?? 0, ket: giuCanCap(ganNhin(a.ket ?? [], c, nv), c.soi_mat?.ket), dat: (a.ket ?? []).every((k) => k.dat) };
  } catch (e) { console.error('[sửa mặt › soi lại]', e); }
  if (req.thu === 'true' && req.job) { await db.execute(sql`UPDATE xv_job SET request = request || ${JSON.stringify({ soi_lai: sm, ghep: url })}::jsonb WHERE id = ${req.job}`); return; }
  // NHẬN khi người vừa sửa giống ảnh mẫu VÀ nhìn đúng phía (khung.ts › nhanSuaMat); mặt / ánh mắt khác trong khung còn lỗi thì lưới vẫn báo, bấm 🩹 tiếp
  const tenSua = req.ten?.[0];
  if (sm && (tenSua ? nhanSuaMat(sm, tenSua) : sm.dat)) {
    await db.execute(sql`UPDATE xv_canh SET keyframe_uv = (keyframe_uv || ${JSON.stringify([url])}::jsonb), keyframe_url = ${url}, soi_mat = ${JSON.stringify(sm)}::jsonb,
      chi_phi_cents = chi_phi_cents + ${gia}, loi = '', updated_at = now() WHERE id = ${canhId}`);
    return;
  }
  await db.execute(sql`UPDATE xv_canh SET keyframe_uv = (keyframe_uv || ${JSON.stringify([url])}::jsonb), chi_phi_cents = chi_phi_cents + ${gia}, updated_at = now() WHERE id = ${canhId}`);
  const diem = sm ? chuLoiMat(sm) || 'chưa đạt' : 'soi lại lỗi';
  if (lan < SUA_MAT_TOI_DA && c.soi_mat && canSuaMat(c)) {
    const r = await suaMatCanh(db, canhId, lan + 1, req.goc ?? undefined);
    if (r.ok) return;
    await db.execute(sql`UPDATE xv_canh SET loi = ${`🩹 sửa mặt lần ${lan} chưa đạt (${diem}); không thử tiếp được: ${r.loi}`} WHERE id = ${canhId}`);
    return;
  }
  await db.execute(sql`UPDATE xv_canh SET loi = ${`🩹 sửa mặt ${lan} lần chưa đạt (lần cuối: ${diem}) — các bản đã nằm trong dải keyframe để xem; sinh lại keyframe hoặc nhận tay`} WHERE id = ${canhId}`);
}

/** 🎞 SOI MẶT CLIP (bước 2b nhịp C): phim người thật — khoảng 1 khung / giây (3–10 khung) của clip, so mặt từng khung với ảnh mẫu (chỉ chấm mặt đủ to,
 *  gần chính diện), luật trôi ở soi-clip-do.ts › matTroiClip. Gọi từ máy soi clip (soi-clip.ts) lúc clip về — lỗi vào soi_clip, bản xuất chặn,
 *  người duyệt bỏ qua được. null = không phải phim người thật / không có nhân vật có ảnh mẫu mặt. 0đ. */
export async function soiMatClip(db: Db, c: Pick<Canh, 'tap_id' | 'nhan_vat'>, url: string, dai: number): Promise<{ loi: string[]; diem: Record<string, { giay: number; giong: number }[]> } | null> {
  const p = (await db.execute(sql`SELECT p.kinh_thanh FROM xv_tap t JOIN xv_phim p ON p.id = t.phim_id WHERE t.id = ${c.tap_id}`)) as unknown as Row[];
  if (!p[0] || chatLieuPhim(p[0].kinh_thanh as KinhThanh) !== 'nguoi_that' || !c.nhan_vat.length) return null;
  const nv = await kemBienThe(db, ((await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE loai = 'nhan_vat' AND id = ANY(${`{${c.nhan_vat.join(',')}}`}::int[])`)) as unknown as Row[]).map(mapNhanVat));
  const mau = Object.fromEntries(nv.map((v) => [v.ten, [...v.anh_ref, ...(v.bien_the ?? []).map((b) => b.anh_url)].filter((u): u is string => !!u)] as const).filter(([, u]) => u.length > 0));
  if (!Object.keys(mau).length) return null;
  const n = Math.max(3, Math.min(10, Math.round(dai)));
  const giay = Array.from({ length: n }, (_, i) => Math.round((0.15 + (i * (dai - 0.3)) / (n - 1)) * 10) / 10);
  const thu = await mkdtemp(join(tmpdir(), 'soi-mat-clip-'));
  try {
    const khung: { id: number; url: string; ten: string[] }[] = [];
    for (const [i, t] of giay.entries()) {
      const f = join(thu, `${i}.jpg`);
      const ok = await new Promise<boolean>((xong) => execFile('ffmpeg', ['-v', 'error', '-y', '-ss', String(t), '-i', url, '-frames:v', '1', '-q:v', '2', f], { timeout: 60_000 }, (e) => xong(!e)));
      if (ok) khung.push({ id: i, url: f, ten: Object.keys(mau) });
    }
    if (!khung.length) return null;
    const ra = await chay({ mau, anh: khung });
    const diem: Record<string, { giay: number; giong: number }[]> = {};
    for (const a of ra.anh) for (const k of a.ket ?? []) if (k.giong != null && !k.nho && !k.nghieng) (diem[k.ten] ??= []).push({ giay: giay[a.id]!, giong: k.giong });
    const loi: string[] = [];
    for (const [ten, d] of Object.entries(diem)) {
      const troi = matTroiClip(d);
      if (troi) loi.push(`mặt ${ten} trôi trong clip (giây ${troi.join(', ')} — giống ảnh mẫu chỉ ${Math.round(Math.min(...d.map((x) => x.giong)) * 100)}–${Math.round(Math.max(...d.filter((x) => troi.includes(x.giay)).map((x) => x.giong)) * 100)}%, ngưỡng 36%) — sinh lại clip từ keyframe đã qua 🙂 Soi mặt`);
    }
    return { loi, diem };
  } finally { await rm(thu, { recursive: true, force: true }); }
}
