import assert from 'node:assert';
import { diemMurchTap, diemMurchCanh, TRONG_SO } from './diem-murch';
import type { Canh } from './kieu';

// Trọng số đúng Murch, tổng 100
assert.equal(Object.values(TRONG_SO).reduce((a, b) => a + b, 0), 100);
const nv = [{ id: 1, ten: 'T', loai: 'nhan_vat' as const, bo_set_id: null, khoi_3d: null }];
const shot = (p: Partial<Canh> & { id: number }): Parameters<typeof diemMurchTap>[0][number] => ({ thu_tu: p.id, phan_doan: 'A', nhan_vat: [1], cam_xuc: 0, hanh_dong: 'đi', ky_thuat: {}, dan_dung: {}, may_3d: null, khung_xam: null, phat_s: 4, thoi_luong_s: 4, thoai: [], ...p } as never);
const ds = [
  shot({ id: 1, ky_thuat: { vai: 'thiet_lap', co_canh: 'ws' }, cam_xuc: 1 }),
  shot({ id: 2, ky_thuat: { vai: 'phan_ung', co_canh: 'cu', dien_xuat: 'nhan_ra' }, cam_xuc: 3, dan_dung: { muc_dich: 'thèm', motif: 'kẹo', dien: 'eyes widen' } }),
  shot({ id: 3, ky_thuat: { vai: 'phan_ung', co_canh: 'cu' }, cam_xuc: 3, phat_s: 1 }),   // y hệt shot trước, cắt vội, cảm xúc không đổi
];
const d = diemMurchTap(ds, nv, [], { khong_loi: true });
for (const x of Object.values(d)) { assert.ok(x.tong >= 0 && x.tong <= 100); for (const v of Object.values(x.phan)) assert.ok(v >= 0 && v <= 1); }
assert.ok(d[2]!.phan.cam_xuc > d[1]!.phan.cam_xuc && d[2]!.tong > d[1]!.tong, JSON.stringify(d));   // shot phản ứng có diễn xuất, cảm xúc đổi bậc > shot thiết lập
assert.ok(d[3]!.phan.nhip < d[2]!.phan.nhip && d[3]!.ly_do.nhip?.includes('ngắn'), JSON.stringify(d[3]));
assert.ok(d[3]!.ly_do.cam_xuc?.includes('không đổi bậc'));
const tb = diemMurchCanh(ds, d); assert.equal(tb.canh.A, tb.tap); assert.ok(tb.tap > 0);
// điểm nhìn ĐO trên clip thắng ước lượng: lệch sau dựng lại ≤ ngưỡng → eye trace 1; lệch lớn → điểm thấp + lý do có số
const dn = (lech_goc: number, lech_sau: number) => ({ diem_nhin: { khoa: 'x', dau: null, cuoi: null, lech_goc, lech_sau } }) as Record<string, unknown>;
const d2 = diemMurchTap([ds[0]!, shot({ id: 2, ky_thuat: { co_canh: 'cu', ...dn(0.3, 0.1) } }), shot({ id: 3, ky_thuat: { co_canh: 'ms', ...dn(0.4, 0.4) } })], nv, [], { khong_loi: true });
assert.strictEqual(d2[2]!.phan.eye_trace, 1); assert.ok(!d2[2]!.ly_do.eye_trace);
assert.ok(d2[3]!.phan.eye_trace < 0.2 && d2[3]!.ly_do.eye_trace?.includes('40%'), JSON.stringify(d2[3]));
console.log('diem-murch.test: ok', Object.values(d).map((x) => x.tong).join(' / '));
