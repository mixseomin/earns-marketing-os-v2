// Generic CSS-selector discovery cho BẤT KỲ platform (dùng bởi suggest-adapter orchestrator).
// learn-selectors có prompt Reddit-tuned riêng; cái này generic cho platform mới/lạ.
import { getOpenAI } from '@/lib/ai/openai';
import { validateSelector } from '@/lib/selector-validate';
import { getFieldHint } from '@/lib/habitat-field-schema';
import type { SelectorMap } from '@/lib/actions/habitat-selectors';

export interface DiscoverInput {
  platformKey: string;
  pageKind: string;
  fields: string[];
  html: string;
  detectedEngine?: string;
}
export interface DiscoverResult {
  selectors: SelectorMap;
  rejected: Array<{ field: string; css: string; reason: string }>;
  model: string;
  htmlEmpty: boolean;
}

export async function discoverSelectors(inp: DiscoverInput): Promise<DiscoverResult> {
  const ai = getOpenAI();
  if (!ai) throw new Error('OpenAI client unavailable');
  const model = 'gpt-4.1-mini';
  const html = inp.html.slice(0, 200_000);
  const fieldsList = inp.fields.map((f) => `- "${f}": ${getFieldHint(inp.pageKind, f)}`).join('\n');
  const engineHint = inp.detectedEngine
    ? `\nEngine: ${inp.detectedEngine}. Selector PHẢI generic cho mọi site cùng engine.`
    : '';

  const sys = `Bạn là CSS selector discovery agent cho platform "${inp.platformKey}", page_kind "${inp.pageKind}". User gửi FULL HTML của trang (đã đăng nhập). Cho MỖI field sinh 1 CSS selector STABLE (document.querySelector) trỏ ĐÚNG element chứa data.${engineHint}

Field cần discover:
${fieldsList}

OUTPUT JSON: {"selectors": {"<field>": {"css":"...","attr":"textContent"|"src"|"href"|"datetime"|"value","parse":"number-suffix"|"date"|"enum"|null,"notes":"..."}, ...}}
RULES:
1. querySelector-compatible. CẤM :has(), :contains, jQuery, nth-child/nth-of-type, parent chain >3 cấp.
2. Ưu tiên selector ổn định: data-testid, aria-label, semantic tag (article, time, faceplate-*, shreddit-*), name/id KHÔNG phải random-hash.
3. CẤM hardcode giá trị 1 site cụ thể (id kiểu t5_xxx, tên community, url path cụ thể). Selector generic cho MỌI site cùng platform/engine. Tự test: "selector này work cho site A, B, bất kỳ?".
4. Class LUÔN có dấu "." đầu (".foo", KHÔNG "foo"). attr ảnh/icon = "src", link = "href", thời gian = "datetime"/"textContent".
5. Bỏ field nếu không chắc element tồn tại. Nếu HTML là login/captcha/empty wall → {"selectors":{},"html_empty":true}.`;

  const completion = await ai.chat.completions.create({
    model, temperature: 0, max_tokens: 2000,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: `HTML (${html.length} chars):\n\`\`\`html\n${html}\n\`\`\`` },
    ],
  });
  const raw = completion.choices[0]?.message?.content?.trim() ?? '';
  let parsed: { selectors?: SelectorMap; html_empty?: boolean };
  try { parsed = JSON.parse(raw); } catch { throw new Error('LLM JSON parse fail: ' + raw.slice(0, 200)); }

  const out = parsed.selectors ?? {};
  const valid: SelectorMap = {};
  const rejected: Array<{ field: string; css: string; reason: string }> = [];
  for (const [f, spec] of Object.entries(out)) {
    const css = spec?.css;
    if (!css) { rejected.push({ field: f, css: '', reason: 'no css' }); continue; }
    const v = validateSelector(css);
    if (v.ok) valid[f] = spec;
    else rejected.push({ field: f, css, reason: v.error || 'invalid' });
  }
  return { selectors: valid, rejected, model, htmlEmpty: parsed.html_empty === true };
}
