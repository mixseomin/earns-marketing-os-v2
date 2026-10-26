// ẢNH NGƯỜI THẬT TỪ SƠ ĐỒ SHOT (anh 26/10/2026: sơ đồ 0đ thay khung xám 3D). Ảnh 1 = khung sạch của ve-so-do-shot.py --cho-ai (chỉ bố cục: ai đứng
// đâu, cỡ khung, đầu quay đâu, đồ ở đâu); ảnh 2–3 = trang phục CỦA CẢNH của người có mặt (biến thể ở --shot, cùng luật khoa-3d-dien-ai.mts); prompt = phiếu
// phieu-shot.mts (chỉ người trong khung, nhìn ai, nét đầu → cuối + cấm, điểm neo mắt). ckey nano-banana-2 ~110₫/ảnh.
//   cd /opt/earns-marketing-os-v2/apps/xuong-video && set -a; . ../../.env.production; set +a; DUYET_SINH_1_LAN=1 NODE_OPTIONS=--conditions=react-server \
//     ../../node_modules/.bin/tsx scripts/anh-tu-so-do.mts --bang=scripts/so-do/thang-may-356.json --khung=/tmp/so-do-thang-may --so=11,12 --phim=353 --shot=1822
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { mapNhanVat, kemBienThe, type Row } from '../src/lib/xuong-video/doc-db';
import { sinhAnhMotCong } from '../src/lib/xuong-video/cong-ai';
import { uploadToR2 } from '../src/lib/r2';
import { phieuShot, khongGianTap, lechSo, type BangShot } from './phieu-shot.mts';

const gia = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const bang = JSON.parse(readFileSync(gia('bang')!, 'utf8')) as BangShot; const thu = gia('khung')!; const phim = Number(gia('phim')); const shotMau = Number(gia('shot') || 0);
const ds = (gia('so') || '').split(',').map(Number).filter(Boolean);
if (!thu || !phim || !ds.length) { console.error('cần --bang --khung --so --phim'); process.exit(1); }
if (!process.env.DUYET_SINH_1_LAN) { console.error('tốn tiền — cần DUYET_SINH_1_LAN=1'); process.exit(2); }
const db = getDb()!;
// SỔ ĐỒ VẬT của cảnh (studio) — trạng thái đồ trong phiếu lấy từ đây, không từ sơ đồ
const tapId = Number(((await db.execute(sql`SELECT tap_id FROM xv_canh WHERE id = ${shotMau}`)) as unknown as Row[])[0]?.tap_id ?? 0);
const kg = tapId ? await khongGianTap(tapId, bang.phan_doan ?? '') : null;
if (!kg?.so_vat) console.log('⚠ cảnh không có sổ đồ vật — phiếu dùng đồ vẽ trên sơ đồ'); else for (const l of lechSo(bang, kg)) console.log(`LỆCH SỔ: ${l}`);
const nv = await kemBienThe(db, ((await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${phim} AND loai = 'nhan_vat' ORDER BY id`)) as unknown as Row[]).map(mapNhanVat));
const btShot: number[] = shotMau ? ((((await db.execute(sql`SELECT bien_the FROM xv_canh WHERE id = ${shotMau}`)) as unknown as Row[])[0]?.bien_the ?? []) as number[]) : [];
const anhMau = (ten: string) => { const v = nv.find((x) => x.ten === ten); const bt = (v?.bien_the ?? []).find((b) => btShot.includes(b.id) && b.anh_url); return bt?.anh_url ?? v?.anh_ref[0] ?? ''; };
const len = async (f: string, k: string) => { const u = await uploadToR2(`xuong-video/thu/so-do-${k}-${randomUUID()}.png`, readFileSync(f), 'image/png'); if (!u) throw new Error(`không tải lên được ${f}`); return u; };

const BO_CUC = 'Image 1 is a flat schematic storyboard diagram, NOT a style reference: use it ONLY for the layout — the framing and crop, who stands where (screen left / right), which way each body and head turns, where the props are. '
  + 'Everything must look like a real photograph from a live-action drama: real people with natural skin, real hair, real fabric, real anatomy and hands. Never draw flat shapes, outlines, arrows, symbols or any diagram graphics.';
await Promise.all(ds.map(async (so) => {
  const s = bang.shot.find((x) => x.so === so); if (!s) return console.log(`#${so}: không có trong bảng`);
  const co = (s.nguoi ?? []).filter((n) => !n.lung).map((n) => bang.nhan_vat[n.ma]?.ten_db ?? '').filter((t) => t && anhMau(t)).slice(0, 2);
  const u1 = await len(`${thu}/so-${so}.png`, `${so}`);
  const mat = co.map((t, i) => `${t} looks exactly like reference image ${i + 2} (same face, hair and outfit).`).join(' ');
  const p = `${BO_CUC}\n${phieuShot(bang, s, kg)}\n${mat}`;
  const a = await sinhAnhMotCong('ckey', 'wowztools/nano-banana-2', { prompt: p, thamChieuUrl: [u1, ...co.map(anhMau)], tiLe: '9:16' });
  if (!a.anh) return console.log(`#${so}: ảnh hỏng — ${a.loi}`);
  writeFileSync(`${thu}/so-${so}-that.png`, a.anh.data); console.log(`#${so}: ${await len(`${thu}/so-${so}-that.png`, `${so}-that`)}`);
}));
process.exit(0);
