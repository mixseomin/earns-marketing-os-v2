import assert from 'node:assert';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { May3d } from './kieu';
import { boSetCuaShot, maKhungXam, bangDung, vuotTruc, chanKhungXam, datMayTuDong, shotSoTruc, thieuTrongSet, vatChanTienCanh, moTaThay, lienMachTap, BAN_DUNG, moTaChuyenDong, mayDayDu, nhacMaKhongThay, chuoiChuY, huongToi, choVatSet, maPhan, chuTheQuaTo, chuTheQuaNho, coCanhLech, gocMayLech, gocNgang, huongVoiMay, matQuayDi, nhipDan, thieuTongThe, huongDiChuyen, doiMat, canhBaoMachTap, trangThaiVat } from './bo-set-3d';

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
assert.ok(moTaThay([chan]).includes('Yellow iMac (top-centre, 30%, foreground, cut off by the top edge — only a 30% strip shows)'));
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
assert.deepEqual([BAN_DUNG, bam], [18, 'a96d9a1a781e'], 'dung-set.py đã đổi: tăng BAN_DUNG trong bo-set-3d.ts rồi cập nhật [số, băm] ở dòng này');
// Khối lấp khung (máy dí sát kẹo ở 4.6): ≥ 85% khung → chặn; máy tự động đứng ngoài khối chủ thể kể cả cận cực sát.
assert.ok(chanKhungXam({ nhan_vat: [1, 2], may_3d: mm, khung_xam: kxT([{ ten: 'Gummy Bear', pt: 98.6, hop: [0, 0, 1, 1], tien: false }]) }, nv, setIMac).some((x) => x.includes('lấp 98.6%')));
const ecu = datMayTuDong({ vi_tri: [{ ten: 'Gummy Bear', tam: [0, 50, 0] }], khung: ['Gummy Bear'] }, { co_canh: 'ecu' }, () => ({ co: [1.4, 0.9, 2] }));
assert.ok(Math.hypot(ecu.dat[0]! - ecu.nhin[0]!, ecu.dat[1]! - ecu.nhin[1]!) >= 3);
// Bố cục nhắc vật của set mà khung 3D không thấy → chặn; thấy rồi → qua.
const setHub = { id: 7, du_lieu: { vat: [...set.du_lieu.vat, { ten: 'USB Hub', hinh: 'hop' as const, tam: [0, 0, 0], co: [1, 1, 1], mau: '#ccc' }] } };
const kxH = (thay: { ten: string; pt: number; hop: [number, number, number, number]; tien: boolean }[]) => ({ ma: maKhungXam(setHub, mm, nv), xam: '', sau: '', luc: '', kiem: [], thay });
assert.deepEqual(nhacMaKhongThay({ may_3d: mm, khung_xam: kxH([]), dan_dung: { bo_cuc: 'Tango pressing his hand onto the USB hub.' } }, setHub), ['USB Hub']);   // gợi ý cho bộ giải máy
assert.ok(!chanKhungXam({ nhan_vat: [1, 2], may_3d: mm, khung_xam: kxH([]), dan_dung: { bo_cuc: 'Tango pressing his hand onto the USB hub.' } }, nv, setHub).some((x) => x.includes('nhắc')));   // không chặn (dò chữ báo nhầm)
assert.ok(!chanKhungXam({ nhan_vat: [1, 2], may_3d: mm, khung_xam: kxH([{ ten: 'USB Hub', pt: 6, hop: [0, 0, 1, 1], tien: false }]), dan_dung: { bo_cuc: 'Tango pressing his hand onto the USB hub.' } }, nv, setHub).some((x) => x.includes('nhắc USB Hub')));
// Câu chuyển động từ số đo 3D: món dịch đủ xa thì tả hướng + chỗ đầu/cuối; món đứng yên ghi 'stay in place'.
const cd = moTaChuyenDong([{ ten: 'Lint', tu: [0.5, 0.7], den: [0.55, 0.4] }, { ten: 'Cotton Ball', tu: [0.8, 0.7], den: [0.8, 0.7] }]);
assert.ok(cd.includes('Lint moves screen-right and upward from the lower centre of the frame to the middle centre') && cd.includes('Cotton Ball stays in place'), cd);
assert.equal(moTaChuyenDong([{ ten: 'Tango', tu: [0.5, 0.5], den: [0.51, 0.5] }]), '');
// Đồ đang cầm: Mr. Wipe cầm bình xịt ở #1, #2 có Mr. Wipe mà vắng bình → báo; có bình (cầm) → qua; đặt xuống (không cam) → hết theo dõi.
const sp = (id: number, vt: { ten: string; tam: number[]; cam?: string }[]) => sh(id, vt as never);
assert.ok(lienMachTap([sp(1, [{ ten: 'Mr. Wipe', tam: [0, 0, 5] }, { ten: 'Spray', tam: [0, 0, 4], cam: 'Mr. Wipe' }]), sp(2, [{ ten: 'Mr. Wipe', tam: [0, 0, 5] }])], kh)[2]![0]!.includes('đang cầm Spray'));
assert.deepEqual(lienMachTap([sp(1, [{ ten: 'Mr. Wipe', tam: [0, 0, 5] }, { ten: 'Spray', tam: [0, 0, 4], cam: 'Mr. Wipe' }]), sp(2, [{ ten: 'Mr. Wipe', tam: [0, 0, 5] }, { ten: 'Spray', tam: [0, 0, 4], cam: 'Mr. Wipe' }])], kh), {});
assert.deepEqual(lienMachTap([sp(1, [{ ten: 'Mr. Wipe', tam: [0, 0, 5] }, { ten: 'Spray', tam: [0, 0, 4], cam: 'Mr. Wipe' }]), sp(2, [{ ten: 'Mr. Wipe', tam: [0, 0, 5] }, { ten: 'Spray', tam: [3, 0, 0] }]), sp(3, [{ ten: 'Mr. Wipe', tam: [0, 0, 5] }])], kh), {});
// Đồ để lại: cục bông đặt xuống ở #1 → #2 (không khai) tự có ở chỗ cuối; #3 khai het → #4 không còn; đang cầm thì không để lại.
const dl = mayDayDu([sh(1, [{ ten: 'Lint', tam: [0, 0, 0] }, { ten: 'Bông', tam: [1, 0, 0], den: [2, 0, 0] }]), sh(2, [{ ten: 'Lint', tam: [0, 0, 0] }]), sh(3, [{ ten: 'Bông', tam: [2, 0, 0], het: true } as never]), sh(4, [{ ten: 'Lint', tam: [0, 0, 0] }])], (t) => t === 'Bông');
assert.deepEqual(dl.get(2)!.vi_tri.find((v) => v.ten === 'Bông')?.tam, [2, 0, 0]);
assert.equal(dl.get(4)!.vi_tri.some((v) => v.ten === 'Bông'), false);
assert.equal(mayDayDu([sh(1, [{ ten: 'Bông', tam: [1, 0, 0], cam: 'Lint' } as never]), sh(2, [{ ten: 'Lint', tam: [0, 0, 0] }])], (t) => t === 'Bông').get(2)!.vi_tri.length, 1);
// CHUỖI CHÚ Ý: Tango ở (50,50) chạm phích ở (54,50) — hướng tới phích = 90° (về +x)
assert.equal(Math.round(huongToi([0, 0], [1, 0])), 90); assert.equal(Math.round(huongToi([0, 0], [0, -1])), 0);
const cy = (id: number, vi_tri: Record<string, unknown>[], khung?: string[], pd = '7') => ({ id, thu_tu: id, phan_doan: pd, may_3d: { dat: [0, 0, 1], nhin: [0, 1, 0], ong_kinh: 35, vi_tri, ...(khung ? { khung } : {}) } as never });
const phich = choVatSet({ du_lieu: { vat: [{ ten: 'Cable Plug', tam: [54, 50, 0], mau: '#fff', hinh: 'hop' } as never] } });
assert.deepEqual(phich('Cable Plug'), [54, 50, 0]);
// đủ: nhìn (huong_den 90) → thấy (khung Cable Plug) → làm
assert.deepEqual(chuoiChuY([cy(1, [{ ten: 'Tango', tam: [50, 50, 0], huong: 0, huong_den: 90 }], ['Tango']), cy(2, [{ ten: 'Tango', tam: [50, 50, 0] }], ['Cable Plug']), cy(3, [{ ten: 'Tango', tam: [50, 50, 0], lam: 'Cable Plug' }])], phich), {});
// thiếu cả nhìn lẫn thấy (cắt thẳng sang làm) → đỏ, nêu cả hai
const cy1 = chuoiChuY([cy(1, [{ ten: 'Tango', tam: [50, 50, 0], huong: 0 }]), cy(2, [{ ten: 'Tango', tam: [50, 50, 0], lam: 'Cable Plug' }])], phich)[2]![0]!;
assert.ok(cy1.includes('NHÌN') && cy1.includes('lệch 90°') && cy1.includes('THẤY'), cy1);
// nhìn ở cảnh KHÁC không tính; làm lần hai trên cùng món không phải dẫn lại
assert.ok(chuoiChuY([cy(1, [{ ten: 'Tango', tam: [50, 50, 0], huong: 90 }], ['Cable Plug'], '6'), cy(2, [{ ten: 'Tango', tam: [50, 50, 0], lam: 'Cable Plug' }])], phich)[2]);
assert.deepEqual(chuoiChuY([cy(1, [{ ten: 'Tango', tam: [50, 50, 0], huong: 90 }], ['Tango', 'Cable Plug']), cy(2, [{ ten: 'Tango', tam: [50, 50, 0], lam: 'Cable Plug' }]), cy(3, [{ ten: 'Tango', tam: [50, 50, 0], lam: 'Cable Plug' }])], phich), {});
// nhìn đúng hướng nhưng nhân vật không phải chủ thể khung (khán giả không thấy cú nhìn) → đỏ
assert.ok(chuoiChuY([cy(1, [{ ten: 'Tango', tam: [50, 50, 0], huong: 90 }], ['Cable Plug']), cy(2, [{ ten: 'Tango', tam: [50, 50, 0], lam: 'Cable Plug' }])], phich)[2]![0]!.includes('không phải chủ thể'));
// điểm tác động lam_o: nhìn về góc trái đế cắm (48,50) thay vì tâm phích (54,50)
assert.deepEqual(chuoiChuY([cy(1, [{ ten: 'Tango', tam: [50, 50, 0], huong: -90 }], ['Tango', 'Cable Plug']), cy(2, [{ ten: 'Tango', tam: [50, 50, 0], lam: 'Cable Plug', lam_o: [48, 50, 0] }])], phich), {});
// chủ thể quá to: thẻ dẹt (cao 0,3 cm) phủ tiền cảnh ở cỡ two không tính; nhân vật cao 260% vẫn đỏ
const kxTo = (ten: string) => ({ ky_thuat: { co_canh: 'two' }, khung_xam: { kiem: [{ nhan_vat: ten, bat_buoc: true, trong_khung: true, cao_khung_pt: 260, bi_che_boi: [] }] } as never });
const setThe = { du_lieu: { vat: [{ ten: 'Orange Card', tam: [0, 0, 0], co: [9, 6, 0.3], mau: '#f80', hinh: 'hop' } as never] } };
assert.deepEqual(chuTheQuaTo(kxTo('Orange Card'), setThe), []); assert.equal(chuTheQuaTo(kxTo('Tango'), setThe).length, 1); assert.equal(chuTheQuaTo(kxTo('Orange Card')).length, 1);
// lam không vào mã khung (khai kể chuyện không làm khung đã dựng thành cũ)
const setM = { id: 1, du_lieu: { vat: [] } }; const mLam = (lam?: string) => ({ dat: [0, 0, 1], nhin: [0, 1, 0], ong_kinh: 35, vi_tri: [{ ten: 'Tango', tam: [0, 0, 0], ...(lam ? { lam } : {}) }] });
assert.equal(maKhungXam(setM, mLam("Cable Plug"), []), maKhungXam(setM, mLam(), [])); assert.equal(maPhan(setM, mLam("X"), []).may, maPhan(setM, mLam(), []).may);
// TRẠNG THÁI VẬT: kẹo đã chia 2 ở #2 thì #3 nguyên lại → đỏ; giữ chia → sạch; mayDayDu mang chia theo món để lại
assert.ok(lienMachTap([sh(1, [{ ten: 'Gummy Bear', tam: [0, 0, 0] }]), sh(2, [{ ten: 'Gummy Bear', tam: [0, 0, 0], chia: 2 } as never]), sh(3, [{ ten: 'Gummy Bear', tam: [0, 0, 0] }])], kh)[3]![0]!.includes('đã chia 2 mảnh'));
assert.deepEqual(lienMachTap([sh(1, [{ ten: 'Gummy Bear', tam: [0, 0, 0], chia: 2 } as never]), sh(2, [{ ten: 'Gummy Bear', tam: [0, 0, 0], chia: 2 } as never])], kh), {});
assert.equal(mayDayDu([sh(1, [{ ten: 'Gummy Bear', tam: [1, 0, 0], chia: 2 } as never]), sh(2, [{ ten: 'Lint', tam: [0, 0, 0] }])], (t) => t === 'Gummy Bear').get(2)!.vi_tri.find((v) => v.ten === 'Gummy Bear')!.chia, 2);
// GÓC MÁY 3D ↔ góc khai: 7.1a cũ (máy cao 59°, khai ngang) đỏ; máy ngang tầm sạch; POV nhìn xuống đồ dưới chân (31°) vẫn là ngang
assert.equal(gocNgang({ dat: [60.5, 49.4, 9.6], nhin: [56, 51, 1.6] }), 59);
assert.ok(gocMayLech({ dat: [60.5, 49.4, 9.6], nhin: [56, 51, 1.6] }, 'ngang')!.includes('ngẩng 59°'));
assert.equal(gocMayLech({ dat: [59.9, 46.4, 1.8], nhin: [55.6, 51.6, 1.4] }, 'ngang'), null);
assert.equal(gocMayLech({ dat: [56.4, 50.6, 2.2], nhin: [54.3, 52.6, 0.5] }, 'ngang'), null);
assert.equal(gocMayLech({ dat: [0, 0, 1], nhin: [0, 5, 1] }, 'tren_xuong')!.includes('tren_xuong'), true);
// nhãn khối: gọi bằng mô tả anchor + trạng thái
const lb = moTaThay([{ ten: 'Orange Card', en: 'Orange Card', pt: 30, hop: [0.1, 0.6, 0.9, 0.9], tien: false }, { ten: 'Gummy Bear', pt: 5, hop: [0.4, 0.4, 0.5, 0.5], tien: false, trang: 'split into 2 separate pieces' }], (t) => (t === 'Orange Card' ? 'an orange leather card holder' : undefined));
assert.ok(lb.includes('an orange leather card holder (bottom') && lb.includes('Gummy Bear [split into 2 separate pieces]'), lb);
// chủ thể cú cận chỉ là một mẩu (#32 tập 19: phích 3.3%) → chặn; cỡ rộng không đo; đủ lớn (kể cả chạm mép) → qua
const kxNho = (pt: number, hop: number[]) => ({ kiem: [{ nhan_vat: 'Cable Plug', bat_buoc: true, trong_khung: true, bi_che_boi: [], cao_khung_pt: 20 }], thay: [{ ten: 'Cable Plug', pt, hop, tien: false }] }) as never;
assert.equal(chuTheQuaNho({ khung_xam: kxNho(3.3, [0.778, 0.333, 1, 0.583]), ky_thuat: { co_canh: 'cu' } as never }).length, 1);
assert.equal(chuTheQuaNho({ khung_xam: kxNho(9, [0.8, 0.3, 1, 0.6]), ky_thuat: { co_canh: 'cu' } as never }).length, 0);   // chạm mép mà đủ lớn → qua
assert.equal(chuTheQuaNho({ khung_xam: kxNho(9, [0.2, 0.3, 0.5, 0.6]), ky_thuat: { co_canh: 'cu' } as never }).length, 0);
assert.equal(chuTheQuaNho({ khung_xam: kxNho(1, [0.8, 0.3, 1, 0.4]), ky_thuat: { co_canh: 'ws' } as never }).length, 0);
// hướng nhân vật so với máy: máy ở −y nhìn +y; huong 0 = nhìn về −y = nhìn máy; 180 = quay lưng; 90 = nhìn +x = phải màn hình
const mT = { dat: [0, -10, 1], nhin: [0, 0, 1] };
assert.equal(huongVoiMay(mT, { ten: 'T', tam: [0, 0, 0], huong: 0 })!.chu, 'facing the camera');
assert.ok(huongVoiMay(mT, { ten: 'T', tam: [0, 0, 0], huong: 180 })!.chu.startsWith('back to the camera'));
assert.equal(huongVoiMay(mT, { ten: 'T', tam: [0, 0, 0], huong: 90 })!.chu, 'in profile, facing screen-right');
assert.equal(huongVoiMay(mT, { ten: 'T', tam: [0, 0, 0], huong: -90 })!.chu, 'in profile, facing screen-left');
// shot phản ứng thấy nghiêng (98°, như #38) → chặn; thấy 3/4 mặt → qua; cỡ rộng không phản ứng → không đo
const laNv = (t: string) => t === 'T';
assert.equal(matQuayDi({ may_3d: { ...mT, ong_kinh: 50, khung: ['T'], vi_tri: [{ ten: 'T', tam: [0, 0, 0], huong: 98 }] }, ky_thuat: { vai: 'phan_ung', co_canh: 'two' } as never }, laNv).length, 1);
assert.equal(matQuayDi({ may_3d: { ...mT, ong_kinh: 50, khung: ['T'], vi_tri: [{ ten: 'T', tam: [0, 0, 0], huong: 50 }] }, ky_thuat: { vai: 'phan_ung', co_canh: 'two' } as never }, laNv).length, 0);
assert.equal(matQuayDi({ may_3d: { ...mT, ong_kinh: 50, khung: ['T'], vi_tri: [{ ten: 'T', tam: [0, 0, 0], huong: 180 }] }, ky_thuat: { vai: 'hanh_dong', co_canh: 'mcu' } as never }, laNv).length, 0);   // hành động thấy lưng: không đo
// nhịp dẫn: 4 shot cùng hướng + 1 lệch 90° → chặn đúng shot lệch; hai shot qua trục liền nhau → chặn shot sau
const shN = (id: number, deg: number, qt = false) => ({ id, thu_tu: id, phan_doan: 'A', may_3d: { dat: [0, 0, 1], nhin: [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180), 1], ong_kinh: 35, vi_tri: [], ...(qt ? { qua_truc: true } : {}) } });
const nd = nhipDan([shN(1, 90), shN(2, 95), shN(3, 0), shN(4, 85), shN(5, 100), shN(6, 270, true), shN(7, 200, true)]);
assert.deepEqual(Object.keys(nd).map(Number).sort(), [3, 7], JSON.stringify(nd));
// shot thiết lập góc riêng (như #12) không bị chặn
assert.equal(nhipDan([shN(1, 90), shN(2, 95), { ...shN(3, 0), ky_thuat: { vai: 'thiet_lap' } }, shN(4, 85)])[3], undefined);
// ── nhất quán · liên tục (15/10/2026) ──
const laNv2 = (t: string) => ['T', 'L'].includes(t);
const thay = (...ds: [string, number, number[]][]) => ({ thay: ds.map(([ten, pt, hop]) => ({ ten, pt, hop, tien: false })), kiem: [] }) as never;
const mD = (deg: number, z = 1.5, vi_tri: May3d['vi_tri'] = [], k: Partial<May3d> = {}): May3d => ({ dat: [0, 0, z], nhin: [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180), 1], ong_kinh: 35, vi_tri, ...k });
// trạng thái nhân vật vào prompt + nối qua cú cắt
assert.equal(trangThaiVat({ ten: 'W', tam: [0, 0, 0], trang: 'frizzed stiff' }), 'frizzed stiff');
assert.equal(trangThaiVat({ ten: 'W', tam: [0, 0, 0], trang_den: 'frizzed stiff' }, true), 'frizzed stiff');
const lmT = lienMachTap([{ id: 1, thu_tu: 1, may_3d: mD(90, 1.5, [{ ten: 'W', tam: [5, 5, 0], trang_den: 'frizzed stiff' }]) }, { id: 2, thu_tu: 2, may_3d: mD(90, 1.5, [{ ten: 'W', tam: [5, 5, 0] }]) }], () => null);
assert.ok(lmT[2]?.[0]?.includes('frizzed stiff'), JSON.stringify(lmT));
assert.equal(lienMachTap([{ id: 1, thu_tu: 1, may_3d: mD(90, 1.5, [{ ten: 'W', tam: [5, 5, 0], trang_den: 'frizzed stiff' }]) }, { id: 2, thu_tu: 2, may_3d: mD(90, 1.5, [{ ten: 'W', tam: [5, 5, 0], trang: 'frizzed stiff' }]) }], () => null)[2], undefined);
// shot tổng thể: cảnh 3 shot, 2 nhân vật, không shot nào thấy cả hai → chặn shot đông người; có một shot thấy đủ → qua
const tt = (thayL: boolean) => [
  { id: 1, thu_tu: 1, phan_doan: 'A', may_3d: mD(90, 1.5, [{ ten: 'T', tam: [0, 5, 0] }, { ten: 'L', tam: [3, 5, 0] }]), khung_xam: thay(['T', 20, [0.2, 0.2, 0.5, 0.8]], ...(thayL ? [['L', 10, [0.6, 0.3, 0.8, 0.7]] as [string, number, number[]]] : [])) },
  { id: 2, thu_tu: 2, phan_doan: 'A', may_3d: mD(90, 1.5, [{ ten: 'T', tam: [0, 5, 0] }]), khung_xam: thay(['T', 30, [0.2, 0.2, 0.7, 0.8]]) },
  { id: 3, thu_tu: 3, phan_doan: 'A', may_3d: mD(90, 1.5, [{ ten: 'L', tam: [3, 5, 0] }]), khung_xam: thay(['L', 30, [0.2, 0.2, 0.7, 0.8]]) }];
