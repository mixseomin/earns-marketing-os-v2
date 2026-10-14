import assert from 'node:assert';
import { boSetCuaShot, maKhungXam, bangDung, vuotTruc, chanKhungXam, datMayTuDong, shotSoTruc, thieuTrongSet } from './bo-set-3d';

const nv = [
  { id: 1, ten: 'Mouse Landing', loai: 'boi_canh' as const, bo_set_id: 7, khoi_3d: null },
  { id: 2, ten: 'Tango', loai: 'nhan_vat' as const, bo_set_id: null, khoi_3d: { hinh: 'trung' as const, co: [2, 1.6, 2.6], mau: '#f08a3c' } },
  { id: 3, ten: 'Gummy Bear', loai: 'dao_cu' as const, bo_set_id: null, khoi_3d: { hinh: 'hop' as const, co: [1.4, 0.9, 2], mau: '#d0202a' } },
  { id: 4, ten: 'Earth at Night', loai: 'boi_canh' as const, bo_set_id: null, khoi_3d: null },
];
const set = { id: 7, du_lieu: { vat: [{ ten: 'Mặt bàn', hinh: 'hop' as const, tam: [0, 35, -3], co: [160, 70, 3], mau: '#6b4a2e' }] } };
const m = (dat: number[]) => ({ dat, nhin: [24, 30, 2], ong_kinh: 24, vi_tri: [{ ten: 'Tango', tam: [20, 25, 0] }, { ten: 'Gummy Bear', tam: [30, 25, 0] }] });

