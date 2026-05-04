# Context: Resources (6 Vaults)

> Load khi làm việc với: `app/p/[id]/resources/`, `components/resources-page.tsx`, `components/accounts-vault.tsx`, `components/media-vault.tsx`, `components/contacts-vault.tsx`, `components/infra-vault.tsx`, `components/budget-vault.tsx`, `components/knowledge-vault.tsx`

---

## 6 vaults

| Vault | URL param | Key table | Operator sees |
|-------|-----------|-----------|---------------|
| Accounts | `?vault=accounts` | `platform_accounts` | Only `owner_user_id = me.id` |
| Media | `?vault=media` | `media_assets` | Based on visibility config |
| Contacts | `?vault=contacts` | `contacts` | Based on visibility config |
| Infra | `?vault=infra` | `infra_resources` | Based on visibility config |
| Budget | `?vault=budget` | `budget_entries` | Based on visibility config |
| Knowledge | `?vault=knowledge` | `knowledge_items` | Based on visibility config |

---

## Operator scoping (resources page)

```ts
// app/p/[id]/resources/page.tsx
const eff = await getEffectiveUser();  // NOT getCurrentUser()
const isOperator = eff!.role !== 'admin';

// Nếu operator không có vault nào visible + không có assigned accounts:
if (isOperator && !anyVaultVisible && !hasAssignedAccounts) {
  redirect(`/p/${id}/inbox`);  // auto-redirect sang inbox
}

// Pass to ResourcesPage:
<ResourcesPage isAdmin={!isOperator} ... />
<AccountsVault isAdmin={!isOperator} projectId={id} />
```

### isAdmin prop
- `isAdmin={false}` → hides create/edit/delete buttons trong mọi vault
- `isAdmin={true}` → full CRUD available

---

## PlatformAccount — quan trọng nhất

```ts
// lib/actions/accounts.ts
interface PlatformAccount {
  id, projectId, platformKey   // 'facebook'|'instagram'|'reddit'|'tiktok'|...
  username, email
  persona_kind: 'brand'|'employee'|'ambassador'|'synthetic'
  persona_owner_name           // real name nếu employee/ambassador
  persona_role, persona_bio    // role in company, bio text
  disclosure_text              // FTC/DSA disclosure
  represents_account_id        // FK → main brand account (for team member accounts)
  owner_user_id                // operator assignment — null = admin only
  tags: string[]               // JSONB tags
  category: string
  api_token_enc                // encrypted API token (pgcrypto)
}
```

### Assign account to operator
```ts
// lib/actions/assignments.ts
assignAccountsToMember(userId, accountIds[], projectId)
// → sets owner_user_id = userId on each account
// → calls enableResourcesForMember(userId) → merges nav.resources=true into visibility_config
// → bumps config_version → operator's browser refreshes within 5s
```

---

## Visibility config per vault

```ts
// Operator chỉ thấy vault nếu visibility_config.resources.<vault> = true
// Default (ROLE_DEFAULTS.operator): TẤT CẢ = false

// Admin bật trong ImpersonatePanel:
saveVisibilityConfig(userId, {
  nav: { resources: true },
  resources: { accounts: true, media: false, ... }
}, 'user')
```

---

## TopBar Resources dropdown — operator vs admin

```tsx
// topbar.tsx:
// Operator thấy:
subItems: [{ label: 'Accounts', href: `/p/${pid}/resources?vault=accounts`, icon: '🔐' }]

// Admin thấy full list:
subItems: [Overview, Accounts, Media, Contacts, Infra, Budget, Knowledge, Publications]
```

---

## DB tables

- `platform_accounts` — owner_user_id, persona_kind, represents_account_id, api_token_enc, tags JSONB (migration 0031, 0035)
- `proxies` — owner_user_id, tags JSONB (migration 0030, 0035)
- `browser_profiles` — owner_user_id, tags JSONB (migration 0030, 0035)
- `media_assets` — project_id, type, url, tags JSONB
- `contacts` — project_id, name, handle, platform, tags JSONB
- `knowledge_items` — project_id, title, content, tags JSONB
- `budget_entries` — project_id, amount, category, period
- `infra_resources` — project_id, type, host, tags JSONB

## Tags pattern (migration 0030)

Mọi entity có `tags` JSONB + `category` TEXT + GIN index. Filter bằng `@>` operator:
```sql
WHERE tags @> '["reddit"]'::jsonb
```
UI: `<TagsInput>` component + `<TagsFilterChips>` để filter.
