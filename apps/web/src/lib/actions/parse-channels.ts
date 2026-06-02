'use server';

// Bulk channel parser cho multi-channel community (Discord/Slack/Telegram channel +
// FORUM sub-forum/board). Input: text dump (channel
// list copy từ sidebar / rules channel) HOẶC screenshot. Output: array
// channels chuẩn để append vào HabitatFormModal state. Khác parseFormInput
// generic ở chỗ output là ARRAY, không phải flat object.

const ALLOWED_FORMAT_KEYS = [
  'text', 'image', 'video', 'link', 'thread', 'poll', 'carousel', 'story', 'doc',
] as const;

export interface ParsedChannel {
  name: string;
  url: string | null;
  description: string;
  rules: string;
  allowedFormats: string[] | null;       // null = inherit habitat
  postingGates: Record<string, unknown> | null;  // {skip_for_post: true} cho rules/bot/announce channels
}

// Auto-detect channel ko đăng bài được (rules/announce/bot/role/info).
// Match heuristic theo tên — chính xác đủ cho 90% Discord servers.
// NOT exported vì 'use server' files chỉ cho phép export async. Chỉ dùng nội bộ trong module này.
function isAutoSkipChannel(name: string): boolean {
  const n = name.toLowerCase().trim().replace(/[-_]/g, '');
  // Channel admin-only / info-only
  if (/^rules?$/.test(n)) return true;                       // #rules, #rule
  if (/^announc/.test(n) || /announcements?$/.test(n)) return true;  // #announcements
  if (/^roles?$/.test(n) || /pickroles?$/.test(n)) return true;       // #roles, #pick-roles
  if (/^botcommands?$/.test(n) || /^bot$/.test(n)) return true;       // #bot-commands
  if (/^welcome$/.test(n) || /^info$/.test(n)) return true;           // #welcome, #info
  if (/^serversupport$/.test(n) || /^support$/.test(n)) return true;   // #server-support (helpdesk)
  if (/^modlog/.test(n) || /^audit/.test(n)) return true;             // mod channels
  if (/^faq$/.test(n)) return true;
  // Generic "gwys-n-announcements" pattern (giveaways + announcements)
  if (/gwys.*announc|announc.*gwys/.test(n)) return true;
  return false;
}

export async function parseChannelsFromInput(input: {
  text?: string;
  imageBase64?: string;
  imageMimeType?: string;
  platformKey?: string;          // discord|slack|telegram — giúp AI biết format channel name
}): Promise<{ ok: true; channels: ParsedChannel[]; notes?: string } | { ok: false; error: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, error: 'OPENAI_API_KEY not configured' };
  if (!input.text?.trim() && !input.imageBase64) {
    return { ok: false, error: 'Provide text dump or screenshot' };
  }

  const hasImage = !!input.imageBase64;
  const model = hasImage ? 'gpt-4o' : 'gpt-4o-mini';
  const platformHint = input.platformKey || 'discord';

  const systemMsg = `You extract a list of community sub-areas (channels / sub-forums / boards) from the user's input.
Platform: ${platformHint}.

For Discord: channels look like "# general", "# rules", "#promo-self", icons may prefix names.
For Slack:   channels look like "# proj-alpha", "#announcements".
For Telegram: groups/topics look like "📢 Announcements", "🚀 General".
For a FORUM (XenForo/vBulletin/phpBB/Discourse): sub-areas are SUB-FORUMS / boards / categories,
  e.g. "Gaming Discussion", "Off-Topic", "EtcetEra", "Feedback". Each row often shows thread/post counts.

OUTPUT a JSON object with one key "channels" (array of objects). Each object:
- "name"            (string, required) — sub-area name WITHOUT '#' prefix or emoji icon. For forums use the board title verbatim ("Gaming Discussion").
- "url"             (string|null)      — sub-area URL if visible in input, else null
- "description"     (string)           — short topic/intent line (max 100 chars), empty if unknown
- "rules"           (string)           — rules content for this sub-area ONLY if extracted from input (markdown lines), empty if unknown
- "allowed_formats" (array of strings|null) — subset of [${ALLOWED_FORMAT_KEYS.join(', ')}] if it restricts formats (e.g. "showcase" → ["image","video"], "links" → ["link"]). null = inherits habitat (default).

CRITICAL:
- Do NOT invent sub-areas not visible in input.
- Skip Discord voice channels, category headers, threads. For forums: skip individual THREADS (extract the board/sub-forum, not threads inside it); skip read-only "Announcements/Rules" only if you also set rules-like intent (still list them).
- Skip private/locked channels if marked (🔒).
- Preserve order from input.
- If allowed_formats is unclear from name/description, return null (don't guess).`;

  const userContent: Array<Record<string, unknown>> = [];
  if (input.text?.trim()) {
    userContent.push({ type: 'text', text: `Channel list source:\n\n${input.text.trim()}` });
  }
  if (input.imageBase64) {
    const mime = input.imageMimeType || 'image/png';
    const dataUrl = input.imageBase64.startsWith('data:')
      ? input.imageBase64
      : `data:${mime};base64,${input.imageBase64}`;
    userContent.push({
      type: 'image_url',
      image_url: { url: dataUrl, detail: 'high' },
    });
    userContent.push({ type: 'text', text: 'Extract channels from the screenshot above.' });
  }

  const responseSchema = {
    type: 'object',
    properties: {
      channels: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            url: { type: ['string', 'null'] },
            description: { type: 'string' },
            rules: { type: 'string' },
            allowed_formats: {
              type: ['array', 'null'],
              items: { type: 'string', enum: [...ALLOWED_FORMAT_KEYS] },
            },
          },
          required: ['name', 'url', 'description', 'rules', 'allowed_formats'],
          additionalProperties: false,
        },
      },
      notes: { type: ['string', 'null'] },
    },
    required: ['channels', 'notes'],
    additionalProperties: false,
  };

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemMsg },
          { role: 'user', content: userContent },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'channel_list', strict: true, schema: responseSchema },
        },
        temperature: 0.1,
        max_tokens: 2500,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `OpenAI ${res.status}: ${errText.slice(0, 300)}` };
    }
    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    const content = data.choices[0]?.message?.content;
    if (!content) return { ok: false, error: 'Empty response' };
    const parsed = JSON.parse(content) as {
      channels: Array<{ name: string; url: string | null; description: string; rules: string; allowed_formats: string[] | null }>;
      notes: string | null;
    };
    const channels: ParsedChannel[] = (parsed.channels ?? [])
      .filter((c) => c.name && c.name.trim())
      .map((c) => {
        const name = c.name.trim().replace(/^[#]+\s*/, '').replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]\s*/u, '').trim();
        const autoSkip = isAutoSkipChannel(name);
        return {
          // Normalize: strip leading '#', emoji prefix, lowercase whitespace
          name,
          url: c.url?.trim() || null,
          description: (c.description ?? '').trim().slice(0, 200),
          rules: (c.rules ?? '').trim(),
          allowedFormats: Array.isArray(c.allowed_formats) && c.allowed_formats.length > 0 ? c.allowed_formats : null,
          // Auto-mark rules/announce/bot/role channels = không đăng bài
          postingGates: autoSkip ? { skip_for_post: true, reason: 'auto-detect: channel admin/info-only' } : null,
        };
      })
      .filter((c) => c.name.length > 0);
    return { ok: true, channels, notes: parsed.notes ?? undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
