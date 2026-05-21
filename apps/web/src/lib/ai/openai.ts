// OpenAI client wrapper. Singleton — reuses connection across server actions.
// Default model from env (gpt-4o-mini cho cost efficiency).

import OpenAI from 'openai';

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

export const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// Reasoning model cho task multi-step thinking (sinh post draft, critique).
// o3-mini: reasoning model giá rẻ hơn o1 nhưng vẫn có thinking phase.
// Override qua env OPENAI_REASONING_MODEL nếu muốn dùng gpt-4o / o1 / o3.
export const REASONING_MODEL = process.env.OPENAI_REASONING_MODEL || 'o3-mini';

export const aiEnabled = (): boolean => Boolean(process.env.OPENAI_API_KEY);
