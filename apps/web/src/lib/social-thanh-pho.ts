// THÀNH PHỐ HỆ SINH THÁI (anh 22/10/2026 — bắt đầu ở tab Social › 🏙 Thành phố, đích là màn hình chính cho mọi thứ đang diễn ra):
// biến số thật thành mô hình thành phố 3D. Tính thuần ở đây (tự kiểm: social-thanh-pho.test.mts); vẽ ở components/social-thanh-pho-canh.ts.
//   ĐÍCH = site (mọi site có mã theo dõi + site tài khoản trỏ tới) và SẢN PHẨM (App Store, Microsoft Store, Gumroad, Etsy, KDP, Udemy… — kho products).
//   NGUỒN đứng quanh đích của nó: máy tìm kiếm (mỗi máy một toà cạnh site, khách 30 ngày) + tài khoản social (bài, lịch, lượt xem, khách về site).
//   DỰ ÁN = một khu gom các đích của nó, có toà DỰ ÁN riêng; site không thuộc dự án nào tự đứng như một dự án; dự án ngừng → khu ở rìa thành phố.
//   ĐÃ ĐĂNG = bài đã lên (StKenh.video) · SẮP ĐĂNG = lượt dự kiến 7 ngày của máy đăng · HỎNG = sự cố 'bad' / tài khoản khoá, dính cờ · DỪNG = đã cắt.
import type { SocialLive } from './social-traffic';

/** MÁY TÌM KIẾM của thành phố Social (anh 22/10/2026: "thêm nguồn từ Bing, Google Search, Yandex… mỗi cái một thực thể"): nguồn phiên (referrer
 *  host hoặc utm "<nguồn> / organic") → máy tìm kiếm. Quảng cáo (/ cpc, / paid) không phải tìm kiếm tự nhiên → không tính. Dùng chung máy chủ
 *  (social-truc-tiep › docNguonSite) và trình duyệt (cảnh thành phố) nên nằm ở module thuần này. */
export const MAY_TIM: { khoa: string; ten: string; host: string; mau: string; re: RegExp }[] = [
  { khoa: 'google', ten: 'Google', host: 'google.com', mau: '#4285f4', re: /^(www\.)?google\.[a-z.]+$|^google \/ organic$/ },
  { khoa: 'bing', ten: 'Bing', host: 'bing.com', mau: '#008373', re: /(^|\.)bing\.com$|^bing \/ organic$/ },
  { khoa: 'yandex', ten: 'Yandex', host: 'yandex.ru', mau: '#fc3f1d', re: /yandex|^ya\.ru$|^dzen\.ru$/ },
  { khoa: 'duckduckgo', ten: 'DuckDuckGo', host: 'duckduckgo.com', mau: '#de5833', re: /duckduckgo/ },
  { khoa: 'yahoo', ten: 'Yahoo', host: 'search.yahoo.com', mau: '#6001d2', re: /search\.yahoo\.com$|^yahoo \/ organic$/ },
  { khoa: 'brave', ten: 'Brave Search', host: 'search.brave.com', mau: '#fb542b', re: /search\.brave\.com$/ },
  { khoa: 'ecosia', ten: 'Ecosia', host: 'ecosia.org', mau: '#36acb8', re: /ecosia\.org$/ },
  { khoa: 'qwant', ten: 'Qwant', host: 'qwant.com', mau: '#5c97ff', re: /qwant\.com$/ },
  { khoa: 'mailru', ten: 'Mail.ru', host: 'mail.ru', mau: '#005ff9', re: /^(go\.)?mail\.ru$/ },
  { khoa: 'baidu', ten: 'Baidu', host: 'baidu.com', mau: '#2932e1', re: /baidu\.com$/ },
  { khoa: 'naver', ten: 'Naver', host: 'naver.com', mau: '#03c75a', re: /naver\.com$/ },
  { khoa: 'seznam', ten: 'Seznam', host: 'seznam.cz', mau: '#cc0000', re: /seznam\.cz$/ },
];
/** NGUỒN NGOÀI KHÁC (bước 3, anh 22/10/2026): quảng cáo ("<nền> / cpc|paid") và trang giới thiệu (referrer host không phải máy tìm kiếm, không phải
 *  bài social của mình "<nền> / short" — đã tính ở toà tài khoản). khoa quảng cáo = nền chuẩn hoá; mã camp lạ → 'khac'. */
