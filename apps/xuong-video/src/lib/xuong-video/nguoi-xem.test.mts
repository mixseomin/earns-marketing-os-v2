// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/nguoi-xem.test.mts
import assert from 'node:assert';
import { banNguoiXem, maBan, chanNguoiXem } from './nguoi-xem';
import type { ThuNguoiXem } from './kieu';
const sh = (thu_tu: number, hanh_dong: string, chu_man: string, thoai: { nhan_vat: string; loi: string }[]) => ({ thu_tu, phan_doan: '', phat_s: 2, thoi_luong_s: 4, hanh_dong, chu_man, loi_thoai: '', thoai: thoai.map((d) => ({ ...d, dien_xuat: 'NỘI BỘ' })) });
const ds = [sh(1, 'The crow holds the cheese', 'THE BIGGEST CHEESE', [{ nhan_vat: '', loi: 'Felix had a plan.' }]), sh(2, 'Felix grins', '', [{ nhan_vat: 'Felix', loi: 'Ahem.' }])];
const b = banNguoiXem(ds);
assert.ok(b.includes('#1 [0.0–2.0s] THẤY: The crow holds the cheese | CHỮ TRÊN MÀN: THE BIGGEST CHEESE | NGHE: Người dẫn (giọng ngoài khung): "Felix had a plan."'), b);
assert.ok(b.includes('#2 [2.0–4.0s]') && b.includes('Felix: "Ahem."') && !b.includes('NỘI BỘ'), 'diễn xuất là ghi chú nội bộ, người xem không đọc được');
const ma = maBan(b);
const kq = (o: Partial<ThuNguoiXem>): ThuNguoiXem => ({ ma, luc: '', model: '', ke_lai: '', hieu: { ai: '', muon: '', can: '', lat: '', ket: '' }, diem: 8, cho_kho: [], khop: true, lech: '', dat: true, ...o });
assert.deepStrictEqual(chanNguoiXem(kq({}), ds), []);
assert.ok(chanNguoiXem(null, ds)[0]!.includes('chưa kiểm'));
assert.ok(chanNguoiXem(kq({}), [ds[0]!, { ...ds[1]!, chu_man: 'PLAN A' }])[0]!.includes('đã sửa sau lần kiểm'), 'sửa chữ màn → phải kiểm lại');
assert.ok(chanNguoiXem(kq({ dat: false, diem: 4, khop: false, lech: 'không biết truyện gốc', cho_kho: [{ shot: 8, van_de: 'quạ hát mà câm', sua: '' }] }), ds)[0]!.includes('#8 quạ hát mà câm'));
assert.deepStrictEqual(chanNguoiXem(null, []), [], 'tập chưa tách cảnh: chưa có gì để thử');
// ÁP BẢN SỬA: giữ giọng câu không đổi, câu đổi phải đọc lại; chèn shot đúng chỗ; tên anchor → id
import { keHoachSua, LOI_CAN_KEYFRAME } from './nguoi-xem';
const cu = [{ id: 10, thu_tu: 1, thoai: [{ nhan_vat: '', dien_xuat: 'dry', loi: 'Felix had a plan.', url: 'u1', dai: 2 }] }, { id: 11, thu_tu: 2, thoai: [{ nhan_vat: 'Felix', dien_xuat: '', loi: 'Ahem.', url: 'u2' }] }, { id: 12, thu_tu: 3, thoai: [] }];
const kh = keHoachSua(cu, [{ id: 7, ten: 'Crow' }, { id: 8, ten: 'Vineyard' }],
  [{ shot: 1, hanh_dong: 'a', chu_man: 'WANTS CHEESE.', thoai: [{ nhan_vat: '', dien_xuat: 'dry', loi: 'Felix had a plan.' }, { nhan_vat: '', dien_xuat: '', loi: 'Make her sing.' }], prompt_anh: 'p', doi_hinh: true, phat_s: 1.2 },
   { shot: 9, hanh_dong: '', chu_man: '', thoai: [], prompt_anh: '', doi_hinh: false, phat_s: 3 }],
  [{ sau_shot: 2, canh: 'Claw', hanh_dong: 'The crow moves the cheese to its claw', chu_man: '', thoai: [], prompt_anh: 'close-up', nhan_vat: ['crow', 'Ghost'], phat_s: 2.5 }]);
assert.strictEqual(kh.capNhat.length, 1, 'shot không tồn tại thì bỏ qua');
assert.strictEqual(kh.capNhat[0]!.thoai[0]!.url, 'u1'); assert.strictEqual(kh.capNhat[0]!.thoai[1]!.url, null);
assert.strictEqual(kh.capNhat[0]!.thoai_url, 'u1'); assert.strictEqual(kh.capNhat[0]!.chu_man, 'WANTS CHEESE'); assert.strictEqual(kh.capNhat[0]!.phat_s, 2); assert.strictEqual(kh.capNhat[0]!.loi, LOI_CAN_KEYFRAME);
assert.deepStrictEqual(kh.thuTu, [10, 11, 'm0', 12]); assert.deepStrictEqual(kh.chen[0]!.nhan_vat, [7]); assert.strictEqual(kh.chen[0]!.sau_id, 11);
// CỔNG theo nhánh: kiểm trên nhánh A; đang sinh shot nhánh B (danh sách B) vẫn phải so mã với nhánh A — không chặn oan
import { chanTienKy } from './quy-trinh';
const A = [sh(1, 'hook A', 'A?', []), sh(2, 'body', '', [])]; const B = [sh(1, 'hook B', 'B?', []), sh(2, 'body', '', [])];
const TQ2 = { so: 1, brief: 'Một brief đủ dài để qua cổng tiền kỳ', beats: [{ ten: 'a', cam_xuc: -2 }, { ten: 'b', cam_xuc: 1 }, { ten: 'c', cam_xuc: 3 }], phan_canh: [{ ten: 'A' }], nhac_url: null, nhac_phan_canh: {}, thu_nguoi_xem: kq({ ma: maBan(banNguoiXem(A)) }) };
const PQ2 = { phong_cach: 'cinematic night city, teal and orange, anamorphic', laQc: false };
const nx = (r: string[]) => r.filter((x) => x.startsWith('người xem'));
assert.deepStrictEqual(nx(chanTienKy(TQ2, PQ2, B, A)), [], 'nhánh B + so với A → qua');
assert.ok(nx(chanTienKy(TQ2, PQ2, B))[0]?.includes('đã sửa'), 'không truyền nhánh A → so nhầm với B (đúng lỗi cũ) — kiểm đỏ được');
console.log('nguoi-xem.test: ok');
