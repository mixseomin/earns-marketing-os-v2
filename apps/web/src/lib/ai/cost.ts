// Ước tính chi phí gen (USD) từ usage + bảng giá /1M token (in/out). Giá ~2025, ƯỚC LƯỢNG.
// Tách khỏi post-draft.ts ('use server' → mọi export phải async) để dùng chung ở route thường.
// Longest-match prefix (gpt-4.1-mini thắng gpt-4.1) để model có suffix ngày (…-2025-04-14) vẫn đúng.
export const MODEL_PRICE: Record<string, [number, number]> = {
  'gpt-4.1': [2, 8], 'gpt-4.1-mini': [0.4, 1.6], 'gpt-4.1-nano': [0.1, 0.4],
  'gpt-4o': [2.5, 10], 'gpt-4o-mini': [0.15, 0.6], 'o3-mini': [1.1, 4.4], 'o1-mini': [1.1, 4.4],
};

export function estimateCostUsd(model: string, usage?: { prompt_tokens?: number; completion_tokens?: number } | null): number | null {
  if (!usage) return null;
  const key = Object.keys(MODEL_PRICE).filter((k) => model.startsWith(k)).sort((a, b) => b.length - a.length)[0] || 'gpt-4.1-mini';
  const [pin, pout] = MODEL_PRICE[key]!;
  return Number((((usage.prompt_tokens ?? 0) * pin + (usage.completion_tokens ?? 0) * pout) / 1_000_000).toFixed(6));
}
