import assert from 'node:assert';
import { gopTroVe, khoaDich, khopDuong, khopSite, lichTroVe, daLenThat, linkBai, type BaiDich, type SuKienLich } from './social-tro-ve-tinh';

assert.strictEqual(khoaDich('https://www.RatesByRoom.com/hotel-scam-check/?utm_source=x'), 'ratesbyroom.com/hotel-scam-check');
assert.strictEqual(khoaDich('clane.app/sidecue'), 'clane.app/sidecue');
const ds: BaiDich[] = [
  { dich: 'ratesbyroom.com/hotel-scam-check', nen: 'youtube', tk: '543', ngay: '2026-11-01', xem: 30 },
  { dich: 'ratesbyroom.com', nen: 'x', tk: '540', ngay: '2026-10-01', xem: 5 },
  { dich: 'frontporchpuzzles.gumroad.com/l/mtdry', nen: 'youtube', tk: '506', ngay: '2026-10-30', xem: 900 },
];
const khach = new Map([['ratesbyroom.com', 12]]);
// site: mọi bài cùng tên miền; trong 7 ngày chỉ bài 01/11; tài khoản đếm cả bài cũ
assert.deepStrictEqual(gopTroVe(ds, khach, 7, '2026-11-02', khopSite('ratesbyroom.com'), true), { ky: 7, taiKhoan: 2, nen: ['x', 'youtube'], bai: 1, xem: 30, khach: 12 });
assert.strictEqual(gopTroVe(ds, khach, 90, '2026-11-02', khopSite('ratesbyroom.com'), true)!.bai, 2);
// sản phẩm trên chợ: khớp đúng đường dẫn, không có khách đo
assert.deepStrictEqual(gopTroVe(ds, khach, 7, '2026-11-02', khopDuong('https://frontporchpuzzles.gumroad.com/l/mtdry'), false), { ky: 7, taiKhoan: 1, nen: ['youtube'], bai: 1, xem: 900, khach: null });
assert.strictEqual(gopTroVe(ds, khach, 7, '2026-11-02', khopDuong('https://frontporchpuzzles.gumroad.com/l/khac'), false), null);
// không bài nào trong kỳ: tài khoản vẫn đếm, xem = null (chưa có số), không phải 0
assert.deepStrictEqual(gopTroVe(ds, null, 7, '2026-11-20', khopSite('ratesbyroom.com'), true), { ky: 7, taiKhoan: 2, nen: ['x', 'youtube'], bai: 0, xem: null, khach: null });
// lịch: gộp theo ngày × loại, chỉ đích khớp site, chi tiết giữ tên bài
const sk: SuKienLich[] = [
  { dich: 'ratesbyroom.com/a', loai: 'dang', ngay: '2026-11-01', chu: 'youtube · A' }, { dich: 'ratesbyroom.com', loai: 'dang', ngay: '2026-11-01', chu: 'x · B' },
  { dich: 'ratesbyroom.com', loai: 'hen', ngay: '2026-11-03', chu: 'facebook 19:00 · C' }, { dich: 'pickjot.com', loai: 'dang', ngay: '2026-11-01', chu: 'youtube · D' },
];
assert.deepStrictEqual(lichTroVe(sk, khopSite('ratesbyroom.com')), [
  { ngay: '2026-11-01', loai: 'dang', so: 2, chiTiet: ['youtube · A', 'x · B'], muc: [{ chu: 'youtube · A', url: null }, { chu: 'x · B', url: null }] },
  { ngay: '2026-11-03', loai: 'hen', so: 1, chiTiet: ['facebook 19:00 · C'], muc: [{ chu: 'facebook 19:00 · C', url: null }] }]);
assert.deepStrictEqual(lichTroVe(sk, khopSite('steamsolo.com')), [], 'site không có kênh trỏ về = lịch rỗng (menu không hiện lịch)');
// #1511: FB hẹn giờ ghi da_dang ngay lúc hẹn — chưa tới giờ là hẹn đăng, qua giờ là đã đăng; bài không hẹn luôn là đã đăng
assert.strictEqual(daLenThat({ hen: true, luc: '2026-11-03T14:00:00.000Z' }, '2026-11-02T10:00:00.000Z'), false);
assert.strictEqual(daLenThat({ hen: true, luc: '2026-11-03T14:00:00.000Z' }, '2026-11-03T15:00:00.000Z'), true);
assert.strictEqual(daLenThat({ luc: '2026-11-09T00:00:00.000Z' }, '2026-11-02T10:00:00.000Z'), true);
// link mở được: url thật giữ nguyên, mã hẹn FB đổi ra trang, thứ khác không bịa link
assert.strictEqual(linkBai('https://x.com/a/status/1'), 'https://x.com/a/status/1');
assert.strictEqual(linkBai('fb-hen-api:2613809689097876:2026-11-03T14:00:00.000Z'), 'https://www.facebook.com/reel/2613809689097876/');
assert.strictEqual(linkBai('fb-hen:104223389200602:2026-11-03T13:00:00.000Z'), 'https://www.facebook.com/104223389200602');
assert.strictEqual(linkBai('xem-tay'), null); assert.strictEqual(linkBai(null), null);
console.log('social-tro-ve-tinh: 16/16 ok');
