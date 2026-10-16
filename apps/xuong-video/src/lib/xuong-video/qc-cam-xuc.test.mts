// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/qc-cam-xuc.test.mts
import assert from 'node:assert';
import { camThuc, promptBieuCam, loiMachBieuCam, thieuBieuCam, laTreEm, doiModelVideo, loiCanCanhDongLon, soatKeyframe, soatClip, camXucDo, type BieuCamNv } from './qc-cam-xuc';

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
