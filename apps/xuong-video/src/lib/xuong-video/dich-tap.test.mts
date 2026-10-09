// Tự kiểm phần thuần của bước dịch tập: đếm chữ, ước tiền, gộp lời dịch vào dòng thoại gốc. (Phần DB kiểm bằng scripts/dich-tap.mts --uoc trên box.)
import assert from 'node:assert';
import { demChu, uocDichCents, gopThoaiDich } from './dich-tap';
const goc = [{ nhan_vat: 'Bà Linda', dien_xuat: 'thì thầm', loi: 'Đoán xem bao nhiêu nào?', url: 'x.mp3' }, { nhan_vat: '', dien_xuat: '', loi: 'Rẻ không tin nổi.' }];
const m = gopThoaiDich(goc, ['Guess how much?', 'Unbelievably cheap.']);
assert.deepEqual(m.map((d) => d.loi), ['Guess how much?', 'Unbelievably cheap.']);
assert.equal(m[0]!.nhan_vat, 'Bà Linda'); assert.equal(m[0]!.dien_xuat, 'thì thầm'); assert.equal(m[0]!.url, 'x.mp3');
// lệch số dòng: thiếu → giữ gốc; thừa → bỏ; rỗng → giữ gốc
assert.deepEqual(gopThoaiDich(goc, ['Only one']).map((d) => d.loi), ['Only one', 'Rẻ không tin nổi.']);
assert.deepEqual(gopThoaiDich(goc, ['a', 'b', 'c']).length, 2);
assert.deepEqual(gopThoaiDich(goc, ['', 'b']).map((d) => d.loi), ['Đoán xem bao nhiêu nào?', 'b']);
assert.deepEqual(gopThoaiDich([], ['x']), []);
const d = { kichBan: 'abc', baiDang: null, canh: [{ id: 1, chu_man: '12345', thoai: ['ab', 'c'] }] };
assert.equal(demChu(d), 3 + 2 + 5 + 3);   // 'null' → JSON của '' là '""' = 2 ký tự
assert.ok(uocDichCents('claude-opus-5-5', 18_000) > uocDichCents('claude-opus-5-5', 1_000));
assert.ok(uocDichCents('claude-sonnet-5-5', 18_000) < uocDichCents('claude-opus-5-5', 18_000));
const u = uocDichCents('claude-opus-5-5', 14_023);   // đo thật: $0,26 — ước phải nằm trong ±25%
assert.ok(u > 26 * 0.75 && u < 26 * 1.25, String(u));
console.log('dich-tap.test: ok', uocDichCents('claude-opus-5-5', 18_000).toFixed(1), 'cents/18k ký tự');
