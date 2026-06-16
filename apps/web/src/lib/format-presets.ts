// Content-type presets — gói (KIỂU bài + ĐỘ DÀI) thành 1 lựa chọn. Nguồn DUY NHẤT cho:
//   - astrolas-answer (reply astrology, prompt VN)  → hint VN + max_length
//   - quick-comment   (Gen reply OpenAI, prompt VN)  → hint VN qua customInstruction
//   - ai-post         (bài gốc social, prompt EN)    → hintEn + words→targetWords
// Ext (content.js FORMAT_PRESETS) mirror NHẸ key/label/words/where để render picker + gửi formatKey.
// Server LÀ authority: derive words/hint/max_length từ formatKey (targetWords chỉ fallback ext cũ).
// 2026-06-11 gotcha: số trần đơn lẻ ("60 từ") → engine clamp = cụt; luôn neo bằng mô tả đoạn + "tối thiểu".

export type PresetWhere = 'post' | 'reply' | 'both';

export interface FormatPreset {
  key: string;
  label: string;       // emoji + tên (hiển thị/log)
  words: number;       // ~số từ mục tiêu
  where: PresetWhere;  // picker nào hiện (composer=post · reply-bar=reply · both=cả 2)
  hint: string;        // chỉ thị FORMAT tiếng Việt (Astrolas/quick-comment)
  hintEn: string;      // chỉ thị FORMAT tiếng Anh (ai-post)
  maxLength: number;   // trần char cho Astrolas max_length
}

// words = target_words (đòn bẩy độ dài THẬT — Astrolas Team thêm 2026-06-16; engine ép gen bám ~target).
// maxLength = chỉ còn HARD CAP an toàn (chống runaway) → nới rộng ~words×9 để KHÔNG clip output dài hợp lệ.
export const FORMAT_PRESETS: FormatPreset[] = [
  { key: 'quote', label: '❝ Quote', words: 25, where: 'both', maxLength: 300,
    hint: '1 câu punchy đáng trích dẫn, KHÔNG giải thích thêm.',
    hintEn: 'One punchy, quotable line. No preamble, no explanation.' },
  { key: 'chat', label: '💬 Chat', words: 45, where: 'both', maxLength: 500,
    hint: 'Giọng casual như nhắn tin: 1-2 câu, thân mật, không trang trọng.',
    hintEn: 'Casual like texting: 1-2 short sentences, friendly, not formal.' },
  { key: 'reply', label: '↩ Reply', words: 90, where: 'reply', maxLength: 900,
    hint: '1 đoạn trả lời thẳng vào ý người ta, không lan man.',
    hintEn: 'One paragraph answering directly, no rambling.' },
  { key: 'comment', label: '🗨 Comment', words: 180, where: 'both', maxLength: 1700,
    hint: '2 đoạn: nêu ý kiến rồi đưa lý do/ví dụ cụ thể.',
    hintEn: 'Two paragraphs: state a view, then back it with a concrete reason/example.' },
  { key: 'long', label: '📜 Bài dài', words: 380, where: 'both', maxLength: 3600,
    hint: 'DÀI & CHI TIẾT: chia 3-5 phần có TIÊU ĐỀ ngắn (theo từng chủ đề/placement), mỗi phần 1-2 đoạn đào sâu insight + ví dụ cụ thể. Như một bài đọc đầy đủ. TUYỆT ĐỐI KHÔNG viết cụt vài câu rồi dừng.',
    hintEn: 'LONG & DETAILED: break into 3-5 sections with short headers, each 1-2 paragraphs of real depth + concrete specifics. A full read. Never stop after a few sentences.' },
  { key: 'blog', label: '📰 Bài blog', words: 700, where: 'post', maxLength: 6500,
    hint: 'Bài blog hoàn chỉnh: mở bài hook, thân bài có heading, ví dụ minh hoạ, kết bài + CTA nhẹ.',
    hintEn: 'Full blog post: hook intro, body with section headings, illustrative examples, conclusion + soft CTA.' },
];

export const FORMAT_PRESETS_BY_KEY: Record<string, FormatPreset> =
  Object.fromEntries(FORMAT_PRESETS.map((p) => [p.key, p]));

// Độ dài → chỉ thị neo bằng mô tả ĐOẠN (không nhồi số trần đơn lẻ). Tier dài framing "TỐI THIỂU".
export function lenDirectiveForWords(words: number): string {
  if (!(words > 0)) return '';
  if (words <= 60) return `~${words} từ, cực ngắn gọn.`;
  if (words <= 120) return `~${words} từ, 1 đoạn đi thẳng ý.`;
  if (words <= 250) return `~${words} từ, 1-2 đoạn đủ insight chính.`;
  return `TỐI THIỂU ~${words} từ, viết đầy đủ KHÔNG cụt.`;
}

export interface ResolvedFormat {
  directive: string;          // format hint + length (VN) — chèn vào prompt
  words: number;
  maxLength: number;
  preset?: FormatPreset;
}

// formatKey (authority) → directive VN + words + maxLength. targetWords chỉ dùng nếu thiếu preset (ext cũ).
export function resolveFormatDirective(formatKey: string | undefined, targetWords?: number): ResolvedFormat {
  const preset = formatKey ? FORMAT_PRESETS_BY_KEY[formatKey] : undefined;
  const words = preset?.words ?? (Number(targetWords) > 0 ? Math.round(Number(targetWords)) : 0);
  const ld = lenDirectiveForWords(words);
  const directive = [preset?.hint, ld && `Độ dài: ${ld}`].filter(Boolean).join(' ');
  const maxLength = preset?.maxLength ?? (words > 0 ? Math.max(300, Math.round(words * 9)) : 2000);
  return { directive, words, maxLength, preset };
}
