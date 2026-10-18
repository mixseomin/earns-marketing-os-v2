// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/qc-cam-xuc.test.mts
import assert from 'node:assert';
import { camThuc, promptBieuCam, loiMachBieuCam, thieuBieuCam, laTreEm, doiModelVideo, loiCanCanhDongLon, loiCauTraiBieuCam, chamMay, soatKeyframe, soatClip, camXucDo, type BieuCamNv, cauNuocMat } from './qc-cam-xuc';

// Nét tiêu cực cả đầu lẫn cuối → tự cấm cười (Jett #61 #2: đang đau mà cười)
assert.deepStrictEqual(camThuc({ nv: 'Frank', dau: 'dau', cuoi: 'met' }).sort(), ['cuoi_lon', 'vui']);
assert.deepStrictEqual(camThuc({ nv: 'Frank', dau: 'ngo_vuc', cuoi: 'vui' }), []);
const v = promptBieuCam([{ nv: 'Frank', dau: 'dau', cuoi: 'met' }], 'video');
assert.ok(v.includes('starts with wincing') && v.includes('never a warm, genuine smile') && v.includes('never laughing'));
assert.ok(promptBieuCam([{ nv: 'Frank', dau: 'dau', cuoi: 'met' }], 'anh').startsWith('EXPRESSION of Frank: wincing'));
assert.strictEqual(promptBieuCam([], 'video'), '');

// Liền mạch: #1 (cuối đau) → #2 (đầu vui) cùng nơi → lỗi; khai cú lật → qua; khác nơi → không xét
const nv = [{ id: 1, ten: 'Frank', loai: 'nhan_vat' as const }, { id: 9, ten: 'Party', loai: 'boi_canh' as const }, { id: 8, ten: 'Home', loai: 'boi_canh' as const }];
const s1 = { id: 11, thu_tu: 1, nhan_vat: [1, 9], bieu_cam: [{ nv: 'Frank', dau: 'hao_huc', cuoi: 'dau' }] as BieuCamNv[] };
const s2 = { id: 12, thu_tu: 2, nhan_vat: [1, 9], bieu_cam: [{ nv: 'Frank', dau: 'vui', cuoi: 'vui' }] as BieuCamNv[] };
assert.ok(loiMachBieuCam([s1, s2], nv)[12]?.[0]?.includes('LIỀN MẠCH BIỂU CẢM'));
assert.deepStrictEqual(loiMachBieuCam([s1, { ...s2, bieu_cam: [{ nv: 'Frank', dau: 'dau', cuoi: 'met' }] }], nv), {});
assert.deepStrictEqual(loiMachBieuCam([s1, { ...s2, bieu_cam: [{ nv: 'Frank', dau: 'vui', cuoi: 'vui', lat: true }] }], nv), {});
assert.deepStrictEqual(loiMachBieuCam([s1, { ...s2, nhan_vat: [1, 8] }], nv), {}, 'khác nơi không xét');
assert.deepStrictEqual(thieuBieuCam({ id: 1, thu_tu: 1, nhan_vat: [1, 9], bieu_cam: [] }, nv), ['Frank']);

// Trẻ em → Veo đổi sang Kling; người lớn / số không phải tuổi → giữ
assert.ok(laTreEm('American girl, 7, white, blonde hair in two braids'));
assert.ok(laTreEm('a boy of about nine'));
assert.ok(laTreEm('American man, 8, small'));
assert.ok(!laTreEm('American man, 66, white, short gray hair'));
assert.ok(!laTreEm('Frank\'s wife, American woman, 63, white'));
assert.ok(!laTreEm('size 10 jeans on a shelf'));
assert.strictEqual(doiModelVideo('veo-3.1-lite-generate-preview', [{ ten: 'Lily', mo_ta: 'American girl, 7' }])?.model, 'fal:fal-ai/kling-video/v3/pro/image-to-video');
assert.strictEqual(doiModelVideo('veo-3.1-lite-generate-preview', [{ ten: 'Frank', mo_ta: 'American man, 66' }]), null);
assert.strictEqual(doiModelVideo('fal:fal-ai/kling-video/v3/pro/image-to-video', [{ ten: 'Lily', mo_ta: 'girl, 7' }]), null);

