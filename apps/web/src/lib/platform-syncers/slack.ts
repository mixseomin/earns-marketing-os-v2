import type { PlatformSyncer, SyncerInput, SyncerResult } from './types';

// Slack Web API. Token format: 'xoxb-...' (bot) hoặc 'xoxp-...' (user OAuth).
// auth.test xác minh token + trả basic info. users.identity trả profile chi tiết
// (cần scope identity.basic). users.info(<user_id>) cần admin scope.

const API_BASE = 'https://slack.com/api';

export const slackSyncer: PlatformSyncer = {
  platformKey: 'slack',
  label: 'Slack',
  async fetch(input: SyncerInput): Promise<SyncerResult> {
    const headers = {
      Authorization: `Bearer ${input.token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    try {
      const authRes = await fetch(`${API_BASE}/auth.test`, { method: 'POST', headers });
      const auth = await authRes.json() as Record<string, unknown>;
      if (!auth.ok) {
        return { ok: false, error: `Slack auth.test: ${auth.error ?? 'unknown'}` };
      }
      const userId = auth.user_id ? String(auth.user_id) : null;
      const teamId = auth.team_id ? String(auth.team_id) : null;
      const userName = auth.user ? String(auth.user) : null;
      const teamName = auth.team ? String(auth.team) : null;

      // Try users.info để lấy email + avatar (cần users:read.email scope)
      let userInfo: Record<string, unknown> | null = null;
      if (userId) {
        try {
          const uRes = await fetch(`${API_BASE}/users.info?user=${userId}`, { headers });
          const uJson = await uRes.json() as Record<string, unknown>;
          if (uJson.ok && uJson.user) userInfo = uJson.user as Record<string, unknown>;
        } catch { /* skip */ }
      }
      const profile = userInfo?.profile as Record<string, unknown> | undefined;
      return {
        ok: true,
        profile: {
          externalId: userId,
          handle: userName,
          email: profile?.email ? String(profile.email) : null,
          displayName: profile?.real_name
            ? String(profile.real_name)
            : (profile?.display_name ? String(profile.display_name) : userName),
          avatarUrl: profile?.image_512
            ? String(profile.image_512)
            : (profile?.image_192 ? String(profile.image_192) : null),
          verified: null,
          mfaEnabled: typeof userInfo?.has_2fa === 'boolean' ? userInfo.has_2fa as boolean : null,
          tier: null,
          followerCount: null,
          followingCount: null,
          extra: {
            teamId, teamName,
            isAdmin: userInfo?.is_admin,
            isOwner: userInfo?.is_owner,
            isBot: userInfo?.is_bot,
            timezone: userInfo?.tz,
            title: profile?.title,
            statusText: profile?.status_text,
          },
        },
      };
    } catch (e) {
      return { ok: false, error: `Slack fetch error: ${(e as Error).message}` };
    }
  },
};
