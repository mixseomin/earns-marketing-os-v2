// MỘT CỔNG AI (anh 16/11/2026: "1 nguồn dùng API duy nhất cho mọi model"): getOpenAI() trả VỎ cùng bề mặt SDK OpenAI (@mos2/cong-ai › voOpenAI) —
// mọi chat.completions.create thường của app đi cổng AI chung spy (donk → ckey → fal, không chính hãng), không sửa từng nơi gọi.
// Lượt có tools / stream, images.generate, embeddings: cổng chưa có → vỏ chuyển cho khách SDK gốc (cần OPENAI_API_KEY) tới khi cổng thêm.
// Default model from env (gpt-4o-mini cho cost efficiency).

import OpenAI from 'openai';
import { voOpenAI } from '@mos2/cong-ai';

let client: OpenAI | null = null;

/** khách SDK gốc — CHỈ cho phần cổng AI chung chưa có (tools / stream / images / embeddings); chat thường đi cổng qua getOpenAI() */
function khachGoc(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

let vo: OpenAI | null = null;
export function getOpenAI(): OpenAI {
  if (!vo) vo = voOpenAI(khachGoc(), process.env.CONG_AI_VIEC || 'etp2') as OpenAI;
  return vo;
}

export const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// Reasoning model cho task multi-step thinking (sinh post draft, critique).
// o3-mini: reasoning model giá rẻ hơn o1 nhưng vẫn có thinking phase.
// Override qua env OPENAI_REASONING_MODEL nếu muốn dùng gpt-4o / o1 / o3.
export const REASONING_MODEL = process.env.OPENAI_REASONING_MODEL || 'o3-mini';

export const aiEnabled = (): boolean => true;   // chat qua cổng AI chung luôn có (16/11/2026)
