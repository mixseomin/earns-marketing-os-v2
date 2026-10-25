import assert from 'node:assert';
import { tinhThanhPho, nenCuaMay, mayTimCua, nguonNgoaiCua, loaiCampEtp, tinhSucSong, sucSongKhu, laDichSong, tinhBinh, mucHan, tenMienGoc, gopNgay, trangThaiNen, ttNangNhat, linkKenh, gopBinhTraTien, chiSoTk, keHoachNoiDung, LICH_TUAN } from './social-thanh-pho';
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
// ETHOPEX (góp ý #1439): toà nền tảng giữ tiền Kho bạc (một lần); camp theo CỤM PHIM — đang chạy mỗi camp một toà, tắt gộp một toà kho / phim,
// bản nhân bản trỏ camp gốc, lên lịch / vi phạm có loại riêng
const camps = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, ten: `Phim ${i % 5} EN - canh that`, phim: `Phim ${i % 5}`, phimId: 100 + (i % 5), ngonNgu: 'en', trangThai: i < 20 ? 'active' : 'paused', thu30: i, chi30: i / 2, thuHom: i % 3, chiHom: 1, ngayHom: '2026-10-23' }));
camps.push({ id: 30, ten: 'Phim 0 EN - canh that (nhan ban 2 cua 1)', phim: 'Phim 0', phimId: 100, ngonNgu: 'en', trangThai: 'active', thu30: 1, chi30: 1 } as any,
  { id: 31, ten: 'Phim 0 EN - canh that (nhan ban 1 cua 21)', phim: 'Phim 0', phimId: 100, ngonNgu: 'en', trangThai: 'active', thu30: 0, chi30: 0 } as any,
  { id: 32, ten: 'Phim 1 EN - ke chuyen', phim: 'Phim 1', phimId: 101, ngonNgu: 'en', trangThai: 'active', thu30: 0, chi30: 0, cho: true, dang: 'kể chuyện' } as any,
  { id: 33, ten: 'Phim 2 EN', phim: 'Phim 2', phimId: 102, ngonNgu: 'en', trangThai: 'paused', thu30: 0, chi30: 2, viPham: true } as any,
  { id: 34, ten: 'Phim 3 EN', phim: 'Phim 3', phimId: 103, ngonNgu: 'en', trangThai: 'active', thu30: 0, chi30: 12, sapTat: true, nhanBanDuoc: true } as any);
const mE = tinhThanhPho({ ...live, heSinhThai: { ...live.heSinhThai, duAn: [...live.heSinhThai.duAn, { id: 'ethopex', ten: 'Ethopex', site: 'app.ethopex.dev', ngung: false }],
  camps: [...camps, { id: 99, ten: 'Tắt', phim: null, ngonNgu: null, trangThai: 'paused', thu30: 0, chi30: 0 }],
  tienAff: [...((live.heSinhThai as any).tienAff ?? []), { site: null, mang: 'Ethopex', duAn: 'ethopex', usd: 500 }], chi: [...((live.heSinhThai as any).chi ?? []), { nguon: 'Meta Ads (Ethopex)', duAn: 'ethopex', usd: 300 }] } } as any);