// Cận cảnh + động tác lớn → chặn; cảnh rộng nhảy → được; cận động tác nhỏ → được
assert.ok(loiCanCanhDongLon({ hanh_dong: 'knee bending mid-dance', prompt_video: 'he is dancing, knee bends', ky_thuat: { co_canh: 'ecu' } }));
assert.strictEqual(loiCanCanhDongLon({ hanh_dong: '', prompt_video: 'he dances with the girl', ky_thuat: { co_canh: 'ws' } }), null);
assert.strictEqual(loiCanCanhDongLon({ hanh_dong: '', prompt_video: 'hands pull the fabric, it stretches', ky_thuat: { co_canh: 'ecu' } }), null);

// Soát chỉ có hiệu lực với đúng ảnh / clip đang dùng; Murch dùng số đo
const kq = { url: 'k1', luc: '', nguoi: 'x', dat: true, loi: [] };
assert.ok(soatKeyframe({ keyframe_url: 'k1', soat: { keyframe: kq } }));
assert.strictEqual(soatKeyframe({ keyframe_url: 'k2', soat: { keyframe: kq } }), null, 'sinh lại keyframe → soát cũ hết hiệu lực');
assert.strictEqual(soatClip({ video_url: 'v1', video_cuoi_url: null, soat: { clip: { ...kq, url: 'v1' } } })?.dat, true);
assert.deepStrictEqual(camXucDo({ keyframe_url: 'k1', video_url: 'v1', video_cuoi_url: null, soat: { clip: { url: 'v1', luc: '', nguoi: '', dat: false, loi: ['nét mặt: cười giữa chừng'] } } })?.diem, 0);
assert.strictEqual(camXucDo({ keyframe_url: 'k1', video_url: null, video_cuoi_url: null, soat: null }), null);
console.log('qc-cam-xuc ok');

// Câu hành động trái kế hoạch (Jett #61 #2: "small apologetic smile" khi Frank đau → mệt)
const kh2: BieuCamNv[] = [{ nv: 'Frank', dau: 'dau', cuoi: 'met' }, { nv: 'Lily', dau: 'hao_huc', cuoi: 'buon' }];
assert.ok(loiCauTraiBieuCam('He sits down; seated, he gives his granddaughter a small apologetic smile.', kh2)?.includes('cấm cười (Frank)'));
assert.strictEqual(loiCauTraiBieuCam('He winces and sinks back down. Lily smiles hopefully at him.', kh2), null, 'câu có tên người được cười');
assert.strictEqual(loiCauTraiBieuCam('He winces, no smile at all', [{ nv: 'Frank', dau: 'vui', cuoi: 'cuoi_lon' }]), null, 'kế hoạch không cấm cười');
assert.strictEqual(loiCauTraiBieuCam('He winces and sinks back down, with no real smile.', kh2), null, 'câu phủ định không phải lệnh cười');

