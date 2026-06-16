# MOS2 web — NAV map (function-level)

Bản đồ ĐIỀU HƯỚNG cho các file component cực lớn (>1500 dòng) trong `apps/web/src/`. Tìm hàm bằng map này → `Read(offset, limit)` đúng đoạn cần. **KHÔNG đọc full file 2-4k dòng vào context.**

Cho câu hỏi "X nằm đâu / Y chạy sao" trên file lớn → dispatch **Explore agent**, đừng Read full vào context chính.

> **Anchor = chuỗi grep literal**, KHÔNG phải số dòng cứng. File đổi → số dòng lệch. Luôn `grep -n "<anchor>" <file>` để pin dòng hiện tại rồi mới `Read(offset, limit)`.
> File-role / conventions / cách thêm feature = `CLAUDE.md` + `.claude/contexts/` (KHÔNG nằm trong map này — map này CHỈ là index hàm).

Files mapped (cập nhật khi file vượt 1500 dòng): `brief-edit-modal.tsx` (4350) · `accounts-vault.tsx` (3436) · `habitat-form-modal.tsx` (2976) · `seeding-cockpit.tsx` (2961). Khác >1500 chưa map: `all-posts-tab.tsx` (1328 — sát ngưỡng).

---

## components/brief-edit-modal.tsx (~4350) — editor brief community (1 brief / account×habitat)

Single-component modal khổng lồ: 6 field brief chính + 5-phase roadmap + posts-per-phase (card bilingual EN/VI + media + AI ops). ~30+ useState. Sub-component inline (`PostRow`, `PostsForPhase`, `TemplatesEditor`, `PhaseEntryEditor`...). AI suggest EN+VI per-field, replace/append. Astrolas + critique + bilingual sync per card.

