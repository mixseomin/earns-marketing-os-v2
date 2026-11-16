// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/chan-gui-video.test.mts — mỗi ca là một lỗi thật ở phim #3071 (14/11/2026)
import assert from 'node:assert';
import { loiPromptGui, loiClipThamChieu, boLoiThoai, loiThoaiPrompt, loiShotPrompt, loiAnhCum, loiThoaiCuoiCum, loiVideoThamChieu, loiCoMay, bacCoChu } from './chan-gui-video';
import { dangChongBau } from './bo-set-3d';

const sach = 'A 10-second, 6-shot widescreen film sequence. Shot 1 (about 2 s): the man in the t-shirt says: Nhóc, lại đây!. Shot 2: the boy looks up. Keep it subtitle-free.';
assert.deepStrictEqual(loiPromptGui(sach, { tiLe: '16:9', tenNhanVat: ['Chú', 'Nhóc'] }), [], 'lời thoại tiếng Việt có tên vẫn hợp lệ');
assert.ok(boLoiThoai(sach).includes('says: …') && !boLoiThoai(sach).includes('lại đây'));
// phá thử từng luật: mỗi ca phải đỏ đúng luật
assert.ok(loiPromptGui('the man looks at dau_ga, not at the camera.', {})[0]!.includes('dau_ga'));
assert.ok(loiPromptGui('Reference image 1 is Chú; Reference image 2 is Nhóc.', { tenNhanVat: ['Chú', 'Nhóc'] }).some((x) => x.includes('Chú, Nhóc')));
assert.ok(loiPromptGui('Shot 1: Chú dặn tận mặt thằng bé, rõ chữ.', { tenNhanVat: [] }).some((x) => x.includes('tiếng Việt')));
assert.ok(loiPromptGui('A 8-second, 3-shot vertical film sequence.', { tiLe: '16:9' }).some((x) => x.includes('vertical')));
assert.deepStrictEqual(loiPromptGui('A 8-second, 3-shot vertical film sequence.', { tiLe: '9:16' }), []);
// thoại trong câu lệnh: đúng một lần → qua; bị đổi chữ (0 lần) / lặp hai lần → chặn; cùng câu nói hai lần trong cụm thì cần đúng hai
assert.deepStrictEqual(loiThoaiPrompt('Shot 1: the man says: Chú cho cháu 5k. Keep it subtitle-free.', ['Chú cho cháu 5k.']), []);
assert.ok(loiThoaiPrompt('Shot 1: the man says: the man in the t-shirt cho cháu 5k.', ['Chú cho cháu 5k.'])[0]!.includes('không có nguyên văn'));
assert.ok(loiThoaiPrompt('the man says: Chú cho cháu 5k. In shot 1, the man says: Chú cho cháu 5k.', ['Chú cho cháu 5k.']).some((x) => x.includes('lặp 2 lần')));
assert.deepStrictEqual(loiThoaiPrompt('a says: Ê!; then a says: Ê!.', ['Ê!', 'Ê!']), []);
// bản sao bị đổi chữ đứng cạnh bản đúng (đúng dạng câu lệnh thật job 8322): nguyên văn 1 lần nhưng "says:" 2 lần → chặn
assert.ok(loiThoaiPrompt('the man says: the man in the t-shirt cho cháu 5k.. In shot 1, the man speaks out loud and says: Chú cho cháu 5k..', ['Chú cho cháu 5k.'])[0]!.includes('2 lần "says:"'));
// clip 3D sạch
assert.deepStrictEqual(loiClipThamChieu([{ so: 1, clip: { sach: true } }, { so: 2, clip: null }]), []);
assert.ok(loiClipThamChieu([{ so: 7, clip: {} }])[0]!.includes('#7'));
// dáng chống bậu: thân 174° với bậu 90° → chặn; 90° hoặc không khai bậu → qua
const shot = (huong: number, huong_bau?: number) => ({ id: 1, may_3d: { dat: [0, 0, 0], nhin: [1, 0, 0], vi_tri: [{ ten: 'Chú', tam: [0, 0, 0], huong, huong_bau, dien: ['chong_ban'] }] } }) as never;
assert.ok(dangChongBau([shot(174, 90)])[1]![0]!.includes('lệch 84°'));
assert.deepStrictEqual(dangChongBau([shot(90, 90)]), {});
assert.deepStrictEqual(dangChongBau([shot(174)]), {});
// từng shot (câu lệnh thật cụm C / E phim #3071, soát 15/11/2026): shot câm có động từ nói, câu diễn rỗng → chặn; câu sửa → qua
const cumC = 'Shot 3 (about 1.5 s): Medium shot — slow carefree stroll, sipping; nobody speaks, mouths closed. Shot 4 (about 3.5 s): Wide shot — man frowns and fires questions; boy lowers head; nobody speaks, mouths closed. Shot 5 (about 4 s): Close-up — the man in the t-shirt says: Sao giờ mới về? Tàu sắp chạy rồi. Keep it subtitle-free.';
assert.deepStrictEqual(loiShotPrompt(cumC).length, 1); assert.ok(loiShotPrompt(cumC)[0]!.includes('shot 4') && loiShotPrompt(cumC)[0]!.includes('questions'));
assert.deepStrictEqual(loiShotPrompt(cumC.replace('fires questions', 'glares down, jabbing a finger at the train')), []);
assert.ok(loiShotPrompt('Shot 1 (about 1.5 s): Insert close-up — hold the action clear and readable, settle at the end. Keep it subtitle-free.')[0]!.includes('câu diễn rỗng'));
assert.ok(loiThoaiCuoiCum([2], 4)[0]!.includes('shot 2')); assert.deepStrictEqual(loiThoaiCuoiCum([5], 5), []); assert.deepStrictEqual(loiThoaiCuoiCum([], 3), []);
assert.ok(loiVideoThamChieu(1.2)[0]!.includes('1.20 s')); assert.deepStrictEqual(loiVideoThamChieu(2), []);
assert.deepStrictEqual(loiAnhCum(5, 4).length, 1); assert.deepStrictEqual(loiAnhCum(5, 5), []);
// câu thoại kết bằng "!" (không chấm thêm): boLoiThoai vẫn cắt đúng hết câu, không nuốt câu tiếng Anh sau nó
assert.strictEqual(boLoiThoai('Shot 1 (about 2 s): the man says: Đi nhanh về nhanh nhé! Keep it subtitle-free.'), 'Shot 1 (about 2 s): the man says: …! Keep it subtitle-free.');
// cỡ cảnh / máy một nguồn (dữ liệu THẬT phim #3071, 16/11/2026): #14 ws + lia mà kết "close on boy" → chặn; #3 tinh mà hướng "camera moves toward him" → chặn;
// #4 cu tinh, #10 ms tinh "camera does not move", #15 cu day_vao → qua
const s14 = { so: 14, co_canh: 'ws', chuyen_dong: 'lia', mo: 'two-shot, man frowning, boy with bottle', ket: 'close on boy holding out change, awkward grin', huong: 'man looks down screen right' };
assert.ok(loiCoMay([s14]).some((l) => l.includes('#14') && l.includes('day_vao')), JSON.stringify(loiCoMay([s14])));
assert.deepStrictEqual(loiCoMay([{ ...s14, chuyen_dong: 'day_vao' }]), []);
const s3 = { so: 3, co_canh: 'ws', chuyen_dong: 'tinh', mo: 'boy small in frame, kicking a pebble', ket: 'boy a bit larger, looks up toward camera', huong: 'boy faces camera, camera moves toward him' };
assert.ok(loiCoMay([s3])[0]!.includes('camera moves toward'));
assert.deepStrictEqual(loiCoMay([{ so: 4, co_canh: 'cu', chuyen_dong: 'tinh', mo: 'close-up of the man at the open train window', ket: 'he leans out and calls the boy, smiling' },
  { so: 10, co_canh: 'ms', chuyen_dong: 'tinh', mo: 'man calling from window', huong: 'man faces screen right; camera does not move' },
  { so: 15, co_canh: 'cu', chuyen_dong: 'day_vao', mo: 'close-up of the annoyed man at the train window' }]), []);
