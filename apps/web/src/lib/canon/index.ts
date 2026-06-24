// Behavioral registry barrel — "x-entity cho HÀNH VI" (server-side).
//
// LUẬT: một khái niệm hành vi (field-name canon · platform-key · scope tier ·
// habitat-kind · board-class) có ĐÚNG MỘT resolver. Tham chiếu `canon.*` ở mọi nơi;
// CẤM inline lowercase/host-match/alias-map/kind-switch tại call-site. Thêm 1 alias/host
// = sửa ĐÚNG file lib gốc (rồi codegen Phase B đẩy sang ext), KHÔNG special-case rải rác.
//
// Đối xứng bên ext: window.MOS2.resolve.* (mos2-crew/core/resolve.js).
// Danh mục đầy đủ + quyết định: decisions/2026-06-25-crew-behavioral-registry-xentity.md
import { canonField, mechCanon, FIELD_ALIASES } from '@/lib/selector-field-canon';
import { normScopeKind, scopeKindMatch } from '@/lib/scope-kind';
import {
  canonPlatformKey, detectPlatformKeyFromUrl,
  defaultKindForPlatformKey, isKindPlatformCompatible,
} from '@/lib/habitat-platform-map';
import { boardKeyFromUrl } from '@/lib/board-radar';

export const canon = {
  // free-text field-name → canonical (dotted-preserving qua PRESERVE_DOTTED + alias theo page_kind)
  field: canonField,
  // selector scope tier; legacy 'engine' → 'technology'
  scopeKind: normScopeKind,
  scopeKindMatch,
  // platform key: ext-key/alias → catalog canonical (x→twitter, bsky→bluesky)
  platformKey: canonPlatformKey,
  // host/URL → canonical platform key
  platformFromUrl: detectPlatformKeyFromUrl,
  // platform key → default habitat kind (reddit→subreddit, twitter→hashtag…)
  habitatKind: defaultKindForPlatformKey,
  kindCompatible: isKindPlatformCompatible,
  // URL → board/community identity discriminator { platformKey, externalId, kind, name }
  boardKey: boardKeyFromUrl,
} as const;

export { FIELD_ALIASES, mechCanon };
export type { ScopeKind } from '@/lib/scope-kind';