| Section | Anchor | ~Line | Mục đích |
|---|---|---|---|
| Type SuggestableField | `type SuggestableField = 'approachMd'` | 67 | Field keys AI-suggest được |
| MARKDOWN_FIELDS | `const MARKDOWN_FIELDS = new Set<SuggestableField>` | 70 | Fields cần preview format |
| InsightsDeepDive | `function InsightsDeepDive({` | 88 | Reddit insights: top countries + replies |
| normalizeMarkdown | `function normalizeMarkdown(s: string): string {` | 177 | Tách markdown AI nén → bullets |
| BilingualAlignedPreview | `function BilingualAlignedPreview({` | 227 | Preview 2-cột target \| review align theo đoạn |
| Props interface | `export interface BriefEditModalProps {` | 321 | Props contract modal |
| **Main export** | `export function BriefEditModal({` | 373 | Component chính — toàn state + logic |
| State: brief fields | `const [approachMd, setApproachMd] = useState` | 386 | 6 field brief (approach/narrative/cadence/tone/do/dont) |
| State: phase plan | `const [activeTab, setActiveTab] = useState<TabKey>` | 439 | Tab (overview\|phase\|history\|detect) |
| State: phase/join | `const [currentPhase, setCurrentPhase] = useState` | 441 | Current phase + join status + meta |
| useEffect ext refresh | `if (data?.type !== 'mos2:brief-updated') return;` | 511 | Listen postMessage brief-updated từ ext |
| init phase từ archetype | `initPhasePlanFromDefaults(projectId, existing.id).then` | 548 | Auto-init phasePlan từ habitat archetype |
| doAdvancePhase | `const doAdvancePhase = () => {` | 578 | Confirm + advancePhase action |
| State: AI suggestion | `const [suggestion, setSuggestion] = useState` | 595 | Cache suggestion EN+VI per field |
| handleGenerateSuggestion | `const handleGenerateSuggestion = (` | 646 | suggestBrief action + merge |
| handleReplaceAll | `const handleReplaceAll = (): void => {` | 721 | Replace cả 6 field từ suggestion |
| **handleSave** | `const handleSave = (opts?: { keepOpen?: boolean })` | 754 | Persist brief qua upsertBrief |
| Ctrl+S shortcut | `const isSave = (e.metaKey \|\| e.ctrlKey) && e.key` | 776 | Bind ⌘/Ctrl+S save & keep open |
| handleDelete | `const handleDelete = () => {` | 788 | Confirm + deleteBrief |
| Main JSX return | `return (` | 804 | Backdrop + header tree |
| Phase roadmap collapsible | `{existing && phasePlan.length > 0 && (` | 1171 | Grid 5-phase strategy expandable |
| AIFormParser paste | `<details>` | 1297 | Parse HTML/transcript → brief fields |
| TemplatesEditor (def) | `function TemplatesEditor({` | 1583 | Sub-component reply templates |
| FieldLabel | `function FieldLabel({` | 1640 | Label + nút AI quick-replace |
| SuggestionInline | `function SuggestionInline({` | 1681 | Card EN+VI suggestions |
| buildPreloadedVoiceCtx | `function buildPreloadedVoiceCtx(post: BriefPost` | 1858 | CardVoiceContext từ post (tránh re-fetch) |
| PhaseTabStrip | `function PhaseTabStrip({` | 1914 | Tab strip sticky (Overview·5 phase·History·Detect) |
| PhaseEntryEditor | `function PhaseEntryEditor({` | 2003 | Edit 1 phase: goal/cadence/do/dont/hooks/mix |
| BriefPillarPicker | `function BriefPillarPicker({` | 2207 | Dropdown default content pillar |
| FormatMixEditor | `function FormatMixEditor({` | 2325 | Override format mix (%text/image/video) per phase |
| HooksEditor | `function HooksEditor({` | 2437 | Add/remove hook templates per phase |
| **PostsForPhase** | `function PostsForPhase({` | 2524 | Load + render card list + batch ops |
| handleCreateBatch3 | `const handleCreateBatch3 = () => {` | 2612 | 3 placeholder + batch-gen diversity |
| handleRegenBatch | `const handleRegenBatch = () => {` | 2635 | Regen N posts enforce diversity |
| **PostRow** | `function PostRow({` | 3048 | Card editor 1 post (title/bilingual body/media/AI) |
| genImg / genVariants | `const genImg = (modelId: string) => {` | 3107 | Gen ảnh / 3 variant / sequence |
| changeType | `const changeType = (newType: string) => {` | 3209 | Đổi content_type + auto title prefix |
| persist (post) | `const persist = (patch: {` | 3269 | Save post qua updatePost + onChange |
| handleGenerate (draft) | `const handleGenerate = (modelId: string)` | 3305 | generateFullDraft + sync local |
| handleAstrolas | `const handleAstrolas = () => {` | 3328 | Answer data-backed từ Astrolas engine |
| handleCritique | `const handleCritique = () => {` | 3347 | critiquePost — mod risk |
| handleSync (bilingual) | `const handleSync = (direction: 'r2t' \| 't2r')` | 3358 | Dịch target ↔ review |
| PostRow expanded body | `{expanded && (` | 3723 | Mở row → preview + media + AI buttons |

## components/accounts-vault.tsx (~3436) — vault quản lý account platform

Grid account + status filter + bulk ops + modal create/edit. `AccountsVault` = list cards quick-advance status; `AccountFormModal` = form 2-cột (trái essentials, phải collapsible: habitats/engine/profile/identity/grants/warmup...). Field-lock theo lifecycle status. Nhiều inline create modal (proxy/browser-profile/habitat).

