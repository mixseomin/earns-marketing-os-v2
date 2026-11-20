// node_modules/.bin/tsx apps/web/src/lib/outreach/so.test.mts
// Sổ widget + màn của outreach.on.tc: bố cục dựng sẵn hợp lệ (mã có thật, không lặp, trong lưới, đủ cỡ tối thiểu), không ô nào đè nhau,
// bảng rộng nằm trong ô đủ rộng, mọi widget có mặt trên ít nhất một màn, mã màn không trùng với màn của /home (bố cục lưu chung một bảng),
// và kiểu + nguồn trong sổ kiểu trỏ tới nhau đúng.
import assert from 'node:assert';
import { chamNhau, hopLe, maTrenMan } from '../home/luoi';
import { MAN, RONG_BANG } from '../home/so';
import { BO_SO, boCuaMan } from '../luoi-trang/bo-so';
import { MAN_OB, MAN_OB_MAC_DINH, NHOM_OB, WIDGET_OB, coWidgetOb } from './so';
import { KIEU, NGUON, kieuCua, maKieu, nguonCua, ttCua } from './kieu';

const rong = new Set(Object.entries(WIDGET_OB).filter(([, w]) => 'rong' in w && w.rong).map(([ma]) => ma));
const tren = new Set<string>();
assert.ok(MAN_OB.some((m) => m.id === MAN_OB_MAC_DINH), 'màn mặc định có trong sổ');
for (const m of MAN_OB) {
  assert.ok(m.id.startsWith('ob-'), `màn ${m.id}: mã phải có tiền tố ob-`);
  assert.ok(!MAN.some((h) => h.id === m.id), `màn ${m.id} trùng mã với một màn của /home`);
  assert.equal(boCuaMan(m.id), BO_SO.outreach, `màn ${m.id} phải thuộc bộ sổ outreach`);
  const v = hopLe(m.o, coWidgetOb);
  assert.ok(v && v.length === m.o.length && m.o.length > 0, `màn "${m.ten}": bố cục dựng sẵn không hợp lệ`);
  m.o.forEach((a, i) => m.o.forEach((b, j) => { if (i < j) assert.ok(!chamNhau(a, b), `màn "${m.ten}": ${a.ma} đè lên ${b.ma}`); }));
  for (const o of m.o) for (const t of o.tabs ?? [o.ma]) { tren.add(t); if (rong.has(t)) assert.ok(o.w >= RONG_BANG, `màn "${m.ten}": bảng rộng ${t} nằm trong ô ${o.w} cột (cần ≥ ${RONG_BANG})`); }
  assert.equal(new Set(maTrenMan(m.o)).size, maTrenMan(m.o).length, `màn "${m.ten}": widget lặp`);
}
for (const ma of Object.keys(WIDGET_OB)) {
  assert.ok(tren.has(ma), `widget ${ma} không nằm trên màn nào`);
  assert.ok(ma.replace(/\d+$/, '') in NHOM_OB, `widget ${ma}: nhóm chưa khai trong NHOM_OB`);
}
assert.equal(boCuaMan('sang'), BO_SO.home, 'màn của /home vẫn thuộc bộ sổ home');
assert.equal(boCuaMan('khong-co'), null);

// sổ kiểu: nguồn khai trong kiểu phải có trong sổ nguồn; mã cũ trong DB quy về kiểu có thật; mã lạ không làm vỡ
for (const [k, v] of Object.entries(KIEU)) for (const n of v.nguon) assert.ok(n in NGUON, `kiểu ${k}: nguồn ${n} chưa khai trong NGUON`);
assert.equal(maKieu('embed'), 'embed'); assert.equal(maKieu('custom'), 'khac'); assert.equal(maKieu('sales'), 'khach'); assert.equal(maKieu(null), 'khac'); assert.equal(maKieu('toString'), 'khac');
assert.equal(kieuCua('la-hoac').ten, 'Khác');
assert.equal(nguonCua('constructor').ten, 'constructor', 'nguồn lạ trùng tên hàm có sẵn vẫn ra nhãn chữ'); assert.equal(ttCua('valueOf').ten, 'valueOf'); assert.equal(ttCua('sent').ten, 'Đã gửi');
assert.equal(nguonCua('prospecting-2026-06-27').ten, 'Đợt tìm 27/06/2026'); assert.equal(nguonCua('pr-engine').ten, 'Máy tìm người viết'); assert.equal(nguonCua('').ten, 'không ghi nguồn');
console.log('✓ outreach so.test: ', MAN_OB.length, 'màn ·', Object.keys(WIDGET_OB).length, 'widget ·', Object.keys(KIEU).length, 'kiểu');

