// SINH BỘ DÁNG cho một tài sản kho kênh lịch sử (02/11/2026, anh: "thư viện động tác, cử chỉ, khuôn mặt cho sinh động"). Chạy trên box3:
//   NODE_OPTIONS=--conditions=react-server tsx scripts/lich-su/kho-sinh.mts <thư-mục-ra> <url-ảnh-gốc> <dáng>[,<dáng>…]
//   … kho-sinh.mts <thư-mục-ra> "mota:<nhan_vat|phuong_tien>:<mô tả tiếng Anh>" <dáng,…|goc>   (chưa có ảnh gốc: vẽ goc.jpg theo kho.json › phong_cach
//   trước, đẩy tạm lên R2 làm tham chiếu, rồi mới sửa dáng — máy làm tập lam-tap.mjs gọi đường này cho tài sản mới)
// Mỗi dáng = SỬA từ ảnh gốc (giữ mặt, trang phục, nét vẽ, màu) qua cổng ảnh rẻ nhất (ckey Nano Banana 2 ~110₫), song song. Ra <dáng>.jpg nền trắng;
// iMac tách nền (shot-code/tach-lop.swift) rồi kho-day.mts đẩy lên R2 + Studio. Danh mục dáng: DANG bên dưới (thêm dáng = thêm một dòng).
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sinhAnhMotCong, chuoiAnh } from '../../src/lib/xuong-video/cong-ai';
import { uploadToR2 } from '../../src/lib/r2';