export const NEN_QC: Record<string, { ten: string; host: string; mau: string }> = {
  google: { ten: 'Google Ads', host: 'ads.google.com', mau: '#fbbc04' }, facebook: { ten: 'Meta Ads', host: 'facebook.com', mau: '#0866ff' }, bing: { ten: 'Microsoft Ads', host: 'ads.microsoft.com', mau: '#00a4ef' },
  tiktok: { ten: 'TikTok Ads', host: 'tiktok.com', mau: '#25f4ee' }, email: { ten: 'Email', host: 'gmail.com', mau: '#ea4335' }, khac: { ten: 'Quảng cáo khác', host: 'adfond.com', mau: '#9aa3b8' },
};
export function nguonNgoaiCua(nguon: string | null): { loai: 'qc' | 'gt'; khoa: string } | null {
  if (!nguon || nguon === 'direct' || / \/ (short|comment)$/.test(nguon)) return null;
  const qc = /^(.+?) \/ (cpc|paid|email_flow|email)$/.exec(nguon);
  if (qc) { const n = qc[1]!.toLowerCase(), k = /^(fb|facebook|meta|ig|instagram|an)$/.test(n) ? 'facebook' : n === 'email' ? 'email' : NEN_QC[n] ? n : 'khac'; return { loai: 'qc', khoa: k }; }
  if (/ \/ /.test(nguon) || mayTimCua(nguon)) return null;
  const host = nguon.replace(/^www\./, '').replace(/^l\.|^m\.|^lm\./, '');
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(host) ? { loai: 'gt', khoa: host } : null;
}
export const mayTimCua = (nguon: string | null) => { if (!nguon || / \/ (cpc|paid)$/.test(nguon)) return null; return MAY_TIM.find((m) => m.re.test(nguon))?.khoa ?? null; };

export type PhoNen = 'yt' | 'fb' | 'ig' | 'tt' | 'x' | 'pin' | 'dm' | 'th' | 'qu';
const NEN_KEY: Record<string, PhoNen> = { youtube: 'yt', facebook: 'fb', instagram: 'ig', tiktok: 'tt', twitter: 'x', x: 'x', pinterest: 'pin', dailymotion: 'dm', threads: 'th', quora: 'qu' };
/** nơi đăng của máy (xv_may.dang[].nen: youtube, x_anh, fb_link…) → khoá nền tảng của tài khoản (platform_accounts.platform_key) */
export const nenCuaMay = (nen: string) => { const g = nen.replace(/_(anh|link)$/, ''); return ({ fb: 'facebook', ig: 'instagram', x: 'twitter' } as Record<string, string>)[g] ?? g; };

/** toà = tài khoản mạng xã hội (loai 'mxh') hoặc máy tìm kiếm (loai 'tim', nen 'tim', host = tên miền máy tìm kiếm để lấy favicon, mau = màu hãng) */
/** toà NGUỒN: tài khoản mạng xã hội (loai 'mxh') hoặc máy tìm kiếm cạnh một site (loai 'tim', id `tim:<máy>@<site>`, host = tên miền máy tìm kiếm, mau = màu hãng) */
export interface PhoTk {
  id: string; loai: 'mxh' | 'tim' | 'qc' | 'gt' | 'ch'; nen: PhoNen | 'tim' | 'qc' | 'gt' | 'ch';
  /** nguồn trong cửa hàng (loai 'ch', vào sản phẩm): hiển thị / xem trang / tải lần đầu 30 ngày */
  chiTiet?: { hien: number; xem: number; tai: number }; host?: string; mau?: string; ten: string; duAn: string;
  chay: number; sap: number; xem: number | null;
  /** lượt khách về đích; kỳ đo khác nhau theo nguồn (sổ phiên 7 ngày · Pinterest 30 ngày · tìm kiếm 30 ngày) nên đi kèm nhãn kỳ */
  phien: number; phienKy: string;
  /** khoá đích nó đổ khách vào ('s:<site>'); null = chưa biết đổ về đâu */
  dich: string | null; hong: string | null; dung: boolean;
}
/** ĐÍCH: site ('s:<host>') hoặc sản phẩm ('p:<id>'). duAn = khoá khu (PhoDuAn.khoa). */
export interface PhoDich {
  khoa: string; loai: 'site' | 'sp'; ten: string; site: string | null; duAn: string;
  phien30: number | null; laShop: boolean; don: number | null; coNguon: boolean;
  /** sản phẩm: cửa bán (app-store, ms-store, gumroad, etsy, kdp, udemy…), host cửa bán để lấy favicon, trạng thái, số */
  nenBan?: string; hostBan?: string; trangThai?: string | null; sapLen?: boolean; url?: string | null; xem7?: number | null; tai?: number | null; net?: number | null;
}
/** KHU: dự án (laDuAn) hoặc một site đứng riêng; ngung = dự án ngừng hoạt động (đặt ở rìa) */
/** nhan = dòng đầu biển trên toà khu ('DỰ ÁN', 'DỰ ÁN · NGỪNG', 'TÀI KHOẢN BỊ KHOÁ') */
export interface PhoDuAn { khoa: string; ten: string; laDuAn: boolean; ngung: boolean; mau: string; site: string | null; nhan: string }
/** một dòng xe: toà nguồn → đích, số khách (kỳ theo nguồn) */
export interface PhoLuong { tu: string; den: string; so: number }
export interface PhoMoHinh { tk: PhoTk[]; dich: PhoDich[]; duAn: PhoDuAn[]; luong: PhoLuong[]; fav: Record<string, string | null> }

