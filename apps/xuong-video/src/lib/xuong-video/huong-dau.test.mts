// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/huong-dau.test.mts — hướng ĐẦU (bo-set-3d.ts › huongDau) cùng công thức khung 3D
import assert from 'node:assert';
import { huongVoiMay, huongDau } from './bo-set-3d';
// HƯỚNG ĐẦU theo đích nhìn (ca thật phim #3071, 16/11/2026): thân 90° ra cửa sổ, đầu nhìn mốc bộ set — câu tả phải theo ĐẦU như khung 3D
{ const moc = { dau_ga: [100, 100, 110], nhoc_xa: [100, 1800, 110] };
  // #2: máy [100,630] nhìn [-110,500]; chú ở [-115,500], nhịp mở nhìn đầu ga → khung 3D: mặt nghiêng sang TRÁI màn
  const m2 = { dat: [100, 630, 190], nhin: [-110, 500, 215], vi_tri: [] };
  const c2 = { ten: 'Chú', tam: [-115, 500, 80], huong: 90, nhin_ai: 'dau_ga', nhin_ai_den: 'giua_ga', nhip: [{ u: 0, nhin: 'dau_ga' }, { u: 0.6, nhin: 'nhoc_xa' }] };
  assert.ok(huongVoiMay(m2, c2 as never, false, moc)!.chu.includes('screen-left'), huongVoiMay(m2, c2 as never, false, moc)!.chu);
  // #19: máy [100,800] nhìn [-128,520]; chú [-128,500] thân 90°, nhìn thằng bé đằng xa (+y) → khung 3D: nhìn sang PHẢI màn (câu cũ theo thân: "screen-left")
  const m19 = { dat: [100, 800, 170], nhin: [-128, 520, 220], vi_tri: [] };
  const c19 = { ten: 'Chú', tam: [-128, 500, 80], huong: 90, huong_den: 170, nhin_ai: 'nhoc_xa', nhin_ai_den: 'nhoc_xa' };
  assert.ok(huongVoiMay(m19, c19 as never, false, moc)!.chu.includes('screen-right'), huongVoiMay(m19, c19 as never, false, moc)!.chu);
  assert.ok(huongVoiMay(m19, c19 as never)!.chu.includes('screen-left'), 'không có mốc → về hướng thân như cũ');
  // đích là NGƯỜI trong shot: tra trong m.vi_tri, không cần mốc
  const mN = { dat: [0, 500, 150], nhin: [0, 0, 150], vi_tri: [{ ten: 'B', tam: [300, 0, 0] }] };
  const hN = huongVoiMay(mN as never, { ten: 'A', tam: [0, 0, 0], huong: 0, nhin_ai: 'B' } as never)!; assert.ok(hN.lech > 35, JSON.stringify(hN)); }
assert.strictEqual(huongDau({ ten: 'X', tam: [0, 0, 0], huong: 90 } as never, []), 90, 'không đích nhìn → hướng thân');
console.log('✓ huong-dau (hướng đầu theo đích nhìn — ca thật #2, #19 phim #3071)');
