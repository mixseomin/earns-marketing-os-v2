// Danh mục SẢN PHẨM (32 cái, 8 nền tảng) + số liệu thật của từng cái.
//
// Trước đây không có chỗ nào nhìn được toàn bộ hàng mình bán: /revenue chỉ có Gumroad
// và AdSense, còn Udemy/MQL5/RapidAPI thì nằm im trong Directus. Trang này gộp:
//   products          — danh mục (Directus)
//   product_stats     — số liệu theo ngày (doanh thu THỰC NHẬN, rating, review…)
//   market_benchmarks — người mới vào ngành đó kiếm bao nhiêu → để nói sản phẩm này
//                       đang nằm ở chỗ đáng hay không, chứ không chỉ liệt kê.

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
  /** Thực nhận trong cửa sổ đang xem (product_stats.revenue = net). */
  net: number;
  /** Doanh số gốc khách tiêu, khi platform có chia hoa hồng. */
  gross: number;
  rating: number | null;
  reviews: number | null;
  lastSeen: string | null;
}

export interface PlatformRoll {
  platform: string;
  products: number;
  live: number;
  net: number;
  gross: number;
  /** Thực nhận trung bình mỗi sản phẩm — con số xếp hạng nền tảng. */
  perProduct: number;
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
      `/items/product_stats?limit=-1&fields=product_id,date,platform,revenue,gross_revenue,rating,reviews&filter[date][_gte]=${since}`),
  ]);
  if (!products.length) errors.push('products: Directus không trả dữ liệu');

  // Gộp theo product: cộng tiền, còn rating/review lấy bản MỚI NHẤT (đó là ảnh chụp
  // trạng thái, cộng dồn lại thành số vô nghĩa).
  const agg = new Map<string, { net: number; gross: number; rating: number | null; reviews: number | null; last: string }>();
  for (const s of stats) {
    const pid = String(s.product_id ?? '');
    if (!pid) continue;
    const cur = agg.get(pid) ?? { net: 0, gross: 0, rating: null, reviews: null, last: '' };
    cur.net += num(s.revenue);
    cur.gross += num(s.gross_revenue) || num(s.revenue);
    const d = String(s.date ?? '');
    if (d >= cur.last) {
      cur.last = d;
      if (s.rating != null) cur.rating = num(s.rating);
      if (s.reviews != null) cur.reviews = num(s.reviews);
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
      net: a?.net ?? 0, gross: a?.gross ?? 0,
      rating: a?.rating ?? null, reviews: a?.reviews ?? null,
      lastSeen: a?.last || null,
    };
  }).sort((x, y) => y.net - x.net || x.platform.localeCompare(y.platform) || x.title.localeCompare(y.title));

  const pm = new Map<string, PlatformRoll>();
  for (const r of rows) {
    const cur = pm.get(r.platform) ?? { platform: r.platform, products: 0, live: 0, net: 0, gross: 0, perProduct: 0 };
    cur.products += 1;
    if (r.status === 'published') cur.live += 1;
    cur.net += r.net; cur.gross += r.gross;
    pm.set(r.platform, cur);
  }
  const platforms = [...pm.values()].map((p) => ({ ...p, perProduct: p.products ? p.net / p.products : 0 }))
    .sort((a, b) => b.net - a.net);

  return { rows, platforms, windowDays, errors };
}