const hub = mE.dich.find((x) => x.khoa === 'n:ethopex')!, cs = mE.dich.filter((x) => x.loai === 'camp');
assert.ok(hub && hub.tien30 === 500 && hub.chi30 === 300 && hub.duAn === 'd:ethopex', 'tiền / chi Ethopex vào toà nền tảng');
const kho = cs.filter((c) => c.campLoai === 'tat'), cId = (id: number) => cs.find((c) => c.khoa === `c:${id}`);
assert.equal(cs.filter((c) => c.campLoai !== 'tat').length, 20 + 5, 'mọi camp đang chạy + camp vi phạm đều có toà (không còn trần 18)');
assert.ok(cs.every((c) => c.cha === 'n:ethopex' && c.cumPhim), 'mọi camp thuộc nền tảng và có cụm phim');
assert.deepEqual(kho.map((c) => `${c.cumPhim}=${c.soTat}`).sort(), ['f:100=1', 'f:101=1', 'f:102=1', 'f:103=1', 'f:104=1', 'f:tắt=1'], 'camp đã tắt gộp MỘT toà kho mỗi phim (camp không phim gom theo tên)');
assert.equal(kho.find((c) => c.cumPhim === 'f:100')!.tien30, 20, 'toà kho cộng thu của camp tắt trong phim');
{ const L = (trangThai: string, giao: string, daTieu: boolean, batDau: string | null = null, tieuHom = false) => loaiCampEtp({ trangThai, giao, batDau, daTieu, tieuHom }, Date.parse('2026-10-23T10:00:00Z'));
  assert.equal(L('ACTIVE', 'ACTIVE', true), 'chay', 'đang giao = chạy');
  assert.equal(L('ACTIVE', 'ADSET_PAUSED', false), 'cho', 'dừng ad set, chưa tiêu đồng nào = CHỜ PUBLIC');
  assert.equal(L('ACTIVE', 'ADSET_PAUSED', true), 'tat', 'dừng ad set, chỉ tiêu ngày trước = tắt (không vẽ như đang chạy)');
  assert.equal(L('ACTIVE', 'ADSET_PAUSED', true, null, true), 'chay', 'ghi dừng ad set mà hôm nay vẫn tiêu = CHẠY (Ethopex đồng bộ trạng thái chậm — bộ 2 ngày 23/10)');
  assert.equal(L('ACTIVE', 'ACTIVE', false, '2026-10-24T00:00:00Z'), 'cho', 'bắt đầu ngày mai = chờ');
  assert.equal(L('PAUSED', 'CAMPAIGN_PAUSED', false), 'tat', 'campaign dừng = tắt'); }
assert.ok(cId(2)!.thuHom === 1 && cId(2)!.chiHom === 1, 'camp mang thu / chi ngày báo cáo mới nhất (bảng hiệu phim)');
assert.ok(kho.find((c) => c.cumPhim === 'f:100')!.chiHom === 1 && hub.ngayHom === '2026-10-23' && hub.chiHom === 25, 'kho + toà nền tảng cộng số hôm nay, nhớ ngày báo cáo');
assert.equal(cId(30)!.campGoc, 'c:1', 'bản nhân bản trỏ camp gốc đang hiện');
assert.equal(cId(31)!.campGoc, null, 'gốc đã tắt (vào kho) thì bản nhân bản đứng riêng');
assert.ok(cId(32)!.campLoai === 'cho' && cId(32)!.dangCr === 'kể chuyện', 'camp chờ public + dạng creative');
assert.ok(cId(33)!.campLoai === 'vi-pham' && !cs.some((c) => c.campLoai === 'tat' && c.cumPhim === 'f:102' && c.soTat === 2), 'camp vi phạm hiện riêng dù đã dừng, không vào kho');
assert.ok(cId(34)!.sapTat && cId(34)!.nhanBanDuoc && cId(34)!.campLoai === 'chay', 'cờ bốc khói + nhân bản đi theo camp');
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
// RÌA: dự án pho_ria (Adfond) vẫn chạy nhưng xếp cùng dãy rìa với dự án ngừng; cảnh báo không có nền / nền không có kho → kho "Nền khác"
{ const mR = tinhThanhPho({ ...live, heSinhThai: { ...live.heSinhThai, duAn: live.heSinhThai.duAn.map((d: any) => (d.id === 'steamsolo' ? { ...d, ria: true } : d)),
    taiNguyen: { tk: [{ nen: 'facebook', status: 'active', n: 3 }], canhBao: [{ nen: 'khac', loai: 'xac_minh', n: 2 }, { nen: 'huggingface', loai: 'xac_minh', n: 1 }], canhBaoDs: [{ id: 9, nen: 'huggingface', handle: null, loai: 'xac_minh', noiDung: 'x', url: 'https://huggingface.co', luc: '2026-10-22', acct: null }],
      hoSo: [], proxy: [], soNganSach: [], tkQcShop: [] } } } as any);
  const k = mR.duAn.find((x) => x.khoa === 'd:steamsolo')!, iR = mR.duAn.indexOf(k), dauNgung = mR.duAn.findIndex((x) => x.ngung || x.raRia);
  assert.ok(k.raRia && !k.ngung && iR >= dauNgung, 'khu rìa: không ngừng, xếp vào dãy rìa');
  const kh = mR.taiNguyen.tk.find((x) => x.nen === 'khac')!; assert.ok(kh && kh.canhBao === 3, 'cảnh báo lạc nền về kho Nền khác, không mất');
  assert.equal(mR.taiNguyen.canhBaoDs[0]!.nen, 'khac', 'dòng cảnh báo trỏ đúng kho hiển thị'); }