/** đầu vào hệ sinh thái (social-traffic › docHeSinhThai) */
export interface VaoHeSinhThai {
  duAn: { id: string; ten: string; site: string | null; ngung: boolean }[];
  /** sổ site ↔ dự án (du_an_site) — thắng projects.website */
  duAnSite: { site: string; duAn: string }[];
  sanPham: { id: string; ten: string; nen: string; trangThai: string | null; url: string | null; store: string | null; sku?: string | null; xem7: number | null; tai: number | null; net: number | null }[];
  /** nguồn khách vào từng sản phẩm 30 ngày: app = số Apple (nguồn × hiển thị / xem trang / tải lần đầu); Gumroad = nơi khách tới (product_daily.refs) */
  nguonSp?: { sp: string; nguon: string; hien: number; xem: number; tai: number }[];
  /** app_ung_dung: tên app → dự án */
  app: { ten: string; duAn: string }[];
  /** tài khoản cửa bán trong vault (etsy FrontPorchZ, kdp htuan82…) → dự án */
  tkCua: { nen: string; handle: string; duAn: string | null; khoa?: boolean }[];
}
/** cửa bán → host để lấy favicon */
export const HOST_BAN: Record<string, string> = { 'app-store': 'apps.apple.com', 'ms-store': 'apps.microsoft.com', 'play-store': 'play.google.com', gumroad: 'gumroad.com', etsy: 'etsy.com', kdp: 'amazon.com', udemy: 'udemy.com', 'mql5-market': 'mql5.com', rapidapi: 'rapidapi.com', 'wordpress.org': 'wordpress.org', stripe: 'stripe.com', course: 'teachable.com' };
const NEN_APP = new Set(['app-store', 'ms-store', 'play-store']);
/** tên nguồn cửa hàng → chữ người đọc + host lấy favicon */
const NGUON_CH: Record<string, [string, string | null]> = { 'App Store search': ['Tìm trên App Store', 'apps.apple.com'], 'App Store browse': ['Duyệt App Store', 'apps.apple.com'], 'Web referrer': ['Từ web', null], 'App referrer': ['Từ app khác', null], 'Institutional purchase': ['Mua tổ chức', null], direct: ['Trực tiếp', null], Unavailable: ['Không rõ', null] };
const TRANG_THAI_LEN = new Set(['published', 'active', 'live']);
const TRANG_THAI_SAP = new Set(['in_review', 'ready', 'owner_review', 'pending']);

/** sản phẩm → dự án: link trùng site dự án · app (tên app_ung_dung là đầu tên sản phẩm) · tài khoản cửa bán (nền + handle) · tên dự án nằm trong tên sản phẩm ·
 *  sản phẩm anh em cùng đầu tên (Giỗ Chạp (Windows) ↔ Giỗ Chạp: Văn Khấn). Không khớp gì → null. */
