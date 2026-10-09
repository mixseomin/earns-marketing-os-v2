// Tự kiểm bộ đọc thoại theo dòng + người nói + giá giọng (một nguồn cho thẻ shot, bảng ＋, timeline, máy chủ — #1204, audit 09/10/2026).
// Chạy: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/am-thanh.test.mts
import assert from 'node:assert';
import { dongThoai, giaGiong, tenNoi, cungTen, timNv, LOI_DAN } from './am-thanh';
import type { NhanVat } from './kieu';

const nv = [
  { id: 1, ten: 'Chị Lan', loai: 'nhan_vat' }, { id: 2, ten: 'Lio', loai: 'nhan_vat' }, { id: 3, ten: 'Phòng ngủ', loai: 'boi_canh' },
] as unknown as NhanVat[];
const shot = (loi_thoai: string, nhan_vat: number[], thoai: { nhan_vat: string; dien_xuat: string; loi: string; url?: string }[] = []) => ({ loi_thoai, nhan_vat, thoai, thoai_url: null });

// Chuỗi cũ không ghi tên → người nói = nhân vật đầu của shot (không phải "Lời dẫn"), bỏ ngoặc kép.
let d = dongThoai(shot('"Đeo bra gọng 10 tiếng mỗi ngày, tối về vai hằn đỏ hết."', [3, 1]), nv);
assert.deepStrictEqual(d, [{ nhan_vat: 'Chị Lan', dien_xuat: '', loi: 'Đeo bra gọng 10 tiếng mỗi ngày, tối về vai hằn đỏ hết.' }]);
// "Tên (diễn xuất): lời" + nhiều dòng + bỏ phần chữ trên màn.
d = dongThoai(shot('Lio (cười khẩy): "Rùa mà đòi đua?"\nChị Lan: "Đang giảm 50%." Chữ: Mua 2 tặng 1', [1, 2]), nv);
assert.deepStrictEqual(d.map((x) => [x.nhan_vat, x.dien_xuat, x.loi]), [['Lio', 'cười khẩy', 'Rùa mà đòi đua?'], ['Chị Lan', '', 'Đang giảm 50%.']]);
// "Tên:" không phải nhân vật (vd "Lưu ý:") → không coi là người nói.
d = dongThoai(shot('Lưu ý: giữ bình tĩnh', [2]), nv);
assert.strictEqual(d[0]!.nhan_vat, 'Lio');
// Shot đã có dòng → dùng nguyên, bỏ dòng rỗng.
d = dongThoai(shot('x', [1], [{ nhan_vat: 'Lio', dien_xuat: '', loi: 'A' }, { nhan_vat: '', dien_xuat: '', loi: ' ' }]), nv);
assert.strictEqual(d.length, 1);
// Rỗng → không dòng nào.
assert.deepStrictEqual(dongThoai(shot('', [1]), nv), []);
// nguoiNoi đi cùng một bộ tách.
// Giá: theo 1k ký tự / giây / lượt; chưa công bố → null (không đoán).
assert.strictEqual(giaGiong({ giaCents: 10, donVi: '1k_ky_tu' }, 500), 5);
assert.strictEqual(giaGiong({ giaCents: 0.2, donVi: 'giay' }, 150), 2);
assert.strictEqual(giaGiong({ giaCents: 0.7, donVi: 'luot' }, 999), 0.7);
assert.strictEqual(giaGiong({ giaCents: null, donVi: 'khac' }, 500), null);
assert.strictEqual(giaGiong(undefined, 500), null);
console.log('am-thanh: mọi bài tự kiểm qua');

// Người nói / tìm nhân vật theo tên — một luật cho thẻ shot, bảng ＋, timeline, máy chủ.
const nvTen = [{ ten: 'Chị Lan', loai: 'nhan_vat' }, { ten: 'Bé Na', loai: 'nhan_vat' }];
assert.equal(tenNoi({ nhan_vat: '' }), LOI_DAN);
assert.equal(tenNoi({ nhan_vat: '   ' }), LOI_DAN);
assert.equal(tenNoi({ nhan_vat: 'Chị Lan' }), 'Chị Lan');
assert.ok(cungTen(' chị lan ', 'Chị Lan'));
assert.ok(!cungTen('Chị Lan', 'Bé Na'));
assert.equal(timNv(nvTen, 'CHỊ LAN ')?.ten, 'Chị Lan');
assert.equal(timNv(nvTen, 'Lời dẫn'), undefined);
assert.equal(timNv([], 'Chị Lan'), undefined);
// Shot cũ chỉ có chuỗi: dòng ghi tên khác hoa thường vẫn nhận đúng nhân vật; dòng không tên → nhân vật đầu của shot.
const cTen = { thoai: [], loi_thoai: 'chị lan (cười): Mặc cả ngày\nNhẹ tênh', nhan_vat: [1], thoai_url: null } as never;
const dsTen = dongThoai(cTen, [{ id: 1, ...nvTen[0] }, { id: 2, ...nvTen[1] }] as never);
assert.equal(dsTen[0]!.nhan_vat, 'chị lan');
assert.equal(dsTen[0]!.dien_xuat, 'cười');
assert.equal(dsTen[1]!.nhan_vat, 'Chị Lan');