// XƯỞNG SX = tổ hợp nhà máy (góp ý #1437): 'ready' ở nhà máy (giai đoạn sx), đã nộp (in_review…) ở Phòng thẩm định; khu theo loại cửa bán
assert.equal(appA4.giaiDoan, 'tham-dinh', 'app có bản đang duyệt → Phòng thẩm định'); assert.equal(appA4.vungSx, 'app', 'app vào khu App');
{ const mX = tinhThanhPho({ ...live, heSinhThai: { ...live.heSinhThai, sanPham: [...live.heSinhThai.sanPham, { id: 'k9', ten: 'Sách thử', nen: 'kdp', trangThai: 'ready', url: null, store: null, xem7: null, tai: null, net: null }, { id: 'k8', ten: 'Sách nộp', nen: 'kdp', trangThai: 'owner_review', url: null, store: null, xem7: null, tai: null, net: null }] } } as any);
  const k9 = mX.dich.find((x) => x.khoa === 'p:k9')!, k8 = mX.dich.find((x) => x.khoa === 'p:k8')!;
  assert.ok(k9.duAn === 'xuong' && k9.giaiDoan === 'sx' && k9.vungSx === 'sach', 'sẵn sàng chưa nộp → nhà máy, khu Sách');
  assert.ok(k8.giaiDoan === 'tham-dinh', 'chờ anh duyệt → Phòng thẩm định'); }
// TỪNG TÀI KHOẢN (góp ý #1453 "rải ra, biết trạng thái, hiệu suất"): mỗi tài khoản một dòng, nền ít tài khoản về kho 'khac', có vấn đề lên đầu, chỉ số đọc từ account_stats
{ assert.deepEqual(chiSoTk({ followers: 1200, karma: 5 }), { chu: '1.200 người theo dõi', so: 1200 }, 'người theo dõi ưu tiên');
  assert.deepEqual(chiSoTk({ karma: '37' }), { chu: '37 karma', so: 37 }, 'karma dạng chuỗi vẫn đọc');
  assert.deepEqual(chiSoTk({ note: 'x' }), { chu: null, so: 0 }, 'không có chỉ số');
  const tk = Array.from({ length: 16 }, (_, i) => ({ nen: `nen${i}`, status: 'active', n: 20 - i }));
  const mM = tinhThanhPho({ ...live, heSinhThai: { ...live.heSinhThai, taiNguyen: { tk, canhBao: [], hoSo: [], proxy: [], soNganSach: [], tkQcShop: [],
    tkMot: [{ id: 1, nen: 'nen0', handle: 'a', status: 'active', duAn: null, dung: null, ly: null, st: { followers: 50 }, cb: 0 }, { id: 2, nen: 'nen0', handle: 'b', status: 'banned', duAn: 'x', dung: null, ly: 'spam', st: {}, cb: 0 },
      { id: 3, nen: 'nen15', handle: 'c', status: 'active', duAn: null, dung: null, ly: null, st: {}, cb: 2 }] } } } as any).taiNguyen.tkMot!;
  assert.deepEqual(mM.map((x) => x.id), [3, 2, 1], 'có cảnh báo → bị khoá → đang dùng');
  assert.ok(mM[0]!.nen === 'khac' && mM[0]!.nenGoc === 'nen15', 'nền thứ 16 vào kho Nền khác, giữ nền thật');
  assert.ok(mM[1]!.tt === 'khoa' && mM[1]!.ly === 'spam' && mM[2]!.chiSo === '50 người theo dõi', 'trạng thái + lý do + chỉ số từng tài khoản'); }
