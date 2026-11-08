// ẢNH DẠNG PO BẰNG API ẢNH AI, NGƯỜI THẬT THEO ẢNH THAM CHIẾU (anh 08/11/2026: "dùng API ảnh AI sinh … Dùng idea từ git rồi gửi cho nó bố cục mới để nó sinh
// cho chuẩn. Sau đó ghép tên phim theo format poster gốc vào là đc"; trước đó: "Người ko giống thì vi phạm").
// Chạy trên box3 (khoá CKEY_API_KEY + R2 ở .env.production, không ra khỏi máy chủ):
//   set -a; . /opt/earns-marketing-os-v2/.env.production; set +a
//   NODE_OPTIONS=--conditions=react-server tsx apps/xuong-video/scripts/ethopex/anh-po-ai.mts <thư mục vào> <bố cục> "<thể loại>" <tệp ra.jpg>
// <thư mục vào>: ảnh tham chiếu ref-*.jpg (poster chính thức + khung phim đã xoá phụ đề — iMac chuẩn bị, ve-po-ai.py) → đẩy lên R2 lấy URL cho cổng ảnh.
// Ảnh ra KHÔNG có chữ; tên phim ghép sau trên iMac bằng chữ tách từ poster gốc (đúng kiểu chữ + vị trí như poster gốc). Giá ~110₫ / ảnh (ckey nano-banana).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { sinhAnhMotCong, chuoiAnh } from '../../src/lib/xuong-video/cong-ai';
import { uploadToR2 } from '../../src/lib/r2';

// BỐ CỤC — ý từ PosterCraft / PosterVerse (nhóm bố cục poster phim) + bảng Pinterest anh gửi; mỗi bố cục là lời dặn sắp xếp cho mô hình ảnh
const BO_CUC: Record<string, string> = {
  chan_dung: 'a huge dramatic close-up of the lead character filling the upper two thirds, the other characters smaller and lower, strong rim light, shallow depth of field',
  tang_lop: 'an ensemble key-art pyramid: the lead character largest at the top center, supporting characters layered below on both sides, a key location of the story behind them',
  doi_dau: 'a face-off split composition: two main characters on opposite sides facing each other with tension, a contrasting light on each side, a dramatic gap in the middle',
  hai_lop: 'a double exposure: the lead character in profile, the silhouette filled with a key scene from the story, the other characters small at the bottom',
  hanh_dong: 'a dynamic low-angle hero shot of the lead character in a strong pose, motion, debris and light streaks, supporting characters in the background',
};

const [vao, boCuc, giong, ra] = process.argv.slice(2);
if (!vao || !BO_CUC[boCuc] || !ra) { console.error(`tsx anh-po-ai.mts <thư mục vào> <${Object.keys(BO_CUC).join('|')}> "<thể loại>" <ra.jpg>`); process.exit(2); }
const ten = readdirSync(vao).filter((f) => /^ref-.*\.(jpe?g|png)$/i.test(f)).sort().slice(0, 3);   // ckey nhận tối đa 3 ảnh tham chiếu (cong-ai TOI_DA_REF)
if (!ten.length) { console.error(`không có ref-*.jpg trong ${vao}`); process.exit(2); }
const url: string[] = [];
for (const f of ten) {
  const u = await uploadToR2(`po-ai/${basename(vao)}/${f}`, readFileSync(join(vao, f)), f.endsWith('png') ? 'image/png' : 'image/jpeg');
  if (!u) { console.error(`✗ không đẩy được ${f} lên R2`); process.exit(1); }
  url.push(u);
}
const prompt = [
  `Create a brand-new vertical 9:16 movie poster key art for a short drama (${giong || 'drama'}).`,
  `Layout: ${BO_CUC[boCuc]}.`,
  'Use EXACTLY the same people as in the reference images: identical faces, hair, skin tone, age and clothing — do not invent any new main character and do not change who they are.',
  'Professional Hollywood poster quality: cinematic lighting, color grading that fits the genre, rich detailed background from the story world.',
  'Absolutely NO text, NO letters, NO title, NO logo, NO watermark anywhere. Keep the bottom 24% of the image darker and free of faces so a title can be placed there.',
].join(' ');
const ds = chuoiAnh('nano-banana-pro'), c = ds.find((x) => /pro/i.test(x.model)) ?? ds[0]!;   // bản pro giữ mặt tốt hơn, cùng giá ckey 110₫
const r = await sinhAnhMotCong(c.cong, c.model, { prompt, thamChieuUrl: url, tiLe: '9:16' });
if (!r.anh) { console.error(`✗ ${r.loi}`); process.exit(1); }
writeFileSync(ra, Buffer.from(r.anh.data));
console.log(JSON.stringify({ ok: true, ra, vnd: Math.round(r.nguon.vnd || 0), model: r.nguon.model_that || r.nguon.model, giay: Math.round(r.nguon.giay || 0) }));
