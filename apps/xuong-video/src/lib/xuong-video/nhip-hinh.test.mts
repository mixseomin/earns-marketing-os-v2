// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/nhip-hinh.test.mts
import assert from 'node:assert';
import { kiemNhipHinh, daDangMay, kiemGiayDoc, giayDoc, soShotToiDa, kiemDanKhongGian, kiemVaiKe, kiemTheShot, kiemNutDong, kiemKetTap } from './nhip-hinh';
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
assert.equal(giayDoc({ phim_doc: true }), 1.2, 'phim ngắn dọc: sàn 1,2 s'); assert.equal(giayDoc({ phim_doc: true, khong_loi: true }), 3.5, 'không lời vẫn thắng');
assert.strictEqual(soShotToiDa(48, { khong_loi: true }), 12, '48s không lời → tối đa 12 shot (không phải 20)');
assert.strictEqual(soShotToiDa(30, { laQc: true }), 20);
// dẫn không gian: bối cảnh 1 = cả bàn, 2 = rừng cáp, 3 = đế cắm; 9 = nhân vật (không phải bối cảnh)
const BC = [1, 2, 3];
const sh = (thu_tu: number, co_canh: string, nv: number[]) => ({ thu_tu, nhan_vat: nv, ky_thuat: { co_canh } });
const tot = [sh(1, 'ews', [1]), sh(2, 'ms', [1, 9]), sh(3, 'ws', [2, 9]), sh(4, 'cu', [2, 9]), sh(5, 'ms', [1, 9]), sh(6, 'ws', [9]), sh(7, 'mcu', [3, 9])];
assert.deepStrictEqual(kiemDanKhongGian(tot, BC, {}), [], 'mở toàn cảnh; vào rừng cáp bằng ws; quay lại bàn đã thấy; tới đế cắm sau shot hành trình ws');
const xau = [sh(1, 'cu', [1, 9]), sh(2, 'mcu', [1, 9]), sh(3, 'ms', [2, 9]), sh(4, 'ws', [2]), sh(5, 'cu', [3, 9])];
const lx = kiemDanKhongGian(xau, BC, {});
assert.ok(lx.some((x) => x.includes('mở tập chưa có shot toàn cảnh')), lx.join('\n'));
assert.ok(lx.some((x) => x.includes('#3') && !x.includes('#5')), 'vào rừng cáp ở #3 bằng ms → lỗi; #5 có #4 ws ngay trước (hành trình) → không lỗi: ' + lx.join('\n'));
assert.deepStrictEqual(kiemDanKhongGian(xau, BC, { laQc: true }), [], 'quảng cáo không xét');
assert.deepStrictEqual(kiemDanKhongGian(xau, [], {}).filter((x) => x.includes('nơi mới')), [], 'phim chưa có bối cảnh → không xét nơi mới');
// vai kể: tập chỉ toàn hành động → thiếu mở thời điểm, tổng thể, phản ứng/tâm trạng/người thứ ba, 4 shot hành động liền
const vk = (thu_tu: number, vai: string, phan_doan = 'A') => ({ thu_tu, phan_doan, ky_thuat: { vai } });
const toanHd = [1, 2, 3, 4, 5, 6].map((i) => vk(i, 'hanh_dong'));
const lv = kiemVaiKe(toanHd, {});
for (const t of ['NƠI + THỜI ĐIỂM', 'tổng thể', 'phản ứng, tâm trạng, góc người thứ ba', 'bốn shot hành động liền']) assert.ok(lv.some((x) => x.includes(t)), `${t}: ${lv.join('\n')}`);
const du = [vk(1, 'thiet_lap'), vk(2, 'nguoi_thu_ba'), vk(3, 'hanh_dong'), vk(4, 'phan_ung'), vk(5, 'tong_the', 'B'), vk(6, 'tam_trang', 'B'), vk(7, 'hanh_dong', 'B')];
assert.deepStrictEqual(kiemVaiKe(du, {}), [], kiemVaiKe(du, {}).join('\n'));
assert.ok(kiemVaiKe([...du.slice(0, 6), { thu_tu: 7, phan_doan: 'B', ky_thuat: {} }], {})[0]!.includes('1 shot chưa chọn vai kể (#7)'));
assert.deepStrictEqual(kiemVaiKe(toanHd, { laQc: true }), []);
// thẻ shot: thiếu ô bắt buộc → chặn, motif không bắt buộc, quảng cáo không xét
const du_the = { bo_cuc: 'a', mo: 'b', ket: 'c', huong: 'd', muc_dich: 'e', dien: 'f' };
assert.deepStrictEqual(kiemTheShot([{ thu_tu: 1, dan_dung: du_the }], {}), []);
const lt = kiemTheShot([{ thu_tu: 1, dan_dung: { ...du_the, ket: ' ' } }, { thu_tu: 2 }], {});
assert.ok(lt[0]!.includes('2 shot thiếu ô thẻ') && lt[0]!.includes('#1: trạng thái kết') && lt[0]!.includes('#2: bố cục 3 lớp'), lt.join('\n'));
assert.deepStrictEqual(kiemTheShot([{ thu_tu: 2 }], { laQc: true }), []);
// DỰNG TRUYỆN — cảnh 7 bản cũ (Tango & Lint tập 19): mạch A bẫy Mr. Wipe bùng ở shot 6–7, mạch B kẻ trộm bùng ở 9, không nút đóng
const s7 = (vai: string, luat: string[], giay = 4) => ({ phan_doan: 'Bến', phat_s: giay, thoi_luong_s: 4, ky_thuat: { vai, luat } });
const cu7 = [s7('tong_the', []), s7('chi_tiet', []), s7('phan_ung', []), s7('hanh_dong', []), s7('hanh_dong', []), s7('chi_tiet', []), s7('phan_ung', ['giu_phan_ung']), s7('chi_tiet', ['motif', 'chenh_thong_tin']), s7('phan_ung', ['giu_phan_ung', 'khoang_lang'], 3.5), s7('thiet_lap', ['chenh_thong_tin'])].map((c, i) => ({ ...c, thu_tu: 30 + i }));
const gag7 = [{ ten: 'Bẫy', gai: '', bung: '', o_shot: 6, mach: 'A' }, { ten: 'Hả hê', gai: '', bung: '', o_shot: 7, mach: 'A' }, { ten: 'Trộm', gai: '', bung: '', o_shot: 9, mach: 'B' }];
const nd = kiemNutDong([{ ten: 'Bến', gag: gag7 }], cu7, {});
assert.ok(nd.length === 1 && nd[0]!.includes('NÚT ĐÓNG') && nd[0]!.includes('#36'), nd.join('\n'));
assert.ok(kiemNutDong([{ ten: 'Bến', gag: gag7.map(({ mach: _m, ...g }) => g) }], cu7, {})[0]!.includes('chưa khai mạch'));
// bản mới: chèn nút đóng (phản ứng 3,5s giữ) sau shot bùng 7 + shot mở lại (motif) → qua
const moi7 = [...cu7.slice(0, 7), { ...s7('phan_ung', ['giu_phan_ung'], 3.5), thu_tu: 99 }, { ...s7('chi_tiet', ['motif']), thu_tu: 98 }, ...cu7.slice(7)];
const gagMoi = [gag7[0]!, gag7[1]!, { ...gag7[2]!, o_shot: 11 }];
assert.deepStrictEqual(kiemNutDong([{ ten: 'Bến', gag: gagMoi }], moi7, {}), []);
// nút đóng quá ngắn (2s) → đỏ; nút có mà không mở lại mạch B → đỏ
assert.ok(kiemNutDong([{ ten: 'Bến', gag: gagMoi }], moi7.map((c) => (c.thu_tu === 99 ? { ...c, phat_s: 2 } : c)), {})[0]!.includes('NÚT ĐÓNG'));
assert.ok(kiemNutDong([{ ten: 'Bến', gag: gagMoi }], moi7.map((c) => ({ ...c, ky_thuat: { ...c.ky_thuat, luat: c.ky_thuat.luat.filter((l) => l !== 'motif' && l !== 'chenh_thong_tin') } })), {})[0]!.includes('MỞ LẠI'));
// kết: bản cũ — bùng #38 (o_shot 9) rồi móc ngay #39, giữ nằm trong shot bùng → đỏ (thiếu giữ)
const kt = kiemKetTap([{ ten: 'Bến', gag: gag7 }], cu7, { coMoc: true });
assert.ok(kt.some((x) => x.includes('GIỮ')), kt.join('\n'));
// thêm shot giữ 3,5s sau bùng, trước móc → qua
const ket = [...cu7.slice(0, 9), { ...s7('tam_trang', ['khoang_lang'], 3.5), thu_tu: 97 }, cu7[9]!];
assert.deepStrictEqual(kiemKetTap([{ ten: 'Bến', gag: gag7 }], ket, { coMoc: true }), []);
// shot cuối không phải móc (phản ứng) → đỏ; phim lẻ không đòi móc
assert.ok(kiemKetTap([{ ten: 'Bến', gag: gag7 }], [...ket.slice(0, 10), { ...s7('phan_ung', ['chenh_thong_tin']), thu_tu: 96 }], { coMoc: true }).some((x) => x.includes('MÓC')));
assert.deepStrictEqual(kiemKetTap([{ ten: 'Bến', gag: gag7 }], ket.slice(0, 10), {}), []);
// mô tả anchor nước đôi + khung kết 'sau khi' (15/10/2026)
const { moTaNuocDoi } = await import('./quy-trinh');
const { KET_SAU_KHI } = await import('./ho-so');
assert.equal(moTaNuocDoi('a flat orange card / card holder lying on the desk'), 'orange card / card holder');
assert.equal(moTaNuocDoi('an orange leather card holder with a pale blue card in its window'), null);
assert.ok(KET_SAU_KHI.test('Tango and Lint after a high-five') && KET_SAU_KHI.test('sau khi đập tay') && !KET_SAU_KHI.test('rolling on into the dark after the gummy'));
console.log('nhip-hinh.test: ok');