// BỒN = MỌI NỀN TRẢ TIỀN (góp ý #1451 "thiếu vast.ai… thiếu nhiều vô cùng"): ảnh chụp số dư + vault + sổ nguồn AI; chưa đọc được vẫn có bồn, ghi vì sao
{ const b = gopBinhTraTien({ du: { kie: 4190, ckey: null }, loi: { ckey: 'thiếu khoá tài khoản ckey' }, luc: '2026-10-25T05:00:00Z', lich: [{ ngay: '2026-10-24', du: { kie: 4730 } }, { ngay: '2026-10-25', du: { kie: 4190 } }] },
    ['vastai', '2proxy', 'facebook', 'propellerads'],
    [{ key: 'vast', ten: 'Vast.ai', trangThai: 'co_tk', nap: 'https://cloud.vast.ai/billing/', khoaEnv: 'VAST_API_KEY' }, { key: 'anthropic', ten: 'Anthropic', trangThai: 'dang', nap: 'https://console.anthropic.com', khoaEnv: 'ANTHROPIC_API_KEY' },
     { key: 'piapi', ten: 'PiAPI', trangThai: 'tham_khao', nap: 'https://piapi.ai/pricing', khoaEnv: 'PIAPI_API_KEY' }]);
  const k = (x: string) => b.find((y) => y.key === x);
  assert.ok(k('vast') && k('vast')!.du == null && k('vast')!.loi === 'chưa nối đọc số dư (khoá VAST_API_KEY)' && k('vast')!.nap === 'https://cloud.vast.ai/billing/', 'Vast.ai (vault vastai) có bồn, nói rõ thiếu khoá + link nạp');
  assert.ok(k('2proxy') && k('2proxy')!.loai === 'Proxy' && k('propellerads')!.loai === 'QC trả trước', 'proxy / QC trả trước trong vault đều có bồn');
  assert.equal(k('anthropic')!.loi, 'cổng không có API số dư — xem trên trang nạp', 'cổng không có API số dư nói thẳng');
  assert.ok(!k('piapi') && !k('facebook') && !k('runpod'), 'nguồn chỉ tham khảo / nền không trả tiền / nền không có tài khoản thì không dựng bồn');
  assert.equal(k('ckey')!.loi, 'thiếu khoá tài khoản ckey', 'lỗi đọc của Phòng Tài nguyên giữ nguyên');
  assert.equal(b[0]!.key, 'kie', 'bồn đọc được số dư xếp trước');
  assert.equal(tinhThanhPho({ ...live, heSinhThai: { ...live.heSinhThai, taiNguyen: { tk: [], canhBao: [], hoSo: [], proxy: [], soNganSach: [], tkQcShop: [], soDu: b } } } as any).taiNguyen.binh.find((x) => x.key === 'vast')!.muc, 'chua-do', 'bồn chưa đọc → mức chưa đo'); }
console.log('✓ social-thanh-pho: app một thực thể · phường lĩnh vực · kho bạc · sản phẩm → dự án · khu dự án / site riêng / dự án ngừng · máy tìm kiếm mỗi máy một toà · site chưa có nguồn · sắp đăng theo nơi đăng · TikTok chưa khai acct · cụm theo site/tên/dự án · hỏng chỉ khi bad · đích + đơn cửa hàng');

// SỨC SỐNG: mọi nguồn ngang nhau — đơ / thoi thóp / sống / sôi động
{ const S = (soNguon: number, khach7: number, tien30 = 0, online = 0) => tinhSucSong({ soNguon, khach7, tien30, online }).sucSong;
  assert.equal(S(0, 0), 0, 'chưa gắn nguồn, không khách = đơ');
  assert.equal(S(3, 0), 1, 'gắn nguồn mà 7 ngày không khách = thoi thóp');
  assert.equal(S(1, 5), 2, 'có khách 7 ngày = sống');
  assert.equal(S(0, 0, 12), 2, 'có tiền 30 ngày = sống dù chưa đo được nguồn');
  assert.equal(S(1, 5, 0, 2), 3, 'đang có khách online = sôi động'); }
{ const mh0 = m; const dd = mh0.dich.filter(laDichSong);
  assert.ok(dd.every((d) => d.sucSong != null && d.soNguon != null), 'mọi site / app / sản phẩm đều có sức sống');
  for (const k of mh0.duAn.filter((x) => x.khoa !== 'xuong')) { const m = dd.filter((d) => d.duAn === k.khoa && !d.cha).map((d) => d.sucSong!); if (m.length) assert.equal(k.sucSong, Math.max(...m), `khu ${k.khoa} = mức cao nhất của đích trong khu`); } }
assert.equal(sucSongKhu([0, 0, 2]), 2, 'khu có một site sống = khu sống (không đóng băng cả khu vì vài sản phẩm đơ)'); assert.equal(sucSongKhu([0, 0]), 0, 'khu toàn đích đơ = khu đơ'); assert.equal(sucSongKhu([]), undefined, 'khu không có đích = không chấm'); assert.equal(m.duAn.find((k) => k.khoa === 'xuong')?.sucSong, undefined, 'Xưởng SX không chấm sức sống (nơi làm, không phải đích traffic)');
console.log('✓ sức sống: đơ · thoi thóp · sống · sôi động · khu theo đích cao nhất');