// ---- hàm thuần của nhịp 2–4 (lib/outreach/thuan.ts)
import { chonEmail, chuanEmail, docCsv, keHoachChuoi, kiemChuoi, laTuDong, laXinThoi, loaiDoi, tranTangDan, xetPhanh, type LoiChao } from './thuan';
// chọn email: cùng tên miền trước, hộp chung trước; bỏ rác (ảnh, sentry, noreply, ví dụ)
assert.equal(chonEmail('<a href="mailto:support@trail.co">x</a> jane.doe@trail.co hello@trail.co', 'trail.co'), 'hello@trail.co');
assert.equal(chonEmail('icon@2x.png noreply@trail.co a1b2c3d4e5f6a7b8c9d0@sentry.io you@example.com', 'trail.co'), null, 'toàn rác thì không chọn');
assert.equal(chonEmail('write to care&#64;trail.co today', 'www.trail.co'), 'care@trail.co', 'giải mã @ viết dạng thực thể + bỏ www');
assert.equal(chonEmail('trailco.shop@gmail.com', 'trail.co'), 'trailco.shop@gmail.com', 'hộp thư miễn phí vẫn nhận khi không có địa chỉ cùng tên miền');
assert.equal(chonEmail('sales@other-brand.com', 'trail.co'), null, 'địa chỉ của tên miền lạ không nhận');
assert.equal(chonEmail('contact [at] trail.co', 'trail.co'), 'contact@trail.co');
// danh sách dán
{ const r = docCsv('name,email,website\nTrail Co, Hello@TrailCo.com, trailco.com\n; bad line\nsolo@x.io\nTrail Co 2\thello@trailco.com\n');
  assert.equal(r.ds.length, 2, 'trùng email chỉ lấy một'); assert.equal(r.hong, 1, 'một dòng không có email (dòng tiêu đề có chữ email không tính là hỏng)');
  assert.deepEqual(r.ds[0], { ten: 'Trail Co', email: 'hello@trailco.com', website: 'https://trailco.com' }); assert.equal(r.ds[1]!.ten, 'solo'); }
// cửa kiểm chuỗi thư theo KẾ HOẠCH (4 thư: đầu không link · thư 2 link miễn phí · thư 3 luồng mới · thư 4 trang bán + giá)
const CH: LoiChao = { ben_gui: 'AngleBrief', ky_ten: 'Sam', ban_gi: 'x', phat_hien: ['a', 'b'], link_mien_phi: 'https://anglebrief.net/guides/hiking-boots-ad-hooks', link_ban: 'https://anglebrief.net/r/hiking-boots', gia: 'from $24' };
const KH4 = keHoachChuoi(4);
assert.deepEqual(KH4.map((k) => [k.moi, k.link]), [[true, 'khong'], [false, 'mien_phi'], [true, 'khong'], [false, 'ban']]);
assert.deepEqual(keHoachChuoi(3).map((k) => k.link), ['khong', 'mien_phi', 'ban']); assert.equal(keHoachChuoi(9).length, 4); assert.equal(keHoachChuoi(0).length, 1);
assert.equal(keHoachChuoi(4, true)[0]!.link, 'mien_phi', 'chiến dịch chủ động gắn link ở thư đầu');
const tu = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');
const tot = () => ({ hop: 'yes' as string, ly_do: 'sells hiking boots', emails: [
  { subject: 'waterproof boot fit', body: `${tu(55)} Want it sent over?\nSam\nAngleBrief` },
  { subject: '', body: `${tu(30)}\nhttps://anglebrief.net/guides/hiking-boots-ad-hooks` },
  { subject: 'trip deadline angle', body: `${tu(50)} Worth a test?` },
  { subject: '', body: `${tu(25)} from $24\nhttps://anglebrief.net/r/hiking-boots` }] });
