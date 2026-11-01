// SINH BỘ DÁNG cho một tài sản kho kênh lịch sử (02/11/2026, anh: "thư viện động tác, cử chỉ, khuôn mặt cho sinh động"). Chạy trên box3:
//   NODE_OPTIONS=--conditions=react-server tsx scripts/lich-su/kho-sinh.mts <thư-mục-ra> <url-ảnh-gốc> <dáng>[,<dáng>…]
// Mỗi dáng = SỬA từ ảnh gốc (giữ mặt, trang phục, nét vẽ, màu) qua cổng ảnh rẻ nhất (ckey Nano Banana 2 ~110₫), song song. Ra <dáng>.jpg nền trắng;
// iMac tách nền (shot-code/tach-lop.swift) rồi kho-day.mts đẩy lên R2 + Studio. Danh mục dáng: DANG bên dưới (thêm dáng = thêm một dòng).
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { sinhAnhMotCong, chuoiAnh } from '../../src/lib/xuong-video/cong-ai';

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
};
const [ra, goc, ds] = process.argv.slice(2);
if (!ra || !goc || !ds) { console.error('tsx kho-sinh.mts <ra> <url-gốc> <dáng,…>'); process.exit(2); }
mkdirSync(ra, { recursive: true });
const c = chuoiAnh('nano-banana-2')[0]!; let tong = 0;
await Promise.all(ds.split(',').map(async (d) => {
  const mo = DANG[d]; if (!mo) { console.log(`✗ ${d}: không có trong danh mục dáng`); return; }
  const prompt = `Edit Image 1: keep EXACTLY the same character — same face, hair, age, outfit, accessories, art style, line work, colours and proportions. Change only the pose and expression: ${mo}. Full body, centered, on a plain pure white background, no ground shadow, no text, letters or logos.`;
  const r = await sinhAnhMotCong(c.cong, c.model, { prompt, thamChieuUrl: [goc], tiLe: '2:3' });
  if (!r.anh) { console.log(`✗ ${d}: ${r.loi}`); return; }
  writeFileSync(join(ra, `${d}.jpg`), r.anh.data); tong += r.nguon.vnd || 0; console.log(`✓ ${d}`);
}));
console.log(`tiền thật ~${Math.round(tong)}₫`);
