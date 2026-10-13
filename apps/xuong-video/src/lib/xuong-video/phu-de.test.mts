// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/phu-de.test.mts
import assert from 'node:assert';
import { chuoiCanDich, apDich } from './phu-de';
import { tepAss } from './xuat';
const ds = [
  { id: 1, chu_man: 'THE BIGGEST CHEESE', thoai: [{ nhan_vat: '', dien_xuat: 'dry', loi: 'Felix wanted that cheese.', url: 'u1' }] },
  { id: 2, chu_man: 'PLAN A\n@1.5 PLAN B', thoai: [{ nhan_vat: 'Felix', dien_xuat: '', loi: 'Sing for me!', url: 'u2' }, { nhan_vat: 'Crow', dien_xuat: '', loi: 'No.' }] },
  { id: 3, chu_man: '', thoai: [] },
];
assert.deepStrictEqual(chuoiCanDich(ds as never), ['THE BIGGEST CHEESE', 'Felix wanted that cheese.', 'PLAN A', 'PLAN B', 'Sing for me!'], 'câu chưa có giọng không cần phụ đề');
const d = new Map([['THE BIGGEST CHEESE', 'MIẾNG PHÔ MAI TO NHẤT'], ['PLAN A', 'KẾ A'], ['PLAN B', 'KẾ B'], ['Sing for me!', 'Hát cho tôi nghe đi!']]);
const r = apDich(ds as never, d);
assert.strictEqual(r.canh[1]!.chu_man, 'KẾ A\n@1.5 KẾ B', 'giữ mốc giây');
assert.strictEqual(r.canh[2]!.chu_man, '');
assert.deepStrictEqual(r.phuDe, { u1: 'Felix wanted that cheese.', u2: 'Hát cho tôi nghe đi!' }, 'chưa dịch → giữ câu gốc');
assert.strictEqual((ds[1] as { chu_man: string }).chu_man, 'PLAN A\n@1.5 PLAN B', 'không sửa shot gốc');
// tệp ASS: có Style PhuDe + dòng ở đáy (\an2), dài thì xuống dòng
const ass = tepAss({ W: 1080, H: 1920, viTri: 'tren', cau: [], phuDe: [{ tu: 1, den: 3, chu: 'Felix: Một câu khá dài để xem phụ đề có tự xuống dòng khi vượt bề rộng khung hình dọc hay không nhé' }] });
assert.ok(ass.includes('Style: PhuDe,') && /Dialogue: 200,0:00:01\.00,0:00:03\.00,PhuDe,,0,0,0,,\{\\an2\}.+\\N/.test(ass), ass.split('\n').filter((x) => x.includes('PhuDe')).join('\n'));
assert.ok(!tepAss({ W: 1080, H: 1920, viTri: 'tren', cau: [] }).includes('PhuDe'), 'không phụ đề thì không có style thừa');
console.log('phu-de.test: ok');