assert.equal(kiemChuoi(tot(), CH, KH4), null, 'chuỗi đúng phải qua');
const hong = (sua: (v: ReturnType<typeof tot>) => void) => { const v = tot(); sua(v); return kiemChuoi(v, CH, KH4); };
assert.ok(hong((v) => { v.emails.pop(); }), 'thiếu thư');
assert.equal(kiemChuoi({ hop: 'no', ly_do: 'sells chocolate sticks', emails: [] }, CH, KH4), null, 'không hợp ngách + có lý do là kết quả hợp lệ');
assert.ok(kiemChuoi({ hop: 'no', ly_do: '', emails: [] }, CH, KH4), 'không hợp mà thiếu lý do');
assert.ok(hong((v) => { v.hop = 'maybe'; }), 'hop lạ');
assert.ok(hong((v) => { v.emails[0]!.body = tu(200); }), 'thư đầu quá dài');
assert.ok(hong((v) => { v.emails[0]!.body += ' — wow'; }), 'gạch dài');
assert.ok(hong((v) => { v.emails[1]!.body += ' our AI found this'; }), 'lộ AI');
assert.ok(hong((v) => { v.emails[1]!.body += ' we scraped your ads'; }), 'lộ cách lấy dữ liệu');
assert.ok(hong((v) => { v.emails[0]!.body += ' https://anglebrief.net/guides/hiking-boots-ad-hooks'; }), 'thư đầu không được có link');
assert.ok(hong((v) => { v.emails[1]!.body = tu(30); }), 'thư 2 thiếu link miễn phí');
assert.ok(hong((v) => { v.emails[1]!.body += ' https://evil.example/x'; }), 'link ngoài kế hoạch');
assert.ok(hong((v) => { v.emails[2]!.body += ' https://anglebrief.net/r/hiking-boots'; }), 'thư 3 không được gắn link bán');
assert.ok(hong((v) => { v.emails[0]!.body += ' only $24'; }), 'nêu giá trước thư cuối');
assert.ok(hong((v) => { v.emails[0]!.subject = 'Re: your ad'; }), 'tiêu đề giả thư trả lời');
assert.ok(hong((v) => { v.emails[0]!.subject = 'quick question about boots'; }), 'tiêu đề sáo');
assert.ok(hong((v) => { v.emails[0]!.subject = 'a very long subject line with far too many words in it'; }), 'tiêu đề dài');
assert.ok(hong((v) => { v.emails[1]!.subject = 'new subject here'; }), 'thư nối luồng mà có tiêu đề');
assert.ok(hong((v) => { v.emails[2]!.subject = ''; }), 'thư mở luồng mới mà thiếu tiêu đề');
assert.ok(hong((v) => { v.emails[2]!.body += ' Hi [First Name]'; }), 'còn chỗ để trống');
assert.ok(hong((v) => { v.emails[2]!.body = `Just following up on my note. ${tu(45)}`; }), 'câu nhắc thư trước');
assert.ok(hong((v) => { v.emails[0]!.body = `I hope this email finds you well. ${tu(50)}`; }), 'câu sáo mở thư');
assert.ok(hong((v) => { v.emails[0]!.body += ' And one more thing? Really?'; }), 'hơn một câu hỏi');
assert.ok(hong((v) => { v.emails[3]!.body += ' Amazing value!'; }), 'chữ quảng cáo + chấm than');
// thư tự động · loại thư dội · trần tăng dần · chuẩn địa chỉ · phanh
assert.ok(laTuDong('Automatic reply: your ad', 'jane@trail.co')); assert.ok(laTuDong('Out of Office Re: boots', 'a@b.co')); assert.ok(laTuDong('Re: boots', 'no-reply@trail.co'));
assert.ok(!laTuDong('Re: waterproof boot fit', 'jane@trail.co')); assert.ok(!laTuDong('office hours', 'jane@trail.co'));
assert.equal(loaiDoi('550 5.1.1 The email account that you tried to reach does not exist'), 'cung');
assert.equal(loaiDoi('554 5.7.1 Message rejected due to sender reputation'), 'chinh_sach'); assert.equal(loaiDoi('452 4.2.2 mailbox full'), 'tam');
assert.equal(loaiDoi('Delivery failed: user unknown'), 'cung'); assert.equal(loaiDoi('something odd happened'), 'khong_ro');
assert.equal(loaiDoi('552 5.2.2 over quota'), 'tam', 'hộp đầy là lỗi tạm, không chặn người nhận');
assert.equal(tranTangDan(20, 0), 5); assert.equal(tranTangDan(20, 2), 15); assert.equal(tranTangDan(20, 9), 20); assert.equal(tranTangDan(3, 0), 3);
assert.equal(chuanEmail(' Jane+news@Trail.co '), 'jane@trail.co'); assert.equal(chuanEmail('khong-phai-email'), '');
assert.deepEqual(xetPhanh({ gui: 10, doi: 5, thoi: 0, chanUyTin: 0 }), { dung: null, canh: null }, 'mẫu nhỏ chưa xét');
assert.ok(xetPhanh({ gui: 40, doi: 2, thoi: 0, chanUyTin: 0 }).dung, 'dội 5% thì dừng'); assert.ok(xetPhanh({ gui: 40, doi: 1, thoi: 0, chanUyTin: 0 }).canh, 'dội 2,5% thì cảnh báo');
assert.ok(xetPhanh({ gui: 100, doi: 0, thoi: 3, chanUyTin: 0 }).dung, 'xin thôi 3% thì dừng'); assert.equal(xetPhanh({ gui: 30, doi: 0, thoi: 3, chanUyTin: 0 }).dung, null, 'xin thôi cần mẫu ≥ 50');
assert.ok(xetPhanh({ gui: 40, doi: 0, thoi: 0, chanUyTin: 2 }).dung, 'bị chặn vì uy tín 5% thì dừng'); assert.deepEqual(xetPhanh({ gui: 200, doi: 1, thoi: 1, chanUyTin: 0 }), { dung: null, canh: null });
// lời xin thôi: chỉ xét câu mở đầu của thư trả lời
assert.ok(laXinThoi('Re: your ad', 'No thanks.\n\nOn Tue, AngleBrief wrote: ...')); assert.ok(laXinThoi('unsubscribe', '')); assert.ok(laXinThoi('Re: x', '  Stop emailing me'));
assert.ok(!laXinThoi('Re: your ad', 'Not sure yet, can you send the guide? No rush.')); assert.ok(!laXinThoi('Re: x', 'Nothing against it - tell me more'));
console.log('✓ outreach thuần: chọn email · danh sách dán · kế hoạch + cửa kiểm chuỗi thư · lời xin thôi · thư tự động · loại thư dội · trần tăng dần · phanh');
