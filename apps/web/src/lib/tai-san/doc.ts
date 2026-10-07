// CÂY TÀI SẢN BÁN HÀNG — shop (nơi bán có cổng thanh toán riêng) → sản phẩm, mọi nguồn về MỘT hình (anh chốt 05/10/2026).
// Trước đây sản phẩm nằm 3 chỗ không nối nhau: bảng Gumroad ở tab SEO (API), /products (Directus), /shop (mellowstep) — và
// sách KDP / listing Etsy không có chỗ nào (chỉ nằm trong kdp.json của repo). Giờ:
//   · Gumroad      ← API v2 theo token vault (store = handle) + lượt xem từ product_daily
//   · mellowstep…  ← sổ shop_* (shop_cua_hang / shop_san_pham / shop_don)
//   · mọi thứ khác ← Directus `products` = SỔ CÁI (platform + store + status), tiền 30n từ product_stats; ghi bằng ~/bin/sanpham
// Trạng thái gom về 4 bậc: đang làm → chờ duyệt → đang bán → ngừng. "Chưa đo" (null) ≠ 0 — giữ luật của lib/products/data.ts.
// Kiểu + bảng trạng thái ở kieu.ts (thuần, client import được); file này kéo DB nên chỉ server component gọi.
import { getGumroadSummary, lacksDiscover } from '@/lib/gumroad/products';
import { loadProductViews, type ViewsPayload } from '@/lib/gumroad/daily';
import { getProductsView } from '@/lib/products/data';
import { docShop } from '@/lib/shop/doc';
import { isoCua } from '@/lib/shop/buoc';
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';

import { docEtsy } from '@/lib/etsy/listings';
import { fetchDirectusAccountsForPlatforms } from '@/lib/bridge/directus';
import { NEN_GOP, anhBiaXem, daDuyetBanNay, khopTk, nenChuan, shopChet, type Ky, type ShopNut, type SpNut, type TaiSanBan, type TrangThaiSp } from './kieu';
export { TT_SP, type Ky, type ShopNut, type SpNut, type TaiSanBan, type TrangThaiSp } from './kieu';

const NHAN_NEN: Record<string, string> = { gumroad: 'Gumroad', kdp: 'KDP', etsy: 'Etsy', udemy: 'Udemy', 'mql5-market': 'MQL5 Market', rapidapi: 'RapidAPI',
  stripe: 'Stripe', chaturbate: 'Chaturbate', stripcash: 'Stripcash', course: 'Khoá học', 'wordpress.org': 'WordPress.org', 'app-store': 'App Store',
  astrolas: 'Astrolas' };   // astrolas.com — SaaS chiêm tinh, cổng thu Paddle (anh yêu cầu 06/10/2026)
const LOAI_NEN: Record<string, ShopNut['loai']> = { gumroad: 'gumroad', kdp: 'kdp', etsy: 'etsy' };
const TT_DIRECTUS: Record<string, TrangThaiSp> = { planned: 'du_kien', draft: 'dang_lam', ready: 'san_sang', owner_review: 'cho_anh', pending: 'cho_duyet', in_review: 'cho_duyet', published: 'dang_ban', unlisted: 'ngung', archived: 'ngung' };

// Tài sản sống chết theo TÀI KHOẢN bán: khoá tài khoản là mọi sản phẩm của nó ngừng (Udemy #158, anh báo 05/10/2026).
// Đọc trạng thái từ vault (platform_accounts) lúc dựng cây, KHÔNG sửa tay từng sản phẩm — kháng nghị được thì tự trở lại.
// Cùng lượt đọc này gắn tài khoản vào từng shop (anh cần biết shop nào đứng tên tài khoản nào).
type TkDong = { id: number | string; nguon: 'mos2' | 'directus'; url?: string; nen: string; handle: string; ten: string; email: string | null; status: string };
/** Tài khoản bán từ HAI kho: MOS2 platform_accounts (ưu tiên — mở được drawer) + Directus earns.accounts (kho gốc, nhiều tài khoản chưa
 *  nhập sang MOS2: Chaturbate zoomxxx, Stripe, Gumroad codecrate… — #1113). Trùng (nền + handle) thì giữ bản MOS2.
 *  `nens` = nền của CHÍNH các shop trên cây (đã chuẩn hoá) — không có danh sách gõ tay, shop nền mới tự được tra tài khoản.
 *  Directus hỏng thì vẫn trả phần MOS2 và ghi lỗi, không làm sập cây. */
