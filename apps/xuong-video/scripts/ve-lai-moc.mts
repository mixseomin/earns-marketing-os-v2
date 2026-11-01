// VẼ LẠI ẢNH MỐC giấy cắt (giay-cat/ → --moc) thành khung hoạt hình hoàn chỉnh, GIỮ NGUYÊN chỗ / cỡ / dáng của mọi thứ (vật lý đã đúng trong bản giấy cắt).
// Mọi mốc: tham chiếu = ảnh mẫu nhân vật (đúng màu áo, nét mặt). KHÔNG lấy mốc đã vẽ lại làm chuẩn cho mốc sau: thử 02/11/2026 mô hình chép luôn bố cục mốc
// chuẩn (ghế đang bay biến mất, bà về chỗ cũ) — giữ bố cục là việc của ảnh giấy cắt (Image 1).
// Kết quả nối bằng VideoExpress khung đầu → cuối (vx-noi-moc.mts). Tốn 1 ảnh / mốc (~65₫).
// Chạy trên box3: DUYET_SINH_1_LAN=1 NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/ve-lai-moc.mts --phim=1156 --ref=736,806 --moc=/tmp/a.png,/tmp/b.png [--ten=gag4]
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { uploadToR2 } from '../src/lib/r2';
import { sinhAnhQuaCong, sinhAnhMotCong, tachKhoa } from '../src/lib/xuong-video/cong-ai';
import { docKinhThanh, phongCachHinh, type KinhThanh } from '../src/lib/xuong-video/kieu';

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? '';
const phimId = Number(arg('phim')), refIds = arg('ref').split(',').map(Number).filter(Boolean), moc = arg('moc').split(',').filter(Boolean), ten = arg('ten') || 'moc';
if (!phimId || !moc.length) { console.error('thiếu --phim --moc'); process.exit(1); }
if (process.env.DUYET_SINH_1_LAN !== '1') { console.error(`tốn tiền (~${moc.length * 65}₫): chạy kèm DUYET_SINH_1_LAN=1 ngay sau khi anh bảo`); process.exit(1); }
const db = getDb();
const kt = docKinhThanh(((await db.execute(sql`SELECT kinh_thanh FROM xv_phim WHERE id = ${phimId}`)) as unknown as { kinh_thanh: KinhThanh }[])[0]!.kinh_thanh);
const nv = refIds.length ? ((await db.execute(sql`SELECT id, mo_ta, anh_ref->>0 AS u FROM xv_nhan_vat WHERE id IN (${sql.raw(refIds.join(','))})`)) as unknown as { id: number; mo_ta: string; u: string | null }[])
  .sort((a, b) => refIds.indexOf(a.id) - refIds.indexOf(b.id)) : [];
const style = phongCachHinh(kt.phong_cach).replace(/[.\s]+$/, '');
// --them='…': câu khoá riêng cho mốc khó (vd thứ tự trước sau khi tàu che người)
const them = arg('them');
const giu0 = 'Keep EXACTLY the same composition as Image 1: every character, prop and the background stay in the same place, size, pose, direction and timing of the action; the background is unchanged; add nothing, remove nothing, no text.';
const giu = them ? `${giu0} ${them}` : giu0;
const ra: string[] = [];
for (const [i, f] of moc.entries()) {
  const vao = await uploadToR2(`xuong-video/giay-cat/${phimId}-${ten}-vao-${i}-${randomUUID().slice(0, 6)}.png`, readFileSync(f), 'image/png');
  // --mot-anh: chỉ đưa ảnh giấy cắt (nhân vật tả bằng chữ) — nhiều ảnh mẫu kèm theo thì mô hình vẽ cảnh mới từ ảnh mẫu, bỏ bố cục Image 1 (thử 02/11/2026: 3/4 mốc hỏng)
  const motAnh = process.argv.includes('--mot-anh');
  const refs = motAnh ? [vao!] : [vao!, ...nv.map((v) => v.u).filter((u): u is string => !!u)].slice(0, 3);
  const ve = `EDIT Image 1, a rough paper cut-out animation frame, into a finished frame of hand-drawn 2D animation. Visual style: ${style}. Redraw the characters as real drawn animation, not paper pieces: connected arms, legs, hands and clothes with natural drawn poses and expressions. ${nv.map((v, k) => motAnh ? `${v.mo_ta.split(/(?<=\.)\s/)[0]}` : `The character matching Image ${k + 2}: ${v.mo_ta.split(/(?<=\.)\s/)[0]}`).join(' ')} ${giu}`;
  // --nguon=ckey:<người bán>/<model>: chạy đúng một nguồn (so người bán) — mặc định theo chuỗi cổng của phim
  const nguon = arg('nguon'); const kh = nguon ? tachKhoa(nguon) : null;
  const k = kh?.kieu === 'cong' ? await sinhAnhMotCong(kh.cong, kh.model, { prompt: ve, thamChieuUrl: refs, tiLe: '16:9' }) : await sinhAnhQuaCong(kt.mo_hinh_anh, { prompt: ve, thamChieuUrl: refs, tiLe: '16:9' });
  if (!k.anh) { console.error(`mốc ${i}: hỏng`, k.thu); process.exit(1); }
  const u = await uploadToR2(`xuong-video/giay-cat/${phimId}-${ten}-ve-${i}-${randomUUID().slice(0, 6)}.png`, k.anh.data, k.anh.mimeType);
  ra.push(u!); console.log(`mốc ${i}: ${u} · ${k.nguon?.nguoi_ban ?? k.nguon?.cong ?? '?'} · ${k.nguon?.vnd ?? '?'}₫`);
}
process.exit(0);
