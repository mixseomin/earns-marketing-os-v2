// Tự kiểm bộ chấm prompt: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/kiem-prompt.test.mts
import assert from 'node:assert';
import { chamPrompt, loiPrompt, noiChonPhongCach } from './kiem-prompt';
import { hanhDongTrongMoTa, khoi, KHONG_THEM_FLUX } from './prompt-khoi';

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
const kh = (bc: string, kt = true) => [khoi('khong_them', kt && KHONG_THEM_FLUX), khoi('anh_dich', 'Cinematic live-action film still, photorealistic, eye-level shot.'), khoi('boi_canh', bc && `Setting: ${bc}.`), khoi('nguoi', `A woman wearing ${VEST}.`), khoi('so_nguoi', 'Exactly 1 person in this frame (Lâm Hạ).'), khoi('chat_lieu', 'Real people.')];
assert.equal(loiPrompt([{ ten: 'bước 1', duong: 'flux', khoi: kh('') }], s).length, 1);
assert.deepEqual(loiPrompt([{ ten: 'bước 1', duong: 'flux', khoi: kh('Boardroom in afternoon light') }], s), []);
// KHÔNG THÊM VẬT LẠ bắt buộc mọi đường (anh 22/10/2026): thiếu khối khong_them → chặn
assert.equal(loiPrompt([{ ten: 'bước 1', duong: 'flux', khoi: kh('Boardroom in afternoon light', false) }], s).length, 1);
// CHẤT LIỆU: phim người thật mà chữ hoạt hình → chặn (cả câu video "squash and stretch")
assert.equal(loiPrompt([{ ten: 'một bước', chu: `Turn it into a real photograph of the miniature stop-motion set. Woman wearing ${VEST}.` }], { ...s, chat_lieu: 'nguoi_that' }).length, 1);
assert.equal(loiPrompt([{ ten: 'video', chu: `Cartoon acting (anticipation, squash and stretch). Woman wearing ${VEST}.` }], { ...s, chat_lieu: 'nguoi_that' }).length, 1);
// CÂU LẶP: chỉ trừ điểm (10), không chặn
const lapChu = `Woman wearing ${VEST}, pale-green jade bangle on the left wrist, jade bangle on the left wrist.`;
assert.equal(chamPrompt([{ ten: 'bước 1', chu: lapChu }], s).diem, 90); assert.equal(loiPrompt([{ ten: 'bước 1', chu: lapChu }], s).length, 0);
// THOẠI đúng ngôn ngữ phim không phải tiếng Việt lọt vào; bố trí nhiều món cùng loại không phải lặp
assert.deepEqual(loiPrompt([{ ten: 'video', duong: 'video', khoi: [khoi('giu', `Keep the first frame, wearing ${VEST}.`), khoi('dien', 'Naturalistic acting.'), khoi('cam_chu', 'No text.'), khoi('khong_them', 'Nothing new appears.'), khoi('thoai', 'Hạ says "Cô nói đúng."')] }], s), []);
assert.equal(chamPrompt([{ ten: 'một bước', duong: 'mot_buoc', khoi: [khoi('anh_dich', 'EDIT Image 1.'), khoi('khong_them', 'No extra objects.'), khoi('bo_tri', 'black leather armchair with a walnut frame, black leather armchair with a walnut frame'), khoi('nguoi', `woman wearing ${VEST}`), khoi('so_nguoi', 'Exactly 1 person.'), khoi('phong_cach', 'Photo look.'), khoi('cam_chu', 'No text.')] }], s).diem, 100);
// HƯỚNG ĐI NGƯỢC 3D (#15): "Hạ walks screen-right" mà 3D đo Hạ sang trái → chặn; cùng hướng → qua
const di = { ...s, di: [{ ten: 'Lâm Hạ', dx: -0.3 }] };
assert.equal(loiPrompt([{ ten: 'video', chu: `Keep screen direction: Hạ walks screen-right toward the table, wearing ${VEST}.` }], di).length, 1);
assert.equal(loiPrompt([{ ten: 'video', chu: `Keep screen direction: Hạ walks screen-left toward the table, wearing ${VEST}.` }], di).length, 0);
// NGƯỜI NGOÀI KHUNG làm chủ ngữ → cảnh báo (10); hướng nhìn "looks at Thần" → qua
const ng = { ...s, ngoai: ['Lục Thần'] };
assert.equal(chamPrompt([{ ten: 'video', chu: `Thần slams the table. Woman wearing ${VEST}.` }], ng).diem, 90);
assert.equal(chamPrompt([{ ten: 'video', chu: `Hạ looks down the table at Thần. Woman wearing ${VEST}.` }], ng).diem, 100);
// KHUÔN: có người trong khung mà thiếu khối số người → chặn (#15 mọc thêm người ngoài hành lang)
assert.equal(loiPrompt([{ ten: 'bước 1', duong: 'flux', khoi: [khoi('anh_dich', 'Film still.'), khoi('boi_canh', 'Setting: Boardroom.'), khoi('nguoi', `A woman wearing ${VEST}.`), khoi('chat_lieu', 'Real.'), khoi('khong_them', KHONG_THEM_FLUX)] }], s).length, 1);
// THẺ CÒN SÓT trong prompt → chặn
assert.equal(loiPrompt([{ ten: 'bước 1', chu: `Woman wearing ${VEST} holding the {Ly ca phe}.` }], s).length, 1);
// PHONG CÁCH nhắc đồ của một nơi (#132 sảnh thang máy không có cửa sổ) → báo; bối cảnh có cửa sổ → qua; phong cách chỉ chất ảnh → qua
const SANH = 'Polished elevator lobby: black marble floor and back wall, two brushed steel elevator doors';
assert.deepEqual(noiChonPhongCach('glossy look, cool daylight from floor-to-ceiling windows, 35mm', SANH), ['window']);
assert.deepEqual(noiChonPhongCach('glossy look, cool daylight from floor-to-ceiling windows', 'Open-plan office with floor-to-ceiling glass windows'), []);
assert.deepEqual(noiChonPhongCach('glossy look, cool steel-blue key light with warm practical lamps', SANH), []);
// HỒ SƠ NGƯỜI CHỈ CÓ NGOẠI HÌNH (#132 người phụ "holding up a phone to film" ở mọi shot) → bắt; ngoại hình + tư thế → qua
assert.equal(hanhDongTrongMoTa('young female office worker in a light blue blouse, seated, turned toward the aisle, holding up a phone to film'), 'holding up a phone');
assert.equal(hanhDongTrongMoTa('male office worker in a charcoal shirt, seated, smirking'), 'smirking');
assert.equal(hanhDongTrongMoTa('female office worker in a cream blouse and grey pencil skirt, standing by the window'), null);
console.log('kiem-prompt: ok');
