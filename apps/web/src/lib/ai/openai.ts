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

export const aiEnabled = (): boolean => Boolean(process.env.OPENAI_API_KEY);
