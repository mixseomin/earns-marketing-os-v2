// Catalog các AI model dùng cho UI picker. Chỉ list models THỰC SỰ có trên
// OpenAI API hiện tại (verified qua GET /v1/models 2026-05). Giá lấy từ
// openai.com/pricing — đơn giá USD per 1M tokens (text) hoặc per image (image).
//
// QUAN TRỌNG: khi OpenAI ra model mới hoặc thay giá, sửa ở đây — KHÔNG
// hardcode trong action. UI render dropdown + backend whitelist input.

export interface ModelOption {
  /** Model id để gọi OpenAI API (verified available 2026-05). */
  id: string;
  /** Label hiển thị ngắn ("o4-mini", "GPT-4.1"). */
  label: string;
  /** Mô tả 1 dòng — speed/quality/use-case. */
  hint: string;
  /** Cost class cho badge $/$$/$$$. */
  cost: 'cheap' | 'mid' | 'premium';
  /** Reasoning model = có thinking phase (o-series, gpt-5 thinking). */
  reasoning?: boolean;
  /** Giá USD per 1M input tokens (text models only). */
  inPrice?: number;
  /** Giá USD per 1M output tokens (text models only). */
  outPrice?: number;
  /** Giá USD per image (image models only). */
  imagePrice?: number;
  /** Ngày catalog (để biết khi nào pricing được verify lần cuối). */
  pricedAt: string;
}

// TEXT models — verified 2026-05-26 via OpenAI /v1/models.
// Pricing: openai.com/api/pricing (cached 2026-05-26). Sort theo giá tăng dần.
//
// Lưu ý:
// - o1-pro / gpt-5-pro: chỉ qua Responses API (chưa support chat.completions),
//   KHÔNG list ở đây để tránh runtime error.
// - gpt-5.2/5.3: mới ra Q4 2025 / Q4 2026.
// - gpt-5-codex: code-specific, không phù hợp marketing copy.
export const TEXT_MODELS: ModelOption[] = [
  { id: 'gpt-4.1-nano',  label: 'GPT-4.1 nano',  hint: 'Rẻ nhất. Draft đơn giản, batch volume.',           cost: 'cheap',   inPrice: 0.10, outPrice: 0.40,  pricedAt: '2026-05-26' },
  { id: 'gpt-5-nano',    label: 'GPT-5 nano',    hint: 'GPT-5 family rẻ nhất. Nhanh + chất tốt hơn 4.1.',   cost: 'cheap',   inPrice: 0.05, outPrice: 0.40,  pricedAt: '2026-05-26' },
  { id: 'gpt-4o-mini',   label: 'GPT-4o mini',   hint: 'Cũ nhưng quen. Stable, doc nhiều.',                cost: 'cheap',   inPrice: 0.15, outPrice: 0.60,  pricedAt: '2026-05-26' },
  { id: 'gpt-4.1-mini',  label: 'GPT-4.1 mini',  hint: 'Cân bằng giá/chất. Hơn 4o-mini.',                  cost: 'cheap',   inPrice: 0.40, outPrice: 1.60,  pricedAt: '2026-05-26' },
  { id: 'o4-mini',       label: 'o4-mini',       hint: 'Reasoning rẻ thế hệ mới. DEFAULT cho draft.',      cost: 'mid',     inPrice: 1.10, outPrice: 4.40,  pricedAt: '2026-05-26', reasoning: true },
  { id: 'gpt-5-mini',    label: 'GPT-5 mini',    hint: 'GPT-5 mid-tier. Thay o3-mini cho task khó.',       cost: 'mid',     inPrice: 0.25, outPrice: 2.00,  pricedAt: '2026-05-26', reasoning: true },
  { id: 'o3-mini',       label: 'o3-mini',       hint: 'Reasoning generation cũ, vẫn dùng được.',          cost: 'mid',     inPrice: 1.10, outPrice: 4.40,  pricedAt: '2026-05-26', reasoning: true },
  { id: 'gpt-4o',        label: 'GPT-4o',        hint: 'Multimodal classic. Quality > speed.',             cost: 'mid',     inPrice: 2.50, outPrice: 10.00, pricedAt: '2026-05-26' },
  { id: 'gpt-4.1',       label: 'GPT-4.1',       hint: 'Flagship cũ. Long context (1M tokens).',           cost: 'premium', inPrice: 2.00, outPrice: 8.00,  pricedAt: '2026-05-26' },
  { id: 'gpt-5',         label: 'GPT-5',         hint: 'Frontier general. Đắt nhưng chất nhất.',           cost: 'premium', inPrice: 1.25, outPrice: 10.00, pricedAt: '2026-05-26' },
  { id: 'gpt-5.1',       label: 'GPT-5.1',       hint: 'Bản refresh GPT-5 (2025-11). Nhanh hơn.',          cost: 'premium', inPrice: 1.25, outPrice: 10.00, pricedAt: '2026-05-26' },
  { id: 'o3',            label: 'o3',            hint: 'Reasoning premium. Bài critical/long-form.',       cost: 'premium', inPrice: 2.00, outPrice: 8.00,  pricedAt: '2026-05-26', reasoning: true },
];

