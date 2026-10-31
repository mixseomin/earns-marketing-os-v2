// node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/may-de.test.mts — phần thuần của máy sinh đề (không gọi mô hình)
import assert from 'node:assert';
import { kiemDe, rapDe, slugDe, MAU_CUA_DANG, vanHeThong, vanNguoiDung, giuHook, GIU_HOOK_TOI_THIEU, timHook } from './may-de';

const sp = { ma: 'front-porch-only-one', ten: 'Only ONE', ngach: ['cao-tuoi'], site: 'pickjot.com', link: 'https://pickjot.com/printables/large-print-word-search/', nhan: 'Front Porch Puzzles', mo_ta: 'large print word search puzzles for seniors', book: 'nostalgia' };
const goc = { sp: 1435, id: 37192, loai: 'ai_tinh_huong', ten: 'Đi đường dài bằng ô tô' };
// kiểm luật như Phòng Nội dung
const tot = { mau: 'bai-anh' as const, dang_bai: 'the-chu-tren-anh', de: { truy: 'road trip car', chu: 'Long drive ahead? Hand this to whoever rides shotgun' }, title: 'Long drive ahead? Print a puzzle for whoever rides shotgun', description: 'A long drive gets easier when the passenger has something to do. Print a large print word search before you leave and keep it in the glove box for the next stop. Free page here: https://pickjot.com/printables/large-print-word-search/', nhan: 'Front Porch Puzzles' };
assert.deepStrictEqual(kiemDe(tot), []);
assert.ok(kiemDe({ ...tot, title: 'Front Porch Puzzles has a new page for you today' }).some((l) => /thương hiệu/.test(l)), 'mở bằng tên thương hiệu');
assert.ok(kiemDe({ ...tot, title: 'Too short' }).some((l) => /quá ngắn/.test(l)));
assert.ok(kiemDe({ ...tot, description: 'We delve into a comprehensive tapestry of puzzles — truly seamless and robust for everyone who wants more.' }).some((l) => /từ máy/.test(l)) && kiemDe({ ...tot, description: tot.description + ' — ok' }).some((l) => /gạch/.test(l)));
assert.ok(kiemDe({ ...tot, dang_bai: 'hai-lua-chon', de: { ...tot.de, lua: ['only one'] } }).some((l) => /2 vế/.test(l)));
assert.ok(kiemDe({ ...tot, dang_bai: 'doan-nam-gia', de: { ...tot.de } }).some((l) => /đáp án/.test(l)));
assert.ok(kiemDe({ ...tot, mau: 'canh-dong', de: { truy: 'rain porch', moc: 'short' } }).some((l) => /câu móc trên video/.test(l)));
// slug + ráp dòng nạp
assert.strictEqual(slugDe('the-chu-tren-anh', 37192, 'Long drive ahead? Hand this to whoever'), 'the-chu-tren-anh-37192-long-drive-ahead');
const d = rapDe({ sp, goc, dang_bai: 'hai-lua-chon', mau: 'bai-anh', de: { truy: 'car dashboard', chu: 'Seven hours on the road. Passenger seat gets…', phu: '', lua: ['the phone', 'a printed puzzle'], dap_an: '' }, chu: { title: 'Seven hours on the road. What does the passenger seat get?', description: 'Phones die and car sickness is real. A printed page lasts the whole trip and needs no signal.' } });
assert.strictEqual(d.mau, 'bai-anh'); assert.strictEqual((d.de as { kieu: string }).kieu, 'hai-lua-chon'); assert.deepStrictEqual((d.de as { lua: string[] }).lua, ['the phone', 'a printed puzzle']);
assert.ok(d.dang.description!.endsWith(sp.link) && d.dang.dang_bai === 'hai-lua-chon' && d.dang.goc!.id === 37192 && d.dang.book === 'nostalgia');
const c = rapDe({ sp, goc, dang_bai: 'canh-dong', mau: 'canh-dong', de: { truy: 'rain wooden porch', moc: 'Long drive tomorrow? Pack a puzzle for the passenger', am: 'mua', dai: 10, ket: ['Front Porch Puzzles'] }, chu: { title: 'Rain on the porch, 10 seconds. Where was your longest drive?', description: 'No puzzle today, just the rain. If a long drive is coming, print a page for the passenger seat.' }, dich: 'https://pickjot.com/printables/national-parks-word-search/' });
assert.strictEqual(c.dang.link, 'https://pickjot.com/printables/national-parks-word-search/', 'ô có bài site thì link về bài site'); assert.strictEqual((c.de as { am: string }).am, 'mua');
assert.strictEqual(MAU_CUA_DANG['top-n'], 'top-n'); assert.strictEqual(MAU_CUA_DANG['doan-nam-gia'], 'bai-anh'); assert.strictEqual(MAU_CUA_DANG['so-sanh'], 'so-sanh'); assert.strictEqual(MAU_CUA_DANG['cau-do-meo'], 'lat-dap-an'); assert.strictEqual(MAU_CUA_DANG['tim-vat-giau'], undefined);
// top-n: tiêu đề phải có số, 3–5 mục có tên + từ khoá ảnh; ráp đề giữ thứ tự mục, nhãn = thương hiệu, slug từ tiêu đề
const deTop = { tieu_de: '3 puzzles that survive a seven hour drive', moc: 'Pack them in the glove box', muc: [{ ten: 'Crossword book', chu: 'Pencil, not pen', truy: 'crossword book car' }, { ten: 'Sudoku pad', chu: '', truy: 'sudoku pad hand' }, { ten: 'Large print word search', chu: 'Readable in a moving car', truy: 'word search puzzle page' }], ket: ['Front Porch Puzzles'], am: 'pho' as const };
const topOk = { mau: 'top-n' as const, dang_bai: 'top-n', de: deTop, title: '3 printed puzzles that survive a seven hour drive', description: 'Phones die halfway. These three printed pages last the whole trip and need no signal. Free pages here: https://pickjot.com/printables/large-print-word-search/', nhan: 'Front Porch Puzzles' };
assert.deepStrictEqual(kiemDe(topOk), []);
assert.ok(kiemDe({ ...topOk, de: { ...deTop, tieu_de: 'Puzzles for a long drive' } }).some((l) => /con số/.test(l)));
assert.ok(kiemDe({ ...topOk, de: { ...deTop, muc: deTop.muc.slice(0, 2) } }).some((l) => /3–5 mục/.test(l)));
const t = rapDe({ sp, goc, dang_bai: 'top-n', mau: 'top-n', de: deTop, chu: { title: topOk.title, description: 'Phones die halfway. Three printed pages last the whole trip.' } });
assert.strictEqual(t.mau, 'top-n'); assert.deepStrictEqual((t.de as { muc: { truy: string }[] }).muc.map((m) => m.truy), ['crossword book car', 'sudoku pad hand', 'word search puzzle page']); assert.strictEqual((t.de as { nhan: string }).nhan, 'Front Porch Puzzles'); assert.ok(!('chu' in (t.de as { muc: object[] }).muc[1]!)); assert.ok(t.slug.startsWith('top-n-37192-3-puzzles'));
assert.ok(vanHeThong(sp, 'ai-con-nho').includes('no em dashes') && vanNguoiDung(goc, 'ai-con-nho', ['x']).includes('Hooks already used'));
// câu nói: tiếng Việt / Anh bị chặn (khán giả nói tiếng Anh, tên góc tiếng Việt chỉ là nhãn nội bộ)
const cn = { mau: 'cau-noi' as const, dang_bai: 'cau-noi-theo-nuoc', de: { tinh_huong: 'At hotel check-in', ngon_ngu: 'Japanese', truy: 'tokyo hotel desk', cau: [{ ban_ngu: 'チェックイン', doc: 'chekku-in', nghia: 'check in' }, { ban_ngu: '予約', doc: 'yoyaku', nghia: 'reservation' }, { ban_ngu: 'ありがとう', doc: 'arigatou', nghia: 'thanks' }] }, title: 'Say these 3 lines at a Tokyo hotel desk?', description: 'Three short lines for check-in in Japan, with how to say them. https://esimfares.com/', nhan: 'esimfares.com' };
assert.deepStrictEqual(kiemDe(cn), []); assert.ok(kiemDe({ ...cn, de: { ...cn.de, ngon_ngu: 'Vietnamese', cau: [{ ban_ngu: 'Xin chào', doc: 'sin chao', nghia: 'hello' }, { ban_ngu: 'Cảm ơn', doc: 'cam on', nghia: 'thanks' }, { ban_ngu: 'Đặt phòng', doc: 'dat phong', nghia: 'booking' }] } }).some((l) => /tiếng điểm đến/.test(l)));
// chữ đăng tiếng Việt bị chặn (29/10/2026 Sidecue dung-sai-40165 ra tiếng Việt vẫn DUYỆT); góc tiếng Việt → prompt dặn dịch sang tiếng Anh
assert.ok(kiemDe({ ...tot, description: tot.description + ' Hãy kiểm tra giá sau thời gian thử.' }).some((l) => /tiếng Việt/.test(l)), 'chữ tiếng Việt bị chặn');
assert.ok(vanNguoiDung({ ...goc, ten: 'Ngại trả phí đăng ký định kỳ' }, 'dung-sai', []).includes('write EVERYTHING in English'), 'góc tiếng Việt: dặn viết tiếng Anh');
// lồng tiếng giải thích (bước 6, 30/10/2026): dạng → mẫu giai-thich; lời dẫn 3–6 câu, 200–550 ký tự, không link / ký hiệu
assert.equal(MAU_CUA_DANG['giai-thich-giong'], 'giai-thich');
const deGt = { truy: 'ambulance highway night', moc: 'Tanker spill ahead. Your first call?', loi: ['Tanker spill ahead. Your first call?', 'Liquid is pooling across two lanes.', 'The driver is still inside the cab.', 'Most students grab another ambulance first.', 'Wrong: call the hazmat team, because scene safety comes first.'], ket: 'Save this for exam week', canh: [{ truy: 'overturned tanker truck highway', prompt: 'slow push-in on the truck, flashing lights' }, { truy: 'chemical spill on asphalt road', prompt: 'low angle slide over the liquid' }, { truy: 'truck driver inside cab', prompt: 'slow zoom on the driver' }, { truy: 'ambulance arriving highway', prompt: 'ambulance pulls in, lights flashing' }, { truy: 'hazmat team in protective suits', prompt: 'slow walk toward camera, smoke behind' }] };
const gt = { ...tot, mau: 'giai-thich' as const, dang_bai: 'giai-thich-giong', de: deGt };
assert.deepEqual(kiemDe(gt).filter((l) => /lời dẫn|móc trên video|dòng kết/.test(l)), [], 'đề lồng tiếng đúng luật thì qua');
assert.ok(kiemDe({ ...gt, de: { ...deGt, loi: deGt.loi.slice(0, 2) } }).some((l) => /4–7 câu/.test(l)), 'thiếu câu bị chặn');
assert.ok(kiemDe({ ...gt, de: { ...deGt, loi: ['Some people want a reading.', ...deGt.loi.slice(1)] } }).some((l) => /đúng là câu hook/.test(l)), 'câu đầu không phải hook bị chặn');
assert.ok(kiemDe({ ...gt, de: { ...deGt, loi: ['Tanker spill ahead. Your first call?', 'Short.', 'Too short.', 'Still short.'] } }).some((l) => /cần 150–480/.test(l)), 'lời dẫn quá ngắn bị chặn');
assert.ok(kiemDe({ ...gt, de: { ...deGt, loi: [...deGt.loi.slice(0, 2), 'See https://x.com now.', ...deGt.loi.slice(3)] } }).some((l) => /link/.test(l)), 'link trong lời đọc bị chặn');
// máy thị trường VN (Giỗ Chạp, 31/10/2026): chữ tiếng Việt là đúng, không chặn; prompt dặn viết tiếng Việt; không bảo "dịch sang tiếng Anh"
const viet = { ...tot, title: 'Rằm tháng 10 cúng gì? 3 điều nhà nào cũng hay quên', description: 'Mâm cúng rằm tháng 10 không cần cầu kỳ, nhưng nên có hương, hoa, nước sạch và bài khấn đúng ngày. Xem bài khấn đầy đủ tại trang.' };
assert.ok(!kiemDe({ ...viet, ngon_ngu: 'vi' }).some((l) => /tiếng Việt/.test(l)), 'máy VN: chữ tiếng Việt không bị chặn');
assert.ok(kiemDe(viet).some((l) => /tiếng Việt/.test(l)), 'máy US: chữ tiếng Việt vẫn bị chặn');
assert.ok(vanHeThong({ ...sp, ngon_ngu: 'vi' }, 'top-n').includes('Vietnamese') && !vanHeThong(sp, 'top-n').includes('Vietnamese'), 'prompt theo thị trường');
assert.ok(!vanNguoiDung({ ...goc, ten: 'Chuẩn bị lễ giỗ tại nhà' }, 'top-n', [], 'vi').includes('write EVERYTHING in English'), 'máy VN: không bảo dịch sang tiếng Anh');
assert.ok(kiemDe({ ...gt, de: { ...deGt, canh: deGt.canh.slice(0, 3) } }).some((l) => /một cảnh cho mỗi câu/.test(l)), 'thiếu cảnh bị chặn');
assert.ok(kiemDe({ ...gt, de: { ...deGt, canh: [{ ...deGt.canh[0]!, truy: 'searching old records' }, ...deGt.canh.slice(1)] } }).some((l) => /đa nghĩa/.test(l)), 'từ khoá cảnh đa nghĩa bị chặn (bài #4321 ra kệ đĩa nhạc)');
// HOOK GỐC TỪ QC SPY (31/10/2026, rule quan trọng): chọn một QC, sửa nhẹ (giữ ≥ 35% chữ), không mang tên Page gốc; prompt có danh sách hook
const hk = [{ id: '3496181930676276', chu: 'Did you know that the moment you were born is the most important moment of your life?', ngay: 734, page: 'Your Astrology Reading' }];
const dungHook = { ...tot, title: 'Did you know the moment you were born is the most important moment of your life?' };
assert.ok(giuHook(dungHook.title, hk[0]!.chu) >= GIU_HOOK_TOI_THIEU, 'sửa nhẹ: giữ đủ chữ gốc');
assert.ok(giuHook('Free birth chart tools for curious people', hk[0]!.chu) < GIU_HOOK_TOI_THIEU, 'viết lại mới: không đủ chữ gốc');
assert.ok(!kiemDe({ ...dungHook, hooks: hk, hook_qc: hk[0]!.id }).some((l) => /hook QC|tên nhà quảng cáo/.test(l)), 'hook sửa nhẹ + có chữ "your" vẫn qua');
assert.ok(kiemDe({ ...dungHook, hooks: hk, hook_qc: '' }).some((l) => /chưa chọn hook QC/.test(l)), 'không chọn QC gốc bị chặn');
assert.ok(kiemDe({ ...tot, hooks: hk, hook_qc: hk[0]!.id }).some((l) => /sửa quá xa/.test(l)), 'hook viết lại quá xa bị chặn');
assert.ok(kiemDe({ ...dungHook, title: dungHook.title + ' Your Astrology Reading knows.', hooks: hk, hook_qc: hk[0]!.id }).some((l) => /tên nhà quảng cáo/.test(l)), 'mang tên Page gốc bị chặn');
assert.ok(vanNguoiDung(goc, 'top-n', [], 'en', hk).includes('3496181930676276') && vanNguoiDung(goc, 'top-n', [], 'en', hk).includes('WORD FOR WORD'), 'prompt có hook gốc + dặn giữ nguyên văn');
{ const ds = [{ id: 'kenh:931', chu: 'a', ngay: 1, page: '' }, { id: '1998170110766377', chu: 'b', ngay: 1, page: '' }];
  assert.equal(timHook(ds, '931')?.id, 'kenh:931', 'mô hình bỏ tiền tố kenh: vẫn khớp'); assert.equal(timHook(ds, '[1998170110766377]')?.id, '1998170110766377', 'có ngoặc vẫn khớp'); assert.equal(timHook(ds, 'x'), null, 'không có số thì không khớp bừa'); }
console.log('may-de: phần thuần đạt');
