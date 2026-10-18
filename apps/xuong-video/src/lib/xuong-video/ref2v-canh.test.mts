// Tự kiểm ref2v-canh.ts: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/ref2v-canh.test.mts
import assert from 'node:assert';
import { dungRef2v, GIA_REF2V } from './ref2v-canh';

const nv = (id: number, ten: string, loai: string, anh: string[]) => ({ id, ten, loai, anh_ref: anh }) as never;
const sh = (id: number, phat: number, ids: number[], dd: Record<string, string> = {}) => ({ id, thu_tu: id, phan_doan: 'A', nhan_vat: ids, phat_s: phat, thoi_luong_s: 8, hanh_dong: `hd ${id}`, prompt_video: '', ky_thuat: {}, dan_dung: dd }) as never;
const NV = [nv(1, 'Lâm Hạ', 'nhan_vat', ['h1', 'h2', 'h3']), nv(2, 'Vivian', 'nhan_vat', ['v1']), nv(3, 'Văn phòng', 'boi_canh', ['p1']), nv(4, 'Ly cà phê', 'dao_cu', ['c1']), nv(5, 'Hạ phụ', 'dao_cu', ['x'])];

const g = dungRef2v([sh(1, 3, [1, 2, 3, 4], { bo_cuc: 'Vivian blocks Lâm Hạ', dien: 'flicks the {Ly cà phê}' }), sh(2, 4.4, [1, 3]), sh(3, 5, [2, 3]), sh(4, 6, [1])], NV, { tiLe: '9:16' });
// 3 + 4 + 5 = 12; shot 4 (6s) vượt 15 → bỏ
assert.strictEqual(g.giay, 12); assert.deepStrictEqual(g.bo, ['#4']);
assert.strictEqual(g.cents, Math.round(12 * GIA_REF2V.khong_tieng * 10) / 10);
// tham chiếu: 2 người làm element (ảnh chính diện + ảnh phụ; một ảnh thì dùng lại), bối cảnh + đồ làm ảnh; tối đa 4
assert.deepStrictEqual(g.tham_chieu.map((t) => `${t.ma}=${t.ten}`), ['@Element1=Lâm Hạ', '@Element2=Vivian', '@Image1=Văn phòng', '@Image2=Ly cà phê']);
const el = g.input.elements as { frontal_image_url: string; reference_image_urls: string[] }[];
assert.deepStrictEqual(el[1], { frontal_image_url: 'v1', reference_image_urls: ['v1'] });
// tên trong prompt → mã; {Tên} cũng đổi
assert.ok(g.shots[0]!.prompt.startsWith('flicks the @Image2') && g.shots[0]!.prompt.includes('@Element2 blocks @Element1'), g.shots[0]!.prompt);   // diễn trước, bố cục sau
// đầu vào đúng khuôn model: multi_prompt có số giây từng shot, tổng duration, khung dọc, không tiếng
const mp = g.input.multi_prompt as { duration: string }[];
assert.deepStrictEqual(mp.map((x) => x.duration), ['3', '4', '5']); assert.strictEqual(g.input.duration, '12'); assert.strictEqual(g.input.aspect_ratio, '9:16'); assert.strictEqual(g.input.generate_audio, false);
// thiếu ảnh mẫu / quá ngắn → báo lỗi, không im lặng
assert.ok(dungRef2v([sh(9, 2, [6])], [...NV, nv(6, 'Trần', 'nhan_vat', [])], { tiLe: '9:16' }).loi.some((l) => l.includes('Trần')));
assert.ok(dungRef2v([], NV, { tiLe: '16:9' }).loi.length >= 1);
// (soát ngăn thật 19/10): tên gọi "Hạ" cũng thành mã; ảnh sát mặt làm ảnh chính diện; bối cảnh 3D không ảnh mẫu → lấy keyframe đầu của cảnh
{
  const ha = { id: 1, ten: 'Lâm Hạ', loai: 'nhan_vat', anh_ref: ['sheet'], anh_mat: { tu: 'sheet', url: ['mat1'] } } as never;
  const vp = { id: 3, ten: 'Văn phòng', loai: 'boi_canh', anh_ref: [] } as never;
  const s1 = { ...(sh(1, 4, [1, 3], { bo_cuc: 'Hạ walks; Hạ’s blouse. Hạnh is someone else.' }) as object), keyframe_url: 'kf1' } as never;
  const r = dungRef2v([s1], [ha, vp], { tiLe: '9:16' });
  assert.deepStrictEqual(r.loi, [], 'bối cảnh có keyframe thì không báo thiếu ảnh');
  assert.ok(r.shots[0]!.prompt.includes('@Element1 walks; @Element1’s blouse. Hạnh'), r.shots[0]!.prompt);
  assert.deepStrictEqual((r.input.elements as { frontal_image_url: string; reference_image_urls: string[] }[])[0], { frontal_image_url: 'mat1', reference_image_urls: ['sheet'] });
  assert.deepStrictEqual(r.input.image_urls, ['kf1']);
}
// GIỚI HẠN 512 KÝ TỰ MỖI PROMPT SHOT (422 của fal, job #3088): thẻ shot dài như cảnh 1 tổng tài → mọi prompt gửi đi ≤ 512, cắt theo câu, diễn còn nguyên
{
  const { gonPrompt, TOI_DA_PROMPT } = await import('./ref2v-canh');
  const dai = 'Anticipation: Vivian plants herself in Hạ path, the cup raised high above the aisle. Action: a sharp flick of the wrist, coffee arcs onto the chest. Reaction: Hạ freezes, breath caught, eyes drop to the stain.';
  const bc = 'Wide in the aisle of the open-plan office, then a crash zoom onto the two women at the splash, rows of desks and coworkers behind, window light from the left. '.repeat(3);
  const r = dungRef2v([sh(1, 3, [1, 2], { dien: dai, bo_cuc: bc, mo: 'x '.repeat(200), ket: 'y' }), sh(2, 3, [1], { dien: 'z '.repeat(400) })], NV, { tiLe: '9:16' });
  for (const m of r.input.multi_prompt as { prompt: string }[]) assert.ok(m.prompt.length <= TOI_DA_PROMPT, `prompt ${m.prompt.length} ký tự`);
  assert.ok(r.shots[0]!.prompt.startsWith('Anticipation: @Element2'), 'diễn nguyên câu đứng đầu');
  assert.ok(!r.shots[0]!.prompt.includes('From:'), 'mở/kết quá dài thì bỏ nguyên phần');
  assert.ok(r.shots[1]!.prompt.length > 100, 'phần đầu quá dài vẫn có nội dung (cắt ở ranh giới từ)');
  assert.strictEqual(gonPrompt(['Một câu. Hai câu dài hơn nhiều lắm.'], 9), 'Một câu.');
  assert.ok(!(r.input.multi_prompt as { prompt: string }[])[0]!.prompt.includes('Sound:'), 'không sinh tiếng thì bỏ Sound:');
}
console.log('✓ ref2v-canh');
