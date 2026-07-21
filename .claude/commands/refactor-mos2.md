---
description: Refactor a MOS2 file/area to the house standard — language, color tokens, font scale, shared UI primitives, drawer/modal patterns. Defaults to recently-changed files.
argument-hint: "[file|dir|area]  (empty = git-changed files since last commit)"
---

Standardize MOS2 (earns-marketing-os-v2) code to the house conventions. Target: **$ARGUMENTS**
If empty, target every file changed since the last commit: run `git status --porcelain` + `git diff --name-only HEAD` and refactor those (focus on `apps/web/src/**`).

Do NOT change behavior or logic. This is a CONSISTENCY pass only: same output, same data flow, standardized surface. Never invent new copy — only re-token colors, re-scale sizes, swap primitives, translate stray-language strings, tighten patterns.

## Ground truth — READ before editing (never guess)
1. **Tokens:** `apps/web/src/app/globals.css` — the ONLY allowed colors. `--bg-0/1/2/3/4`, `--fg-0/1/2/3/4`, `--line`/`--line-2`/`--line-strong`, `--accent`/`--accent-line`/`--accent-soft`, `--bad`, `--neon-lime/cyan/amber/violet/blue/pink/red`. Fonts: `--font-sans`/`--font-mono`/`--font-display`.
2. **Primitives:** `apps/web/src/components/ui/index.ts` — the shared components. Read the ones you'll use (`FormField`/`TextField`/`TextAreaField`/`SelectField`/`DateTimeField` + `fieldStyle`/`labelStyle`, `ModalHeader`, `Section`, `Pill`/`StatusPill`/`StatusBadge`, `Drawer`, `Collapsible`, `ConfirmDeleteButton`, `Segmented`, `EmptyState`, `Spinner`, `InfoHint`, `ResourcePicker`/`EntityPicker`, `GuardedButton`, icons).
3. **Neighbor standard:** open the closest already-blessed sibling of the target (same folder / same domain drawer) and MATCH it. For an outreach drawer → `EmailDrawer`/`OutreachEmailBody`. For a backlink surface → `backlinks-page.tsx`. Copy its exact style constants, not your own.
4. **Conventions:** project skill `project-patterns` + `.claude/contexts/` + repo `CLAUDE.md` + user memory feedback (modal-first, stacked-drawer via `backgrounded`, no native `alert/confirm/prompt`, HoverTip 0ms not `title` where a tip already exists, action-verb vs status-noun, compact-pill+tooltip, searchable-select for long lists).

## Checklist to enforce
- **Language:** internal admin UI (labels, buttons, hints, toasts) = **tiếng Việt có dấu**. PUBLIC-facing generated content (email/DM/comment/post copy, landing) = **English only**. Fix stray English admin labels → Vietnamese; never Vietnamize public content or i18n/locale data.
- **Color:** replace every hardcoded hex / `rgb()` / named color with the matching token. Accent = `--accent` (not a random neon) unless the neighbor deliberately uses a neon for a semantic (lime=go/success, amber=pending, bad=danger, cyan/violet=channel). Backgrounds `--bg-*`, text `--fg-*`, borders `--line*`. A colored background MUST set its paired foreground (see feedback_accent_bg_needs_fg).
- **Font size:** match the scale — label 10 (mono, uppercase, `.06em`), micro 8-9 (ext only), small 11-11.5, body 12-13, title 15-16 (drawer h2 800). No off-scale sizes (e.g. 14, 17). Labels use `var(--font-mono)`.
- **Primitives over hand-roll:** raw `<input>/<select>/<textarea>` with ad-hoc styles → `TextField`/`SelectField`/`TextAreaField` (or `fieldStyle()`); ad-hoc label spans → `labelStyle`/`FormField`; bespoke status chips → `Pill`/`StatusBadge`; bespoke modal header → `ModalHeader`; new slide-over → shared `Drawer` (stacking via `backgrounded`, never a second hand-rolled fixed-inset shell); confirm buttons → `ConfirmDeleteButton`; **action buttons gated on input** (send/submit/save/mark-done that must NOT fire until a precondition holds — non-empty body, a pick made) → `GuardedButton` (`reason={cond ? 'vì sao chặn' : ''}` — disables + explains on hover; NEVER a bare `disabled` with no reason, nor a silent `onClick` no-op / toast-then-return); **entity pickers** → `ResourcePicker` (pick or delegate-create) / `EntityPicker` (pick + inline create/rename/delete + rich rows: avatar·badge·meta) — NEVER hand-roll a `<select>`+add-input (the send-as picker was bespoke → standardized onto `EntityPicker` 2026-07-21; `send-as-picker.tsx` is the reference wrapper: map your rows → `EntityOption{key,label,sub,avatar,badge,match,editable,data}` + wire `load`/`onPick`/`onCreate`/`onRename`/`onDelete`). Reuse the neighbor's `btn`/`lbl`/`inputStyle`/`taStyle` constants verbatim rather than defining new ones.
- **Patterns:** no native `alert/confirm/prompt`; destructive = confirm + undo; every icon/badge has a tooltip; openable → opens immediately; result renders in-widget, not a floating pop.

## Do
1. Resolve the target list. For each file: read it + its neighbor standard + the primitives it should use.
2. Produce a short findings list (what's off: hardcoded colors N, off-scale sizes N, hand-rolled inputs N, English admin strings N, bespoke drawer/modal, …).
3. Apply the fixes (Edit), preserving behavior. Prefer swapping to a shared primitive over re-styling inline.
4. `npx tsc --noEmit -p apps/web/tsconfig.json` must stay green. Bump ext `manifest.json`+`VERSION` if you touched `earns-dashboard` ext files.
5. Report: per-file what changed, and deploy (git push → GHA) only if the user's flow already authorized it.

Be surgical. If a file is already conformant, say so and skip it — don't churn.