export function duAnCuaSanPham(sp: VaoHeSinhThai['sanPham'][number], v: VaoHeSinhThai, daGan: Map<string, string>): string | null {
  const host = hostCua(sp.url);
  if (host) { const d = v.duAnSite.find((x) => x.site === host)?.duAn ?? v.duAn.find((x) => x.site === host)?.id; if (d) return d; }
  const ten = chuan(sp.ten);
  const app = v.app.find((a) => chuan(a.ten).length >= 4 && ten.startsWith(chuan(a.ten))); if (app) return app.duAn;
  const tk = v.tkCua.find((t) => t.duAn && t.nen === sp.nen && sp.store && chuan(t.handle) === chuan(sp.store)); if (tk) return tk.duAn;
  const theoTen = v.duAn.filter((d) => chuan(d.ten).length >= 5 && ten.includes(chuan(d.ten))).sort((a, b) => b.ten.length - a.ten.length)[0]; if (theoTen) return theoTen.id;
  const dau = chuan(sp.ten.split(/[:(\-–]/)[0]!); if (dau.length >= 4) for (const [ten2, d] of daGan) if (ten2.startsWith(dau)) return d;
  return null;
}

const MAU_CUM = ['#3b4f8f', '#2f6f8f', '#7a5a2f', '#2f7a5a', '#6a3f8f', '#8f3f5a', '#4f6f2f', '#2f5a7a'];
const chuan = (h: string) => h.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/\(page\)/g, '').replace(/[^a-z0-9]/g, '');
const hostCua = (u: string | null | undefined) => { if (!u) return null; try { return new URL(u.startsWith('http') ? u : `https://${u}`).hostname.replace(/^www\./, ''); } catch { return null; } };
const nhieuNhat = (xs: (string | null)[]) => { const d = new Map<string, number>(); for (const x of xs) if (x) d.set(x, (d.get(x) ?? 0) + 1); return [...d].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null; };
const laShop = (site: string) => /(^|\.)(gumroad\.com|etsy\.com|amazon\.com)$/.test(site);

