// Tự kiểm: PHÂN RÃ KỊCH BẢN — phần thuần (phan-ra-thuan.ts). Chạy:
//   NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx src/lib/xuong-video/phan-ra-thuan.test.mts   (cwd apps/xuong-video)
import assert from 'node:assert';
import { tachTen, bamPhanRa, keHoach, lienKetShot, baoCaoChuanBi, taPhanRa, PHIEN_PHAN_RA, type CanhVao, type PhanRaKq } from './phan-ra-thuan';
import type { BienThe, NhanVat } from './kieu';

const bt = (id: number, nv: number, nhom: string, ten: string, o: Partial<BienThe> = {}): BienThe => ({ id, nhan_vat_id: nv, nhom, ten, mo_ta: `${ten} desc`, anh_url: `u${id}`, ...o });
const av = (id: number, loai: string, ten: string, o: Record<string, unknown> = {}): NhanVat => ({ id, loai, ten, mo_ta: `${ten} mô tả`, anh_ref: ['a'], bo_set_id: null, thuoc_id: null, bien_the: [], ...o } as unknown as NhanVat);
const shot = (id: number, thu_tu: number, o: Partial<CanhVao> = {}): CanhVao & { tap_id: number } => ({ id, tap_id: 9, thu_tu, nhanh: '', canh: 'Thang máy', phan_doan: 'Thang máy', goc_may: '', hanh_dong: `hành động ${thu_tu}`, loi_thoai: '', thoai: [], trang_phuc: '', prompt_anh: `prompt ${thu_tu}`, nhan_vat: [], bien_the: [], ...o });

// Lâm Hạ (1): sơ mi có thẻ (10), vết cà phê (11, gắn tập 1), cười (12, biểu cảm). Vivian (2): đầm đỏ (20). Thẻ nhân viên (5, đạo cụ). Sảnh (7, bối cảnh có bộ set) + bục lan (8, cấu kiện).
const nhanVat: NhanVat[] = [
  av(1, 'nhan_vat', 'Lâm Hạ', { bien_the: [bt(10, 1, 'trang_phuc', 'Sơ mi trắng (có thẻ)'), bt(11, 1, 'vet', 'Vết cà phê ngực trái', { dung_tap: [1] }), bt(12, 1, 'bieu_cam', 'Cười')] }),
  av(2, 'nhan_vat', 'Vivian', { bien_the: [bt(20, 2, 'trang_phuc', 'Đầm đỏ đô công sở')] }),
  av(5, 'dao_cu', 'Thẻ nhân viên'),
  av(7, 'boi_canh', 'Sảnh thang máy', { anh_ref: [], bo_set_id: 3 }),
  av(8, 'cau_kien', 'Bục lan trắng', { thuoc_id: 7 }),
];

// 1. tachTen
assert.deepStrictEqual(tachTen('Lâm Hạ · Sơ mi trắng'), ['Lâm Hạ', 'Sơ mi trắng']);
assert.deepStrictEqual(tachTen('Lâm Hạ • Đồng hồ · dây bạc'), ['Lâm Hạ', 'Đồng hồ · dây bạc'], 'cắt ở dấu ĐẦU TIÊN');
assert.deepStrictEqual(tachTen('Thẻ nhân viên'), ['Thẻ nhân viên']);

// 2. bamPhanRa: đổi chữ shot → đổi mã; đổi phần GẮN (nhan_vat / bien_the) → KHÔNG đổi (lượt phân rã gắn xong không tự làm mình cũ)
const s1 = [shot(101, 1), shot(102, 2)];
const b0 = bamPhanRa({ kich_ban: 'KB' }, s1);
assert.strictEqual(bamPhanRa({ kich_ban: 'KB' }, [shot(101, 1, { nhan_vat: [1, 2], bien_the: [10] }), shot(102, 2)]), b0, 'gắn đổi không làm cũ');
assert.notStrictEqual(bamPhanRa({ kich_ban: 'KB' }, [shot(101, 1, { hanh_dong: 'khác' }), shot(102, 2)]), b0, 'chữ shot đổi → cũ');
assert.notStrictEqual(bamPhanRa({ kich_ban: 'KB2' }, s1), b0, 'kịch bản đổi → cũ');

