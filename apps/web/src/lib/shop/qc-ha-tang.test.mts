import assert from 'node:assert';
import { checklist, kiemHaTang, type DungChung, type HaTang } from './qc-ha-tang';

const c = { cuaHangId: 1, ghiChu: null, trangThai: 'song' };
const rong: DungChung = { nguoi: {}, proxy: {}, profile: {}, the: {}, ma: {} };
const acc = (proxyId: number | null, profileId: number | null) => ({ handle: 'h', email: 'e', platform: 'facebook', proxyId, proxy: proxyId ? 'US-1' : null,
  proxyNoi: 'US', profileId, profile: profileId ? 'ms-1' : null });
const sach: HaTang = {
  cuaHangId: 1, khoa: 'mellowstep', domain: 'mellowstep.com', pixelSite: '111',
  bm: [{ ...c, id: 1, extId: '900', ten: 'BM MS', nguon: 'mua', noiMua: 'vuavia', maDon: 'A1', giaMua: 300000, ngayMua: '2026-10-02', baoHanhDen: '2026-10-03',
    xacMinh: false, daGoNguoiBan: true, coToken: true, tokenQuyen: 'ads_read', tokenLuc: null }],
  the: [{ ...c, id: 1, nhan: 'Visa ảo 1', soCuoi: '4242', nhaPhatHanh: 'TPBank', loai: 'ao', chuThe: 'A', hetHan: '12/28' }],
  tk: [{ ...c, id: 1, bmId: 1, extId: 'act_1', ten: 'TK1', tienTe: 'USD', muiGio: null, hanMuc: 250, theId: 1, nguon: 'mua', noiMua: null, maDon: null, giaMua: null, baoHanhDen: null }],
  nguoi: [{ ...c, id: 1, accountId: 10, ten: 'Chủ', bmId: 1, vaiTro: 'cam_chinh', nguon: 'cua_minh', acc: acc(5, 7) },
    { ...c, id: 2, accountId: 11, ten: 'Phụ', bmId: 1, vaiTro: 'quan_tri_phu', nguon: 'clone_mua', acc: acc(6, 8) }],
  trang: [{ ...c, id: 1, accountId: null, bmId: 1, extId: 'p1', ten: 'Mellowstep' }].map((t) => ({ ...t, nguon: 'tu_tao' })),
  pixel: [{ ...c, id: 1, bmId: 1, extId: '111', ten: 'MS pixel', tenMien: 'mellowstep.com', xacMinhMien: true, capi: true }],
};

// bộ sạch: không đỏ; vàng duy nhất là bảo hành BM còn 1 ngày
const kq = kiemHaTang(sach, rong, '2026-10-02');
assert.deepEqual(kq.filter((x) => x.muc === 'do'), [], 'bộ sạch không có đỏ');
assert.deepEqual(kq.map((x) => x.ma), ['bm-bh-1'], 'chỉ còn cảnh báo bảo hành');
assert.ok(checklist(sach).every((b) => b.xong), 'checklist đủ 9 bước');

// dùng chung với nơi khác → đỏ, đúng mảnh
const ngoai: DungChung = { nguoi: { 10: ['bra'] }, proxy: { 6: ['Judy (facebook)'] }, profile: {}, the: { 'tpbank|4242': ['bra'] }, ma: { act_1: ['bra'] } };
const do_ = kiemHaTang(sach, ngoai, '2026-09-01').filter((x) => x.muc === 'do').map((x) => x.ma).sort();
assert.deepEqual(do_, ['nguoi-1', 'proxy-2', 'the-1', 'tk-1'], 'người, proxy, thẻ, TK dùng chung đều đỏ');

// site bắn vào pixel lạ → đỏ; thiếu proxy / 1 quản trị / thẻ cho 2 TK → vàng
const yeu: HaTang = { ...sach, pixelSite: '999',
  nguoi: [{ ...sach.nguoi[0]!, acc: acc(null, null) }],
  tk: [...sach.tk, { ...sach.tk[0]!, id: 2, extId: 'act_2', ten: 'TK2' }] };
const m = kiemHaTang(yeu, rong, '2026-09-01').map((x) => x.ma);
for (const k of ['px-site', 'nguoi-proxy-1', 'nguoi-profile-1', 'bm-qt-1', 'the-nhieu-1']) assert.ok(m.includes(k), `phải có ${k}`);
assert.equal(kiemHaTang(yeu, rong, '2026-09-01')[0]!.muc, 'do', 'đỏ đứng trước');
assert.equal(checklist(yeu).find((b) => b.ma === 'thiet_bi')!.xong, false);

// mảnh đã thôi dùng không bị kiểm
const bo: HaTang = { ...sach, nguoi: [...sach.nguoi, { ...sach.nguoi[0]!, id: 3, accountId: 99, trangThai: 'bo', acc: acc(null, null) }] };
assert.ok(!kiemHaTang(bo, { ...rong, nguoi: { 99: ['x'] } }, '2026-09-01').some((x) => x.ma.endsWith('-3')), 'người thôi dùng bỏ qua');
console.log('qc-ha-tang: mọi kiểm đạt');
