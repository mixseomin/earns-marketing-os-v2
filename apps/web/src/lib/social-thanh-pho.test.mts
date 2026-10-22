import assert from 'node:assert';
import { tinhThanhPho, nenCuaMay, mayTimCua } from './social-thanh-pho';

const k = (id: number, nenKey: string, ten: string, duAn: string, o: Record<string, unknown> = {}) => ({ id, ten, nenTang: nenKey, nenKey, nhom: duAn, duAn, ngonNgu: 'EN', proxy: '', tt: 'song', ngay: 3, video: 0, trungViXem: 0, xem: 0, click: 0, hh: 0, daDo: false, ...o });
const dong = (may: string, mayTen: string, nen: string, nenTen: string, acct: string | null, site: string) => ({ may, mayTen, nen, nenTen, tk: '', gio: '', mayMac: '', acct, site, o: [], cuoiOk: null, khoDen: null });
const live = {
  kenh: [
    k(544, 'facebook', 'Hotel Scam Alerts (Page)', 'Social Traffic', { video: 9 }), k(540, 'twitter', 'hotelscamalerts', 'Social Traffic', { video: 9, click: 11 }),
    k(545, 'instagram', 'hotelscamalerts', 'Social Traffic'),                       // không gắn máy, trùng tên X → về cụm Hotel
    k(546, 'twitter', 'beforeyouland', 'Social Traffic', { video: 6, tt: 'co' }),
    k(521, 'tiktok', 'uriellrqv5g', 'Front Porch Puzzles', { video: 12, xem: 30, daDo: true }), k(506, 'youtube', '@frontporchpuzzles', 'Front Porch Puzzles', { video: 8 }),
    k(-9, 'pinterest', 'Pinterest', 'Front Porch Puzzles', { video: 151, click: 13, daDo: true, xem: 900 }),   // kênh không gắn máy → site chính của dự án
    k(370, 'twitter', 'doanhedu', 'MOS2 Platform'),                                // không bài, không lịch → cụm trống
    k(1, 'etsy', 'shop', 'Front Porch Puzzles'),                                    // không phải mạng xã hội → không dựng
  ],
  luoi: { hom: '2026-10-22', tinhLuc: null, kho: [], o: [
    { ngay: '2026-10-23', gio: '09:00', may: 'hotel', mayTen: 'Scam or Real?', nen: 'x', title: '', url: null, loai: 'du_kien' },
    { ngay: '2026-10-23', gio: '15:00', may: 'hotel', mayTen: 'Scam or Real?', nen: 'x_anh', title: '', url: null, loai: 'du_kien' },
    { ngay: '2026-10-22', gio: '08:00', may: 'hotel', mayTen: 'Scam or Real?', nen: 'x', title: '', url: 'u', loai: 'da' },
    { ngay: '2026-10-23', gio: '10:00', may: 'fp', mayTen: 'Only ONE', nen: 'tiktok', title: '', url: null, loai: 'du_kien' },
  ] },
  suc: { hom: '', ngay: [], dong: [
    dong('hotel', 'Scam or Real? · tin nhắn', 'x', 'X', '540', 'ratesbyroom.com'), dong('hotel', 'Scam or Real? · tin nhắn', 'x_anh', 'X ảnh', '540', 'ratesbyroom.com'),
    dong('hotel', 'Scam or Real? · tin nhắn', 'facebook', 'Facebook', '544', 'ratesbyroom.com'),
    dong('byl', 'Before you land', 'x', 'X', '546', 'esimfares.com'),
    dong('fp', 'Only ONE', 'tiktok', 'TikTok', null, 'frontporchpuzzles.gumroad.com'), dong('fp', 'Only ONE', 'youtube', 'YouTube', '506', 'frontporchpuzzles.gumroad.com'),
  ], suCo: [{ muc: 'bad', tieuDe: 'br chặn bấm nút Publish', chiTiet: '', kenh: ['Scam or Real? · Facebook'], luc: null }, { muc: 'warn', tieuDe: 'Kho sắp cạn', chiTiet: '', kenh: ['Scam or Real? · X'], luc: null }] },
  landing: [
    { url: '', site: 'ratesbyroom.com', path: '/a', nguon: '', soVideo: 1, phien7: 0, khach7: 0, doc50: 0, bamRa: 0, phien30: 30, online: 0, nguonKhach: [], cuoi: null, coMa: true },
    { url: '', site: 'ratesbyroom.com', path: '/b', nguon: '', soVideo: 1, phien7: 0, khach7: 0, doc50: 0, bamRa: 0, phien30: 15, online: 0, nguonKhach: [], cuoi: null, coMa: true },
    { url: '', site: 'frontporchpuzzles.gumroad.com', path: '/l/x', nguon: '', soVideo: 1, phien7: 0, khach7: 0, doc50: 0, bamRa: 0, phien30: 0, online: 0, nguonKhach: [], cuoi: null, coMa: false },
    { url: '', site: 'le.com', path: '/', nguon: '', soVideo: 0, phien7: 0, khach7: 0, doc50: 0, bamRa: 0, phien30: 0, online: 0, nguonKhach: [], cuoi: null, coMa: true },
  ],
  ban: [{ cua: 'Gumroad', ten: 'frontporchpuzzles', duAn: 'puzzle-books', xem30: 10, ban30: 1, usd30: 79 }],
  fav: { 'ratesbyroom.com': 'data:x', 'esimfares.com': null },
  nguonSite: [
    { site: 'steamsolo.com', phien30: 500, tim: { google: 100, bing: 20 } }, { site: 'ratesbyroom.com', phien30: 48, tim: { google: 3 } },
    { site: 'mo.com', phien30: 50, tim: {} },   // site có mã theo dõi, chưa gắn nguồn nào
  ],
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const m = tinhThanhPho(live as any);
const t = (id: string) => m.tk.find((x) => x.id === id)!;

assert.equal(nenCuaMay('x_anh'), 'twitter'); assert.equal(nenCuaMay('fb_link'), 'facebook'); assert.equal(nenCuaMay('youtube'), 'youtube');
assert.ok(!m.tk.some((x) => x.id === '1'), 'Etsy không phải toà mạng xã hội');
assert.equal(t('540').sap, 2, 'sắp đăng = lượt dự kiến của mọi nơi đăng cùng tài khoản (x + x_anh), không tính bài đã đăng');
assert.equal(t('521').sap, 1, 'TikTok chưa khai acct vẫn nhận lịch qua máy cùng dự án');
assert.equal(t('521').cum, 's:frontporchpuzzles.gumroad.com');
assert.equal(t('-9').cum, 's:frontporchpuzzles.gumroad.com', 'kênh không gắn máy về site chính của dự án');
assert.equal(t('-9').phienKy, '30 ngày');
assert.equal(t('545').cum, 's:ratesbyroom.com', 'tài khoản trùng tên thương hiệu về cùng cụm');
assert.equal(t('544').hong, 'br chặn bấm nút Publish', 'sự cố bad của nơi đăng → toà hỏng');
assert.equal(t('540').hong, null, 'sự cố warn (kho cạn) không phải hỏng');
assert.equal(t('546').hong, 'Tài khoản dính cờ');
assert.equal(t('506').xem, null, 'chưa đo lượt xem → null, không 0 giả');
assert.equal(t('544').ten, 'Hotel Scam Alerts');
const hotel = m.cum.find((c) => c.khoa === 's:ratesbyroom.com')!;
assert.equal(hotel.ten, 'Hotel Scam Alerts', 'tên cụm = tên Page Facebook của thương hiệu');
assert.ok(m.cum.find((c) => c.khoa === 'p:MOS2 Platform')!.trong, 'cụm không bài không lịch = trống');
assert.ok(m.cum[m.cum.length - 1]!.trong && !m.cum[0]!.trong, 'cụm trống xếp cuối');
const rbr = m.dich.find((d) => d.site === 'ratesbyroom.com')!;
assert.equal(rbr.phien30, 48, 'site có trong sổ phiên: lấy phiên cả site (mọi trang, mọi nguồn), không cộng riêng các trang Landing');
const gum = m.dich.find((d) => d.site === 'frontporchpuzzles.gumroad.com')!;
assert.ok(gum.laShop && gum.phien30 === null && gum.don === 1, 'cửa hàng: không đo phiên, mang số đơn');
assert.ok(!m.dich.some((d) => d.site === 'le.com'), 'site không ai trỏ, không khách thì không dựng');
assert.ok(m.dich.some((d) => d.site === 'esimfares.com'), 'site tài khoản trỏ tới vẫn dựng dù chưa có trong Landing');
assert.equal(mayTimCua('google / cpc'), null, 'quảng cáo Google không phải tìm kiếm'); assert.equal(mayTimCua('fb / paid'), null);
assert.equal(mayTimCua('yandex.com.tr'), 'yandex'); assert.equal(mayTimCua('ya.ru'), 'yandex'); assert.equal(mayTimCua('google.com'), 'google'); assert.equal(mayTimCua('it.search.yahoo.com'), 'yahoo'); assert.equal(mayTimCua('direct'), null);
assert.equal(t('tim:google').phien, 103, 'mỗi máy tìm kiếm là một toà, cộng khách mọi site');
assert.ok(t('tim:bing') && !m.tk.some((x) => x.id === 'tim:yandex'), 'máy không có khách thì không dựng');
assert.equal(m.cum[0]!.khoa, 'tim', 'cụm Tìm kiếm đứng đầu');
assert.ok(m.luong.some((l) => l.tu === 'tim:google' && l.den === 'steamsolo.com' && l.so === 100) && m.luong.some((l) => l.tu === '540' && l.den === 'ratesbyroom.com' && l.so === 11), 'xe: tìm kiếm và social cùng một bảng luồng');
const mo = m.dich.find((d) => d.site === 'mo.com')!;
assert.ok(mo && !mo.coNguon && mo.phien30 === 50, 'site chưa gắn nguồn vẫn dựng, đánh dấu chưa có nguồn');
assert.ok(m.dich.find((d) => d.site === 'steamsolo.com')!.coNguon && m.dich.findIndex((d) => d.site === 'mo.com') > m.dich.findIndex((d) => d.site === 'steamsolo.com'), 'site có nguồn xếp trước');
console.log('✓ social-thanh-pho: máy tìm kiếm mỗi máy một toà · site chưa có nguồn · sắp đăng theo nơi đăng · TikTok chưa khai acct · cụm theo site/tên/dự án · hỏng chỉ khi bad · đích + đơn cửa hàng');