assert.equal(boSetCuaShot({ nhan_vat: [2, 1] }, nv), 7);
assert.equal(boSetCuaShot({ nhan_vat: [4] }, nv), null);                       // Trái Đất: không dựng 3D, không chặn
assert.equal(boSetCuaShot({ nhan_vat: [4, 1] }, nv), null);                    // bay xuyên hai thế giới (cửa sổ → bàn): khung đầu ngoài set
assert.equal(maKhungXam(set, m([25, 4, 1]), nv), maKhungXam(set, m([25, 4, 1]), nv));
assert.notEqual(maKhungXam(set, m([25, 4, 1]), nv), maKhungXam(set, m([25, 5, 1]), nv));   // máy dời 1 cm → phải dựng lại
assert.ok(!bangDung(set, [{ id: 9, thu_tu: 1, may_3d: { ...m([0, 0, 1]), vi_tri: [{ ten: 'Lint', tam: [0, 0, 0] }] } }], nv).ok);   // thiếu khối → lỗi, không đoán
assert.ok(bangDung(set, [{ id: 9, thu_tu: 1, may_3d: m([25, 4, 1]) }], nv).ok);
// Trục Tango–Gummy chạy theo x tại y=25: máy ở y=4 (trước trục) rồi y=40 (sau trục) = vượt trục; cùng phía thì không.
assert.ok(vuotTruc(m([25, 4, 1]), m([25, 40, 1])));
assert.equal(vuotTruc(m([25, 4, 1]), m([10, 10, 1])), null);
assert.equal(vuotTruc(m([25, 4, 1]), m([25, 40, 1]), (t) => t === 'Tango'), null);   // Gummy là đồ vật → không làm đầu trục, không báo
// Cổng
assert.deepEqual(chanKhungXam({ nhan_vat: [4], may_3d: null, khung_xam: null }, nv, null), []);
assert.ok(chanKhungXam({ nhan_vat: [1, 2], may_3d: null, khung_xam: null }, nv, set)[0]!.includes('chưa đặt máy'));
const mm = m([25, 4, 1]);
assert.ok(chanKhungXam({ nhan_vat: [1, 2], may_3d: mm, khung_xam: null }, nv, set)[0]!.includes('chưa dựng'));
const kx = (kiem: { nhan_vat: string; trong_khung: boolean; cao_khung_pt: number; bi_che_boi: string[] }[]) => ({ ma: maKhungXam(set, mm, nv), xam: '', sau: '', luc: '', kiem });
assert.deepEqual(chanKhungXam({ nhan_vat: [1, 2], may_3d: mm, khung_xam: kx([{ nhan_vat: 'Tango', trong_khung: true, cao_khung_pt: 6, bi_che_boi: [] }]) }, nv, set), []);
assert.ok(chanKhungXam({ nhan_vat: [1, 2], may_3d: mm, khung_xam: kx([{ nhan_vat: 'Tango', trong_khung: true, cao_khung_pt: 6, bi_che_boi: ['White Keyboard'] }]) }, nv, set)[0]!.includes('White Keyboard che'));
assert.ok(chanKhungXam({ nhan_vat: [1, 2], may_3d: mm, khung_xam: kx([]) }, nv, set, { nhan_vat: [1], may_3d: m([25, 40, 1]) }).some((x) => x.includes('trục')));
const mAn = { ...mm, vi_tri: [{ ten: 'Tango', tam: [20, 25, 0], an: true }, { ten: 'Gummy Bear', tam: [30, 25, 0] }] };
assert.deepEqual(chanKhungXam({ nhan_vat: [1, 2], may_3d: mAn, khung_xam: { ma: maKhungXam(set, mAn, nv), xam: '', sau: '', luc: '', kiem: [{ nhan_vat: 'Tango', trong_khung: true, cao_khung_pt: 6, bi_che_boi: ['Magic Mouse'] }] } }, nv, set), []);   // cố ý nấp sau chuột → không báo
// Đặt máy tự động: cận gần hơn toàn; phía 0° = máy ở trước (y nhỏ hơn); phía 90° = máy ở bên phải (x lớn hơn); sát đất thì máy thấp.
const k = (t: string) => (t === 'Tango' ? { co: [2, 1.6, 2.6] } : null);
const vt = [{ ten: 'Tango', tam: [0, 50, 0] }];
const cu = datMayTuDong({ vi_tri: vt }, { co_canh: 'cu', goc: 'ngang' }, k), ws = datMayTuDong({ vi_tri: vt }, { co_canh: 'ws', goc: 'ngang' }, k);
const kc = (m: { dat: number[]; nhin: number[] }) => Math.hypot(m.dat[0]! - m.nhin[0]!, m.dat[1]! - m.nhin[1]!);
assert.ok(kc(cu) < kc(ws));
assert.ok(cu.dat[1]! < 50);
assert.ok(datMayTuDong({ vi_tri: vt, phia: 90 }, { co_canh: 'ms' }, k).dat[0]! > 0);
assert.equal(datMayTuDong({ vi_tri: vt }, { co_canh: 'ws', goc: 'sat_dat' }, k).dat[2], 0.5);
// Cố ý vượt trục (POV): shot đó không bị chặn; shot sau so với shot thường gần nhất, bỏ qua POV.
const mPov = { ...m([25, 40, 1]), qua_truc: true };
assert.ok(!chanKhungXam({ nhan_vat: [1, 2], may_3d: mPov, khung_xam: { ma: maKhungXam(set, mPov, nv), xam: '', sau: '', luc: '', kiem: [] } }, nv, set, { nhan_vat: [1], may_3d: m([25, 4, 1]) }).some((x) => x.includes('trục')));
const ds3 = [{ id: 1, may_3d: m([25, 4, 1]) }, { id: 2, may_3d: mPov }, { id: 3, may_3d: m([25, 5, 1]) }];
assert.equal(shotSoTruc(ds3, 2)!.id, 1);
// Kiểm đủ đạo cụ: Gummy có chỗ đứng → đủ; Remote (đạo cụ gắn shot) không có trong set lẫn chỗ đứng → thiếu.
const nv2 = [...nv, { id: 5, ten: 'Remote', loai: 'dao_cu' as const, bo_set_id: null, khoi_3d: null }];
assert.deepEqual(thieuTrongSet({ nhan_vat: [1, 2, 3], may_3d: mm }, nv2, set), []);
assert.deepEqual(thieuTrongSet({ nhan_vat: [1, 2, 3, 5], may_3d: mm }, nv2, set), ['Remote']);
console.log('bo-set-3d.test: ok');
