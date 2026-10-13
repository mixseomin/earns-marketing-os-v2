// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/ban-dich.test.mts
import assert from 'node:assert';
import { chuoiCanDich, apDich, giongDong } from './ban-dich';
import { gopKieu } from './kieu';
const ds = [
  { id: 1, chu_man: 'THE BIGGEST CHEESE', thoai: [{ nhan_vat: '', dien_xuat: 'dry', loi: 'Felix wanted that cheese.', url: 'u1', dai: 2.1 }] },
  { id: 2, chu_man: 'PLAN A\n@1.5 PLAN B', thoai: [{ nhan_vat: 'Felix', dien_xuat: '', loi: 'Sing for me!', url: 'u2' }, { nhan_vat: 'Crow', dien_xuat: '', loi: 'No.' }] },
  { id: 3, chu_man: '', thoai: [] },
];
assert.deepStrictEqual(chuoiCanDich(ds as never), ['THE BIGGEST CHEESE', 'Felix wanted that cheese.', 'PLAN A', 'PLAN B', 'Sing for me!', 'No.'], 'câu chưa có giọng cũng dịch (bản dịch đọc cả nó)');
const d = new Map([['THE BIGGEST CHEESE', 'MIẾNG PHÔ MAI TO NHẤT'], ['PLAN A', 'KẾ A'], ['PLAN B', 'KẾ B'], ['Sing for me!', 'Hát cho tôi nghe đi!']]);
const r = apDich(ds as never, d, new Map([["1:0", "v1"], ["2:1", "v3"]])) as unknown as { chu_man: string; thoai: { url?: string | null; dai?: number; loi: string }[] }[];
assert.strictEqual(r[1]!.chu_man, 'KẾ A\n@1.5 KẾ B', 'giữ mốc giây');
assert.strictEqual(r[2]!.chu_man, '');
assert.strictEqual(r[0]!.thoai[0]!.url, 'v1', 'file giọng dịch thay file gốc');
assert.strictEqual(r[0]!.thoai[0]!.dai, undefined, 'bỏ độ dài đo của file gốc');
assert.strictEqual(r[1]!.thoai[0]!.url, null, 'không có file dịch → im, không lẫn giọng gốc');
assert.strictEqual(r[1]!.thoai[0]!.loi, 'Hát cho tôi nghe đi!');
assert.strictEqual(r[1]!.thoai[1]!.url, 'v3', 'câu chưa có giọng gốc vẫn có giọng dịch');
assert.strictEqual(r[1]!.thoai[1]!.loi, 'No.', 'chưa dịch được → giữ câu gốc');
assert.strictEqual(ds[1]!.chu_man, 'PLAN A\n@1.5 PLAN B', 'không sửa shot gốc');
assert.strictEqual(ds[0]!.thoai[0]!.url, 'u1');
// giọng của dòng: file gốc → nhân vật → lời dẫn
const nv = [{ ten: 'Felix', giong_model: 'm', giong_id: 'river' }, { ten: 'Crow', giong_model: '', giong_id: '' }];
const kt = { giong_dan: { model: 'm', voice: 'george' } };
assert.deepStrictEqual(giongDong({ nhan_vat: 'Felix', giong: 'm|bill' }, nv, kt), { model: 'm', voice: 'bill' });
assert.deepStrictEqual(giongDong({ nhan_vat: 'Felix' }, nv, kt), { model: 'm', voice: 'river' });
assert.strictEqual(giongDong({ nhan_vat: 'Crow' }, nv, kt), null, 'nhân vật chưa có giọng → không lấy nhầm giọng lời dẫn');
assert.deepStrictEqual(giongDong({ nhan_vat: '' }, nv, kt), { model: 'm', voice: 'george' });
// chữ màn: phim chưa chọn kiểu → băng nền tối; phim có kiểu (QC chép mẫu) → giữ kiểu
assert.strictEqual(gopKieu(undefined).nen, '#000000');
assert.strictEqual(gopKieu({}, { mau: '#FF0000' }).nen, '#000000');
assert.strictEqual(gopKieu({ font: 'Montserrat Black', vien_day: 0.1 }).nen, undefined);
console.log('ban-dich.test: ok');