// IMAGE models — verified 2026-05-26. gpt-image-2 (flagship 2026-04),
// gpt-image-1.5, gpt-image-1-mini. Giá theo tier quality.
export const IMAGE_MODELS: ModelOption[] = [
  { id: 'gpt-image-1-mini',     label: 'gpt-image-1 mini',     hint: 'Rẻ nhất. Test/draft, không hero.',         cost: 'cheap',   imagePrice: 0.007, pricedAt: '2026-05-26' },
  { id: 'gpt-image-2-low',      label: 'gpt-image-2 (low)',    hint: 'Flagship 2026-04, quality low. Draft.',    cost: 'cheap',   imagePrice: 0.011, pricedAt: '2026-05-26' },
  { id: 'gpt-image-1.5-medium', label: 'gpt-image-1.5',        hint: 'Generation trung, medium quality.',        cost: 'mid',     imagePrice: 0.030, pricedAt: '2026-05-26' },
  { id: 'gpt-image-2-medium',   label: 'gpt-image-2 (medium)', hint: 'DEFAULT. Cân bằng chất/giá.',              cost: 'mid',     imagePrice: 0.053, pricedAt: '2026-05-26' },
  { id: 'gpt-image-2-high',     label: 'gpt-image-2 (high)',   hint: 'Hero/cover. Detail cao.',                  cost: 'premium', imagePrice: 0.167, pricedAt: '2026-05-26' },
];

const TEXT_IDS = new Set(TEXT_MODELS.map((m) => m.id));
const IMAGE_IDS = new Set(IMAGE_MODELS.map((m) => m.id));

export function isValidTextModel(id: string): boolean {
  return TEXT_IDS.has(id);
}
export function isValidImageModel(id: string): boolean {
  return IMAGE_IDS.has(id);
}

/** Cost badge text — $/$$/$$$ */
export function costBadge(cost: ModelOption['cost']): string {
  return cost === 'cheap' ? '$' : cost === 'mid' ? '$$' : '$$$';
}

/** Format giá per 1K tokens (text) hoặc per image — đọc gọn trong UI.
 *  Vd: text in=$1.10/M out=$4.40/M → "$1.10 / $4.40 (per 1M)"
 *      image $0.053/img → "$0.053/img" */
export function formatPrice(m: ModelOption): string {
  if (m.imagePrice != null) return `$${m.imagePrice.toFixed(3)}/ảnh`;
  if (m.inPrice != null && m.outPrice != null) {
    return `$${m.inPrice.toFixed(2)}↓ / $${m.outPrice.toFixed(2)}↑ /M`;
  }
  return '?';
}

/** Tooltip text đầy đủ cho 1 model — label + hint + giá + ngày verify. */
export function modelTooltip(m: ModelOption): string {
  const parts: string[] = [m.label];
  if (m.reasoning) parts.push('🧠 reasoning');
  parts.push(`(${costBadge(m.cost)})`);
  let out = parts.join(' ') + '\n' + m.hint + '\n💰 ' + formatPrice(m);
  if (m.inPrice != null) out += '\n   Input: $' + m.inPrice + '/M tokens';
  if (m.outPrice != null) out += '\n   Output: $' + m.outPrice + '/M tokens';
  out += `\n📅 Giá cập nhật: ${m.pricedAt}`;
  return out;
}