async function docTaiKhoan(nens: string[], loi: string[]): Promise<TkDong[]> {
  const khoa = [...new Set([...nens, ...Object.keys(NEN_GOP).filter((k) => nens.includes(NEN_GOP[k]!))])];
  if (!khoa.length) return [];
  const d = getDb();
  const mos = d ? ((await d.execute(sql`SELECT id, platform_key AS nen, lower(coalesce(handle, '')) AS handle, coalesce(handle, '') AS ten, email, status FROM platform_accounts
    WHERE lower(platform_key) IN ${khoa}
    ORDER BY (status IN ('banned','blocked','closed')), id`)) as unknown as Omit<TkDong, 'nguon'>[]).map((r) => ({ ...r, nen: nenChuan(r.nen), nguon: 'mos2' as const })) : [];
  const co = new Set(mos.map((r) => `${r.nen}:${r.handle}`));
  let dir: TkDong[] = [];
  try {
    dir = (await fetchDirectusAccountsForPlatforms(khoa)).filter((a) => a.platform)
      .map((a) => ({ id: a.id, nguon: 'directus' as const, url: `${DIRECTUS}/admin/content/accounts/${a.id}`, nen: nenChuan(a.platform!),
        handle: (a.handle ?? '').toLowerCase(), ten: a.handle ?? '', email: a.email ?? null, status: (a.status ?? 'active').toLowerCase() }))
      .filter((a) => !co.has(`${a.nen}:${a.handle}`) && (co.add(`${a.nen}:${a.handle}`), true));
  } catch (e) { loi.push(`tài khoản Directus: ${(e as Error).message}`); }
  return [...mos, ...dir];
}

