// THÀNH PHỐ SOCIAL (anh 22/10/2026, tab Social › Thành phố): biến số thật của tab Social thành mô hình thành phố 3D — mỗi tài khoản / Page / kênh
// là một toà, cụm = sản phẩm (quảng trường + toà trung tâm), toà đích = site nhận khách. Tính thuần ở đây (tự kiểm: social-thanh-pho.test.mts);
// vẽ ở components/social-thanh-pho-canh.ts. Không đọc DB: mọi số lấy từ SocialLive đã có (kênh, lưới lịch, sức khoẻ, landing, cửa bán).
//   ĐÃ ĐĂNG = bài đã lên (StKenh.video — sổ máy đăng / Pinterest đếm) · SẮP ĐĂNG = lượt dự kiến 7 ngày của máy đăng (lưới lịch, loai 'du_kien') ·
//   HỎNG = nơi đăng của tài khoản đang dính sự cố 'bad' (sức khoẻ) hoặc tài khoản bị khoá / dính cờ · DỪNG = tài khoản đã cắt.
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
export const mayTimCua = (nguon: string | null) => { if (!nguon || / \/ (cpc|paid)$/.test(nguon)) return null; return MAY_TIM.find((m) => m.re.test(nguon))?.khoa ?? null; };

export type PhoNen = 'yt' | 'fb' | 'ig' | 'tt' | 'x' | 'pin' | 'dm' | 'th' | 'qu';
const NEN_KEY: Record<string, PhoNen> = { youtube: 'yt', facebook: 'fb', instagram: 'ig', tiktok: 'tt', twitter: 'x', x: 'x', pinterest: 'pin', dailymotion: 'dm', threads: 'th', quora: 'qu' };
/** nơi đăng của máy (xv_may.dang[].nen: youtube, x_anh, fb_link…) → khoá nền tảng của tài khoản (platform_accounts.platform_key) */
export const nenCuaMay = (nen: string) => { const g = nen.replace(/_(anh|link)$/, ''); return ({ fb: 'facebook', ig: 'instagram', x: 'twitter' } as Record<string, string>)[g] ?? g; };

/** toà = tài khoản mạng xã hội (loai 'mxh') hoặc máy tìm kiếm (loai 'tim', nen 'tim', host = tên miền máy tìm kiếm để lấy favicon, mau = màu hãng) */
export interface PhoTk {
  id: string; loai: 'mxh' | 'tim'; nen: PhoNen | 'tim'; host?: string; mau?: string; cum: string; ten: string; duAn: string;
  chay: number; sap: number; xem: number | null;
  /** lượt khách về site; kỳ đo khác nhau theo nguồn (sổ phiên 7 ngày · Pinterest 30 ngày) nên đi kèm nhãn kỳ */
  phien: number; phienKy: string;
  dich: string | null; hong: string | null; dung: boolean;
}
export interface PhoCum { khoa: string; ten: string; site: string | null; mau: string; trong: boolean }
/** coNguon = có khách từ social hoặc tìm kiếm (false: site chưa gắn nguồn traffic nào — toà xám) */
export interface PhoDich { site: string; phien30: number | null; laShop: boolean; don: number | null; cum: string[]; coNguon: boolean }
/** một dòng xe: toà nguồn → site, số khách (kỳ theo nguồn: social 7 ngày / Pinterest 30 ngày / tìm kiếm 30 ngày) */
export interface PhoLuong { tu: string; den: string; so: number }
export interface PhoMoHinh { tk: PhoTk[]; cum: PhoCum[]; dich: PhoDich[]; luong: PhoLuong[]; fav: Record<string, string | null> }

const MAU_CUM = ['#3b4f8f', '#2f6f8f', '#7a5a2f', '#2f7a5a', '#6a3f8f', '#8f3f5a', '#4f6f2f', '#2f5a7a'];
const chuan = (h: string) => h.toLowerCase().replace(/\(page\)/g, '').replace(/[^a-z0-9]/g, '');
const hostCua = (u: string | null | undefined) => { if (!u) return null; try { return new URL(u.startsWith('http') ? u : `https://${u}`).hostname.replace(/^www\./, ''); } catch { return null; } };
const nhieuNhat = (xs: (string | null)[]) => { const d = new Map<string, number>(); for (const x of xs) if (x) d.set(x, (d.get(x) ?? 0) + 1); return [...d].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null; };
const laShop = (site: string) => /(^|\.)(gumroad\.com|etsy\.com|amazon\.com)$/.test(site);

