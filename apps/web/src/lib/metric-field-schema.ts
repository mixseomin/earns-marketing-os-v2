// Metric field schema — engagement numbers ext scrape từ DOM của 1 post/comment
// ĐÃ ĐĂNG (views / score / replies / shares).
//
// KHÁC viewer.* / brief.* / habitat fields ở chỗ: đây là METRIC (số), shape
// resolve riêng trong ext (`MOS2.sel.metrics()` cascade DB-train('metrics') →
// platform METRIC[] → engine). Engine ext đã chừa cửa `_dbResolver(pk,'metrics')`
// nhưng pipeline nuôi nó (train + resolve) là phần này.
//
// LƯU Ý quan trọng — vì sao có schema này:
//   Reddit/forum KHÔNG trả views/score qua API → phải đọc SỐ trên DOM. Element
//   số đó cần 1 selector + `via` (cách đọc số). selector_overrides lưu được, ext
//   metrics() đọc được, NHƯNG chưa field nào khai → giờ khai ở đây.
//
// Write path = POST /api/ext/selectors/set (verbatim, GIỮ dấu chấm — KHÁC
// save-selector/canonField vốn biến '.' → '_'). field_name dạng 'metric.views'
// đúng convention dot như post.author/composer.editor. spec thêm `via`.
//
// Resolve: GET /api/ext/selectors/resolve?pageKind=post-metrics → ext gom mọi
// 'metric.*' → metric candidate { metric, via, q, attr } cho metrics().

/** page_kind dành riêng cho metric tracking selectors. */
export const METRIC_PAGE_KIND = 'post-metrics';

/** Cách ext đọc SỐ ra khỏi element (khớp branch trong MOS2.sel.metrics()). */
export type MetricVia = 'text' | 'attr' | 'count' | 'depthCount' | 'aria';

/** Tên metric canonical trong card insights + ext output. */
export type MetricKey = 'views' | 'score' | 'replyCount' | 'shareCount';

export interface MetricFieldEntry {
  /** field_name lưu trong selector_overrides (verbatim, có dot). */
  field: string;
  /** metric canonical ext trả về (key trong { views, score, replyCount, shareCount }). */
  metric: MetricKey;
  /** Nhãn UI (kèm icon trực quan). */
  label: string;
  /** Mô tả tiếng Việt — tooltip studio + LLM hint. */
  hint: string;
  /** Cách đọc số mặc định khi train (user/studio có thể đổi). */
  defaultVia: MetricVia;
  /** Card.insights_* column tương ứng (để link matrix ↔ node Card). */
  insightsCol: string;
}

// Thêm metric mới = thêm 1 entry vào đây → tự hiện trong studio matrix + ext
// panel (ext map field→metric qua METRIC_OF_FIELD).
const POST_METRIC_FIELDS: MetricFieldEntry[] = [
    {
      field: 'metric.views',
      metric: 'views',
      label: '👁 Views',
      hint: 'Số lượt xem của 1 post/comment đã đăng (vd "29", "2.3K views"). Reddit/forum KHÔNG có API views → phải đọc số trên DOM. Ưu tiên via=attr trên element số gốc (faceplate-number number="29") để tránh sai khi số rút gọn "2.3K".',
      defaultVia: 'text',
      insightsCol: 'insights_views_count',
    },
    {
      field: 'metric.score',
      metric: 'score',
      label: '↑ Score / Likes',
      hint: 'Điểm số / upvote / like của 1 post (số ròng). Reddit shreddit: attr "score". X: trong aria-label. Forum: reactionCount. via=attr nếu số nằm trong attribute, else via=text.',
      defaultVia: 'text',
      insightsCol: 'insights_score',
    },
    {
      field: 'metric.replies',
      metric: 'replyCount',
      label: '💬 Replies',
      hint: 'Số reply/comment trực tiếp dưới post của mình. via=count (đếm element reply khớp selector) hoặc via=text (đọc số "12 comments"). Lưu ý: ext đã có fallback CẤU TRÚC đếm reply free nên field này chỉ cần khi muốn số chính xác hơn.',
      defaultVia: 'count',
      insightsCol: 'insights_reply_count',
    },
    {
      field: 'metric.shares',
      metric: 'shareCount',
      label: '↗ Shares',
      hint: 'Số share / repost / retweet của 1 post. X: trong aria-label. via=text thường đủ.',
      defaultVia: 'text',
      insightsCol: 'insights_engagements',
    },
];

// Keyed theo page_kind cho đồng bộ shape với các field-schema khác.
export const METRIC_FIELD_SCHEMAS: Record<string, MetricFieldEntry[]> = {
  [METRIC_PAGE_KIND]: POST_METRIC_FIELDS,
};

/** field_name (verbatim 'metric.views' HOẶC canon 'metric_views') → entry. */
export function parseMetricFieldName(name: string): MetricFieldEntry | null {
  if (!name) return null;
  const norm = name.trim().toLowerCase().replace(/[._]/g, '.');
  for (const e of POST_METRIC_FIELDS) {
    if (e.field.toLowerCase().replace(/[._]/g, '.') === norm) return e;
  }
  return null;
}

export function isMetricField(name: string): boolean {
  return parseMetricFieldName(name) != null;
}

export function getMetricFieldSchema(): MetricFieldEntry[] {
  return POST_METRIC_FIELDS;
}

/** field_name → metric canonical (cho ext build candidate). */
export const METRIC_OF_FIELD: Record<string, MetricKey> = Object.fromEntries(
  POST_METRIC_FIELDS.map((e) => [e.field, e.metric]),
);
