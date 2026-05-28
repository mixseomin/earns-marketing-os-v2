// Language code → flag emoji + display label. Centralize ở đây để
// HabitatFormModal, brief-edit-modal, AI banner, brief-suggest đều dùng
// chung 1 map — đổi 1 chỗ, sync mọi nơi.
//
// Code khớp ISO-639-1; "multi" = community multilingual; "" = chưa set.

export interface LangMeta {
  /** ISO code (en/vi/es/...) hoặc 'multi' / '' */
  code: string;
  /** Flag emoji — 1 chữ (dùng cờ quốc gia phổ biến nhất cho ngôn ngữ đó). */
  flag: string;
  /** Tên ngắn cho chip ("English", "Tiếng Việt", "Español"). */
  label: string;
  /** Tên dài + bản địa ngữ — dùng tooltip ("English · English").
   *  vd: "Spanish · Español" để user hiểu cả 2 góc. */
  fullLabel: string;
}

const LANG_META: Record<string, LangMeta> = {
  '':      { code: '',      flag: '❓', label: 'Chưa rõ',     fullLabel: 'Chưa biết community nói ngôn ngữ gì' },
  en:      { code: 'en',    flag: '🇬🇧', label: 'English',     fullLabel: 'English · English' },
  vi:      { code: 'vi',    flag: '🇻🇳', label: 'Tiếng Việt',  fullLabel: 'Vietnamese · Tiếng Việt' },
  es:      { code: 'es',    flag: '🇪🇸', label: 'Español',     fullLabel: 'Spanish · Español' },
  fr:      { code: 'fr',    flag: '🇫🇷', label: 'Français',    fullLabel: 'French · Français' },
  de:      { code: 'de',    flag: '🇩🇪', label: 'Deutsch',     fullLabel: 'German · Deutsch' },
  pt:      { code: 'pt',    flag: '🇧🇷', label: 'Português',   fullLabel: 'Portuguese · Português' },
  it:      { code: 'it',    flag: '🇮🇹', label: 'Italiano',    fullLabel: 'Italian · Italiano' },
  zh:      { code: 'zh',    flag: '🇨🇳', label: '中文',         fullLabel: 'Chinese · 中文' },
  ja:      { code: 'ja',    flag: '🇯🇵', label: '日本語',       fullLabel: 'Japanese · 日本語' },
  ko:      { code: 'ko',    flag: '🇰🇷', label: '한국어',        fullLabel: 'Korean · 한국어' },
  ru:      { code: 'ru',    flag: '🇷🇺', label: 'Русский',     fullLabel: 'Russian · Русский' },
  hi:      { code: 'hi',    flag: '🇮🇳', label: 'हिन्दी',         fullLabel: 'Hindi · हिन्दी' },
  ar:      { code: 'ar',    flag: '🇸🇦', label: 'العربية',       fullLabel: 'Arabic · العربية' },
  multi:   { code: 'multi', flag: '🌍', label: 'Multi',       fullLabel: 'Multilingual — community trộn nhiều ngôn ngữ' },
};

export function getLangMeta(code: string | null | undefined): LangMeta {
  const key = (code ?? '').toLowerCase().trim();
  return LANG_META[key] ?? {
    code: key, flag: '🌐', label: key.toUpperCase(),
    fullLabel: `Language code: ${key}`,
  };
}

/** Tooltip "es · Spanish · Español — AI sẽ dùng ngôn ngữ này..." */
export function langTooltip(code: string | null | undefined): string {
  const m = getLangMeta(code);
  if (!m.code) return 'Chưa biết community nói ngôn ngữ gì → AI sẽ auto-detect heuristic từ description/rules. Set explicit để chắc chắn.';
  return `${m.flag} ${m.fullLabel}\nAI brief + posts sẽ dùng ngôn ngữ này.\nClick để đổi.`;
}
