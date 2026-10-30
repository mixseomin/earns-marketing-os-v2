// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/don-rac.test.mts
import assert from 'node:assert';
import { chonRac, khoThamChieu, khoaRac, khoaTuRac, PHANH } from './don-rac';
const bay = Date.parse('2026-10-31T00:00:00Z'), ngay = (n: number) => bay - n * 864e5;
const nen = Array.from({ length: PHANH.thamChieuToiThieu }, (_, i) => `xuong-video/keyframe/nen-${i}-aaaaaaaa.jpg`);
const ref = khoThamChieu([...nen, 'xuong-video/clip/dang-dung-11111111.mp4', 'xuong-video/xuat/12-th%C3%A2n-22222222.mp4', 'https://img.on.tc/xuong-video/clip/cat-ngan']);
const t = (key: string, tuoi: number) => ({ key, size: 5e6, luc: ngay(tuoi) });
const ds = [
  t('xuong-video/clip/dang-dung-11111111.mp4', 40),      // còn trỏ tới → giữ
  t('xuong-video/xuat/12-thân-22222222.mp4', 40),         // DB lưu dạng %-mã hoá → vẫn nhận ra
  t('xuong-video/clip/mo-coi-33333333.mp4', 40),          // không ai nhắc + cũ → rác
  t('xuong-video/clip/moi-44444444.mp4', 3),              // không ai nhắc nhưng mới 3 ngày → giữ
  t('xuong-video/may/dang-55555555.mp4', 90),             // may/ không thuộc phạm vi dọn
  t('kho/ethopex/thu-vien/x.mp4', 90),                    // ngoài studio
  t('xuong-video/rac/2026-09-20/clip/cu-66666666.mp4', 1), // thùng rác quá 30 ngày → xoá hẳn
  t('xuong-video/rac/2026-10-20/clip/vua-77777777.mp4', 1),
  ...nen.slice(0, 10).map((k) => t(k, 40)),
];
const kq = chonRac(ds, ref, bay);
assert.strictEqual(kq.dung, null, String(kq.dung));
assert.deepStrictEqual(kq.rac.map((x) => x.key), ['xuong-video/clip/mo-coi-33333333.mp4']);
assert.deepStrictEqual(kq.xoaHan.map((x) => x.key), ['xuong-video/rac/2026-09-20/clip/cu-66666666.mp4']);
assert.deepStrictEqual(kq.theoThuMuc, { clip: { n: 1, mb: 5 } });
// lưới đỡ theo tên tệp: link bị cắt giữa chừng nhưng tên tệp còn → giữ
assert.strictEqual(chonRac([t('xuong-video/thu/a/dai-88888888.png', 40)], khoThamChieu([...nen, 'xuong-video/x/dai-88888888.png']), bay).rac.length, 0);
// phanh: kho tham chiếu rỗng (pg_dumpall hỏng) → không dọn gì
const hong = chonRac(ds, khoThamChieu([]), bay);
assert.ok(hong.dung?.includes('quét DB') && !hong.rac.length && !hong.xoaHan.length, String(hong.dung));
// phanh: gần hết tệp cũ đều "không ai nhắc" → nghi quét sót
const sot = chonRac(Array.from({ length: 20 }, (_, i) => t(`xuong-video/clip/s-${i}-99999999.mp4`, 40)), ref, bay);
assert.ok(sot.dung?.includes('nghi quét sót') && !sot.rac.length, String(sot.dung));
assert.strictEqual(khoaRac('xuong-video/clip/a.mp4', '2026-10-31'), 'xuong-video/rac/2026-10-31/clip/a.mp4');
assert.strictEqual(khoaTuRac('xuong-video/rac/2026-10-31/clip/a.mp4'), 'xuong-video/clip/a.mp4');
console.log('don-rac tu-kiem ok');
