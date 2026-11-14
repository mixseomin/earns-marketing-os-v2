// ĐỀ GAME "Only ONE says ___" THEO CHỦ ĐỀ PAGE (khang 15/11/2026): Page ngách riêng gắn vào máy Front Porch (Page xe 580 / 589 / 591, nền có `uu_tien`)
// trước chỉ có từ của sách đố chữ (AIRPORT, ALMANAC…) nên 94 lượt / tuần "Hết video đã dựng chưa đăng" mỗi Page. Ở đây: từ đúng ngách + 35 ô sai một chữ
// sinh bằng mã (đổi chữ trông giống / đảo hai chữ kề) → 0₫, không gọi AI. Slug mang tên chủ đề (`classic-cars`) để khớp `uu_tien` của Page.
// Tự kiểm: node apps/xuong-video/src/lib/xuong-video/game-chu-de.mjs --tu-kiem

export const CHU_DE = {
  'classic-cars': {
    goi: 'Classic Cars',
    link: 'https://pickjot.com/printables/classic-cars-word-search/',
    mo_ta: 'Free large print classic cars word search to print, with the answer key: https://pickjot.com/printables/classic-cars-word-search/',
    mau: null,   // lấy màu của video classic-cars cũ nếu có (may-dung.mts), không thì mẫu tự chọn
    tu: ['MUSTANG', 'CORVETTE', 'CADILLAC', 'ROADSTER', 'BUMPER', 'HUBCAP', 'FENDER', 'TAILFIN', 'COUPE', 'SEDAN', 'PICKUP', 'GARAGE', 'ENGINE', 'PISTON',
      'GASKET', 'CLUTCH', 'IGNITION', 'HEADLAMP', 'DASHBOARD', 'MUFFLER', 'RADIATOR', 'ODOMETER', 'STEERING', 'GEARSHIFT', 'CARBURETOR', 'CHOPPER',
      'KICKSTAND', 'SIDECAR', 'HELMET', 'THROTTLE', 'SADDLEBAG', 'SPOKES', 'EXHAUST', 'HANDLEBAR', 'SPARKPLUG', 'CRANKSHAFT', 'TIRES', 'WHEELS',
      'HOODORNAMENT', 'HOTROD', 'CRUISING', 'HIGHWAY', 'MOTEL', 'ROADTRIP', 'FUELTANK', 'CHASSIS', 'TAILPIPE', 'DRIVEWAY', 'CONVERTIBLE', 'STATIONWAGON'].filter((w) => w.length <= 10),
  },
};

const GIONG = { A: 'R', B: 'P', C: 'G', D: 'O', E: 'F', F: 'E', G: 'C', H: 'N', I: 'L', K: 'X', L: 'I', M: 'N', N: 'M', O: 'Q', P: 'R', Q: 'O', R: 'P', S: 'Z', T: 'I', U: 'V', V: 'U', W: 'V', X: 'K', Y: 'V', Z: 'S' };

/** Một bản sai đúng một chữ của `tu` (đổi chữ trông giống hoặc đảo hai chữ kề), khác `tu`. `r` = số ngẫu nhiên 0..1 (truyền vào để tự kiểm lặp lại được). */
export function saiMotChu(tu, r = Math.random) {
  for (let lan = 0; lan < 50; lan++) {
    const i = Math.floor(r() * tu.length), c = tu.split('');
    if (r() < 0.5 && i < c.length - 1) [c[i], c[i + 1]] = [c[i + 1], c[i]]; else c[i] = GIONG[c[i]] ?? 'X';
    const s = c.join(''); if (s !== tu) return s;
  }
  return tu.slice(1) + tu[0];
}

/** Đề game: 36 ô, đúng MỘT ô là `tu` (vị trí `cho`), 35 ô sai một chữ. */
export function deGame(tu, r = Math.random) {
  const cho = Math.floor(r() * 36), o = [];
  for (let k = 0; k < 36; k++) o.push(k === cho ? tu : saiMotChu(tu, r));
  return { dich: tu, o, cho };
}

if (process.argv.includes('--tu-kiem')) {
  const assert = (await import('node:assert')).default;
  let s = 7; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (const tu of CHU_DE['classic-cars'].tu) {
    const d = deGame(tu, r);
    assert.equal(d.o.length, 36, tu); assert.equal(d.o[d.cho], tu, tu);
    assert.equal(d.o.filter((x) => x === tu).length, 1, `${tu}: đúng một ô đúng`);
    for (const x of d.o) assert.equal(x.length, tu.length, `${tu}: cùng độ dài`);
  }
  assert.ok(CHU_DE['classic-cars'].tu.length >= 30, 'đủ từ cho vài tuần');
  assert.ok(CHU_DE['classic-cars'].tu.every((w) => /^[A-Z]+$/.test(w)), 'chỉ chữ hoa');
  console.log(`✓ game-chu-de: ${CHU_DE['classic-cars'].tu.length} từ classic-cars, mỗi đề 36 ô đúng một ô đúng`);
}
