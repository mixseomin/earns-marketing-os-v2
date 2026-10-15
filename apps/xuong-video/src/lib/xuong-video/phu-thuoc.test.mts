// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/phu-thuoc.test.mts
import assert from 'node:assert';
import { phuThuocShot } from './phu-thuoc';
import type { Canh, NhanVat } from './kieu';

const shot = (p: Partial<Canh>): Canh => ({ id: 1, tap_id: 1, thu_tu: 1, canh: '', prompt_anh: 'a man', prompt_video: '', bien_the: [], thoai: [], loi_thoai: '', thoai_url: null,
  keyframe_url: null, keyframe_uv: [], video_url: null, video_cuoi_url: null, trang_thai: 'nhap', phan_doan: 'S1', ky_thuat: { co_canh: 'ms' },
  kiem_khung: { url: 'k', dat: true, loi: [], luc: '', model: '' },   // keyframe mẫu 'k' mặc định đã qua 🔍 Kiểm khung — bài riêng thử chưa kiểm
  ...p, nhan_vat: [50, ...((p.nhan_vat as number[] | undefined) ?? [])] } as unknown as Canh);
const PC = [{ ten: 'S1' }];
const TQ = { brief: 'Một brief đủ dài để qua cổng tiền kỳ', beats: [{ ten: 'a', cam_xuc: -2 }, { ten: 'b', cam_xuc: 1 }, { ten: 'c', cam_xuc: 3 }], phan_canh: PC, nhac_url: null, nhac_phan_canh: {} };
const PQ = { phong_cach: 'cinematic night city, teal and orange, anamorphic', laQc: false };
const BC = { id: 50, ten: 'Phòng', loai: 'boi_canh', mo_ta: 'p', anh_ref: ['b'], bien_the: [] } as unknown as NhanVat;
const sp = { id: 9, ten: 'Quần', loai: 'san_pham', mo_ta: 'quần', anh_ref: [], bien_the: [] } as unknown as NhanVat;

// keyframe: thiếu prompt + sản phẩm chưa có ảnh gốc → chặn; có keyframe sẵn → lưu ý; clip shot trước dùng nó làm khung cuối → lưu ý.
let k = phuThuocShot('keyframe', shot({ prompt_anh: '', nhan_vat: [9] }), [sp, BC], { noiKhung: true, tap: TQ, phim: PQ });
assert.deepStrictEqual(k.chan.sort(), ['Quần: chưa có ảnh gốc', 'chưa có prompt ảnh'].sort());
k = phuThuocShot('keyframe', shot({ thu_tu: 2, keyframe_url: 'k' }), [BC], { noiKhung: true, tap: TQ, phim: PQ, truoc: shot({ thu_tu: 1, video_url: 'v' }) });
assert.strictEqual(k.chan.length, 0);
assert.ok(k.luu_y.some((x) => x.includes('clip shot #1')) && k.luu_y.some((x) => x.includes('dải ứng viên')));
assert.ok(!phuThuocShot('keyframe', shot({ thu_tu: 2 }), [BC], { noiKhung: false, tap: TQ, phim: PQ, truoc: shot({ video_url: 'v' }) }).luu_y.length, 'tắt nối khung → không cảnh báo');