export const DANG: Record<string, string> = {
  chi_tay: 'pointing firmly with the right arm stretched out toward the right side of the picture, looking that way, determined face',
  khoanh_tay: 'arms crossed over the chest, chin slightly up, confident smirk',
  nam_dam: 'raising a clenched fist in the air, shouting with an angry face, mouth open',
  ngac_nhien: 'shocked: eyes wide, eyebrows up, mouth open in surprise, both hands raised near the face',
  cuoi: 'laughing heartily, eyes squeezed, mouth wide open, one hand on the belly',
  suy_nghi: 'thinking: one hand on the chin, eyes looking up and to the side, slight frown',
  noi_mo: 'talking to the viewer with an open-palm explaining gesture of the right hand, mouth OPEN mid-word',
  noi_dong: 'talking to the viewer with an open-palm explaining gesture of the right hand, mouth CLOSED between words (exactly the same pose as an open-mouth talking frame)',
  buon: 'sad and defeated: shoulders slumped, head down, eyes looking at the ground',
  // kênh Astrolas — thần thoại 12 cung (05/11/2026): dáng cho thú / sinh vật thần thoại + chỉ lên trời
  gam: 'the creature roaring fiercely toward the right side of the picture, mouth wide open, front paws planted',
  nam_guc: 'the creature lying defeated on the ground, eyes closed, body stretched out sideways',
  chi_len: 'pointing up to the sky with the right arm raised high, looking upward with awe',
  vung_chuy: 'swinging a heavy wooden club over the head with both hands, fierce determined face',
};
// tham số 4 (tuỳ chọn, 07/11/2026 anh: "Napoleon nhìn không giống"): URL chân dung lịch sử thật của nhân vật — ảnh gốc vẽ bám mặt người thật
const [ra, gocArg, ds, chanDung] = process.argv.slice(2);
if (!ra || !gocArg || !ds) { console.error('tsx kho-sinh.mts <ra> <url-gốc|mota:loai:mô tả> <dáng,…>'); process.exit(2); }
mkdirSync(ra, { recursive: true });
const c = chuoiAnh('nano-banana-2')[0]!; let tong = 0; let goc = gocArg;
if (gocArg.startsWith('mota:')) {
  const [, loai, ...m] = gocArg.split(':'); const moTa = m.join(':');
  // KHO_TEP: kho của kênh khác (vd Astrolas brand/astrolas/nhan-vat/kho.json) — mỗi kênh một phong cách vẽ; mặc định kho kênh lịch sử
  const pc = (JSON.parse(readFileSync(process.env.KHO_TEP ? process.env.KHO_TEP : new URL('./kho.json', import.meta.url), 'utf8')) as { phong_cach: string }).phong_cach;
  const prompt = loai === 'sinh_vat'
    ? `${pc.replace(/character/i, 'creature')}. Creature: ${moTa}. Standing side view facing RIGHT, whole body visible, centered, no people, no text, letters or logos.`
    : loai === 'phuong_tien'
    ? `${pc.replace(/character/i, 'object').replace(/full body, /, '')}. Object: ${moTa}. Clean side view facing RIGHT, whole object visible, centered, plain pure white background, no people, no ground shadow, no text, letters or logos.`
    : `${pc}. Character: ${moTa}.${chanDung ? ' Image 1 is a real historical portrait of this exact person: match his real face closely (face shape, nose, brow, hairline, hair, expression) so viewers recognise him instantly, but redraw him entirely in the art style above, full body in period clothes.' : ''} Standing in a neutral relaxed pose, body turned slightly toward the right side of the picture, centered, no text, letters or logos.`;
  let r = await sinhAnhMotCong(c.cong, c.model, { prompt, thamChieuUrl: chanDung ? [chanDung] : [], tiLe: loai === 'phuong_tien' || loai === 'sinh_vat' ? '3:2' : '2:3' });   // thú đứng nghiêng: khung ngang
  // THỬ LẠI ảnh gốc (07/11/2026: cổng trả 500 một lượt → cả vai hỏng, các dáng thì đã có thử lại)
  for (let lan = 2; !r.anh && lan <= 4; lan++) { console.log(`· goc: ${r.loi} — thử lại lần ${lan}`); await new Promise((o) => setTimeout(o, 6000 * lan)); r = await sinhAnhMotCong(c.cong, c.model, { prompt, thamChieuUrl: chanDung ? [chanDung] : [], tiLe: loai === 'phuong_tien' || loai === 'sinh_vat' ? '3:2' : '2:3' }); }
  if (!r.anh) { console.error(`✗ goc: ${r.loi}`); process.exit(1); }
  writeFileSync(join(ra, 'goc.jpg'), r.anh.data); tong += r.nguon.vnd || 0; console.log('✓ goc');
  goc = (await uploadToR2(`xuong-video/lich-su/tam/${Date.now()}-goc.jpg`, r.anh.data, 'image/jpeg'))!;
}
await Promise.all(ds.split(',').filter((d) => d !== 'goc').map(async (d) => {
  const mo = DANG[d]; if (!mo) { console.log(`✗ ${d}: không có trong danh mục dáng`); return; }
  const prompt = `Edit Image 1: keep EXACTLY the same character — same face, hair, age, outfit, accessories, art style, line work, colours and proportions. Change only the pose and expression: ${mo}. Full body, centered, on a plain pure white background, no ground shadow, no text, letters or logos.`;
  // THỬ LẠI dáng hỏng (04/11/2026: lam-tap sinh 3 nhân vật song song = ~27 lượt cổng ảnh cùng lúc → vài dáng TimeoutError, nhân vật thiếu dáng vĩnh viễn trong kho)
  let r = await sinhAnhMotCong(c.cong, c.model, { prompt, thamChieuUrl: [goc], tiLe: '2:3' });
  for (let lan = 2; !r.anh && lan <= 3; lan++) { console.log(`· ${d}: ${r.loi} — thử lại lần ${lan}`); await new Promise((o) => setTimeout(o, 5000 * lan)); r = await sinhAnhMotCong(c.cong, c.model, { prompt, thamChieuUrl: [goc], tiLe: '2:3' }); }
  if (!r.anh) { console.log(`✗ ${d}: ${r.loi}`); return; }
  writeFileSync(join(ra, `${d}.jpg`), r.anh.data); tong += r.nguon.vnd || 0; console.log(`✓ ${d}`);
}));
console.log(`tiền thật ~${Math.round(tong)}₫`);