// TÀI NGUYÊN: bồn (số dư / mức tiêu) + hạn (tên miền, máy chủ)
{ const L = (...du: (number | null)[]) => du.map((v, i) => ({ ngay: `2026-10-${String(20 + i).padStart(2, '0')}`, du: v }));
  const p = tinhBinh(255, L(510, 500, 323, 255)); assert.ok(p.muc === 'do' && Math.abs(p.tieuNgay! - 85) < .01 && p.conNgay! < 3.1, 'PlenX 510→255 trong 3 ngày = 85/ngày, còn 3 ngày = đỏ');
  assert.equal(tinhBinh(5630, L(7425, 7145, 7145, 6110, 5630)).muc, 'vang', 'Kie còn ~12 ngày = vàng');
  assert.equal(tinhBinh(61, L(61, 61, 61)).muc, 'xanh', 'không tiêu = xanh, không cạn');
  assert.equal(tinhBinh(61, L(61, 61, 61)).conNgay, null, 'không tiêu thì không có ngày cạn');
  assert.equal(tinhBinh(150, L(100, 50, 150)).muc, 'vang', 'vừa tiêu vừa nạp: chỉ phần giảm là tiêu (50 / 2 ngày = 25/ngày, còn 6 ngày) — nạp không bù trừ mức tiêu');
  assert.equal(tinhBinh(null, L(1, 2)).muc, 'chua-do', 'chưa đọc được số dư = chỗ mù');
  assert.equal(mucHan('2026-10-28', '2026-10-24').muc, 'do', 'còn 4 ngày = đỏ'); assert.equal(mucHan('2026-11-21', '2026-10-24').muc, 'vang', 'còn 28 ngày = vàng');
  assert.equal(mucHan('2027-09-01', '2026-10-24').muc, 'xanh', 'còn hơn 30 ngày = xanh'); assert.equal(mucHan(null, '2026-10-24').muc, 'chua-do', 'chưa có ngày hết hạn = chỗ mù');
  assert.equal(tenMienGoc('ai.chatwhenbored.com'), 'chatwhenbored.com', 'tên miền phụ quy về gốc'); }
{ const tn = m.taiNguyen; assert.ok(Array.isArray(tn.binh) && Array.isArray(tn.han), 'mô hình có bồn + hạn');
  assert.ok(tn.han.every((h) => !/gumroad\.com$/.test(h.ten)), 'cửa hàng trên nền người khác không vào danh sách hạn tên miền');
  assert.equal(new Set(tn.han.map((h) => h.ten)).size, tn.han.length, 'mỗi tên miền một dòng');
  assert.ok(tn.han.filter((h) => h.loai === 'hosting').every((h) => !h.may || m.nhaMay.some((x) => x.khoa === h.may)), 'máy chủ trỏ đúng toà máy (theo IP)'); }
console.log('✓ tài nguyên: bồn (mức tiêu, còn ngày) · hạn tên miền / máy chủ · chỗ mù');

// BIỂU ĐỒ LÃI khu Ethopex (24/10/2026): cộng thu / chi theo ngày qua các camp, ngày tăng dần, camp không có chuỗi ngày bỏ qua
{
  const g = gopNgay([{ ngay: [{ ngay: '2026-10-02', thu: 5, chi: 3 }, { ngay: '2026-10-01', thu: 1, chi: 2 }] }, { ngay: [{ ngay: '2026-10-02', thu: 4, chi: 1 }] }, {}]);
  assert.deepStrictEqual(g, [{ ngay: '2026-10-01', thu: 1, chi: 2 }, { ngay: '2026-10-02', thu: 9, chi: 4 }]);
  assert.deepStrictEqual(gopNgay([]), []);
  const mN = tinhThanhPho({ ...live, heSinhThai: { ...live.heSinhThai, duAn: [...live.heSinhThai.duAn, { id: 'ethopex', ten: 'Ethopex', site: 'app.ethopex.dev', ngung: false }], camps: [{ id: 1, ten: 'A', phim: null, ngonNgu: 'en', trangThai: 'active', thu30: 6, chi30: 4, ngay: [{ ngay: '2026-10-01', thu: 6, chi: 4 }] }] } } as any);
  assert.deepStrictEqual(mN.dich.find((d) => d.khoa === 'n:ethopex')?.ngay30, [{ ngay: '2026-10-01', thu: 6, chi: 4 }], 'toà nền tảng mang chuỗi lãi theo ngày của bộ');
}
console.log('gopNgay ✓');

