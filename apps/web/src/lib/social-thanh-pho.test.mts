import assert from 'node:assert';
import { tinhThanhPho, nenCuaMay, mayTimCua, nguonNgoaiCua } from './social-thanh-pho';
import { siteOf } from './host';

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
    { ngay: '2026-11-20', gio: '09:00', may: 'hotel', mayTen: 'Scam or Real?', nen: 'x', title: '', url: null, loai: 'du_kien' },   // ngoài 7 ngày: không tính
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
    linhVuc: [{ khoa: 'p:bra', linhVuc: 'thuong-mai' }, { khoa: 's:ratesbyroom.com', linhVuc: 'du-lich' }, { khoa: 'p:steamsolo', linhVuc: 'sai-khoa' }],
    tienSite: [{ site: 'steamsolo.com', usd: 12.5 }],
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
assert.equal(d('p:a1').duAn, 'd:militarycalc', 'app MilitaryCalc ở cùng dự án MilitaryCalc (anh 22/10/2026)'); assert.equal(d('p:a4').duAnGoc, 'd:clane', 'app chưa thuộc dự án nào → dự án gốc Clane');
// XƯỞNG SX: app mà mọi bản đang duyệt rời khu dự án (giữ dự án gốc), bản cửa hàng đi theo; app có một bản đã lên thì ở lại khu, bản đang duyệt đứng cạnh nó
const appA4 = m.dich.find((x) => x.loai === 'app' && x.ten.startsWith('Sidecue'))!;
assert.ok(appA4.duAn === 'xuong' && appA4.duAnGoc === 'd:clane' && d('p:a4').duAn === 'xuong', 'app chưa lên ở Xưởng SX, nhớ dự án gốc');
assert.ok(d('p:a3').duAn !== 'xuong', 'bản Windows đang duyệt của app đã lên không ra xưởng');
assert.equal(khu('xuong').nhan, 'XƯỞNG SX'); assert.equal(appA4.duAnGocTen, 'Clane', 'xưởng biết tên dự án gốc để ghi biển hàng');
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
// app = một thực thể trên mọi cửa hàng
const ga = m.dich.filter((x) => x.loai === 'app' && x.ten.startsWith('Giỗ Chạp'));
assert.equal(ga.length, 1, 'Giỗ Chạp iOS + Windows = một app');
assert.ok(d('p:a2').cha === ga[0]!.khoa && d('p:a3').cha === ga[0]!.khoa && ga[0]!.duAn === d('p:a2').duAn, 'các bản cửa hàng đứng quanh app, cùng khu');
assert.ok(d('p:a1').cha && m.dich.find((x) => x.khoa === d('p:a1').cha)!.coNguon, 'app có nguồn khi một bản của nó có nguồn');
// lĩnh vực = phường
assert.equal(khu('d:bra').linhVuc, 'thuong-mai'); assert.equal(khu('rieng:ratesbyroom.com').linhVuc, 'du-lich', 'site đứng riêng theo s:<host>');
assert.equal(khu('d:steamsolo').linhVuc, 'khac', 'lĩnh vực lạ không có trong LINH_VUC → khác');
// tiền
assert.equal(d('p:u1').tien30, 10); assert.equal(d('s:steamsolo.com').tien30, 12.5, 'đơn shop mặt tiền vào tiền của site');
assert.ok(m.tien.tong >= 25.5 && m.tien.theo.some((x) => x.ten === 'Đơn shop'), 'kho bạc cộng theo loại nguồn tiền, app không cộng hai lần');
// cửa hàng: số đơn và tiền đi cùng một luật khớp dòng bán (banCuaShop) — lệch một bên thì đơn có mà tiền không
assert.equal(d('s:frontporchpuzzles.gumroad.com').tienPhan?.find((x) => x.loai === 'Bán sản phẩm số')?.so, 79, 'tiền cửa hàng từ đúng dòng bán đã cho số đơn');
// hạn tên miền tính theo ngày của số liệu (luoi.hom), không theo đồng hồ máy — hàm thuần, chạy lại ngày nào cũng ra một kết quả
const mH = tinhThanhPho({ ...live, luoi: { ...live.luoi, hom: '2020-01-01' }, heSinhThai: { ...live.heSinhThai, hat: [{ kind: 'domain', label: 'www.steamsolo.com', duAn: null, het: '2020-01-20', ip: null, chi: 0, tien: 'USD' }] } } as any);
assert.match(mH.dich.find((x) => x.khoa === 's:steamsolo.com')?.canhBao ?? '', /còn 19 ngày/, 'cảnh báo hạn tên miền đếm từ luoi.hom');
// siteOf: URL, tên miền trần, rỗng, rác
assert.equal(siteOf('https://www.ratesbyroom.com/x?y=1'), 'ratesbyroom.com'); assert.equal(siteOf('clane.app/giochap'), 'clane.app');
assert.equal(siteOf(null), null); assert.equal(siteOf(''), null); assert.equal(siteOf('http://'), null);
// ETHOPEX: toà nền tảng giữ tiền Kho bạc (một lần), camp quanh nó mang thu / chi 30 ngày, camp không tiền không chạy thì bỏ, tối đa 18
const camps = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, ten: `Phim ${i + 1} EN`, phim: `Phim ${i + 1}`, ngonNgu: 'en', trangThai: i < 20 ? 'active' : 'paused', thu30: i, chi30: i / 2 }));
const mE = tinhThanhPho({ ...live, heSinhThai: { ...live.heSinhThai, duAn: [...live.heSinhThai.duAn, { id: 'ethopex', ten: 'Ethopex', site: 'app.ethopex.dev', ngung: false }],
  camps: [...camps, { id: 99, ten: 'Tắt', phim: null, ngonNgu: null, trangThai: 'paused', thu30: 0, chi30: 0 }],
  tienAff: [...((live.heSinhThai as any).tienAff ?? []), { site: null, mang: 'Ethopex', duAn: 'ethopex', usd: 500 }], chi: [...((live.heSinhThai as any).chi ?? []), { nguon: 'Meta Ads (Ethopex)', duAn: 'ethopex', usd: 300 }] } } as any);
