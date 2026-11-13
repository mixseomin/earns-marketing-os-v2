// Tự kiểm danh mục dự kiến (doi-chieu-khung.ts › thanhPhanDuKien) — chạy:
//   NODE_OPTIONS=--conditions=react-server node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/doi-chieu-khung.test.mts
import assert from 'node:assert';
import { thanhPhanDuKien } from './doi-chieu-khung';
import type { Canh, NhanVat } from './kieu';

const nv = (id: number, ten: string, loai: string, mo_ta = ''): NhanVat => ({ id, ten, loai, mo_ta, anh_ref: [], bien_the: [] }) as unknown as NhanVat;
const ds = [nv(1, 'Chú', 'nhan_vat', 'man'), nv(2, 'Nhóc', 'nhan_vat', 'boy'), nv(3, 'Sân ga', 'boi_canh', 'Long open-air railway platform at golden hour. More text here.')];
const canh = (o: Partial<Canh>): Canh => ({ id: 1, nhan_vat: [1, 2, 3], phan_doan: 'Giao tiền', canh: '', ky_thuat: { co_canh: 'ws' }, bien_the: [], ...o }) as unknown as Canh;
const muc = (c: Canh, ten: string) => thanhPhanDuKien(c, ds, null, 'dau').find((m) => m.thanh_phan === ten)?.du_kien;

// Bối cảnh = mô tả đối tượng bối cảnh, KHÔNG phải tên phân cảnh (13/11/2026: 'Giao tiền' làm mọi ảnh lệch bối cảnh giả)
assert.strictEqual(muc(canh({}), 'Bối cảnh'), 'Long open-air railway platform at golden hour.');
assert.strictEqual(muc(canh({ nhan_vat: [1, 2] }), 'Bối cảnh'), 'Giao tiền', 'không gắn bối cảnh thì về tên cảnh');

// Vị trí lấy từ hộp đo khung 3D khi có (sơ đồ 2D cũ lệch set)
const kx = { kiem: [{ nhan_vat: 'Nhóc', trong_khung: true, cao_khung_pt: 30, bi_che_boi: [], khung: [0.4, 0.3, 0.55, 0.9] }, { nhan_vat: 'Chú', trong_khung: true, cao_khung_pt: 20, bi_che_boi: [], khung: [0.05, 0.1, 0.2, 0.4] }] };
const c3 = canh({ khung_xam: kx as unknown as Canh['khung_xam'] });
assert.strictEqual(muc(c3, 'Vị trí Nhóc'), 'giữa');
assert.strictEqual(muc(c3, 'Vị trí Chú'), 'trái');
console.log('doi-chieu-khung: ok');
