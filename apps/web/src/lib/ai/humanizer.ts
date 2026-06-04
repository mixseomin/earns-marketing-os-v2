// Human authenticity layer — biến output AI thành "giống người thật đăng".
// Bộ knob bật/tắt (chip ở ext composer) → 1 block prompt inject vào buildDraftPrompt
// (và append best-effort cho astrolas-answer). CHỈ áp cho bodyTarget (bản đăng thật);
// bodyReview (tiếng Việt review) luôn giữ CHUẨN. Viết tắt theo NGÔN NGỮ community
// (targetLang), không phải tiếng Việt. Tôn trọng human-voice skill (KHÔNG em dash).

export type HumanizerIntensity = 'light' | 'medium' | 'heavy';

export interface HumanizerOpts {
  knobs: string[];               // các key đang bật (xem HUMANIZER_KEYS)
  intensity?: HumanizerIntensity;
}

// Key canonical — ext gửi đúng các key này. Label để UI ext tự render (ext hardcode).
export const HUMANIZER_KEYS = [
  'one-sentence', 'two-three', 'spoken', 'typos', 'abbrev', 'lowercase',
  'no-end-punct', 'humor', 'filler', 'reaction-first', 'mundane', 'emoji',
] as const;
export type HumanizerKey = typeof HUMANIZER_KEYS[number];

// Viết tắt casual phổ biến theo ngôn ngữ community (KHÁC tribe lexicon = jargon riêng).
// Fallback 'en'. Mở rộng dần khi thêm community ngôn ngữ mới.
const ABBREV_PACKS: Record<string, string[]> = {
  en: ['idk', 'tbh', 'ngl', 'imo', 'rn', 'lol', 'fwiw', 'iirc', 'smh', 'btw'],
  vi: ['ko', 'dc', 'đc', 'vs', 'mn', 'j', 'bt', 'cx', 'vl', 'thg'],
  es: ['xq', 'tb', 'pq', 'q', 'tmb', 'dnd', 'xfa'],
  pt: ['pq', 'vc', 'tbm', 'blz', 'mds', 'kkk'],
  fr: ['jsp', 'tkt', 'mdr', 'ptdr', 'bcp', 'dsl'],
  de: ['kp', 'vllt', 'eig', 'wmgl', 'lg'],
};
function abbrevPack(targetLang: string): string[] {
  const k = (targetLang || 'en').slice(0, 2).toLowerCase();
  return ABBREV_PACKS[k] ?? ABBREV_PACKS.en ?? [];
}

function typoCount(intensity: HumanizerIntensity): string {
  return intensity === 'light' ? '1-2' : intensity === 'heavy' ? '3-4' : '2-3';
}
function abbrevCount(intensity: HumanizerIntensity): string {
  return intensity === 'light' ? '2-3' : intensity === 'heavy' ? '4-5' : '3-4';
}

// Mỗi knob → 1 dòng chỉ thị. targetLang/intensity cho các knob cần.
function knobLine(key: string, targetLang: string, intensity: HumanizerIntensity): string | null {
  switch (key) {
    case 'one-sentence':
      return '- ĐỘ DÀI: viết ĐÚNG 1 câu. Không xuống dòng, không liệt kê.';
    case 'two-three':
      return '- ĐỘ DÀI: giữ 2-3 câu ngắn, không hơn.';
    case 'spoken':
      return '- VĂN NÓI (không phải văn viết): dùng contraction, rút chủ ngữ ("watching this rn"), câu cụt, bắt đầu bằng "and/but/so" cũng được. Như gõ vội trên điện thoại.';
    case 'typos':
      return `- TYPO: cố ý để ${typoCount(intensity)} lỗi gõ NHẸ vẫn đọc hiểu được (vd thiếu/đảo chữ "teh", "adn", thiếu 1 ký tự, double space). TUYỆT ĐỐI không đặt typo trong link, @handle, con số, hay tên riêng.`;
    case 'abbrev': {
      const pack = abbrevPack(targetLang);
      return `- VIẾT TẮT BẢN ĐỊA: chèn TỰ NHIÊN ${abbrevCount(intensity)} viết tắt theo ngôn ngữ community (vd: ${pack.join(', ')}). Đặt đúng chỗ người bản xứ hay dùng, không nhồi.`;
    }
    case 'lowercase':
      return '- LOWERCASE: viết thường toàn bộ, KHÔNG viết hoa đầu câu (trừ "I" trong tiếng Anh nếu thấy tự nhiên). Tell casual của Reddit/Discord.';
    case 'no-end-punct':
      return '- DẤU CÂU: bỏ dấu chấm ở câu cuối; có thể dùng "..." lửng hoặc "?!" thay cho dấu chuẩn.';
    case 'humor':
      return '- HÀI: thêm 1 nhịp đùa nhẹ / self-deprecating / dry sarcasm phù hợp ngữ cảnh. Không gượng, không pun rẻ tiền.';
    case 'filler':
      return '- FILLER/HEDGE: rải softener tự nhiên ("i guess", "kinda", "lowkey", "ngl", "or smth") như người thật do dự.';
    case 'reaction-first':
      return '- PHẢN ỨNG TRƯỚC: mở bằng phản ứng cảm xúc ngắn rồi mới vào nội dung ("oh man this is so real", "wait that\'s wild").';
    case 'mundane':
      return '- CHI TIẾT VU VƠ: cài 1 chi tiết đời thường + số lẻ KHÔNG tròn ("like 6-7 weeks", "on my 3rd coffee") để tăng độ thật.';
    case 'emoji':
      return '- EMOJI: tối đa 1 reaction emoji ở CUỐI (💀😭🙃 v.v.), không emoji trang trí giữa bài.';
    default:
      return null;
  }
}

// Build block prompt từ opts. Trả '' nếu không bật knob nào.
export function buildHumanizerBlock(opts: HumanizerOpts | null | undefined, targetLang: string): string {
  if (!opts || !Array.isArray(opts.knobs) || opts.knobs.length === 0) return '';
  const intensity: HumanizerIntensity = opts.intensity || 'medium';
  const lines = opts.knobs.map((k) => knobLine(k, targetLang, intensity)).filter(Boolean) as string[];
  if (lines.length === 0) return '';
  return [
    '',
    '═══════════════════════════════════════════════════════════',
    `🧬 HUMAN AUTHENTICITY (HIGH PRIORITY) — làm bodyTarget giống NGƯỜI THẬT đăng (mức: ${intensity})`,
    'CHỈ áp dụng cho bodyTarget (bản đăng thật). bodyReview giữ tiếng Việt CHUẨN — KHÔNG áp các rule dưới.',
    ...lines,
    'RÀNG BUỘC CHUNG:',
    '- KHÔNG dùng em dash "—", luôn dùng "-" (human-voice rule).',
    '- Vẫn phải đọc hiểu + đúng ý; "messy" có chủ đích, đừng phá nội dung.',
    '- Đây là tín hiệu giả-người ƯU TIÊN CAO: nếu xung đột với rule "văn phong chuẩn" ở trên, ưu tiên block này cho bodyTarget.',
    '═══════════════════════════════════════════════════════════',
    '',
  ].join('\n');
}