assert.ok(loiCoMay([{ so: 9, co_canh: 'ws', chuyen_dong: 'tinh', mo: 'close-up of the boy' }])[0]!.includes('cỡ cảnh khai ws'));
assert.ok(loiCoMay([{ so: 10, co_canh: 'ms', chuyen_dong: 'day_vao', huong: 'camera does not move' }])[0]!.includes('máy đứng'));
assert.strictEqual(bacCoChu('medium close-up of the boy'), 3); assert.strictEqual(bacCoChu('wide shot … then a close-up'), 1); assert.strictEqual(bacCoChu('boy walking'), null);
// REVIEW 16/11/2026: "close up to his face" là động tác, không phải cỡ cảnh; người TỰ đi vào cận (dàn cảnh chiều sâu) thì máy đứng vẫn đổi cỡ; zoom gắt cũng là máy tiến vào
assert.strictEqual(bacCoChu('he holds the note close up to his face'), null);
const diVao = { so: 5, co_canh: 'ws', chuyen_dong: 'tinh', mo: 'wide shot, boy far down the platform', ket: 'close-up of the boy, panting' };
assert.strictEqual(loiCoMay([diVao]).length, 1); assert.deepStrictEqual(loiCoMay([{ ...diVao, di_sau_cm: -600 }]), []); assert.strictEqual(loiCoMay([{ ...diVao, di_sau_cm: 600 }]).length, 1);
assert.deepStrictEqual(loiCoMay([{ so: 6, co_canh: 'ms', chuyen_dong: 'zoom_gat', mo: 'medium shot of the man', ket: 'close-up, eyes wide', huong: 'camera zooms in' }]), []);
console.log('✓ chan-gui-video (mã nội bộ · tên / tiếng Việt ngoài thoại · tỉ lệ · clip sạch · dáng chống bậu)');
