// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/phu-thuoc.test.mts
import assert from 'node:assert';
import { phuThuocShot } from './phu-thuoc';
import type { Canh, NhanVat } from './kieu';

const shot = (p: Partial<Canh>): Canh => ({ id: 1, tap_id: 1, thu_tu: 1, canh: '', prompt_anh: 'a man', prompt_video: '', bien_the: [], thoai: [], loi_thoai: '', thoai_url: null,
  keyframe_url: null, keyframe_uv: [], video_url: null, video_cuoi_url: null, trang_thai: 'nhap', phan_doan: 'S1', ...p, nhan_vat: [50, ...((p.nhan_vat as number[] | undefined) ?? [])] } as unknown as Canh);
const PC = [{ ten: 'S1' }];
const BC = { id: 50, ten: 'Phòng', loai: 'boi_canh', mo_ta: 'p', anh_ref: ['b'], bien_the: [] } as unknown as NhanVat;
const sp = { id: 9, ten: 'Quần', loai: 'san_pham', mo_ta: 'quần', anh_ref: [], bien_the: [] } as unknown as NhanVat;

// keyframe: thiếu prompt + sản phẩm chưa có ảnh gốc → chặn; có keyframe sẵn → lưu ý; clip shot trước dùng nó làm khung cuối → lưu ý.
let k = phuThuocShot('keyframe', shot({ prompt_anh: '', nhan_vat: [9] }), [sp, BC], { noiKhung: true, phanCanh: PC });
assert.deepStrictEqual(k.chan, ['chưa có prompt ảnh', 'Quần: chưa có ảnh gốc']);
k = phuThuocShot('keyframe', shot({ thu_tu: 2, keyframe_url: 'k' }), [BC], { noiKhung: true, phanCanh: PC, truoc: shot({ thu_tu: 1, video_url: 'v' }) });
assert.strictEqual(k.chan.length, 0);
assert.ok(k.luu_y.some((x) => x.includes('clip shot #1')) && k.luu_y.some((x) => x.includes('dải ứng viên')));
assert.ok(!phuThuocShot('keyframe', shot({ thu_tu: 2 }), [BC], { noiKhung: false, phanCanh: PC, truoc: shot({ video_url: 'v' }) }).luu_y.length, 'tắt nối khung → không cảnh báo');

