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

// Account replyStyle (free-text vd "2 câu, casual") → chỉ thị. Mềm "bám đúng" KHÔNG đủ (model ra 4
// khi xin 2) → PARSE số câu/từ và ra lệnh CỨNG "CHÍNH XÁC N câu" + siết maxLength theo N (chặn vật lý).
// CHỈ điều khiển bằng PROMPT (KHÔNG clamp/cắt output — clamp số trần từng gây "cụt" khó debug, xem
// gotcha header). Parse "N câu/từ" → ra lệnh CỨNG trong prompt; maxLength để GENEROUS (an toàn runaway,
// KHÔNG để engine truncate). Số câu thực thi bằng chỉ thị "CHÍNH XÁC N câu", model bám là chính.
export function accountStyleDirective(style: string): { directive: string; directiveEn: string; maxLength: number; words: number } {
  const s = (style || '').trim();
  const mSent = s.match(/(\d+)\s*(?:-\s*\d+\s*)?(?:câu|cau|sentences?|sent)\b/i);
  const mWord = s.match(/(\d+)\s*(?:từ|tu|words?)\b/i);
  if (mSent) {
    const n = parseInt(mSent[1] ?? '0', 10);
    return {
      directive: `Viết CHÍNH XÁC ${n} câu TỔNG CỘNG — đã GỒM cả câu CTA/link/mời reply (nếu có). KHÔNG thêm câu thứ ${n + 1}. Đếm lại; nếu quá ${n} thì GỘP, đừng thêm. Phong cách: ${s}.`,
      directiveEn: `Write EXACTLY ${n} sentence${n > 1 ? 's' : ''} TOTAL — this INCLUDES any CTA, link, or invite-to-reply sentence. NEVER add an extra sentence beyond ${n}; if a link is included, fold it into one of the ${n} sentences. Count before answering. Style: "${s}".`,
      maxLength: 1700,   // generous — KHÔNG truncate; số câu do prompt lo
      words: Math.max(1, n * 14),
    };
  }
  if (mWord) {
    const n = parseInt(mWord[1] ?? '0', 10);
    return {
      directive: `~${n} từ (bám sát). Phong cách: ${s}. Không lan man, không cụt.`,
      directiveEn: `~${n} words (stay close). Style: "${s}". No rambling, no abrupt cut.`,
      maxLength: Math.max(900, n * 9),
      words: n,
    };
  }
  return {
    directive: `Theo cấu hình account: ${s}. Bám đúng (vd số câu/độ dài), giữ chất, không lan man.`,
    directiveEn: `Length & format per the account config: "${s}". Follow it exactly (e.g. sentence count). Substance over padding.`,
    maxLength: 1700,
    words: 0,
  };
}

// formatKey (authority) → directive VN + words + maxLength. targetWords chỉ dùng nếu thiếu preset (ext cũ).
export function resolveFormatDirective(formatKey: string | undefined, targetWords?: number, accountStyle?: string): ResolvedFormat {
  // 'account' = theo cấu hình account (persona.replyStyle, free-text vd "2 câu"). Mô tả CHÍNH là chỉ thị.
  if (formatKey === 'account') {
    const style = (accountStyle ?? '').trim();
    if (style) {
      const sd = accountStyleDirective(style);
      return { directive: sd.directive, words: sd.words, maxLength: sd.maxLength, preset: undefined };
    }
    formatKey = 'comment';   // account chưa cấu hình replyStyle → fallback preset reply hợp lý
  }
  const preset = formatKey ? FORMAT_PRESETS_BY_KEY[formatKey] : undefined;
  const words = preset?.words ?? (Number(targetWords) > 0 ? Math.round(Number(targetWords)) : 0);
  const ld = lenDirectiveForWords(words);
  const directive = [preset?.hint, ld && `Độ dài: ${ld}`].filter(Boolean).join(' ');
  const maxLength = preset?.maxLength ?? (words > 0 ? Math.max(300, Math.round(words * 9)) : 2000);
  return { directive, words, maxLength, preset };
}

// Knob humanizer điều khiển ĐỘ DÀI (cắt câu) — control lớp STYLE.
export const LENGTH_CLAMP_KNOBS = ['one-sentence', 'two-three'];

// ⭐ NGUYÊN TẮC ƯU TIÊN CONFIG: càng GẦN bước gen càng thắng.
//   lớp BÀI (format preset / depth / lang — chọn ngay ở reply-bar)
//     >  lớp PLATFORM (habitat voice, brief tone)
//        >  lớp USER (account persona, account humanizer).
// Khi 2 lớp đụng CÙNG 1 chiều, lớp gần gen hơn thắng. Áp cho chiều ĐỘ DÀI: format preset là control độ dài
// chuyên trách (lớp BÀI) → khi có preset (words>0), LOẠI length-knob của humanizer để nó KHÔNG đè độ dài đã
// chọn — dù humanizer đến từ account/habitat/template (lớp xa hơn). Giữ các knob khác (typo/casual…).
export function applyLengthPriority(knobs: string[] | undefined, formatKey?: string, targetWords?: number): string[] {
  const k = Array.isArray(knobs) ? knobs : [];
  const { words } = resolveFormatDirective(formatKey, targetWords);
  const formatControlsLength = words > 0 || formatKey === 'account';   // account = style text điều khiển độ dài
  return formatControlsLength ? k.filter((x) => !LENGTH_CLAMP_KNOBS.includes(x)) : k;
}