assert.ok(thieuTongThe(tt(false), laNv2)[1]?.[0]?.includes('TỔNG THỂ'));
assert.equal(Object.keys(thieuTongThe(tt(true), laNv2)).length, 0);
// hướng di chuyển: đi +x ở cả hai shot, máy shot 2 quay sang phía bên kia (nhìn −y) → trên màn đảo → chặn; nhân vật tự quay lại (−x) → không;
// cú trung lập giữa → qua; khai qua_truc → qua
const di = (id: number, tu: number[], den: number[], deg = 90, qt = false) => ({ id, thu_tu: id, phan_doan: 'A', may_3d: mD(deg, 1.5, [{ ten: 'T', tam: tu, den }], qt ? { qua_truc: true } : {}) });
assert.ok(huongDiChuyen([di(1, [0, 5, 0], [4, 5, 0]), di(2, [4, 5, 0], [8, 5, 0], 270)], laNv2)[2]?.[0]?.includes('đảo'));
assert.equal(Object.keys(huongDiChuyen([di(1, [0, 5, 0], [4, 5, 0]), di(2, [4, 5, 0], [0, 5, 0])], laNv2)).length, 0);
assert.equal(Object.keys(huongDiChuyen([di(1, [0, 5, 0], [4, 5, 0]), di(2, [4, 8, 0], [4, 3, 0]), di(3, [4, 3, 0], [8, 3, 0], 270)], laNv2)).length, 0);
assert.equal(Object.keys(huongDiChuyen([di(1, [0, 5, 0], [4, 5, 0]), di(2, [4, 5, 0], [8, 5, 0], 270, true)], laNv2)).length, 0);
// đối mặt: T (trái) và L (phải) quay vào nhau; shot 1 chủ thể T nhìn sang phải màn, shot 2 chủ thể L phải nhìn sang trái — máy cùng phía → đúng; L khai huong sai (cũng sang phải) → chặn
const dm = (hL: number) => [
  { id: 1, thu_tu: 1, phan_doan: 'A', may_3d: mD(90, 1.5, [{ ten: 'T', tam: [0, 5, 0], huong: 90 }, { ten: 'L', tam: [4, 5, 0], huong: hL }], { khung: ['T'] }) },
  { id: 2, thu_tu: 2, phan_doan: 'A', may_3d: mD(90, 1.5, [{ ten: 'T', tam: [0, 5, 0], huong: 90 }, { ten: 'L', tam: [4, 5, 0], huong: hL }], { khung: ['L'] }) }];
