// node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/so-do-shot.test.mts
import assert from 'node:assert';
import { svgSoDoShot, veShotTuCanh, tocGlyph } from './so-do-shot';
import type { KhongGian } from './khong-gian';
import type { Canh } from './kieu';

// sơ đồ 2D tối giản: máy nhìn về phía bắc, Hạ bên trái (tây), Vivian bên phải (đông), Hạ nhìn Vivian; thẻ trên cổ Hạ tới mảnh 7 rồi sang tay Vivian
const kg = { nguoi: ['Hạ', 'Vivian'], so_do: { moc: { ha: [-1, 3], vi: [1, 3] }, may: { m: { dat: [0, 0], nhin: [0, 3] } } },
  so_vat: { 'Thẻ': [{ tu: 1, ai: 'Hạ', cach: 'on her neck', vi: 'đeo cổ' }, { tu: 7, ai: 'Vivian', cach: "in Vivian's right hand", vi: 'tay phải Vivian', su_kien: 'giật' }] } } as unknown as KhongGian;
const c = (thu_tu: number, co: string) => ({ id: thu_tu, thu_tu, nhan_vat: [9], ky_thuat: { co_canh: co, sd: { may: 'm', o: { 'Hạ': 'ha', 'Vivian': 'vi' }, nhin: { 'Hạ': 'Vivian', 'Vivian': 'Hạ' } } },
  bieu_cam: [{ nv: 'Hạ', dau: 'soc', cuoi: 'nhuc_nha' }] }) as unknown as Canh;
const v = veShotTuCanh(c(5, 'ms'), kg)!;
assert.ok(v, 'có sơ đồ cảnh → có hình');
const ha = v.nguoi.find((n) => n.ten === 'Hạ')!, vi = v.nguoi.find((n) => n.ten === 'Vivian')!;
assert.ok(ha.x < 0.5 && vi.x > 0.5, `Hạ trái màn, Vivian phải màn (${ha.x}, ${vi.x})`);
assert.equal(ha.nhin_huong, 1, 'Hạ nhìn sang phải màn'); assert.deepEqual(ha.mat, ['soc', 'nhuc_nha']);
assert.deepEqual(ha.do?.map((d) => d.mon), ['Thẻ'], 'mảnh 5: thẻ trên người Hạ');
assert.deepEqual(veShotTuCanh(c(8, 'ms'), kg)!.nguoi.find((n) => n.ten === 'Vivian')!.do?.map((d) => d.mon), ['Thẻ'], 'mảnh 8: thẻ đã sang Vivian');
assert.equal(veShotTuCanh(c(5, 'ms'), null), null, 'không sơ đồ cảnh → không vẽ');
const svg = svgSoDoShot(v); assert.ok(svg.startsWith('<svg') && svg.includes('cuối · Hạ') && svg.includes('stroke-dasharray'), 'có ô nét cuối + mũi tên ánh nhìn');
const tron = svgSoDoShot(v, { sach: true }); assert.ok(!tron.includes('<text') && !tron.includes('stroke-dasharray'), 'khung trơn cho model: không chữ, không mũi tên');
assert.ok(svgSoDoShot({ co: 'insert', nguoi: [], khai: ['Thẻ'] }).includes('Thẻ'), 'cận đồ vẽ món');
// CẮT GIỮA ĐỘNG TÁC: shot 5 nối động tác (noi = dong_tac); shot 6 Hạ quay sang nhìn trái → khung CUỐI shot 5: đầu bắt đầu quay sang trái
const c5 = { ...c(5, 'cu'), phan_doan: 'A', dan_dung: { noi: 'dong_tac' } } as unknown as Canh;
const c6 = { ...c(6, 'cu'), phan_doan: 'A', ky_thuat: { co_canh: 'cu', sd: { may: 'm', o: { 'Hạ': 'ha', 'Vivian': 'vi' }, nhin: { 'Hạ': [-5, 3] } } } } as unknown as Canh;
const k5 = veShotTuCanh(c5, kg, [], { luc: 'ket', sau: c6 })!; const h5 = k5.nguoi.find((n) => n.ten === 'Hạ')!;
assert.equal(h5.bat_dau_quay, -1, 'cuối shot 5: Hạ bắt đầu quay sang trái'); assert.ok(h5.quay! < 40 && h5.quay! > -40, `đầu mới quay một phần (${h5.quay})`);
assert.ok(svgSoDoShot(k5).includes('bắt đầu quay ←') && svgSoDoShot(k5).includes('CUỐI shot'));
assert.equal(veShotTuCanh({ ...c5, dan_dung: {} } as unknown as Canh, kg, [], { luc: 'ket', sau: c6 })!.nguoi.find((n) => n.ten === 'Hạ')!.bat_dau_quay, undefined, 'không nối động tác → không vẽ');
assert.ok(!svgSoDoShot(k5, { sach: true }).includes('bắt đầu quay'), 'khung trơn: đầu đã quay nhưng không mũi tên / chữ');
// quay lưng ở cuối shot trước, shot sau quay sang phải → vẫn vẽ "bắt đầu quay →"
const kgL = { ...kg, so_do: { ...kg.so_do, moc: { ...kg.so_do.moc, thang: [-1, 9] } } } as unknown as KhongGian;
const c1 = { ...c(1, 'ws'), phan_doan: 'A', dan_dung: { noi: 'dong_tac' }, ky_thuat: { co_canh: 'ws', sd: { may: 'm', o: { 'Hạ': 'ha' }, nhin: { 'Hạ': 'thang' } } } } as unknown as Canh;
const c2 = { ...c(2, 'cu'), phan_doan: 'A', ky_thuat: { co_canh: 'cu', sd: { may: 'm', o: { 'Hạ': 'ha' }, nhin: { 'Hạ': 'thang' } }, sd_ket: { nhin: { 'Hạ': 'vi' } } } } as unknown as Canh;
assert.equal(veShotTuCanh(c1, kgL, [], { luc: 'ket', sau: c2 })!.nguoi[0]!.bat_dau_quay, 1, 'quay lưng → shot sau quay phải: mũi tên phải');

