'use server';

// Discord server info extractor — không cần bot, không cần OAuth.
// Discord Invite API public: GET /api/v10/invites/{code}?with_counts=true
// → trả guild info (name, icon, banner, description, member_count, presence_count, verification_level)
// + channel preview (channel của invite, type 0 = text).
// Đủ cho server-level basic info — fill HabitatFormModal trong 1 click.

const DISCORD_API = 'https://discord.com/api/v10';

export interface DiscordServerInfo {
  guildId: string;
  name: string;
  description: string | null;
  iconUrl: string | null;     // CDN URL, animated nếu icon hash bắt đầu 'a_'
  bannerUrl: string | null;
  splashUrl: string | null;
  memberCount: number | null;
  onlineCount: number | null;
  verificationLevel: number | null;   // 0=none, 1=low, 2=medium, 3=high, 4=very_high
  features: string[];                  // ['COMMUNITY', 'VERIFIED', 'DISCOVERABLE', ...]
  vanityUrl: string | null;
  inviteCode: string;
  inviteUrl: string;
  // Channel preview của invite (channel mà invite link trỏ tới)
  previewChannelName: string | null;
  previewChannelType: number | null;
}

// Parse invite code từ nhiều format: discord.gg/xxx, discord.com/invite/xxx, hoặc raw code.
function parseInviteCode(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  // Raw code (alphanumeric, dấu gạch, không phải URL)
  if (/^[A-Za-z0-9-]{2,32}$/.test(s) && !s.includes('/')) return s;
  try {
    const u = new URL(s.startsWith('http') ? s : `https://${s}`);
    if (!/discord\.(gg|com)$/i.test(u.hostname.replace(/^www\./, ''))) return null;
    // discord.gg/CODE — path = /CODE
    if (u.hostname.endsWith('discord.gg')) {
      const code = u.pathname.split('/').filter(Boolean)[0];
      return code || null;
    }
    // discord.com/invite/CODE
    const parts = u.pathname.split('/').filter(Boolean);
    const i = parts.indexOf('invite');
    if (i >= 0 && parts[i + 1]) return parts[i + 1]!;
    return null;
  } catch {
    return null;
  }
}

function buildCdnUrl(kind: 'icons' | 'banners' | 'splashes', guildId: string, hash: string | null | undefined): string | null {
  if (!hash) return null;
  const ext = hash.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/${kind}/${guildId}/${hash}.${ext}?size=512`;
}

export async function extractDiscordInvite(
  input: string,
): Promise<{ ok: true; info: DiscordServerInfo } | { ok: false; error: string }> {
  const code = parseInviteCode(input);
  if (!code) {
    return { ok: false, error: 'Không nhận diện được invite link. Dùng dạng `discord.gg/xxx` hoặc `discord.com/invite/xxx`.' };
  }
  try {
    const res = await fetch(`${DISCORD_API}/invites/${encodeURIComponent(code)}?with_counts=true&with_expiration=true`, {
      headers: {
        'User-Agent': 'MOS2-DiscordExtractor/1.0',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 404) return { ok: false, error: 'Invite không tồn tại hoặc đã hết hạn.' };
    if (res.status === 429) return { ok: false, error: 'Discord rate-limit. Thử lại sau vài giây.' };
    if (!res.ok) return { ok: false, error: `Discord API ${res.status}` };
    type ApiResp = {
      code: string;
      guild?: {
        id: string;
        name: string;
        description: string | null;
        icon: string | null;
        banner: string | null;
        splash: string | null;
        verification_level: number;
        features: string[];
        vanity_url_code: string | null;
      };
      channel?: { id: string; name: string; type: number };
      approximate_member_count?: number;
      approximate_presence_count?: number;
    };
    const data = await res.json() as ApiResp;
    if (!data.guild) return { ok: false, error: 'Invite không gắn server (có thể là group DM).' };
    const g = data.guild;
    const info: DiscordServerInfo = {
      guildId: g.id,
      name: g.name,
      description: g.description ?? null,
      iconUrl: buildCdnUrl('icons', g.id, g.icon),
      bannerUrl: buildCdnUrl('banners', g.id, g.banner),
      splashUrl: buildCdnUrl('splashes', g.id, g.splash),
      memberCount: data.approximate_member_count ?? null,
      onlineCount: data.approximate_presence_count ?? null,
      verificationLevel: g.verification_level ?? null,
      features: Array.isArray(g.features) ? g.features : [],
      vanityUrl: g.vanity_url_code ? `https://discord.gg/${g.vanity_url_code}` : null,
      inviteCode: data.code,
      inviteUrl: `https://discord.gg/${data.code}`,
      previewChannelName: data.channel?.name ?? null,
      previewChannelType: data.channel?.type ?? null,
    };
    return { ok: true, info };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
