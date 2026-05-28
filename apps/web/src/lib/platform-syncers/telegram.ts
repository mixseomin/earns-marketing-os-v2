import type { PlatformSyncer, SyncerInput, SyncerResult } from './types';

// Telegram Bot API. Token format: '123456789:AAEhBOweik6ad...' (id:secret).
// Endpoint /getMe trả bot user info. KHÔNG có user OAuth flow chính thức cho
// Telegram (user authen qua Telegram Login Widget cho web app, không phải API).
//
// Vậy syncer chỉ support bot account. account_kind='user' sẽ return error.

const API_BASE = 'https://api.telegram.org';

export const telegramSyncer: PlatformSyncer = {
  platformKey: 'telegram',
  label: 'Telegram',
  async fetch(input: SyncerInput): Promise<SyncerResult> {
    if (input.accountKind !== 'bot' && input.accountKind !== 'app') {
      return { ok: false, error: 'Telegram chỉ support sync với bot account (account_kind=bot)' };
    }
    try {
      const res = await fetch(`${API_BASE}/bot${input.token}/getMe`);
      if (!res.ok) {
        return { ok: false, error: `Telegram /getMe ${res.status}: ${await res.text().catch(() => '?')}` };
      }
      const json = await res.json() as { ok: boolean; result?: Record<string, unknown>; description?: string };
      if (!json.ok || !json.result) {
        return { ok: false, error: `Telegram API: ${json.description ?? 'unknown'}` };
      }
      const u = json.result;
      const username = u.username ? String(u.username) : null;
      const firstName = u.first_name ? String(u.first_name) : null;
      const lastName = u.last_name ? String(u.last_name) : null;
      const displayName = [firstName, lastName].filter(Boolean).join(' ') || username;
      return {
        ok: true,
        profile: {
          externalId: u.id != null ? String(u.id) : null,
          handle: username ? `@${username}` : null,
          email: null,
          displayName,
          avatarUrl: null,                     // getMe không trả ảnh; cần getUserProfilePhotos
          verified: null,
          mfaEnabled: null,
          tier: null,
          followerCount: null,
          followingCount: null,
          extra: {
            canJoinGroups: u.can_join_groups,
            canReadAllGroupMessages: u.can_read_all_group_messages,
            supportsInlineQueries: u.supports_inline_queries,
            isBot: u.is_bot,
            firstName,
            lastName,
          },
        },
      };
    } catch (e) {
      return { ok: false, error: `Telegram fetch error: ${(e as Error).message}` };
    }
  },
};
