// Heuristic language detector — không có lib bên ngoài, dùng stopword
// frequency của top languages MOS2 hay gặp (en/vi/es/fr/de/pt/it).
// Đủ chính xác cho text >= 30 chars; ngắn hơn trả 'unknown'.
//
// Use case: habitat.description / postingRules / title không phải lúc nào
// cũng có hint language explicit (Reddit subreddit meta thường empty);
// cần đoán để brief-suggest tạo plan đúng ngôn ngữ.
//
// Khi nào dùng:
//   const lang = detectLang(`${desc} ${rules} ${title}`);
//   if (lang !== 'unknown' && lang !== 'en') prompt += `community speaks ${lang}`;

export type Lang = 'en' | 'vi' | 'es' | 'fr' | 'de' | 'pt' | 'it' | 'unknown';

// Stopwords distinctive cho mỗi ngôn ngữ. Chọn từ KHÔNG overlap nhiều với
// English (ko, the, of, etc. bỏ vì có ở mọi text web).
const STOPWORDS: Record<Exclude<Lang, 'unknown' | 'en'>, string[]> = {
  vi: ['không', 'của', 'được', 'người', 'những', 'với', 'cùng', 'này', 'rằng', 'đến', 'cho', 'phải', 'thì', 'sẽ', 'mình', 'nhé', 'nhau', 'bạn', 'cũng', 'hoặc'],
  es: ['que', 'no', 'los', 'las', 'una', 'por', 'para', 'con', 'pero', 'como', 'más', 'este', 'esta', 'sus', 'son', 'ofrecer', 'preguntar', 'spamear', 'memes', 'natal', 'carta'],
  fr: ['que', 'pas', 'les', 'des', 'une', 'pour', 'avec', 'mais', 'comme', 'plus', 'cette', 'leur', 'sont', 'être', 'aussi', 'vous', 'nous', 'tout', 'sans'],
  de: ['nicht', 'die', 'der', 'das', 'und', 'für', 'mit', 'aber', 'wie', 'mehr', 'diese', 'sind', 'sein', 'auch', 'oder', 'wenn', 'noch', 'bitte', 'ich', 'wir'],
  pt: ['não', 'que', 'são', 'uma', 'para', 'com', 'mas', 'como', 'mais', 'este', 'esta', 'seus', 'também', 'você', 'nós', 'todo', 'sem', 'pode', 'pelo'],
  it: ['non', 'che', 'sono', 'una', 'per', 'con', 'ma', 'come', 'più', 'questo', 'questa', 'suoi', 'anche', 'voi', 'noi', 'tutto', 'senza', 'può'],
};

// English signature words — chỉ dùng để fallback khi không trùng lang khác.
const EN_WORDS = ['the', 'and', 'you', 'for', 'with', 'this', 'that', 'have', 'are', 'is', 'be', 'not', 'but', 'community', 'rules'];

const ENGLISH_LANG: Lang = 'en';

export function detectLang(text: string): Lang {
  if (!text || text.trim().length < 30) return 'unknown';
  const lower = ' ' + text.toLowerCase().replace(/[^\p{L}\s]/gu, ' ') + ' ';

  // Đếm hit cho từng language
  const scores: Record<Lang, number> = { en: 0, vi: 0, es: 0, fr: 0, de: 0, pt: 0, it: 0, unknown: 0 };
  for (const [lang, words] of Object.entries(STOPWORDS)) {
    let hits = 0;
    for (const w of words) {
      // Word boundary cứng: leading + trailing space (đã pad ở trên).
      const idx = lower.indexOf(' ' + w + ' ');
      if (idx >= 0) hits += 1;
    }
    scores[lang as Lang] = hits;
  }
  // English signature
  let enHits = 0;
  for (const w of EN_WORDS) {
    if (lower.indexOf(' ' + w + ' ') >= 0) enHits += 1;
  }
  scores.en = enHits;

  // Threshold: max score >= 3 và hơn runner-up >= 1 → tin tưởng
  const entries = Object.entries(scores).filter(([k]) => k !== 'unknown') as [Lang, number][];
  entries.sort((a, b) => b[1] - a[1]);
  const [top, second] = entries;
  if (!top || top[1] < 3) return 'unknown';
  if (second && top[1] - second[1] < 1) {
    // Tie / quá gần — ưu tiên non-English (vì English stopwords leak sang
    // text đa ngôn ngữ; chỉ trả English nếu áp đảo).
    const nonEng = entries.find(([k, v]) => k !== 'en' && v >= 3);
    if (nonEng && top[0] === 'en') return nonEng[0];
  }
  return top[0] === ENGLISH_LANG ? 'en' : top[0];
}

// Full label cho LLM prompt — "Spanish (es)" rõ hơn "es" cho LLM hiểu.
export const LANG_LABEL: Record<Lang, string> = {
  en: 'English',
  vi: 'Vietnamese (Tiếng Việt)',
  es: 'Spanish (Español)',
  fr: 'French (Français)',
  de: 'German (Deutsch)',
  pt: 'Portuguese (Português)',
  it: 'Italian (Italiano)',
  unknown: '',
};
