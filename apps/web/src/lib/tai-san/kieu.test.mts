// node_modules/.bin/tsx apps/web/src/lib/tai-san/kieu.test.mts
import { strict as a } from 'node:assert';
import { anhBiaXem, daDuyetBanNay, khopTk, nenChuan, shopChet, gopBo, tenTrongBo } from './kieu';
const tk = [{ nen: 'udemy', handle: 'evergreen programming', status: 'banned' }, { nen: 'gumroad', handle: 'oldcc7391', status: 'closed' },
  { nen: 'gumroad', handle: 'frontporchpuzzles', status: 'active' }, { nen: 'kdp', handle: 'htuan82', status: 'active' }];
a.equal(shopChet('udemy', null, tk), 'banned');                // Udemy không ghi store → mọi tk udemy chết (05/10/2026)
a.equal(shopChet('gumroad', 'oldcc7391', tk), 'closed');
a.equal(shopChet('gumroad', 'frontporchpuzzles', tk), null);
a.equal(shopChet('gumroad', null, tk), null);                  // còn một tk sống → không chết
a.equal(shopChet('kdp', 'htuan82', tk), null);
a.equal(shopChet('etsy', 'FrontPorchZ', tk), null);            // không có hồ sơ vault → không kết luận chết
// Directus accounts mặc định 'active' không phủ quyết vault (card #1130: Udemy #158 banned, Directus có 'aidesign mastery' active)
const tk3 = [...tk.map((t) => ({ ...t, nguon: 'mos2' as const })), { nen: 'udemy', handle: 'aidesign mastery', status: 'active', nguon: 'directus' as const },
  { nen: 'stripe', handle: 'x', status: 'closed', nguon: 'directus' as const }];
a.equal(shopChet('udemy', null, tk3), 'banned');
a.equal(shopChet('stripe', null, tk3), 'closed');               // vault trống → Directus quyết
console.log('shopChet: 8/8 ok');

// #1113: một nền tảng nhiều tên khoá giữa các kho → ghép được tài khoản với shop
a.equal(nenChuan('mql5-com'), 'mql5-market');
a.equal(nenChuan('MQL5'), 'mql5-market');
a.equal(nenChuan('Stripe'), 'stripe');
const tk2 = [{ nen: nenChuan('mql5-com'), handle: 'piplord', status: 'active' }, { nen: nenChuan('Chaturbate'), handle: 'zoomxxx', status: 'active' }];
a.equal(khopTk(nenChuan('mql5-market'), null, tk2).length, 1);
a.equal(khopTk(nenChuan('chaturbate'), null, tk2)[0]?.handle, 'zoomxxx');
console.log('nenChuan + khopTk: 6/6 ok');

// #1115: duyệt bản hiện tại
a.equal(daDuyetBanNay('2026-10-06', '2026-10-05'), true);
a.equal(daDuyetBanNay('2026-10-05', '2026-10-05'), true);
a.equal(daDuyetBanNay('2026-10-04', '2026-10-05'), false);    // dựng lại sau khi duyệt → phải duyệt lại
a.equal(daDuyetBanNay(null, '2026-10-05'), false);
a.equal(daDuyetBanNay('2026-10-06T10:00:00Z', '2026-10-06T11:00:00Z'), false); // ISO: dựng lại 1 giờ sau khi duyệt
a.equal(daDuyetBanNay('2026-10-06', '2026-10-06T11:00:00Z'), true);               // duyệt chỉ ngày = cuối ngày
console.log('daDuyetBanNay: 6/6 ok');

// #1119: ảnh bìa dự định lấy từ bản xem — ảnh bán 1 (bìa trước), không phải bìa giấy trải phẳng
const xem = { ngay: '2026-10-05', anh: [{ id: 'trai', chu: 'Bìa giấy KDP: mặt sau · gáy · mặt trước' }, { id: 'bia', chu: 'Ảnh bán 1: bìa' }] };
a.equal(anhBiaXem(xem), 'bia');
a.equal(anhBiaXem({ ngay: 'x', anh: [{ id: 'dau', chu: 'khác' }] }), 'dau');
a.equal(anhBiaXem(null), null);
console.log('anhBiaXem: 3/3 ok');

// gopBo: các tập cùng bộ thành một dòng đúng chỗ tập đầu; con xếp theo số tập; tên trong bộ bỏ tiền tố tên bộ
{
  const sp = (ten: string, so: number | null, tt: string, phu = 'bìa mềm') => ({ khoa: ten + phu, ten, anh: null, ma: null, phu, url: null, trangThai: tt, gia: null, views7d: null, don: so, tien: null, ky: '30n', canhBao: null, ghiChu: null, series: so == null ? null : { ten: 'Bộ A', so } }) as never;
  const { dong, con } = gopBo([sp('lẻ 1', null, 'dang_ban'), sp('Bộ A: tập ba', 3, 'cho_anh'), sp('Bộ A: tập một', 1, 'dang_ban'), sp('lẻ 2', null, 'du_kien')]);
  a.deepEqual(dong.map((x) => x.khoa), ['lẻ 1bìa mềm', 'bo:Bộ A', 'lẻ 2bìa mềm']);
  a.deepEqual(con.get('bo:Bộ A')!.map((x) => x.series!.so), [1, 3]);
  a.equal(dong[1]!.trangThai, 'cho_anh'); a.equal(dong[1]!.phu, '2 tập · 2 bản'); a.equal(dong[1]!.don, 4);
  a.equal(tenTrongBo(con.get('bo:Bộ A')![0]!), 'tập một');
  console.log('gopBo: 6/6 ok');
}
