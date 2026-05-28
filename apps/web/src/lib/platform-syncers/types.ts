// Generic platform syncer — mỗi platform 1 module fetch profile từ API
// rồi map về AccountPatch để updateAccount apply.
//
// Why interface chung: dispatch theo platformKey ở 1 chỗ, mọi platform mới
// chỉ cần implement Syncer + register vào registry.ts.

export interface PlatformAccountProfile {
  // Identifier raw từ platform (Discord snowflake, X user id, Reddit username...).
  // Lưu vào platform_accounts.client_id để future API call.
  externalId: string | null;
  handle: string | null;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  verified: boolean | null;
  mfaEnabled: boolean | null;
  // Tier/premium info (Discord Nitro, X Premium, Reddit Premium).
  tier: string | null;
  // Số follower/connection/server-member count.
  followerCount: number | null;
  followingCount: number | null;
  // Extra metadata (locale, created_at, public flags, server count, ...).
  // Merge vào platform_accounts.persona để giữ full data.
  extra: Record<string, unknown>;
}

export interface SyncerInput {
  /** API token / bot token / OAuth access_token, đã decrypt. */
  token: string;
  /** Optional client_id (Reddit OAuth needs cả script-app id + secret). */
  clientId?: string | null;
  /** account_kind: 'user' | 'bot' | 'app'. Một số platform có 2 mode khác nhau. */
  accountKind: string;
}

export interface SyncerResult {
  ok: boolean;
  profile?: PlatformAccountProfile;
  error?: string;
}

export interface PlatformSyncer {
  /** Platform key match platforms.key (discord, x, reddit, telegram, slack, ...). */
  platformKey: string;
  /** Display name cho UI. */
  label: string;
  /** Fetch profile. */
  fetch(input: SyncerInput): Promise<SyncerResult>;
}
