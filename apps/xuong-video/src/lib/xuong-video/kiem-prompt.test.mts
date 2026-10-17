// Tự kiểm bộ chấm prompt: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/kiem-prompt.test.mts
import assert from 'node:assert';
import { loiPrompt } from './kiem-prompt';

const VEST = 'Tailored white power suit (single-breasted blazer, wide-leg trousers)';
const s = { nguoi: [{ ten: 'Lâm Hạ', trang_phuc: VEST }], vat: [] };
// sạch: tiếng Anh, có bộ đồ → qua
assert.deepEqual(loiPrompt([{ ten: 'bước 1', chu: `A woman wearing ${VEST} strides in.`, flux: true }], s), []);
// tên khối tiếng Việt lọt vào (#20 "Màn trình chiếu anh sau") → chặn
assert.equal(loiPrompt([{ ten: 'bước 1', chu: `Background: Màn trình chiếu anh sau. Woman wearing ${VEST}.` }], s).length, 1);
// thiếu bộ đồ (#15 vest đen) → chặn
assert.equal(loiPrompt([{ ten: 'bước 2', chu: 'Lâm Hạ — exactly like Image 3: long straight black hair.' }], s).length, 1);
// FLUX quá dài → chặn
assert.equal(loiPrompt([{ ten: 'bước 1', chu: `${VEST} ` + 'word '.repeat(320), flux: true }], s).length, 1);
// cận chèn tả mặt (#22) → chặn; không phải cận chèn → qua
const mat = [{ ten: 'bước 1', chu: `Man with a sharp jawline and cold eyes, wearing ${VEST}.` }];
assert.equal(loiPrompt(mat, { ...s, co_canh: 'insert' }).length, 1);
assert.equal(loiPrompt(mat, { ...s, co_canh: 'mcu' }).length, 0);
// chữ nói đồ chủ thể bị giấu mà 3D cho thấy (#22) → chặn
const vong = { nguoi: [], vat: [{ ten: 'Chuỗi hạt ngọc', mo_ta: 'Thin bracelet of small pale-green jade beads on a black silk cord' }] };
assert.equal(loiPrompt([{ ten: 'bước 1', chu: 'Steel watch; a thin pale-green jade bead bracelet hidden under the left shirt cuff.' }], vong).length, 1);
assert.equal(loiPrompt([{ ten: 'bước 1', chu: 'The cuff pulled back shows a pale-green jade bead bracelet on the wrist.' }], vong).length, 0);
console.log('kiem-prompt: ok');
