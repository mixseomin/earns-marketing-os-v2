import assert from 'node:assert';
import { LO_NUOI, hanhTrinhNuoi, ngayVn, type MocNuoi } from './qc-nuoi';

let id = 0;
const m = (buoc: string, luc: string, xong = true): MocNuoi => ({ id: ++id, loai: 'tk', doiTuongId: 1, buoc, xong, luc, ghiChu: null, nguoiGhi: null });

// chưa nuôi: không ngày, không hạn, đứng chặng đầu
const rong = hanhTrinhNuoi('tk', [], '2026-10-05');
assert.equal(rong.batDau, null); assert.equal(rong.hienTai, 0); assert.equal(rong.tre, false); assert.equal(rong.chang[0]!.han, null);

// giờ VN: 20:00 UTC 01/10 = 03:00 02/10 ở VN
assert.equal(ngayVn('2026-10-01T20:00:00Z'), '2026-10-02');

// bắt đầu 02/10, xong chặng thẻ → đứng "chạy mồi" hạn ngày 3 = 05/10
const moc = [m('bat_dau', '2026-10-02T02:00:00Z'), m('the', '2026-10-02T03:00:00Z'), m('ghi', '2026-10-02T04:00:00Z')];
const a = hanhTrinhNuoi('tk', moc, '2026-10-05');
assert.equal(a.batDau, '2026-10-02'); assert.equal(a.ngayThu, 3); assert.equal(a.hienTai, 1);
assert.equal(a.chang[1]!.han, '2026-10-05'); assert.equal(a.denHan, true); assert.equal(a.tre, false);
assert.equal(hanhTrinhNuoi('tk', moc, '2026-10-06').tre, true, 'quá hạn chặng đang đứng = trễ');

// mở lại chặng thẻ (mốc xong=false mới hơn) → quay về chặng 0
const b = hanhTrinhNuoi('tk', [...moc, m('the', '2026-10-03T00:00:00Z', false)], '2026-10-03');
assert.equal(b.hienTai, 0); assert.equal(b.chang[0]!.xong, false);

// xong hết
const het = hanhTrinhNuoi('trang', [m('bat_dau', '2026-10-01T00:00:00Z'), ...LO_NUOI.trang.map((c) => m(c.key, '2026-10-02T00:00:00Z'))], '2026-10-20');
assert.equal(het.xong, true); assert.equal(het.hienTai, LO_NUOI.trang.length); assert.equal(het.tre, false);

console.log('qc-nuoi ok');
