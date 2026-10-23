// PHÂN CẢNH BA TẦNG — TỔNG QUAN TRƯỚC, CHI TIẾT SAU (anh 23–24/10/2026: "sinh 1 lần cho full rồi mới zoom chi tiết từng key… phải drilldown từ tổng
// quan trước rồi mới vào chi tiết, đọc như truyện tranh để hiểu"). Nghề gọi là phân cảnh (storyboard): tờ THUMBNAIL cả cảnh chốt bố cục + mạch kể, rồi
// mới vẽ sạch từng khung. Vẽ từng khung riêng thì mỗi khung một sảnh / một trạng thái đồ (#353 #15 Hạ còn đeo thẻ đã bị giật, #16 đổi cổ váy) — những gì
// quyết trong CÙNG một lần sinh thì không lệch nhau. Mỗi tầng dưới là lượt SỬA theo khung tầng trên (không vẽ mới): chỉ thêm chi tiết, không quyết lại bố cục.
//   Tầng 1 — THUMBNAIL CẢ CẢNH: một ảnh lưới (≤ ~20 khung nhỏ, viền trắng, không chữ): ai ở đâu, nhìn đâu, cầm gì, trạng thái đồ.
//   Tầng 2 — BẢNG KHỐI: cắt từng khối --khoi khung từ tầng 1, ghép lại thành lưới 2 cột, cho AI vẽ lại cùng lưới ở chi tiết cao + ảnh mẫu mặt / trang phục.
//   Tầng 3 — KHUNG CHI TIẾT: mỗi khung tầng 2 → lượt sửa lên 9:16 đầy đủ, khoá mặt → keyframe của shot.
// Khung tách bằng DÒ VIỀN TRẮNG (model không vẽ lưới đều — #356: hai cột, khung cao khác nhau); số khung dò được ≠ số shot → dừng, không đoán.
// Sau tầng 3: scripts/soat-huong.mts (cổng hướng) + scripts/truyen-tranh.mts (đọc như truyện tranh).
//   … tsx scripts/bang-gom.mts --tap=356 [--tu=1 --den=17] --tang=1|2|3|tat-ca [--t1=<url tầng 1>] [--khoi=6] [--cot=4]
//   --so-do=scripts/du-lieu/<bảng mảnh>.json : tầng 1 kèm tờ phác bố trí vẽ từ sơ đồ cảnh · --chi-phac (0đ): chỉ vẽ tờ phác
//   --tang=khoi --so-do=… : AI vẽ từng khối --khoi khung theo tờ phác của khối + bảng khối trước, rồi phóng (tầng 3) · --chi-khoi: dừng sau khối
//   --chi-cat (0đ): chỉ dò + cắt tầng 1 / ảnh --bang ra /tmp để soát
// TỐN TIỀN: tầng 1 = 1 ảnh · tầng 2 = 1 ảnh / khối · tầng 3 = 1 ảnh / khung (cổng ảnh --mo-hinh) — chạy kèm DUYET_SINH_1_LAN=1 sau khi anh duyệt.
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { kemBienThe, mapCanh, mapNhanVat, taoJob, type Row } from '../src/lib/xuong-video/doc-db';
import { dayViecAnh } from '../src/lib/xuong-video/hoan-tat';
import { chonKeyframe } from '../src/lib/xuong-video/tu-sua-clip';
import { uploadToR2 } from '../src/lib/r2';
import type { Canh, NhanVat } from '../src/lib/xuong-video/kieu';
import { svgPhac, type ManhSoDo, type MangPhong, type SoDo } from '../src/lib/xuong-video/so-do-canh';