assert.equal(Object.keys(doiMat(dm(-90), laNv2)).length, 0);
// L nhìn +x (90) trong khi T ở −x → không phải cú đối mặt (lệch 180°) → không đo; để bắt khai sai cần hướng lệch ≤ 45° — mô phỏng: L nhìn 60° (vẫn "về" T? không: T ở −90). Kiểm bằng máy đổi phía: máy ở +y nhìn −y (phải màn = −x)
const dm2 = [dm(-90)[0]!, { ...dm(-90)[1]!, may_3d: { ...dm(-90)[1]!.may_3d, dat: [2, 10, 1.5], nhin: [2, 0, 1] } }];
assert.ok(doiMat(dm2, laNv2)[2]?.[0]?.includes('cùng hướng'), JSON.stringify(doiMat(dm2, laNv2)));
// cảnh báo: luật 30° (cùng chủ thể, góc đổi 10°, cỡ ms → mcu) + eye trace (tâm nhảy) + headroom + ống kính
const cb = canhBaoMachTap([
  { id: 1, thu_tu: 1, phan_doan: 'A', ky_thuat: { co_canh: 'ms', goc: 'ngang' }, may_3d: mD(90, 1.5, [{ ten: 'T', tam: [0, 10, 0] }], { khung: ['T'], ong_kinh: 24 }), khung_xam: thay(['T', 20, [0, 0.1, 0.3, 0.6]]) },
  { id: 2, thu_tu: 2, phan_doan: 'A', ky_thuat: { co_canh: 'mcu', goc: 'ngang' }, may_3d: { ...mD(80, 1.5, [{ ten: 'T', tam: [0, 10, 0] }], { khung: ['T'] }), ong_kinh: 35 }, khung_xam: thay(['T', 30, [0.7, 0.4, 1, 0.9]]) },
  { id: 3, thu_tu: 3, phan_doan: 'A', ky_thuat: { co_canh: 'cu', goc: 'ngang' }, may_3d: mD(90, 9, [{ ten: 'T', tam: [0, 10, 0] }], { khung: ['T'], ong_kinh: 50 }), khung_xam: thay(['T', 30, [0.3, 0.1, 0.7, 0.9]]) },
  { id: 4, thu_tu: 4, phan_doan: 'A', ky_thuat: { co_canh: 'cu', goc: 'ngang' }, may_3d: mD(90, 1.5, [{ ten: 'T', tam: [0, 10, 0] }], { khung: ['T'], ong_kinh: 85 }), khung_xam: thay(['T', 30, [0.3, 0.1, 0.7, 0.9]]) }], laNv2);
