// 🔁 VÒNG TỰ-SỬA KHUNG (B6, anh 30/10/2026: SỬA TỪ PROMPT NGUỒN, không vá ảnh): đọc LỆCH của canh → dịch thành khối "ĐIỂM BẮT BUỘC ĐÚNG"
// (sietTuLech, $0) NỐI vào prompt nguồn keyframe (chuanBiKeyframe: có ảnh mẫu trang phục urlRef) → SINH LẠI cả khung → bóc+đối chiếu lại (--kiem).
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server \
//     ../../node_modules/.bin/tsx scripts/vong-sua.mts --canh=1824 [--luc=dau|cuoi] [--ghi]
import { writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { mapCanh, mapNhanVat, kemBienThe, type Row } from '../src/lib/xuong-video/doc-db';
import { bocTachKhung } from '../src/lib/xuong-video/boc-tach-khung';
import { thanhPhanDuKien, doiChieuKhung, apDungSoBang, sietTuLech } from '../src/lib/xuong-video/doi-chieu-khung';
import { lyChanKeyframe, chuanBiKeyframe } from '../src/lib/xuong-video/sinh-anh';
import { sinhAnhQuaCong, taNguon } from '../src/lib/xuong-video/cong-ai';
import { uploadToR2 } from '../src/lib/r2';
import { khongGianTap } from './phieu-shot.mts';
import type { BocTachKhung, DongDoiChieu } from '../src/lib/xuong-video/kieu';

const gia = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const canhId = Number(gia('canh') || 0);
const luc = (gia('luc') || 'dau') as 'dau' | 'cuoi';
const ghi = process.argv.includes('--ghi');
if (!canhId) { console.error('cần --canh=<id>'); process.exit(1); }
const db = getDb()!;

const row = ((await db.execute(sql`SELECT c.*, t.phim_id FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id WHERE c.id = ${canhId}`)) as unknown as Row[])[0];
if (!row) { console.error(`không thấy canh ${canhId}`); process.exit(1); }
const c = mapCanh(row); const phimId = Number(row.phim_id);
const nhanVat = await kemBienThe(db, ((await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${phimId} ORDER BY id`)) as unknown as Row[]).map(mapNhanVat));
const kgt = await khongGianTap(c.tap_id, c.phan_doan ?? '').catch(() => null);
const kg = kgt;
const baseUrl = luc === 'cuoi' ? c.keyframe_ket : c.keyframe_url;
if (!baseUrl) { console.error(`canh ${canhId} chưa có keyframe ${luc}`); process.exit(1); }

const lo = (ch: DongDoiChieu[] | null | undefined) => (ch ?? []).filter((x) => x.muc !== 'khớp' && x.muc !== 'gần');
const inLo = (ch: DongDoiChieu[] | null | undefined) => lo(ch).map((x) => `${x.thanh_phan}(${x.muc})`).join(', ') || 'không';

// 1) LỆCH TRƯỚC: dùng bản đã lưu nếu có, không thì bóc+đối chiếu ảnh hiện tại
let truoc = c.boc_tach?.doi_chieu?.[luc] ?? null;
if (!truoc) {
  const rb = await bocTachKhung(db, phimId, baseUrl, nhanVat.filter((v) => v.loai === 'nhan_vat').map((v) => v.ten));
  if (!rb) { console.error('bóc ảnh hiện tại hỏng'); process.exit(1); }
  const d0 = await doiChieuKhung(db, phimId, thanhPhanDuKien(c, nhanVat, kg, luc), rb as BocTachKhung);
  truoc = d0 ? apDungSoBang(d0, c, nhanVat, kg, luc, rb as BocTachKhung) : null;
}
console.log(`\n=== #${canhId} · khung ${luc.toUpperCase()} ===`);
console.log(`LỖI TRƯỚC (${lo(truoc).length}): ${inLo(truoc)}`);

// 2) PROMPT NGUỒN của keyframe (chuanBiKeyframe: mô tả cảnh + ảnh mẫu trang phục urlRef) + SIẾT từ lệch
const g = await lyChanKeyframe(db, canhId, true);
if (!g) { console.error('không dựng được bối cảnh cảnh'); process.exit(1); }
const { prompt: promptNguon, urlRef } = chuanBiKeyframe(g.bc);
const siet = sietTuLech(truoc ?? []);
if (!siet) { console.log('không có lệch để sửa — dừng'); process.exit(0); }
const prompt = `${promptNguon}\n${siet}`;
console.log(`\n--- SIẾT NỐI VÀO PROMPT NGUỒN ---${siet}\n--- (prompt nguồn ${promptNguon.length} ký tự + ${urlRef.length} ảnh mẫu) ---\n`);

// 3) SINH LẠI CẢ KHUNG từ prompt nguồn đã siết + ảnh mẫu (giữ trang phục/danh tính)
const a = await sinhAnhQuaCong('nano-banana-2', { prompt, thamChieuUrl: urlRef, tiLe: g.bc.kt.ti_le });
if (!a.anh) { console.error(`sinh lại hỏng: ${a.thu?.map((x) => x.loi).join(' | ') ?? '?'}`); process.exit(1); }
const key = `xuong-video/vong-sua/${canhId}-${luc}-${randomUUID()}.png`;
const url = await uploadToR2(key, a.anh.data, a.anh.mimeType);
writeFileSync(`/tmp/vongsua-${canhId}-${luc}.png`, a.anh.data);
console.log(`✓ ảnh sửa: ${taNguon(a.nguon)} · ${url ?? '(R2 hỏng)'} · /tmp/vongsua-${canhId}-${luc}.png`);

// 4) BÓC + ĐỐI CHIẾU LẠI ảnh mới — TUỲ CHỌN (tốn thêm ~2¢). Mặc định chỉ sửa + để anh nhìn mắt.
if (process.argv.includes('--kiem')) {
  const r2 = await bocTachKhung(db, phimId, url ?? baseUrl, nhanVat.filter((v) => v.loai === 'nhan_vat').map((v) => v.ten));
  if (!r2) { console.error('bóc ảnh mới hỏng'); process.exit(1); }
  const d1 = await doiChieuKhung(db, phimId, thanhPhanDuKien(c, nhanVat, kg, luc), r2 as BocTachKhung);
  const sau = d1 ? apDungSoBang(d1, c, nhanVat, kg, luc, r2 as BocTachKhung) : null;
  console.log(`\nLỖI SAU  (${lo(sau).length}): ${inLo(sau)}`);
  console.log(`\n→ ${lo(truoc).length} → ${lo(sau).length} lỗi` + (ghi ? '' : ' (test, chưa ghi keyframe — thêm --ghi để thay)'));
}

if (ghi && url) {
  const col = luc === 'cuoi' ? 'keyframe_ket' : 'keyframe_url';
  await db.execute(sql`UPDATE xv_canh SET ${sql.raw(col)} = ${url} WHERE id = ${canhId}`);
  console.log(`✓ đã ghi ${col} = ${url}`);
}
process.exit(0);