// MÁY ĐĂNG TRÊN CITY (25/10/2026): trạng thái một nền — sửa > đang đăng > hỏng > chờ > đã đăng; 'bat-dau' quá 20 phút không kết quả = hỏng
{
  const bay = Date.parse('2026-10-25T13:30:00Z'), goc = { nen: 'instagram', nk: null, daHom: null, lichHom: null, sua: null } as const;
  assert.strictEqual(trangThaiNen(goc, bay), null, 'không lịch, không nhật ký = không vẽ gì');
  assert.strictEqual(trangThaiNen({ ...goc, lichHom: { gio: '20:05', title: 'Only ONE' } }, bay)?.tt, 'cho');
  assert.strictEqual(trangThaiNen({ ...goc, lichHom: { gio: '20:05', title: '' }, nk: { buoc: 'bat-dau', ok: true, luc: '2026-10-25T13:20:00Z', chu: '' } }, bay)?.tt, 'dang', 'bắt đầu 10 phút trước = đang đăng');
  assert.strictEqual(trangThaiNen({ ...goc, nk: { buoc: 'bat-dau', ok: true, luc: '2026-10-25T12:50:00Z', chu: '' } }, bay)?.tt, 'hong', 'bắt đầu 40 phút trước không kết quả = chết giữa chừng');
  const h = trangThaiNen({ ...goc, lichHom: { gio: '20:05', title: '' }, nk: { buoc: 'dang', ok: false, luc: '2026-10-25T13:06:00Z', chu: 'Đăng hỏng: Instagram: bước Crop' } }, bay);
  assert.ok(h?.tt === 'hong' && h.chu.includes('bước Crop') && !h.chu.includes('Đăng hỏng'), 'hỏng mang lý do, bỏ tiền tố');
  assert.strictEqual(trangThaiNen({ ...goc, nk: { buoc: 'dang', ok: false, luc: '2026-10-25T13:06:00Z', chu: 'x' }, daHom: { url: 'u', luc: '2026-10-25T13:20:00Z' } }, bay)?.tt, 'xong', 'hỏng rồi đăng bù được = đã đăng');
  assert.strictEqual(trangThaiNen({ ...goc, sua: 'dang', nk: { buoc: 'dang', ok: false, luc: '2026-10-25T13:06:00Z', chu: 'x' } }, bay)?.tt, 'sua', 'Mạnh đang sửa thắng mọi trạng thái');
  assert.strictEqual(trangThaiNen({ ...goc, nk: { buoc: 'dang', ok: true, luc: '2026-10-25T13:06:00Z', chu: 'Chưa tới hạn đăng' } }, bay), null, 'dòng ok (chưa tới hạn) không phải hỏng');
  assert.strictEqual(ttNangNhat([{ nen: 'x', tt: 'xong', chu: '', luc: null }, { nen: 'x_link', tt: 'hong', chu: '', luc: null }, { nen: 'x_anh', tt: 'cho', chu: '', luc: null }]), 'hong', 'toà lấy trạng thái nặng nhất');
  assert.strictEqual(ttNangNhat([]), null);
}
console.log('máy đăng trên city ✓');

// FANPAGE = tài sản (25/10/2026): đang chạy trước, nhiều người theo dõi trước, bỏ đuôi "(Page)", Page đã tắt (closed / da_tat) xuống cuối, kênh = có dự án
{
  const tnGoc = { tk: [], canhBao: [], hoSo: [], proxy: [], soNganSach: [], tkQcShop: [] };
  const m = tinhThanhPho({ ...live, heSinhThai: { ...live.heSinhThai, taiNguyen: { ...tnGoc, fanpage: [
    { ten: 'Lime (Page)', status: 'closed', st: { da_tat: true, cum: 'chua-xep' }, project_id: null },
    { ten: 'Classic Car (Page)', status: 'active', st: { followers: 13039, cum: 'hoai-co' }, project_id: null },
    { ten: 'Animals Guru (Page)', status: 'active', st: { followers: 18399, cum: 'thu-cung' }, project_id: null },
    { ten: 'Hotel Scam Alerts (Page)', status: 'active', st: { followers: 1, cum: 'du-lich' }, project_id: 'adfond' }] } } } as any);
  const f = m.taiNguyen.fanpage!;
  assert.deepStrictEqual(f.map((x) => x.ten), ['Animals Guru', 'Classic Car', 'Hotel Scam Alerts', 'Lime'], 'đang chạy theo người theo dõi, đã tắt cuối, bỏ (Page)');
  assert.ok(f[3]!.tat && !f[0]!.tat && f[2]!.kenh && !f[1]!.kenh && f[3]!.nguoi === null);
}
console.log('fanpage ✓');

