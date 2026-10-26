// ẢNH NGƯỜI THẬT TỪ SƠ ĐỒ SHOT (anh 26/10/2026: sơ đồ 0đ thay khung xám 3D). Ảnh 1 = khung trơn của ve-so-do.mts --sach=<thư mục> (chỉ bố cục: ai đứng
// đâu, cỡ khung, đầu quay đâu, đồ ở đâu); ảnh 2–3 = trang phục CỦA CẢNH của người có mặt (biến thể ở --shot, cùng luật khoa-3d-dien-ai.mts); prompt = phiếu
// phieu-shot.mts (chỉ người trong khung, nhìn ai, nét đầu → cuối + cấm, điểm neo mắt). ckey nano-banana-2 ~110₫/ảnh.
//   cd /opt/earns-marketing-os-v2/apps/xuong-video && set -a; . ../../.env.production; set +a; DUYET_SINH_1_LAN=1 NODE_OPTIONS=--conditions=react-server \
//     ../../node_modules/.bin/tsx scripts/anh-tu-so-do.mts --bang=scripts/so-do/thang-may-356.json --khung=/tmp/so-do-thang-may --so=11,12 --phim=353 --shot=1822
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { mapNhanVat, kemBienThe, type Row } from '../src/lib/xuong-video/doc-db';
import { sinhAnhMotCong } from '../src/lib/xuong-video/cong-ai';
import { uploadToR2 } from '../src/lib/r2';
import { phieuShot, khongGianTap, lechSo, type BangShot } from './phieu-shot.mts';

const gia = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const bang = JSON.parse(readFileSync(gia('bang')!, 'utf8')) as BangShot; const thu = gia('khung')!; const phim = Number(gia('phim')); const shotMau = Number(gia('shot') || 0);
// --so=all | thieu (chỉ khung chưa có ảnh — chạy lại sau lỗi hết giờ không trả tiền khung đã đạt) | 1,2,3
const ds = gia('so') === 'all' ? bang.shot.map((x) => x.so) : gia('so') === 'thieu' ? bang.shot.map((x) => x.so).filter((so) => !existsSync(`${thu}/so-${so}-that.png`)) : (gia('so') || '').split(',').map(Number).filter(Boolean);
if (!thu || !phim || !ds.length) { console.error('cần --bang --khung --so --phim'); process.exit(1); }
if (!process.env.DUYET_SINH_1_LAN && !process.argv.includes('--xem')) { console.error('tốn tiền — cần DUYET_SINH_1_LAN=1 (hoặc --xem để chỉ in prompt)'); process.exit(2); }
const db = getDb()!;
// SỔ ĐỒ VẬT của cảnh (studio) — trạng thái đồ trong phiếu lấy từ đây, không từ sơ đồ
const tapId = Number(((await db.execute(sql`SELECT tap_id FROM xv_canh WHERE id = ${shotMau}`)) as unknown as Row[])[0]?.tap_id ?? 0);
const kg = tapId ? await khongGianTap(tapId, bang.phan_doan ?? '') : null;
if (!kg?.so_vat) console.log('⚠ cảnh không có sổ đồ vật — phiếu dùng đồ vẽ trên sơ đồ'); else for (const l of lechSo(bang, kg)) console.log(`LỆCH SỔ: ${l}`);
const nv = await kemBienThe(db, ((await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${phim} AND loai = 'nhan_vat' ORDER BY id`)) as unknown as Row[]).map(mapNhanVat));
// ảnh mẫu ĐẠO CỤ + BỐI CẢNH của phim — lấp chỗ mẫu còn trống (cổng ảnh nhận tối đa 3: sơ đồ + 2) để đồ và nền giống nhau mọi khung
const khac = ((await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${phim} AND loai IN ('dao_cu', 'boi_canh') ORDER BY id`)) as unknown as Row[]).map(mapNhanVat);
const btShot: number[] = shotMau ? ((((await db.execute(sql`SELECT bien_the FROM xv_canh WHERE id = ${shotMau}`)) as unknown as Row[])[0]?.bien_the ?? []) as number[]) : [];
const anhMau = (ten: string) => { const v = nv.find((x) => x.ten === ten); const bt = (v?.bien_the ?? []).find((b) => btShot.includes(b.id) && b.anh_url); return bt?.anh_url ?? v?.anh_ref[0] ?? ''; };
// TRANG PHỤC theo SHOT (bảng: bien_the mặc định của cảnh, shot đè) — tả = mô tả gốc + biến thể; ảnh mẫu = ảnh biến thể, biến thể chưa có ảnh (vd "không thẻ")
// thì mượn ảnh biến thể cùng bộ đồ có ảnh, câu tả đè trạng thái (26/10/2026: phiếu dùng câu tả nháp → vết cà phê, cúc áo, thẻ mỗi khung một kiểu)
const btCua = (s: { bien_the?: Record<string, number> }, ma: string) => { const id = s.bien_the?.[ma] ?? bang.bien_the?.[ma]; const v = nv.find((x) => x.ten === bang.nhan_vat[ma]?.ten_db); return { v, bt: (v?.bien_the ?? []).find((b) => b.id === id) }; };
const taCua = (s: { bien_the?: Record<string, number> }) => Object.fromEntries(Object.keys(bang.nhan_vat).flatMap((ma) => { const { v, bt } = btCua(s, ma); return v ? [[v.ten, `${v.ten} (${v.mo_ta}; wearing: ${bt?.mo_ta ?? 'the outfit of reference image'})`]] : []; }));
const anhCua = (s: { bien_the?: Record<string, number> }, ten: string) => { const ma = Object.keys(bang.nhan_vat).find((m) => bang.nhan_vat[m]?.ten_db === ten); const { v, bt } = ma ? btCua(s, ma) : { v: undefined, bt: undefined };
  return bt?.anh_url ?? (v?.bien_the ?? []).find((b) => b.anh_url && bt && b.mo_ta.length > 20 && bt.mo_ta.startsWith(b.mo_ta.slice(0, 60)))?.anh_url ?? anhMau(ten); };
