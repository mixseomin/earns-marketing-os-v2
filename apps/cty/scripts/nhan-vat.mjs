// Hình nhân vật của MỖI nhân sự — một quy tắc cho cả văn phòng pixel (seed-van-phong.mjs) lẫn avatar trên cty.on.tc (components/avatar.tsx),
// để nhìn avatar là nhận ra đúng người trên văn phòng. pixel-agents có 6 sprite (assets/characters/char_N.png, MIT): 1 tóc dài váy đen ·
// 3 tóc bạc ngắn · 5 tóc đen ngắn = nữ; 0 · 2 · 4 = nam (nhìn ảnh 10/10/2026). Xoay vòng trong từng giới theo thu_tu trên TOÀN BỘ nhân sự —
// trước đây mỗi văn phòng xoay trên danh sách riêng của nó nên cùng một người mặc áo khác nhau ở hai văn phòng (sửa 11/10/2026).
// Ảnh avatar = khung đứng nhìn thẳng (hàng 1, cột 1), cắt 16×16 từ y=6 → public/nhan-vat/<N>.png.
export const SPRITE = { nam: [0, 2, 4], nu: [1, 3, 5] };
/** ds = mọi nhân sự [{ id, gioi_tinh, thu_tu }] → { id: sprite }. */
export function spriteTheoNguoi(ds) {
  const dem = { nam: 0, nu: 0 }; const out = {};
  for (const d of [...ds].sort((a, b) => (Number(a.thu_tu) || 99) - (Number(b.thu_tu) || 99))) { const g = d.gioi_tinh === 'nu' ? 'nu' : 'nam'; out[d.id] = SPRITE[g][dem[g]++ % 3]; }
  return out;
}

if (process.argv.includes('--tu-kiem') && (process.argv[1] || '').endsWith('nhan-vat.mjs')) {
  const ds = [{ id: 'a', gioi_tinh: 'nu', thu_tu: 2 }, { id: 'b', gioi_tinh: 'nam', thu_tu: 1 }, { id: 'c', gioi_tinh: 'nu', thu_tu: 3 }, { id: 'd', gioi_tinh: 'nu', thu_tu: 9 }, { id: 'e', gioi_tinh: 'nu', thu_tu: 10 }];
  const m = spriteTheoNguoi(ds); const loi = [];
  if (m.b !== 0 || m.a !== 1 || m.c !== 3 || m.d !== 5 || m.e !== 1) loi.push(`xoay vòng theo giới + thu_tu: ${JSON.stringify(m)}`);
  if (spriteTheoNguoi([...ds].reverse()).c !== m.c) loi.push('không phụ thuộc thứ tự đầu vào');
  if (loi.length) { console.error('✗ nhan-vat:', loi.join('; ')); process.exit(1); }
  console.log('✓ nhan-vat: một người một hình, như nhau ở mọi văn phòng');
}