| Section | Anchor | ~Line | Mục đích |
|---|---|---|---|
| LockNote | `function LockNote({ lock }` | 38 | Hiện lý do lock/note dưới field |
| STATUSES | `const STATUSES: { key: AccountStatus` | 101 | Status display từ registry |
| LINEAR_FLOW | `const LINEAR_FLOW: AccountStatus[]` | 184 | Tiến trình status (todo→creating→warming→active) |
| **accountFieldLock** (export) | `export function accountFieldLock(` | 154 | Field lock/editable theo status + lifecycle |
| SnippetCard | `function SnippetCard({ snippet, vars }` | 205 | Copy card + sub template var + length warn |
| BulkAssignPopover | `function BulkAssignPopover({` | 299 | Bulk assign/unassign all accounts → 1 member |
| QuickCreateProxyModal | `function QuickCreateProxyModal({ onClose, onCreated }` | 547 | Inline tạo proxy |
| QuickCreateBrowserProfileModal | `function QuickCreateBrowserProfileModal({ onClose, onCreated, proxies }` | 638 | Inline tạo browser profile |
| **AccountsVault** (export) | `export function AccountsVault({ projectId, project, platforms, accounts` | 736 | Vault chính — grid cards + filter + modals |
| handleQuickAdvance | `const handleQuickAdvance = (acc: AccountRow, dir: 1 \| -1)` | 786 | ←→ advance status theo LINEAR_FLOW |
| AccountMediaStrip | `function AccountMediaStrip({ accountId, handle }` | 956 | Lazy thumbnails avatar/banner |
| AccountProjectsSection | `function AccountProjectsSection({ accountId }` | 985 | Projects account joined; set primary; leave |
| **AccountFormModal** (export) | `export function AccountFormModal({ account, project, projectId, platforms` | 1045 | Modal create/edit account (2-cột) |
| setF (form helper) | `const setF = <K extends keyof typeof form>` | 1107 | Shorthand setState form |
| handleDetectEngine | `const handleDetectEngine = () => {` | 1153 | Auto-detect engine từ signup URL |
| **handleSave** | `const handleSave = (keepOpen = false) => {` | 1292 | Create/update account + env links |
| handleDelete | `const handleDelete = () => {` | 1338 | Delete + confirm 4s |
| handleToggleChecklist | `const handleToggleChecklist = (itemKey: string, currentDone: boolean)` | 1354 | Toggle warmup checklist |
| templateVars (useMemo) | `const templateVars = useMemo(() => ({` | 1414 | Context sub var snippet |
| LocalAccountsPickerSection | `function LocalAccountsPickerSection({` | 2442 | Pick account MOS2 sẵn (tránh dup) |
| DirectusImportSection | `function DirectusImportSection({` | 2583 | Import account từ Directus |
| AccountGrantsSection | `function AccountGrantsSection({ accountId, projectId, members }` | 2798 | Share account với agent/user |
| ApiTokenSection | `function ApiTokenSection({ projectId, accountId, hasToken }` | 2943 | Set/reveal/clear API token (pgcrypto) |
| AutoCheckButton | `function AutoCheckButton({ projectId, accountId }` | 3060 | Auto-fetch warmup metric từ API |
| SyncToDirectusButton | `function SyncToDirectusButton({` | 3101 | Push account → Directus (POST/PATCH) |
| AccountBriefsSection | `function AccountBriefsSection({` | 3149 | List briefs account; join toggle; phase badge |
| SyncBanner | `function SyncBanner({ projectId, accountId, platformLabel }` | 3381 | Fetch + update profile từ platform API |

## components/habitat-form-modal.tsx (~2976) — editor community (habitat)

Form modal 6-tab (overview/identity/outreach/rules/voice/channels) + URL persist. Multi-source rules extract (AI URL fetch / paste / append-replace). Channels lazy-load Discord/Slack/Telegram + dirty-flag + ext postMessage. Pre-save confirm archive orphan card. 5 sub-component inline (VoiceSection, FewShotRow, ChannelRow, ChannelBulkParser, BriefSelectorsLoader, HabitatBriefsSection).

