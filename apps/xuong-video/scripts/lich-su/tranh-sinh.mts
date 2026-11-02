// SINH TRANH CẢNH ĐẦY KHUNG cho kênh lịch sử (02/11/2026, anh gửi mẫu cảnh minh hoạ điện ảnh: "kiểu này đan xen vào được không"). Chạy trên box3:
//   NODE_OPTIONS=--conditions=react-server tsx scripts/lich-su/tranh-sinh.mts [--phong "<nét vẽ, en>"] <tệp-ra.jpg> "<mô tả cảnh, en>" [<url ảnh tham chiếu nhân vật> …]
// Cùng nét vẽ với kho nhân vật (kho.json › phong_cach) + ánh sáng điện ảnh; có tham chiếu thì giữ đúng mặt / trang phục nhân vật kho. ~110₫ (ckey).
import { writeFileSync, readFileSync } from 'node:fs';
import { sinhAnhMotCong, chuoiAnh } from '../../src/lib/xuong-video/cong-ai';
import sharp from 'sharp';

// --phong "<nét vẽ, en>" (03/11/2026, kênh Astrolas): mỗi kênh / playlist khai nét vẽ riêng; bỏ trống = nét kho kênh lịch sử (kho.json › phong_cach) như cũ.
const thamSo = process.argv.slice(2), iP = thamSo.indexOf('--phong'), phong = iP >= 0 ? thamSo.splice(iP, 2)[1] : null;
// --cat <tệp.jpg>: chỉ cắt viền một tranh đã có (0đ, không gọi AI) — sửa tranh cũ vẽ trước khi có bước cắt viền
const iC = thamSo.indexOf('--cat');
if (iC >= 0) { const f = thamSo[iC + 1]; writeFileSync(f, await catVien(readFileSync(f))); console.log(`✓ cắt viền ${f} 0₫`); process.exit(0); }
const [ra, moTa, ...ref] = thamSo;
if (!ra || !moTa) { console.error('tsx tranh-sinh.mts [--phong "<nét vẽ>"] <ra.jpg> "<mô tả>" [ref…]'); process.exit(2); }
const pc = phong ?? (JSON.parse(readFileSync(new URL('./kho.json', import.meta.url), 'utf8')).phong_cach as string);
const prompt = `Vertical 9:16 cinematic illustration for a ${phong ? 'documentary' : 'history documentary'}. Art style: ${pc.replace(/, full body, plain white background/, '')}; dramatic cinematic lighting with warm rim light and volumetric light rays, rich detailed background, strong depth with a clear foreground subject, mid-ground and background. ${ref.length ? 'The character(s) in the reference image(s) must keep exactly the same face, hair and outfit. ' : ''}Scene: ${moTa}. Full-bleed artwork filling the entire frame edge to edge: no border, no frame, no paper margin, no vignette edge. Leave the lower fifth of the frame calm (space for subtitles). No text, letters, numbers, signs or logos anywhere.`;
const c = chuoiAnh('nano-banana-2')[0]!;
const r = await sinhAnhMotCong(c.cong, c.model, { prompt, thamChieuUrl: ref, tiLe: '9:16' });
if (!r.anh) { console.error(`✗ ${r.loi}`); process.exit(1); }
// CẮT VIỀN: nét khắc / màu nước hay tự vẽ mép giấy quanh tranh dù lời nhắc cấm → cắt dải đồng màu ở mép (theo màu góc trái trên) rồi cắt đầy lại khung 9:16.
// Không có viền thì trim không đổi gì; viền chiếm quá 15% cạnh thì coi là trim nhầm (nền tranh đồng màu) và giữ ảnh gốc.
async function catVien(buf: Buffer): Promise<Buffer> {
  const goc = await sharp(buf).metadata(), { data, info } = await sharp(buf).trim({ threshold: 28 }).toBuffer({ resolveWithObject: true });
  if (!goc.width || !goc.height || info.width < goc.width * 0.85 || info.height < goc.height * 0.85 || (info.width === goc.width && info.height === goc.height)) return buf;
  const vao = Math.round(Math.max(info.width, info.height) * 0.01);   // ăn thêm 1% để chắc mất hẳn nét mép
  return sharp(data).extract({ left: vao, top: vao, width: info.width - 2 * vao, height: info.height - 2 * vao }).resize(goc.width, goc.height, { fit: 'cover' }).jpeg({ quality: 92 }).toBuffer();
}
writeFileSync(ra, await catVien(Buffer.from(r.anh.data))); console.log(`✓ ${ra} ~${Math.round(r.nguon.vnd || 0)}₫`);
