import type { PlatformSyncer, SyncerInput, SyncerResult } from './types';

// Discord API v10. 2 mode:
//   - Bot: Authorization: Bot <BOT_TOKEN>. Endpoint /users/@me + /users/@me/guilds.
//   - User (OAuth app): Authorization: Bearer <ACCESS_TOKEN> với scope identify+email+guilds.
//     KHÔNG dùng được token user thật (self-bot = ban TOS từ 2018).
//
// Token format: bot token là 'MTAxxxxxx.GxxxxX.xxxxxxxxxxxxxxxxxxxxxxxxxx' (3 phần
// dot-separated). OAuth access_token là opaque string.

const API_BASE = 'https://discord.com/api/v10';

export const discordSyncer: PlatformSyncer = {
  platformKey: 'discord',
  label: 'Discord',
  async fetch(input: SyncerInput): Promise<SyncerResult> {
    const authPrefix = input.accountKind === 'bot' ? 'Bot' : 'Bearer';
    const headers = {
      Authorization: `${authPrefix} ${input.token}`,
      'User-Agent': 'MOS2-Sync/1.0',
    };
    try {
      const userRes = await fetch(`${API_BASE}/users/@me`, { headers });
      if (!userRes.ok) {
        return { ok: false, error: `Discord /users/@me ${userRes.status}: ${await userRes.text().catch(() => '?')}` };
      }
      const u = await userRes.json() as Record<string, unknown>;

      // Fetch guild count (bot) — optional, fail silently nếu OAuth không có scope.
      let guildsCount: number | null = null;
      try {
        const gRes = await fetch(`${API_BASE}/users/@me/guilds`, { headers });
        if (gRes.ok) {
          const g = await gRes.json() as Array<unknown>;
          guildsCount = Array.isArray(g) ? g.length : null;
        }
      } catch { /* skip */ }

      const id = String(u.id ?? '');
      const username = String(u.username ?? '');
      const discriminator = String(u.discriminator ?? '0');
      const avatar = u.avatar ? String(u.avatar) : null;
      const handle = username + (discriminator && discriminator !== '0' ? `#${discriminator}` : '');
      const avatarUrl = avatar && id
        ? `https://cdn.discordapp.com/avatars/${id}/${avatar}.${avatar.startsWith('a_') ? 'gif' : 'png'}?size=256`
        : null;

      return {
        ok: true,
        profile: {
          externalId: id || null,
          handle: handle || null,
          email: u.email ? String(u.email) : null,
          displayName: u.global_name ? String(u.global_name) : (u.username ? String(u.username) : null),
          avatarUrl,
          verified: typeof u.verified === 'boolean' ? u.verified : null,
          mfaEnabled: typeof u.mfa_enabled === 'boolean' ? u.mfa_enabled : null,
          tier: (() => {
            const t = u.premium_type;
            if (t === 1) return 'Nitro Classic';
            if (t === 2) return 'Nitro';
            if (t === 3) return 'Nitro Basic';
            return null;
          })(),
          followerCount: null,
          followingCount: guildsCount,   // tận dụng để show "in N guilds"
          extra: {
            discriminator: discriminator !== '0' ? discriminator : undefined,
            locale: u.locale,
            flags: u.flags,
            publicFlags: u.public_flags,
            accentColor: u.accent_color,
            banner: u.banner,
            guildsCount,
          },
        },
      };
    } catch (e) {
      return { ok: false, error: `Discord fetch error: ${(e as Error).message}` };
    }
  },
};
