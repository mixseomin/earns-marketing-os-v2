// Tự kiểm mô hình lịch (worker/lich-chu.mjs) — để riêng vì lich-chu.mjs vào gói trình duyệt.
//   node scripts/thu-lich-chu.mjs
import { strict as a } from 'node:assert';
import { chuThu, chuLich, sach, tuSystemd, tuCron, tuLaunchd, dongOnCalendar, truongCron } from '../worker/lich-chu.mjs';
a.equal(chuThu([1, 2, 3, 4, 5]), 'T2–T6'); a.equal(chuThu([6, 7]), 'T7, CN'); a.equal(chuThu([1, 3, 5]), 'T2, T4, T6');
a.equal(chuLich({ kieu: 'moi', phut: 120 }), 'mỗi 2 giờ'); a.equal(chuLich({ kieu: 'moi', phut: 90 }), 'mỗi 90 phút');
a.equal(chuLich({ kieu: 'luc', gio: ['08:15', '14:15'], thu: [] }), '08:15, 14:15 hằng ngày'); a.equal(chuLich({ kieu: 'luc', gio: ['21:00'], thu: [1, 2, 3, 4, 5] }), '21:00 · T2–T6');
a.deepEqual(sach({ kieu: 'luc', gio: ['14:15', '08:15', '08:15'], thu: [1, 2, 3, 4, 5, 6, 7] }), { kieu: 'luc', gio: ['08:15', '14:15'], thu: [] }, 'sắp giờ, bỏ trùng, đủ 7 thứ = mỗi ngày');
a.throws(() => sach({ kieu: 'moi', phut: 0 })); a.throws(() => sach({ kieu: 'luc', gio: [] })); a.throws(() => sach({ kieu: 'luc', gio: ['8h'] }));
a.deepEqual(tuSystemd('OnBootUSec=2min · OnUnitActiveUSec=30min · OnActiveUSec=1min'), { kieu: 'moi', phut: 30 });
a.deepEqual(tuSystemd('OnCalendar=*-*-* *:00/10:00'), { kieu: 'moi', phut: 10 }); a.deepEqual(tuSystemd('OnCalendar=*-*-* *:02,17,32,47:00'), { kieu: 'moi', phut: 15 }); a.deepEqual(tuSystemd('OnCalendar=*-*-* *:17:00 UTC'), { kieu: 'moi', phut: 60 });
a.deepEqual(tuSystemd('OnCalendar=*-*-* 02,14:00:00 UTC'), { kieu: 'luc', gio: ['09:00', '21:00'], thu: [] });
a.deepEqual(tuSystemd('OnCalendar=Mon..Fri *-*-* 14:00:00'), { kieu: 'luc', gio: ['21:00'], thu: [1, 2, 3, 4, 5] });
a.deepEqual(tuSystemd('OnCalendar=Sun *-*-* 18:00:00 UTC'), { kieu: 'luc', gio: ['01:00'], thu: [1] }, '18:00 UTC CN = 01:00 VN T2');
a.equal(tuSystemd('OnCalendar=*-10-01 03:00'), null);
a.deepEqual(tuCron('*/5 * * * *'), { kieu: 'moi', phut: 5 }); a.deepEqual(tuCron('40 */6 * * *'), { kieu: 'moi', phut: 360 }); a.deepEqual(tuCron('10 1-23/2 * * *'), { kieu: 'moi', phut: 120 });
a.deepEqual(tuCron('30 9 * * 1'), { kieu: 'luc', gio: ['16:30'], thu: [1] }); a.deepEqual(tuCron('0 3 * * *'), { kieu: 'luc', gio: ['10:00'], thu: [] });
a.deepEqual(tuLaunchd('lúc 08:15, 14:15, 20:15'), { kieu: 'luc', gio: ['08:15', '14:15', '20:15'], thu: [] }); a.deepEqual(tuLaunchd('chạy liền'), { kieu: 'lien' });
a.deepEqual(tuLaunchd('lúc thứ 1 09:00, thứ 3 09:00'), { kieu: 'luc', gio: ['09:00'], thu: [1, 3] }); a.deepEqual(tuLaunchd('mỗi 10 phút'), { kieu: 'moi', phut: 10 });
const L = (gio, thu = []) => ({ kieu: 'luc', gio, thu });
for (const l of [L(['08:00']), L(['01:00'], [1]), L(['09:00', '21:00']), L(['21:00'], [1, 2, 3, 4, 5]), L(['06:30', '23:10'], [6, 7])]) a.deepEqual(tuSystemd(dongOnCalendar(l).map((c) => `OnCalendar=${c}`).join(' · ')), l, `khứ hồi systemd ${chuLich(l)}`);
a.deepEqual(dongOnCalendar(L(['01:00'], [1])), ['Sun *-*-* 18:00:00 UTC']);
for (const l of [L(['08:15', '14:15']), L(['16:30'], [1]), { kieu: 'moi', phut: 15 }, { kieu: 'moi', phut: 360 }]) a.deepEqual(tuCron(truongCron(l)), l, `khứ hồi cron ${chuLich(l)}`);
a.throws(() => truongCron({ kieu: 'moi', phut: 7 }), /chia hết 60/); a.throws(() => truongCron(L(['08:15', '09:30'])), /cùng số phút/); a.throws(() => truongCron(L(['06:00', '08:00'], [1])), /ngày khác/);
console.log('✓ lich-chu: mô hình lịch (mỗi N · nhiều giờ · theo thứ), đọc từ systemd/cron/launchd đổi UTC↔VN kể cả lệch ngày, ghi ngược khứ hồi đúng, cron báo rõ khi không diễn được');