// video: chưa có keyframe / chưa duyệt / thoại chưa có giọng → chặn (giọng trước video); shot sau chưa keyframe khi nối khung → lưu ý.
assert.deepStrictEqual(phuThuocShot('video', shot({}), [], { noiKhung: false, tap: TQ, phim: PQ }).chan, ['chưa có keyframe']);
// keyframe chưa duyệt + chưa qua 🔍 Kiểm khung (máy nhìn khung) → hai lý do chặn; đã kiểm đạt cho đúng url thì chỉ còn chưa duyệt.
assert.deepStrictEqual(phuThuocShot('video', shot({ keyframe_url: 'k', kiem_khung: null }), [], { noiKhung: false, tap: TQ, phim: PQ }).chan.map((x) => x.split(' ')[0]), ['chưa', 'keyframe']);
assert.deepStrictEqual(phuThuocShot('video', shot({ keyframe_url: 'k' }), [], { noiKhung: false, tap: TQ, phim: PQ }).chan, ['chưa duyệt keyframe']);
assert.ok(phuThuocShot('video', shot({ keyframe_url: 'k2' }), [], { noiKhung: false, tap: TQ, phim: PQ }).chan.some((x) => x.includes('Kiểm khung')));   // sinh lại keyframe → kết quả kiểm cũ hết hiệu lực
const v = phuThuocShot('video', shot({ keyframe_url: 'k', trang_thai: 'duyet', thoai: [{ nhan_vat: '', dien_xuat: '', loi: 'hi' }] }), [], { noiKhung: true, tap: TQ, phim: PQ, ke: shot({ thu_tu: 2 }) });
assert.ok(v.chan.length === 1 && v.chan[0]!.includes('chưa có giọng'), v.chan.join('|'));
assert.ok(v.luu_y.some((x) => x.includes('shot #2 chưa có keyframe')), v.luu_y.join('|'));
assert.ok(!phuThuocShot('video', shot({ keyframe_url: 'k', trang_thai: 'duyet', thoai: [{ nhan_vat: '', dien_xuat: '', loi: 'hi', url: 'g' }] }), [], { noiKhung: false, tap: TQ, phim: PQ }).luu_y.length);
// phân cảnh (luật 12/10/2026): tập chưa có phân cảnh / shot lạc phân cảnh → chặn keyframe; video không xét.
{
  const { thieuPhanCanh } = await import('./phu-thuoc');
  assert.match(thieuPhanCanh([], shot({}))!, /chưa có phân cảnh/);
  assert.match(thieuPhanCanh(PC, shot({ phan_doan: 'Khác' }))!, /"Khác" chưa khai/);
  assert.match(thieuPhanCanh(PC, shot({ phan_doan: '' }))!, /chưa thuộc phân cảnh/);
  assert.strictEqual(thieuPhanCanh(PC, shot({})), null);
  assert.ok(phuThuocShot('keyframe', shot({}), [], { noiKhung: false, tap: { ...TQ, phan_canh: [] }, phim: PQ }).chan.some((x) => x.includes('chưa có phân cảnh')));
  assert.ok(!phuThuocShot('video', shot({ keyframe_url: 'k', trang_thai: 'duyet' }), [], { noiKhung: false, tap: { ...TQ, phan_canh: [] }, phim: PQ }).chan.length);
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
  // shot nền ghép (khuôn đổi nền): nơi hiện một lần, keyframe là mẫu → không đòi anchor Bối cảnh; nhắc tên người vẫn phải gắn mẫu
  assert.deepStrictEqual(thieuMau({ nhan_vat: [], prompt_anh: 'Background plate: bus stop, NO people', hanh_dong: '', ky_thuat: { nen_ghep: true } }, [maya]), []);
  assert.deepStrictEqual(thieuMau({ nhan_vat: [], prompt_anh: 'Maya at a bus stop', hanh_dong: '', ky_thuat: { nen_ghep: true } }, [maya]), ['"Maya" có trong prompt mà chưa gắn mẫu']);
  assert.ok(phuThuocShot('keyframe', shot({ nhan_vat: [] }), [maya, BC], { noiKhung: false, tap: TQ, phim: PQ }).chan.length === 0, 'shot mặc định có bối cảnh 50');
}
// quy trình (luật 12/10/2026): cổng tiền kỳ cấp tập + shot list
{
  const k1 = phuThuocShot('keyframe', shot({}), [BC], { noiKhung: false, tap: { ...TQ, brief: '', beats: [{ ten: 'a', cam_xuc: 1 }, { ten: 'b', cam_xuc: 2 }, { ten: 'c', cam_xuc: 3 }] }, phim: { laQc: false } });
  assert.ok(k1.chan.some((x) => x.includes('brief')) && k1.chan.some((x) => x.includes('phẳng')) && k1.chan.some((x) => x.includes('phong cách')), k1.chan.join('|'));
  assert.ok(phuThuocShot('keyframe', shot({ ky_thuat: {} }), [BC], { noiKhung: false, tap: TQ, phim: PQ }).chan.some((x) => x.includes('cỡ cảnh')));
  const { quyTrinh } = await import('./quy-trinh');
  const q = quyTrinh({ tap: TQ, phim: { ...PQ, laQc: true }, canh: [shot({ keyframe_url: 'k', trang_thai: 'duyet', chu_man: 'Buy' })], nhanVat: [BC] });
  assert.ok(q.find((m) => m.key === 'phan_canh')!.ok && !q.find((m) => m.key === 'nhac')!.ok && !q.find((m) => m.key === 'logo')!.ok);
  assert.deepStrictEqual(q.find((m) => m.key === 'nhac')!.cong, 'xuat');
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
// Liền máy theo shot (14/10/2026): tập tắt nối khung nhưng shot trước chọn chuyển cảnh 'lien_may' → vẫn nối khung riêng cặp đó
{
  const LM = { co_canh: 'ms', chuyen_canh: 'lien_may' };
  const k2 = phuThuocShot('keyframe', shot({ thu_tu: 2 }), [BC], { noiKhung: false, tap: TQ, phim: PQ, truoc: shot({ thu_tu: 1, ky_thuat: LM, video_url: 'v' }) });
  assert.ok(k2.luu_y.some((x) => x.includes('sinh keyframe shot #1 trước')), k2.luu_y.join('\n'));
  assert.ok(k2.luu_y.some((x) => x.includes('lấy keyframe này làm khung cuối')), k2.luu_y.join('\n'));
  const v2 = phuThuocShot('video', shot({ thu_tu: 1, keyframe_url: 'k', trang_thai: 'duyet', ky_thuat: LM }), [], { noiKhung: false, tap: TQ, phim: PQ, ke: shot({ thu_tu: 2 }) });
  assert.ok(v2.luu_y.some((x) => x.includes('không có khung cuối')), v2.luu_y.join('\n'));
  const v3 = phuThuocShot('video', shot({ thu_tu: 1, keyframe_url: 'k', trang_thai: 'duyet', ky_thuat: { co_canh: 'ms', chuyen_canh: 'cat' } }), [], { noiKhung: false, tap: TQ, phim: PQ, ke: shot({ thu_tu: 2 }) });
  assert.ok(!v3.luu_y.some((x) => x.includes('khung cuối')), 'cắt thẳng + tập tắt nối khung → không nối');
  console.log('phu-thuoc.test: liền máy ok');
}