// MỘT NGUỒN tóc: tocGlyph suy đúng từ mô tả DB thật của #353 (nguồn gây trôi tóc Vivian)
assert.equal(tocGlyph('East Asian woman, 32, 168 cm, sharp arched brows, sleek low bun'), 'bui', 'Vivian DB low bun → búi (KHÔNG phải đuôi ngựa của bảng nháp)');
assert.equal(tocGlyph('East Asian woman, 24, long straight black hair'), 'dai', 'Hạ DB long → dài');
assert.equal(tocGlyph('East Asian man, 30, short side-parted black hair'), 'ngan', 'Lục Thần DB short → ngắn');
assert.equal(tocGlyph('woman with glossy hair in a ponytail'), 'duoi_ngua', 'ponytail → đuôi ngựa');
assert.equal(tocGlyph('bald'), undefined, 'không nhận ra → undefined (không vẽ tóc đoán bừa)');
// phá thử: nếu tocGlyph bắt nhầm "low bun" thành đuôi ngựa thì cả hệ lại lệch như cũ → phải KHÁC duoi_ngua
assert.notEqual(tocGlyph('sleek low bun'), 'duoi_ngua', 'búi không được suy thành đuôi ngựa');
// sơ đồ từ DB: veShotTuCanh lấy tóc theo mô tả DB truyền vào, không còn phụ thuộc trường gõ tay
const vToc = veShotTuCanh(c(5, 'ms'), kg, [{ id: 9, ten: 'Hạ', loai: 'nhan_vat', mo_ta: 'long straight black hair' }, { id: 10, ten: 'Vivian', loai: 'nhan_vat', mo_ta: 'sleek low bun' }])!;
assert.equal(vToc.nguoi.find((n) => n.ten === 'Hạ')!.toc, 'dai', 'sơ đồ DB: Hạ tóc dài');
assert.equal(vToc.nguoi.find((n) => n.ten === 'Vivian')!.toc, 'bui', 'sơ đồ DB: Vivian tóc búi');
console.log('so-do-shot.test: ok');
