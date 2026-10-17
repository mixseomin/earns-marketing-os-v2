// Tự kiểm bộ chấm prompt: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/kiem-prompt.test.mts
import assert from 'node:assert';
import { chamPrompt, loiPrompt } from './kiem-prompt';
import { khoi } from './prompt-khoi';

const VEST = 'Tailored white power suit (single-breasted blazer, wide-leg trousers)';
const s = { nguoi: [{ ten: 'Lâm Hạ', trang_phuc: VEST }], vat: [] };
// sạch: tiếng Anh, có bộ đồ → qua, 100 điểm
assert.deepEqual(chamPrompt([{ ten: 'bước 1', chu: `A woman wearing ${VEST} strides in.`, flux: true }], s), { diem: 100, loi: [] });
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
// báo oan cũ: tên gọi tắt 'Hạ', 'eye-level shot', 'face out of frame', tên ngoài khung viết hoa, từ mượn 'café' → qua
assert.deepEqual(loiPrompt([{ ten: 'bước 1', chu: `Eye-level shot. Moment: Hạ steps in. Hạ's hand only (face out of frame), wearing ${VEST}.` }], { ...s, co_canh: 'insert' }), []);
assert.deepEqual(loiPrompt([{ ten: 'bước 1', chu: `Moment: Vivian turns from Hạ to Thần, wearing ${VEST}.` }], s), []);
assert.deepEqual(loiPrompt([{ ten: 'bước 1', chu: `a small café corner, wearing ${VEST}.` }], s), []);
assert.equal(loiPrompt([{ ten: 'bước 1', chu: `Màn trình chiếu, wearing ${VEST}.` }], s).length, 1);
// KHUÔN: bước 1 FLUX thiếu khối bối cảnh → chặn; đủ khối → qua
const kh = (bc: string) => [khoi('anh_dich', 'Cinematic live-action film still, photorealistic, eye-level shot.'), khoi('boi_canh', bc && `Setting: ${bc}.`), khoi('nguoi', `A woman wearing ${VEST}.`), khoi('chat_lieu', 'Real people.')];
assert.equal(loiPrompt([{ ten: 'bước 1', duong: 'flux', khoi: kh('') }], s).length, 1);
assert.deepEqual(loiPrompt([{ ten: 'bước 1', duong: 'flux', khoi: kh('Boardroom in afternoon light') }], s), []);
// CHẤT LIỆU: phim người thật mà chữ hoạt hình → chặn (cả câu video "squash and stretch")
assert.equal(loiPrompt([{ ten: 'một bước', chu: `Turn it into a real photograph of the miniature stop-motion set. Woman wearing ${VEST}.` }], { ...s, chat_lieu: 'nguoi_that' }).length, 1);
assert.equal(loiPrompt([{ ten: 'video', chu: `Cartoon acting (anticipation, squash and stretch). Woman wearing ${VEST}.` }], { ...s, chat_lieu: 'nguoi_that' }).length, 1);
// CÂU LẶP: chỉ trừ điểm (10), không chặn
const lapChu = `Woman wearing ${VEST}, pale-green jade bangle on the left wrist, jade bangle on the left wrist.`;
assert.equal(chamPrompt([{ ten: 'bước 1', chu: lapChu }], s).diem, 90); assert.equal(loiPrompt([{ ten: 'bước 1', chu: lapChu }], s).length, 0);
console.log('kiem-prompt: ok');
