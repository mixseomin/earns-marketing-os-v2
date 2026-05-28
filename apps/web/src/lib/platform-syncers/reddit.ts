import type { PlatformSyncer, SyncerInput, SyncerResult } from './types';

// Reddit API. Cần OAuth Bearer access_token (script-app password flow hoặc
// installed-app device flow). Bot account ở Reddit = script-app.
//
// User-Agent BẮT BUỘC theo format Reddit chấp nhận, không thì 429/403.
// 'MOS2/1.0 by /u/<owner>' — không dùng được nếu chưa biết owner; fallback
// generic.

const API_BASE = 'https://oauth.reddit.com';

export const redditSyncer: PlatformSyncer = {
  platformKey: 'reddit',
  label: 'Reddit',
  async fetch(input: SyncerInput): Promise<SyncerResult> {
    const headers = {
      Authorization: `Bearer ${input.token}`,
      'User-Agent': 'MOS2-Sync/1.0',
    };
    try {
      const res = await fetch(`${API_BASE}/api/v1/me`, { headers });
      if (!res.ok) {
        return { ok: false, error: `Reddit /api/v1/me ${res.status}: ${await res.text().catch(() => '?')}` };
      }
      const u = await res.json() as Record<string, unknown>;
      const id = String(u.id ?? '');
      const name = u.name ? String(u.name) : null;
      const avatarRaw = u.icon_img ? String(u.icon_img) : (u.snoovatar_img ? String(u.snoovatar_img) : null);
      // Reddit avatar URL có query string — keep nguyên
      return {
        ok: true,
        profile: {
          externalId: id || null,
          handle: name,
          email: null,                          // Reddit không expose email qua /me
          displayName: u.subreddit && typeof u.subreddit === 'object'
            ? String((u.subreddit as Record<string, unknown>).title ?? name)
            : name,
          avatarUrl: avatarRaw,
          verified: typeof u.verified === 'boolean' ? u.verified : null,
          mfaEnabled: null,
          tier: u.is_gold ? 'Reddit Premium' : null,
          followerCount: typeof u.total_karma === 'number' ? u.total_karma : null,
          followingCount: null,
          extra: {
            linkKarma: u.link_karma,
            commentKarma: u.comment_karma,
            awardeeKarma: u.awardee_karma,
            awarderKarma: u.awarder_karma,
            createdUtc: u.created_utc,
            hasVerifiedEmail: u.has_verified_email,
            isMod: u.is_mod,
            isEmployee: u.is_employee,
            hideFromRobots: u.hide_from_robots,
            inboxCount: u.inbox_count,
            goldExpiration: u.gold_expiration,
            iconImg: u.icon_img,
            snoovatarImg: u.snoovatar_img,
          },
        },
      };
    } catch (e) {
      return { ok: false, error: `Reddit fetch error: ${(e as Error).message}` };
    }
  },
};