// 3. keHoach: dùng lại món có sẵn (kể cả AI rút gọn tên), tạo món mới gắn tập, thêm tập cho món đang gắn tập, cấu kiện có cha, nhân vật lạ → không khớp
const kq: Pick<PhanRaKq, 'thanh_phan' | 'shot'> = {
  thanh_phan: [
    { loai: 'look', cua: 'Lâm Hạ', nhom: 'trang_phuc', ten: 'Sơ mi trắng', co_san: true, mo_ta: '', ly_do: '' },             // rút gọn → khớp "Sơ mi trắng (có thẻ)"
    { loai: 'look', cua: 'Lâm Hạ', nhom: 'do_deo', ten: 'Đồng hồ bạc', co_san: false, mo_ta: 'silver watch, left wrist', ly_do: 'S1' },
    { loai: 'look', cua: 'Lâm Hạ', nhom: 'vet', ten: 'Vết cà phê ngực trái', co_san: true, mo_ta: '', ly_do: 'S2' },         // gắn tập 1, tập 2 cũng dùng → thêm tập
    { loai: 'look', cua: 'Lâm Hạ', nhom: 'toc', ten: 'Xoã dài', co_san: false, mo_ta: 'long straight black hair', ly_do: '' },
    { loai: 'dao_cu', cua: '', nhom: '', ten: 'Thẻ nhân viên', co_san: true, mo_ta: '', ly_do: '' },
    { loai: 'dao_cu', cua: '', nhom: '', ten: 'Ly cà phê giấy', co_san: false, mo_ta: 'paper coffee cup', ly_do: 'S2' },
    { loai: 'cau_kien', cua: 'Sảnh thang máy', nhom: '', ten: 'Bảng chỉ dẫn', co_san: false, mo_ta: 'black glass directory', ly_do: '' },
    { loai: 'look', cua: 'Người lạ', nhom: 'toc', ten: 'Tóc ngắn', co_san: false, mo_ta: 'x', ly_do: '' },
    { loai: 'look', cua: 'Lâm Hạ', nhom: 'do_deo', ten: 'Đồng hồ bạc', co_san: false, mo_ta: 'dup', ly_do: '' },              // trùng trong cùng lượt → một món
  ],
  shot: [],
};
const kh = keHoach(kq, nhanVat, 2);
assert.deepStrictEqual(kh.taoBienThe.map((b) => `${b.cua}/${b.nhom}/${b.ten}/${b.dung_tap}`).sort(), ['Lâm Hạ/do_deo/Đồng hồ bạc/2', 'Lâm Hạ/toc/Xoã dài/2'], 'chỉ tạo món mới, gắn tập 2, không trùng');
assert.deepStrictEqual(kh.themTap, [{ id: 11, dung_tap: [1, 2] }], 'vết đang gắn tập 1 → thêm tập 2');
assert.deepStrictEqual(kh.taoAnchor.map((a) => `${a.loai}/${a.ten}/${a.cha}`).sort(), ['cau_kien/Bảng chỉ dẫn/Sảnh thang máy', 'dao_cu/Ly cà phê giấy/null']);
assert.ok(kh.khongKhop.some((x) => x.includes('Người lạ')), 'look của nhân vật không có → báo không khớp');

