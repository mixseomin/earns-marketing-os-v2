// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/anh-qc.test.mts
import assert from 'node:assert';
import { KHUON_ANH_QC, khuonAnhQc, promptAnhQc, sanPhamAnhQc } from './anh-qc';

const nv = (id: number, loai: string, ten: string, anh: string[]) => ({ id, phim_id: 1, loai, ten, mo_ta: `${ten} desc`, anh_ref: anh, giong: '', giong_model: '', giong_id: '', giong_mau_url: null }) as never;
const ds = [nv(1, 'nhan_vat', 'Old man', ['o']), nv(2, 'san_pham', 'Jeans', ['j1', 'j2', 'j3', 'j4', 'j5']), nv(3, 'san_pham', 'Empty', [])];
assert.deepStrictEqual(sanPhamAnhQc(ds).map((x) => x.anh), [['j1', 'j2', 'j3', 'j4']]);   // chỉ sản phẩm có ảnh, ≤ 4 ảnh

// Bản đồ ảnh khớp đúng mảng tham chiếu: mẫu = 1, logo = 2, sản phẩm = 3–6
const k = promptAnhQc({ mau_url: 'M', chu: 'ANTI-SAG JEANS\n\n Made for Men 50+ ', y_tuong: 'autumn', ti_le: '4:5' }, { tenSp: 'Jett', logoUrl: 'L', nv: ds });
assert.deepStrictEqual(k.thamChieuUrl, ['M', 'L', 'j1', 'j2', 'j3', 'j4']);
assert.ok(k.prompt.includes('image 1 = the WINNING REFERENCE AD') && k.prompt.includes('image 2 = the brand logo') && k.prompt.includes('images 3–6 = the REAL product "Jeans"'));
assert.ok(k.prompt.includes('"ANTI-SAG JEANS" | "Made for Men 50+"') && k.prompt.includes('autumn') && k.prompt.includes('4:5'));

// Chữ trống = giữ nguyên văn chữ của mẫu; không mẫu thì không nói "image 1"
const k2 = promptAnhQc({ mau_url: 'M', chu: '  ', y_tuong: '', ti_le: '1:1' }, { tenSp: 'X', nv: [] });
assert.ok(k2.prompt.includes('word for word') && !k2.prompt.includes('brand logo'));
const k3 = promptAnhQc({ mau_url: '', chu: 'A', y_tuong: '', ti_le: '4:5' }, { tenSp: 'X', nv: ds });
assert.deepStrictEqual(k3.thamChieuUrl, ['j1', 'j2', 'j3', 'j4']);
assert.ok(!k3.prompt.includes('Recreate image 1') && k3.prompt.includes('images 1–4 = the REAL product'));

// Khuôn: khoá không trùng, có ảnh mẫu R2 + chữ
assert.strictEqual(new Set(KHUON_ANH_QC.map((x) => x.key)).size, KHUON_ANH_QC.length);
for (const x of KHUON_ANH_QC) assert.ok(x.mau_url.startsWith('https://img.on.tc/') && x.chu.length > 2, x.key);
assert.strictEqual(khuonAnhQc('qua_tang')?.ten, 'Contour · quà tặng');
console.log('anh-qc ok');