assert.ok(cb[2]?.some((x) => x.startsWith('luật 30°')) && cb[2]?.some((x) => x.startsWith('eye trace')) && cb[2]?.some((x) => x.startsWith('headroom')), JSON.stringify(cb[2]));
assert.ok(cb[3]?.some((x) => x.startsWith('chiều cao máy')), JSON.stringify(cb[3]));
assert.ok(Object.values(cb).flat().some((x) => x.startsWith('bộ ống kính')), JSON.stringify(cb));
console.log('bo-set-3d.test: ok');

// Cỡ cảnh khớp 3D: đo nhân vật chính (cao nhất), nhân vật phụ nhỏ không tính; đạo cụ không tính.
{
  const kx = (ds: [string, number][]) => ({ kiem: ds.map(([t, cao]) => ({ nhan_vat: t, bat_buoc: true, trong_khung: true, cao_khung_pt: cao, bi_che_boi: [] })) }) as never;
  const nv = (t: string) => t === 'Tango' || t === 'Lint';
  assert.equal(coCanhLech({ khung_xam: kx([['Tango', 10.7], ['Gummy Bear', 40]]), ky_thuat: { co_canh: 'two' } as never }, nv).length, 1);   // #8: kẹo to không cứu được Tango bé
  assert.equal(coCanhLech({ khung_xam: kx([['Tango', 35.1], ['Lint', 21.3]]), ky_thuat: { co_canh: 'mcu' } as never }, nv).length, 0);       // #23: Lint xa hơn là dàn cảnh chiều sâu
  assert.equal(coCanhLech({ khung_xam: kx([['Tango', 9.4], ['Lint', 8]]), ky_thuat: { co_canh: 'ms' } as never }, nv).length, 1);
  assert.equal(coCanhLech({ khung_xam: kx([['Tango', 5]]), ky_thuat: { co_canh: 'ws' } as never }, nv).length, 0);                         // toàn cảnh: nhỏ là đúng
}

