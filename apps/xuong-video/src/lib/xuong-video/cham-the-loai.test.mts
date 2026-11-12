// Tự kiểm bộ chấm thể loại Hài (cham-the-loai.ts) — ca đạt lẫn ca đỏ cho từng kiểu.
// node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/cham-the-loai.test.mts
import assert from 'node:assert';
import { chamTheLoai } from './cham-the-loai';
const shot = (id: number, pd: string, o: Record<string, unknown> = {}) => ({ id, thu_tu: id, phan_doan: pd, nhanh: '', hanh_dong: '', loi_thoai: '', thoai: [], phat_s: 2, thoi_luong_s: 4, ky_thuat: { vai: 'hanh_dong', co_canh: 'ms' }, nhan_vat: [], may_3d: null, ...o }) as never;
const ds = [
  shot(1, 'A', { thoai: [{ nhan_vat: 'Chú', loi: 'Cháu một chai, chú một chai', dien_xuat: '', dai: 1.5, tre: 0 }] }),
  shot(2, 'A', { ky_thuat: { vai: 'he_lo', co_canh: 'ms' } }),
  shot(3, 'B', { thoai: [{ nhan_vat: 'Nhóc', loi: 'Tiệm chỉ còn một chai', dien_xuat: '', dai: 1.2, tre: 0.1 }] }),
  shot(4, 'B', { ky_thuat: { vai: 'phan_ung', co_canh: 'cu' }, phat_s: 2.2 }),
];
const pc = (kieu?: string, gai = 'cháu một chai chú một chai') => [{ ten: 'A' }, { ten: 'B', nhac: 'khong', gag: [{ ten: 'Hai chai thành một', gai, bung: 'chỉ còn một chai', o_shot: 1, ...(kieu ? { kieu } : {}) }] }] as never;
const no = () => false;
// tình huống: đủ gài, hé lộ trước, phản ứng sau → mọi tiêu chí gag đạt
const k1 = chamTheLoai('hai', ds, pc('tinh_huong'), no)!;
for (const m of ['gai_tra', 'phan_ung', 'chenh_tt']) assert.equal(k1.tieu_chi.find((x) => x.ma === m)?.dat, true, m);
// gài không hề lên màn trước → đỏ
assert.equal(chamTheLoai('hai', ds, pc('tinh_huong', 'con mèo đen nhảy qua bàn'), no)!.tieu_chi.find((x) => x.ma === 'gai_tra')?.dat, false);
// không có shot hé lộ → chênh thông tin đỏ
assert.equal(chamTheLoai('hai', ds.filter((c: { id: number }) => c.id !== 2), pc('tinh_huong'), no)!.tieu_chi.find((x) => x.ma === 'chenh_tt')?.dat, false);
// lời: câu chốt không ngắt (một câu, tre 0,1) → đỏ
assert.equal(chamTheLoai('hai', ds, pc('loi'), no)!.tieu_chi.find((x) => x.ma === 'loi_ngat')?.dat, false);
// thiếu kiểu → báo chưa khai; không gag → báo thiếu gag
assert.equal(chamTheLoai('hai', ds, pc(), no)!.tieu_chi.find((x) => x.ma === 'kieu')?.dat, false);
assert.equal(chamTheLoai('hai', ds, [{ ten: 'A' }] as never, no)!.tieu_chi[0]!.ma, 'co_gag');
// thể loại chưa có bộ chấm → null
assert.equal(chamTheLoai('kinh_di', ds, pc(), no), null);
// mặt lạnh: shot bùng là cận phản ứng (#4) — phản ứng tính chính nó; kiểu tình huống bùng ở #4 thì không có gì sau → đỏ
const pcML = (kieu: string) => [{ ten: 'A' }, { ten: 'B', nhac: 'khong', gag: [{ ten: 'Đứng hình', gai: 'cháu một chai', bung: 'đứng hình', o_shot: 2, kieu }] }] as never;
assert.equal(chamTheLoai('hai', ds, pcML('mat_lanh'), no)!.tieu_chi.find((x) => x.ma === 'phan_ung')?.dat, true);
assert.equal(chamTheLoai('hai', ds, pcML('tinh_huong'), no)!.tieu_chi.find((x) => x.ma === 'phan_ung')?.dat, false);
console.log('cham-the-loai.test: ok');
