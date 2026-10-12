import assert from 'node:assert';
import { tomTatApp } from './bao-cao-app';

// Mẫu thật MilitaryCalc 25/09–02/10/2026: một máy VN tải lần đầu rồi tải lại hai lần; hiển thị rải nhiều nước.
const bc = tomTatApp([
  { date: '2026-09-25', raw_data: { impressions: 2, pageViews: 1, firstTime: 1, chiTiet: [
    { su: 'Impression', nguon: 'App Store search', may: 'iPhone', os: 'iOS 16.7', nuoc: 'CI', n: 1 },
    { su: 'Impression', nguon: 'App Store search', may: 'iPhone', os: 'iOS 26.6', nuoc: 'VN', n: 1 },
    { su: 'Page view', nguon: 'App Store browse', may: 'iPhone', os: 'iOS 26.6', nuoc: 'VN', n: 1 },
    { su: 'First-time download', nguon: 'App Store search', may: 'iPhone', os: 'iOS 26.6', nuoc: 'VN', n: 1, ban: '1.0' },
  ] } },
  { date: '2026-10-02', raw_data: { redownloads: 1, updates: 1, chiTiet: [
    { su: 'Redownload', nguon: 'App Store search', may: 'iPhone', os: 'iOS 26.6', nuoc: 'VN', n: 1, ban: '1.2' },
    { su: 'Auto-update', nguon: null, may: 'iPhone', os: 'iOS 26.6', nuoc: 'US', n: 1, ban: '1.2' },
  ] } },
  { date: '2026-09-20', raw_data: { impressions: 4 } },   // ngày cũ chỉ có tổng
  { date: '2026-09-19', raw_data: null },
]);
assert.deepStrictEqual(bc.tong, { hienThi: 6, xemTrang: 1, taiMoi: 1, taiLai: 1, capNhat: 1 });
assert.strictEqual(bc.taiMoiNgoaiVN, 0, 'tải lần đầu duy nhất là từ VN');
assert.strictEqual(bc.tai.length, 3);
assert.strictEqual(bc.tai[0]!.ngay, '2026-10-02', 'mới nhất trước');
assert.deepStrictEqual(bc.tai.map((t) => t.loai).sort(), ['capNhat', 'lai', 'moi']);
assert.strictEqual(bc.theoNuoc[0]!.khoa, 'VN', 'xếp theo lượt tải');
assert.strictEqual(bc.theoNuoc.find((x) => x.khoa === 'US')?.tai, undefined, 'cập nhật không tính là tải → US không có dòng');
assert.strictEqual(bc.ngayThieuChiTiet, 1);
assert.strictEqual(bc.tu, '2026-09-20'); assert.strictEqual(bc.den, '2026-10-02');
const rong = tomTatApp([]);
assert.strictEqual(rong.tu, null); assert.strictEqual(rong.tai.length, 0);
console.log('bao-cao-app: 12/12 đạt');
