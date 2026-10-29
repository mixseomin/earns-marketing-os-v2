// 🔗 SOÁT CHUỖI (Bước 3 thủ công): với các shot vừa sinh (so-N-that.png), dựng spec DỰ KIẾN thẳng từ BẢNG + DB rồi ĐỐI CHIẾU với ảnh
// thực tế → bảng khớp từng thành phần (yêu cầu ↔ thực tế). Số shot của bảng KHÔNG trùng thu_tu canh nên không đi qua boc-tach.mts (bám canh).
//   cd /opt/earns-marketing-os-v2/apps/xuong-video && set -a; . ../../.env.production; set +a; NODE_OPTIONS=--conditions=react-server \
//     ../../node_modules/.bin/tsx scripts/soat-chuoi.mts --bang=scripts/so-do/thang-may-356.json --khung=/tmp/sach-356 --so=5,6,7 --phim=353 [--json=/tmp/soat.json]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { mapNhanVat, kemBienThe, type Row } from '../src/lib/xuong-video/doc-db';
import { bocTachKhung } from '../src/lib/xuong-video/boc-tach-khung';
import { thanhPhanDuKien, doiChieuKhung, apDungSoBang } from '../src/lib/xuong-video/doi-chieu-khung';
import { uploadToR2 } from '../src/lib/r2';
import type { BangShot } from './phieu-shot.mts';
import type { Canh, BocTachKhung, DongDoiChieu } from '../src/lib/xuong-video/kieu';

const gia = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const bang = JSON.parse(readFileSync(gia('bang')!, 'utf8')) as BangShot;
const thu = gia('khung')!; const phim = Number(gia('phim'));
const ds = (gia('so') || '').split(',').map(Number).filter(Boolean);
if (!thu || !phim || !ds.length) { console.error('cần --bang --khung --so --phim'); process.exit(1); }
const db = getDb()!;
const nv = await kemBienThe(db, ((await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${phim} AND loai = 'nhan_vat' ORDER BY id`)) as unknown as Row[]).map(mapNhanVat));

const ra: Record<number, { dien: string; co: string; chieu: DongDoiChieu[] | null }> = {};
for (const so of ds) {
  const s = bang.shot.find((x) => x.so === so);
  if (!s) { console.log(`#${so}: không có trong bảng`); continue; }
  const f = `${thu}/so-${so}-that.png`;
  if (!existsSync(f)) { console.log(`#${so}: chưa có ảnh ${f} (sinh keyframe trước)`); continue; }
  const nguoi = (s.nguoi ?? []).filter((n) => !n.lung);
  const ids = nguoi.map((n) => nv.find((v) => v.ten === bang.nhan_vat[n.ma]?.ten_db)?.id).filter((x): x is number => !!x);
  const btIds = nguoi.map((n) => s.bien_the?.[n.ma] ?? bang.bien_the?.[n.ma]).filter((x): x is number => !!x);
  const bieu_cam = nguoi.filter((n) => n.mat).map((n) => ({ nv: bang.nhan_vat[n.ma]?.ten_db ?? '', dau: n.mat![0], cuoi: n.mat![1] }));
  // Canh ảo từ shot bảng → dùng lại duKienKhung (kg=null: bỏ vị trí màn, giữ áo/tóc/biểu cảm/khung)
  const c = { thu_tu: so, nhan_vat: ids, bien_the: btIds, bieu_cam, ky_thuat: { co_canh: s.co }, phan_doan: bang.phan_doan, canh: bang.phan_doan, trang_phuc: null } as unknown as Canh;
  const dien = (s as { dien?: string }).dien ?? s.dien_en ?? '';
  // đạo cụ dự kiến lấy thẳng từ bảng (đồ cầm/đeo + đồ bày) để không báo "thừa" oan khi ảnh có thùng/thẻ đúng cảnh
  const mon = (k: string) => bang.vat_so?.[k.split('_')[0]!] ?? k;
  const daoCu = [...new Set([...(s.do ?? []).map((o) => mon(o.loai)), ...(s.nguoi ?? []).flatMap((n) => [...(n.deo ?? []), ...(n.cam ?? [])].map(mon))])];
  const duKien = [...thanhPhanDuKien(c, nv, null, 'dau'), { thanh_phan: 'Hành động', du_kien: dien }, ...(daoCu.length ? [{ thanh_phan: 'Đạo cụ cảnh', du_kien: daoCu.join(', ') }] : [])];
  const url = await uploadToR2(`xuong-video/thu/soat-${so}-${randomUUID()}.png`, readFileSync(f), 'image/png');
  if (!url) { console.log(`#${so}: không tải ảnh lên được`); continue; }
  const r = await bocTachKhung(db, phim, url, nv.filter((v) => v.loai === 'nhan_vat').map((v) => v.ten));
  if (!r) { console.log(`#${so}: bóc tách hỏng`); continue; }
  const chieu0 = await doiChieuKhung(db, phim, duKien, r as BocTachKhung);
  const chieu = chieu0 ? apDungSoBang(chieu0, c, nv, null, 'dau', r as BocTachKhung) : chieu0;
  ra[so] = { dien, co: s.co, chieu };
  console.log(`\n===== SHOT #${so} · ${s.co} · ${dien} =====`);
  if (!chieu) { console.log('  đối chiếu hỏng'); continue; }
  for (const d of chieu) console.log(`  [${d.muc}] ${d.thanh_phan} | DK: ${d.du_kien} | THỰC: ${d.thuc_te}${d.ghi_chu ? ` | ${d.ghi_chu}` : ''}`);
  const lech = chieu.filter((x) => x.muc !== 'khớp' && x.muc !== 'gần');
  console.log(`  → ${chieu.length} mục, lệch/thiếu/thừa: ${lech.length ? lech.map((x) => `${x.thanh_phan}(${x.muc})`).join(', ') : 'không'}`);
}
if (gia('json')) writeFileSync(gia('json')!, JSON.stringify(ra, null, 2));
process.exit(0);
