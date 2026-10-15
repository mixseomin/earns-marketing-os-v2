// node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/tham-khao.test.mts
import assert from 'node:assert';
import { cauCuaShot, cauThieuNguon, chanThamKhao, thamKhaoSauDien, type NguonThamKhao } from './tham-khao';

const K: NguonThamKhao = { loai: 'loi_khach', nguon: 'amazon', trich: 'I wear 2x tops. It fits perfectly.' };
const Q: NguonThamKhao = { loai: 'qc_thang', nguon: 'qc_meta', trich: 'Click to stand taller (literally)', ghi: 'Shapecurve · x20' };

// chữ màn trùng lời → một câu
assert.deepStrictEqual(cauCuaShot({ chu_man: 'No lines.', thoai: [{ loi: 'no lines' }, { loi: '' }] }), ['No lines.']);
// không nguồn → thiếu; có nguồn (khác dấu câu / hoa thường) → đủ
assert.deepStrictEqual(cauThieuNguon({ chu_man: 'No lines.' }), ['No lines.']);
assert.deepStrictEqual(cauThieuNguon({ chu_man: 'No lines.', tham_khao: [{ cau: 'no lines', nguon: [K] }] }), []);
// sửa câu → mất nguồn
assert.deepStrictEqual(cauThieuNguon({ chu_man: 'Zero lines.', tham_khao: [{ cau: 'No lines.', nguon: [K] }] }), ['Zero lines.']);
// câu còn ô (shot template) không tính
assert.deepStrictEqual(cauThieuNguon({ chu_man: '{{noi_dau}}' }), []);
// cổng: chỉ phim QC
assert.strictEqual(chanThamKhao([{ thu_tu: 3, chu_man: 'Wow.' }], false).length, 0);
assert.ok(chanThamKhao([{ thu_tu: 3, chu_man: 'Wow.' }], true)[0]!.includes('shot #3'));
// chép template: câu cố định giữ nguồn của nó, câu có ô lấy nguồn của ô; ô thiếu nguồn → câu đó không có nguồn (cổng sẽ chặn)
const tk = thamKhaoSauDien({ chu_man: '{{noi_dau}}', thoai: [{ loi: 'Then I tried this.' }, { loi: '{{loi_ich_2}}' }], tham_khao: [{ cau: 'Then I tried this.', nguon: [Q] }] },
  { noi_dau: 'My bra shows through every top', loi_ich_2: 'Smooth back' }, { noi_dau: [K] });
assert.deepStrictEqual(tk, [{ cau: 'My bra shows through every top', nguon: [K] }, { cau: 'Then I tried this.', nguon: [Q] }]);
assert.deepStrictEqual(cauThieuNguon({ chu_man: 'My bra shows through every top', thoai: [{ loi: 'Smooth back' }], tham_khao: tk }), ['Smooth back']);
console.log('tham-khao.test: ok');
