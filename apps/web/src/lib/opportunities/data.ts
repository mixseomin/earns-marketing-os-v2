// Nguồn cho /opportunities — "đặt sản phẩm tiếp theo ở đâu".
//
// HAI tầng dữ liệu, KHÁC hẳn nhau về độ tin, nên UI cũng phải xếp khác nhau:
//   • market_benchmarks — đo THỊ TRƯỜNG thật, có nguồn + ngày đo. Đây là thứ ra quyết định.
//   • idea_analysis     — 104 ý tưởng phân tích từ trước, CŨ và CHƯA kiểm chứng.
//     Giữ lại để tham khảo nhưng KHÔNG ưu tiên (user 2026-08-06), page xếp xuống dưới + gập.

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'https://as.on.tc';
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN || '';

export interface MarketBenchmark {
  id: number;
  platform: string;
  category: string;
  windowDays: number;
  newProducts: number;
  newSales: number;
  newRevenue: number;
  totalProducts: number;
  allTimeSales: number;
  allTimeRevenue: number;
  sourceUrl: string | null;
  capturedAt: string | null;
  notes: string | null;
  /** Doanh thu 1 sản phẩm MỚI kiếm được trong cửa sổ — con số xếp hạng. */
  perNewProduct: number;
  /** Giá trung bình thực tế của đơn hàng sản phẩm mới. */
  avgPrice: number;
}

export interface IdeaAnalysis {
  id: number;
  title: string;
  category: string | null;
  status: string | null;
  verdict: string | null;
  score: number | null;
  summary: string | null;
  painPoint: string | null;
  marketSize: string | null;
  targetAudience: string | null;
  audienceSize: string | null;
  saturation: string | null;
  competitorsCount: string | null;
  competitiveGap: string | null;
  topCompetitors: string[];
  pricePoint: string | null;
  revenueModel: string | null;
  revenuePotential: string | null;
  timeToRevenue: string | null;
  buildDifficulty: string | null;
  buildTime: string | null;
  monthlyCost: number | null;
  legalRisk: string | null;
  marketDependency: string | null;
  marketingEffort: string | null;
  /** 0-10: dùng lại được bao nhiêu tài sản đã có. Càng cao càng nhanh ra sản phẩm. */
  infraReuse: number | null;
  /** Nguồn đã đối chiếu. Có nguồn = phân tích kiểm được, khác hẳn ý tưởng chép tay. */
  dataSources: string[];
  pros: string[];
  cons: string[];
  notes: string | null;
  userRating: number | null;
  userNote: string | null;
  dashboardUrl: string | null;
  createdAt: string | null;
  lastReviewedAt: string | null;
  /** Bao nhiêu ngày kể từ lần đánh giá cuối (hoặc lúc tạo) — dùng để nói thẳng là số đã cũ. */
  ageDays: number | null;
}

async function directus<T>(path: string, revalidate = 300): Promise<T[]> {
  if (!DIRECTUS_TOKEN) return [];
  const res = await fetch(`${DIRECTUS_URL}${path}`, {
    headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
    next: { revalidate },
  });
  if (!res.ok) return [];
  const j = (await res.json()) as { data?: T[] };
  return j.data ?? [];
}

const num = (v: unknown) => Number(v) || 0;
const arr = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(String) : typeof v === 'string' && v.trim().startsWith('[')
    ? (() => { try { return (JSON.parse(v) as unknown[]).map(String); } catch { return []; } })() : [];

export async function listMarketBenchmarks(): Promise<MarketBenchmark[]> {
  const rows = await directus<Record<string, unknown>>('/items/market_benchmarks?limit=-1&sort=-new_revenue');
  return rows.map((r) => {
    const newProducts = num(r.new_products);
    const newSales = num(r.new_sales);
    const newRevenue = num(r.new_revenue);
    return {
      id: num(r.id), platform: String(r.platform ?? ''), category: String(r.category ?? ''),
      windowDays: num(r.window_days) || 30,
      newProducts, newSales, newRevenue,
      totalProducts: num(r.total_products), allTimeSales: num(r.all_time_sales), allTimeRevenue: num(r.all_time_revenue),
      sourceUrl: (r.source_url as string) ?? null, capturedAt: (r.captured_at as string) ?? null,
      notes: (r.notes as string) ?? null,
      perNewProduct: newProducts ? newRevenue / newProducts : 0,
      avgPrice: newSales ? newRevenue / newSales : 0,
    };
  }).sort((a, b) => b.perNewProduct - a.perNewProduct);
}

export async function listIdeaAnalyses(): Promise<IdeaAnalysis[]> {
  const fields = [
    'id', 'title', 'category', 'status', 'verdict', 'score', 'summary', 'pain_point', 'market_size',
    'target_audience', 'audience_size', 'saturation', 'competitors_count', 'competitive_gap',
    'top_competitors', 'price_point', 'revenue_model', 'revenue_potential', 'time_to_revenue',
    'build_difficulty', 'build_time', 'monthly_cost', 'legal_risk', 'market_dependency',
    'marketing_effort', 'infra_reuse', 'data_sources',
    'pros', 'cons', 'notes', 'user_rating', 'user_note', 'dashboard_url', 'created_at', 'last_reviewed_at',
  ].join(',');
  const rows = await directus<Record<string, unknown>>(`/items/idea_analysis?limit=-1&fields=${fields}&sort=-score,-id`, 600);
  const now = Date.now();
  return rows.map((r) => {
    const stamp = (r.last_reviewed_at as string) || (r.created_at as string) || null;
    return {
      id: num(r.id), title: String(r.title ?? '(không tên)'),
      category: (r.category as string) ?? null, status: (r.status as string) ?? null,
      verdict: (r.verdict as string) ?? null, score: r.score == null ? null : num(r.score),
      summary: (r.summary as string) ?? null, painPoint: (r.pain_point as string) ?? null,
      marketSize: (r.market_size as string) ?? null, targetAudience: (r.target_audience as string) ?? null,
      audienceSize: (r.audience_size as string) ?? null, saturation: (r.saturation as string) ?? null,
      competitorsCount: (r.competitors_count as string) ?? null, competitiveGap: (r.competitive_gap as string) ?? null,
      topCompetitors: arr(r.top_competitors),
      pricePoint: (r.price_point as string) ?? null, revenueModel: (r.revenue_model as string) ?? null,
      revenuePotential: (r.revenue_potential as string) ?? null, timeToRevenue: (r.time_to_revenue as string) ?? null,
      buildDifficulty: (r.build_difficulty as string) ?? null, buildTime: (r.build_time as string) ?? null,
      monthlyCost: r.monthly_cost == null ? null : num(r.monthly_cost),
      legalRisk: (r.legal_risk as string) ?? null,
      marketDependency: (r.market_dependency as string) ?? null,
      marketingEffort: (r.marketing_effort as string) ?? null,
      infraReuse: r.infra_reuse == null ? null : num(r.infra_reuse),
      dataSources: arr(r.data_sources),
      pros: arr(r.pros), cons: arr(r.cons), notes: (r.notes as string) ?? null,
      userRating: r.user_rating == null ? null : num(r.user_rating), userNote: (r.user_note as string) ?? null,
      dashboardUrl: (r.dashboard_url as string) ?? null,
      createdAt: (r.created_at as string) ?? null, lastReviewedAt: (r.last_reviewed_at as string) ?? null,
      ageDays: stamp ? Math.floor((now - Date.parse(stamp)) / 86400_000) : null,
    };
  });
}
