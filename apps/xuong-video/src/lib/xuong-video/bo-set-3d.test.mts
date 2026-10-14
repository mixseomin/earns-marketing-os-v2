import assert from 'node:assert';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { boSetCuaShot, maKhungXam, bangDung, vuotTruc, chanKhungXam, datMayTuDong, shotSoTruc, thieuTrongSet, vatChanTienCanh, moTaThay, lienMachTap, BAN_DUNG, moTaChuyenDong } from './bo-set-3d';

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
const kx = (kiem: { nhan_vat: string; trong_khung: boolean; cao_khung_pt: number; bi_che_boi: string[] }[]) => ({ ma: maKhungXam(set, mm, nv), xam: '', sau: '', luc: '', kiem, thay: [] });
assert.deepEqual(chanKhungXam({ nhan_vat: [1, 2], may_3d: mm, khung_xam: kx([{ nhan_vat: 'Tango', trong_khung: true, cao_khung_pt: 6, bi_che_boi: [] }]) }, nv, set), []);
assert.ok(chanKhungXam({ nhan_vat: [1, 2], may_3d: mm, khung_xam: kx([{ nhan_vat: 'Tango', trong_khung: true, cao_khung_pt: 6, bi_che_boi: ['White Keyboard'] }]) }, nv, set)[0]!.includes('White Keyboard che'));
// Trục chỉ giữa NHÂN VẬT: Tango–Gummy (đồ vật) không dựng trục; coi Gummy là nhân vật thì vượt trục bị bắt.
assert.ok(!chanKhungXam({ nhan_vat: [1, 2], may_3d: mm, khung_xam: kx([]) }, nv, set, { nhan_vat: [1], may_3d: m([25, 40, 1]) }).some((x) => x.includes('trục')));
const nvHaiNguoi = nv.map((v) => (v.ten === 'Gummy Bear' ? { ...v, loai: 'nhan_vat' as const } : v));
assert.ok(chanKhungXam({ nhan_vat: [1, 2], may_3d: mm, khung_xam: kx([]) }, nvHaiNguoi, set, { nhan_vat: [1], may_3d: m([25, 40, 1]) }).some((x) => x.includes('trục')));
const mAn = { ...mm, vi_tri: [{ ten: 'Tango', tam: [20, 25, 0], an: true }, { ten: 'Gummy Bear', tam: [30, 25, 0] }] };
assert.deepEqual(chanKhungXam({ nhan_vat: [1, 2], may_3d: mAn, khung_xam: { ma: maKhungXam(set, mAn, nv), xam: '', sau: '', luc: '', kiem: [{ nhan_vat: 'Tango', trong_khung: true, cao_khung_pt: 6, bi_che_boi: ['Magic Mouse'] }], thay: [] } }, nv, set), []);   // cố ý nấp sau chuột → không báo
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
// Nhắc tên trong chữ tả khung (bố cục) mà 3D chưa đặt → thiếu, kể cả khi chưa gắn anchor; nhắc ở "thấy" (ngoài khung) thì không tính.
assert.deepEqual(thieuTrongSet({ nhan_vat: [1, 2], may_3d: mm, dan_dung: { bo_cuc: 'Mid: Tango. Background: the Remote, blurred.' } }, nv2, set), ['Remote']);
assert.deepEqual(thieuTrongSet({ nhan_vat: [1, 2], may_3d: mm, dan_dung: { thay: 'Tango nghĩ tới cái Remote.' } as never }, nv2, set), []);
// Vật chắn tiền cảnh: iMac chắn 30% khung trước chủ thể, bố cục không nhắc → chặn; bố cục có nhắc "iMac" → cố ý, qua; mặt nền / dưới 12% → không tính.
const setIMac = { id: 7, du_lieu: { vat: [...set.du_lieu.vat, { ten: 'Yellow iMac', goc: [0, 0], phan: [] }] } };
const kxT = (thay: { ten: string; pt: number; hop: [number, number, number, number]; tien: boolean }[]) => ({ ma: maKhungXam(setIMac, mm, nv), xam: '', sau: '', luc: '', kiem: [], thay });
const chan = { ten: 'Yellow iMac', pt: 30, hop: [0, 0, 1, 0.3] as [number, number, number, number], tien: true };
assert.ok(chanKhungXam({ nhan_vat: [1, 2], may_3d: mm, khung_xam: kxT([chan]) }, nv, setIMac).some((x) => x.includes('Yellow iMac chắn tiền cảnh')));
assert.deepEqual(vatChanTienCanh({ may_3d: mm, khung_xam: kxT([chan]), dan_dung: { bo_cuc: 'Foreground: the yellow iMac stand, blurred.' } }, setIMac), []);
assert.deepEqual(vatChanTienCanh({ may_3d: mm, khung_xam: kxT([{ ...chan, pt: 8 }]) }, setIMac), []);
assert.ok(chanKhungXam({ nhan_vat: [1, 2], may_3d: mm, khung_xam: { ...kxT([]), thay: undefined } }, nv, setIMac).some((x) => x.includes('đời cũ')));
assert.ok(moTaThay([chan]).includes('Yellow iMac (top-centre, 30%, foreground)'));
// Liền mạch: shot sau mở đúng chỗ shot trước kết (den) → qua; lệch 5 cm → đứt mạch; vắng một shot ở giữa vẫn so với lần cuối thấy;
// khai nhay → không báo; quay ngoắt >60° qua cú cắt → báo.
const kh = () => ({ co: [2, 1.6, 2.6] });
const sh = (id: number, vi_tri: { ten: string; tam: number[]; den?: number[]; huong?: number }[], nhay?: string) => ({ id, thu_tu: id, may_3d: { dat: [0, 0, 1], nhin: [0, 1, 0], ong_kinh: 35, vi_tri, ...(nhay ? { nhay } : {}) } });
assert.deepEqual(lienMachTap([sh(1, [{ ten: 'Tango', tam: [0, 0, 0], den: [10, 0, 0] }]), sh(2, [{ ten: 'Tango', tam: [10, 0.3, 0] }])], kh), {});
assert.ok(lienMachTap([sh(1, [{ ten: 'Tango', tam: [0, 0, 0], den: [10, 0, 0] }]), sh(2, [{ ten: 'Tango', tam: [15, 0, 0] }])], kh)[2]![0]!.includes('lệch 5 cm'));
assert.ok(lienMachTap([sh(1, [{ ten: 'Lint', tam: [0, 0, 0] }]), sh(2, [{ ten: 'Tango', tam: [5, 0, 0] }]), sh(3, [{ ten: 'Lint', tam: [3, 0, 0] }])], kh)[3]![0]!.includes('kết #1'));
assert.deepEqual(lienMachTap([sh(1, [{ ten: 'Tango', tam: [0, 0, 0] }]), sh(2, [{ ten: 'Tango', tam: [40, 0, 0] }], 'thời gian trôi: trượt cáp xuống đế cắm')], kh), {});
assert.ok(lienMachTap([sh(1, [{ ten: 'Tango', tam: [0, 0, 0], huong: 90 }]), sh(2, [{ ten: 'Tango', tam: [0, 0, 0], huong: -90 }])], kh)[2]![0]!.includes('quay ngoắt 180°'));
assert.deepEqual(lienMachTap([sh(1, [{ ten: 'Gummy Bear', tam: [0, 0, 0] }]), sh(2, [{ ten: 'Gummy Bear', tam: [3, 0, 1], cam: 'Tango' } as never]), sh(3, [{ ten: 'Gummy Bear', tam: [50, 0, 0] }])], kh), {});
assert.deepEqual(lienMachTap([sh(1, [{ ten: 'Sticky', tam: [0, 0, 0] }]), sh(2, [{ ten: 'Sticky', tam: [50, 0, 0], nhay: 'lẻn theo ngoài khung' } as never])], kh), {});
// Đồ tuỳ chọn: bố cục nhắc laptop mà shot chưa khai them → thiếu; khai rồi → đủ.
const setLap = { id: 7, du_lieu: { vat: [...set.du_lieu.vat, { ten: 'MacBook Pro', tuy_chon: true, goc: [0, 100], phan: [] }] } };
assert.ok(thieuTrongSet({ nhan_vat: [1, 2], may_3d: mm, dan_dung: { bo_cuc: 'Background: the open MacBook Pro.' } }, nv, setLap).some((x) => x.startsWith('MacBook Pro')));
assert.deepEqual(thieuTrongSet({ nhan_vat: [1, 2], may_3d: { ...mm, them: ['MacBook Pro'] }, dan_dung: { bo_cuc: 'Background: the open MacBook Pro.' } }, nv, setLap), []);
// Sửa scripts/bo-set/dung-set.py thì phải tăng BAN_DUNG (khung xám cũ tự hết hiệu lực) rồi ghi lại băm ở đây.
const bam = createHash('sha1').update(readFileSync(new URL('../../../scripts/bo-set/dung-set.py', import.meta.url))).digest('hex').slice(0, 12);
assert.deepEqual([BAN_DUNG, bam], [10, 'e708368f03fe'], 'dung-set.py đã đổi: tăng BAN_DUNG trong bo-set-3d.ts rồi cập nhật [số, băm] ở dòng này');
// Khối lấp khung (máy dí sát kẹo ở 4.6): ≥ 85% khung → chặn; máy tự động đứng ngoài khối chủ thể kể cả cận cực sát.
assert.ok(chanKhungXam({ nhan_vat: [1, 2], may_3d: mm, khung_xam: kxT([{ ten: 'Gummy Bear', pt: 98.6, hop: [0, 0, 1, 1], tien: false }]) }, nv, setIMac).some((x) => x.includes('lấp 98.6%')));
const ecu = datMayTuDong({ vi_tri: [{ ten: 'Gummy Bear', tam: [0, 50, 0] }], khung: ['Gummy Bear'] }, { co_canh: 'ecu' }, () => ({ co: [1.4, 0.9, 2] }));
assert.ok(Math.hypot(ecu.dat[0]! - ecu.nhin[0]!, ecu.dat[1]! - ecu.nhin[1]!) >= 3);
// Bố cục nhắc vật của set mà khung 3D không thấy → chặn; thấy rồi → qua.
const setHub = { id: 7, du_lieu: { vat: [...set.du_lieu.vat, { ten: 'USB Hub', hinh: 'hop' as const, tam: [0, 0, 0], co: [1, 1, 1], mau: '#ccc' }] } };
const kxH = (thay: { ten: string; pt: number; hop: [number, number, number, number]; tien: boolean }[]) => ({ ma: maKhungXam(setHub, mm, nv), xam: '', sau: '', luc: '', kiem: [], thay });
assert.ok(chanKhungXam({ nhan_vat: [1, 2], may_3d: mm, khung_xam: kxH([]), dan_dung: { bo_cuc: 'Tango pressing his hand onto the USB hub.' } }, nv, setHub).some((x) => x.includes('nhắc USB Hub')));
assert.ok(!chanKhungXam({ nhan_vat: [1, 2], may_3d: mm, khung_xam: kxH([{ ten: 'USB Hub', pt: 6, hop: [0, 0, 1, 1], tien: false }]), dan_dung: { bo_cuc: 'Tango pressing his hand onto the USB hub.' } }, nv, setHub).some((x) => x.includes('nhắc USB Hub')));
// Câu chuyển động từ số đo 3D: món dịch đủ xa thì tả hướng + chỗ đầu/cuối; món đứng yên ghi 'stay in place'.
const cd = moTaChuyenDong([{ ten: 'Lint', tu: [0.5, 0.7], den: [0.55, 0.4] }, { ten: 'Cotton Ball', tu: [0.8, 0.7], den: [0.8, 0.7] }]);
assert.ok(cd.includes('Lint moves screen-right and upward from the lower centre of the frame to the middle centre') && cd.includes('Cotton Ball stays in place'), cd);
assert.equal(moTaChuyenDong([{ ten: 'Tango', tu: [0.5, 0.5], den: [0.51, 0.5] }]), '');
console.log('bo-set-3d.test: ok');