const hub = mE.dich.find((x) => x.khoa === 'n:ethopex')!, cs = mE.dich.filter((x) => x.loai === 'camp');
assert.ok(hub && hub.tien30 === 500 && hub.chi30 === 300 && hub.duAn === 'd:ethopex', 'tiền / chi Ethopex vào toà nền tảng');
assert.ok(cs.length === 18 && cs.every((c) => c.cha === 'n:ethopex') && cs[0]!.tien30 === 24 && !cs.some((c) => c.khoa === 'c:99'), 'camp nhiều tiền nhất, tối đa 18, camp tắt không tiền bỏ');
assert.equal(mE.tien.tong - m.tien.tong, 500, 'Kho bạc cộng Ethopex một lần, không cộng thêm camp');
// QUY MÔ = max(tiền + ROI, lưu lượng): khu có tiền nhất = 1, khu đông khách nhất = 1, khu không tiền không khách = 0, xưởng = 0
{ const qm = (k: string) => mE.duAn.find((x) => x.khoa === k)?.quyMo;
  assert.equal(qm('d:ethopex'), 1, 'Ethopex nhiều tiền nhất → quy mô 1');
  const dong = [...mE.duAn].filter((k) => k.khoa !== 'xuong').sort((a, b) => (b.luu ?? 0) - (a.luu ?? 0))[0]!; assert.ok(dong.luu! > 0 && dong.quyMo === 1, 'khu đông khách nhất → quy mô 1 dù ít tiền');
  assert.ok(mE.duAn.every((k) => k.quyMo! >= 0 && k.quyMo! <= 1), 'quy mô trong 0..1');
  assert.ok(mE.duAn.some((k) => !(k.tien30 ?? 0) && !(k.luu ?? 0) && k.quyMo === 0), 'không tiền không khách → 0');
  assert.equal(qm('xuong'), 0, 'xưởng không phình theo tiền / khách');
  assert.ok(mE.duAn.some((k) => k.quyMo! > 0 && k.quyMo! < 1), 'khu vừa thì cỡ vừa'); }