export function tinhThanhPho(live: Pick<SocialLive, 'kenh' | 'luoi' | 'suc' | 'landing' | 'ban' | 'fav' | 'nguonSite' | 'heSinhThai'>): PhoMoHinh {
  const { kenh, luoi, suc } = live;
  const nhanDong = (d: { mayTen: string; nenTen: string }) => `${d.mayTen.split(' · ')[0]} · ${d.nenTen}`;   // trùng cách social-suc-khoe ghi tên kênh trong sự cố
  const suCoBad = suc.suCo.filter((x) => x.muc === 'bad');
  const duAnCua = new Map(kenh.map((k) => [String(k.id), k.duAn ?? k.nhom]));

  // nơi đăng (máy × nền) của từng tài khoản: theo br.acct; nền chưa khai acct (TikTok qua máy ảo) → tài khoản cùng nền tảng, cùng dự án với các tài khoản khác của máy đó
  const dongCua = (id: string, nenKey: string, duAn: string) => suc.dong.filter((d) => {
    if (d.acct) return d.acct === id;
    if (nenCuaMay(d.nen) !== nenKey) return false;
    return suc.dong.some((e) => e.may === d.may && e.acct && duAnCua.get(e.acct) === duAn);
  });

  const tho = kenh.filter((k) => NEN_KEY[k.nenKey ?? '']).map((k) => {
    const id = String(k.id), duAn = k.duAn ?? k.nhom, dongs = dongCua(id, k.nenKey!, duAn);
    const sap = luoi.o.filter((o) => o.loai === 'du_kien' && dongs.some((d) => d.may === o.may && d.nen === o.nen)).length;
    const loi = suCoBad.find((s) => dongs.some((d) => s.kenh.includes(nhanDong(d))));
    const hong = k.tt === 'khoa' ? 'Tài khoản bị khoá' : k.tt === 'co' ? 'Tài khoản dính cờ' : loi?.tieuDe ?? null;
    return { k, id, duAn, site: nhieuNhat(dongs.map((d) => d.site)), sap, hong };
  });
  // site đích của tài khoản: máy đăng của nó → tài khoản trùng tên (cùng thương hiệu, vd IG hotelscamalerts ↔ X hotelscamalerts) → site chính của dự án → link đích của kênh
  const siteDuAn = new Map<string, string | null>();
  for (const t of tho) if (!siteDuAn.has(t.duAn)) siteDuAn.set(t.duAn, nhieuNhat(tho.filter((x) => x.duAn === t.duAn).map((x) => x.site)));
  for (const t of tho) if (!t.site) t.site = tho.find((x) => x.site && chuan(x.k.ten) === chuan(t.k.ten))?.site ?? null;
  for (const t of tho) if (!t.site) t.site = siteDuAn.get(t.duAn) ?? hostCua(t.k.landing);

  const tk: PhoTk[] = tho.map((t) => ({
    id: t.id, loai: 'mxh' as const, nen: NEN_KEY[t.k.nenKey!]!, ten: t.k.ten.replace(/\s*\(Page\)\s*$/i, ''), duAn: t.duAn,
    chay: t.k.video, sap: t.sap, xem: t.k.daDo === false ? null : t.k.xem, phien: t.k.click, phienKy: t.k.nenKey === 'pinterest' ? '30 ngày' : '7 ngày',
    dich: t.site, hong: t.hong, dung: t.k.tt === 'dung',
  }));

  const hst: VaoHeSinhThai = live.heSinhThai ?? { duAn: [], duAnSite: [], sanPham: [], app: [], tkCua: [] };
  const idTheoTen = new Map(hst.duAn.map((d) => [d.ten, d.id]));
  for (const t of tk) { if (t.dich) t.dich = `s:${t.dich}`; }

  // ── ĐÍCH: site
  const nguonSite = live.nguonSite ?? [];
  const dichMap = new Map<string, PhoDich>();
  const siteMoi = (site: string, phien30: number | null): PhoDich => ({ khoa: `s:${site}`, loai: 'site', ten: site, site, duAn: '', phien30, laShop: laShop(site), don: null, coNguon: false });
  for (const x of nguonSite) dichMap.set(`s:${x.site}`, siteMoi(x.site, x.phien30));
  for (const l of live.landing) { const k = `s:${l.site}`; if (nguonSite.some((x) => x.site === l.site)) continue; const d = dichMap.get(k) ?? siteMoi(l.site, l.coMa ? 0 : null); if (l.coMa) d.phien30 = (d.phien30 ?? 0) + l.phien30; dichMap.set(k, d); }
  for (const t of tk) if (t.dich && !dichMap.has(t.dich)) dichMap.set(t.dich, siteMoi(t.dich.slice(2), null));

  // ── NGUỒN: máy tìm kiếm cạnh từng site (mỗi site tối đa 6 máy, máy dưới 2 khách bỏ — toà lắt nhắt không giúp đọc)
  for (const x of nguonSite) for (const [k, so] of Object.entries(x.tim).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 6)) {
    const m = MAY_TIM.find((y) => y.khoa === k); if (!m) continue;
    tk.push({ id: `tim:${k}@${x.site}`, loai: 'tim', nen: 'tim', host: m.host, mau: m.mau, ten: m.ten, duAn: 'Tìm kiếm', chay: 0, sap: 0, xem: null, phien: so, phienKy: '30 ngày', dich: `s:${x.site}`, hong: null, dung: false });
  }
  // quảng cáo (tối đa 3 mỗi site) + trang giới thiệu (tối đa 4 mỗi site, từ 2 khách) — cùng khuôn toà nguồn đứng cạnh site
  for (const x of nguonSite) {
    for (const [k, so] of Object.entries(x.qc ?? {}).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 3)) {
      const q = NEN_QC[k] ?? NEN_QC.khac!;
      tk.push({ id: `qc:${k}@${x.site}`, loai: 'qc', nen: 'qc', host: q.host, mau: q.mau, ten: q.ten, duAn: 'Quảng cáo', chay: 0, sap: 0, xem: null, phien: so, phienKy: '30 ngày', dich: `s:${x.site}`, hong: null, dung: false });
    }
    for (const [h, so] of Object.entries(x.gt ?? {}).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 4))
      tk.push({ id: `gt:${h}@${x.site}`, loai: 'gt', nen: 'gt', host: h, mau: '#7a8bb3', ten: h, duAn: 'Giới thiệu', chay: 0, sap: 0, xem: null, phien: so, phienKy: '30 ngày', dich: `s:${x.site}`, hong: null, dung: false });
  }
  const luong: PhoLuong[] = tk.filter((t) => t.dich && t.phien).map((t) => ({ tu: t.id, den: t.dich!, so: t.phien }));   // nguồn cửa hàng thêm bên dưới

  // ── ĐÍCH: sản phẩm (đã lên hoặc sắp lên; 'planned' / 'draft' / 'archived' chưa có mặt trong thành phố)
  const daGan = new Map<string, string>();
  // dự án gốc app (anh 22/10/2026 "Clane.app là gốc dự án app"): dự án giữ site clane.app nhận mọi app; dự án cũ của app thành thương hiệu
  const cuaKhoa = new Set([...new Set(hst.tkCua.map((t) => t.nen))].filter((n) => hst.tkCua.filter((t) => t.nen === n).every((t) => t.khoa)));
  const duAnApp = hst.duAnSite.find((x) => x.site === 'clane.app')?.duAn ?? hst.duAn.find((d) => d.site === 'clane.app')?.id ?? null;
  const sps = hst.sanPham.filter((p) => TRANG_THAI_LEN.has(p.trangThai ?? '') || TRANG_THAI_SAP.has(p.trangThai ?? ''));
  for (const p of [...sps].sort((a, b) => Number(TRANG_THAI_LEN.has(b.trangThai ?? '')) - Number(TRANG_THAI_LEN.has(a.trangThai ?? '')))) {
    const d0 = duAnCuaSanPham(p, hst, daGan); if (d0) daGan.set(chuan(p.ten), d0);
    // app có dự án thương hiệu (MilitaryCalc) ở cùng dự án đó (anh 22/10/2026); app chưa thuộc dự án nào về dự án gốc Clane
    // cửa bán mà mọi tài khoản trong vault đều bị khoá (Udemy) → khu 'tài khoản bị khoá' ở rìa
    const d = cuaKhoa.has(p.nen) ? null : d0 ?? (duAnApp && NEN_APP.has(p.nen) ? duAnApp : null);
    dichMap.set(`p:${p.id}`, { khoa: `p:${p.id}`, loai: 'sp', ten: p.ten, site: null, duAn: cuaKhoa.has(p.nen) ? `khoa:${p.nen}` : d ? `d:${d}` : 'chua-sp', phien30: null, laShop: false, don: null, coNguon: false,
      nenBan: p.nen, hostBan: HOST_BAN[p.nen] ?? hostCua(p.url) ?? undefined, trangThai: p.trangThai, sapLen: !TRANG_THAI_LEN.has(p.trangThai ?? ''), url: p.url, xem7: p.xem7, tai: p.tai, net: p.net });
  }

  // ── NGUỒN vào sản phẩm (cửa hàng): mỗi nguồn một toà quanh sản phẩm
  const gomCh = new Map<string, { sp: string; nguon: string; hien: number; xem: number; tai: number }>();
  for (const x of hst.nguonSp ?? []) { const k = `${x.sp}|${x.nguon}`, g = gomCh.get(k) ?? { sp: x.sp, nguon: x.nguon, hien: 0, xem: 0, tai: 0 }; g.hien += x.hien; g.xem += x.xem; g.tai += x.tai; gomCh.set(k, g); }
  for (const g of gomCh.values()) {
    if (!dichMap.has(`p:${g.sp}`)) continue;
    const [ten, host] = NGUON_CH[g.nguon] ?? [g.nguon, /\./.test(g.nguon) ? g.nguon : null], so = g.hien || g.xem || g.tai; if (!so) continue;
    const t: PhoTk = { id: `ch:${g.nguon}@p:${g.sp}`, loai: 'ch', nen: 'ch', mau: '#0a84ff', ten, duAn: 'Cửa hàng', chay: 0, sap: 0, xem: null, phien: so, phienKy: '30 ngày', dich: `p:${g.sp}`, hong: null, dung: false, chiTiet: { hien: g.hien, xem: g.xem, tai: g.tai } };
    if (host) t.host = host;
    tk.push(t); luong.push({ tu: t.id, den: t.dich!, so });
  }

  // ── đơn cửa hàng (Gumroad / Etsy) + có nguồn chưa
  for (const d of dichMap.values()) {
    d.coNguon = luong.some((l) => l.den === d.khoa);
    if (d.loai === 'site' && d.laShop) { const ten = chuan(d.site!.split('.')[0]!); const b = live.ban.filter((x) => /gumroad|etsy/i.test(x.cua) && (chuan(x.ten) === ten || chuan(x.duAn) === ten)); if (b.length) d.don = b.reduce((a, x) => a + (x.ban30 ?? 0), 0); }
  }
  // giữ site có khách hoặc có người trỏ tới
  const dich = [...dichMap.values()].filter((d) => d.loai === 'sp' || d.coNguon || (d.phien30 ?? 0) > 0 || tk.some((t) => t.dich === d.khoa));

  // ── KHU (dự án): site → sổ du_an_site → projects.website → dự án của tài khoản trỏ tới nó → site phụ cùng máy đăng → đứng riêng
  const siteDa = new Map<string, string>([...hst.duAn.filter((d) => d.site).map((d) => [d.site!, d.id] as [string, string]), ...hst.duAnSite.map((x) => [x.site, x.duAn] as [string, string])]);
  const tuTk = (khoa: string) => { const t = tho.find((x) => x.site && `s:${x.site}` === khoa); return t ? idTheoTen.get(t.duAn) ?? null : null; };
  for (const d of dich) if (d.loai === 'site') {
    const site = d.site!;
    let da = siteDa.get(site) ?? [...siteDa].find(([s2]) => site.endsWith(`.${s2}`))?.[1] ?? null;   // *.clane.app → dự án của clane.app
    if (!da) { const dm = suc.dong.find((x) => x.sites?.includes(site) && x.site && x.site !== site); if (dm) da = siteDa.get(dm.site!) ?? tuTk(`s:${dm.site}`); }
    if (!da) da = tuTk(d.khoa);
    // dự án chung nhiều thương hiệu (Social Traffic: Hotel + BYL) không gom site: mỗi site đứng riêng như một dự án
    if (da && hst.duAn.find((x) => x.id === da)?.site == null && !hst.duAnSite.some((x) => x.duAn === da) && dich.filter((y) => y.loai === 'site' && tuTk(y.khoa) === da).length > 1) da = null;
    d.duAn = da ? `d:${da}` : `rieng:${site}`;
  }
  const khoaDa = [...new Set(dich.map((d) => d.duAn))];
  const duAn: PhoDuAn[] = khoaDa.map((khoa, i) => {
    const ds = dich.filter((d) => d.duAn === khoa), p = khoa.startsWith('d:') ? hst.duAn.find((x) => x.id === khoa.slice(2)) : null;
    const siteChinh = ds.filter((d) => d.loai === 'site').sort((a, b) => (b.phien30 ?? -1) - (a.phien30 ?? -1))[0]?.site ?? null;
    const khoaTk = khoa.startsWith('khoa:'), tenCua = khoaTk ? khoa.slice(5).replace(/^./, (c) => c.toUpperCase()) : '';
    return { khoa, ten: khoa === 'chua-sp' ? 'Sản phẩm chưa gán dự án' : khoaTk ? tenCua : p ? p.ten : khoa.startsWith('rieng:') ? khoa.slice(6) : khoa, laDuAn: !!p || khoa === 'chua-sp' || khoaTk,
      ngung: !!p?.ngung || khoaTk, mau: MAU_CUM[i % MAU_CUM.length]!, site: khoaTk ? HOST_BAN[khoa.slice(5)] ?? null : p?.site ?? siteChinh, nhan: khoaTk ? 'TÀI KHOẢN BỊ KHOÁ' : p?.ngung ? 'DỰ ÁN · NGỪNG' : 'DỰ ÁN' };
  });
  const tongKhu = (k: string) => dich.filter((d) => d.duAn === k).reduce((a, d) => a + (d.phien30 ?? 0) + (d.xem7 ?? 0), 0);
  duAn.sort((a, b) => Number(a.ngung) - Number(b.ngung) || Number(a.khoa === 'chua-sp') - Number(b.khoa === 'chua-sp') || tongKhu(b.khoa) - tongKhu(a.khoa));
  return { tk, dich, duAn, luong, fav: live.fav };
}