// MÁY TỰ CHẤM — số đo thật Jett #61 (16/10/2026): Grok #2 cũ (Frank cười khi đang đau, khung đầu lệch #1) → trượt; Kling #2 cuối shot cười nhẹ
// nhưng mặt nhận chưa chắc → cần mắt; nét trung tính không xét dấu; người soát thắng máy.
const k = (t: number, ten: string | null, sim: number, val: number, w = 120) => ({ t, mat: [{ ten, sim, sims: { Frank: sim }, w, val }] });
const kh2b: BieuCamNv[] = [{ nv: 'Frank', dau: 'dau', cuoi: 'met' }];
const grok = chamMay({ dai: 4, khung: [k(0, 'Frank', 0.4, 0.68), k(1.1, 'Frank', 0.31, 0.59), k(3.3, 'Frank', 0.36, 0.64)], noi: { lech: 54.77 } }, kh2b, { phat: 4, noiLien: true });
assert.strictEqual(grok.ket, 'truot');
assert.ok(grok.loi.some((x) => x.includes('cấm cười')) && grok.loi.some((x) => x.includes('liền mạch')));
const kling = chamMay({ dai: 4, khung: [k(0, 'Frank', 0.39, -0.68), k(3.1, null, 0.29, 0.69, 173), k(3.54, null, 0.22, 0.62, 195)], noi: { lech: 2.77 } }, kh2b, { phat: 4, noiLien: true });
assert.strictEqual(kling.ket, 'can_mat', JSON.stringify(kling));
assert.strictEqual(chamMay({ dai: 4, khung: [k(0, 'Frank', 0.5, 0.32), k(3.9, 'Frank', 0.32, -0.57)] }, [{ nv: 'Frank', dau: 'ngo_vuc', cuoi: 'bat_ngo' }], {}).ket, 'dat', 'nét trung tính không xét dấu');
assert.strictEqual(chamMay({ dai: 4, khung: [] }, [], {}).ket, 'dat', 'không có mặt để đo');
const url = 'https://x/c.mp4', may = { url, luc: '', ket: 'can_mat' as const, loi: ['Frank có vẻ cười'] };
assert.ok(!soatClip({ video_url: url, video_cuoi_url: null, soat: { may } })!.dat && soatClip({ video_url: url, video_cuoi_url: null, soat: { may } })!.loi[0]!.startsWith('cần mắt'));
assert.strictEqual(soatClip({ video_url: url, video_cuoi_url: null, soat: { may } })!.may, 'can_mat', 'mức máy có cấu trúc — chip ◐ đọc trường này, không dò tiền tố chữ');
assert.strictEqual(soatClip({ video_url: url, video_cuoi_url: null, soat: { may, clip: { url, luc: '', nguoi: 'anh', dat: false, loi: ['x'] } } })!.may, undefined, 'người soát: không mang mức máy');
assert.strictEqual(soatClip({ video_url: 'https://x/moi.mp4', video_cuoi_url: null, soat: { may } }), null, 'clip đổi: kết quả máy cũ hết hiệu lực');
assert.ok(soatClip({ video_url: url, video_cuoi_url: null, soat: { may: { ...may, ket: 'truot' }, clip: { url, luc: '', nguoi: 'anh', dat: true, loi: [] } } })!.dat, 'người soát thắng máy');
console.log('qc-cam-xuc chấm máy ok');
assert.strictEqual(loiCanCanhDongLon({ hanh_dong: 'The narrator watches, the dancing blurs behind, a small worried glance', ky_thuat: { co_canh: 'mcu' } }), null, 'nhảy ở hậu cảnh không phải động tác chủ thể');
assert.ok(loiCanCanhDongLon({ hanh_dong: 'He spins her around, laughing', ky_thuat: { co_canh: 'mcu' } }));
// LƯỢT NƯỚC MẮT: nét khóc / cười đau / nhục nhã (đầu shot) → câu thêm nước mắt; nét khô hoặc chỉ khóc ở CUỐI shot → rỗng
assert.match(cauNuocMat([{ nv: 'Lâm Hạ', dau: 'khoc_tham', cuoi: 'khoc_tham' }]), /Lâm Hạ: heavy tears/);
assert.strictEqual(cauNuocMat([{ nv: 'Vivian', dau: 'dac_y', cuoi: 'soc' }]), '');
assert.strictEqual(cauNuocMat([{ nv: 'Lâm Hạ', dau: 'buon', cuoi: 'khoc_tham' }]), '');
assert.strictEqual(cauNuocMat(null), '');
console.log('qc-cam-xuc nước mắt ok');