| Section | Anchor | ~Line | Mục đích |
|---|---|---|---|
| KINDS const | `const KINDS = ` | 43 | Enum kind (subreddit/discord/forum...) |
| **Main export** | `export function HabitatFormModal(` | 51 | Component modal chính |
| readTabFromUrl | `const readTabFromUrl = ` | 80 | Parse ?habTab |
| switchTab | `const switchTab = ` | 96 | Sync URL + state đổi tab |
| confirmRemoval state | `const [confirmRemoval, setConfirmRemoval] = ` | 100 | Pre-save warn orphan card |
| Discord extractor state | `const [discordInvite, setDiscordInvite] = ` | 111 | Discord invite paste |
| **form state** | `const [form, setForm] = ` | 124 | HabitatInput — toàn field |
| setF | `const setF = ` | 167 | Helper setForm |
| channels state | `const [channels, setChannels] = ` | 175 | List channel Discord/Slack |
| channels fetch useEffect | `useEffect(() => {` | 189 | Load channels khi habitat đổi |
| ext message listener | `useEffect(() => {` | 214 | Listen mos2:habitat-updated |
| applyRulesParseResult | `const applyRulesParseResult = ` | 274 | Phân phối AI rules → form |
| handleFindRulesUrl | `const handleFindRulesUrl = ` | 291 | Đoán URL rules qua AI |
| handleFetchRulesFromUrl | `const handleFetchRulesFromUrl = ` | 309 | Fetch + parse rules URL |
| handleParsePastedRules | `const handleParsePastedRules = ` | 327 | Parse paste fallback |
| handleExtractDiscord | `const handleExtractDiscord = ` | 354 | Discord Invite API + auto-save |
| **doSave** | `const doSave = ` | 448 | Create/update habitat + tribes + channels |
| handleSave (pre-check) | `const handleSave = ` | 499 | Check orphan card trước save |
| handleDelete | `const handleDelete = ` | 520 | Soft-delete + confirm |
| Main JSX return | `return (` | 536 | Wrapper + tabs + forms |
| Tab bar | `<div role="tablist"` | 615 | Nav tab sticky |
| Overview 3-col grid | `<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,` | 738 | Layout chính overview |
| Identity tab | `{activeTab === 'identity' && (` | 1564 | Form identity fields |
| Outreach tab | `{activeTab === 'outreach' && (` | 1702 | Form outreach fields |
| Rules tab | `{activeTab === 'rules' && (` | 1752 | Rules + gates + topics |
| Voice tab | `{activeTab === 'voice' && (` | 1825 | Voice profile + notes + few-shot |
| Channels tab | `{activeTab === 'channels' && (` | 1897 | Channels section đầy đủ |
| confirmRemoval dialog | `{confirmRemoval && (` | 1999 | Dialog pre-save orphan |
| **VoiceSection** | `function VoiceSection(` | 2069 | Voice profile + few-shot + visual style |
| inferVisualStyle | `const inferVisualStyle = async` | 2092 | Vision API mô tả icon habitat |
| FewShotRow | `function FewShotRow(` | 2234 | Editor 1 few-shot example |
| ChannelRow | `function ChannelRow(` | 2296 | Editor 1 channel row |
| ChannelBulkParser | `function ChannelBulkParser(` | 2548 | Paste/screenshot → AI extract channels |
| BriefSelectorsLoader | `function BriefSelectorsLoader(` | 2685 | Wrapper fetch briefs |
| HabitatBriefsSection | `function HabitatBriefsSection(` | 2725 | List account engaging + add button |

## components/seeding-cockpit.tsx (~2961) — cockpit lịch seeding account×habitat

Command-center: queue view (overdue/due/upcoming), modal brief/account/habitat URL-synced, lane-grouped table + action menu, collapsible sections (cần tạo/join account, dead account). Pattern: `useModalParam()` cho nested modal, nhiều `useMemo` filter/group, sub-render inline (`RowTable`/`Row`/`Bucket`), module-scope loader (`BriefModalLoader`/`AccountModalLoader`/`HabitatModalLoader`).