// 4. lienKetShot (sau khi tạo món mới: đồng hồ id 13). S1: Hạ có đồng hồ, CHƯA vết; S2: Hạ có vết. Vivian ở S1 không kê look → giữ đầm.
const nv2: NhanVat[] = nhanVat.map((v) => v.id === 1 ? { ...v, bien_the: [...(v.bien_the ?? []), bt(13, 1, 'do_deo', 'Đồng hồ bạc', { anh_url: null })] } : v);
const shots = [shot(101, 1, { nhan_vat: [1, 2, 7], bien_the: [10, 11, 12, 20] }), shot(102, 2, { nhan_vat: [1], bien_the: [10] })];
const ma = new Map([['S1', 101], ['S2', 102]]);
const lk = lienKetShot({ shot: [
  { ma: 'S1', dung: ['Lâm Hạ', 'Lâm Hạ · Sơ mi trắng (có thẻ)', 'Lâm Hạ · Đồng hồ bạc', 'Vivian', 'Thẻ nhân viên', 'Sảnh thang máy', 'Sảnh thang máy · Bục lan trắng', 'Bình hoa lạ'] },
  { ma: 's2', dung: ['Lâm Hạ · Sơ mi trắng (có thẻ)', 'Lâm Hạ · Đồng hồ bạc', 'Lâm Hạ · Vết cà phê ngực trái'] },
] }, ma, shots, nv2);
const l1 = lk.find((x) => x.id === 101)!, l2 = lk.find((x) => x.id === 102)!;
assert.deepStrictEqual([...l1.bien_the].sort((a, b) => a - b), [10, 12, 13, 20], 'S1: look Hạ thay bằng bộ phân rã (bỏ vết 11 chưa xảy ra, thêm đồng hồ), giữ biểu cảm 12, giữ đầm Vivian 20');
assert.ok(l1.nhan_vat.includes(5) && !l1.nhan_vat.includes(8), 'S1: thêm thẻ nhân viên; cấu kiện KHÔNG gắn vào shot');
assert.deepStrictEqual(l1.khong_khop, ['Bình hoa lạ'], 'tên không khớp được ghi lại, không nuốt');
assert.deepStrictEqual([...l2.bien_the].sort((a, b) => a - b), [10, 11, 13], 'S2 (mã viết thường vẫn nhận): vết bật từ shot sự kiện + đồng hồ');
assert.ok(l1.doi && l2.doi, 'đánh dấu shot đổi');

// 5. baoCaoChuanBi: tập chưa / cũ / xong / trống; món thiếu (đồng hồ chưa ảnh mẫu); bối cảnh có bộ set KHÔNG tính thiếu ảnh gốc
const shotsSau = shots.map((c) => ({ ...c, nhan_vat: lk.find((x) => x.id === c.id)!.nhan_vat, bien_the: lk.find((x) => x.id === c.id)!.bien_the }));
const bam9 = bamPhanRa({ kich_ban: 'KB' }, shotsSau);
const bc = baoCaoChuanBi({
  tap: [
    { id: 9, so: 1, ten: 'Thang máy', kich_ban: 'KB', phan_ra: { phien: PHIEN_PHAN_RA, luc: 'x', bam: bam9 } },
    { id: 10, so: 2, ten: 'Hợp đồng', kich_ban: 'KB', phan_ra: { phien: PHIEN_PHAN_RA, luc: 'x', bam: 'cu' } },
    { id: 11, so: 3, ten: 'Chưa', kich_ban: '' },
    { id: 12, so: 4, ten: 'Trống', kich_ban: '' },
  ],
  canh: [...shotsSau, { ...shot(201, 1), tap_id: 10 }, { ...shot(301, 1), tap_id: 11 }],
  nhanVat: nv2,
});
assert.deepStrictEqual(bc.tap.map((t) => t.trang_thai), ['xong', 'cu', 'chua', 'trong']);
assert.deepStrictEqual(bc.thieu.map((m) => `${m.loai}:${m.ten}:${m.tap}:${m.so_shot}`), ['bien_the:Đồng hồ bạc:1:2'], 'chỉ đồng hồ thiếu ảnh mẫu; Sảnh (bộ set) không tính thiếu ảnh gốc');
assert.strictEqual(bc.tong.thieu, 1); assert.strictEqual(bc.tong.tap_chua, 1); assert.strictEqual(bc.tong.tap_cu, 1);

// 6. taPhanRa: mã shot S1… theo thứ tự phát, có danh sách thành phần đã có + look-book theo nhóm
const { user, ma: ma2 } = taPhanRa({ tenPhim: 'P', loai: 'phim', phongCach: '', tap: { so: 1, ten: 'T', kich_ban: 'KB' }, tomTatTruoc: [], nhanVat: nv2, canh: [shot(102, 2), shot(101, 1)] });
assert.strictEqual(ma2.get('S1'), 101, 'S1 = shot #1 dù đầu vào lộn thứ tự');
assert.ok(user.includes('· do_deo: "Đồng hồ bạc"') && user.includes('· vet: "Vết cà phê ngực trái" [tập 1]') && user.includes('cấu kiện: "Bục lan trắng"'));

console.log('✓ phan-ra-thuan: tách tên · mã băm bỏ qua phần gắn · kế hoạch dùng lại / tạo / thêm tập / không khớp · gắn shot thay look theo phân rã (vết từ shot sự kiện) · báo cáo chưa/cũ/xong + món thiếu');
