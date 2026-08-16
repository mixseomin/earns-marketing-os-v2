// Cửa sổ lên lịch 7 ngày — chốt biên, vì sai một ngày ở đây là chặn nhầm bài đúng hạn (hoặc lọt
// nguyên tuần thứ hai). Chạy: node_modules/.bin/tsx apps/web/src/lib/schedule-horizon.test.mts
import assert from 'node:assert';
import { scheduleTooFar, SCHEDULE_HORIZON_DAYS } from './content-channels';

const T = '2026-08-16';
assert.equal(SCHEDULE_HORIZON_DAYS, 7);
assert.equal(scheduleTooFar('2026-08-16', [], T), false, 'hôm nay');
assert.equal(scheduleTooFar('2026-08-23', [], T), false, 'đúng ngày thứ 7 vẫn trong cửa sổ');
assert.equal(scheduleTooFar('2026-08-24', [], T), true, 'ngày thứ 8 phải chặn');
assert.equal(scheduleTooFar('2026-08-24T09:00:00', [], T), true, 'dạng timestamp cũng chặn');
assert.equal(scheduleTooFar('2026-12-15', ['milestone'], T), false, 'mốc cố định được đặt xa');
assert.equal(scheduleTooFar(null, [], T), false, 'không đặt ngày thì không có gì để chặn');
assert.equal(scheduleTooFar('2026-08-10', [], T), false, 'ngày quá khứ không phải việc của cổng này');
// Sang tháng: cộng ngày phải nhảy tháng đúng, không kẹp lại ở 31.
assert.equal(scheduleTooFar('2026-09-04', [], '2026-08-30'), false, '30/08 + 7 = 06/09');
assert.equal(scheduleTooFar('2026-09-07', [], '2026-08-30'), true);
console.log('schedule-horizon: 9 checks ok');
