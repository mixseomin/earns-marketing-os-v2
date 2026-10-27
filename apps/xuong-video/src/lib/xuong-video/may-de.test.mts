// node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/may-de.test.mts — phần thuần của máy sinh đề (không gọi mô hình)
import assert from 'node:assert';
import { kiemDe, rapDe, slugDe, MAU_CUA_DANG, vanHeThong, vanNguoiDung } from './may-de';

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
assert.strictEqual(MAU_CUA_DANG['top-n'], 'top-n'); assert.strictEqual(MAU_CUA_DANG['doan-nam-gia'], 'bai-anh'); assert.strictEqual(MAU_CUA_DANG['so-sanh'], 'so-sanh'); assert.strictEqual(MAU_CUA_DANG['cau-do-meo'], undefined);
// top-n: tiêu đề phải có số, 3–5 mục có tên + từ khoá ảnh; ráp đề giữ thứ tự mục, nhãn = thương hiệu, slug từ tiêu đề
const deTop = { tieu_de: '3 puzzles that survive a seven hour drive', moc: 'Pack them in the glove box', muc: [{ ten: 'Crossword book', chu: 'Pencil, not pen', truy: 'crossword book car' }, { ten: 'Sudoku pad', chu: '', truy: 'sudoku pad hand' }, { ten: 'Large print word search', chu: 'Readable in a moving car', truy: 'word search puzzle page' }], ket: ['Front Porch Puzzles'], am: 'pho' as const };
const topOk = { mau: 'top-n' as const, dang_bai: 'top-n', de: deTop, title: '3 printed puzzles that survive a seven hour drive', description: 'Phones die halfway. These three printed pages last the whole trip and need no signal. Free pages here: https://pickjot.com/printables/large-print-word-search/', nhan: 'Front Porch Puzzles' };
assert.deepStrictEqual(kiemDe(topOk), []);
assert.ok(kiemDe({ ...topOk, de: { ...deTop, tieu_de: 'Puzzles for a long drive' } }).some((l) => /con số/.test(l)));
assert.ok(kiemDe({ ...topOk, de: { ...deTop, muc: deTop.muc.slice(0, 2) } }).some((l) => /3–5 mục/.test(l)));
const t = rapDe({ sp, goc, dang_bai: 'top-n', mau: 'top-n', de: deTop, chu: { title: topOk.title, description: 'Phones die halfway. Three printed pages last the whole trip.' } });
assert.strictEqual(t.mau, 'top-n'); assert.deepStrictEqual((t.de as { muc: { truy: string }[] }).muc.map((m) => m.truy), ['crossword book car', 'sudoku pad hand', 'word search puzzle page']); assert.strictEqual((t.de as { nhan: string }).nhan, 'Front Porch Puzzles'); assert.ok(!('chu' in (t.de as { muc: object[] }).muc[1]!)); assert.ok(t.slug.startsWith('top-n-37192-3-puzzles'));
assert.ok(vanHeThong(sp, 'ai-con-nho').includes('no em dashes') && vanNguoiDung(goc, 'ai-con-nho', ['x']).includes('Hooks already used'));
console.log('may-de: phần thuần đạt');