const DIRECTUS = process.env.DIRECTUS_URL || 'https://as.on.tc';
const chuanUrl = (u: string | null | undefined) => (u ?? '').toLowerCase().replace(/[?#].*$/, '').replace(/\/$/, '');
const gumroadHandle = (u: string | null) => { try { const h = new URL(u ?? '').hostname; return h.endsWith('.gumroad.com') ? (h.split('.')[0] ?? null) : null; } catch { return null; } };

export async function docTaiSanBan(): Promise<TaiSanBan> {
  const loi: string[] = [];
  const boc = async <T>(ten: string, f: () => Promise<T>, mac: T): Promise<T> => { try { return await f(); } catch (e) { loi.push(`${ten}: ${(e as Error).message}`); return mac; } };
  const [sum, views, dir, shop, etsy] = await Promise.all([
    boc('gumroad', getGumroadSummary, null),
    boc('gumroad views', loadProductViews, { byProduct: {}, lastSync: null } as ViewsPayload),
    boc('directus', () => getProductsView(30), null),
    boc('shop', docShop, null),
    boc('etsy', docEtsy, []),
  ]);
  const shops: ShopNut[] = [];

  // 1. Gumroad theo API — mỗi token vault một store; nối views bằng `${store}:${id}` (id gốc, không phải permalink).
  const urlApi = new Set<string>();
  if (sum) {
    if (!sum.ok && sum.error) loi.push(`gumroad: ${sum.error}`);
    for (const s of sum.stores) {
      const sp = sum.products.filter((p) => p.store === s.handle).map((p): SpNut => {
        urlApi.add(chuanUrl(p.url));
        const v = views.byProduct[`${s.handle}:${p.id}`];
        return { khoa: `gumroad:${p.id}`, ten: p.name, anh: p.thumbnailUrl, ma: p.permalink, phu: null, url: p.url, trangThai: p.published ? 'dang_ban' : 'dang_lam', gia: p.priceCents / 100,
          views7d: v ? v.views7d : null, don: p.salesCount, tien: p.salesUsdCents / 100, ky: 'tron_doi',
          canhBao: p.published && lacksDiscover(p) ? 'thiếu category/tag → không lên Gumroad Discover' : null, ghiChu: null };
      });
      shops.push({ khoa: `gumroad:${s.handle}`, ten: `Gumroad · ${s.handle}`, loai: 'gumroad', url: s.url || null, sp,
        tien: sp.reduce((t, x) => t + (x.tien ?? 0), 0), ky: 'tron_doi', loi: s.error ?? null, ghiChu: null });
    }
    // Store job views đọc được mà vault chưa có token API → sản phẩm của nó không hiện (04/10: Front Porch Puzzles + ExamWeight).
    const coToken = new Set(sum.stores.map((s) => s.handle));
    for (const h of new Set(Object.keys(views.byProduct).map((k) => k.split(':')[0] ?? ''))) {
      if (h && !coToken.has(h)) loi.push(`gumroad: store ${h} có lượt xem nhưng vault chưa có token API → sản phẩm của nó không hiện (node resources/auto-publish/scripts/gumroad-api-token.mjs "<tên store>", repo earns-strategy)`);
    }
  }

  // 2. Directus — sổ cái. Dòng Gumroad đã có qua API thì bỏ (API tươi hơn); dòng Gumroad của store không còn token (oldcc7391) vẫn hiện.
  if (dir) {
    loi.push(...dir.errors);
    const nhom = new Map<string, ShopNut>();
    for (const r of dir.rows) {
      if (r.platform === 'gumroad' && urlApi.has(chuanUrl(r.url))) continue;
      const store = r.store ?? (r.platform === 'gumroad' ? gumroadHandle(r.url) : null);
      const khoa = `${r.platform}:${store ?? ''}`;
      const nen = NHAN_NEN[r.platform] ?? r.platform;
      const g = nhom.get(khoa) ?? { khoa, ten: store ? `${nen} · ${store}` : nen, loai: LOAI_NEN[r.platform] ?? 'san', url: null, sp: [], tien: null, ky: '30n' as Ky, loi: null, ghiChu: null };
      // Dòng đầu ghi chú do quy-trinh.mjs ghi → tách thành tiến độ (hiện trong nhãn trạng thái), phần còn lại vẫn là ghi chú.
      const qt = (r.notes ?? '').match(/^▶ quy trình (\d+\/\d+)(?: · xong: [^·\n]*)?(?: · (?:kế: )?([^\n]*))?\n?/);
      g.sp.push({ khoa: `d:${r.id}`, tienDo: qt?.[1], ke: qt?.[2], xem: r.xem, duyet: r.duyet, duyetBam: r.duyetBam, dangDuKien: r.dangDuKien, series: r.series, idSo: String(r.id),  ten: r.title, anh: ((id) => (id ? `${DIRECTUS}/assets/${id}?width=600` : null))(r.cover ?? anhBiaXem(r.xem)), ma: r.sku, phu: r.category ?? r.sku, url: r.url, // Anh đã duyệt bản này (#1115) → hết là việc của anh: hiện 'sẵn sàng' ngay, không đợi máy sản xuất đổi status sổ.
        trangThai: ((t) => (t === 'cho_anh' && daDuyetBanNay(r.duyet, r.xem?.ngay) ? 'san_sang' : t))(TT_DIRECTUS[r.status ?? ''] ?? 'dang_lam'), gia: r.price, tienTe: r.currency ?? undefined,
        views7d: r.views7d, don: r.downloads, tien: r.net, ky: '30n', canhBao: null, ghiChu: qt ? (r.notes ?? '').slice(qt[0].length) || null : r.notes });
      if (r.net != null) g.tien = (g.tien ?? 0) + r.net;
      nhom.set(khoa, g);
    }
    // Tiền đo ở mức TÀI KHOẢN (Udemy) không gắn sản phẩm nào → đặt lên shop, nói rõ.
    for (const g of nhom.values()) {
      const [nen, store] = g.khoa.split(':');
      const p = dir.platforms.find((x) => x.platform === nen);
      if (p?.platformOnly && p.net != null && !store) { g.tien = p.net; g.ghiChu = 'tiền đo ở mức tài khoản, không tách theo sản phẩm'; }
    }
    shops.push(...nhom.values());
  }

  // 3. Shop MOS (mellowstep…) — sổ shop_*: sản phẩm mặt tiền + đơn đã trả 30 ngày.
  if (shop) {
    const tu = Date.now() - 30 * 86_400_000;
    for (const c of shop.cuaHang.filter((x) => !x.demo)) {
      const don = shop.don.filter((d) => d.cuaHang === c.khoa && d.buoc !== 'cho_tt' && d.buoc !== 'huy' && new Date(isoCua(d.taoLuc)).getTime() > tu);
      const sp = shop.sanPham.filter((p) => p.cuaHang === c.khoa).map((p): SpNut => ({ khoa: `mos:${p.id}`, ten: p.ten, anh: p.anh, ma: p.slug, phu: p.soBienThe ? `${p.soBienThe} biến thể` : null,
        url: p.slug ? `https://${c.domain}/${p.slug}` : null,   // apps/store: trang sản phẩm ở /<slug> (/product/<slug> 301 về đó)
        trangThai: p.hien ? 'dang_ban' : 'ngung', gia: p.giaTu, views7d: null, don: p.daBan, tien: null, ky: 'tron_doi', canhBao: p.choCoHang ? `${p.choCoHang} chờ có hàng` : null, ghiChu: null }));
      shops.push({ khoa: `mos:${c.khoa}`, ten: `${c.ten} · ${c.domain}`, loai: 'mos', url: `https://${c.domain}`, sp,
        tien: don.reduce((t, d) => t + d.tong - d.hoan, 0), ky: '30n', loi: c.dongBoLoi, ghiChu: `${don.length} đơn đã trả 30 ngày` });
    }
  }

  // 4. Etsy theo API (lib/etsy/listings.ts) — shop nào chưa có listing vẫn hiện, vì tài khoản đã có.
  const TT_ETSY: Record<string, TrangThaiSp> = { active: 'dang_ban', draft: 'dang_lam', inactive: 'ngung', expired: 'ngung', sold_out: 'ngung' };
  for (const e of etsy) {
    const sp = e.listings.map((l): SpNut => ({ khoa: `etsy:${l.id}`, ten: l.title, anh: l.image, ma: String(l.id), phu: l.type === 'physical' ? 'vật lý' : 'pdf', url: l.url, trangThai: TT_ETSY[l.state] ?? 'dang_lam',
      gia: l.price, tienTe: l.currency,
      views7d: null, don: null, tien: null, ky: '30n', canhBao: null, ghiChu: l.views != null ? `${l.views} lượt xem · ${l.favorites ?? 0} yêu thích (trọn đời)` : null }));
    const khoa = `etsy:${e.handle}`;
    // Sổ cái tay giữ lại phần API không thấy (sản phẩm planned/draft chưa lên sàn); dòng trùng link/tên với listing API thì nhường API.
    const cu = shops.findIndex((x) => x.khoa === khoa);
    if (cu >= 0) {
      const co = new Set(sp.flatMap((x) => [x.url && chuanUrl(x.url), x.ten.toLowerCase()]).filter(Boolean));
      sp.push(...shops[cu]!.sp.filter((x) => !(x.url && co.has(chuanUrl(x.url))) && !co.has(x.ten.toLowerCase())));
      shops.splice(cu, 1);
    }
    shops.push({ khoa, ten: `Etsy · ${e.handle}`, loai: 'etsy', url: e.url, sp, tien: null, ky: '30n', loi: e.error, ghiChu: sp.length ? null : 'chưa có listing' });
  }
  // GỘP shop trùng khoá: nguồn API (Gumroad/Etsy) và sổ cái tay cùng một store thì là MỘT shop (05/10/2026: Gumroad · frontporchpuzzles hiện
  // hai lần — 3 sách đã bán theo API ở một nút, 4 sách đang làm theo sổ cái ở nút kia, nhìn như sách đã đăng mà ghi "đang làm").
  // Nút đứng trước (API) giữ thông tin shop; sản phẩm sổ cái trùng url/tên với sản phẩm API thì bỏ.
  for (let i = 0; i < shops.length; i++) {
    for (let j = shops.length - 1; j > i; j--) {
      if (shops[j]!.khoa !== shops[i]!.khoa) continue;
      const a = shops[i]!, b = shops.splice(j, 1)[0]!;
      const co = new Set(a.sp.flatMap((x) => [x.url ? chuanUrl(x.url) : '', x.ten.toLowerCase()]).filter(Boolean));
      a.sp.push(...b.sp.filter((x) => !(x.url && co.has(chuanUrl(x.url))) && !co.has(x.ten.toLowerCase())));
      a.url ??= b.url; a.loi ??= b.loi;
      if (b.tien != null) a.tien = (a.tien ?? 0) + b.tien;
    }
  }
  // Tài khoản tra SAU khi có cây: nền = nền của chính các shop (mellowstep cho shop MOS).
  const tk = await docTaiKhoan([...new Set(shops.map((x) => (x.loai === 'mos' ? 'mellowstep' : nenChuan(x.khoa.split(':')[0] ?? ''))))], loi);
  for (const s of shops) {
    const [nenGoc, store] = s.khoa.split(':');
    const nen = nenChuan(nenGoc ?? '');
    const t = s.loai === 'mos' ? khopTk('mellowstep', null, tk)[0] : khopTk(nen ?? '', store || null, tk)[0];
    s.tk = t ? { id: t.id, nguon: t.nguon, url: t.url, handle: t.ten, email: t.email, status: t.status } : null;
    const chet = s.loai === 'mos' ? null : shopChet(nen ?? '', store || null, tk);
    if (!chet) continue;
    s.loi = `tài khoản ${chet === 'banned' ? 'bị khoá' : chet}`;
    for (const x of s.sp) if (x.trangThai !== 'ngung') { x.trangThai = 'ngung'; x.ghiChu = [`tài khoản ${chet}`, x.ghiChu].filter(Boolean).join(' · '); }
  }
  // Thứ tự: shop có việc đang chờ (chờ duyệt / đang làm) lên trước, rồi theo tiền.
  const can = (s: ShopNut) => s.sp.filter((x) => x.trangThai === 'cho_anh' || x.trangThai === 'cho_duyet' || x.trangThai === 'san_sang' || x.trangThai === 'dang_lam').length;
  shops.sort((a, b) => can(b) - can(a) || (b.tien ?? -1) - (a.tien ?? -1) || a.ten.localeCompare(b.ten));
  return { shops, loi, viewsToi: views.lastSync };
}
