// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/poster.test.mts
import assert from 'node:assert';
import { tenPoster, anchorPoster, promptPoster } from './poster';

const nv = (id: number, loai: string, ten: string, anh: string[]) => ({ id, phim_id: 1, loai, ten, mo_ta: `${ten} desc`, anh_ref: anh, giong: '', giong_model: '', giong_id: '', giong_mau_url: null }) as never;
assert.strictEqual(tenPoster({ ten: 'Fox Tales (sáp màu trẻ con, tập 2 thử)' }), 'Fox Tales');
assert.strictEqual(tenPoster({ ten: 'Bản thử', kinh_thanh: { series: { ten: 'Zeus at Work', dong_co: 'x', khan_gia: '', dinh_dang: '', tap: [] } } as never }), 'Zeus at Work');
assert.strictEqual(tenPoster({ ten: 'Thỏ và Rùa' }), 'Thỏ và Rùa');
const ds = [nv(1, 'nhan_vat', 'Fox', ['a', 'b', 'c']), nv(2, 'nhan_vat', 'Crow', []), nv(3, 'boi_canh', 'Vineyard', ['v']), nv(4, 'boi_canh', 'Forest', ['f']), nv(5, 'nhan_vat', 'Mouse', ['m'])];
assert.deepStrictEqual(anchorPoster(ds).map((v) => (v as { ten: string }).ten), ['Fox', 'Mouse', 'Vineyard']);   // bỏ anchor chưa có ảnh, một bối cảnh
const k = promptPoster({ ten: 'Fox Tales (thử)', mo_ta: '', loai: 'phim', kinh_thanh: { phong_cach: 'wax crayon drawing; white subtitles overlaid' } as never }, ds, 'fox on a branch');
assert.deepStrictEqual(k.thamChieuUrl, ['a', 'b', 'm', 'v']);
assert.ok(k.prompt.includes('"Fox Tales"') && !k.prompt.includes('(thử)') && k.prompt.includes('fox on a branch') && k.prompt.includes('ONLY text'));
assert.ok(!/subtitles/.test(k.prompt), 'phong cách bỏ vế chữ/phụ đề');
const k2 = promptPoster({ ten: 'X', mo_ta: '', loai: 'phim' }, ds, '', 'doi_dau');
assert.ok(k2.prompt.includes('Face-off') && !k2.prompt.includes('director'));
console.log('poster.test: ok');
