// BẢNG GOM KEYFRAME (anh 23/10/2026: "sinh 1 keyframe gom đủ các keyframe cần làm vào chung để có kịch bản khớp toàn phần, sau đó mới zoom chi tiết
// từng key ra cho mỗi shot"). Vẽ từng khung riêng thì mỗi khung một sảnh / một trạng thái đồ (#353 #15 Hạ còn đeo thẻ đã bị giật, #16 đổi cổ váy);
// vẽ 4–6 khung trong MỘT ảnh thì model tự giữ chung sảnh, ánh sáng, trang phục, trạng thái vật. Ba bước:
//   1. BẢNG: một ảnh lưới (cột × hàng khung dọc 9:16, viền trắng, không chữ) — mỗi khung = prompt_anh + câu hướng sơ đồ (dan_dung.huong) của shot
//   2. CẮT: chia đều lưới → ảnh khung (R2)
//   3. PHÓNG: lượt SỬA ảnh (không vẽ mới) — khung cắt làm ảnh 1 + ảnh mặt nhân vật, giữ nguyên bố cục / tư thế / hướng nhìn / đồ, chỉ làm nét + khoá mặt
//      → chọn làm keyframe của shot. Sau đó: scripts/soat-huong.mts (cổng hướng) + scripts/truyen-tranh.mts (đọc như truyện tranh).
//   … tsx scripts/bang-gom.mts --tap=356 --tu=1 --den=6 [--cot=3] [--bang=<url ảnh bảng đã có — bỏ bước 1>] [--chi-bang]
// TỐN TIỀN: 1 ảnh bảng + 1 ảnh mỗi khung (cổng ảnh của phim / --mo-hinh) — chạy kèm DUYET_SINH_1_LAN=1 sau khi anh duyệt.
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { kemBienThe, mapCanh, mapNhanVat, taoJob, type Row } from '../src/lib/xuong-video/doc-db';
import { dayViecAnh } from '../src/lib/xuong-video/hoan-tat';
import { chonKeyframe } from '../src/lib/xuong-video/tu-sua-clip';
import { uploadToR2 } from '../src/lib/r2';
import type { Canh, NhanVat } from '../src/lib/xuong-video/kieu';

