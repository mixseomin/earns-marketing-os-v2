import assert from 'node:assert';
import { tinhThanhPho, nenCuaMay, mayTimCua, nguonNgoaiCua } from './social-thanh-pho';

const k = (id: number, nenKey: string, ten: string, duAn: string, o: Record<string, unknown> = {}) => ({ id, ten, nenTang: nenKey, nenKey, nhom: duAn, duAn, ngonNgu: 'EN', proxy: '', tt: 'song', ngay: 3, video: 0, trungViXem: 0, xem: 0, click: 0, hh: 0, daDo: false, ...o });
const dong = (may: string, mayTen: string, nen: string, nenTen: string, acct: string | null, site: string) => ({ may, mayTen, nen, nenTen, tk: '', gio: '', mayMac: '', acct, site, sites: may === 'fp' ? [site, 'pickjot.com'] : [site], o: [], cuoiOk: null, khoDen: null });
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
    { site: 'steamsolo.com', phien30: 500, tim: { google: 100, bing: 20 }, qc: { google: 30, khac: 1 }, gt: { 'aocr.org': 20 } }, { site: 'ratesbyroom.com', phien30: 48, tim: { google: 3 } },
    { site: 'mo.com', phien30: 50, tim: {} },   // site có mã theo dõi, chưa gắn nguồn nào
    { site: 'pickjot.com', phien30: 470, tim: { bing: 5 } },
  ],
  heSinhThai: {
    duAn: [{ id: 'social', ten: 'Social Traffic', site: null, ngung: false }, { id: 'puzzle-books', ten: 'Front Porch Puzzles', site: 'frontporchpuzzles.gumroad.com', ngung: false },
      { id: 'steamsolo', ten: 'steamsolo.com', site: 'steamsolo.com', ngung: false }, { id: 'bra', ten: 'Bra', site: 'orabra.com', ngung: true },
      { id: 'militarycalc', ten: 'MilitaryCalc', site: 'militarycalc.com', ngung: false }, { id: 'ios-app', ten: 'App iOS', site: 'wordfrost.com', ngung: false }, { id: 'MOS2 Platform', ten: 'MOS2 Platform', site: null, ngung: false }, { id: 'clane', ten: 'Clane', site: 'clane.app', ngung: false }],
    duAnSite: [{ site: 'mo.com', duAn: 'bra' }],
    sanPham: [
      { id: 'a1', ten: 'MilitaryCalc', nen: 'app-store', trangThai: 'published', url: 'https://apps.apple.com/app/id1', store: 'htuan82', xem7: 40, tai: 5, net: null },
      { id: 'a2', ten: 'Giỗ Chạp: Văn Khấn, Lịch Âm', nen: 'app-store', trangThai: 'published', url: null, store: 'htuan82', xem7: null, tai: null, net: null },
      { id: 'a3', ten: 'Giỗ Chạp (Windows)', nen: 'ms-store', trangThai: 'in_review', url: null, store: 'htuan82', xem7: null, tai: null, net: null },
      { id: 'e1', ten: 'Large Print Word Search', nen: 'etsy', trangThai: 'published', url: null, store: 'FrontPorchZ', xem7: 12, tai: null, net: 3 },
      { id: 'k1', ten: 'Kế hoạch', nen: 'kdp', trangThai: 'planned', url: null, store: 'htuan82', xem7: null, tai: null, net: null },
      { id: 'u1', ten: 'Python 101', nen: 'udemy', trangThai: 'published', url: null, store: null, xem7: null, tai: null, net: 10 },
      { id: 'a4', ten: 'Sidecue: Teleprompter', nen: 'app-store', trangThai: 'in_review', url: null, store: 'htuan82', xem7: null, tai: null, net: null },
      { id: 'r1', ten: 'Lạ', nen: 'rapidapi', trangThai: 'published', url: null, store: null, xem7: null, tai: null, net: null },
    ],
    app: [{ ten: 'Giỗ Chạp', duAn: 'ios-app' }],
    nguonSp: [{ sp: 'a1', nguon: 'App Store search', hien: 400, xem: 14, tai: 7 }, { sp: 'a1', nguon: 'Web referrer', hien: 0, xem: 1, tai: 1 }, { sp: 'nope', nguon: 'App Store search', hien: 5, xem: 0, tai: 0 }],
    tkCua: [{ nen: 'etsy', handle: 'FrontPorchZ', duAn: 'puzzle-books' }, { nen: 'etsy', handle: 'LeatherByJoan', duAn: 'mos2', khoa: true }, { nen: 'udemy', handle: 'Evergreen Programming', duAn: null, khoa: true }],
  },
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const m = tinhThanhPho(live as any);
const t = (id: string) => m.tk.find((x) => x.id === id)!;