// TÀI NGUYÊN: tài khoản gom theo nền × nhóm trạng thái, nền thứ 15 trở đi vào "Nền khác", cảnh báo chưa xử theo nền, ngân sách ngày Ethopex = tổng camp đang chạy
{ const tkTho = Array.from({ length: 16 }, (_, i) => ({ nen: `nen${i}`, status: 'active', n: 20 - i })).concat([{ nen: 'nen0', status: 'banned', n: 2 }, { nen: 'nen0', status: 'warming', n: 3 }, { nen: 'nen15', status: 'closed', n: 1 }]);
  const mT = tinhThanhPho({ ...live, heSinhThai: { ...live.heSinhThai, camps: [{ id: 1, ten: 'A', phim: null, ngonNgu: 'en', trangThai: 'active', thu30: 0, chi30: 0, nganSachNgay: 5 }, { id: 2, ten: 'B', phim: null, ngonNgu: 'en', trangThai: 'active', thu30: 0, chi30: 0, nganSachNgay: 3 }, { id: 3, ten: 'C', phim: null, ngonNgu: 'en', trangThai: 'paused', thu30: 0, chi30: 0, nganSachNgay: 9 }],
    taiNguyen: { tk: tkTho, canhBao: [{ nen: 'nen0', loai: 'khoa', n: 2 }, { nen: 'nen15', loai: 'xac_minh', n: 1 }], hoSo: [{ tool: 'chrome', n: 57, gan7: 12, cuoi: null }], proxy: [{ suc: 'ok', n: 4 }],
      soNganSach: [{ ten: 'VPS', kieu: 'định kỳ', so: 15, tienTe: 'USD', chuKy: 15 }], tkQcShop: [{ ten: 'TK mẫu', trangThai: 'song', hanMuc: null, tienTe: 'USD' }] } } } as any).taiNguyen;
  const n0 = mT.tk.find((x) => x.nen === 'nen0')!, khac = mT.tk.find((x) => x.nen === 'khac')!;
  assert.ok(n0.tong === 25 && n0.theo.song === 20 && n0.theo.khoa === 2 && n0.theo.nuoi === 3 && n0.canhBao === 2, 'một nền: đếm theo nhóm trạng thái + cảnh báo');
  assert.ok(mT.tk.length === 15 && khac.tong === 6 + 5 + 1 && khac.theo.dong === 1 && khac.canhBao === 1, '14 nền đông nhất + Nền khác gộp phần còn lại');
  assert.equal(mT.nganSach.find((x) => x.ten.startsWith('Ethopex'))!.so, 8, 'ngân sách ngày Ethopex = camp đang chạy (5 + 3), camp dừng không tính');
  assert.equal(mT.nganSach.find((x) => x.ten === 'VPS')!.so, 30, 'khoản định kỳ quy về tháng (15 / 15 ngày → 30)');
  assert.ok(!mT.nganSach.some((x) => x.ten.includes('TK mẫu')), 'tài khoản QC chưa có hạn mức thì không hiện');
  assert.ok(mT.chuaNoi.length > 0, 'nói rõ phần chưa nối'); }
console.log('✓ social-thanh-pho: app một thực thể · phường lĩnh vực · kho bạc · sản phẩm → dự án · khu dự án / site riêng / dự án ngừng · máy tìm kiếm mỗi máy một toà · site chưa có nguồn · sắp đăng theo nơi đăng · TikTok chưa khai acct · cụm theo site/tên/dự án · hỏng chỉ khi bad · đích + đơn cửa hàng');
