import { getDb, aiUsage } from '@mos2/db';

// Ghi 1 dòng usage mỗi lần gọi LLM. FIRE-AND-FORGET — không await, không throw, không chặn response.
// feature = nhãn tính năng ('profile-fill', 'project-brand', 'ai-post'…). usage = res.usage của OpenAI.
export function logAiUsage(
  feature: string,
  model: string,
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null,
  projectId?: string | null,
): void {
  try {
    const db = getDb();
    if (!db || !usage) return;
    void db
      .insert(aiUsage)
      .values({
        feature,
        model,
        promptTokens: usage.prompt_tokens ?? 0,
        completionTokens: usage.completion_tokens ?? 0,
        projectId: projectId ?? null,
      })
      .then(() => {}, () => {});
  } catch {
    /* never block the caller */
  }
}