// 3D là nguồn duy nhất: vật chạm mép ghi rõ chỉ ló bao nhiêu; danh sách nói chữ ngoài danh sách = ngoài khung (#35: đế cắm ló dải 10% bị vẽ cả cái).
{
  const { catMep, moTaThay: mt } = await import('./bo-set-3d');
  assert.match(catMep([0, 0.9, 1, 1]), /bottom edge — only a 10% strip/);
  assert.equal(catMep([0.2, 0.2, 0.8, 0.8]), '');
  const c = mt([{ ten: 'USB Hub', pt: 8.6, hop: [0, 0.9, 1, 1], tien: true } as never]);
  assert.match(c, /cut off by the bottom edge/); assert.match(c, /OFF-SCREEN at this instant/);
}

// Chữ lệch 3D: chữ shot nhắc nhân vật mà khung không thấy → ⚐; nhân vật đi VÀO khung (di.den trong khung) → không báo.
{
  const { canhBaoMachTap: cb } = await import('./bo-set-3d');
  const m = { dat: [0, -10, 2], nhin: [0, 0, 1], ong_kinh: 35, vi_tri: [{ ten: 'Mr. Wipe', tam: [0, 0, 3] }, { ten: 'Tango', tam: [9, 9, 0], an: true }, { ten: 'Lint', tam: [9, 8, 0], an: true }] } as never;
  const kx = (di: unknown[]) => ({ thay: [{ ten: 'Mr. Wipe', pt: 24, hop: [0.2, 0.2, 0.8, 0.7] }], di }) as never;
  const s = (di: unknown[]) => [{ id: 1, thu_tu: 35, phan_doan: 'x', may_3d: m, khung_xam: kx(di), hanh_dong: 'Mr. Wipe swoops in; Tango and Lint hide behind the card.' }];
  const a = cb(s([]), () => true)[1] ?? [];
  assert.ok(a.some((x) => x.includes('chữ lệch 3D') && x.includes('Tango') && x.includes('Lint') && !x.includes('Mr. Wipe')), JSON.stringify(a));
  const b = cb(s([{ ten: 'Tango', tu: [1.3, 0.5], den: [0.6, 0.5] }, { ten: 'Lint', tu: [1.3, 0.5], den: [0.7, 0.5] }]), () => true)[1] ?? [];
  assert.ok(!b.some((x) => x.includes('chữ lệch 3D')), 'đi vào khung → không báo');
}
