// node_modules/.bin/tsx apps/web/src/lib/tai-san/ap-dung.test.mts
import { strict as a } from 'node:assert';
import { apDung, demO, ganLuot, nhamTrung } from './ap-dung';
import type { KenhSp, PhuongPhap, ShopNut, SpNut } from './kieu';

const sp = (khoa: string, ten: string): SpNut => ({ khoa, ten, anh: null, ma: null, phu: null, url: null, trangThai: 'dang_ban', gia: null, views7d: null, don: null, tien: null, ky: '30n', canhBao: null, ghiChu: null });
const shop = (khoa: string, ten: string, loai: ShopNut['loai'], ds: SpNut[]): ShopNut => ({ khoa, ten, loai, url: null, sp: ds, tien: null, ky: '30n', loi: null, ghiChu: null });
const pp = (key: string, nham: string[], bat = true): PhuongPhap => ({ key, nhan: key, moTa: '', nham, buoc: ['chưa làm', 'làm'], noi: { tk: [] }, may: null, nguong: null, thuTu: 0, bat });

const lib = [pp('pinterest', ['etsy:FrontPorchZ', 'kdp:htuan82']), pp('shorts', ['etsy']), pp('tat', ['*'], false)];
const rows: KenhSp[] = [{ sanPham: 'puzzle-books:bible', ten: 'Bible Word Search & Reflection Book', khop: 'Bible Word Search',
  o: { pinterest: { kenh: 'pinterest', muc: 2, xong: 1, tong: 100, dich: 'https://x', canhBao: null, the: null, capNhat: 'x', ngayDang: '2026-10-01' } } }];
const shops = [
  shop('etsy:FrontPorchZ', 'Etsy · FrontPorchZ', 'etsy', [sp('etsy:1', 'Bible Word Search for Seniors, Large Print'), sp('etsy:2', 'Large Print Sudoku for Seniors')]),
  shop('kdp:htuan82', 'KDP · htuan82', 'kdp', [sp('d:1', 'Bible Word Search & Reflection Book'), sp('d:2', 'Large Print  Sudoku for Seniors')]),
  shop('udemy:', 'Udemy', 'san', [sp('u:1', 'Khoá A'), sp('u:2', 'Khoá B')]),
];
const ap = apDung(shops, lib, rows);

// nhắm: khoá shop, nền, '*'
a.equal(nhamTrung(lib[0]!, 'etsy:FrontPorchZ'), true);
a.equal(nhamTrung(lib[1]!, 'etsy:FrontPorchZ'), true);          // nền
a.equal(nhamTrung(lib[1]!, 'kdp:htuan82'), false);
a.equal(nhamTrung(lib[2]!, 'udemy:'), true);                   // '*' (nhưng tắt → không áp)

// tựa: hai listing của cùng cuốn (Etsy + KDP) gộp về khoá sổ; dòng thật giữ nguyên, ô shorts (nhắm etsy) là ô ảo
const bible = ap.tua.find((t) => t.khoa === 'puzzle-books:bible')!;
a.equal(bible.ban.length, 2);
a.deepEqual(bible.ban.map((b) => b.noi), ['Etsy', 'KDP']);
a.equal(bible.o.pinterest!.ao, undefined);
a.equal(bible.o.pinterest!.xong, 1);
a.equal(bible.o.shorts!.ao, true);
a.equal(bible.o.shorts!.xong, null);                           // chưa đo = null, không phải 0

// sản phẩm không khớp khop nào nhưng CÙNG TÊN ở hai shop → MỘT tựa 'ten:…' (khoảng trắng thừa không tách tựa), đủ ô ảo theo cả hai shop
const sudoku = ap.tua.find((t) => t.khoa === 'ten:large print sudoku for seniors')!;
a.deepEqual(sudoku.ban.map((b) => b.noi), ['Etsy', 'KDP']);
a.deepEqual(Object.keys(sudoku.o).sort(), ['pinterest', 'shorts']);
a.equal(ap.tua.length, 2);

// shop không phương pháp nào nhắm → vào danh sách thiếu, KHÔNG đẻ tựa rỗng; phương pháp tắt không tính
a.equal(ap.tua.find((t) => t.khoa === 'u:1'), undefined);
a.deepEqual(ap.thieu, [{ shop: 'udemy:', ten: 'Udemy', soSp: 2 }]);
a.deepEqual(demO(ap), { ao: 3, that: 1, sp: 2 });   // sudoku: pinterest + shorts · bible: shorts

// lượt theo nguồn: pinterest đọc từ refs Gumroad; sản phẩm có số mà không có pinterest → 0 thật; tựa không dòng số → null; shorts không nguồn → undefined
ganLuot(ap, { 'etsy:1': { 'pinterest.com': 5, direct: 9 }, 'd:1': { direct: 2 } });
a.equal(bible.o.pinterest!.luot7, 5);
a.equal(bible.o.shorts!.luot7, undefined);
a.equal(sudoku.o.pinterest!.luot7, null);
ganLuot(ap, { 'etsy:2': { direct: 3 } });
a.equal(sudoku.o.pinterest!.luot7, 0);
console.log('ap-dung: 20/20 ok');
