// Tự kiểm san-pham-shot.ts: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/san-pham-shot.test.mts
import assert from 'node:assert';
import { loiSanPhamShot, nhacSanPham, tranhDayVao } from './san-pham-shot';
import { daDangMay } from './nhip-hinh';

const QUAN = { id: 249, loai: 'san_pham' as const, ten: 'JettJeans', mo_ta: "Men's stretch pants that look like smooth dress trousers cut from denim, belt loops, slash pockets" };
const NGUOI = { id: 250, loai: 'nhan_vat' as const, ten: 'Mike', mo_ta: 'American man, 64, wears a navy polo shirt with a collar' };
const nv = [QUAN, NGUOI];
const shot = (hd: string, kt: Record<string, string> = {}, gan = [249, 250]) => ({ nhan_vat: gan, hanh_dong: '', prompt_video: hd, ky_thuat: kt });

// Đúng ca #54 shot 9 (16/10/2026): chỉ tả mặt + push-in ở cỡ trung → hai lỗi.
const ca9 = loiSanPhamShot(shot('He smiles and gives a small confident nod, slow push-in', { co_canh: 'ms' }), nv);
assert.strictEqual(ca9.length, 2, `#54 shot 9 phải dính 2 lỗi: ${ca9.join(' | ')}`);
assert.match(ca9[0]!, /belt loops/, 'gợi ý theo loại quần');
// Ca #54 shot 8: "Small happy laugh" → thiếu sản phẩm; máy đẩy vào ở mcu → cắt quần.
assert.strictEqual(loiSanPhamShot(shot('Small happy laugh', { co_canh: 'mcu', chuyen_dong: 'day_vao' }), nv).length, 2);
// Sửa đúng: cử chỉ vào quần, máy đứng yên → đạt.
assert.deepStrictEqual(loiSanPhamShot(shot('He hooks his thumbs into the empty belt loops, gives the waistband a light tug, then smiles; fixed camera', { co_canh: 'ms' }), nv), []);
// Kéo cổ áo polo trong phim bán quần: "collar" không phải bộ phận của quần → vẫn lỗi (quần tả "dress trousers" không rơi sang loại áo / váy).
assert.strictEqual(loiSanPhamShot(shot('He tugs his polo collar and smiles'), nv).length, 1);
// Đặc tả sản phẩm (ecu) đẩy vào quần → được.
assert.deepStrictEqual(loiSanPhamShot(shot('Slow push-in on the pants pocket', { co_canh: 'ecu', chuyen_dong: 'day_vao' }), nv), []);
// Shot không gắn sản phẩm (cảnh "trước" mặc quần cũ) → không xét.
assert.deepStrictEqual(loiSanPhamShot(shot('He shifts uncomfortably', { co_canh: 'mcu', chuyen_dong: 'day_vao' }, [250]), nv), []);
// Sản phẩm không mặc trên người (chai) → không xét luật máy đẩy, nhưng vẫn đòi nhắc sản phẩm.
const CHAI = { id: 1, loai: 'san_pham' as const, ten: 'GlowSerum', mo_ta: 'amber glass dropper bottle' };
assert.deepStrictEqual(loiSanPhamShot({ nhan_vat: [1], hanh_dong: 'She drops the GlowSerum on her cheek, slow push-in', ky_thuat: { co_canh: 'ms' } }, [CHAI]), []);
assert.strictEqual(loiSanPhamShot({ nhan_vat: [1], hanh_dong: 'She smiles', ky_thuat: {} }, [CHAI]).length, 1);
// Ô template.
assert.ok(nhacSanPham('The person runs a hand over the {{san_pham}}', [{ ten: '{{san_pham}}', mo_ta: '{{san_pham_hinh}}' }]));
// Máy chọn chuyển động không chọn đẩy vào cho shot tranh_day.
assert.ok(tranhDayVao('mcu', [QUAN]) && !tranhDayVao('ecu', [QUAN]) && !tranhDayVao('mcu', [CHAI]));
const ds = [1, 2, 3].map((i) => ({ id: i, thu_tu: i, ky_thuat: { co_canh: 'mcu', chuyen_dong: 'tinh' }, tranh_day: true }));
for (const x of daDangMay(ds)) assert.notStrictEqual(x.ky_thuat.chuyen_dong, 'day_vao', 'shot sản phẩm mặc trên người không được chọn đẩy vào');
// Sản phẩm đổi trạng thái (giũ ra / mở gói / mặc vào) mà chưa có khung kết → chặn; có khung kết → qua (Jett #61 shot 9)
assert.ok(loiSanPhamShot(shot('The person unfolds the new pants, turns them over, skeptical', { co_canh: 'ws' }), nv).some((x) => x.includes('đổi trạng thái')));
assert.ok(loiSanPhamShot(shot('He opens the package and takes the pants out', { co_canh: 'ms' }), nv).some((x) => x.includes('đổi trạng thái')));
assert.ok(!loiSanPhamShot({ ...shot('The person unfolds the new pants', { co_canh: 'ws' }), keyframe_ket: 'k.jpg' }, nv).some((x) => x.includes('đổi trạng thái')));
assert.ok(!loiSanPhamShot(shot('He holds up the pants and turns them over, skeptical', { co_canh: 'ws' }), nv).some((x) => x.includes('đổi trạng thái')), 'giữ nguyên trạng thái → không chặn');
console.log('san-pham-shot: đạt');
