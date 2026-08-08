export { Pill, PriorityPill, EffortPill, StatusPill, type PillProps, type Priority, type Effort, type StatusMeta } from './pill';
export { StatsStrip, type StatCard } from './stats-strip';
export { EmptyState } from './empty-state';
export { Spinner, type SpinnerSize } from './spinner';
export { LinkChip, type ChipTone, type ChipSize } from './link-chip';
export { Segmented, type SegmentedOption } from './segmented';
export { StatusSegmented, type StatusOption } from './status-segmented';
export { MonthCalendar, type CalItem, type CalMode, type LegendEntry, type CalBrief } from './month-calendar';
export { ViewToggle, LIST_CALENDAR_VIEWS, type ViewOption } from './view-toggle';
export { CTACard, type CTATone } from './cta-card';
export { ResourcePicker, type ResourcePickerProps, type PickerItem } from './resource-picker';
// CampaignLinkPicker = pick a link from the /offers (affiliate) + /products catalog, or paste a URL.
// Self-fetches via listCampaignLinks(). Reuse anywhere a field wants "which offer/product link".
export { CampaignLinkPicker } from './campaign-link-picker';
// EmailSendPrep = send-ready package for a 📧 email-issue task (real email detail + list + send
// time + offer). Reads prep_payload.email. Standard surface across every email card.
export { EmailSendPrep } from './email-send-prep';
// EntityPicker = pick + inline CRUD (create/rename/delete) + rich rows (avatar/badge/meta). Use over
// ResourcePicker when the picker also owns create/rename/delete. See feedback_picker_inline_crud.
export { EntityPicker, type EntityOption, type EntityPickerProps } from './entity-picker';
// EntityRef = THE one way to render a reference to another entity (account/proxy/profile/task/…) as a
// clickable chip that opens its drawer. NEVER hand-roll `<span>{acc.handle}</span>` or a local EntityLink.
// See ui-conventions §4. Lint bans re-defining a local entity chip/link.
export { EntityRef, type EntityKind, type EntityRefProps } from './entity-ref';
// ProjectAssign = THE many-to-many "assign entity → N projects" field (chips + inline add-picker +
// optional ★ primary). Account drawer AND browser-profile drawer share it. NEVER hand-roll a
// project <select> + chips again. See ui-conventions §2.
export { ProjectAssign, type ProjectRef, type ProjectAssignProps } from './project-assign';
// GuardedButton = the standard for "can't submit until precondition holds" (empty content, missing pick…).
// Disables + explains on hover instead of a bare disabled / silent no-op. See feedback_guarded_action_button.
export { GuardedButton } from './guarded-button';
export {
  IconPlatform, IconCommunity, FormatIcon, type FormatKind,
  IconFilePlus, IconList, IconCheck, IconBan, IconGear, IconUndo,
  IconTrash, IconGlobe, IconClock, IconSparkles, IconSliders, IconChevron, IconWarn, IconSwap, IconPencil, IconDots,
  IconUser, IconX, IconLock, IconInfo,
} from './icons';
export { ModalHeader, type ModalKind } from './modal-header';
export { InfoHint } from './info-hint';
export { SiteFavicon } from './site-favicon';
export {
  FormField, TextField, SelectField, TextAreaField, DateTimeField,
  fieldStyle, labelStyle, toDatetimeLocal,
  type FieldSize, type FormFieldProps, type TextFieldProps,
  type SelectFieldProps, type TextAreaFieldProps,
} from './form-field';
export { StatusBadge, type StatusBadgeProps } from './status-badge';
export {
  FormModal, FormModalFooter, FormModalSection,
  type FormModalProps, type ModalWidth,
} from './form-modal';
export { Section, type SectionProps } from './section';
// Panel = THE dashboard card (dark card + hairline border + `// mono` subtitle + right actions).
// ~50 places hand-rolled this shell; use <Panel> instead. Extracted from the SEO Sites Overview
// panel (the reference — that file stays untouched). Server-compatible. See ui-conventions §7.
export { Panel } from './panel';
// DataTable = data-DENSE table (many columns w/o overflow): dense mono cells + show/hide column
// GROUPS + horizontal-scroll containment. Lifted from the SEO Sites Overview table (the reference,
// untouched). Use for any wide/data-heavy table. See ui-conventions §7.
export { DataTable, type DataColumn, type DataGroup } from './data-table';
// SimpleTable = small/narrow display table (top-N lists, breakdowns) — consistent compact cells,
// no toggle/scroll-box. Server-compatible. Use over a hand-rolled <table>+th/td. See §7.
export { SimpleTable, type SimpleColumn } from './simple-table';
export { ConfirmDeleteButton, type ConfirmDeleteButtonProps } from './confirm-delete-button';
export { Collapsible } from './collapsible';
export { MultiSelect, type MultiSelectOption, type MultiSelectProps } from './multi-select';
// list-view = shared toolbar + pagination for vault list pages (offers, communities, contacts, …).
// usePaged (client pagination), Pager, ListToolbar (filter row shell), FilterChips (Segmented +
// counts, YDNI single-accent), SearchInput. NEVER hand-roll `chip()`/search `<input>`/full-array
// render again — see ui-conventions §5.
export { usePaged, Pager, ListToolbar, FilterChips, SearchInput, type ChipOption } from './list-view';
export { StatusFlag, type StatusFlagProps, type StatusFlagTone, type StatusFlagSize } from './status-flag';
// Right-side slide-over with built-in ESC/click-outside close + stacking
// (backgrounded = slide left + dim). See feedback_stacked_drawer.
export { Drawer } from './drawer';
// Note: feedback_picker_inline_crud.md — every entity picker should use
// <ResourcePicker> + filter by relevant context (platform, project, role)
// instead of dumping the full list and forcing the user to search.
