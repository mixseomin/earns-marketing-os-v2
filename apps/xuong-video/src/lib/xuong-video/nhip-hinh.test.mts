// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/nhip-hinh.test.mts
import assert from 'node:assert';
import { kiemNhipHinh, daDangMay, kiemGiayDoc, giayDoc, soShotToiDa } from './nhip-hinh';
// Fox tập 2 (13/10/2026): cỡ cảnh + chuyển động máy 14 shot
const FOX = [['cu', 'day_vao'], ['cu', 'day_vao'], ['ws', 'tinh'], ['ms', 'tinh'], ['two', 'tinh'], ['ms', 'tinh'], ['ws', 'lui_ra'], ['cu', 'day_vao'], ['cu', 'day_vao'], ['ms', 'tinh'], ['cu', 'tinh'], ['two', 'tinh'], ['ws', 'truot_ngang'], ['ws', 'truot_ngang']]
  .map(([co_canh, chuyen_dong], i) => ({ id: 100 + i, thu_tu: i + 1, ky_thuat: { co_canh, chuyen_dong } }));
const loi = kiemNhipHinh(FOX);
assert.ok(loi.some((x) => x.includes('#1–#2')) && loi.some((x) => x.includes('#8–#9')) && loi.some((x) => x.includes('#13–#14')), loi.join('\n'));
assert.ok(loi.some((x) => x.includes('7/14 shot máy đứng yên (tối đa 5)')), loi.join('\n'));
// sửa 0đ → hết lỗi, chỉ đổi chuyển động máy, giữ cỡ cảnh + nhóm khác
const sua = daDangMay(FOX);
const sau = FOX.map((c) => ({ ...c, ky_thuat: sua.find((x) => x.id === c.id)?.ky_thuat ?? c.ky_thuat }));
assert.deepStrictEqual(kiemNhipHinh(sau), [], kiemNhipHinh(sau).join('\n'));
assert.ok(sua.every((x) => x.ky_thuat.co_canh === FOX.find((c) => c.id === x.id)!.ky_thuat.co_canh), 'không đổi cỡ cảnh');
assert.ok(sua.length <= 6, `đổi ít nhất có thể (${sua.length} shot)`);
assert.deepStrictEqual(daDangMay(sau), [], 'chạy lại không đổi gì nữa');
// chuỗi ngắn (<5 shot) không xét tỉ lệ đứng yên; shot chưa chọn cỡ cảnh không tính trùng
assert.deepStrictEqual(kiemNhipHinh([{ thu_tu: 1, ky_thuat: { co_canh: 'cu' } }, { thu_tu: 2, ky_thuat: { co_canh: 'ws' } }]), []);
assert.deepStrictEqual(kiemNhipHinh([{ thu_tu: 1, ky_thuat: {} }, { thu_tu: 2, ky_thuat: {} }]), []);
// nhịp đọc: Tango & Lint tập 1 — 20 shot / 48s, phat 2–3,5s → phim không lời chặn; quảng cáo không xét; shot chưa cắt tính cả clip
const T1 = [3.5, 2, 2, 2, 2, 2.2, 2, 2.3, 2, 2, 2, 2.9, 2.1, 2, 2.5, 2, 2.5, 2.5, 2, 3.4].map((g, i) => ({ thu_tu: i + 1, phat_s: g, thoi_luong_s: 4 }));
const ld = kiemGiayDoc(T1, { khong_loi: true });
assert.ok(ld.length === 1 && ld[0]!.includes('19 shot phát dưới 3.5s') && ld[0]!.includes('#2 2s'), ld.join('\n'));
assert.deepStrictEqual(kiemGiayDoc(T1, { laQc: true }), []);
assert.deepStrictEqual(kiemGiayDoc([{ thu_tu: 1, phat_s: null, thoi_luong_s: 4 }], { khong_loi: true }), []);
assert.strictEqual(kiemGiayDoc(T1, {}).length, 1, 'phim truyện có lời: ngưỡng 3s vẫn chặn shot 2s');
assert.ok(giayDoc({ khong_loi: true }) > giayDoc({}) && giayDoc({}) > giayDoc({ laQc: true }));
assert.strictEqual(soShotToiDa(48, { khong_loi: true }), 12, '48s không lời → tối đa 12 shot (không phải 20)');
assert.strictEqual(soShotToiDa(30, { laQc: true }), 20);
console.log('nhip-hinh.test: ok');
