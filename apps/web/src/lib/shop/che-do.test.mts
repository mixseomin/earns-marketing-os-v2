import assert from 'node:assert';
import { cheDoCua, locCheDo } from './che-do';

const ch = (khoa: string, demo: boolean, ncc = 'cj') => ({ khoa, demo, ncc }) as never;
const bt = (cuaHang: string, ...sp: number[]) => ({ cuaHang, nguon: sp.map((nccSpId) => ({ nccSpId })) }) as never;
const sp = (id: number, ncc: string) => ({ id, ncc }) as never;
const goc = {
  cuaHang: [ch('mellowstep', false), ch('demo-bra', true)],
  ncc: [{ khoa: 'cj', demo: false }, { khoa: 'cj_demo', demo: true }, { khoa: 'ali', demo: false }] as never[],
  bienThe: [bt('mellowstep', 1), bt('demo-bra', 2, 4)],
  danhMuc: [sp(1, 'cj'), sp(2, 'cj'), sp(3, 'cj'), sp(4, 'cj_demo')],
  don: [{ cuaHang: 'mellowstep' }, { cuaHang: 'demo-bra' }] as never[],
  sanPham: [] as never[], danhGia: [] as never[], hoSo: [{ cuaHang: 'demo-bra' }] as never[],
  bienDong: [{ cuaHang: 'demo-bra', nccSpId: null, ncc: null }, { cuaHang: null, nccSpId: 1, ncc: 'cj' }, { cuaHang: null, nccSpId: 4, ncc: 'cj_demo' }] as never[],
  cong: [{ id: 1, shops: ['mellowstep'] }, { id: 2, shops: [] }] as never[],
  phapNhan: [{ id: 1, shops: ['demo-bra'] }] as never[],
};

const that = locCheDo(goc, 'that');
assert.deepStrictEqual(that.dsCh, ['mellowstep']);
assert.strictEqual(that.don.length, 1);
assert.deepStrictEqual(that.danhMuc.map((s: { id: number }) => s.id), [1, 3]);       // 2 chỉ shop demo dùng, 4 của NCC demo; 3 chưa ai dùng = thật
assert.deepStrictEqual(that.ncc.map((n: { khoa: string }) => n.khoa), ['cj', 'ali']);
assert.strictEqual(that.bienDong.length, 1);
assert.deepStrictEqual(that.cong.map((g: { id: number }) => g.id), [1, 2]);            // cổng chưa gắn shop = đồ thật
assert.strictEqual(that.phapNhan.length, 0);
assert.strictEqual(that.hoSo.length, 0);

const demo = locCheDo(goc, 'demo');
assert.deepStrictEqual(demo.dsCh, ['demo-bra']);
assert.deepStrictEqual(demo.danhMuc.map((s: { id: number }) => s.id), [2, 4]);
assert.deepStrictEqual(demo.ncc.map((n: { khoa: string }) => n.khoa), ['cj', 'cj_demo']); // CJ thật hiện vì shop demo đang dùng; ali không
assert.strictEqual(demo.bienDong.length, 2);
assert.strictEqual(demo.cong.length, 0);
assert.strictEqual(demo.phapNhan.length, 1);

assert.strictEqual(cheDoCua('demo'), 'demo');
assert.strictEqual(cheDoCua(undefined), 'that');
assert.strictEqual(cheDoCua('bat_ky'), 'that');
console.log('locCheDo: đúng');
