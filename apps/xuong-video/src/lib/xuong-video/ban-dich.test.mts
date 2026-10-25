// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/ban-dich.test.mts
import assert from 'node:assert';
import { chuoiCanDich, ganDich, theoNgonNgu, giongDong } from './ban-dich';
import { gopKieu } from './kieu';
const ds = [
  { id: 1, chu_man: 'THE BIGGEST CHEESE', thoai: [{ nhan_vat: '', dien_xuat: 'dry', loi: 'Felix wanted that cheese.', url: 'u1', dai: 2.1 }] },
  { id: 2, chu_man: 'PLAN A\n@1.5 PLAN B', thoai: [{ nhan_vat: 'Felix', dien_xuat: '', loi: 'Sing for me!', url: 'u2' }, { nhan_vat: 'Crow', dien_xuat: '', loi: 'No.' }] },
  { id: 3, chu_man: '', thoai: [] },
];
assert.deepStrictEqual(chuoiCanDich(ds as never), ['THE BIGGEST CHEESE', 'Felix wanted that cheese.', 'PLAN A', 'PLAN B', 'Sing for me!', 'No.'], 'câu chưa có giọng cũng dịch (bản dịch đọc cả nó)');
const d = new Map([['THE BIGGEST CHEESE', 'MIẾNG PHÔ MAI TO NHẤT'], ['PLAN A', 'KẾ A'], ['PLAN B', 'KẾ B'], ['Sing for me!', 'Hát cho tôi nghe đi!']]);
type S = { id: number; chu_man: string; chu_man_dich?: Record<string, { goc: string; chu: string }>; thoai: { nhan_vat: string; dien_xuat: string; loi: string; url?: string | null; dai?: number; dich?: Record<string, { goc: string; loi: string; url?: string | null }> }[] };
const gan = ganDich(ds as never as S[], 'vi', d, new Map([['1:0', 'v1'], ['2:1', 'v3']]));
const kq = theoNgonNgu(gan, 'vi'); const r = kq.canh;
assert.strictEqual(kq.coDich, true);
assert.strictEqual(kq.thieu, 1, 'Felix "Sing for me!" chưa có giọng dịch');
assert.strictEqual(theoNgonNgu(ds as never as S[], 'vi').coDich, false, 'chưa lồng tiếng → coDich false');
assert.strictEqual(r[0]!.chu_man, 'MIẾNG PHÔ MAI TO NHẤT');
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
// câu gốc sửa SAU khi dịch → bản dịch cũ không dùng: chữ gốc, im
const sua = gan.map((c) => (c.id === 1 ? { ...c, chu_man: 'THE BIG CHEESE', thoai: c.thoai.map((x) => ({ ...x, loi: 'Felix wanted it.' })) } : c));
const r2 = theoNgonNgu(sua, 'vi');
assert.strictEqual(r2.canh[0]!.chu_man, 'THE BIG CHEESE', 'chữ màn đổi sau khi dịch → giữ chữ gốc');
assert.strictEqual(r2.canh[0]!.thoai[0]!.url, null, 'câu đổi sau khi dịch → im, không phát bản dịch cũ');
assert.strictEqual(r2.thieu, 2);
// giọng của dòng: file gốc → nhân vật → lời dẫn
const nv = [{ ten: 'Felix', giong_model: 'm', giong_id: 'river' }, { ten: 'Crow', giong_model: '', giong_id: '' }];
const kt = { giong_dan: { model: 'm', voice: 'george' } };
assert.deepStrictEqual(giongDong({ nhan_vat: 'Felix', giong: 'm|bill' }, nv, kt), { model: 'm', voice: 'bill' });
assert.deepStrictEqual(giongDong({ nhan_vat: 'Felix' }, nv, kt), { model: 'm', voice: 'river' });
assert.strictEqual(giongDong({ nhan_vat: 'Crow' }, nv, kt), null, 'nhân vật chưa có giọng → không lấy nhầm giọng lời dẫn');
assert.deepStrictEqual(giongDong({ nhan_vat: '' }, nv, kt), { model: 'm', voice: 'george' });
// chữ màn: phim chưa chọn kiểu → băng nền tối; phim có kiểu (QC chép mẫu) → giữ kiểu
assert.strictEqual(gopKieu(undefined).nen, undefined);   // anh 25/10/2026: không băng nền đen — chữ viền đen dày
assert.strictEqual(gopKieu(undefined).vien_day, 0.12);
assert.strictEqual(gopKieu({}, { mau: '#FF0000' }).nen, undefined);
assert.strictEqual(gopKieu({ nen: '#000000' }).nen, '#000000');   // phim tự chọn kiểu có nền thì giữ
assert.strictEqual(gopKieu({ font: 'Montserrat Black', vien_day: 0.1 }).nen, undefined);
console.log('ban-dich.test: ok');
