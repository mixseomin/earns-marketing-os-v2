// node_modules/.bin/tsx apps/web/src/lib/etp-xet-gon.test.mts
import assert from 'node:assert';
import { gonXet, moXet } from './etp-xet-gon';
import type { DuLieuEtp, XetLuat } from './etp-doc';

const l = (ma: string, ten: string, mo_ta: string, ket: XetLuat['ket'] = 'xa'): XetLuat => ({ ma, ten, mo_ta, dk: [['a', '1', '≥ 1', true]], ket, vao: null, ghi: null });
const d = { nhe: true, xetLuat: {
  1: [l('t1', 'T1', 'mô tả dài T1'), l('t30', 'T30 · $20 → $30', 'thường')],
  2: [l('t1', 'T1', 'mô tả dài T1', 'dat'), l('t30', '★ ROAS thắng · $20 → $30', 'roas')],
  3: [],
} } as unknown as DuLieuEtp;

const g = gonXet(d);
assert.equal(g.xetChu.length, 3, 'gom 2 camp × 2 luật về 3 chữ (T30 hai biến thể giữ riêng)');
assert.ok(!('mo_ta' in g.xetLuat[1]![0]!) && !('ten' in g.xetLuat[1]![0]!), 'dòng gửi đi không còn tên / mô tả');
assert.deepStrictEqual(moXet(g), d, 'mở lại đúng y bản gốc');
assert.deepStrictEqual(moXet(gonXet({ ...d, xetLuat: {} })).xetLuat, {}, 'không camp nào');
assert.throws(() => moXet({ ...g, xetChu: [] }), /không có trong bảng/, 'trỏ chữ thiếu thì kêu, không ra undefined');
console.log('etp-xet-gon: tự kiểm đạt');