const vatTa = Object.fromEntries(khac.filter((x) => x.loai === 'dao_cu' && x.mo_ta).map((x) => [x.ten, x.mo_ta]));
const len = async (f: string, k: string) => { const jpg = f.endsWith('.jpg'); const u = await uploadToR2(`xuong-video/thu/so-do-${k}-${randomUUID()}.${jpg ? 'jpg' : 'png'}`, readFileSync(f), jpg ? 'image/jpeg' : 'image/png'); if (!u) throw new Error(`không tải lên được ${f}`); return u; };

const BO_CUC = 'Image 1 is a flat schematic storyboard diagram, NOT a style reference: use it ONLY for the layout — the framing and crop, who stands where (screen left / right), which way each body and head turns, where the props are. '
  + 'Everything must look like a real photograph from a live-action drama: real people with natural skin, real hair, real fabric, real anatomy and hands. Never draw flat shapes, outlines, arrows, symbols or any diagram graphics.';
async function motKhung(so: number) {
  const s = bang.shot.find((x) => x.so === so); if (!s) return console.log(`#${so}: không có trong bảng`);
  const co = (s.nguoi ?? []).filter((n) => !n.lung).map((n) => bang.nhan_vat[n.ma]?.ten_db ?? '').filter((t) => t && anhCua(s, t)).slice(0, 2);
  // chỗ còn lại: đạo cụ trong khung (khai ở cận đồ / người trong khung đang giữ) rồi bối cảnh
  const doTrong = [...new Set([...(s.do ?? []).map((o) => bang.vat_so?.[o.loai]), ...(s.nguoi ?? []).flatMap((n) => [...(n.cam ?? []), ...(n.deo ?? [])].map((k) => bang.vat_so?.[k.split('_')[0]!]))].filter((x): x is string => !!x))];
  const them = [...doTrong.map((t) => khac.find((x) => x.ten === t && x.anh_ref[0])), khac.find((x) => x.loai === 'boi_canh' && x.anh_ref[0])].filter((x): x is NonNullable<typeof x> => !!x).slice(0, 2 - co.length);
  const u1 = process.argv.includes('--xem') ? '(sơ đồ)' : await len(`${thu}/so-${so}.png`, `${so}`);
  const mat = co.map((t, i) => `${t} looks exactly like reference image ${i + 2} (same face and hair; the outfit follows reference image ${i + 2} AND the wearing description above — the description wins on stains, badges and details).`).join(' ');
  const mau2 = them.map((x, i) => x.loai === 'boi_canh' ? `Reference image ${co.length + i + 2} is the location — match its walls, doors, materials and warm lighting (not its framing).` : `Reference image ${co.length + i + 2} shows ${x.ten} — draw it exactly like this.`).join(' ');
  // Ô của ẢNH CHUNG cả cảnh (--chung) → thêm làm ảnh mẫu cuối: mặt, tóc, chi tiết đồ, ánh sáng, màu theo ô chung; bố cục vẫn theo sơ đồ (ảnh 1)
  const oChung = existsSync(`${thu}/so-${so}-chung.png`) ? (process.argv.includes('--xem') ? '(ô chung)' : await len(`${thu}/so-${so}-chung.png`, `${so}-chung`)) : null;
  const sau = oChung ? ` Reference image ${co.length + them.length + 2} is this shot's panel from the SHARED SCENE SHEET (all shots of the scene drawn together): match its faces, hair, outfit details, lighting and colours exactly — the framing and positions still follow image 1.` : '';
  const p = `${BO_CUC}\n${phieuShot(bang, s, kg, { ta: taCua(s), vat_ta: vatTa })}\n${mat} ${mau2}${sau}`;
  if (process.argv.includes('--xem')) return console.log(`---- #${so} (ảnh mẫu: ${co.map((t) => anhCua(s, t).split('/').pop()).join(', ')}${them.length ? ` + ${them.map((x) => x.ten).join(', ')}` : ''})\n${p}`);   // xem prompt, 0đ
  const a = await sinhAnhMotCong('ckey', 'wowztools/nano-banana-2', { prompt: p, thamChieuUrl: [u1, ...co.map((t) => anhCua(s, t)), ...them.map((x) => x.anh_ref[0]!), ...(oChung ? [oChung] : [])], tiLe: '9:16' });
  if (!a.anh) return console.log(`#${so}: ảnh hỏng — ${a.loi}`);
  writeFileSync(`${thu}/so-${so}-that.png`, a.anh.data); console.log(`#${so}: ${await len(`${thu}/so-${so}-that.png`, `${so}-that`)}`);
}
// ẢNH CHUNG CẢ CẢNH (--chung, anh 26/10/2026 — gộp tầng 1 của bang-gom.mts với sơ đồ shot): lưới 3×3 khung sơ đồ trơn → MỘT ảnh người thật cho cả lưới
// (model vẽ mọi ô cùng lúc nên mặt / đồ / ánh sáng đồng nhất) → cắt từng ô thành so-N-chung.png; lượt sinh từng khung sau đó tự lấy ô làm ảnh mẫu.
if (process.argv.includes('--chung')) {
  const sharp = (await import('sharp')).default; const CW = 360, CH = 640, G = 12;
  for (let i = 0; i < ds.length; i += 9) {
    const nhom = ds.slice(i, i + 9); const W = 3 * CW + 4 * G, H = 3 * CH + 4 * G; const o = (k: number) => ({ left: G + (k % 3) * (CW + G), top: G + Math.floor(k / 3) * (CH + G) });
    const luoi = await sharp({ create: { width: W, height: H, channels: 3, background: '#ffffff' } }).composite(await Promise.all(nhom.map(async (so, k) => ({ input: await sharp(`${thu}/so-${so}.png`).resize(CW, CH).png().toBuffer(), ...o(k) })))).png().toBuffer();
    writeFileSync(`${thu}/luoi-${i / 9}.png`, luoi);
    const ai = [...new Set(nhom.flatMap((so) => (bang.shot.find((x) => x.so === so)?.nguoi ?? []).filter((n) => !n.lung).map((n) => bang.nhan_vat[n.ma]?.ten_db ?? '')).filter(Boolean))].slice(0, 3);
    const sMau = bang.shot.find((x) => x.so === nhom[0]) ?? {};
    const tung = nhom.map((so, k) => { const s = bang.shot.find((x) => x.so === so)!; return `Panel ${k + 1} (row ${Math.floor(k / 3) + 1}, column ${(k % 3) + 1}): ${s.co} — ${s.dien_en ?? ''}`; }).join('\n');
    const p = `Image 1 is a 3×3 storyboard GRID of flat schematic diagrams (white gutters between panels). Redraw the SAME 3×3 grid as nine photoreal live-action film stills of one scene — keep the grid, the panel order, every panel's framing and who stands where; the white gutters stay. The same people must look IDENTICAL in every panel (same face, hair, makeup, outfit details) and one consistent lighting setup runs through all panels. ${bang.canh_en} No text, no captions, no panel numbers.\n${tung}\n${Object.values(taCua(sMau)).filter((t) => ai.some((a) => t.startsWith(a))).join('\n')}\n${ai.map((t, k) => `${t} looks exactly like reference image ${k + 2}.`).join(' ')}`;
    if (process.argv.includes('--xem')) { console.log(`---- lưới ${i / 9}: ${nhom.join(', ')}\n${p}`); continue; }
    const a = await sinhAnhMotCong('ckey', 'wowztools/nano-banana-2', { prompt: p, thamChieuUrl: [await len(`${thu}/luoi-${i / 9}.png`, `luoi-${i / 9}`), ...ai.map((t) => anhCua(sMau as never, t))], tiLe: '9:16' });
    if (!a.anh) { console.log(`ảnh chung ${i / 9}: hỏng — ${a.loi}`); continue; }
    writeFileSync(`${thu}/chung-${i / 9}.png`, a.anh.data); const m = await sharp(a.anh.data).metadata(); const kx = (m.width ?? W) / W, ky = (m.height ?? H) / H;
    for (const [k, so] of nhom.entries()) { const q = o(k); await sharp(a.anh.data).extract({ left: Math.round(q.left * kx), top: Math.round(q.top * ky), width: Math.round(CW * kx), height: Math.round(CH * ky) }).png().toFile(`${thu}/so-${so}-chung.png`); }
    console.log(`ảnh chung ${i / 9} (${nhom.join(', ')}): ${await len(`${thu}/chung-${i / 9}.png`, `chung-${i / 9}`)}`);
  }
  process.exit(0);
}
// song song có trần (anh 24/10/2026: sinh AI song song mặc định) — 6 ảnh một lúc
// --song=N: số ảnh cùng lúc (mặc định 6; cổng chợ ckey trả chậm khi dồn — 26/10/2026 19/29 hết giờ 180 s ở mức 6)
const hang = [...ds]; await Promise.all(Array.from({ length: Math.min(Number(gia('song') || 6), hang.length) }, async () => { for (let so = hang.shift(); so != null; so = hang.shift()) await motKhung(so); }));
// bảng duyệt: các khung đã có, đánh số #N
const sharp = (await import('sharp')).default;
const co2 = bang.shot.filter((x) => existsSync(`${thu}/so-${x.so}-that.png`)); const C = 8, W = 270, H = 480;
if (co2.length) {
  const o = await Promise.all(co2.map(async (x, i) => ({ input: await sharp(`${thu}/so-${x.so}-that.png`).resize(W, H, { fit: 'cover' }).composite([{ input: Buffer.from(`<svg width="${W}" height="40"><rect width="70" height="34" rx="6" fill="#000" opacity="0.7"/><text x="10" y="25" font-size="22" font-weight="700" fill="#fff" font-family="DejaVu Sans, Arial">#${x.so}</text></svg>`), top: 6, left: 6 }]).png().toBuffer(), left: (i % C) * (W + 6), top: Math.floor(i / C) * (H + 6) })));
  await sharp({ create: { width: C * (W + 6), height: Math.ceil(co2.length / C) * (H + 6), channels: 3, background: '#111' } }).composite(o).jpeg({ quality: 85 }).toFile(`${thu}/bang.jpg`);
  console.log(`bảng: ${thu}/bang.jpg (${co2.length} khung) · ${await len(`${thu}/bang.jpg`, 'bang')}`);
}
process.exit(0);