// link + avatar kênh (25/10/2026): Page theo mã → facebook.com/<mã> + khoá avatar 'fbp:'; YouTube theo mã kênh; handle có dấu cách → không link
{
  assert.deepStrictEqual(linkKenh('facebook', 'Retro Cars Club (Page)', { pageId: '129365743783277' }), { url: 'https://www.facebook.com/129365743783277', anh: 'fbp:129365743783277' });
  assert.deepStrictEqual(linkKenh('facebook', 'Retro Cars Club (Page)', {}), { url: null, anh: null }, 'thiếu mã Page: không bịa link');
  assert.strictEqual(linkKenh('youtube', '@frontporchpuzzles', { kenhId: 'UCdii' }).url, 'https://www.youtube.com/channel/UCdii');
  assert.strictEqual(linkKenh('youtube', '@frontporchpuzzles').url, 'https://www.youtube.com/@frontporchpuzzles');
  assert.strictEqual(linkKenh('instagram', '@hotelscamalerts').url, 'https://www.instagram.com/hotelscamalerts');
  assert.strictEqual(linkKenh('tiktok', 'uriellrqv5g').url, 'https://www.tiktok.com/@uriellrqv5g');
  assert.strictEqual(linkKenh('twitter', 'Hotel Scam Alerts').url, null, 'tên hiển thị có dấu cách không phải handle');
  // toà Page mang url + anh sang PhoTk
  const m = tinhThanhPho({ ...live, kenh: [...live.kenh, { id: 580, ten: 'Retro Cars Club (Page)', nenTang: 'Facebook Reels', nenKey: 'facebook', nhom: 'Front Porch Puzzles', duAn: 'Front Porch Puzzles', ngonNgu: 'EN', proxy: '', tt: 'song', ngay: 0, video: 1, trungViXem: 0, xem: 0, click: 0, hh: 0, url: 'https://www.facebook.com/129365743783277', anh: 'fbp:129365743783277' }] } as any);
  const t = m.tk.find((x) => x.id === '580')!;
  assert.ok(t && t.url === 'https://www.facebook.com/129365743783277' && t.anh === 'fbp:129365743783277' && t.ten === 'Retro Cars Club');
}
console.log('link kênh ✓');

// bảng nội dung Page (25/10/2026): tuần T2→CN chứa hôm nay; ngày qua có bài = bài thật, không bài = trống; ngày tới = kế hoạch lệch pha 2 ngày mỗi Page
{
  const v = { trang: [{ acct: '580', ten: 'Retro Cars Club', nen: 'facebook:580' }, { acct: '589', ten: 'Classical Motorcycle', nen: 'facebook:589' }],
    bai: [{ nen: 'facebook:580', ngay: '2026-10-25', title: 'Only ONE says CHROME #shorts', url: 'u', link: null }] };
  const k = keHoachNoiDung(v, '2026-10-25');
  assert.deepStrictEqual(k.tuan.map((d) => d.ngay), ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'], 'CN 25/10 → tuần 19–25');
  const o = (t: string, n: string) => k.o.find((x) => x.trang === t && x.ngay === n)!;
  assert.ok(o('580', '2026-10-25').tt === 'da' && o('580', '2026-10-25').link === true && o('580', '2026-10-25').chu === 'Only ONE says CHROME', 'bài cũ không ghi link = có link');
  assert.strictEqual(o('580', '2026-10-24').tt, 'trong'); assert.strictEqual(o('589', '2026-10-25').tt, 'ke', 'hôm nay chưa đăng = còn kế hoạch');
  assert.strictEqual(o('589', '2026-10-25').loai, LICH_TUAN[(6 + 2) % 7]!.loai, 'Page thứ 2 lệch pha 2 ngày');
  const k2 = keHoachNoiDung({ ...v, bai: [] }, '2026-10-20');
  assert.ok(k2.o.filter((x) => x.trang === '580' && x.ngay > '2026-10-20').every((x) => x.tt === 'ke'), 'ngày tới đều là kế hoạch');
}
console.log('bảng nội dung ✓');
