// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/nguoi-xem.test.mts
import assert from 'node:assert';
import { banNguoiXem, maBan, chanNguoiXem } from './nguoi-xem';
import type { ThuNguoiXem } from './kieu';
const sh = (thu_tu: number, hanh_dong: string, chu_man: string, thoai: { nhan_vat: string; loi: string }[]) => ({ thu_tu, phat_s: 2, thoi_luong_s: 4, hanh_dong, chu_man, loi_thoai: '', thoai: thoai.map((d) => ({ ...d, dien_xuat: 'NỘI BỘ' })) });
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
console.log('nguoi-xem.test: ok');
