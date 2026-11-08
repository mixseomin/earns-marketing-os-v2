import assert from 'node:assert';
import { dauKhung, gomLogs, nhanKhung, LOAI_LOG, type HangLog } from './etp-logs';

// 14:20 VN 08/11/2026 = 07:20 UTC
const t = Date.UTC(2026, 10, 8, 7, 20) / 1000;
assert.equal(nhanKhung(dauKhung(t, 15), 15), '14:15–14:30 08/11');
assert.equal(nhanKhung(dauKhung(t, 60), 60), '14:00–15:00 08/11');
assert.equal(nhanKhung(dauKhung(t, 180), 180), '12:00–15:00 08/11');
// 06:30 VN 09/11 vẫn thuộc ngày Ethopex 08/11 (07h→07h)
const sang = Date.UTC(2026, 10, 8, 23, 30) / 1000;
assert.equal(dauKhung(sang, 1440), Date.UTC(2026, 10, 8) / 1000);
assert.equal(nhanKhung(dauKhung(sang, 1440), 1440), '08/11 (07h→07h)');

const ev: HangLog[] = [[t, 'tat', 1, 'a'], [t + 60, 'tat', 2, 'b'], [t - 3600, 'mo', 3, 'c']];
const k = gomLogs({ ev, tien: [[dauKhung(t, 60), 5, 8]], gio: 3, den: t + 120 }, 60);
assert.equal(k[0].dem.tat.length, 2);
assert.equal(k[0].chi, 5);
assert.equal(k[1].dem.mo.length, 1);
assert.ok(k.length >= 3, 'khung trống vẫn có dòng');
assert.equal(new Set(LOAI_LOG.map((x) => x.k)).size, LOAI_LOG.length, 'mã loại không trùng');
console.log('etp-logs: ok');
