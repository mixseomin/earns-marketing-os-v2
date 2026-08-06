// Danh mục SẢN PHẨM + số liệu thật của từng cái.
//
// Trước đây không có chỗ nào nhìn được toàn bộ hàng mình bán: /revenue chỉ có Gumroad
// và AdSense, còn Udemy/MQL5/RapidAPI thì nằm im trong Directus. Trang này gộp:
//   products      — danh mục (Directus)
//   product_stats — số liệu theo ngày (doanh thu thực nhận, rating, review…)
//
// LUẬT SỐ MỘT: CHƯA ĐO ĐƯỢC ≠ BẰNG 0.
// Chỉ chaturbate có nguồn doanh thu chạy được. Udemy không mở endpoint doanh thu cho
// instructor; Gumroad thì chưa có api_token nên collector bỏ qua từ 2026-04-25; MQL5 /
// RapidAPI / Stripe chưa có collector nào. Nếu quy hết về 0 thì bảng đọc ra "36 sản
// phẩm chỉ 1 cái ra tiền" — một kết luận bịa. Nên `net === null` mang nghĩa CHƯA ĐO,
// và mọi phép chia đều bỏ qua phần chưa đo thay vì coi nó là 0.

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'https://as.on.tc';
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN || '';

export interface ProductRow {
  id: string;
  title: string;
  platform: string;
  sku: string | null;
  status: string | null;
  price: number | null;
  url: string | null;
  /** Thực nhận trong cửa sổ đang xem. null = chưa có nguồn đo, KHÔNG phải 0. */
  net: number | null;
  /** Doanh số gốc khách tiêu, khi nền tảng có chia hoa hồng. null = chưa đo. */
  gross: number | null;
  rating: number | null;
  reviews: number | null;
  /** Học viên/người theo dõi của riêng sản phẩm đó (Udemy: num_subscribers). */
  students: number | null;
  lastSeen: string | null;
}

export interface PlatformRoll {
  platform: string;
  products: number;
  live: number;
  /** null = nền tảng này chưa có nguồn doanh thu nào chạy. */
  net: number | null;
  gross: number | null;
  /** Số sản phẩm thực sự đo được doanh thu RIÊNG (mẫu số của $/sản phẩm). */
  measured: number;
  /**
   * Tiền đo được ở mức TÀI KHOẢN, nền tảng không chia theo sản phẩm.
   * Udemy là vậy: có doanh thu từng ngày cho cả tài khoản, nhưng không cho biết
   * ngày đó khoá nào ra tiền. Ghi riêng để không giả vờ là số của từng sản phẩm.
   */
  platformOnly: boolean;
  perProduct: number | null;
  /** Ngày gần nhất có BẤT KỲ số liệu nào (kể cả chỉ rating) — để thấy dữ liệu ôi. */
  lastStat: string | null;
}

export interface ProductsView {
  rows: ProductRow[];
  platforms: PlatformRoll[];
  windowDays: number;
  errors: string[];
}

async function get<T>(path: string, revalidate = 300): Promise<T[]> {
  if (!DIRECTUS_TOKEN) return [];
  const r = await fetch(`${DIRECTUS_URL}${path}`, {
    headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, next: { revalidate },
  });
  if (!r.ok) return [];
  return ((await r.json()) as { data?: T[] }).data ?? [];
}

const num = (v: unknown) => Number(v) || 0;

