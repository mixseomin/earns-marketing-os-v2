import assert from 'node:assert';
import { checklist, kiemHaTang, type DungChung, type HaTang } from './qc-ha-tang';

const c = { cuaHangId: 1, ghiChu: null, trangThai: 'song' };
const rong: DungChung = { nguoi: {}, proxy: {}, profile: {}, the: {}, ma: {}, proxyBo: {} };
const acc = (proxyId: number | null, profileId: number | null) => ({ handle: 'h', email: 'e', platform: 'facebook', proxyId, proxy: proxyId ? 'US-1' : null,
  proxyNoi: 'US', profileId, profile: profileId ? 'ms-1' : null });
const sach: HaTang = {
  cuaHangId: 1, khoa: 'mellowstep', domain: 'mellowstep.com', pixelSite: '111',
  bm: [{ ...c, id: 1, extId: '900', ten: 'BM MS', nguon: 'mua', noiMua: 'vuavia', maDon: 'A1', giaMua: 300000, ngayMua: '2026-10-02', baoHanhDen: '2026-10-03',
    xacMinh: false, daGoNguoiBan: true, coToken: true, tokenQuyen: 'ads_read', tokenLuc: null }],
  the: [{ ...c, id: 1, nhan: 'Visa ảo 1', soCuoi: '4242', nhaPhatHanh: 'TPBank', loai: 'ao', chuThe: 'A', hetHan: '12/28', dichVu: null, phiThang: null, hanMuc: null, ngayCap: null }],
  proxy: [{ ...c, id: 1, proxyId: 5, label: 'US-1', loai: 'isp', noi: 'US', host: 'x', suckhoe: null, nhaCungCap: 'P', giaThang: 5, giaHanDen: '2026-11-01' },
    { ...c, id: 2, proxyId: 6, label: 'US-2', loai: 'isp', noi: 'US', host: 'y', suckhoe: null, nhaCungCap: 'P', giaThang: 5, giaHanDen: '2026-11-01' }],
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
const ngoai: DungChung = { nguoi: { 10: ['x'] }, proxy: { 6: ['ai đó (facebook)'] }, profile: {}, the: { 'tpbank|4242': ['x'] }, ma: { act_1: ['x'] }, proxyBo: { 5: ['x'] } };
const do_ = kiemHaTang(sach, ngoai, '2026-09-01').filter((x) => x.muc === 'do').map((x) => x.ma).sort();
assert.deepEqual(do_, ['nguoi-1', 'proxy-2', 'proxy-bo-1', 'the-1', 'tk-1'], 'người, proxy, proxy trong bộ shop khác, thẻ, TK dùng chung đều đỏ');

// proxy: hết hạn = đỏ, sắp hết = vàng; người dùng proxy ngoài bộ = vàng; thẻ sắp hết hạn = vàng, đã hết = đỏ
const han: HaTang = { ...sach, proxy: [{ ...sach.proxy[0]!, giaHanDen: '2026-09-30' }, { ...sach.proxy[1]!, giaHanDen: '2026-10-03' }],
  the: [{ ...sach.the[0]!, hetHan: '10/26' }] };
const mh = kiemHaTang(han, rong, '2026-10-02').map((x) => `${x.muc}:${x.ma}`);
for (const k of ['do:proxy-het-1', 'vang:proxy-han-2', 'vang:the-han-1']) assert.ok(mh.includes(k), `phải có ${k}`);
assert.ok(kiemHaTang({ ...sach, the: [{ ...sach.the[0]!, hetHan: '08/26' }] }, rong, '2026-10-02').some((x) => x.ma === 'the-het-1'), 'thẻ hết hạn 08/26 → đỏ');
const ngoaiBo = kiemHaTang({ ...sach, proxy: [sach.proxy[0]!] }, rong, '2026-10-02').map((x) => x.ma);
assert.ok(ngoaiBo.includes('nguoi-proxy-ngoai-2'), 'người 2 dùng proxy 6 không có trong bộ');

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
