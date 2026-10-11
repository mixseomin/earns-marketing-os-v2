// Nạp bảng shot viết sẵn (JSON, cùng dạng kết quả "tách cảnh" của Claude) vào một tập — 0đ, không gọi model nào.
// Dùng khi kịch bản đã viết tay / viết ngoài studio: đi CÙNG đường lưu với nút ✂ Tách cảnh (luuCanhTach), nên shot nháp cũ vào thùng rác như thường.
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/nap-canh.mts --tap=<id> --tep=mau/<ten>-canh.json
// Tệp: { "tomTat": "", "beats": [], "phanCanh": [], "canh": [ { canh, goc_may, hanh_dong, loi_thoai, am_thanh, thoi_luong_s, phat_s, nhan_vat: [tên anchor],
//         bien_the: [], prompt_anh, prompt_video, phan_doan, cam_xuc, ky_thuat: {}, trang_phuc, chu_man, thoai: [{ nhan_vat, dien_xuat, loi }] } ] }
import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { luuCanhTach } from '../src/lib/xuong-video/luu-canh';
import { kemBienThe, mapNhanVat, type Row } from '../src/lib/xuong-video/doc-db';

const gia = (k: string) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? '').split('=')[1] ?? '';
const tapId = Number(gia('tap')); const tep = gia('tep');
if (!tapId || !tep) { console.error('thiếu --tap=<id> --tep=<json>'); process.exit(1); }
const db = getDb(); if (!db) { console.error('không có DATABASE_URL'); process.exit(1); }
const kq = { ok: true as const, tomTat: '', beats: [], phanCanh: [], ...JSON.parse(readFileSync(tep, 'utf8')) };
const t = (await db.execute(sql`SELECT phim_id, ten FROM xv_tap WHERE id = ${tapId}`)) as unknown as Row[];
if (!t[0]) { console.error('không thấy tập'); process.exit(1); }
const nv = await kemBienThe(db, ((await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${Number(t[0].phim_id)} ORDER BY id`)) as unknown as Row[]).map(mapNhanVat));
const lech = kq.canh.flatMap((c: { nhan_vat: string[] }) => c.nhan_vat.filter((x) => !nv.some((v) => v.ten.trim().toLowerCase() === x.trim().toLowerCase())));
if (lech.length) { console.error(`tên anchor không có trong phim: ${[...new Set(lech)].join(', ')}`); process.exit(1); }
const so = await luuCanhTach(db, { tapId, tenTap: String(t[0].ten), kq: kq as never, nhanVat: nv, nguoi: 'script nap-canh', thoiLuongS: kq.canh.reduce((a: number, c: { phat_s: number }) => a + c.phat_s, 0) });
console.log(`đã nạp ${so} shot vào tập #${tapId}`);
process.exit(0);