const gia = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const tap = Number(gia('tap')); const tu = Number(gia('tu') || 1); const den = Number(gia('den') || 6); const cot = Number(gia('cot') || 3);
const moHinh = gia('mo-hinh') || 'plenxai:nano-banana-2';
if (!tap) { console.error('cần --tap=<id>'); process.exit(1); }
const db = getDb()!;
const q = async (s: ReturnType<typeof sql>) => (await db.execute(s)) as unknown as Row[];
const ds: Canh[] = (await q(sql`SELECT * FROM xv_canh WHERE tap_id = ${tap} AND thu_tu BETWEEN ${tu} AND ${den} ORDER BY thu_tu`)).map(mapCanh);
const phimId = Number((await q(sql`SELECT phim_id FROM xv_tap WHERE id = ${tap}`))[0]!.phim_id);
const nv: NhanVat[] = await kemBienThe(db, (await q(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${phimId} ORDER BY id`)).map(mapNhanVat));
const hang = Math.ceil(ds.length / cot);
const CO: Record<string, string> = { ws: 'Wide shot', ms: 'Medium two-shot', mcu: 'Medium close-up', cu: 'Close-up', insert: 'Insert close-up', ecu: 'Extreme close-up' };

// ảnh tham chiếu: sảnh (ảnh toàn cảnh đã duyệt) · mỗi người MỘT ảnh mặt + biến thể trang phục đầu tiên gặp · đồ — trần 8 (PlenX)
const ten = (id: number) => nv.find((v) => v.id === id);
const dung = new Map<string, string>();
const boiCanh = nv.find((v) => v.loai === 'boi_canh' && v.anh_ref[0]); if (boiCanh) dung.set(`the lobby (${boiCanh.ten}) — wide establishing frame of this exact place`, boiCanh.anh_ref[0]!);
for (const c of ds) for (const id of c.nhan_vat) {
  const v = ten(id); if (!v || v.loai !== 'nhan_vat') continue;
  const mat = v.anh_mat?.url?.[0] ?? v.anh_ref[0]; if (mat && ![...dung.values()].includes(mat)) dung.set(`${v.ten}'s face`, mat);
  const bt = (v.bien_the ?? []).find((b) => c.bien_the.includes(b.id) && b.anh_url); if (bt?.anh_url && ![...dung.values()].includes(bt.anh_url)) dung.set(`${v.ten}'s outfit (${bt.mo_ta || bt.ten})`, bt.anh_url);
}
for (const c of ds) for (const id of c.nhan_vat) { const v = ten(id); if (v && v.loai !== 'nhan_vat' && v.loai !== 'boi_canh' && v.anh_ref[0] && ![...dung.values()].includes(v.anh_ref[0])) dung.set(`${v.ten} (${v.mo_ta.slice(0, 60)})`, v.anh_ref[0]); }
const refs = [...dung.entries()].slice(0, 8);

async function doiJob(job: number): Promise<string> {
  for (let i = 0; i < 120; i++) { const r = (await q(sql`SELECT trang_thai, output_url, loi FROM xv_job WHERE id = ${job}`))[0]!; if (r.trang_thai === 'xong' && r.output_url) return String(r.output_url); if (r.trang_thai === 'loi') throw new Error(String(r.loi)); await new Promise((ok) => setTimeout(ok, 5000)); }
  throw new Error(`job ${job} quá 10 phút`);
}

let bang = gia('bang');
if (!bang) {
  const khung = ds.map((c, i) => `PANEL ${i + 1} (row ${Math.floor(i / cot) + 1}, column ${(i % cot) + 1}) — ${CO[String(c.ky_thuat?.co_canh)] ?? 'Shot'}: ${(c.prompt_anh || c.dan_dung?.dien || c.hanh_dong).trim()} ${c.dan_dung?.huong ? `Screen direction: ${c.dan_dung.huong}.` : ''}`.trim());
  const prompt = [`A film storyboard sheet: ${ds.length} consecutive frames of ONE continuous scene, laid out as a grid of ${cot} columns × ${hang} rows, read left to right, top to bottom. Every panel is a vertical 9:16 photorealistic live-action film still of equal size, separated by thin plain white gutters. Absolutely no text, numbers, captions, labels or speech bubbles anywhere.`,
    'CONTINUITY across all panels: the same lobby, the same light, the same faces and outfits; every object keeps its state from one panel to the next (what is taken stays taken).',
    `Reference images: ${refs.map(([k], i) => `Image ${i + 1} = ${k}`).join('; ')}.`, ...khung].join('\n');
  const job = await taoJob(db, { phim_id: phimId, nhan: `Bảng gom keyframe #${tu}–#${den}`, loai: 'anh', provider: 'google', model: moHinh, request: { prompt, thamChieuUrl: refs.map(([, u]) => u) } });
  await dayViecAnh({ job, model: moHinh, prompt, thamChieuUrl: refs.map(([, u]) => u), tiLe: '4:5', kichCo: '2K', thuMuc: `bang/${tap}` });
  bang = await doiJob(job); console.log(`bảng: ${bang}`);
}
if (process.argv.includes('--chi-bang')) process.exit(0);

// CẮT: chia đều lưới, bỏ ~1,5% mép mỗi khung (viền trắng), về đúng 9:16
const goc = Buffer.from(await (await fetch(bang)).arrayBuffer()); const { width: W = 0, height: H = 0 } = await sharp(goc).metadata();
const kw = W / cot, kh = H / hang;
for (const [i, c] of ds.entries()) {
  const x = Math.round((i % cot) * kw + kw * 0.015), y = Math.round(Math.floor(i / cot) * kh + kh * 0.015), w = Math.round(kw * 0.97), h = Math.round(kh * 0.97);
  const w916 = Math.min(w, Math.round((h * 9) / 16)), h916 = Math.round((w916 * 16) / 9);
  const cat = await sharp(goc).extract({ left: x + Math.round((w - w916) / 2), top: y + Math.round((h - h916) / 2), width: w916, height: h916 }).jpeg({ quality: 92 }).toBuffer();
  const urlCat = await uploadToR2(`xuong-video/bang/${tap}/${c.id}-cat-${randomUUID()}.jpg`, cat, 'image/jpeg'); if (!urlCat) throw new Error('R2 chưa bật');
  // PHÓNG = SỬA (không vẽ mới): khung cắt là ảnh 1, ảnh mặt người trong shot sau đó
  const matShot = c.nhan_vat.map(ten).filter((v): v is NhanVat => !!v && v.loai === 'nhan_vat').map((v) => [v.ten, v.anh_mat?.url?.[0] ?? v.anh_ref[0]] as const).filter(([, u]) => !!u);
  const p2 = [`Image 1 is one frame cut from a storyboard sheet. Re-render it as a full-resolution vertical 9:16 photorealistic live-action film still with EXACTLY the same composition, camera angle, framing, people, poses, positions on screen, gaze directions, hands, objects and their states, and lighting — do not move, add or remove anything, do not change where anyone looks.`,
    'Only add detail and sharpness and render real skin, fabric and hair texture.', matShot.length ? `Faces must match these reference photos: ${matShot.map(([t], j) => `Image ${j + 2} = ${t}`).join('; ')}.` : '', 'No text, captions or borders.'].filter(Boolean).join(' ');
  const job = await taoJob(db, { canh_id: c.id, nhan: `Keyframe (phóng từ bảng gom) · cảnh #${c.thu_tu}`, loai: 'anh', provider: 'google', model: moHinh, request: { prompt: p2, thamChieuUrl: [urlCat, ...matShot.map(([, u]) => u!)], bang } });
  await dayViecAnh({ job, model: moHinh, prompt: p2, thamChieuUrl: [urlCat, ...matShot.map(([, u]) => u!)], tiLe: '9:16', thuMuc: `keyframe/${c.id}` });
  const url = await doiJob(job); await chonKeyframe(db, c.id, url, 'bảng gom');
  console.log(`#${c.thu_tu} cắt ${urlCat} → keyframe ${url}`);
}
process.exit(0);
