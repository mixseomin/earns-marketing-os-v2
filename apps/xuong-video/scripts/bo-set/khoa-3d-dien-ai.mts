// 3D CHỐT LOGIC, AI DIỄN (anh 25/10/2026: "con AI không thể tự chế các tư thế đó được à? mày chỉ cần quy định các thứ khác"). Thay cho phu-be-mat.mts
// (VACE chép từng khung chuyển động 3D → mocap cứng / sai thì bản người thật cũng tởm). Ở đây 3D chỉ quyết TRẠNG THÁI hai đầu shot — ai đứng đâu,
// quay hướng nào, tay nào cầm gì, đồ đang ở đâu — và mọi máy chụp từ MỘT cảnh 3D nên các góc khớp nhau qua cú cắt. Chuyển động giữa hai đầu do mô
// hình video tự diễn (đầu + cuối → clip).
//   1. khung 3D đầu / cuối mỗi máy → ảnh người thật (ckey nano-banana-2, ~110₫/ảnh). Máy CHUẨN (máy đầu trong --may, thường là toàn) làm trước;
//      mọi ảnh sau lấy ảnh người thật của máy chuẩn làm mẫu → cùng mặt, cùng đồ, cùng ánh sáng ở mọi góc.
//   2. Vidu Q2 Turbo đầu + cuối (fal, $0,05/giây 720p) cho từng máy.
// Vào: /tmp/khoa-<ten>/<may>-dau.png, <may>-cuoi.png (render tĩnh dung-set.py, mỗi máy một tệp vao.json). Ra: in link ảnh + clip từng máy.
//   cd /opt/earns-marketing-os-v2/apps/xuong-video && set -a; . ../../.env.production; set +a; DUYET_SINH_1_LAN=1 NODE_OPTIONS=--conditions=react-server \
//     ../../node_modules/.bin/tsx scripts/bo-set/khoa-3d-dien-ai.mts --ten=giat-the --phim=353 --may=toan,qua-vai,can-mat-ha,can-tay \
//     --nguoi="Lâm Hạ,Vivian" --shot=1822 --giay=5 --dien="…hành động giữa hai khung…" --dau="<trạng thái đồ khung đầu>" --cuoi="<… khung cuối>" \
//     [--chi-anh] [--lai=toan-cuoi,can-mat-ha-cuoi] [--clip=can-tay] [--ta="can-tay:extreme close-up insert of …;qua-vai:…"]
// CỠ CẢNH TỪNG MÁY (--ta): khung 3D cận sát chỉ có ngực + dây thẻ thì AI hay "sửa" thành cảnh toàn theo ảnh mẫu (26/10/2026 cận tay) — câu cỡ cảnh khoá lại.   (--lai: chỉ làm lại các ảnh đó, ảnh khác lấy từ <thu>/anh.json của lượt trước)
// TRẠNG THÁI ĐỒ (--dau / --cuoi, tiếng Anh): ảnh mẫu người thật mang theo trạng thái đồ của khung nó (khung đầu: thẻ trên cổ Hạ) → khung cuối chép luôn,
// thành hai cái thẻ (25/10/2026). Câu trạng thái đi vào MỌI ảnh của khung đó và đè lên ảnh mẫu.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { mapNhanVat, kemBienThe, type Row } from '../../src/lib/xuong-video/doc-db';
import { sinhAnhMotCong } from '../../src/lib/xuong-video/cong-ai';
import { guiFal, docFal } from '../../src/lib/xuong-video/fal';
import { uploadToR2 } from '../../src/lib/r2';
import { GIU_LOGIC_3D } from '../../src/lib/xuong-video/giu-logic-3d';

