// Catalog các AI model dùng cho UI picker. Format: id + label + cost hint +
// suitable kind (text vs image). Centralize để UI render dropdown ngắn gọn +
// backend whitelist input (tránh user paste arbitrary model id).

export interface ModelOption {
  /** Model id để gọi OpenAI API. */
  id: string;
  /** Label hiển thị ngắn ("o3-mini", "GPT-4o"). */
  label: string;
  /** Mô tả 1 dòng: speed + quality + cost tradeoff. */
  hint: string;
  /** Cost class: cheap < mid < premium. Hiện badge $/$$/$$$. */
  cost: 'cheap' | 'mid' | 'premium';
  /** Reasoning model = có thinking phase (o-series). */
  reasoning?: boolean;
}

// TEXT models — sinh draft post / brief suggestion / critique.
// 2026-05 catalog: o3-mini (cheap reasoning), gpt-4o-mini (fast cheap),
// gpt-4o (mid), o3 (premium reasoning), gpt-5 (premium frontier).
export const TEXT_MODELS: ModelOption[] = [
  { id: 'gpt-4o-mini', label: 'GPT-4o mini', hint: 'Nhanh nhất, rẻ nhất. OK cho draft đơn giản.', cost: 'cheap' },
  { id: 'o3-mini',     label: 'o3-mini',     hint: 'Reasoning rẻ. Cân bằng — default cho draft.', cost: 'cheap', reasoning: true },
  { id: 'gpt-4o',      label: 'GPT-4o',      hint: 'Chất lượng tốt hơn 4o-mini. Quality > speed.', cost: 'mid' },
  { id: 'o3',          label: 'o3',          hint: 'Reasoning premium. Bài critical/long-form.', cost: 'premium', reasoning: true },
  { id: 'gpt-5',       label: 'GPT-5',       hint: 'Frontier. Khi muốn output đỉnh nhất.', cost: 'premium' },
];

// IMAGE models — sinh ảnh kèm bài. gpt-image-2 (mới nhất, 2026-04, quality=medium ~$0.05/img),
// gpt-image-1 (older, deprecated dần), flux (fallback ultra-cheap external).
export const IMAGE_MODELS: ModelOption[] = [
  { id: 'gpt-image-2-medium', label: 'gpt-image-2 (medium)', hint: 'Mới nhất 2026-04. Quality medium ~$0.053/img.', cost: 'mid' },
  { id: 'gpt-image-2-low',    label: 'gpt-image-2 (low)',    hint: 'Same model, low quality ~$0.011/img. Test/draft.', cost: 'cheap' },
  { id: 'gpt-image-2-high',   label: 'gpt-image-2 (high)',   hint: 'High quality ~$0.167/img. Hero/cover.', cost: 'premium' },
  { id: 'flux-schnell',       label: 'FLUX Schnell',         hint: 'Ultra cheap external (~$0.003/img). Backup.', cost: 'cheap' },
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