| Section | Anchor | ~Line | Mục đích |
|---|---|---|---|
| BriefLaneGroup interface | `interface BriefLaneGroup {` | 99 | Group lanes per brief + metrics |
| **Main export** | `export function SeedingCockpit({` | 107 | Entry — project/queue/tribes/habitats/accounts/modals |
| view state + URL sync | `const [view, setView] = useState<'queue'` | 132 | 5-tab (queue/posts/habitats/accounts/today) |
| filter/issue state | `const [issueFilter, setIssueFilter]` | 150 | Filter + search + multi-select |
| retiring state | `const [retiring, setRetiring] = useState<` | 158 | Confirm panel retire dead account |
| BriefFocus type | `type BriefFocus = { briefId: number;` | 204 | URL-sync phase+cardId deep-link modal |
| doAutoFix | `const doAutoFix = (it: SeedingQueueItem)` | 277 | Auto-fix platform mismatch account |
| Modal ID resolvers | `const editingBriefId = modal.is('schedule')` | 299 | Extract briefModalId/tribeModalId/pipelineId/acctModalId |
| searchOnly useMemo | `const searchOnly = useMemo(() => {` | 311 | Filter queue search + multi-select |
| needAccountGroups | `const needAccountGroups = useMemo(() => {` | 370 | Group brief cần tạo account |
| needJoinGroups | `const needJoinGroups = useMemo(() => {` | 409 | Group brief account active chưa join |
| deadGroups | `const deadGroups = useMemo(() => {` | 448 | Group brief theo dead account ID |
| buckets useMemo | `const buckets = useMemo(() => {` | 492 | Partition overdue/due/week/later/rest |
| groupLanesByBrief | `const groupLanesByBrief = (items:` | 507 | Group lane theo brief ID + sum metrics |
| stats useMemo | `const stats = useMemo(() => {` | 542 | Header stats (total/needAction/touches/adherence) |
| doGenerate | `const doGenerate = () => {` | 582 | Gen due drafts cho all overdue |
| doRetire | `const doRetire = () => {` | 616 | Mark banned + pause schedules |
| doRevive | `const doRevive = (accountId: number,` | 634 | Revive dead → resume schedules |
| **RowTable** (inline) | `const RowTable = (g: BriefLaneGroup) => {` | 658 | Render table row (Bucket): ID/Account×Habitat/Status/Metrics/Actions |
| **Row** (inline) | `const Row = (it: SeedingQueueItem) => {` | 1014 | Render flex card (Today tab) |
| **Bucket** (inline) | `const Bucket = ({ title, items, accent }` | 1317 | Collapsible bucket section |
| NeedJoinSection | `const NeedJoinSection = ({ groups,` | 1376 | Brief account-ready chưa join, group platform |
| NeedAccountSection | `const NeedAccountSection = ({ groups,` | 1497 | Brief cần tạo account, group platform |
| Main return JSX | `return (` | 1735 | Page container + tabs + filters + sections |
| Tab bar | `<div role="tablist"` | 1768 | 5-tab switcher |
| Queue buckets render | `{view === 'queue' && bucketsByBrief &&` | 2058 | Render 5 Bucket section |
| Modal: Brief editor | `{briefModalId != null && (` | 2094 | BriefModalLoader (URL-sync focus) |
| Modal: Pipeline | `{pipelineId != null && (` | 2109 | BriefPipelineModal |
| Modal: Account overlay | `{acctModalId != null && (` | 2166 | AccountModalLoader chồng on brief |
| Modal: Habitat overlay | `{habitatOverlayId != null && (` | 2193 | HabitatModalLoader |
| Modal: Retire confirm | `{retiring && (` | 2265 | Panel confirm retire account |
| **BriefModalLoader** | `function BriefModalLoader({ projectId, briefId,` | 2324 | Fetch BriefRow+ctx → render BriefEditModal |
| handlePostsChanged | `const handlePostsChanged = () => {` | 2346 | Debounce reload khi posts mutate (350ms) |
| **AccountModalLoader** | `function AccountModalLoader({ projectId,` | 2453 | Loader account modal (getAccountForEdit) |
| RecentPostedSection | `function RecentPostedSection({ cards,` | 2514 | Collapsible card posted <7d cross-brief |
| BriefMetricsChip | `function BriefMetricsChip({ it, onOpen }` | 2686 | Nút summary metric (posts/insights/last) |
| timeAgoShort | `function timeAgoShort(d: Date): string {` | 2797 | Format "1m trước"/"3d trước" |
| **HabitatModalLoader** | `function HabitatModalLoader({ projectId,` | 2806 | Loader habitat modal → HabitatFormModal |
