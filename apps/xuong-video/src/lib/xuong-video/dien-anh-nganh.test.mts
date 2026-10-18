// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/dien-anh-nganh.test.mts
// Thư viện phải ĐỦ mô tả ngành cho mọi chuyển động máy + nhịp diễn (anh 15/10/2026: "lưu vào thư viện hết"), và mô tả không trỏ vào kỹ thuật ma.
import assert from 'node:assert';
import { THU_VIEN, promptKyThuatVideo, lamSachKyThuat } from './dien-anh';
import { NGANH, KY_HIEU_CAT, CU_MAY_LIEN_BANG, CU_MAY_KHUNG_KET } from './dien-anh-nganh';
import { LUAT_DUNG_CANH, luatDung } from './luat-dung';

// MỌI kỹ thuật trong thư viện (mọi nhóm) phải có mô tả ngành đủ trường + nguồn (anh 18/10/2026: "Luôn phải refer với kiến thức ngành").
const can = THU_VIEN;
const thieu = can.filter((x) => !x.nganh || Object.values(x.nganh).some((v) => !String(v).trim())).map((x) => `${x.nhom}.${x.key}`);
assert.deepStrictEqual(thieu, [], `thiếu mô tả ngành: ${thieu.join(', ')}`);
const khongSo = THU_VIEN.filter((x) => x.nhom === 'chuyen_dong' && !x.may_di).map((x) => x.key);
assert.deepStrictEqual(khongSo, [], `chuyển động máy thiếu phần số cho 3D: ${khongSo.join(', ')}`);
const ma = Object.keys(NGANH).filter((k) => !THU_VIEN.some((x) => `${x.nhom}.${x.key}` === k) && !(k.startsWith('luat.') && luatDung(k.slice(5))));   // 'luat.<key>' = luật dựng cảnh (luat-dung.ts)
assert.deepStrictEqual(ma, [], `mô tả ngành trỏ vào kỹ thuật không có: ${ma.join(', ')}`);
assert.ok(THU_VIEN.filter((x) => x.nhom === 'dien_xuat').length >= 10);
// nhịp diễn vào prompt video; key lạ bị lọc
assert.ok(promptKyThuatVideo({ chuyen_dong: 'day_vao', dien_xuat: 'mat_rung_rung' }).includes('Performance: eyes slowly welling up'));
assert.equal(lamSachKyThuat({ dien_xuat: 'khoc_bia' }).dien_xuat, undefined);
assert.equal(lamSachKyThuat({ dien_xuat: 'nhan_ra' }).dien_xuat, 'nhan_ra');
console.log(`dien-anh-nganh.test: ok (${can.length} kỹ thuật có mô tả ngành)`);
// Luật của thợ (xem: false) phải có mô tả ngành và không lọt vào lời dặn người xem ảo.
const tho = LUAT_DUNG_CANH.filter((l) => l.xem === false);
assert.ok(tho.length >= 15 && tho.every((l) => l.nganh), `luật thợ thiếu mô tả ngành: ${tho.filter((l) => !l.nganh).map((l) => l.key).join(', ')}`);
console.log('dien-anh-nganh.test: ok (luật thợ)');
// MỌI luật dựng (không chỉ luật thợ) phải dẫn kiến thức ngành có NGUỒN (anh 18/10/2026: "Luôn phải refer với kiến thức ngành") — luật mới thiếu mục 'luat.<key>' là đỏ.
const khongNguon = LUAT_DUNG_CANH.filter((l) => !l.nganh || !l.nganh.nguon.trim() || Object.values(l.nganh).some((v) => !String(v).trim())).map((l) => l.key);
assert.deepStrictEqual(khongNguon, [], `luật dựng thiếu kiến thức ngành / nguồn: ${khongNguon.join(', ')}`);
console.log(`dien-anh-nganh.test: ok (${LUAT_DUNG_CANH.length} luật dựng đều có nguồn ngành)`);
// Bảng ký hiệu timeline trỏ vào kỹ thuật CÓ THẬT; cú máy cần khung kết phải dựng được đường máy (không 'tu_do') — không thì cổng chặn mãi.
const ma2 = [...Object.keys(KY_HIEU_CAT).filter((k) => !THU_VIEN.some((x) => x.nhom === 'chuyen_canh' && x.key === k)).map((k) => `chuyen_canh.${k}`),
  ...Object.keys(CU_MAY_LIEN_BANG).filter((k) => !THU_VIEN.some((x) => x.nhom === 'chuyen_dong' && x.key === k)).map((k) => `chuyen_dong.${k}`)];
assert.deepStrictEqual(ma2, [], `ký hiệu trỏ vào kỹ thuật không có: ${ma2.join(', ')}`);
const khongDung = CU_MAY_KHUNG_KET.filter((k) => ['tu_do', 'dung'].includes(NGANH[`chuyen_dong.${k}`]?.may_di?.kieu ?? 'dung'));
assert.deepStrictEqual(khongDung, [], `cú máy cần khung kết mà bản 3D không dựng được đường máy: ${khongDung.join(', ')}`);
console.log('dien-anh-nganh.test: ok (ký hiệu timeline)');
