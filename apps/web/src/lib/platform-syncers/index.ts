// Registry — map platformKey → PlatformSyncer. Thêm platform mới: import +
// push vào SYNCERS.

import type { PlatformSyncer, SyncerInput, SyncerResult } from './types';
import { discordSyncer } from './discord';
import { redditSyncer } from './reddit';
import { telegramSyncer } from './telegram';
import { slackSyncer } from './slack';
import { xSyncer } from './x';

export type { PlatformSyncer, SyncerInput, SyncerResult, PlatformAccountProfile } from './types';

const SYNCERS: PlatformSyncer[] = [
  discordSyncer,
  redditSyncer,
  telegramSyncer,
  slackSyncer,
  xSyncer,
];

const BY_KEY = new Map(SYNCERS.map((s) => [s.platformKey, s]));

export function getSyncer(platformKey: string): PlatformSyncer | null {
  return BY_KEY.get(platformKey) ?? null;
}

export function listSupportedPlatforms(): Array<{ key: string; label: string }> {
  return SYNCERS.map((s) => ({ key: s.platformKey, label: s.label }));
}