export function tinhThanhPho(live: Pick<SocialLive, 'kenh' | 'luoi' | 'suc' | 'landing' | 'ban' | 'fav' | 'nguonSite'>): PhoMoHinh {
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
    id: t.id, loai: 'mxh' as const, nen: NEN_KEY[t.k.nenKey!]!, cum: t.site ? `s:${t.site}` : `p:${t.duAn}`, ten: t.k.ten.replace(/\s*\(Page\)\s*$/i, ''), duAn: t.duAn,
    chay: t.k.video, sap: t.sap, xem: t.k.daDo === false ? null : t.k.xem, phien: t.k.click, phienKy: t.k.nenKey === 'pinterest' ? '30 ngày' : '7 ngày',
    dich: t.site, hong: t.hong, dung: t.k.tt === 'dung',
  }));

  // MÁY TÌM KIẾM: mỗi máy một toà trong cụm 'Tìm kiếm', khách 30 ngày tới từng site
  const nguonSite = live.nguonSite ?? [];
  for (const m of MAY_TIM) {
    const so = nguonSite.reduce((a, x) => a + (x.tim[m.khoa] ?? 0), 0); if (!so) continue;
    tk.push({ id: `tim:${m.khoa}`, loai: 'tim', nen: 'tim', host: m.host, mau: m.mau, cum: 'tim', ten: m.ten, duAn: 'Tìm kiếm', chay: 0, sap: 0, xem: null, phien: so, phienKy: '30 ngày', dich: null, hong: null, dung: false });
  }
  const luong: PhoLuong[] = [
    ...tk.filter((t) => t.loai === 'mxh' && t.dich && t.phien).map((t) => ({ tu: t.id, den: t.dich!, so: t.phien })),
    ...nguonSite.flatMap((x) => Object.entries(x.tim).map(([k, so]) => ({ tu: `tim:${k}`, den: x.site, so }))),
  ];
  const khoaCum = [...new Set(tk.map((t) => t.cum))];
  const cum: PhoCum[] = khoaCum.map((khoa, i) => {
    const tks = tk.filter((t) => t.cum === khoa), page = tho.find((x) => `s:${x.site}` === khoa && x.k.nenKey === 'facebook' && /\(Page\)/i.test(x.k.ten));
    const site = khoa.startsWith('s:') ? khoa.slice(2) : null;
    if (khoa === 'tim') return { khoa, ten: 'Tìm kiếm', site: null, mau: '#3a4f7a', trong: false };
    return { khoa, ten: page ? page.k.ten.replace(/\s*\(Page\)\s*$/i, '') : nhieuNhat(tks.map((t) => t.duAn)) ?? site ?? khoa, site, mau: MAU_CUM[i % MAU_CUM.length]!, trong: tks.every((t) => !t.chay && !t.sap) };
  }).sort((a, b) => Number(a.trong) - Number(b.trong) || Number(b.khoa === 'tim') - Number(a.khoa === 'tim') || a.ten.localeCompare(b.ten));

  // toà đích: site trong bảng Landing (phiên 30 ngày khi site có mã theo dõi) + site tài khoản trỏ tới; cửa hàng (Gumroad / Etsy) mang số đơn 30 ngày
  const dichMap = new Map<string, PhoDich>();
  // mọi site có mã theo dõi (sổ phiên 30 ngày) — gồm site chưa gắn nguồn nào; bảng Landing chỉ bổ sung site chưa có trong sổ (Gumroad…)
  for (const x of nguonSite) dichMap.set(x.site, { site: x.site, phien30: x.phien30, laShop: laShop(x.site), don: null, cum: [], coNguon: false });
  for (const l of live.landing) { if (nguonSite.some((x) => x.site === l.site)) continue; const d = dichMap.get(l.site) ?? { site: l.site, phien30: l.coMa ? 0 : null, laShop: laShop(l.site), don: null, cum: [], coNguon: false }; if (l.coMa) d.phien30 = (d.phien30 ?? 0) + l.phien30; dichMap.set(l.site, d); }
  for (const t of tk) if (t.dich && !dichMap.has(t.dich)) dichMap.set(t.dich, { site: t.dich, phien30: null, laShop: laShop(t.dich), don: null, cum: [], coNguon: false });
  for (const d of dichMap.values()) {
    d.cum = cum.filter((c) => c.site === d.site).map((c) => c.khoa);
    d.coNguon = d.cum.length > 0 || luong.some((l) => l.den === d.site);
    if (d.laShop) { const ten = chuan(d.site.split('.')[0]!); const b = live.ban.filter((x) => /gumroad|etsy/i.test(x.cua) && (chuan(x.ten) === ten || chuan(x.duAn) === ten)); if (b.length) d.don = b.reduce((a, x) => a + (x.ban30 ?? 0), 0); }
  }
  // giữ site có người trỏ tới (cụm) hoặc có khách — site trong bảng Landing mà không ai trỏ, không khách thì không dựng; site có nguồn xếp trước
  const dich = [...dichMap.values()].filter((d) => d.cum.length || (d.phien30 ?? 0) > 0).sort((a, b) => Number(b.coNguon) - Number(a.coNguon) || (b.phien30 ?? -1) - (a.phien30 ?? -1));
  return { tk, cum, dich, luong, fav: live.fav };
}