// video: chưa có keyframe / chưa duyệt → chặn; shot sau chưa keyframe khi nối khung → lưu ý; thoại chưa có giọng → lưu ý.
assert.deepStrictEqual(phuThuocShot('video', shot({}), [], { noiKhung: false, phanCanh: PC }).chan, ['chưa có keyframe']);
assert.deepStrictEqual(phuThuocShot('video', shot({ keyframe_url: 'k' }), [], { noiKhung: false, phanCanh: PC }).chan, ['chưa duyệt keyframe']);
const v = phuThuocShot('video', shot({ keyframe_url: 'k', trang_thai: 'duyet', thoai: [{ nhan_vat: '', dien_xuat: '', loi: 'hi' }] }), [], { noiKhung: true, phanCanh: PC, ke: shot({ thu_tu: 2 }) });
assert.strictEqual(v.chan.length, 0);
assert.ok(v.luu_y.some((x) => x.includes('shot #2 chưa có keyframe')) && v.luu_y.some((x) => x.includes('chưa sinh giọng')), v.luu_y.join('|'));
assert.ok(!phuThuocShot('video', shot({ keyframe_url: 'k', trang_thai: 'duyet', thoai: [{ nhan_vat: '', dien_xuat: '', loi: 'hi', url: 'g' }] }), [], { noiKhung: false, phanCanh: PC }).luu_y.length);
// phân cảnh (luật 12/10/2026): tập chưa có phân cảnh / shot lạc phân cảnh → chặn keyframe; video không xét.
{
  const { thieuPhanCanh } = await import('./phu-thuoc');
  assert.match(thieuPhanCanh([], shot({}))!, /chưa có phân cảnh/);
  assert.match(thieuPhanCanh(PC, shot({ phan_doan: 'Khác' }))!, /"Khác" chưa khai/);
  assert.match(thieuPhanCanh(PC, shot({ phan_doan: '' }))!, /chưa thuộc phân cảnh/);
  assert.strictEqual(thieuPhanCanh(PC, shot({})), null);
  assert.ok(phuThuocShot('keyframe', shot({}), [], { noiKhung: false, phanCanh: [] }).chan.some((x) => x.includes('chưa có phân cảnh')));
  assert.ok(!phuThuocShot('video', shot({ keyframe_url: 'k', trang_thai: 'duyet' }), [], { noiKhung: false, phanCanh: [] }).chan.length);
}
// mẫu (luật 12/10/2026): shot không gắn bối cảnh / nhắc tên nhân vật mà chưa gắn → chặn keyframe
{
  const { thieuMau } = await import('./phu-thuoc');
  const maya = { id: 7, ten: 'Maya', loai: 'nhan_vat' } as NhanVat;
  assert.deepStrictEqual(thieuMau({ nhan_vat: [], prompt_anh: 'a room', hanh_dong: '' }, [maya]).length, 1);
  assert.match(thieuMau({ nhan_vat: [], prompt_anh: '', hanh_dong: '' }, [maya])[0]!, /chưa có anchor Bối cảnh/);
  assert.match(thieuMau({ nhan_vat: [], prompt_anh: '', hanh_dong: '' }, [maya, BC])[0]!, /chưa gắn bối cảnh/);
  assert.deepStrictEqual(thieuMau({ nhan_vat: [50], prompt_anh: "Maya's hand on a phone", hanh_dong: '' }, [maya, BC]), ['"Maya" có trong prompt mà chưa gắn mẫu']);
  assert.deepStrictEqual(thieuMau({ nhan_vat: [50, 7], prompt_anh: 'Maya runs', hanh_dong: '' }, [maya, BC]), []);
  assert.deepStrictEqual(thieuMau({ nhan_vat: [50], prompt_anh: 'mayans ruins', hanh_dong: '' }, [maya, BC]), [], 'không khớp nửa từ');
  assert.ok(phuThuocShot('keyframe', shot({ nhan_vat: [] }), [maya, BC], { noiKhung: false, phanCanh: PC }).chan.length === 0, 'shot mặc định có bối cảnh 50');
}
console.log('phu-thuoc.test: ok');
{
  const { khacCauLenh } = await import('./phu-thuoc');
  assert.deepStrictEqual(khacCauLenh('A man stands. He smiles. No text.', 'A man stands. He laughs! No text.'), { them: ['He laughs!'], bot: ['He smiles.'] });
  assert.deepStrictEqual(khacCauLenh('Same.', 'Same.'), { them: [], bot: [] });
  console.log('phu-thuoc.test: khác câu lệnh ok');
}
{
  const { bangDoiTuong } = await import('./phu-thuoc');
  const q = { id: 9, ten: 'Quần', loai: 'san_pham', mo_ta: 'q', anh_ref: ['p1'], bien_the: [{ id: 1, nhan_vat_id: 9, nhom: 'mau', ten: 'Đen', mo_ta: '', anh_url: 'den' }, { id: 2, nhan_vat_id: 9, nhom: 'mau', ten: 'Xanh', mo_ta: '', anh_url: null }] } as unknown as NhanVat;
  const tom = { id: 5, ten: 'Tom', loai: 'nhan_vat', mo_ta: 'm', anh_ref: [], bien_the: [] } as unknown as NhanVat;
  const ds = [shot({ id: 1, nhan_vat: [9], bien_the: [1] }), shot({ id: 2, nhan_vat: [9], bien_the: [1] }), shot({ id: 3, nhan_vat: [9], bien_the: [2], prompt_anh: 'Tom walks' })];
  const b = bangDoiTuong(ds, [q, tom]);
  assert.deepStrictEqual(b[0]!.o.map((o) => o.khac), [false, false, true]);          // shot 3 đổi màu so với đa số
  assert.ok(b[0]!.o[2]!.thieu.length && !b[0]!.o[0]!.thieu.length);                     // biến thể Xanh chưa có ảnh
  assert.deepStrictEqual(b[1]!.o.map((o) => o.nhac), [false, false, true]);           // nhắc "Tom" mà chưa gắn
  console.log('phu-thuoc.test: bảng đối tượng ok');
}
// Số giây chuyển cảnh đặt tay (#1297): thắng mặc định của kiểu, vẫn bị chặn ở nửa shot ngắn hơn; lamSachKyThuat giữ giay_cc hợp lệ.
{
  const { chuyenCanhGiua, lamSachKyThuat } = await import('./dien-anh');
  assert.strictEqual(chuyenCanhGiua('hoa_tan', 4, 4)!.d, 0.6);
  assert.strictEqual(chuyenCanhGiua('hoa_tan', 4, 4, 1)!.d, 1);
  const chan = chuyenCanhGiua('hoa_tan', 4, 1.2, 1)!; assert.deepStrictEqual([chan.d, chan.muon], [0.6, 1]);
  assert.strictEqual(lamSachKyThuat({ chuyen_canh: 'hoa_tan', giay_cc: 0.75 }).giay_cc, 0.75);
  assert.strictEqual(lamSachKyThuat({ giay_cc: 9 }).giay_cc, undefined);
  console.log('phu-thuoc.test: giây chuyển cảnh ok');
}