assert.equal(nenCuaMay('x_anh'), 'twitter'); assert.equal(nenCuaMay('fb_link'), 'facebook'); assert.equal(nenCuaMay('youtube'), 'youtube');
assert.ok(!m.tk.some((x) => x.id === '1'), 'Etsy không phải toà mạng xã hội');
assert.equal(t('540').sap, 2, 'sắp đăng = lượt dự kiến của mọi nơi đăng cùng tài khoản (x + x_anh), không tính bài đã đăng');
assert.equal(t('521').sap, 1, 'TikTok chưa khai acct vẫn nhận lịch qua máy cùng dự án');
assert.equal(t('521').dich, 's:frontporchpuzzles.gumroad.com');
assert.equal(t('-9').dich, 's:frontporchpuzzles.gumroad.com', 'kênh không gắn máy về site chính của dự án');
assert.equal(t('-9').phienKy, '30 ngày');
assert.equal(t('545').dich, 's:ratesbyroom.com', 'tài khoản trùng tên thương hiệu đổ về cùng site');
assert.equal(t('544').hong, 'br chặn bấm nút Publish', 'sự cố bad của nơi đăng → toà hỏng');
assert.equal(t('540').hong, null, 'sự cố warn (kho cạn) không phải hỏng');
assert.equal(t('546').hong, 'Tài khoản dính cờ');
assert.equal(t('506').xem, null, 'chưa đo lượt xem → null, không 0 giả');
assert.equal(t('544').ten, 'Hotel Scam Alerts');
// nguồn tìm kiếm đứng CẠNH từng site
assert.equal(mayTimCua('google / cpc'), null, 'quảng cáo Google không phải tìm kiếm'); assert.equal(mayTimCua('fb / paid'), null);
assert.equal(mayTimCua('yandex.com.tr'), 'yandex'); assert.equal(mayTimCua('ya.ru'), 'yandex'); assert.equal(mayTimCua('google.com'), 'google'); assert.equal(mayTimCua('it.search.yahoo.com'), 'yahoo'); assert.equal(mayTimCua('direct'), null);
assert.equal(t('tim:google@steamsolo.com').phien, 100, 'mỗi máy tìm kiếm một toà cạnh từng site nó đổ khách');
assert.equal(t('tim:google@steamsolo.com').dich, 's:steamsolo.com');
assert.ok(t('tim:google@ratesbyroom.com') && !m.tk.some((x) => x.id === 'tim:bing@pickjot.com' && x.phien < 2), 'máy dưới 2 khách cạnh một site thì không dựng');
assert.ok(m.luong.some((l) => l.tu === '540' && l.den === 's:ratesbyroom.com' && l.so === 11), 'xe social → site');
// site
const d = (k: string) => m.dich.find((x) => x.khoa === k)!;
assert.equal(d('s:ratesbyroom.com').phien30, 48, 'site có trong sổ phiên: phiên cả site');
assert.ok(d('s:frontporchpuzzles.gumroad.com').laShop && d('s:frontporchpuzzles.gumroad.com').don === 1, 'cửa hàng mang số đơn');
assert.ok(!m.dich.some((x) => x.khoa === 's:le.com'), 'site không ai trỏ, không khách thì không dựng');
assert.ok(d('s:esimfares.com'), 'site tài khoản trỏ tới vẫn dựng dù chưa có trong Landing');
assert.deepEqual(nguonNgoaiCua('google / cpc'), { loai: 'qc', khoa: 'google' }); assert.deepEqual(nguonNgoaiCua('fb / paid'), { loai: 'qc', khoa: 'facebook' });
assert.deepEqual(nguonNgoaiCua('99e8a45b972418dc5248125dd8a4f251 / cpc'), { loai: 'qc', khoa: 'khac' }); assert.deepEqual(nguonNgoaiCua('chatgpt.com'), { loai: 'gt', khoa: 'chatgpt.com' });
assert.deepEqual(nguonNgoaiCua('l.facebook.com'), { loai: 'gt', khoa: 'facebook.com' });
assert.equal(nguonNgoaiCua('youtube / short'), null, 'bài social của mình đã tính ở toà tài khoản'); assert.equal(nguonNgoaiCua('bing.com'), null, 'máy tìm kiếm không phải giới thiệu'); assert.equal(nguonNgoaiCua('direct'), null);
assert.equal(t('qc:google@steamsolo.com').phien, 30, 'quảng cáo đứng cạnh site'); assert.ok(!m.tk.some((x) => x.id === 'qc:khac@steamsolo.com'), 'quảng cáo dưới 2 khách không dựng');
assert.equal(t('gt:aocr.org@steamsolo.com').loai, 'gt', 'trang giới thiệu đứng cạnh site');
// khu dự án
assert.equal(d('s:steamsolo.com').duAn, 'd:steamsolo', 'site của dự án (projects.website)');
assert.equal(d('s:mo.com').duAn, 'd:bra', 'sổ du_an_site đưa site vào dự án');
assert.equal(d('s:pickjot.com').duAn, 'd:puzzle-books', 'site phụ cùng máy đăng về dự án của site chính');
assert.equal(d('s:ratesbyroom.com').duAn, 'rieng:ratesbyroom.com', 'dự án chung nhiều thương hiệu (Social Traffic) không gom: site đứng riêng');
assert.equal(d('s:esimfares.com').duAn, 'rieng:esimfares.com');
const khu = (k: string) => m.duAn.find((x) => x.khoa === k)!;
assert.ok(khu('d:bra').ngung && m.duAn[m.duAn.length - 1]!.ngung, 'dự án ngừng → cờ ngung, xếp cuối');
assert.ok(khu('d:steamsolo').laDuAn && !khu('rieng:ratesbyroom.com').laDuAn, 'khu dự án khác khu site đứng riêng');
// sản phẩm
assert.equal(d('p:a1').duAn, 'd:militarycalc', 'app MilitaryCalc ở cùng dự án MilitaryCalc (anh 22/10/2026)'); assert.equal(d('p:a4').duAn, 'd:clane', 'app chưa thuộc dự án nào → dự án gốc Clane');
assert.equal(d('p:a2').duAn, 'd:ios-app', 'app theo app_ung_dung');
assert.equal(d('p:a3').duAn, 'd:ios-app', 'bản Windows cùng đầu tên với app đã gán');
assert.equal(t('ch:App Store search@p:a1').chiTiet!.hien, 400, 'nguồn trong cửa hàng đứng quanh app'); assert.equal(t('ch:App Store search@p:a1').ten, 'Tìm trên App Store');
assert.ok(d('p:a1').coNguon && !m.tk.some((x) => x.dich === 'p:nope'), 'sản phẩm có nguồn; nguồn của sản phẩm không có mặt thì bỏ');
assert.ok(d('p:a3').sapLen && d('p:a3').hostBan === 'apps.microsoft.com', 'đang duyệt = sắp lên, favicon cửa Microsoft Store');
assert.equal(d('p:e1').duAn, 'd:puzzle-books', 'Etsy theo tài khoản cửa bán');
assert.ok(!m.dich.some((x) => x.khoa === 'p:k1'), 'sản phẩm planned chưa có mặt');
assert.equal(d('p:u1').duAn, 'khoa:udemy', 'mọi tài khoản Udemy bị khoá → khu tài khoản bị khoá');
assert.ok(khu('khoa:udemy').ngung && khu('khoa:udemy').nhan === 'TÀI KHOẢN BỊ KHOÁ', 'khu khoá ra rìa, biển ghi rõ');
assert.notEqual(d('p:e1').duAn, 'khoa:etsy', 'còn một tài khoản Etsy sống thì không khoá');
assert.equal(d('p:r1').duAn, 'chua-sp', 'không khớp gì → khu Sản phẩm chưa gán');
assert.equal(khu('d:bra').nhan, 'DỰ ÁN · NGỪNG');
console.log('✓ social-thanh-pho: sản phẩm → dự án · khu dự án / site riêng / dự án ngừng · máy tìm kiếm mỗi máy một toà · site chưa có nguồn · sắp đăng theo nơi đăng · TikTok chưa khai acct · cụm theo site/tên/dự án · hỏng chỉ khi bad · đích + đơn cửa hàng');