export async function getProductsView(windowDays = 30): Promise<ProductsView> {
  const since = new Date(Date.now() - (windowDays - 1) * 86400_000).toISOString().slice(0, 10);
  const errors: string[] = [];

  const [products, stats] = await Promise.all([
    get<Record<string, unknown>>('/items/products?limit=-1&fields=id,title,sku,status,price,platform,url'),
    get<Record<string, unknown>>(
      `/items/product_stats?limit=-1&fields=product_id,date,platform,revenue,gross_revenue,rating,reviews,subscribers&filter[date][_gte]=${since}`),
  ]);
  if (!products.length) errors.push('products: Directus không trả dữ liệu');

  // Gộp theo product. Tiền chỉ cộng từ dòng CÓ SỐ (revenue != null); rating/review/học
  // viên lấy bản mới nhất vì đó là ảnh chụp trạng thái, cộng dồn lại thành số vô nghĩa.
  interface Agg { net: number; gross: number; hasRevenue: boolean; rating: number | null; reviews: number | null; students: number | null; last: string }
  const agg = new Map<string, Agg>();
  // Dòng KHÔNG có product_id = tiền đo ở mức tài khoản (xem PlatformRoll.platformOnly).
  const platformNet = new Map<string, { net: number; last: string }>();
  for (const s of stats) {
    const pid = String(s.product_id ?? '');
    const d = String(s.date ?? '');
    if (!pid) {
      if (s.revenue == null) continue;
      const key = String(s.platform ?? '');
      if (!key) continue;
      const cur = platformNet.get(key) ?? { net: 0, last: '' };
      cur.net += num(s.revenue);
      if (d > cur.last) cur.last = d;
      platformNet.set(key, cur);
      continue;
    }
    const cur = agg.get(pid) ?? { net: 0, gross: 0, hasRevenue: false, rating: null, reviews: null, students: null, last: '' };
    if (s.revenue != null) {
      cur.hasRevenue = true;
      cur.net += num(s.revenue);
      cur.gross += s.gross_revenue != null ? num(s.gross_revenue) : num(s.revenue);
    }
    if (d >= cur.last) {
      cur.last = d;
      if (s.rating != null) cur.rating = num(s.rating);
      if (s.reviews != null) cur.reviews = num(s.reviews);
      if (s.subscribers != null) cur.students = num(s.subscribers);
    }
    agg.set(pid, cur);
  }

  const rows: ProductRow[] = products.map((p) => {
    const a = agg.get(String(p.id));
    return {
      id: String(p.id), title: String(p.title ?? '(không tên)'),
      platform: String(p.platform ?? 'khác'), sku: (p.sku as string) || null,
      status: (p.status as string) ?? null,
      price: p.price == null ? null : num(p.price),
      url: (p.url as string) || null,
      net: a?.hasRevenue ? a.net : null,
      gross: a?.hasRevenue ? a.gross : null,
      rating: a?.rating ?? null, reviews: a?.reviews ?? null, students: a?.students ?? null,
      lastSeen: a?.last || null,
    };
  }).sort((x, y) => (y.net ?? -1) - (x.net ?? -1)
    || x.platform.localeCompare(y.platform) || x.title.localeCompare(y.title));

  const pm = new Map<string, PlatformRoll>();
  for (const r of rows) {
    const cur = pm.get(r.platform) ?? {
      platform: r.platform, products: 0, live: 0, net: null, gross: null,
      measured: 0, platformOnly: false, perProduct: null, lastStat: null,
    };
    cur.products += 1;
    if (r.status === 'published') cur.live += 1;
    if (r.net != null) {
      cur.measured += 1;
      cur.net = (cur.net ?? 0) + r.net;
      cur.gross = (cur.gross ?? 0) + (r.gross ?? 0);
    }
    if (r.lastSeen && r.lastSeen > (cur.lastStat ?? '')) cur.lastStat = r.lastSeen;
    pm.set(r.platform, cur);
  }
  // Cộng nốt tiền đo ở mức tài khoản (dòng không gắn product).
  for (const [key, v] of platformNet) {
    const cur = pm.get(key);
    if (!cur) continue;
    cur.net = (cur.net ?? 0) + v.net;
    if (cur.measured === 0) cur.platformOnly = true;
    if (v.last > (cur.lastStat ?? '')) cur.lastStat = v.last;
  }
  // Chia cho SỐ ĐO ĐƯỢC, không chia cho tổng danh mục — nếu không thì thêm một sản
  // phẩm chưa có collector cũng làm "$/sản phẩm" tụt xuống. Riêng nền tảng chỉ đo được
  // ở mức tài khoản thì mẫu số là cả danh mục, vì tiền đó là của cả tài khoản.
  const platforms = [...pm.values()]
    .map((p) => ({
      ...p,
      perProduct: p.measured ? (p.net ?? 0) / p.measured
        : p.net != null && p.products ? p.net / p.products : null,
    }))
    .sort((a, b) => (b.net ?? -1) - (a.net ?? -1) || b.products - a.products);

  return { rows, platforms, windowDays, errors };
}
