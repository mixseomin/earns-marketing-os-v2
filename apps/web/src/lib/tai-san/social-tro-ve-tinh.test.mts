import assert from 'node:assert';
import { gopTroVe, khoaDich, khopDuong, khopSite, type BaiDich } from './social-tro-ve-tinh';

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
console.log('social-tro-ve-tinh: 7/7 ok');