const gia = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const tap = Number(gia('tap')); if (!tap) { console.error('cần --tap=<id>'); process.exit(1); }
const tang = gia('tang') || 'tat-ca'; const khoi = Number(gia('khoi') || 6); const moHinh = gia('mo-hinh') || 'plenxai:nano-banana-2';
const db = getDb()!;
const q = async (s: ReturnType<typeof sql>) => (await db.execute(s)) as unknown as Row[];
const tu = Number(gia('tu') || 1); const den = Number(gia('den') || 999);
const ds: Canh[] = (await q(sql`SELECT * FROM xv_canh WHERE tap_id = ${tap} AND thu_tu BETWEEN ${tu} AND ${den} ORDER BY thu_tu`)).map(mapCanh);
const cot1 = Number(gia('cot') || (ds.length > 12 ? 4 : ds.length > 6 ? 3 : 2));
const phimId = Number((await q(sql`SELECT phim_id FROM xv_tap WHERE id = ${tap}`))[0]!.phim_id);
const nv: NhanVat[] = await kemBienThe(db, (await q(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${phimId} ORDER BY id`)).map(mapNhanVat));
const CO: Record<string, string> = { ws: 'Wide shot', ms: 'Medium two-shot', mcu: 'Medium close-up', cu: 'Close-up', insert: 'Insert close-up', ecu: 'Extreme close-up' };
// --so-do=<bảng mảnh JSON có so_do> → tầng 1 kèm TỜ PHÁC BỐ TRÍ (so-do-canh.ts › svgPhac) làm ảnh 1: lưới cố định + chỗ người / nền / hướng nhìn đúng sơ đồ
const bm = gia('so-do') ? JSON.parse(readFileSync(gia('so-do')!, 'utf8')) as { so_do: SoDo & { phong?: MangPhong[] }; nguoi: string[]; mau?: Record<string, string>; shot: { sd?: ManhSoDo }[] } : null;
const TEP = `/tmp/bang-gom-${tap}-${tu}-${ds.at(-1)?.thu_tu}.json`;   // mốc giữa các tầng (URL) — chạy lại từng tầng không mất tầng trên
const moc: { t1?: string; t2?: Record<number, string>; khoi?: string[]; khoiSo?: string[] } = existsSync(TEP) ? JSON.parse(readFileSync(TEP, 'utf8')) : {};
const luu = () => writeFileSync(TEP, JSON.stringify(moc, null, 1));
/** Ghi tầng vừa xong vào xv_tap.phan_canh_ve (tab Storyboard › 🎬 Phân cảnh) — theo phân đoạn của shot đầu khoảng. */
async function ghiTap(them: { phac?: string; t1?: string; khoi?: { tu: number; den: number; url: string }[] }) {
  const pd = ds[0]?.phan_doan ?? ''; const cu = ((await q(sql`SELECT phan_canh_ve FROM xv_tap WHERE id = ${tap}`))[0]?.phan_canh_ve ?? []) as { phan_doan: string }[];
  const moi = [...cu.filter((x) => x.phan_doan !== pd), { ...(cu.find((x) => x.phan_doan === pd) ?? {}), phan_doan: pd, ...them, luc: new Date().toISOString() }];
  await db.execute(sql`UPDATE xv_tap SET phan_canh_ve = ${JSON.stringify(moi)}::jsonb WHERE id = ${tap}`);
}
const ten = (id: number) => nv.find((v) => v.id === id);

/** Ảnh tham chiếu cho một nhóm shot: sảnh (ảnh toàn cảnh đã duyệt) · mỗi người MỘT ảnh mặt + biến thể trang phục đầu tiên gặp · đồ — trần `tran`. */
function thamChieu(nhom: Canh[], tran: number): [string, string][] {
  const dung = new Map<string, string>(); const co = (u: string) => [...dung.values()].includes(u);
  const boiCanh = nv.find((v) => v.loai === 'boi_canh' && v.anh_ref[0]); if (boiCanh) dung.set(`the location (${boiCanh.ten}) — wide establishing frame of this exact place`, boiCanh.anh_ref[0]!);
  for (const c of nhom) for (const id of c.nhan_vat) {
    const v = ten(id); if (!v || v.loai !== 'nhan_vat') continue;
    const mat = v.anh_mat?.url?.[0] ?? v.anh_ref[0]; if (mat && !co(mat)) dung.set(`${v.ten}'s face`, mat);
    const bt = (v.bien_the ?? []).find((b) => c.bien_the.includes(b.id) && b.anh_url); if (bt?.anh_url && !co(bt.anh_url)) dung.set(`${v.ten}'s outfit (${bt.mo_ta || bt.ten})`, bt.anh_url);
  }
  for (const c of nhom) for (const id of c.nhan_vat) { const v = ten(id); if (v && v.loai !== 'nhan_vat' && v.loai !== 'boi_canh' && v.anh_ref[0] && !co(v.anh_ref[0])) dung.set(`${v.ten} (${v.mo_ta.slice(0, 60)})`, v.anh_ref[0]); }
  return [...dung.entries()].slice(0, tran);
}
async function sinh(o: { nhan: string; prompt: string; refs: string[]; tiLe: '9:16'; thuMuc: string; canhId?: number; kichCo?: '1K' | '2K' }): Promise<string> {
  const job = await taoJob(db, { ...(o.canhId ? { canh_id: o.canhId } : { phim_id: phimId }), nhan: o.nhan, loai: 'anh', provider: 'google', model: moHinh, request: { prompt: o.prompt, thamChieuUrl: o.refs } });
  await dayViecAnh({ job, model: moHinh, prompt: o.prompt, thamChieuUrl: o.refs, tiLe: o.tiLe, kichCo: o.kichCo, thuMuc: o.thuMuc });
  for (let i = 0; i < 120; i++) { const r = (await q(sql`SELECT trang_thai, output_url, loi FROM xv_job WHERE id = ${job}`))[0]!; if (r.trang_thai === 'xong' && r.output_url) return String(r.output_url); if (r.trang_thai === 'loi') throw new Error(String(r.loi)); await new Promise((ok) => setTimeout(ok, 5000)); }
  throw new Error(`job ${job} quá 10 phút`);
}
/** Dò khung theo viền trắng: cột = đoạn không trắng theo chiều ngang, trong mỗi cột khung = đoạn không trắng theo chiều dọc; đọc hàng k = khung thứ k mỗi cột. */
async function doKhung(buf: Buffer, can?: number) {
  const { data: px, info } = await sharp(buf).greyscale().raw().toBuffer({ resolveWithObject: true }); const W = info.width, H = info.height;
  const sang = (x0: number, x1: number, y0: number, y1: number, doc: boolean) => { const out: number[] = []; const n = doc ? x1 - x0 : y1 - y0;
    for (let i = 0; i < n; i++) { let t = 0, c = 0; if (doc) for (let y = y0; y < y1; y += 2) { t += px[y * W + x0 + i]!; c++; } else for (let x = x0; x < x1; x += 2) { t += px[(y0 + i) * W + x]!; c++; } out.push(t / c); } return out; };
  const doan = (m: number[], toiThieu: number) => { const cat: [number, number][] = []; let a = -1;
    m.forEach((v, i) => { const trang = v > 232; if (!trang && a < 0) a = i; if ((trang || i === m.length - 1) && a >= 0) { const b = trang ? i : i + 1; if (b - a >= toiThieu) cat.push([a, b]); a = -1; } }); return cat; };
  // hai cách đọc lưới: CỘT trước (#356 bảng 1: hai cột, khung cao khác nhau) và HÀNG trước (#356 tầng 1: hàng 2-3-2-4-4-1 khung) — lấy cách nào ra đúng số khung
  const theoCot = doan(sang(0, W, 0, H, true), W * 0.08).map(([x0, x1]) => doan(sang(x0, x1, 0, H, false), H * 0.06).map(([y0, y1]) => ({ x0, x1, y0, y1 })));
  const cotTruoc = Array.from({ length: Math.max(0, ...theoCot.map((c) => c.length)) }, (_, k) => theoCot.map((c) => c[k]).filter((x): x is NonNullable<typeof x> => !!x)).flat();
  const theoHang = doan(sang(0, W, 0, H, false), H * 0.06).map(([y0, y1]) => doan(sang(0, W, y0, y1, true), W * 0.08).map(([x0, x1]) => ({ x0, x1, y0, y1 })));
  const hangTruoc = theoHang.flat();
  const chon = can != null && hangTruoc.length === can && cotTruoc.length !== can ? 'hang' : can != null && cotTruoc.length === can ? 'cot' : hangTruoc.length >= cotTruoc.length ? 'hang' : 'cot';
  const khung = chon === 'hang' ? hangTruoc : cotTruoc;
  return { khung, mo_ta: chon === 'hang' ? `hàng ${theoHang.map((h) => h.length).join('-')}` : `cột ${theoCot.map((c) => c.length).join(' + ')}` };
}
const cat = (buf: Buffer, k: { x0: number; x1: number; y0: number; y1: number }, m = 3) => sharp(buf).extract({ left: k.x0 + m, top: k.y0 + m, width: k.x1 - k.x0 - 2 * m, height: k.y1 - k.y0 - 2 * m }).jpeg({ quality: 93 }).toBuffer();
const len = async (buf: Buffer, ten: string) => { const u = await uploadToR2(`xuong-video/bang/${tap}/${ten}-${randomUUID()}.jpg`, buf, 'image/jpeg'); if (!u) throw new Error('R2 chưa bật'); return u; };
const tai = async (u: string) => Buffer.from(await (await fetch(u)).arrayBuffer());
/** SỐ THỨ TỰ trên bảng để NGƯỜI đọc (anh 24/10/2026: "bảng storyboard phải có số thứ tự, mở ra đọc khó hiểu"): huy hiệu #N ở góc trên-trái mỗi khung.
 *  Chỉ in lên BẢN HIỂN THỊ — ảnh đưa vào model giữ trơn (chữ trên ảnh vào là mời model in chữ ra). */
async function danhSo(buf: Buffer, khung: { x0: number; x1: number; y0: number; y1: number }[], so: number[]): Promise<Buffer> {
  const { width: W = 0, height: H = 0 } = await sharp(buf).metadata();
  const the = khung.map((k, i) => { const c = Math.max(18, Math.round((k.x1 - k.x0) * 0.13)); const w = Math.round(c * (String(so[i]).length + 1) * 0.62 + c * 0.5);
    return `<rect x="${k.x0 + 6}" y="${k.y0 + 6}" width="${w}" height="${Math.round(c * 1.35)}" rx="${Math.round(c * 0.3)}" fill="#000" fill-opacity="0.78"/><text x="${k.x0 + 6 + w / 2}" y="${k.y0 + 6 + c * 1.02}" text-anchor="middle" font-family="DejaVu Sans" font-weight="bold" font-size="${c}" fill="#ffd400">#${so[i]}</text>`; }).join('');
  return sharp(buf).composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${the}</svg>`), top: 0, left: 0 }]).jpeg({ quality: 90 }).toBuffer();
}
/** Lưới tờ phác của một nhóm shot (ô 9:16, viền trắng): trơn cho model + bản có số cho người đọc. */
async function luoiPhac(nhom: Canh[], cot: number): Promise<{ tron: string; so: string }> {
  const CW = 360, CH = 640, G = 14; const hang = Math.ceil(nhom.length / cot);
  const o = await Promise.all(nhom.map((c) => { const m = bm!.shot[c.thu_tu - 1]?.sd; return m ? sharp(Buffer.from(svgPhac(bm!.so_do, m, bm!.nguoi, bm!.mau ?? {}, CW, CH))).png().toBuffer() : sharp({ create: { width: CW, height: CH, channels: 3, background: '#e9e9ec' } }).png().toBuffer(); }));
  const vt = nhom.map((_, j) => ({ x0: G + (j % cot) * (CW + G), y0: G + Math.floor(j / cot) * (CH + G) })).map((k) => ({ ...k, x1: k.x0 + CW, y1: k.y0 + CH }));
  const tron = await sharp({ create: { width: cot * CW + (cot + 1) * G, height: hang * CH + (hang + 1) * G, channels: 3, background: '#ffffff' } }).composite(o.map((x, j) => ({ input: x, left: vt[j]!.x0, top: vt[j]!.y0 }))).jpeg({ quality: 90 }).toBuffer();
  return { tron: await len(tron, `phac-${nhom[0]!.thu_tu}`), so: await len(await danhSo(tron, vt, nhom.map((c) => c.thu_tu)), `phac-so-${nhom[0]!.thu_tu}`) };
}
const moTaKhung = (c: Canh) => `${CO[String(c.ky_thuat?.co_canh)] ?? 'Shot'}: ${(c.prompt_anh || c.dan_dung?.dien || c.hanh_dong).trim()}${c.dan_dung?.huong ? ` Screen direction: ${c.dan_dung.huong}.` : ''}`;
const KHONG_CHU = 'Absolutely no text, numbers, captions, labels or speech bubbles anywhere.';

// --sua=<thu_tu> --chi-thi="<tiếng Anh>" : SỬA MỘT KHUNG đã có (keyframe đang dùng = ảnh 1) đúng chỗ chỉ thị, giữ nguyên phần còn lại — lỗi logic soát ra
// sau tầng 3 (#353 #11 Thần bước ra cửa thang khác cửa Hạ chắn; #17 Hạ mất thùng đồ) không phải sinh lại cả khối. Ảnh mẫu người / đồ của shot đi kèm.
if (gia('sua')) {
  const c = ds.find((x) => x.thu_tu === Number(gia('sua'))); const ct = gia('chi-thi');
  if (!c?.keyframe_url || !ct) { console.error('cần --sua=<thu_tu có keyframe> --chi-thi="…"'); process.exit(1); }
  const refs = thamChieu([c], 6);
  const p = [`Edit Image 1 (a film still): ${ct}`, 'Keep everything else in Image 1 exactly as it is — the same place, camera angle, framing, light, the same people, faces, outfits, poses and gaze directions — change only what this instruction asks.',
    `Reference images: ${refs.map(([k], i) => `Image ${i + 2} = ${k}`).join('; ')}.`, 'Vertical 9:16 photorealistic live-action film still. No text, captions or borders.'].join(' ');
  const url = await sinh({ nhan: `Keyframe (sửa theo chỉ thị) · cảnh #${c.thu_tu}`, prompt: p, refs: [c.keyframe_url, ...refs.map(([, u]) => u)], tiLe: '9:16', thuMuc: `keyframe/${c.id}`, canhId: c.id });
  await chonKeyframe(db, c.id, url, 'sửa theo chỉ thị'); console.log(`#${c.thu_tu} → ${url}`); process.exit(0);
}
// --danh-so (0đ): làm lại BẢN HIỂN THỊ có số cho phân cảnh đã có — tờ phác cả cảnh (vẽ lại từ sơ đồ) + các bảng khối trong mốc (dò khung rồi in số)
if (process.argv.includes('--danh-so')) {
  if (!bm) { console.error('cần --so-do'); process.exit(1); }
  const phacSo = (await luoiPhac(ds, cot1)).so; moc.khoiSo = [];
  for (const [j, u] of (moc.khoi ?? []).entries()) { const nhom = ds.slice(j * khoi, (j + 1) * khoi); const b = await tai(u); const d = await doKhung(b, nhom.length);
    moc.khoiSo.push(d.khung.length === nhom.length ? await len(await danhSo(b, d.khung, nhom.map((c) => c.thu_tu)), `khoi-so-${nhom[0]!.thu_tu}`) : u); }
  luu(); const pd = ds[0]?.phan_doan ?? '';
  const cu = ((await q(sql`SELECT phan_canh_ve FROM xv_tap WHERE id = ${tap}`))[0]?.phan_canh_ve ?? []) as { phan_doan: string }[];
  await db.execute(sql`UPDATE xv_tap SET phan_canh_ve = ${JSON.stringify([...cu.filter((x) => x.phan_doan !== pd), { phan_doan: pd, phac: phacSo, khoi: moc.khoiSo.map((url, j) => ({ tu: ds[j * khoi]!.thu_tu, den: ds[Math.min(ds.length, (j + 1) * khoi) - 1]!.thu_tu, url })), luc: new Date().toISOString() }])}::jsonb WHERE id = ${tap}`);
  console.log(`tờ phác: ${phacSo}\n${moc.khoiSo.join('\n')}`); process.exit(0);
}
// ── TẦNG 1: thumbnail cả cảnh ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
if (gia('t1')) moc.t1 = gia('t1');
const chiCat = process.argv.includes('--chi-cat');
if (!chiCat && (tang === '1' || (tang === 'tat-ca' && !moc.t1)) && !gia('t1')) {
  const hang = Math.ceil(ds.length / cot1); const refs = thamChieu(ds, bm ? 7 : 8);
  let phac: string | null = null;
  if (bm) {   // tờ phác: cùng lưới với bảng cần ra (ô 9:16, viền trắng) — ô khung chèn không có người vẫn có nền đúng góc
    const lp = await luoiPhac(ds, cot1); phac = lp.tron;
    console.log(`tờ phác: ${lp.so}`); await ghiTap({ phac: lp.so });
  }
  if (process.argv.includes('--chi-phac')) process.exit(0);
  const prompt = [`A film storyboard THUMBNAIL sheet for one whole scene: EXACTLY ${ds.length} separate panels — never merge two frames into one panel, never split one — laid out as a regular grid of ${cot1} columns × ${hang} rows, read left to right, top to bottom${ds.length % cot1 ? `; the last row has only ${ds.length % cot1} panel(s), the rest of that row is plain white` : ''}. Every panel is a small vertical photorealistic live-action film still of equal size, separated by thin plain white gutters. ${KHONG_CHU}`,
    'This sheet decides the STAGING of the whole scene: EVERY panel happens in the location of Image 1 (never a blank or plain wall background — close-ups still show that place softly behind), the same light, faces and outfits in every panel; who stands where, where each person looks, what each holds; every object keeps its state from panel to panel (what is taken stays taken, what is gone stays gone).',
    ...(phac ? [`Image 1 is the BLOCKING SKETCH of this exact sheet: the same grid and panel order. In every panel copy its camera framing and staging exactly — where the back wall, the elevator doors (light grey) and the gold painting (yellow) are, where each person stands and how big they are (${Object.entries(bm!.mau ?? {}).map(([n, c]) => `${c === '#f4f4f4' ? 'white' : c === '#141414' ? 'black' : 'dark red'} figure = ${n}`).join(', ')}), and the red arrow = the direction that person looks. Turn the sketch into photorealistic film stills; never draw the sketch shapes, colours or arrows themselves.`] : []),
    `Reference images: ${refs.map(([k], i) => `Image ${i + (phac ? 2 : 1)} = ${k}`).join('; ')}.`,
    ...ds.map((c, i) => `PANEL ${i + 1} (row ${Math.floor(i / cot1) + 1}, column ${(i % cot1) + 1}) — ${moTaKhung(c)}`)].join('\n');
  moc.t1 = await sinh({ nhan: `Phân cảnh tầng 1 (thumbnail) #${tu}–#${ds.at(-1)?.thu_tu}`, prompt, refs: [...(phac ? [phac] : []), ...refs.map(([, u]) => u)], tiLe: '9:16', kichCo: '2K', thuMuc: `bang/${tap}` });
  luu(); await ghiTap({ t1: moc.t1 }); console.log(`tầng 1: ${moc.t1}`);
}
if (chiCat) { if (!moc.t1 && !gia('bang')) { console.error('chưa có ảnh tầng 1 / --bang'); process.exit(1); }
  const b = await tai(gia('bang') || moc.t1); const d = await doKhung(b, ds.length);
  for (const [i, k] of d.khung.entries()) await sharp(b).extract({ left: k.x0 + 3, top: k.y0 + 3, width: k.x1 - k.x0 - 6, height: k.y1 - k.y0 - 6 }).toFile(`/tmp/bang-${tap}-${i + 1}.jpg`);
  console.log(`dò được ${d.khung.length} khung (${d.mo_ta}) — cần ${ds.length}`); process.exit(0);
}
if (tang === '1') process.exit(0);

// ── TẦNG 2: bảng khối (vẽ lại khối khung tầng 1 ở chi tiết cao) ─────────────────────────────────────────────────────────────────────────────────
if (tang === '2' || tang === 'tat-ca') {
  if (!moc.t1) { console.error('chưa có tầng 1 (--t1=<url>)'); process.exit(1); }
  const b1 = await tai(moc.t1); const d1 = await doKhung(b1, ds.length);
  console.log(`tầng 1: dò được ${d1.khung.length} khung (${d1.mo_ta}) — cần ${ds.length}`);
  if (d1.khung.length !== ds.length) { console.error('số khung tầng 1 không khớp số shot — sinh lại tầng 1, không đoán'); process.exit(1); }
  moc.t2 = {}; moc.khoi = [];
  for (let a = 0; a < ds.length; a += khoi) {
    const nhom = ds.slice(a, a + khoi); const cot2 = nhom.length > 1 ? 2 : 1; const hang2 = Math.ceil(nhom.length / cot2);
    // ghép lại khối khung tầng 1 thành lưới cot2 cột, ô 9:16, viền trắng 12px
    const CW = 360, CH = 640, G = 12;
    const o = await Promise.all(nhom.map(async (_, j) => sharp(await cat(b1, d1.khung[a + j]!)).resize(CW, CH, { fit: 'cover' }).toBuffer()));
    const luoi = await sharp({ create: { width: cot2 * CW + (cot2 + 1) * G, height: hang2 * CH + (hang2 + 1) * G, channels: 3, background: '#ffffff' } })
      .composite(o.map((x, j) => ({ input: x, left: G + (j % cot2) * (CW + G), top: G + Math.floor(j / cot2) * (CH + G) }))).jpeg({ quality: 92 }).toBuffer();
    const urlLuoi = await len(luoi, `t2-vao-${nhom[0]!.thu_tu}`);
    const refs = thamChieu(nhom, 7);
    const prompt = [`Image 1 is a rough storyboard sheet of ${nhom.length} consecutive frames (${cot2} columns × ${hang2} rows, white gutters). Re-render it as the SAME storyboard sheet at much higher detail: the same grid, the same white gutters, the same panel order; inside every panel keep exactly the composition, camera angle, framing, people, positions on screen, poses, gaze directions, hands, objects and their states — do not move, add or remove anything.`,
      `Render photorealistic live-action detail. ${KHONG_CHU}`, `Reference images: ${refs.map(([k], i) => `Image ${i + 2} = ${k}`).join('; ')}.`,
      ...nhom.map((c, j) => `Panel ${j + 1} — ${moTaKhung(c)}`)].join('\n');
    const u2 = await sinh({ nhan: `Phân cảnh tầng 2 (khối) #${nhom[0]!.thu_tu}–#${nhom.at(-1)!.thu_tu}`, prompt, refs: [urlLuoi, ...refs.map(([, u]) => u)], tiLe: '9:16', kichCo: '2K', thuMuc: `bang/${tap}` });
    moc.khoi.push(u2); await ghiTap({ khoi: moc.khoi.map((url, j) => ({ tu: ds[j * khoi]!.thu_tu, den: ds[Math.min(ds.length, (j + 1) * khoi) - 1]!.thu_tu, url })) }); console.log(`tầng 2 khối #${nhom[0]!.thu_tu}–#${nhom.at(-1)!.thu_tu}: ${u2}`);
    const b2 = await tai(u2); const d2 = await doKhung(b2, nhom.length);
    if (d2.khung.length !== nhom.length) { console.error(`  khối này dò được ${d2.khung.length} khung (${d2.mo_ta}), cần ${nhom.length} — dừng, sinh lại khối`); luu(); process.exit(1); }
    for (const [j, c] of nhom.entries()) moc.t2[c.thu_tu] = await len(await cat(b2, d2.khung[j]!), `t2-${c.id}`);
    luu();
  }
}
if (tang === '2') process.exit(0);

// ── TẦNG KHỐI theo tờ phác (--tang=khoi, anh 24/10/2026): 17 khung một ảnh làm model quá tải ở 768×1376 (#356: Vivian đổi tóc, mất tranh, Hạ đeo lại
// thẻ đã bị giật) → tổng quan cả cảnh là TỜ PHÁC máy vẽ (0đ, đúng sơ đồ); AI vẽ từng khối ≤ 6 khung: ảnh 1 = tờ phác của khối (lưới 2 cột, khung
// đúng vị trí / hướng), ảnh 2 = bảng khối TRƯỚC (nối mặt, sảnh, trạng thái đồ) — rồi tầng 3 phóng từng khung như thường.
if (tang === 'khoi') {
  if (!bm) { console.error('cần --so-do=<bảng mảnh JSON có so_do>'); process.exit(1); }
  moc.t2 = {}; moc.khoi = []; moc.khoiSo = []; let truoc: string | null = null;
  for (let a = 0; a < ds.length; a += khoi) {
    const nhom = ds.slice(a, a + khoi); const cot2 = nhom.length > 1 ? 2 : 1; const hang2 = Math.ceil(nhom.length / cot2);
    const phacKhoi = (await luoiPhac(nhom, cot2)).tron;
    const refs = thamChieu(nhom, truoc ? 6 : 7); const lech = truoc ? 3 : 2;
    const mauChu = Object.entries(bm.mau ?? {}).map(([n, c]) => `${c === '#f4f4f4' ? 'white' : c === '#141414' ? 'black' : 'dark red'} figure = ${n}`).join(', ');
    const prompt = [`A film storyboard sheet of EXACTLY ${nhom.length} separate panels (${cot2} columns × ${hang2} rows, read left to right, top to bottom), every panel a vertical 9:16 photorealistic live-action film still of equal size, separated by thin plain white gutters. ${KHONG_CHU}`,
      `Image 1 is the BLOCKING SKETCH of this exact sheet: the same grid and panel order. In every panel copy its camera framing and staging exactly — where the back wall, the elevator doors (light grey) and the gold painting (yellow) are, where each person stands and how big they are (${mauChu}), and the red arrow = the direction that person looks. Turn the sketch into photorealistic film stills; never draw the sketch shapes, colours or arrows themselves.`,
      ...(truoc ? ['Image 2 is the PREVIOUS sheet of this same scene, just before these panels: keep exactly the same place, light, faces, hair, outfits and the state of every object as it ends there (what was taken stays taken).'] : []),
      `Reference images: ${refs.map(([k], i) => `Image ${i + lech} = ${k}`).join('; ')}.`,
      'Every panel happens in that same place (never a blank or plain wall background — close-ups still show it softly behind).',
      ...nhom.map((c, j) => `PANEL ${j + 1} — ${moTaKhung(c)}`)].join('\n');
    const u2 = await sinh({ nhan: `Phân cảnh khối #${nhom[0]!.thu_tu}–#${nhom.at(-1)!.thu_tu} (theo tờ phác)`, prompt, refs: [phacKhoi, ...(truoc ? [truoc] : []), ...refs.map(([, u]) => u)], tiLe: '9:16', kichCo: '2K', thuMuc: `bang/${tap}` });
    const b2 = await tai(u2); const d2 = await doKhung(b2, nhom.length);
    console.log(`khối #${nhom[0]!.thu_tu}–#${nhom.at(-1)!.thu_tu}: ${u2} — dò ${d2.khung.length} khung (${d2.mo_ta})`);
    if (d2.khung.length !== nhom.length) { console.error('  số khung không khớp — dừng, sinh lại khối này'); luu(); process.exit(1); }
    for (const [j, c] of nhom.entries()) moc.t2[c.thu_tu] = await len(await cat(b2, d2.khung[j]!), `t2-${c.id}`);
    moc.khoi.push(u2); truoc = u2; (moc.khoiSo ??= []).push(await len(await danhSo(b2, d2.khung, nhom.map((c) => c.thu_tu)), `khoi-so-${nhom[0]!.thu_tu}`)); luu();
    await ghiTap({ khoi: moc.khoiSo!.map((url, j) => ({ tu: ds[j * khoi]!.thu_tu, den: ds[Math.min(ds.length, (j + 1) * khoi) - 1]!.thu_tu, url })) });
  }
  if (process.argv.includes('--chi-khoi')) process.exit(0);
}

// ── TẦNG 3: khung chi tiết → keyframe ────────────────────────────────────────────────────────────────────────────────────────────────────────────
for (const c of ds) {
  const urlCat = moc.t2?.[c.thu_tu]; if (!urlCat) { console.error(`#${c.thu_tu}: chưa có khung tầng 2`); continue; }
  const matShot = c.nhan_vat.map(ten).filter((v): v is NhanVat => !!v && v.loai === 'nhan_vat').map((v) => [v.ten, v.anh_mat?.url?.[0] ?? v.anh_ref[0]] as const).filter(([, u]) => !!u);
  const p3 = [`Image 1 is one frame cut from a storyboard sheet. Re-render it as a full-resolution vertical 9:16 photorealistic live-action film still (if the panel is wider than 9:16, extend the scene naturally above and below — never crop anyone) with EXACTLY the same composition, camera angle, framing, people, poses, positions on screen, gaze directions, hands, objects and their states, and lighting — do not move, add or remove anything, do not change where anyone looks.`,
    'Only add detail and sharpness and render real skin, fabric and hair texture.', matShot.length ? `Faces must match these reference photos: ${matShot.map(([t], j) => `Image ${j + 2} = ${t}`).join('; ')}.` : '', 'No text, captions or borders.'].filter(Boolean).join(' ');
  // đã phóng từ ĐÚNG ảnh cắt này rồi (chạy lại sau lỗi cổng) → dùng lại, không trả tiền lần hai
  const da = (await q(sql`SELECT output_url FROM xv_job WHERE canh_id = ${c.id} AND trang_thai = 'xong' AND output_url IS NOT NULL AND request->'thamChieuUrl'->>0 = ${urlCat} ORDER BY id DESC LIMIT 1`))[0];
  if (da) { await chonKeyframe(db, c.id, String(da.output_url), 'phân cảnh ba tầng'); console.log(`#${c.thu_tu} → ${da.output_url} (đã có)`); continue; }
  // cổng ảnh hay quá giờ (PlenX 24/10/2026: #2 timeout làm dừng cả vòng 16 khung) → thử lại tối đa 3 lần; lượt lỗi cổng không tính tiền
  let url = '';
  for (let lan = 1; lan <= 3 && !url; lan++) {
    try { url = await sinh({ nhan: `Keyframe (phân cảnh tầng 3) · cảnh #${c.thu_tu}`, prompt: p3, refs: [urlCat, ...matShot.map(([, u]) => u!)], tiLe: '9:16', thuMuc: `keyframe/${c.id}`, canhId: c.id }); }
    catch (e) { console.error(`#${c.thu_tu} lần ${lan}: ${e instanceof Error ? e.message : e}`); if (lan < 3) await new Promise((ok) => setTimeout(ok, 20_000)); }
  }
  if (!url) { console.error(`#${c.thu_tu}: bỏ qua sau 3 lần lỗi`); continue; }
  await chonKeyframe(db, c.id, url, 'phân cảnh ba tầng'); console.log(`#${c.thu_tu} → ${url}`);
}
process.exit(0);