const gia = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const ten = gia('ten'), phim = Number(gia('phim')), dsMay = (gia('may') || '').split(',').filter(Boolean), dien = gia('dien') || '', giay = Number(gia('giay') || 5);
if (!ten || !phim || !dsMay.length || !dien) { console.error('cần --ten --phim --may --dien'); process.exit(1); }
if (!process.env.DUYET_SINH_1_LAN) { console.error('tốn tiền — cần DUYET_SINH_1_LAN=1'); process.exit(2); }
const chiAnh = process.argv.includes('--chi-anh'); const lai = (gia('lai') || '').split(',').filter(Boolean);
const taMay: Record<string, string> = Object.fromEntries((gia('ta') || '').split(';').map((x) => x.split(':')).filter((x) => x.length >= 2).map(([m, ...r]) => [m!.trim(), r.join(':').trim()]));
const trangThai = { dau: gia('dau') || '', cuoi: gia('cuoi') || '' };
const db = getDb()!; const thu = `/tmp/khoa-${ten}`;
const VIDU = 'fal-ai/vidu/q2/image-to-video/turbo';
// trang phục CỦA CẢNH (biến thể ở shot --shot), không phải ảnh mẫu gốc — cùng luật phu-be-mat.mts
const nv = await kemBienThe(db, ((await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${phim} AND loai = 'nhan_vat' ORDER BY id`)) as unknown as Row[]).map(mapNhanVat));
const chiNguoi = (gia('nguoi') || '').split(',').map((x) => x.trim()).filter(Boolean);
const shotMau = Number(gia('shot') || 0);
const btShot: number[] = shotMau ? ((((await db.execute(sql`SELECT bien_the FROM xv_canh WHERE id = ${shotMau}`)) as unknown as Row[])[0]?.bien_the ?? []) as number[]) : [];
const mau = nv.filter((v) => !chiNguoi.length || chiNguoi.includes(v.ten)).map((v) => { const bt = (v.bien_the ?? []).find((b) => btShot.includes(b.id) && b.anh_url);
  return { ten: v.ten, mo_ta: bt?.mo_ta ? `${v.ten} wearing ${bt.mo_ta}` : v.mo_ta, anh: bt?.anh_url ?? v.anh_ref[0] ?? '' }; }).filter((x) => x.anh);
const len = async (f: string, k: string): Promise<string> => { const u = await uploadToR2(`xuong-video/thu/${ten}-${k}-${randomUUID()}${f.slice(f.lastIndexOf('.'))}`, readFileSync(f), f.endsWith('.png') ? 'image/png' : 'image/jpeg'); if (!u) throw new Error(`không tải lên được ${f}`); return u; };
const giuLogic = GIU_LOGIC_3D;
const nguoiCo = mau.map((x) => `${x.mo_ta.slice(0, 200)}`).join(' ');

async function anhThat(f: string, k: string, mauAnh: string[], loiMau: string): Promise<string | null> {
  if (cu[k] && !lai.includes(k)) return cu[k]!;
  const tt = trangThai[k.endsWith('-cuoi') ? 'cuoi' : 'dau']; const ta = taMay[k.replace(/-(dau|cuoi)$/, '')];
  if (ta) loiMau = `FRAMING (must match image 1, never widen): ${ta}. ${loiMau}`;
  loiMau += ` The reference images are ONLY for faces, hair, clothes, lighting and the room — every object's position and who holds or wears what follow image 1${tt ? ` and this state: ${tt}` : ''}.`;
  const u3 = await len(f, `${k}-3d`);
  const p = `Image 1 is a rough grey 3D blockout frame of a live-action vertical drama shot in a luxury corporate elevator lobby (dark marble walls, brushed steel elevator doors, warm ceiling light). Turn it into a photorealistic film still. ${giuLogic} ${loiMau} ${nguoiCo} No text, no captions.`;
  const a = await sinhAnhMotCong('ckey', 'wowztools/nano-banana-2', { prompt: p, thamChieuUrl: [u3, ...mauAnh].slice(0, 3), tiLe: '9:16' });
  if (!a.anh) { console.log(`${k}: ảnh hỏng — ${a.loi}`); return null; }
  writeFileSync(`${thu}/${k}-that.png`, a.anh.data); const u = await len(`${thu}/${k}-that.png`, `${k}-that`); console.log(`${k}: ${u}`); return u;
}

const cu: Record<string, string> = existsSync(`${thu}/anh.json`) ? Object.fromEntries(Object.entries(JSON.parse(readFileSync(`${thu}/anh.json`, 'utf8')) as Record<string, { dau?: string; cuoi?: string }>).flatMap(([m, v]) => [[`${m}-dau`, v.dau ?? ''], [`${m}-cuoi`, v.cuoi ?? '']]).filter(([, u]) => u)) : {};
// 1. máy chuẩn: khung đầu theo ảnh trang phục; khung cuối theo khung đầu người thật (cùng mặt / đồ / ánh sáng)
const [chuan, ...con] = dsMay;
const nguoiAnh = mau.map((x) => x.anh);
const cDau = await anhThat(`${thu}/${chuan}-dau.png`, `${chuan}-dau`, nguoiAnh.slice(0, 2), mau.map((x, i) => `${x.ten} looks exactly like reference image ${i + 2} (face, hair, outfit).`).join(' '));
if (!cDau) process.exit(3);
const cCuoi = await anhThat(`${thu}/${chuan}-cuoi.png`, `${chuan}-cuoi`, [cDau], 'Every person, outfit, prop and the room look exactly like reference image 2 (same people, same faces, same clothes, same lighting).');
if (!cCuoi) process.exit(3);
const anh: Record<string, { dau: string | null; cuoi: string | null }> = { [chuan]: { dau: cDau, cuoi: cCuoi } };
const loiChuan = 'The people, faces, hair, outfits, props and the room look exactly like reference images 2 and 3 (the same scene seen from another camera).';
await Promise.all(con.map(async (m) => {
  const [d, c] = await Promise.all([anhThat(`${thu}/${m}-dau.png`, `${m}-dau`, [cDau], loiChuan.replace(' and 3', '')), anhThat(`${thu}/${m}-cuoi.png`, `${m}-cuoi`, [cDau, cCuoi], loiChuan)]);
  anh[m] = { dau: d, cuoi: c };
}));
writeFileSync(`${thu}/anh.json`, JSON.stringify(anh));
if (chiAnh) { console.log(JSON.stringify(anh)); process.exit(0); }

// 2. Vidu đầu + cuối: mô hình tự diễn đoạn giữa
const ketQua: Record<string, string> = {};
const chiClip = (gia('clip') || '').split(',').filter(Boolean);   // chỉ sinh lại clip các máy này (máy khác giữ clip cũ)
await Promise.all(dsMay.filter((m) => !chiClip.length || chiClip.includes(m)).map(async (m) => {
  const a = anh[m]; if (!a?.dau || !a.cuoi) return;
  const g = await guiFal(VIDU, { prompt: `Photorealistic live-action vertical short drama. Locked-off static camera, no camera movement, no cuts. ${dien} At the end: ${trangThai.cuoi} Natural, realistic human acting and body weight; the start and end frames are exact.`.slice(0, 3000),
    image_url: a.dau, end_image_url: a.cuoi, duration: giay, resolution: '720p', movement_amplitude: 'auto' });
  if (!g.ok) { console.log(`${m}: Vidu từ chối — ${g.loi}`); return; }
  for (let i = 0; i < 120; i++) { await new Promise((r) => setTimeout(r, 10_000)); const d = await docFal(g.taskId);
    if (d.done && d.ok) { ketQua[m] = d.uri; writeFileSync(`${thu}/${m}-clip.mp4`, Buffer.from(await (await fetch(d.uri)).arrayBuffer())); console.log(`${m}: clip ${d.uri}`); return; }
    if (d.done) { console.log(`${m}: Vidu hỏng — ${d.loi}`); return; } }
  console.log(`${m}: quá 20 phút`);
}));
console.log(JSON.stringify({ anh, clip: ketQua }));
process.exit(0);
