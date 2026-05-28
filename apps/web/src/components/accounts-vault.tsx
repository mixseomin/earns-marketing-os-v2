'use client';

import { useState, useTransition, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useModalParam } from '@/lib/use-modal-param';
import { JOIN_STATUS_LABEL, JOIN_STATUS_COLOR, JOIN_STATUS_ICON } from '@/lib/join-status';
import { PHASE_LABEL, PHASE_COLOR } from '@/lib/phase-plan';
import { PhasePill } from './phase-pill';
import type { PlatformRow, AccountRow } from '@/lib/data';
import type { Project } from '@/lib/mock/types';
import {
  createAccount, updateAccount, deleteAccount, setAccountStatus, toggleChecklistItem,
  listAccountsForProjectByPlatform,
  listDirectusAccountsForPlatform, importDirectusAccount, pushAccountToDirectus,
  setAccountApiToken, revealAccountApiToken, clearAccountApiToken,
  listAccountGrants, addAccountGrant, removeAccountGrant, listProjectAgentsForGrant,
  type AccountStatus, type AuthMethod, type DirectusAccountSummary, type AccountGrantRow,
} from '@/lib/actions/accounts';
import { assignAccountsToMember, enableResourcesForMember } from '@/lib/actions/assignments';
import { runAccountAutoCheck, type AutoCheckReport } from '@/lib/actions/warmup';
import {
  updateAccountEnvironment, createProxy, createBrowserProfile,
  type ProxyRow, type BrowserProfileRow, type ProxyType, type ProfileTool,
} from '@/lib/actions/environments';
import { Pill, EmptyState, Spinner, Segmented, CTACard, ResourcePicker, ModalHeader, IconLock, IconPencil, StatusBadge, SiteFavicon, fieldStyle, labelStyle, Collapsible } from './ui';
import {
  ACCOUNT_STATUS_META, ACCOUNT_STATUS_GROUPS, accountStatusMeta, accountStatusGroupOf,
  type AccountStatusGroup,
} from '@/lib/status-meta';
import { useCopyToClipboard } from '@/lib/use-copy-clipboard';

// Dòng ghi chú dưới field: 🔒 lý do khoá, hoặc ✎ nhắc điền nốt khi trống.
function LockNote({ lock }: { lock: { why: string; fillNote?: string } }) {
  if (lock.why) {
    return (
      <div style={{ marginTop: 3, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)',
                    display: 'flex', alignItems: 'center', gap: 4 }}>
        <IconLock size={10} /> {lock.why}
      </div>
    );
  }
  if (lock.fillNote) {
    return (
      <div style={{ marginTop: 3, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--warn)',
                    display: 'flex', alignItems: 'center', gap: 4 }}>
        <IconPencil size={10} /> {lock.fillNote}
      </div>
    );
  }
  return null;
}
import {
  listBriefsForAccount, listAddableHabitatsForAccount,
  type BriefForAccount,
} from '@/lib/actions/community-briefs';
import { listTribesForProject } from '@/lib/actions/tribes-crud';
import type { TribeRow } from '@/lib/data';
import { BriefEditModal } from './brief-edit-modal';
import { HabitatFormModal } from './habitat-form-modal';
import { ExternalLink } from './external-link';
import { profileUrlFor } from '@/lib/platform-profile-urls';
import { fillTemplate } from '@/lib/template';
import { AIFormParser } from './ai-form-parser';
import { NoFillInput } from './no-fill-input';
import { PlatformPicker } from './platform-picker';
import { OwnerSelect } from './owner-select';
import { PlatformFormModal } from './platform-form-modal';
import { updatePlatform, type PlatformWithUsage } from '@/lib/actions/platforms';
import { getEffectiveSignupFields, listTechnologies, upsertTechnology, detectTechnologyFromUrl, type SignupField, type TechnologyRow } from '@/lib/actions/technologies';
import { TechnologyPicker, SignupFieldsChecklist, SignupFieldsBuilder, type SignupFieldDef } from './technology-picker';
import { wrapExternalUrl } from '@/lib/external-url';

// ──────────────────────────────────────────────────────────────────────
// STATUS MODEL (2 cấp — đừng nhầm lẫn):
//   Cấp 1: platform_accounts.status = "account này CÓ DÙNG ĐƯỢC trên platform không?"
//          KHÔNG mô tả per-habitat. Setup/warmup ở đây là GLOBAL (đủ tuổi
//          account, đủ karma min, qua KYC, không bị rate-limit).
//   Cấp 2: community_briefs.currentPhase = "account này đang ở phase nào
//          TRONG TỪNG community" (warm-up/value/bridge/seed/direct/cooldown).
//          → Sửa ở Brief modal của habitat, không phải ở đây.
//
// UI gom 7 DB status thành 4 nhóm hiển thị + sub-reason cho locked:
//   setup   = todo | creating   (chưa setup xong — chưa có cred / chưa verify)
//   warming = warming           (đã có account, đang đợi đủ tuổi/karma GLOBAL)
//   ready   = active            (đủ điều kiện → có thể assign vào community)
//   locked  = limited|blocked|banned (platform khoá — có lockReason)
// ──────────────────────────────────────────────────────────────────────

// STATUSES + STATUS_GROUPS đã centralize trong @/lib/status-meta. Build local
// shape compat (giữ shape cũ {key, label, color, dot, hint}) từ registry để
// các chỗ dùng cũ không phải sửa cấu trúc.
// AccountStatus ở @/lib/actions/accounts có 7 keys; ACCOUNT_STATUS_META mở
// rộng thêm dormant/defunct (legacy). Lọc dormant/defunct và cast về local
// AccountStatus union để tương thích các callsite cũ trong file.
const STATUSES: { key: AccountStatus; label: string; color: string; dot: string; hint: string }[] =
  Object.entries(ACCOUNT_STATUS_META)
    .filter(([k]) => k !== 'dormant' && k !== 'defunct')
    .map(([key, m]) => ({
      key: key as AccountStatus, label: m.label, color: m.color,
      dot: String(m.icon ?? ''), hint: m.hint ?? '',
    }));

// 4 display groups — adapter để JSX cũ dùng tiếp shape array.
type StatusGroup = AccountStatusGroup;
const STATUS_GROUPS = (Object.entries(ACCOUNT_STATUS_GROUPS) as Array<[StatusGroup, typeof ACCOUNT_STATUS_GROUPS[StatusGroup]]>)
  .map(([key, g]) => ({
    key, label: g.label, dot: String(g.icon ?? ''), color: g.color,
    tooltip: g.tooltip, members: g.members,
  }));

const groupOf = accountStatusGroupOf;

const AUTH_METHODS: { key: AuthMethod; label: string }[] = [
  { key: 'password',     label: 'Password' },
  { key: 'sso-google',   label: 'SSO Google' },
  { key: 'sso-github',   label: 'SSO GitHub' },
  { key: 'sso-x',        label: 'SSO X' },
  { key: 'sso-linkedin', label: 'SSO LinkedIn' },
  { key: 'sso-facebook', label: 'SSO Facebook' },
  { key: 'sso-apple',    label: 'SSO Apple' },
  { key: 'magic-link',   label: 'Magic link' },
  { key: 'passkey',      label: 'Passkey' },
  { key: 'phone-otp',    label: 'Phone OTP' },
];

const BLOCK_REASONS = [
  { key: 'geo-block',    label: 'Geo-block (VN IP)' },
  { key: 'kyc-fail',     label: 'KYC / phone verify fail' },
  { key: 'waitlist',     label: 'Waitlist / invitation only' },
  { key: 'suspend-loop', label: 'Auto-suspended after create' },
  { key: 'not-worth',    label: 'Platform not worth effort' },
  { key: 'other',        label: 'Other' },
];

// ── Field policy theo lifecycle status ─────────────────────────────
// Quy tắc: field định danh chỉ sửa khi account CHƯA "live" trên nền tảng.
// banned/blocked = account ngưng → field vận hành chỉ-đọc (lịch sử),
// chỉ status/blockReason/notes/tags còn sửa (để revive/ghi chú).
//   platform : chỉ TODO (đổi platform = account khác)
//   handle   : chỉ TODO / CREATING (định danh live khi WARMING+)
//   email    : TODO / CREATING / WARMING
//   security : authMethod/has2fa/recovery — mọi status trừ blocked/banned
//   status   : LUÔN sửa (state-machine driver)
// QUAN TRỌNG: lock chỉ chống SỬA giá trị đã có (chống drift). Field ĐANG
// TRỐNG luôn cho điền (data thiếu cần bù) — kèm fillNote "sẽ khoá sau lưu".
type AcctField = 'platform' | 'handle' | 'email' | 'security';
export interface FieldLock { locked: boolean; why: string; fillNote?: string }
export function accountFieldLock(
  field: AcctField, status: AccountStatus, isCreate: boolean, value?: string | null,
): FieldLock {
  if (isCreate) return { locked: false, why: '' };
  const dead = status === 'blocked' || status === 'banned';
  const lockBy: Record<AcctField, boolean> = {
    platform: status !== 'todo',
    handle: !(status === 'todo' || status === 'creating'),
    email: !(status === 'todo' || status === 'creating' || status === 'warming'),
    security: dead,
  };
  const whyBy: Record<AcctField, string> = {
    platform: 'Đổi platform = account khác — chỉ sửa khi status TODO',
    handle: 'Handle là định danh live trên nền tảng — chỉ sửa khi TODO/CREATING',
    email: 'Email account đã chốt — chỉ sửa khi TODO/CREATING/WARMING',
    security: 'Account ngưng — chỉ xem (lịch sử). Đổi status để mở lại.',
  };
  const wantLock = lockBy[field];
  if (!wantLock) return { locked: false, why: '' };
  // Trống → vẫn cho điền (không chặn data thiếu), báo sẽ khoá sau khi lưu.
  if (!value || !String(value).trim()) {
    return { locked: false, why: '', fillNote: 'Đang trống — điền nốt cho đủ (status này sẽ khoá field sau khi lưu).' };
  }
  return { locked: true, why: whyBy[field] };
}

const PRIORITY_COLOR: Record<string, string> = {
  critical: '#f87171', high: '#fbbf24', medium: '#a1a1aa',
};

const LINEAR_FLOW: AccountStatus[] = ['todo', 'creating', 'warming', 'active'];

function PlatformIcon({ slug, size = 14 }: { slug: string; size?: number }) {
  if (!slug) return null;
  return (
    <img
      src={`https://cdn.simpleicons.org/${slug}/d4d4d8`}
      alt="" width={size} height={size}
      style={{ flexShrink: 0, opacity: 0.85, verticalAlign: 'middle' }}
    />
  );
}

function StatusPill({ status }: { status: string }) {
  return <StatusBadge meta={accountStatusMeta(status)} size="xs" />;
}

// ──────────────────────────────────────────────────────────────────────
// SnippetCard — single ready-to-paste content snippet with variable
// substitution + copy-to-clipboard + length warning + alt fallback chips.
// ──────────────────────────────────────────────────────────────────────
function SnippetCard({ snippet, vars }: {
  snippet: { label: string; text: string; maxLen?: number; alt?: string[] };
  vars: Record<string, string | undefined | null>;
}) {
  const [variant, setVariant] = useState<number>(-1); // -1 = primary text; 0..n-1 = alt[index]
  const [copied, setCopied] = useState(false);

  const rawText = variant === -1 ? snippet.text : (snippet.alt?.[variant] ?? snippet.text);
  const text = fillTemplate(rawText, vars);
  const overLimit = snippet.maxLen != null && text.length > snippet.maxLen;

  const [copyErr, setCopyErr] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopyErr(true);
      setTimeout(() => setCopyErr(false), 2500);
    }
  };

  return (
    <div style={{
      padding: '6px 8px',
      background: 'var(--bg-2)',
      border: `1px solid ${overLimit ? 'rgba(248,113,113,.4)' : 'var(--line)'}`,
      borderRadius: 5,
      fontSize: 11.5,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          📄 {snippet.label}
        </span>
        {snippet.maxLen != null && (
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: overLimit ? 'var(--bad)' : 'var(--fg-3)' }}>
            {text.length}/{snippet.maxLen}{overLimit ? ' ⚠' : ''}
          </span>
        )}
        <span style={{ flex: 1 }} />
        {snippet.alt && snippet.alt.length > 0 && (
          <Segmented
            size="xs"
            value={variant}
            onChange={setVariant}
            options={[
              { value: -1, label: '1', title: 'Primary' },
              ...snippet.alt.map((_, i) => ({ value: i, label: String(i + 2), title: `Alt ${i + 1} (shorter)` })),
            ]}
          />
        )}
        <button type="button"
                onClick={handleCopy}
                className="btn"
                title={copyErr ? 'Clipboard bị chặn — chọn text + Cmd/Ctrl+C thủ công' : 'Copy to clipboard'}
                style={{
                  fontSize: 10, padding: '2px 8px',
                  background: copied ? 'rgba(16,185,129,.1)' : copyErr ? 'rgba(255,77,94,.1)' : undefined,
                  borderColor: copied ? 'rgba(16,185,129,.4)' : copyErr ? 'rgba(255,77,94,.4)' : undefined,
                  color: copied ? '#10b981' : copyErr ? 'var(--bad)' : undefined,
                }}>
          {copied ? '✓ Copied' : copyErr ? '⚠ blocked' : '📋 Copy'}
        </button>
      </div>
      <pre style={{
        margin: 0, padding: 6,
        background: 'var(--bg-1)',
        border: '1px solid var(--line)',
        borderRadius: 4,
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        lineHeight: 1.5,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        color: 'var(--fg-1)',
      }}>{text}</pre>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Collapsible — re-used trong modal để ẩn các nhóm ít dùng (advanced,
// notes, warmup checklist, image specs). Open/close không persist —
// reset mỗi lần mở modal vì điều quan trọng là default closed.
// ──────────────────────────────────────────────────────────────────
// ──────────────────────────────────────────────────────────────────
// BulkAssignPopover — thay thế <select> "Giao cho..." cũ. Click button
// → mở popover có search + danh sách members. Scale tốt với 10+ members.
// ──────────────────────────────────────────────────────────────────
// VAULT-LEVEL assign: giao quản lý TOÀN BỘ vault Accounts cho 1 member.
// Per-account override → vẫn dùng dropdown "Assigned to manage" trong từng
// account modal. Đây là tab-level shortcut: 1 click = "X chịu trách nhiệm
// quản lý vault Accounts của project này".
function BulkAssignPopover({
  members, accountIds, accountCount, projectId, onDone, currentCounts = {},
}: {
  members: import('@/lib/actions/team').TeamMemberRow[];
  accountIds: number[];          // ALL accounts của project (không phải filter)
  accountCount: number;
  projectId: string;
  onDone: () => void;
  // Map userId → số accounts của project hiện tại đang gắn cho user đó.
  // Giúp user thấy "Linh đã có 3 accounts" trước khi giao thêm.
  currentCounts?: Record<number, number>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  // 2-step confirm: pick member → show "Confirm assign N → X" inline
  // (KHÔNG dùng native confirm/alert — xem feedback_no_native_dialogs.md)
  const [pending, setPending] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        setOpen(false);
        setPending(null);
        setError(null);
        setSuccess(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => m.displayName.toLowerCase().includes(q) || (m.email ?? '').toLowerCase().includes(q));
  }, [members, query]);

  const pendingMember = pending != null ? members.find((m) => m.userId === pending) : null;
  // Toggle semantic: nếu member đang owned > 0 → action = unassign (clear).
  // Còn lại → action = assign all to them.
  // assignAccountsToMember(uid, [], projectId) hiện đang clear-then-assign,
  // nên truyền [] = chỉ clear → unassign hoàn hảo.
  const pendingOwned = pending != null ? (currentCounts[pending] ?? 0) : 0;
  const action: 'assign' | 'unassign' = pendingOwned > 0 ? 'unassign' : 'assign';

  const doAssign = async () => {
    if (pending == null) return;
    setBusy(true);
    setError(null);
    const ids = action === 'unassign' ? [] : accountIds;
    const res = await assignAccountsToMember(pending, ids, projectId);
    if (!res.ok) {
      setError(res.error || (action === 'unassign' ? 'Unassign failed' : 'Assign failed'));
      setBusy(false);
      return;
    }
    if (action === 'assign') await enableResourcesForMember(pending);
    setBusy(false);
    setSuccess(action === 'unassign'
      ? `Đã bỏ giao ${pendingOwned} account khỏi ${pendingMember?.displayName}`
      : `Đã giao ${accountIds.length} account cho ${pendingMember?.displayName}`);
    onDone();
    setTimeout(() => {
      setOpen(false);
      setPending(null);
      setSuccess(null);
      setQuery('');
    }, 1200);
  };

  return (
    <div ref={popRef} style={{ position: 'relative' }}>
      <button
        className="btn"
        onClick={() => { setOpen((o) => !o); setPending(null); setError(null); setSuccess(null); }}
        title={`Giao quản lý toàn bộ vault Accounts (${accountCount} account) cho 1 member. Per-account override trong account modal.`}
        style={{ fontSize: 11, padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
      >
        👤 Giao quản lý vault <span style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>({accountCount})</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 50,
          background: 'var(--bg-1)', border: '1px solid var(--line-strong)',
          borderRadius: 8, boxShadow: '0 12px 32px rgba(0,0,0,.5)',
          minWidth: 300, maxWidth: 380,
          display: 'flex', flexDirection: 'column',
        }}>
          {/* STEP 2: confirm */}
          {pending != null && pendingMember && (
            <div style={{ padding: '12px 14px' }}>
              {success ? (
                <div style={{ fontSize: 12, color: 'var(--ok)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  ✓ {success}
                </div>
              ) : (
                <>
                  {action === 'unassign' ? (
                    <>
                      <div style={{ fontSize: 12, color: 'var(--fg-1)', marginBottom: 6, lineHeight: 1.5 }}>
                        Bỏ giao <b>{pendingOwned} account</b> khỏi{' '}
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '2px 8px', borderRadius: 4,
                          background: 'rgba(255,176,60,.15)', color: 'var(--warn)',
                          fontWeight: 600,
                        }}>
                          <span style={{ fontSize: 9, opacity: 0.7 }}>{pendingMember.displayName.slice(0, 2).toUpperCase()}</span>
                          {pendingMember.displayName}
                        </span>
                        ?
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginBottom: 10, lineHeight: 1.4 }}>
                        {pendingOwned} account đang gắn cho member này sẽ trở về <b>không có owner</b>.
                        Member sẽ không còn thấy account này trong inbox của mình.
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 12, color: 'var(--fg-1)', marginBottom: 6, lineHeight: 1.5 }}>
                        Giao quản lý <b>vault Accounts</b> ({accountCount} account) cho{' '}
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '2px 8px', borderRadius: 4,
                          background: 'var(--accent-soft)', color: 'var(--accent)',
                          fontWeight: 600,
                        }}>
                          <span style={{ fontSize: 9, opacity: 0.7 }}>{pendingMember.displayName.slice(0, 2).toUpperCase()}</span>
                          {pendingMember.displayName}
                        </span>
                        ?
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginBottom: 10, lineHeight: 1.4 }}>
                        Tất cả {accountCount} account của project sẽ được gắn cho member này.
                        Muốn override per-account → mở từng account modal sau.
                      </div>
                    </>
                  )}
                  {error && (
                    <div style={{ fontSize: 11, color: 'var(--bad)', marginBottom: 8 }}>⚠ {error}</div>
                  )}
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button className="btn ghost" disabled={busy} onClick={() => { setPending(null); setError(null); }}
                      style={{ fontSize: 11, padding: '4px 10px' }}>Cancel</button>
                    <button
                      className={action === 'unassign' ? 'btn danger' : 'btn primary'}
                      disabled={busy}
                      onClick={doAssign}
                      style={{ fontSize: 11, padding: '4px 12px' }}
                    >
                      {busy ? '…' : action === 'unassign' ? 'Confirm unassign' : 'Confirm assign'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* STEP 1: pick member */}
          {pending == null && (
            <>
              <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--line)' }}>
                <div style={{ fontSize: 11, color: 'var(--fg-2)', marginBottom: 6 }}>
                  Giao quản lý <b>vault Accounts</b> ({accountCount}) cho:
                </div>
                <NoFillInput
                  autoFocus
                  placeholder={`Search ${members.length} members...`}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  style={{
                    width: '100%', padding: '5px 8px',
                    background: 'var(--bg-2)', border: '1px solid var(--line)',
                    borderRadius: 5, color: 'var(--fg-0)', fontSize: 12, outline: 'none',
                  }}
                />
              </div>
              <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                {filtered.length === 0 && (
                  <div style={{ padding: 14, fontSize: 11, color: 'var(--fg-3)', textAlign: 'center' }}>Không match</div>
                )}
                {filtered.map((m) => {
                  const owned = currentCounts[m.userId] ?? 0;
                  return (
                    <button
                      key={m.userId}
                      onClick={() => setPending(m.userId)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        width: '100%', padding: '7px 10px', textAlign: 'left',
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        color: 'var(--fg-1)', fontSize: 12, borderBottom: '1px dashed var(--line)',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-2)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span style={{
                        width: 22, height: 22, borderRadius: '50%',
                        background: owned > 0 ? 'var(--ok)' : 'var(--accent-soft)',
                        color: owned > 0 ? '#fff' : 'var(--accent)',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 700,
                      }}>
                        {m.displayName.slice(0, 2).toUpperCase()}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: 'var(--fg-0)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {m.displayName}
                        </div>
                        {m.email && (
                          <div style={{ fontSize: 10, color: 'var(--fg-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {m.email}
                          </div>
                        )}
                      </div>
                      {owned > 0 && (
                        <span title={`${m.displayName} đang quản lý ${owned} account. Click để bỏ giao.`}
                          style={{
                            fontFamily: 'var(--font-mono)', fontSize: 10,
                            padding: '1px 7px', borderRadius: 10,
                            background: 'rgba(16,185,129,.15)', color: 'var(--ok)',
                            fontWeight: 600,
                          }}>
                          {owned} owned · click to unassign
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// QuickCreate modals — small inline create cho proxy + browser profile.
// Pattern này cần refactor thành <ResourcePicker> generic sau (xem
// feedback_quick_create_picker.md trong memory).
// ──────────────────────────────────────────────────────────────────
function QuickCreateProxyModal({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    label: '',
    type: 'datacenter' as ProxyType,
    endpoint: '',
    location: '',
    notes: '',
  });
  const fld = fieldStyle();
  const lbl = labelStyle;
  const submit = () => {
    if (!form.label.trim() || !form.endpoint.trim()) {
      setError('Label + endpoint bắt buộc'); return;
    }
    setBusy(true); setError(null);
    startTransition(async () => {
      const res = await createProxy({
        label: form.label.trim(),
        type: form.type,
        endpoint: form.endpoint.trim(),
        location: form.location || null,
        notes: form.notes || null,
      });
      setBusy(false);
      if (!res.ok || !res.id) { setError(res.error || 'create failed'); return; }
      router.refresh();
      onCreated(res.id);
    });
  };
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) e.stopPropagation(); }}>
      <div className="modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>🔌 New proxy</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {error && (
          <div style={{ padding: '8px 14px', background: 'rgba(255,77,94,.08)', borderBottom: '1px solid rgba(255,77,94,.3)', color: 'var(--bad)', fontSize: 12 }}>⚠ {error}</div>
        )}
        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <span style={lbl}>Label *</span>
              <NoFillInput style={fld} placeholder="vd: Webshare US-1" value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })} />
            </div>
            <div>
              <span style={lbl}>Type *</span>
              <select style={fld} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ProxyType })}>
                <option value="datacenter">datacenter</option>
                <option value="residential">residential</option>
                <option value="mobile">mobile</option>
                <option value="isp">isp</option>
              </select>
            </div>
            <div>
              <span style={lbl}>Location</span>
              <NoFillInput style={fld} placeholder="US, VN, Global..." value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <span style={lbl}>Endpoint *</span>
              <NoFillInput style={fld} placeholder="http://user:pass@host:port"
                value={form.endpoint} onChange={(e) => setForm({ ...form, endpoint: e.target.value })} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <span style={lbl}>Notes</span>
              <textarea style={{ ...fld, minHeight: 50, resize: 'vertical' }}
                value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <div className="meta">Tạo proxy mới và chọn cho account</div>
          <div className="modal-foot-actions">
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            <button className="btn primary" onClick={submit} disabled={busy}>{busy ? '…' : 'Create proxy'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickCreateBrowserProfileModal({ onClose, onCreated, proxies }: {
  onClose: () => void;
  onCreated: (id: number) => void;
  proxies: ProxyRow[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    label: '',
    tool: 'multilogin' as ProfileTool,
    externalId: '',
    defaultProxyId: null as number | null,
    notes: '',
  });
  const fld = fieldStyle();
  const lbl = labelStyle;
  const submit = () => {
    if (!form.label.trim()) { setError('Label bắt buộc'); return; }
    setBusy(true); setError(null);
    startTransition(async () => {
      const res = await createBrowserProfile({
        label: form.label.trim(),
        tool: form.tool,
        externalId: form.externalId || null,
        defaultProxyId: form.defaultProxyId,
        notes: form.notes || null,
      });
      setBusy(false);
      if (!res.ok || !res.id) { setError(res.error || 'create failed'); return; }
      router.refresh();
      onCreated(res.id);
    });
  };
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) e.stopPropagation(); }}>
      <div className="modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>🦊 New browser profile</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {error && (
          <div style={{ padding: '8px 14px', background: 'rgba(255,77,94,.08)', borderBottom: '1px solid rgba(255,77,94,.3)', color: 'var(--bad)', fontSize: 12 }}>⚠ {error}</div>
        )}
        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <span style={lbl}>Label *</span>
              <NoFillInput style={fld} placeholder="vd: Reddit-US-Profile-1" value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })} />
            </div>
            <div>
              <span style={lbl}>Tool *</span>
              <select style={fld} value={form.tool} onChange={(e) => setForm({ ...form, tool: e.target.value as ProfileTool })}>
                <option value="multilogin">Multilogin</option>
                <option value="adspower">Adspower</option>
                <option value="genlogin">Genlogin</option>
                <option value="kameleo">Kameleo</option>
                <option value="chrome">Chrome (vanilla)</option>
                <option value="firefox">Firefox (vanilla)</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <span style={lbl}>External ID</span>
              <NoFillInput style={fld} placeholder="profile ID trong tool"
                value={form.externalId} onChange={(e) => setForm({ ...form, externalId: e.target.value })} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <span style={lbl}>Default proxy <span style={{ color: 'var(--fg-4)' }}>(optional)</span></span>
              <select style={fld} value={form.defaultProxyId ?? ''}
                onChange={(e) => setForm({ ...form, defaultProxyId: e.target.value ? Number(e.target.value) : null })}>
                <option value="">— none —</option>
                {proxies.map((p) => (
                  <option key={p.id} value={p.id}>{p.label} · {p.type}{p.location ? ` · ${p.location}` : ''}</option>
                ))}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <span style={lbl}>Notes</span>
              <textarea style={{ ...fld, minHeight: 50, resize: 'vertical' }}
                value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <div className="meta">Tạo profile mới và chọn cho account</div>
          <div className="modal-foot-actions">
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            <button className="btn primary" onClick={submit} disabled={busy}>{busy ? '…' : 'Create profile'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AccountsVault({ projectId, project, platforms, accounts, teamMembers = [], proxies = [], browserProfiles = [], isAdmin = true }: {
  projectId: string;
  project: Project;
  platforms: PlatformRow[];
  accounts: AccountRow[];
  teamMembers?: import('@/lib/actions/team').TeamMemberRow[];
  proxies?: ProxyRow[];
  browserProfiles?: BrowserProfileRow[];
  isAdmin?: boolean;
}) {
  const router = useRouter();
  // URL-synced modal (DEFAULT pattern — lib/use-modal-param.ts). F5 / share
  // → mở lại đúng modal account.  ?m=new | ?m=edit&mId=<accountId>
  const modal = useModalParam();
  const editingId = modal.is('edit') ? modal.numId : null;
  const creating = modal.is('new');
  // filterStatus chấp nhận: 'all', StatusGroup key (setup/warming/ready/locked),
  // hoặc AccountStatus thẳng (legacy URL param). Resolver xử lý cả 3 trường hợp.
  const [filterStatus, setFilterStatus] = useState<AccountStatus | StatusGroup | 'all'>('all');
  const [, startTransition] = useTransition();

  // Derive `editing` from latest accounts list so router.refresh() (e.g. after
  // toggling a warmup checkbox) feeds fresh data into the modal instead of a
  // stale snapshot. Without this, second click on a checkbox sends the same
  // value as the first and the toggle appears stuck.
  const editing = useMemo(
    () => (editingId == null ? null : accounts.find((a) => a.id === editingId) ?? null),
    [editingId, accounts],
  );
  const setEditing = (acc: AccountRow | null) => (acc ? modal.open('edit', acc.id) : modal.close());

  const platformMap = useMemo(() => Object.fromEntries(platforms.map((p) => [p.key, p])), [platforms]);
  // filterStatus có thể là 'all', tên 1 group (setup/warming/ready/locked) — match
  // theo group nếu tên trùng STATUS_GROUPS.key; ngược lại fall back match status thẳng.
  const filtered = (() => {
    if (filterStatus === 'all') return accounts;
    const grp = STATUS_GROUPS.find((g) => g.key === filterStatus);
    if (grp) return accounts.filter((a) => grp.members.includes(a.status as AccountStatus));
    return accounts.filter((a) => a.status === filterStatus);
  })();

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: accounts.length };
    // Count by display group (gộp 7 DB status thành 4 nhóm).
    for (const g of STATUS_GROUPS) {
      c[g.key] = accounts.filter((a) => g.members.includes(a.status as AccountStatus)).length;
    }
    return c;
  }, [accounts]);

  const handleQuickAdvance = (acc: AccountRow, dir: 1 | -1) => {
    const idx = LINEAR_FLOW.indexOf(acc.status as AccountStatus);
    if (idx < 0) return;
    const next = LINEAR_FLOW[Math.max(0, Math.min(LINEAR_FLOW.length - 1, idx + dir))];
    if (next === acc.status) return;
    startTransition(async () => {
      await setAccountStatus(projectId, acc.id, next!);
      router.refresh();
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--fg-3)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-2)' }}>{accounts.length} accounts · {platforms.length} platforms</span> · Đăng ký tài khoản trên các nền tảng. Click signup → mở tab mới với link đăng ký official.
          </p>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {teamMembers.length > 0 && accounts.length > 0 && (
              <BulkAssignPopover
                members={teamMembers}
                accountIds={accounts.map((a) => a.id)}
                accountCount={accounts.length}
                projectId={projectId}
                currentCounts={accounts.reduce((acc, a) => {
                  if (a.ownerUserId) acc[a.ownerUserId] = (acc[a.ownerUserId] ?? 0) + 1;
                  return acc;
                }, {} as Record<number, number>)}
                onDone={() => router.refresh()}
              />
            )}
            <button className="btn primary" onClick={() => modal.open("new")}>+ New account</button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="chip" data-active={filterStatus === 'all' || undefined} onClick={() => setFilterStatus('all')}>
          All <span style={{ marginLeft: 4, opacity: 0.6 }}>{counts.all}</span>
        </span>
        {STATUS_GROUPS.map((g) => (
          <span key={g.key} className="chip" data-active={filterStatus === g.key || undefined}
                onClick={() => setFilterStatus(g.key)}
                title={g.tooltip}
                style={{ color: filterStatus === g.key ? g.color : undefined, cursor: 'pointer' }}>
            {g.dot} {g.label} <span style={{ marginLeft: 4, opacity: 0.6 }}>{counts[g.key] ?? 0}</span>
          </span>
        ))}
        <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--fg-4)', fontStyle: 'italic' }}
              title="Account status = trạng thái tổng quan trên platform. Phase trong từng community (warm-up/seed/direct) quản ở Brief modal của habitat.">
          ℹ︎ phase per-community ở Brief
        </span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="🔐"
          title={accounts.length === 0 ? 'Chưa có account nào' : `Không có account nào ở status "${filterStatus}"`}
          description={accounts.length === 0 ? 'Tạo account đầu tiên để bắt đầu đăng ký các platform.' : undefined}
          action={accounts.length === 0 && isAdmin ? <button className="btn primary" onClick={() => modal.open("new")}>+ New account</button> : undefined}
          compact
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
          {filtered.map((acc) => {
            const pf = platformMap[acc.platformKey];
            const checklistDone = Object.values(acc.warmupChecklist || {}).filter((c) => c.done).length;
            const checklistTotal = pf?.checklist?.length ?? 0;
            const pct = checklistTotal > 0 ? Math.round((checklistDone / checklistTotal) * 100) : 0;
            return (
              <div key={acc.id} className="panel" style={{ cursor: 'pointer' }} onClick={() => setEditing(acc)}>
                <div className="panel-head" style={{ padding: '8px 12px' }}>
                  <div className="panel-title" style={{ fontSize: 12, gap: 6 }}>
                    <PlatformIcon slug={pf?.iconSlug ?? ''} size={14} />
                    {pf?.label ?? acc.platformKey}
                    {pf && (
                      <span style={{ fontSize: 9, padding: '0 4px', borderRadius: 3, background: PRIORITY_COLOR[pf.priority] + '22', color: PRIORITY_COLOR[pf.priority], fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
                        {pf.priority}
                      </span>
                    )}
                  </div>
                  <StatusPill status={acc.status} />
                </div>
                <div className="panel-body" style={{ padding: '8px 12px', fontSize: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ color: 'var(--fg-1)', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600 }}>
                      @{acc.handle || <em style={{ color: 'var(--fg-3)', fontStyle: 'italic' }}>no-handle</em>}
                    </span>
                    {acc.has2fa && <span title="2FA enabled" style={{ fontSize: 11 }}>🔐</span>}
                  </div>
                  {acc.email && <div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 4 }}>{acc.email}</div>}
                  {checklistTotal > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--fg-3)', marginBottom: 2 }}>
                        <span>Warmup</span><span>{checklistDone}/{checklistTotal} ({pct}%)</span>
                      </div>
                      <div style={{ height: 4, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? 'var(--ok)' : pct > 50 ? 'var(--warn)' : 'var(--accent)' }} />
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 4, marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
                    {/* PRIMARY CTA — depends on status:
                        todo/creating → Signup (đăng ký account chưa tồn tại)
                        active        → + Post (publish content)
                        khác          → no primary, chỉ secondary actions */}
                    {pf?.signupUrl && (acc.status === 'todo' || acc.status === 'creating') && (
                      <ExternalLink href={pf.signupUrl}
                         className="btn primary" style={{ fontSize: 10, padding: '3px 8px' }}>
                        ↗ Signup
                      </ExternalLink>
                    )}
                    {pf?.postUrl && acc.status === 'active' && (
                      <ExternalLink href={pf.postUrl}
                         className="btn primary" style={{ fontSize: 10, padding: '3px 8px' }}>
                        + Post
                      </ExternalLink>
                    )}
                    {/* SECONDARY: Profile link — neutral, chỉ icon + text */}
                    {acc.handle && (() => {
                      const profileUrl = profileUrlFor(acc.platformKey, acc.handle, pf?.profileUrlPattern);
                      return profileUrl ? (
                        <ExternalLink href={profileUrl}
                          title={`Mở profile @${acc.handle.replace(/^@+/, '')} trên ${pf?.label}`}
                          className="btn ghost" style={{ fontSize: 10, padding: '3px 8px', color: 'var(--fg-2)' }}>
                          ↗ Profile
                        </ExternalLink>
                      ) : null;
                    })()}
                    {/* Status step nav — neutral, để KHÔNG cạnh tranh với CTA Signup/Post */}
                    {LINEAR_FLOW.includes(acc.status as AccountStatus) && acc.status !== 'todo' && (
                      <button className="btn ghost" style={{ fontSize: 10, padding: '3px 8px', color: 'var(--fg-3)' }} title="Step back" onClick={() => handleQuickAdvance(acc, -1)}>←</button>
                    )}
                    {LINEAR_FLOW.includes(acc.status as AccountStatus) && acc.status !== 'active' && (
                      <button className="btn ghost" style={{ fontSize: 10, padding: '3px 8px', color: 'var(--fg-2)' }} title="Advance status" onClick={() => handleQuickAdvance(acc, 1)}>→</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(editing || creating) && (
        <AccountFormModal
          account={editing}
          project={project}
          projectId={projectId}
          platforms={platforms}
          teamMembers={teamMembers}
          proxies={proxies}
          browserProfiles={browserProfiles}
          onClose={() => modal.close()}
          onSwitchToEdit={(localId) => modal.open("edit", localId)}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Account form modal (create + edit + warmup checklist)
// ──────────────────────────────────────────────────────────────────────

export function AccountFormModal({ account, project, projectId, platforms, onClose, onSwitchToEdit, presetPlatformKey, onCreated, pickContextHabitatId, pickContext, teamMembers = [], proxies = [], browserProfiles = [], onOpenHabitat, onOpenBrief }: {
  account: AccountRow | null;
  project: Project;
  projectId: string;
  platforms: PlatformRow[];
  onClose: () => void;
  onSwitchToEdit?: (accountId: number) => void;
  /** Click habitat name trong AccountBriefsSection → mở Habitat modal */
  onOpenHabitat?: (habitatId: number) => void;
  /** Click favicon row → mở Brief modal (overlay riêng) */
  onOpenBrief?: (briefId: number) => void;
  // Preset platform when creating from a context that knows the platform
  // (e.g. "+ New account on reddit" from a subreddit habitat drawer).
  presetPlatformKey?: string;
  onCreated?: (newAccountId: number) => void;
  // When opened from a habitat drawer for a specific habitat, pass the
  // habitat id so the local-accounts picker can flag rows that ALREADY
  // have a brief for this habitat (still pickable — BriefEditModal upserts).
  pickContextHabitatId?: number;
  // Banner ngữ cảnh: nhắc user đang tạo/chọn account ĐỂ LÀM GÌ (vd fix brief
  // sai nền tảng cho 1 kênh) → không bị "quên phải điền gì".
  pickContext?: {
    purpose: string;
    habitatName: string;
    habitatKind: string;
    habitatUrl?: string | null;
  };
  teamMembers?: import('@/lib/actions/team').TeamMemberRow[];
  proxies?: ProxyRow[];
  browserProfiles?: BrowserProfileRow[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Track pending toggle: which key + the value we sent. Cleared only after
  // the refreshed `account` prop reflects that value (router.refresh is
  // fire-and-forget so we can't rely on the await alone).
  const [pendingChecklist, setPendingChecklist] = useState<{ key: string; expected: boolean } | null>(null);
  const pendingChecklistKey = pendingChecklist?.key ?? null;
  const isCreate = !account;

  const [form, setForm] = useState({
    // No silent fallback to platforms[0] — when neither account nor preset
    // gives us a platform (e.g. opened from a habitat with kind=forum which
    // is platform-agnostic), leave empty so user MUST pick. handleSave
    // already validates `!form.platformKey`.
    platformKey: account?.platformKey ?? presetPlatformKey ?? '',
    handle: account?.handle ?? '',
    email: account?.email ?? '',
    status: (account?.status ?? 'todo') as AccountStatus,
    authMethod: (account?.authMethod ?? 'password') as AuthMethod,
    has2fa: account?.has2fa ?? false,
    recoveryInfo: account?.recoveryInfo ?? '',
    monthlyCost: account?.monthlyCost ?? 0,
    blockReason: account?.blockReason ?? '',
    notes: account?.notes ?? '',
    ownerUserId: (account as { ownerUserId?: number | null } | null)?.ownerUserId ?? null as number | null,
    proxyId: account?.proxyId ?? null as number | null,
    browserProfileId: account?.browserProfileId ?? null as number | null,
    persona: account?.persona ?? {} as Record<string, string>,
    accountKind: ((account as { accountKind?: string } | null)?.accountKind ?? 'user') as 'user' | 'bot' | 'app',
  });
  const setF = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm((f) => ({ ...f, [k]: v }));

  // Inline tech picker — lets user set platform engine without opening Platform modal
  const [technologies, setTechnologies] = useState<TechnologyRow[]>([]);
  const [localTechKey, setLocalTechKey] = useState<string | null>(null);
  const [pendingTechKey, setPendingTechKey] = useState<string | null>(null);
  const [techSaving, setTechSaving] = useState(false);
  const [techDetecting, setTechDetecting] = useState(false);
  const [techDetectMsg, setTechDetectMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [fieldsTrigger, setFieldsTrigger] = useState(0);
  useEffect(() => { listTechnologies().then(setTechnologies); }, []);

  // Sync localTechKey when platform changes
  const platform = platforms.find((p) => p.key === form.platformKey);
  useEffect(() => {
    setLocalTechKey(platform?.technologyKey ?? null);
    setPendingTechKey(null);
  }, [form.platformKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDetectEngine = () => {
    const signupUrl = platform?.signupUrl;
    if (!signupUrl) return;
    setTechDetecting(true); setTechDetectMsg(null);
    startTransition(async () => {
      const result = await detectTechnologyFromUrl(signupUrl);
      setTechDetecting(false);
      if (result.techKey) {
        setPendingTechKey(result.techKey);
        setTechDetectMsg({ text: `${result.techKey} (${result.confidence}) — ${result.method}`, ok: true });
      } else {
        setTechDetectMsg({ text: `No match — ${result.method}`, ok: false });
      }
    });
  };

  const handleSetEngine = () => {
    if (!form.platformKey) return;
    setTechSaving(true);
    startTransition(async () => {
      const res = await updatePlatform(form.platformKey, { technologyKey: pendingTechKey });
      setTechSaving(false);
      if (!res.ok) { setError(res.error || 'Engine update failed'); return; }
      setLocalTechKey(pendingTechKey);
      setPendingTechKey(null);
      setFieldsTrigger((n) => n + 1);
    });
  };

  // Inline field editors for engine defaults + platform overrides
  const [showEditEngine, setShowEditEngine] = useState(false);
  const [showEditPlatformFields, setShowEditPlatformFields] = useState(false);
  const [editEngineFields, setEditEngineFields] = useState<SignupFieldDef[]>([]);
  const [editPlatformFields, setEditPlatformFields] = useState<SignupFieldDef[]>([]);
  const [fieldsSaving, setFieldsSaving] = useState<'engine' | 'platform' | null>(null);

  // Sync editor state when engine/platform picker changes
  useEffect(() => {
    if (!showEditEngine) return;
    const tech = technologies.find((t) => t.key === localTechKey);
    setEditEngineFields((tech?.signupFields ?? []) as SignupFieldDef[]);
  }, [showEditEngine, localTechKey, technologies]);

  useEffect(() => {
    if (!showEditPlatformFields) return;
    setEditPlatformFields((platform?.signupFields ?? []) as SignupFieldDef[]);
  }, [showEditPlatformFields]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveEngineFields = () => {
    if (!localTechKey) return;
    const tech = technologies.find((t) => t.key === localTechKey);
    if (!tech) return;
    setFieldsSaving('engine');
    startTransition(async () => {
      const res = await upsertTechnology({
        key: tech.key,
        label: tech.label,
        description: tech.description,
        signupFields: editEngineFields as SignupField[],
        notes: tech.notes,
      });
      setFieldsSaving(null);
      if (!res.ok) { setError(res.error || 'Save engine fields failed'); return; }
      setShowEditEngine(false);
      setFieldsTrigger((n) => n + 1);
    });
  };

  const handleSavePlatformFields = () => {
    if (!form.platformKey) return;
    setFieldsSaving('platform');
    startTransition(async () => {
      const res = await updatePlatform(form.platformKey, { signupFields: editPlatformFields as SignupField[] });
      setFieldsSaving(null);
      if (!res.ok) { setError(res.error || 'Save platform fields failed'); return; }
      setShowEditPlatformFields(false);
      setFieldsTrigger((n) => n + 1);
    });
  };

  // Load effective signup fields when platform is selected and status is todo/creating
  const [effectiveFields, setEffectiveFields] = useState<SignupField[]>([]);
  useEffect(() => {
    if (!form.platformKey || (form.status !== 'todo' && form.status !== 'creating')) {
      setEffectiveFields([]);
      return;
    }
    let cancelled = false;
    getEffectiveSignupFields(form.platformKey).then((fields) => {
      if (!cancelled) setEffectiveFields(fields);
    });
    return () => { cancelled = true; };
  }, [form.platformKey, form.status, fieldsTrigger]);

  // Inline create modals state — pattern này (CRUD inline trong picker)
  // sẽ được generalize thành <ResourcePicker> sau (xem feedback memory).
  const [showCreateProxy, setShowCreateProxy] = useState(false);
  const [showCreateProfile, setShowCreateProfile] = useState(false);
  // Inline platform edit — mở PlatformFormModal stack lên trên account modal
  // (feedback_picker_inline_crud: edit-anywhere, không bắt vào /platforms)
  const [showEditPlatform, setShowEditPlatform] = useState(false);

  // ── Directus bridge: load existing accounts for this platform ──
  const [directusState, setDirectusState] = useState<{
    loading: boolean; enabled: boolean; accounts: DirectusAccountSummary[]; error?: string;
  }>({ loading: false, enabled: true, accounts: [] });
  const [importingId, setImportingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isCreate || !form.platformKey) return;
    let cancelled = false;
    setDirectusState((s) => ({ ...s, loading: true, error: undefined }));
    listDirectusAccountsForPlatform(form.platformKey).then((res) => {
      if (cancelled) return;
      setDirectusState({
        loading: false,
        enabled: res.enabled,
        accounts: res.accounts,
        error: res.error,
      });
    });
    return () => { cancelled = true; };
  }, [form.platformKey, isCreate]);

  const handleImport = (directusId: string) => {
    setImportingId(directusId);
    startTransition(async () => {
      const res = await importDirectusAccount(projectId, directusId);
      setImportingId(null);
      if (!res.ok) { setError(res.error || 'Import failed'); return; }
      router.refresh();
      // Feed the newly-imported (or already-existing-and-linked) account
      // ID back to the parent so flows like "+ Add account from habitat
      // drawer" can chain straight into the BriefEditModal.
      if (res.id != null) onCreated?.(res.id);
      onClose();
    });
  };

  const handleSave = () => {
    if (!form.platformKey) { setError('Platform required'); return; }
    startTransition(async () => {
      const payload = {
        platformKey: form.platformKey,
        handle: form.handle || null,
        email: form.email || null,
        status: form.status,
        authMethod: form.authMethod,
        has2fa: form.has2fa,
        recoveryInfo: form.recoveryInfo || null,
        monthlyCost: form.monthlyCost,
        blockReason: form.blockReason || null,
        notes: form.notes || null,
        ownerUserId: form.ownerUserId,
        persona: form.persona,
        accountKind: form.accountKind,
      };
      const res = isCreate
        ? await createAccount(projectId, payload)
        : await updateAccount(projectId, account!.id, payload);
      if (!res.ok) { setError(res.error || 'Save failed'); return; }

      // Save environment links (proxy + browser profile) — only edit-mode
      // (create flow gets the new account id từ res.id; nếu cần khi create cũng wire được)
      const accId = isCreate ? (res as { id?: number }).id : account!.id;
      const envChanged = (form.proxyId ?? null) !== (account?.proxyId ?? null)
        || (form.browserProfileId ?? null) !== (account?.browserProfileId ?? null);
      if (accId && envChanged) {
        await updateAccountEnvironment(accId, {
          proxyId: form.proxyId,
          browserProfileId: form.browserProfileId,
        });
      }

      router.refresh();
      if (isCreate && accId != null) onCreated?.(accId);
      onClose();
    });
  };

  const [confirmDelete, setConfirmDelete] = useState(false);
  const handleDelete = () => {
    if (!account) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      // Auto-revert sau 4s nếu user không action
      setTimeout(() => setConfirmDelete(false), 4000);
      return;
    }
    startTransition(async () => {
      const res = await deleteAccount(projectId, account.id);
      if (!res.ok) { setError(res.error || 'Delete failed'); setConfirmDelete(false); return; }
      router.refresh();
      onClose();
    });
  };

  const handleToggleChecklist = (itemKey: string, currentDone: boolean) => {
    if (!account || pendingChecklist) return;
    const next = !currentDone;
    setPendingChecklist({ key: itemKey, expected: next });
    startTransition(async () => {
      const res = await toggleChecklistItem(projectId, account.id, itemKey, next);
      if (!res.ok) {
        setError(res.error || 'Toggle failed');
        setPendingChecklist(null);
        return;
      }
      router.refresh();
      // Don't clear pending here — useEffect below clears once `account` prop
      // reflects the new value.
    });
  };

  // Clear the pending spinner once the refreshed account data arrives and
  // matches what we sent. Safety timeout in case revalidation is silently
  // dropped — release the lock after 5s so the UI never deadlocks.
  useEffect(() => {
    if (!pendingChecklist || !account) return;
    const current = account.warmupChecklist?.[pendingChecklist.key]?.done ?? false;
    if (current === pendingChecklist.expected) {
      setPendingChecklist(null);
      return;
    }
    const t = setTimeout(() => setPendingChecklist(null), 5000);
    return () => clearTimeout(t);
  }, [account, pendingChecklist]);

  const fld = fieldStyle({ size: 'lg' });   // fontSize 13 = lg variant
  const lbl = labelStyle;

  const checklistByPhase = useMemo(() => {
    if (!platform) return { creating: [], warming: [], active: [] };
    const grouped: Record<string, typeof platform.checklist> = { creating: [], warming: [], active: [] };
    for (const item of platform.checklist) (grouped[item.phase] ||= []).push(item);
    return grouped as Record<'creating' | 'warming' | 'active', typeof platform.checklist>;
  }, [platform]);

  // Phase filter rule (matches dashboard OritChannels):
  //   creating → only creating items (build identity first)
  //   warming  → only warming (creating already done at this stage)
  //   active   → only active items (often empty)
  //   todo / limited / blocked / banned → show everything (debug / setup mode)
  const phasesToShow: Array<'creating' | 'warming' | 'active'> = useMemo(() => {
    if (!account) return ['creating', 'warming', 'active'];
    switch (account.status) {
      case 'creating': return ['creating'];
      case 'warming':  return ['warming'];
      case 'active':   return ['active'];
      default:         return ['creating', 'warming', 'active'];
    }
  }, [account?.status]);

  // Variable substitution context for snippet templates.
  // Project-level brand fields (website/bio/persona/hashtags/one-liner) come
  // from project row; account-level (handle/platform) from form state. Edit
  // brand once in /p/[id]/settings → applies across all platform accounts.
  const templateVars = useMemo(() => ({
    handle: form.handle || '',
    platform: platform?.label ?? form.platformKey,
    website: project.website ?? '',
    bio: project.bio ?? '',
    persona: project.persona ?? '',
    hashtags: project.hashtags ?? '',
    'one-liner': project.oneLiner ?? '',
    name: project.name,
    email: form.email || '',
  }), [form.handle, form.email, form.platformKey, platform?.label, project]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) e.stopPropagation(); }}>
      <div className="modal" style={{ width: 'min(1100px, 100%)', maxWidth: 1100 }} onClick={(e) => e.stopPropagation()}>
        <ModalHeader
          kind="account"
          action={isCreate ? 'create' : 'edit'}
          idText={account ? `#${account.id}` : undefined}
          title={isCreate
            ? (form.platformKey ? `Account mới · ${platform?.label ?? form.platformKey}` : 'Account mới')
            : `@${account!.handle || 'no-handle'}`}
          subtitle={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              {platform
                ? <><PlatformIcon slug={platform.iconSlug} /> {platform.label}</>
                : <span style={{ color: 'var(--warn)' }}>Chưa chọn platform</span>}
              {!isCreate && account?.email ? <span style={{ color: 'var(--fg-4)' }}>· {account.email}</span> : null}
            </span>
          }
          context={pickContext
            ? <span>
                <strong>{pickContext.purpose}</strong> — kênh <strong>{pickContext.habitatName}</strong>{' '}
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
                  ({pickContext.habitatKind}{pickContext.habitatUrl ? ` · ${pickContext.habitatUrl}` : ''})
                </span>{'. '}
                {form.platformKey
                  ? `Chọn/import account trên platform này hoặc ✨ AI fill từ URL/ảnh.`
                  : `Kênh ngoài chưa có platform → ô Platform: mở picker, gõ tên, + Tạo platform mới.`}
              </span>
            : undefined}
          onClose={onClose}
        />

        {error && (
          <div style={{ padding: '8px 14px', background: 'rgba(255,77,94,.08)', borderBottom: '1px solid rgba(255,77,94,.3)', color: 'var(--bad)', fontSize: 12 }}>⚠ {error}</div>
        )}

        <AIFormParser
          currentValues={{
            platformKey: form.platformKey, handle: form.handle, email: form.email,
            status: form.status, authMethod: form.authMethod, has2fa: form.has2fa,
            recoveryInfo: form.recoveryInfo, monthlyCost: form.monthlyCost,
            blockReason: form.blockReason, notes: form.notes,
          }}
          context={`Platform account form for ${platform?.label || form.platformKey}. Parse signup confirmation email, screenshot, account info paste, or platform profile URL.`}
          schema={[
            { key: 'handle', label: 'Username/handle (without @)' },
            { key: 'email', label: 'Email associated with account' },
            { key: 'status', label: 'Account status', type: 'enum', enumValues: ['todo', 'creating', 'warming', 'active', 'limited', 'blocked', 'banned'] },
            { key: 'authMethod', label: 'Auth method', type: 'enum', enumValues: ['password', 'oauth', 'magic_link', 'sso', 'api_key'] },
            { key: 'has2fa', label: '2FA enabled', type: 'boolean' },
            { key: 'recoveryInfo', label: 'Recovery codes / backup email' },
            { key: 'monthlyCost', label: 'Monthly cost in dollars (number)', type: 'number' },
            { key: 'notes', label: 'Notes' },
          ]}
          onApply={(v) => setForm((f) => ({
            ...f,
            handle: typeof v.handle === 'string' ? v.handle : f.handle,
            email: typeof v.email === 'string' ? v.email : f.email,
            status: (v.status as AccountStatus) || f.status,
            authMethod: (v.authMethod as AuthMethod) || f.authMethod,
            has2fa: typeof v.has2fa === 'boolean' ? v.has2fa : f.has2fa,
            recoveryInfo: typeof v.recoveryInfo === 'string' ? v.recoveryInfo : f.recoveryInfo,
            monthlyCost: typeof v.monthlyCost === 'number' ? v.monthlyCost : f.monthlyCost,
            notes: typeof v.notes === 'string' ? v.notes : f.notes,
          }))}
        />

        <div className="modal-body" style={{
          display: 'flex', flexDirection: 'row', gap: 16, alignItems: 'stretch',
          // Override .modal-body { overflow-y: auto } để mỗi cột scroll riêng
          overflow: 'hidden', flex: 1, minHeight: 0,
        }}>
          {/* ═══ LEFT COLUMN — Essentials (form fields chính) ═══════ */}
          <div style={{
            flex: '0 0 420px', display: 'flex', flexDirection: 'column', gap: 12,
            overflowY: 'auto', minHeight: 0, paddingRight: 8,
          }}>
            <div>
              <span style={lbl}>Platform *</span>
              {(() => {
                const lk = accountFieldLock('platform', form.status, isCreate, form.platformKey);
                if (lk.locked) {
                  return (
                    <>
                      <div style={{ ...fld, display: 'flex', alignItems: 'center', gap: 6,
                                    opacity: 0.7, cursor: 'not-allowed' }}>
                        <IconLock size={12} />
                        <span>{platform?.label ?? form.platformKey ?? '—'}</span>
                      </div>
                      <LockNote lock={lk} />
                    </>
                  );
                }
                return (
                  <PlatformPicker
                    platforms={platforms}
                    value={form.platformKey}
                    onChange={(k) => setF('platformKey', k)}
                    fld={!form.platformKey
                      ? { ...fld, borderColor: 'var(--warn)', boxShadow: '0 0 0 2px rgba(196,106,0,0.15)' }
                      : fld}
                  />
                );
              })()}
              {!form.platformKey && !accountFieldLock('platform', form.status, isCreate, form.platformKey).locked && (
                <div style={{
                  marginTop: 4, padding: '5px 8px', fontSize: 11,
                  background: 'rgba(196,106,0,0.08)', color: 'var(--warn)',
                  border: '1px solid rgba(196,106,0,0.30)', borderRadius: 4,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span>⚠ Chọn platform để tiếp tục.</span>
                  <span style={{ color: 'var(--fg-3)', fontSize: 10.5 }}>
                    Chưa có trong catalog? Mở picker → gõ tên → click <strong>+ Tạo platform mới</strong>.
                  </span>
                </div>
              )}
              {platform && (() => {
                const profileUrl = profileUrlFor(platform.key, form.handle, platform.profileUrlPattern);
                return (
                  <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11, alignItems: 'center' }}>
                    {profileUrl && (
                      <ExternalLink href={profileUrl}
                        title={`Mở profile @${form.handle.replace(/^@+/, '')} trên ${platform.label}`}
                        style={{
                          color: 'var(--fg-0)', textDecoration: 'none', fontWeight: 600,
                          padding: '2px 8px', borderRadius: 4,
                          background: 'var(--bg-3)', border: '1px solid var(--line)',
                        }}>
                        ↗ Profile @{form.handle.replace(/^@+/, '')}
                      </ExternalLink>
                    )}
                    <ExternalLink href={platform.signupUrl}
                      style={{ color: 'var(--fg-2)', textDecoration: 'none' }}>↗ Signup page</ExternalLink>
                    {platform.postUrl && (
                      <ExternalLink href={platform.postUrl}
                        style={{ color: 'var(--fg-2)', textDecoration: 'none' }}>↗ Post page</ExternalLink>
                    )}
                    <span style={{ color: 'var(--fg-3)' }}>
                      Priority: <b style={{ color: PRIORITY_COLOR[platform.priority] }}>{platform.priority}</b>
                    </span>
                    <button type="button"
                      onClick={() => setShowEditPlatform(true)}
                      title={`Edit platform "${platform.label}" — open CRUD modal`}
                      style={{
                        marginLeft: 'auto', background: 'transparent', border: '1px solid var(--line)',
                        color: 'var(--fg-2)', fontSize: 10.5, padding: '2px 8px', borderRadius: 4,
                        cursor: 'pointer',
                      }}
                    >
                      ✏️ edit platform
                    </button>
                  </div>
                );
              })()}
            </div>

            {/* CTA "Tạo account" — visible khi status=todo/creating, account chưa tồn tại trên platform */}
            {platform && (form.status === 'todo' || form.status === 'creating') && (
              <CTACard
                href={platform.signupUrl}
                title={`Tạo account trên ${platform.label}`}
                subtitle={form.status === 'todo'
                  ? 'Mở signup page → đăng ký xong → cập nhật handle + chuyển status sang Creating/Warming'
                  : 'Account đang trong giai đoạn tạo — quay lại signup page nếu cần'}
              />
            )}


            {/* Pick existing MOS2 account on this platform — only useful in
                pick-mode (parent passed onCreated, e.g. habitat-drawer flow).
                Doesn't show in plain "+ New account" from AccountsVault. */}
            {isCreate && form.platformKey && onCreated && (
              <LocalAccountsPickerSection
                projectId={projectId}
                platformKey={form.platformKey}
                platformLabel={platform?.label ?? form.platformKey}
                excludeHabitatId={pickContextHabitatId}
                onPick={(localId) => { onCreated(localId); onClose(); }}
              />
            )}

            {/* Import from as.on.tc — only when creating + bridge enabled */}
            {isCreate && form.platformKey && directusState.enabled && (
              <DirectusImportSection
                state={directusState}
                platformLabel={platform?.label ?? form.platformKey}
                importingId={importingId}
                onImport={handleImport}
                onEditLocal={(localId) => {
                  // Pick-mode: parent passed onCreated → resolve modal to this
                  // existing local account (e.g. habitat drawer feeds it into
                  // the BriefEditModal). Otherwise switch to in-modal edit.
                  if (onCreated) { onCreated(localId); onClose(); return; }
                  onSwitchToEdit?.(localId);
                }}
              />
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {(() => {
                const hLk = accountFieldLock('handle', form.status, isCreate, form.handle);
                const eLk = accountFieldLock('email', form.status, isCreate, form.email);
                const lockStyle = (locked: boolean) =>
                  locked ? { ...fld, opacity: 0.6, cursor: 'not-allowed' } : fld;
                return (
                  <>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <span style={lbl} title="user = manual login (cần warming + persona). bot = Discord/Slack bot có bot_token (auto-post API). app = OAuth integration (Reddit script-app).">
                        Account kind
                      </span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {(['user', 'bot', 'app'] as const).map((k) => {
                          const on = form.accountKind === k;
                          const icon = k === 'bot' ? '🤖' : k === 'app' ? '🔌' : '👤';
                          const label = k === 'bot' ? 'Bot' : k === 'app' ? 'App' : 'User';
                          const hint = k === 'bot' ? 'Discord/Slack bot, có bot_token, auto-post API'
                            : k === 'app' ? 'OAuth integration (Reddit script-app)'
                            : 'Manual login, cần warming + persona';
                          return (
                            <button key={k} type="button"
                                    onClick={() => setF('accountKind', k)}
                                    title={hint}
                                    style={{ flex: 1, padding: '6px 10px', fontSize: 11,
                                             fontWeight: 700, fontFamily: 'var(--font-mono)',
                                             background: on ? 'var(--accent)' : 'var(--bg-2)',
                                             color: on ? '#fff' : 'var(--fg-2)',
                                             border: `1px solid ${on ? 'var(--accent)' : 'var(--line)'}`,
                                             borderRadius: 4, cursor: 'pointer',
                                             display: 'inline-flex', alignItems: 'center',
                                             justifyContent: 'center', gap: 4 }}>
                              {icon} {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <span style={lbl}>Handle / username</span>
                      <NoFillInput
                        style={lockStyle(hLk.locked)}
                        placeholder="orit, @oritapp..."
                        value={form.handle}
                        disabled={hLk.locked}
                        onChange={(e) => setF('handle', e.target.value)}
                      />
                      <LockNote lock={hLk} />
                    </div>
                    <div>
                      <span style={lbl}>Email</span>
                      <NoFillInput
                        style={lockStyle(eLk.locked)}
                        placeholder="account@..."
                        value={form.email}
                        disabled={eLk.locked}
                        onChange={(e) => setF('email', e.target.value)}
                      />
                      <LockNote lock={eLk} />
                    </div>
                  </>
                );
              })()}
              <div>
                <span style={lbl} title="Trạng thái GLOBAL của account trên platform (KHÔNG phải phase trong từng community)">
                  Status <span style={{ fontSize: 9, color: 'var(--fg-4)', fontWeight: 400 }}>(global, không phải per-habitat)</span>
                </span>
                <select style={fld} value={form.status}
                        onChange={(e) => setF('status', e.target.value as AccountStatus)}
                        title={STATUSES.find((s) => s.key === form.status)?.hint || ''}>
                  <optgroup label="🔧 Setup — chưa dùng được">
                    {STATUSES.filter((s) => s.key === 'todo' || s.key === 'creating').map((s) =>
                      <option key={s.key} value={s.key}>{s.dot} {s.label} — {s.hint}</option>)}
                  </optgroup>
                  <optgroup label="🔥 Warming — đợi đủ tuổi/karma GLOBAL">
                    {STATUSES.filter((s) => s.key === 'warming').map((s) =>
                      <option key={s.key} value={s.key}>{s.dot} {s.label} — đợi platform tin (warmupChecklist)</option>)}
                  </optgroup>
                  <optgroup label="✅ Ready — có thể assign vào community">
                    {STATUSES.filter((s) => s.key === 'active').map((s) =>
                      <option key={s.key} value={s.key}>{s.dot} READY — đủ điều kiện platform</option>)}
                  </optgroup>
                  <optgroup label="🔒 Locked — platform giới hạn/chặn">
                    {STATUSES.filter((s) => s.key === 'limited' || s.key === 'blocked' || s.key === 'banned').map((s) =>
                      <option key={s.key} value={s.key}>{s.dot} {s.label} — {s.hint}</option>)}
                  </optgroup>
                </select>
                {/* Hint dưới dropdown: nhắc 2 cấp */}
                {(form.status === 'warming' || form.status === 'active') && (
                  <div style={{ marginTop: 4, fontSize: 10, color: 'var(--fg-4)', fontStyle: 'italic',
                                display: 'flex', alignItems: 'center', gap: 4 }}>
                    💡 Phase per-community (warm-up trong sub-Discord/subreddit) → sửa ở <strong>Brief modal</strong> của habitat đó.
                  </div>
                )}
              </div>
              {(() => {
                const sLk = accountFieldLock('security', form.status, isCreate, form.authMethod);
                return (
                  <div>
                    <span style={lbl}>Auth method</span>
                    <select style={sLk.locked ? { ...fld, opacity: 0.6, cursor: 'not-allowed' } : fld}
                            value={form.authMethod} disabled={sLk.locked}
                            onChange={(e) => setF('authMethod', e.target.value as AuthMethod)}>
                      {AUTH_METHODS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                    </select>
                    <LockNote lock={sLk} />
                  </div>
                );
              })()}
              {(form.status === 'limited' || form.status === 'blocked' || form.status === 'banned') && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <span style={lbl} title="Lý do cụ thể tại sao account bị locked">Lock reason</span>
                  <select style={fld} value={form.blockReason} onChange={(e) => setF('blockReason', e.target.value)}>
                    <option value="">— select —</option>
                    {BLOCK_REASONS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                  </select>
                  <div style={{ marginTop: 4, fontSize: 10, color: 'var(--fg-4)', fontStyle: 'italic' }}>
                    {form.status === 'limited' && '⏱ Rate-limit tạm thời — chờ vài giờ/ngày, có thể quay lại READY'}
                    {form.status === 'blocked' && '🚧 Bị chặn — cần appeal hoặc fix thủ công'}
                    {form.status === 'banned' && '❌ Ban vĩnh viễn — drop account, tạo cái mới'}
                  </div>
                </div>
              )}
              {teamMembers.length > 0 && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <span style={lbl}>👤 Assigned to manage</span>
                  <OwnerSelect members={teamMembers} value={form.ownerUserId} onChange={(uid) => setF('ownerUserId', uid)} fld={fld} />
                </div>
              )}
            </div>
          </div>

          {/* ═══ RIGHT COLUMN — Dynamic info (collapsibles) ═══════ */}
          <div style={{
            flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column',
            overflowY: 'auto', minHeight: 0, paddingRight: 8, paddingLeft: 12,
            borderLeft: '1px dashed var(--line)',
          }}>
            {/* Habitats engaging section LÊN ĐẦU right column — luôn hiển thị
                khi edit existing account (parallel với Habitat modal). User
                không phải scroll xuống cuối để xem account này engage habitat
                nào. */}
            {!isCreate && account && (
              <AccountBriefsSection
                projectId={projectId}
                accountId={account.id}
                accountLabel={`@${account.handle || 'no-handle'} · ${platform?.label ?? account.platformKey}`}
                platforms={platforms}
                onOpenHabitat={onOpenHabitat}
                onOpenBrief={onOpenBrief}
              />
            )}
            {/* ── Pre-deployment: inline engine picker + signup fields ──
                Visible khi status=todo/creating. Engine picker saves trực tiếp
                vào platform record (không cần mở Platform modal riêng).
                Signup fields (persona) lưu cùng account khi Save. */}
            {platform && (form.status === 'todo' || form.status === 'creating') && (
              <div style={{
                border: '1px solid var(--line)', borderRadius: 6,
                background: 'var(--bg-1)',
              }}>
                {/* Header */}
                <div style={{
                  padding: '6px 10px', background: 'var(--bg-2)',
                  borderBottom: '1px solid var(--line)',
                  borderRadius: '6px 6px 0 0',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-1)' }}>📋 Pre-deployment</span>
                  {effectiveFields.filter((f) => f.required).length > 0 && (
                    <span style={{
                      fontSize: 9.5, padding: '1px 6px', borderRadius: 10,
                      background: 'var(--accent-soft)', color: 'var(--accent)',
                      fontFamily: 'var(--font-mono)', fontWeight: 700,
                    }}>
                      {effectiveFields.filter((f) => f.required).length} required
                    </span>
                  )}
                  <span style={{ fontSize: 10, color: 'var(--fg-4)', marginLeft: 'auto' }}>
                    điền trước khi vào signup page → lưu cùng account
                  </span>
                </div>

                <div style={{ padding: '10px 10px 12px' }}>
                  {/* Inline engine picker — saves to platform record directly */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                      <span style={{
                        fontSize: 9.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)',
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                      }}>⚙ Forum engine</span>
                      {!localTechKey && (
                        <span style={{ fontSize: 9.5, color: 'var(--warn)', fontStyle: 'italic' }}>
                          — unknown, chọn để xem required fields
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <TechnologyPicker
                          technologies={technologies}
                          value={pendingTechKey !== null ? pendingTechKey : localTechKey}
                          onChange={(k) => setPendingTechKey(k ?? '')}
                          fld={{ ...fld, fontSize: 12 }}
                        />
                      </div>
                      <button type="button" onClick={handleDetectEngine}
                        disabled={techDetecting || !platform?.signupUrl}
                        title={platform?.signupUrl ? 'Auto-detect engine từ signup URL' : 'Platform chưa có signup URL'}
                        style={{
                          flexShrink: 0, padding: '5px 8px', fontSize: 11, whiteSpace: 'nowrap',
                          background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 4,
                          color: techDetecting ? 'var(--fg-3)' : 'var(--accent)',
                          cursor: (techDetecting || !platform?.signupUrl) ? 'not-allowed' : 'pointer',
                          opacity: !platform?.signupUrl ? 0.5 : 1,
                        }}>
                        {techDetecting ? '...' : '🔍'}
                      </button>
                      {(pendingTechKey !== null && pendingTechKey !== localTechKey) && (
                        <button type="button"
                          onClick={handleSetEngine}
                          disabled={techSaving}
                          title="Lưu engine vào platform record (áp dụng cho tất cả accounts của platform này)"
                          style={{
                            flexShrink: 0, padding: '6px 10px', fontSize: 11, fontWeight: 700,
                            background: 'var(--accent)', color: '#0d1117',
                            border: 'none', borderRadius: 5, cursor: techSaving ? 'wait' : 'pointer',
                            opacity: techSaving ? 0.7 : 1, whiteSpace: 'nowrap',
                          }}>
                          {techSaving ? '...' : '↑ Set engine'}
                        </button>
                      )}
                    </div>
                    {techDetectMsg && (
                      <div style={{ fontSize: 10, marginTop: 4, fontFamily: 'var(--font-mono)',
                        color: techDetectMsg.ok ? 'var(--good)' : 'var(--fg-3)' }}>
                        {techDetectMsg.text}
                      </div>
                    )}
                  </div>

                  {/* Signup fields checklist */}
                  {effectiveFields.length > 0 ? (
                    <SignupFieldsChecklist
                      fields={effectiveFields}
                      persona={form.persona}
                      onPersonaChange={(key, value) => setF('persona', { ...form.persona, [key]: value })}
                      templateVars={templateVars}
                    />
                  ) : (
                    <div style={{ fontSize: 11, color: 'var(--fg-4)', fontStyle: 'italic', padding: '4px 0' }}>
                      {localTechKey
                        ? 'Engine này không có required signup fields đặc biệt.'
                        : 'Chọn engine ở trên để xem danh sách fields cần chuẩn bị.'}
                    </div>
                  )}

                  {/* ── Edit buttons for engine defaults + platform overrides ── */}
                  <div style={{ display: 'flex', gap: 6, marginTop: 10, paddingTop: 8, borderTop: '1px dashed var(--line)' }}>
                    {localTechKey && (
                      <button type="button"
                        onClick={() => { setShowEditEngine((v) => !v); setShowEditPlatformFields(false); }}
                        style={{
                          fontSize: 10, padding: '3px 8px',
                          background: showEditEngine ? 'var(--accent-soft)' : 'var(--bg-2)',
                          border: `1px solid ${showEditEngine ? 'var(--accent-line)' : 'var(--line)'}`,
                          color: showEditEngine ? 'var(--accent)' : 'var(--fg-2)',
                          borderRadius: 4, cursor: 'pointer',
                        }}
                        title="Sửa default fields của engine này (áp dụng toàn cầu cho tất cả platform dùng engine này)">
                        ✏ Engine defaults ({technologies.find((t) => t.key === localTechKey)?.label ?? localTechKey})
                      </button>
                    )}
                    <button type="button"
                      onClick={() => { setShowEditPlatformFields((v) => !v); setShowEditEngine(false); }}
                      style={{
                        fontSize: 10, padding: '3px 8px',
                        background: showEditPlatformFields ? 'var(--accent-soft)' : 'var(--bg-2)',
                        border: `1px solid ${showEditPlatformFields ? 'var(--accent-line)' : 'var(--line)'}`,
                        color: showEditPlatformFields ? 'var(--accent)' : 'var(--fg-2)',
                        borderRadius: 4, cursor: 'pointer',
                      }}
                      title="Sửa platform-specific signup fields (chỉ áp dụng cho platform này, override engine defaults)">
                      ✏ Platform fields ({platform?.label ?? form.platformKey})
                    </button>
                  </div>

                  {/* Engine field editor */}
                  {showEditEngine && localTechKey && (
                    <div style={{ marginTop: 8, padding: 10, background: 'var(--bg-0)', border: '1px solid var(--accent-line)', borderRadius: 5 }}>
                      <div style={{ fontSize: 10.5, color: 'var(--accent)', fontWeight: 700, marginBottom: 6 }}>
                        ⚙ Engine defaults — {technologies.find((t) => t.key === localTechKey)?.label}
                        <span style={{ fontSize: 9.5, color: 'var(--fg-3)', fontWeight: 400, marginLeft: 6 }}>
                          (áp dụng cho mọi platform dùng engine này)
                        </span>
                      </div>
                      <SignupFieldsBuilder fields={editEngineFields} onChange={setEditEngineFields} />
                      <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
                        <button type="button" onClick={() => setShowEditEngine(false)}
                          style={{ fontSize: 10, padding: '3px 10px', background: 'transparent', border: '1px solid var(--line)', color: 'var(--fg-3)', borderRadius: 4, cursor: 'pointer' }}>
                          Cancel
                        </button>
                        <button type="button" onClick={handleSaveEngineFields} disabled={fieldsSaving === 'engine'}
                          style={{ fontSize: 10, padding: '3px 12px', fontWeight: 700, background: 'var(--accent)', color: '#0d1117', border: 'none', borderRadius: 4, cursor: fieldsSaving === 'engine' ? 'wait' : 'pointer', opacity: fieldsSaving === 'engine' ? 0.7 : 1 }}>
                          {fieldsSaving === 'engine' ? 'Saving…' : '↑ Save engine defaults'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Platform field editor */}
                  {showEditPlatformFields && (
                    <div style={{ marginTop: 8, padding: 10, background: 'var(--bg-0)', border: '1px solid var(--accent-line)', borderRadius: 5 }}>
                      <div style={{ fontSize: 10.5, color: 'var(--accent)', fontWeight: 700, marginBottom: 6 }}>
                        Platform overrides — {platform?.label ?? form.platformKey}
                        <span style={{ fontSize: 9.5, color: 'var(--fg-3)', fontWeight: 400, marginLeft: 6 }}>
                          (override/bổ sung trên engine defaults)
                        </span>
                      </div>
                      <SignupFieldsBuilder fields={editPlatformFields} onChange={setEditPlatformFields} />
                      <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
                        <button type="button" onClick={() => setShowEditPlatformFields(false)}
                          style={{ fontSize: 10, padding: '3px 10px', background: 'transparent', border: '1px solid var(--line)', color: 'var(--fg-3)', borderRadius: 4, cursor: 'pointer' }}>
                          Cancel
                        </button>
                        <button type="button" onClick={handleSavePlatformFields} disabled={fieldsSaving === 'platform'}
                          style={{ fontSize: 10, padding: '3px 12px', fontWeight: 700, background: 'var(--accent)', color: '#0d1117', border: 'none', borderRadius: 4, cursor: fieldsSaving === 'platform' ? 'wait' : 'pointer', opacity: fieldsSaving === 'platform' ? 0.7 : 1 }}>
                          {fieldsSaving === 'platform' ? 'Saving…' : '↑ Save platform fields'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          {/* ── Notes — collapsible. Open mặc định nếu đã có nội dung. ── */}
          <Collapsible
            title="Notes"
            defaultOpen={!!form.notes}
            badge={form.notes && (
              <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
                {form.notes.length} chars
              </span>
            )}
            hint={!form.notes ? '+ add note' : undefined}
          >
            <textarea
              style={{ ...fld, minHeight: 70, resize: 'vertical' }}
              placeholder="Notes về account này (link, context, lưu ý…)"
              value={form.notes}
              onChange={(e) => setF('notes', e.target.value)}
            />
          </Collapsible>

          {/* ── Environment (Proxy + Browser profile) — anti-detect setup ── */}
          <Collapsible
            title="🌐 Environment"
            defaultOpen={!!form.proxyId || !!form.browserProfileId}
            hint={
              form.proxyId || form.browserProfileId
                ? `${form.proxyId ? '🔌 proxy' : ''}${form.proxyId && form.browserProfileId ? ' · ' : ''}${form.browserProfileId ? '🦊 profile' : ''}`
                : 'link proxy + browser profile (optional)'
            }
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {/* PROXY picker — luôn có nút "+ New" để tạo mới ngay tại đây */}
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ ...lbl, marginBottom: 0 }}>
                    🔌 Proxy <span style={{ color: 'var(--fg-4)' }}>({proxies.length} available)</span>
                  </span>
                  <button type="button" onClick={() => setShowCreateProxy(true)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: 10.5, cursor: 'pointer', padding: 0 }}>
                    + new proxy
                  </button>
                </div>
                <select
                  style={fld}
                  value={form.proxyId ?? ''}
                  onChange={(e) => setF('proxyId', e.target.value ? Number(e.target.value) : null)}
                  disabled={proxies.length === 0}
                >
                  <option value="">{proxies.length === 0 ? '— chưa có proxy nào —' : '— none —'}</option>
                  {proxies.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.health === 'ok' ? '🟢' : p.health === 'degraded' ? '🟡' : p.health === 'down' ? '🔴' : '⚪'}{' '}
                      {p.label} · {p.type}{p.location ? ` · ${p.location}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* BROWSER PROFILE picker — luôn có nút "+ New" */}
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ ...lbl, marginBottom: 0 }}>
                    🦊 Browser profile <span style={{ color: 'var(--fg-4)' }}>({browserProfiles.length} available)</span>
                  </span>
                  <button type="button" onClick={() => setShowCreateProfile(true)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: 10.5, cursor: 'pointer', padding: 0 }}>
                    + new profile
                  </button>
                </div>
                <select
                  style={fld}
                  value={form.browserProfileId ?? ''}
                  onChange={(e) => setF('browserProfileId', e.target.value ? Number(e.target.value) : null)}
                  disabled={browserProfiles.length === 0}
                >
                  <option value="">{browserProfiles.length === 0 ? '— chưa có profile nào —' : '— none —'}</option>
                  {browserProfiles.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label} · {b.tool}{b.defaultProxyLabel ? ` (proxy: ${b.defaultProxyLabel})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 8, fontStyle: 'italic' }}>
              Link account này với 1 proxy + 1 browser profile (vd: Multilogin, Adspower) để
              anti-detect khi run automated actions. Không bắt buộc — chỉ cần khi platform
              strict về fingerprint (Reddit, Twitter, FB).
            </div>
          </Collapsible>

          {showCreateProxy && (
            <QuickCreateProxyModal
              onClose={() => setShowCreateProxy(false)}
              onCreated={(id) => {
                setF('proxyId', id);
                setShowCreateProxy(false);
              }}
            />
          )}
          {showCreateProfile && (
            <QuickCreateBrowserProfileModal
              proxies={proxies}
              onClose={() => setShowCreateProfile(false)}
              onCreated={(id) => {
                setF('browserProfileId', id);
                setShowCreateProfile(false);
              }}
            />
          )}
          {showEditPlatform && platform && (
            <PlatformFormModal
              platform={{
                key: platform.key,
                label: platform.label,
                signupUrl: platform.signupUrl,
                postUrl: platform.postUrl,
                profileUrlPattern: platform.profileUrlPattern,
                priority: platform.priority,
                iconSlug: platform.iconSlug,
                fallbackKeys: platform.fallbackKeys,
                description: platform.description ?? '',
                pricing: platform.pricing ?? null,
                region: platform.region ?? null,
                category: (platform.category ?? 'other') as PlatformWithUsage['category'],
                tags: platform.tags ?? [],
                userCountEstimate: platform.userCountEstimate ?? null,
                notes: null,
                accountsCount: 1, // hide delete button khi edit từ context account
                technologyKey: platform.technologyKey ?? null,
                signupFields: (platform.signupFields as PlatformWithUsage['signupFields']) ?? [],
                allowedFormats: null,
                formatMix: null,
              }}
              onClose={() => setShowEditPlatform(false)}
            />
          )}

          {/* ── Share to agents/users — chỉ edit-mode. Owner đã có ở "Assigned to manage". ── */}
          {!isCreate && (
            <Collapsible
              title="🔗 Shared with"
              hint="agents + users (ngoài owner) được phép dùng account này"
            >
              <AccountGrantsSection
                accountId={account!.id}
                projectId={projectId}
                members={teamMembers}
              />
            </Collapsible>
          )}

          {/* ── Advanced (Monthly cost, 2FA, Recovery, API token) — collapsed mặc định. ── */}
          <Collapsible
            title="Advanced"
            defaultOpen={form.monthlyCost > 0 || form.has2fa || !!form.recoveryInfo || (!isCreate && !!account?.hasApiToken)}
            hint="cost · 2FA · recovery · API token"
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <span style={lbl}>Monthly cost ($)</span>
                <input style={fld} type="number" min={0} value={form.monthlyCost} onChange={(e) => setF('monthlyCost', Number(e.target.value))} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 22 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--fg-1)' }}>
                  <input type="checkbox" checked={form.has2fa} onChange={(e) => setF('has2fa', e.target.checked)} /> 2FA enabled
                </label>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <span style={lbl}>Recovery info (codes / backup email)</span>
                <input style={fld} placeholder="Backup codes, recovery email…" value={form.recoveryInfo} onChange={(e) => setF('recoveryInfo', e.target.value)} />
              </div>
            </div>
            {!isCreate && (
              <div style={{ marginTop: 10 }}>
                <ApiTokenSection
                  projectId={projectId}
                  accountId={account!.id}
                  hasToken={account!.hasApiToken}
                />
              </div>
            )}
          </Collapsible>

          {/* ── Warmup checklist — collapsible. Open mặc định nếu chưa hoàn tất. ── */}
          {!isCreate && platform && platform.checklist.length > 0 && (() => {
            const total = platform.checklist.length;
            const done = platform.checklist.filter((it) => account!.warmupChecklist[it.key]?.done).length;
            const allDone = done === total;
            return (
              <Collapsible
                title={`Warmup checklist · ${platform.label}`}
                defaultOpen={!allDone}
                badge={
                  <span style={{
                    fontSize: 9.5, fontFamily: 'var(--font-mono)',
                    padding: '1px 6px', borderRadius: 3,
                    background: allDone ? 'rgba(16,185,129,.15)' : 'var(--bg-2)',
                    color: allDone ? 'var(--ok)' : 'var(--fg-3)',
                  }}>
                    {done}/{total}
                  </span>
                }
                hint={
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {phasesToShow.length === 1 && (
                      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}>
                        phase: {phasesToShow[0]}
                      </span>
                    )}
                    {(platform.checklist as Array<{ auto?: string }>).some((c) => c.auto) && (
                      <span onClick={(e) => e.stopPropagation()}>
                        <AutoCheckButton projectId={projectId} accountId={account!.id} />
                      </span>
                    )}
                  </span>
                }
              >
              {phasesToShow.map((phase) => (
                checklistByPhase[phase].length > 0 && (
                  <div key={phase} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '4px 0' }}>
                      {phase === 'creating' ? '🌱 Creating' : phase === 'warming' ? '🔥 Warming' : '🚀 Active'}
                    </div>
                    {checklistByPhase[phase].map((item) => {
                      const state = account!.warmupChecklist[item.key] ?? { done: false };
                      const snippets = item.snippets ?? [];
                      const isPending = pendingChecklistKey === item.key;
                      const otherPending = pendingChecklistKey != null && !isPending;
                      return (
                        <div key={item.key} style={{ padding: '5px 0', borderBottom: '1px dashed var(--line)', opacity: otherPending ? 0.5 : 1 }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                            <span style={{ position: 'relative', display: 'inline-flex', marginTop: 2, width: 13, height: 13, alignItems: 'center', justifyContent: 'center' }}>
                              {isPending ? (
                                <Spinner size="sm" label="saving" />
                              ) : (
                                <input type="checkbox" checked={state.done} disabled={otherPending} onChange={() => handleToggleChecklist(item.key, state.done)} style={{ margin: 0, cursor: otherPending ? 'wait' : 'pointer' }} />
                              )}
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, color: state.done ? 'var(--fg-3)' : 'var(--fg-0)', textDecoration: state.done ? 'line-through' : 'none' }}>
                                {item.key.replace(/_/g, ' ')}
                              </div>
                              {item.tip && <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 2 }}>{item.tip}</div>}
                            </div>
                            {item.actionUrl && (
                              <a href={wrapExternalUrl(item.actionUrl)} target="_blank" rel="noopener noreferrer"
                                 className="btn" style={{ fontSize: 10, padding: '2px 6px', flexShrink: 0 }}>↗</a>
                            )}
                          </div>
                          {/* Hide snippets in creating phase — already shown in Pre-deployment panel above */}
                          {snippets.length > 0 && phase !== 'creating' && (
                            <div style={{ marginLeft: 26, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 5 }}>
                              {snippets.map((snip, i) => <SnippetCard key={i} snippet={snip} vars={templateVars} />)}
                            </div>
                          )}
                          {snippets.length > 0 && phase === 'creating' && (
                            <div style={{ marginLeft: 26, marginTop: 4, fontSize: 9.5, color: 'var(--fg-4)', fontStyle: 'italic' }}>
                              📋 {snippets.length} snippet{snippets.length === 1 ? '' : 's'} → xem ở Pre-deployment panel
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              ))}
              </Collapsible>
            );
          })()}

          {/* AccountBriefsSection đã move LÊN ĐẦU right column (line ~1633). */}

          {!isCreate && platform && platform.imageSpecs.length > 0 && (
            <Collapsible
              title="Image specs"
              badge={
                <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
                  {platform.imageSpecs.length}
                </span>
              }
              hint="logo / banner / avatar dimensions"
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {platform.imageSpecs.map((s, i) => (
                  <div key={i} style={{ padding: '6px 10px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, fontSize: 11 }}>
                    <div style={{ fontWeight: 600, color: 'var(--fg-0)' }}>{s.label}</div>
                    <div style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>{s.w}×{s.h} {s.kind}</div>
                    {s.note && <div style={{ color: 'var(--warn)', fontSize: 10, marginTop: 2 }}>{s.note}</div>}
                  </div>
                ))}
              </div>
            </Collapsible>
          )}
          </div>{/* /right column */}
        </div>

        <div className="modal-foot">
          <div className="meta">{isCreate ? 'New account' : `Editing #${account!.id}`}</div>
          <div className="modal-foot-actions">
            {!isCreate && account && (
              <SyncToDirectusButton projectId={projectId} accountId={account.id} tags={(account.tags as string[]) ?? []} />
            )}
            {!isCreate && (
              <button
                className="btn danger"
                onClick={handleDelete}
                title={confirmDelete ? 'Click lần nữa để xác nhận xoá vĩnh viễn' : 'Xoá account này (cần confirm)'}
                style={confirmDelete ? { animation: 'pulseDanger 1s ease-in-out infinite' } : undefined}
              >
                {confirmDelete ? '⚠ Click again to confirm' : '🗑 Delete'}
              </button>
            )}
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            <button className="btn primary" onClick={handleSave}
                    disabled={!form.platformKey}
                    title={!form.platformKey ? 'Phải chọn platform trước' : undefined}>
              {isCreate ? 'Create account' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// LocalAccountsPickerSection — pick an existing MOS2 account on this
// platform (already in this project) instead of creating a duplicate.
// Only mounted when AccountFormModal is in pick-mode (onCreated set).
// ──────────────────────────────────────────────────────────────────
interface LocalPickerRow {
  id: number;
  handle: string | null;
  email: string | null;
  status: string;
  tags: string[];
  briefedHabitats: string[];
  alreadyBriefedHere: boolean;
}

function LocalAccountsPickerSection({
  projectId, platformKey, platformLabel, excludeHabitatId, onPick,
}: {
  projectId: string;
  platformKey: string;
  platformLabel: string;
  excludeHabitatId?: number;
  onPick: (localAccountId: number) => void;
}) {
  const [accounts, setAccounts] = useState<LocalPickerRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listAccountsForProjectByPlatform(projectId, platformKey, excludeHabitatId).then((rows) => {
      if (!cancelled) { setAccounts(rows); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [projectId, platformKey, excludeHabitatId]);

  const total = accounts?.length ?? 0;
  const visible = useMemo(() => {
    if (!accounts) return [];
    const ql = query.trim().toLowerCase();
    if (!ql) return accounts;
    return accounts.filter((a) =>
      (a.handle || '').toLowerCase().includes(ql) ||
      (a.email  || '').toLowerCase().includes(ql) ||
      a.tags.some((t) => t.toLowerCase().includes(ql))
    );
  }, [accounts, query]);

  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <button type="button" onClick={() => setOpen((o) => !o)}
              style={{
                width: '100%', padding: '6px 10px',
                background: 'var(--accent-soft)', border: '1px solid var(--accent-line)',
                borderRadius: 6, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
                fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--accent)',
              }}>
        <span style={{ fontSize: 12 }}>⊕</span>
        <span style={{ color: 'var(--fg-0)', fontWeight: 600 }}>Pick existing MOS2 account on {platformLabel}</span>
        {loading
          ? <span style={{ color: 'var(--fg-3)' }}>· loading…</span>
          : total > 0
            ? <span style={{ padding: '1px 6px', borderRadius: 3, background: 'var(--accent)', color: '#fff', fontSize: 9, fontWeight: 700 }}>{total}</span>
            : <span style={{ color: 'var(--fg-3)', fontSize: 10 }}>· none</span>}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 9, opacity: 0.6 }}>{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div style={{ marginTop: 6, padding: 10, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6 }}>
          {loading ? (
            <div style={{ padding: 10, textAlign: 'center' }}><Spinner size="sm" /></div>
          ) : total === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--fg-3)', fontStyle: 'italic' }}>
              Project chưa có account nào trên {platformLabel}. Điền form bên trên để tạo mới, hoặc import từ Directus bên dưới.
            </div>
          ) : (
            <>
              {total > 5 && (
                <input type="text" placeholder="Search handle / email / tag…"
                       value={query} onChange={(e) => setQuery(e.target.value)}
                       autoComplete="off" data-1p-ignore data-lpignore="true" name="local-pk-q"
                       style={{ width: '100%', padding: '4px 8px', marginBottom: 6, background: 'var(--bg-1)', color: 'var(--fg-0)', border: '1px solid var(--line)', borderRadius: 4, fontSize: 11, outline: 'none' }} />
              )}
              {visible.length === 0 ? (
                <div style={{ fontSize: 11, color: 'var(--fg-3)', fontStyle: 'italic', padding: 8, textAlign: 'center' }}>
                  Không match &ldquo;{query}&rdquo;.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 240, overflowY: 'auto' }}>
                  {visible.map((acc) => {
                    const otherBriefs = excludeHabitatId
                      ? acc.briefedHabitats.filter((_, i) => acc.briefedHabitats[i] && true)  // simple list
                      : acc.briefedHabitats;
                    const briefCount = acc.briefedHabitats.length;
                    return (
                      <div key={acc.id}
                           style={{
                             display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto',
                             gap: 8, padding: '6px 8px',
                             background: acc.alreadyBriefedHere ? 'rgba(91,173,255,.06)' : 'var(--bg-1)',
                             border: `1px solid ${acc.alreadyBriefedHere ? 'var(--accent-line)' : 'var(--line)'}`,
                             borderRadius: 5, fontSize: 12, alignItems: 'center',
                           }}>
                        <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                          <span title={acc.handle || 'no-handle'}
                                style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--fg-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '40%', flexShrink: 1 }}>
                            @{acc.handle || <em style={{ color: 'var(--fg-3)' }}>no-handle</em>}
                          </span>
                          {acc.email && (
                            <span title={acc.email}
                                  style={{ color: 'var(--fg-3)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 1, minWidth: 0 }}>
                              {acc.email}
                            </span>
                          )}
                          <StatusPill status={acc.status} />
                          {acc.alreadyBriefedHere && (
                            <span title="Account đã có brief cho habitat này — pick sẽ mở edit modal"
                                  style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent-line)', fontFamily: 'var(--font-mono)', fontWeight: 600, flexShrink: 0 }}>
                              ✓ here
                            </span>
                          )}
                          {briefCount > 0 && (
                            <span title={`Đã có brief ở: ${otherBriefs.join(', ')}`}
                                  style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'var(--bg-3)', color: 'var(--fg-2)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                              🎯 {briefCount}
                            </span>
                          )}
                        </div>
                        <button type="button"
                                className={acc.alreadyBriefedHere ? 'btn' : 'btn primary'}
                                style={{ fontSize: 10, padding: '3px 8px', flexShrink: 0 }}
                                onClick={() => onPick(acc.id)}>
                          {acc.alreadyBriefedHere ? '✎ Edit' : '✓ Pick'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              <div style={{ fontSize: 9.5, color: 'var(--fg-4)', marginTop: 6, fontFamily: 'var(--font-mono)' }}>
                Pick = link account vào flow gọi modal (vd: thêm brief cho habitat). 🎯 N = đã có brief ở N habitat khác. ✓ here = đã có brief cho habitat hiện tại — Pick = edit brief.
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── ApiTokenSection: write-only set + reveal modal + clear ─────────
// Collapsible Directus import — collapsed by default, only expand if user wants to import.
function DirectusImportSection({
  state, platformLabel, importingId, onImport, onEditLocal,
}: {
  state: { loading: boolean; enabled: boolean; accounts: DirectusAccountSummary[]; error?: string };
  platformLabel: string;
  importingId: string | null;
  onImport: (directusId: string) => void;
  onEditLocal?: (localAccountId: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [showFilter, setShowFilter] = useState<'all' | 'available' | 'imported'>('available');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'todo' | 'creating' | 'warming' | 'limited' | 'blocked' | 'banned'>('all');

  const totalCount = state.accounts.length;

  // Counts per show-filter to render in the segmented control
  const importedCount = useMemo(() => state.accounts.filter((a) => a.localAccountId != null).length, [state.accounts]);
  const availableCount = totalCount - importedCount;

  const visible = useMemo(() => {
    const ql = query.trim().toLowerCase();
    return state.accounts.filter((a) => {
      if (showFilter === 'available' && a.localAccountId != null) return false;
      if (showFilter === 'imported'  && a.localAccountId == null) return false;
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (!ql) return true;
      return (a.handle || '').toLowerCase().includes(ql)
          || (a.email  || '').toLowerCase().includes(ql)
          || (a.notes  || '').toLowerCase().includes(ql)
          || a.tags.some((t) => t.toLowerCase().includes(ql));
    });
  }, [state.accounts, query, showFilter, statusFilter]);

  // Auto-expand if there's an error or zero accounts is uncertain — but default closed.
  const hasContent = state.loading || state.error || totalCount > 0;

  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%', padding: '6px 10px',
          background: 'var(--bg-2)', border: '1px dashed var(--line)',
          borderRadius: 6, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 8,
          fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--fg-2)',
        }}
      >
        <span style={{ fontSize: 12 }}>📥</span>
        <span>Import từ as.on.tc Directus</span>
        {state.loading && <span style={{ color: 'var(--fg-3)' }}>· loading…</span>}
        {!state.loading && totalCount > 0 && (
          <span style={{
            padding: '1px 6px', borderRadius: 3,
            background: 'var(--neon-lime)', color: 'var(--bg-0)', fontSize: 9, fontWeight: 700,
          }}>{availableCount} available · {importedCount} imported</span>
        )}
        {!state.loading && totalCount === 0 && !state.error && (
          <span style={{ color: 'var(--fg-3)', fontSize: 10 }}>· no records</span>
        )}
        {state.error && <span style={{ color: 'var(--bad)' }}>· error</span>}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 9, opacity: 0.6 }}>{open ? '▾' : '▸'}</span>
      </button>

      {open && hasContent && (
        <div style={{ marginTop: 6, padding: 10, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6 }}>
          {state.error && <div style={{ fontSize: 11, color: 'var(--bad)', marginBottom: 6 }}>⚠ {state.error}</div>}
          {!state.loading && !state.error && totalCount === 0 && (
            <div style={{ fontSize: 11, color: 'var(--fg-3)', fontStyle: 'italic' }}>
              Không có account nào trên platform &quot;{platformLabel}&quot; trong as.on.tc Directus.
            </div>
          )}
          {totalCount > 0 && (
            <>
              {/* ── Filter bar ─────────────────────────────── */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                <input
                  type="text" placeholder="Search handle / email / tag / notes…"
                  value={query} onChange={(e) => setQuery(e.target.value)}
                  autoComplete="off" data-1p-ignore data-lpignore="true" name="dx-q"
                  style={{
                    flex: '1 1 220px', minWidth: 160, padding: '4px 8px',
                    background: 'var(--bg-1)', color: 'var(--fg-0)',
                    border: '1px solid var(--line)', borderRadius: 4,
                    fontSize: 11, outline: 'none',
                  }}
                />
                <div style={{ display: 'inline-flex', gap: 2 }}>
                  {([
                    ['available', `↓ ${availableCount}`, 'Chưa import'],
                    ['imported',  `✓ ${importedCount}`,  'Đã import'],
                    ['all',       `· ${totalCount}`,     'Tất cả'],
                  ] as const).map(([k, lbl, hint]) => (
                    <button key={k} type="button"
                            title={hint}
                            onClick={() => setShowFilter(k)}
                            style={{
                              padding: '3px 7px', fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600,
                              background: showFilter === k ? 'var(--accent-soft)' : 'transparent',
                              color: showFilter === k ? 'var(--accent)' : 'var(--fg-2)',
                              border: `1px solid ${showFilter === k ? 'var(--accent-line)' : 'var(--line)'}`,
                              borderRadius: 4, cursor: 'pointer',
                            }}>
                      {lbl}
                    </button>
                  ))}
                </div>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                        style={{
                          padding: '3px 6px', fontSize: 10, fontFamily: 'var(--font-mono)',
                          background: 'var(--bg-1)', color: 'var(--fg-0)',
                          border: '1px solid var(--line)', borderRadius: 4, outline: 'none',
                        }}>
                  <option value="all">All status</option>
                  <option value="active">active</option>
                  <option value="warming">warming</option>
                  <option value="creating">creating</option>
                  <option value="todo">todo</option>
                  <option value="limited">limited</option>
                  <option value="blocked">blocked</option>
                  <option value="banned">banned</option>
                </select>
                {(query || showFilter !== 'available' || statusFilter !== 'all') && (
                  <button type="button"
                          onClick={() => { setQuery(''); setShowFilter('available'); setStatusFilter('all'); }}
                          title="Reset filter"
                          style={{ fontSize: 10, padding: '3px 7px', background: 'transparent', color: 'var(--fg-3)', border: '1px solid var(--line)', borderRadius: 4, cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>
                    ↺
                  </button>
                )}
                <span style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>
                  {visible.length}/{totalCount} match
                </span>
              </div>

              {visible.length === 0 ? (
                <div style={{ fontSize: 11, color: 'var(--fg-3)', fontStyle: 'italic', padding: 8, textAlign: 'center' }}>
                  Không match filter.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 240, overflowY: 'auto' }}>
              {visible.map((acc) => {
                const imported = acc.localAccountId != null;
                return (
                  <div key={acc.directusId}
                       style={{
                         display: 'grid',
                         gridTemplateColumns: 'minmax(0, 1fr) auto',
                         gap: 8, padding: '6px 8px',
                         background: imported ? 'rgba(16,185,129,.06)' : 'var(--bg-1)',
                         border: `1px solid ${imported ? 'rgba(16,185,129,.2)' : 'var(--line)'}`,
                         borderRadius: 5, fontSize: 12, alignItems: 'center',
                       }}>
                    <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                      <span title={acc.handle || 'no-handle'}
                            style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--fg-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '40%', flexShrink: 1 }}>
                        @{acc.handle || <em style={{ color: 'var(--fg-3)', fontStyle: 'italic' }}>no-handle</em>}
                      </span>
                      {acc.duplicateCount > 1 && (
                        <span title={`Directus has ${acc.duplicateCount} records (variants: ${acc.duplicatePlatformKeys.join(', ')})`}
                              style={{ fontSize: 9, padding: '1px 4px', borderRadius: 3, background: 'rgba(255,176,60,.15)', color: 'var(--warn)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                          ⚠ ×{acc.duplicateCount}
                        </span>
                      )}
                      {acc.email && (
                        <span title={acc.email}
                              style={{ color: 'var(--fg-3)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 1, minWidth: 0 }}>
                          {acc.email}
                        </span>
                      )}
                      <StatusPill status={acc.status} />
                      {acc.has2fa && <span title="2FA" style={{ fontSize: 10, flexShrink: 0 }}>🔐</span>}
                      {imported && <span title="Đã import vào MOS2" style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(16,185,129,.15)', color: 'var(--ok)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>✓ imported</span>}
                    </div>
                    <div style={{ flexShrink: 0 }}>
                      {imported && onEditLocal ? (
                        <button className="btn" style={{ fontSize: 10, padding: '3px 8px' }}
                                onClick={() => onEditLocal(acc.localAccountId!)}>
                          ✎ Edit
                        </button>
                      ) : (
                        <button className="btn primary" style={{ fontSize: 10, padding: '3px 8px' }}
                                disabled={importingId === acc.directusId}
                                onClick={() => onImport(acc.directusId)}>
                          {importingId === acc.directusId ? '…' : '↓ Import'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
                </div>
              )}
            </>
          )}
          {totalCount > 0 && (
            <div style={{ fontSize: 9.5, color: 'var(--fg-4)', marginTop: 6, fontFamily: 'var(--font-mono)' }}>
              Import = copy + tag <code>imported:directus:&lt;id&gt;</code>. Idempotent.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// AccountGrantsSection — share account cho agents + users khác.
// Owner (1 user chính) đã có ở "Assigned to manage". Bảng này thêm
// quyền sử dụng cho N entity khác. Vd: account Reddit owner=Hoàng Tuấn,
// share cho agent RES-04 + Linh để cùng dùng (không phải owner).
// ──────────────────────────────────────────────────────────────────
function AccountGrantsSection({ accountId, projectId, members }: {
  accountId: number;
  projectId: string;
  members: import('@/lib/actions/team').TeamMemberRow[];
}) {
  const router = useRouter();
  const [grants, setGrants] = useState<AccountGrantRow[]>([]);
  const [agents, setAgents] = useState<Array<{ agentRef: string; label: string | null; squadKey: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<'agent' | 'user' | null>(null);
  const [picking, setPicking] = useState('');

  const reload = async () => {
    setLoading(true);
    const [g, a] = await Promise.all([
      listAccountGrants(accountId),
      listProjectAgentsForGrant(projectId),
    ]);
    setGrants(g);
    setAgents(a);
    setLoading(false);
  };

  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [accountId]);

  const grantedAgentIds = new Set(grants.filter((g) => g.granteeKind === 'agent').map((g) => g.granteeId));
  const grantedUserIds = new Set(grants.filter((g) => g.granteeKind === 'user').map((g) => g.granteeId));

  const handleAdd = async (kind: 'agent' | 'user', id: string) => {
    const res = await addAccountGrant(accountId, kind, id, 'use');
    if (res.ok) {
      await reload();
      setAdding(null); setPicking('');
      router.refresh();
    }
  };

  const handleRemove = async (grantId: number) => {
    await removeAccountGrant(grantId);
    await reload();
    router.refresh();
  };

  return (
    <div>
      {loading && <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>Loading…</div>}

      {!loading && grants.length === 0 && !adding && (
        <div style={{ fontSize: 11, color: 'var(--fg-3)', fontStyle: 'italic', marginBottom: 8 }}>
          Chưa share cho ai. Owner (Assigned to manage) là người duy nhất truy cập được.
        </div>
      )}

      {!loading && grants.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
          {grants.map((g) => (
            <div key={g.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 10px',
              background: 'var(--bg-2)', border: '1px solid var(--line)',
              borderRadius: 5, fontSize: 12,
            }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 9,
                padding: '1px 6px', borderRadius: 3,
                background: g.granteeKind === 'agent' ? 'rgba(167,139,250,.15)' : 'rgba(56,189,248,.15)',
                color: g.granteeKind === 'agent' ? 'var(--neon-violet)' : 'var(--neon-cyan)',
                fontWeight: 700,
              }}>
                {g.granteeKind === 'agent' ? '🤖 AGENT' : '👤 USER'}
              </span>
              <span style={{ flex: 1, color: 'var(--fg-0)' }}>{g.granteeLabel}</span>
              <span style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>{g.role}</span>
              <button type="button"
                onClick={() => handleRemove(g.id)}
                title="Bỏ share"
                style={{ background: 'transparent', border: 'none', color: 'var(--fg-3)', cursor: 'pointer', fontSize: 14, padding: 0 }}
              >×</button>
            </div>
          ))}
        </div>
      )}

      {/* Add grant flow */}
      {!adding && (
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" className="btn" onClick={() => { setAdding('agent'); setPicking(''); }}
            style={{ fontSize: 11, padding: '4px 10px' }}>+ share to agent</button>
          <button type="button" className="btn" onClick={() => { setAdding('user'); setPicking(''); }}
            style={{ fontSize: 11, padding: '4px 10px' }}>+ share to user</button>
        </div>
      )}

      {adding === 'agent' && (
        <div style={{ marginTop: 4, padding: 8, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5 }}>
          <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginBottom: 6 }}>Chọn agent để share:</div>
          <select value={picking} onChange={(e) => setPicking(e.target.value)}
            style={{ width: '100%', padding: '5px 8px', background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 5, color: 'var(--fg-0)', fontSize: 12, marginBottom: 6 }}>
            <option value="">— pick agent —</option>
            {agents.map((a) => (
              <option key={a.agentRef} value={a.agentRef} disabled={grantedAgentIds.has(a.agentRef)}>
                {a.agentRef}{a.label ? ` · ${a.label}` : ''}{a.squadKey ? ` (${a.squadKey})` : ''}{grantedAgentIds.has(a.agentRef) ? ' ✓ already' : ''}
              </option>
            ))}
          </select>
          {agents.length === 0 && (
            <div style={{ fontSize: 10.5, color: 'var(--fg-3)', fontStyle: 'italic', marginBottom: 6 }}>
              Project chưa có agent nào. Tạo squad + agent ở Squads page trước.
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button type="button" className="btn ghost" onClick={() => { setAdding(null); setPicking(''); }}
              style={{ fontSize: 11, padding: '3px 10px' }}>Cancel</button>
            <button type="button" className="btn primary" disabled={!picking}
              onClick={() => handleAdd('agent', picking)}
              style={{ fontSize: 11, padding: '3px 10px' }}>Share</button>
          </div>
        </div>
      )}

      {adding === 'user' && (
        <div style={{ marginTop: 4, padding: 8, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5 }}>
          <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginBottom: 6 }}>Chọn user để share:</div>
          <select value={picking} onChange={(e) => setPicking(e.target.value)}
            style={{ width: '100%', padding: '5px 8px', background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 5, color: 'var(--fg-0)', fontSize: 12, marginBottom: 6 }}>
            <option value="">— pick user —</option>
            {members.map((m) => (
              <option key={m.userId} value={String(m.userId)} disabled={grantedUserIds.has(String(m.userId))}>
                {m.displayName}{m.email ? ` · ${m.email}` : ''}{grantedUserIds.has(String(m.userId)) ? ' ✓ already' : ''}
              </option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button type="button" className="btn ghost" onClick={() => { setAdding(null); setPicking(''); }}
              style={{ fontSize: 11, padding: '3px 10px' }}>Cancel</button>
            <button type="button" className="btn primary" disabled={!picking}
              onClick={() => handleAdd('user', picking)}
              style={{ fontSize: 11, padding: '3px 10px' }}>Share</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ApiTokenSection({ projectId, accountId, hasToken }: {
  projectId: string;
  accountId: number;
  hasToken: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const clip = useCopyToClipboard();
  const copyOk = clip.copied;
  const [tokenInput, setTokenInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fld = fieldStyle({ mono: true });

  const handleSave = () => {
    if (!tokenInput.trim()) { setError('token rỗng'); return; }
    startTransition(async () => {
      const res = await setAccountApiToken(projectId, accountId, tokenInput);
      if (!res.ok) { setError(res.error || 'save failed'); return; }
      setTokenInput('');
      setEditing(false);
      setError(null);
      router.refresh();
    });
  };
  const handleReveal = () => {
    setRevealing(true); setError(null);
    startTransition(async () => {
      const res = await revealAccountApiToken(projectId, accountId);
      setRevealing(false);
      if (!res.ok) { setError(res.error || 'reveal failed'); return; }
      setRevealed(res.plaintext ?? '');
    });
  };
  const handleCopy = () => { if (revealed) void clip.copy(revealed); };
  const [confirmClear, setConfirmClear] = useState(false);
  const handleClear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 4000);
      return;
    }
    startTransition(async () => {
      await clearAccountApiToken(projectId, accountId);
      setRevealed(null);
      setConfirmClear(false);
      router.refresh();
    });
  };

  return (
    <div style={{ marginTop: 14, padding: 10, background: 'rgba(157,108,255,.04)', border: '1px solid rgba(157,108,255,.2)', borderRadius: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--neon-violet)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          🔒 API Token
        </span>
        <span style={{ fontSize: 9, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>
          encrypted at-rest (pgcrypto · MOS2_SECRET_KEY)
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: hasToken ? 'var(--ok)' : 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>
          {hasToken ? '● set' : '○ not set'}
        </span>
      </div>

      {error && <div style={{ padding: '4px 8px', background: 'rgba(255,77,94,.08)', color: 'var(--bad)', fontSize: 11, borderRadius: 4, marginBottom: 6 }}>⚠ {error}</div>}

      {editing ? (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="password"
            style={fld}
            placeholder="paste token (sk-..., ghp_..., etc.)"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
            data-1p-ignore="true" data-lpignore="true" data-form-type="other"
          />
          <button className="btn primary" onClick={handleSave} style={{ fontSize: 11, padding: '4px 10px' }}>Encrypt + save</button>
          <button className="btn ghost" onClick={() => { setEditing(false); setTokenInput(''); }} style={{ fontSize: 11, padding: '4px 10px' }}>Cancel</button>
        </div>
      ) : revealed !== null ? (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input style={fld} value={revealed} readOnly onFocus={(e) => e.target.select()} />
          <button className="btn" onClick={handleCopy} style={{ fontSize: 11, padding: '4px 10px' }}>{copyOk ? '✓ copied' : '📋 Copy'}</button>
          <button className="btn ghost" onClick={() => setRevealed(null)} style={{ fontSize: 11, padding: '4px 10px' }}>Hide</button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 6 }}>
          {hasToken ? (
            <>
              <button className="btn" onClick={handleReveal} disabled={revealing} style={{ fontSize: 11, padding: '4px 10px' }}>
                {revealing ? '⟲ decrypting…' : '🔑 Reveal'}
              </button>
              <button className="btn" onClick={() => setEditing(true)} style={{ fontSize: 11, padding: '4px 10px' }}>↻ Replace</button>
              <button
                className="btn danger"
                onClick={handleClear}
                title={confirmClear ? 'Click lần nữa để xoá token vĩnh viễn' : 'Clear API token (cần confirm)'}
                style={{ fontSize: 11, padding: '4px 10px', ...(confirmClear ? { animation: 'pulseDanger 1s ease-in-out infinite' } : {}) }}
              >
                {confirmClear ? '⚠ Click again to clear' : '🗑 Clear'}
              </button>
            </>
          ) : (
            <button className="btn primary" onClick={() => setEditing(true)} style={{ fontSize: 11, padding: '4px 10px' }}>+ Set token</button>
          )}
        </div>
      )}
    </div>
  );
}

// ── AutoCheckButton: trigger runAccountAutoCheck + show last report inline ──
function AutoCheckButton({ projectId, accountId }: { projectId: string; accountId: number }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<AutoCheckReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleClick = () => {
    setBusy(true); setError(null);
    startTransition(async () => {
      const res = await runAccountAutoCheck(projectId, accountId);
      setBusy(false);
      if (!res.ok) { setError(res.error || 'check failed'); return; }
      setReport(res.report ?? null);
      router.refresh();
    });
  };

  return (
    <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
      <button type="button" onClick={handleClick} disabled={busy} className="btn"
              title="Auto-fetch metrics từ Reddit/HN/Bluesky API"
              style={{ fontSize: 10, padding: '2px 8px' }}>
        {busy ? '⟲ checking…' : '🔄 Auto-check'}
      </button>
      {report && (
        <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
          {report.results.filter((r) => r.ok).length}/{report.results.length} fetched
        </span>
      )}
      {error && (
        <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', color: 'var(--bad)' }} title={error}>⚠ error</span>
      )}
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────
// SyncToDirectusButton — push current MOS2 account to as.on.tc Directus.
// PATCH if account already has imported:directus:<id> tag, else POST new.
// ──────────────────────────────────────────────────────────────────
function SyncToDirectusButton({
  projectId, accountId, tags,
}: {
  projectId: string;
  accountId: number;
  tags: string[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<'created' | 'updated' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const importTag = tags.find((t) => t.startsWith('imported:directus:'));
  const hasDirectus = !!importTag;

  const handleClick = () => {
    setBusy(true); setError(null); setDone(null);
    startTransition(async () => {
      const res = await pushAccountToDirectus(projectId, accountId);
      setBusy(false);
      if (!res.ok) { setError(res.error || 'sync failed'); return; }
      setDone(res.created ? 'created' : 'updated');
      setTimeout(() => setDone(null), 3000);
      router.refresh();
    });
  };

  return (
    <button type="button" className="btn"
            onClick={handleClick} disabled={busy}
            title={hasDirectus
              ? 'Push thay đổi từ MOS2 → Directus (PATCH existing record)'
              : 'Tạo bản sao trên as.on.tc Directus (POST new record + tag local)'}
            style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      {busy ? <><Spinner size="xs" /> Syncing</>
        : done === 'created' ? '✓ Created in Directus'
        : done === 'updated' ? '✓ Updated in Directus'
        : error ? <span style={{ color: 'var(--bad)' }} title={error}>⚠ Sync failed</span>
        : <>↑ Sync to Directus{hasDirectus ? '' : ' (new)'}</>}
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────
// AccountBriefsSection — list + edit briefs for THIS account.
// Renders inside the account modal, lazy-loads briefs on mount.
// ──────────────────────────────────────────────────────────────────
function AccountBriefsSection({
  projectId, accountId, accountLabel, platforms,
  onOpenHabitat, onOpenBrief,
}: {
  projectId: string;
  accountId: number;
  accountLabel: string;
  platforms: PlatformRow[];
  onOpenHabitat?: (habitatId: number) => void;
  onOpenBrief?: (briefId: number) => void;
}) {
  const [briefs, setBriefs] = useState<BriefForAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<BriefForAccount | null>(null);
  const [creatingHabitatId, setCreatingHabitatId] = useState<number | null>(null);
  const [creatingHabitatLabel, setCreatingHabitatLabel] = useState<string>('');
  const [picking, setPicking] = useState(false);
  const [addable, setAddable] = useState<Array<{ id: number; name: string; kind: string; url: string | null; tribeName: string | null }>>([]);
  const [bumpKey, setBumpKey] = useState(0);
  // Inline "+ New habitat" — opens HabitatFormModal in-place instead of navigating
  const [showQuickHabitat, setShowQuickHabitat] = useState(false);
  const [tribesForPicker, setTribesForPicker] = useState<TribeRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    listBriefsForAccount(accountId).then((rows) => {
      if (!cancelled) { setBriefs(rows); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [accountId, bumpKey]);

  const refresh = () => setBumpKey((n) => n + 1);

  const handleAdd = async () => {
    setPicking(true);
    const list = await listAddableHabitatsForAccount(projectId, accountId);
    setAddable(list);
  };

  return (
    <Collapsible
      title="🎯 Habitats engaging"
      defaultOpen={true}
      badge={
        <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', color: briefs.length > 0 ? 'var(--accent)' : 'var(--fg-3)', padding: '1px 6px', borderRadius: 3, background: briefs.length > 0 ? 'var(--accent-soft)' : 'var(--bg-2)' }}>
          {briefs.length}
        </span>
      }
      hint={
        <button className="btn" type="button" onClick={(e) => { e.stopPropagation(); handleAdd(); }}
                style={{ fontSize: 10, padding: '2px 8px' }}>
          + Add community
        </button>
      }
    >
      {loading ? (
        <div style={{ padding: 12, textAlign: 'center', color: 'var(--fg-3)' }}>
          <Spinner size="sm" /> <span style={{ marginLeft: 6, fontSize: 11 }}>Loading briefs…</span>
        </div>
      ) : briefs.length === 0 ? (
        <div style={{ padding: 10, fontSize: 11, color: 'var(--fg-3)', borderRadius: 5, background: 'var(--bg-2)', border: '1px dashed var(--line)' }}>
          Chưa có phương án tiếp cận nào. Click <strong>+ Add community</strong> để link account này vào 1 community + viết approach.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {briefs.map((b) => {
            const joinColor = JOIN_STATUS_COLOR[b.joinStatus];
            const joinIcon = JOIN_STATUS_ICON[b.joinStatus];
            const joinLabel = JOIN_STATUS_LABEL[b.joinStatus];
            const phaseLabel = PHASE_LABEL[b.currentPhase];
            // Mỗi part click vào đúng đối tượng:
            //   row body / icon → Brief modal (chiến lược + bài)
            //   habitat name → Habitat modal (rules/members/topics)
            //   Edit fallback (legacy) khi parent ko pass onOpenBrief
            const handleBriefClick = () => {
              if (onOpenBrief) onOpenBrief(b.id);
              else setEditing(b);
            };
            const handleHabitatClick = (e: React.MouseEvent) => {
              e.stopPropagation();
              if (onOpenHabitat) onOpenHabitat(b.habitatId);
              else setEditing(b); // fallback nếu parent ko wire — vẫn mở brief edit
            };
            return (
            <div key={b.id}
                 style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 8, padding: '6px 8px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5, alignItems: 'center' }}>
              {/* Icon → click mở Brief modal (chiến lược) */}
              <button type="button" onClick={handleBriefClick}
                      title={`Mở Brief modal (chiến lược + phase + bài) cho ${b.habitatName}`}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                               display: 'inline-flex', borderRadius: 5 }}>
                <SiteFavicon url={b.habitatUrl} kind={b.habitatKind} size={28}
                             title="" style={{ borderRadius: 5 }} />
              </button>
              <div style={{ minWidth: 0, cursor: 'pointer' }} onClick={handleBriefClick} title="Click để mở Brief modal">
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2, flexWrap: 'wrap' }}>
                  {/* Habitat name → click mở Habitat modal */}
                  <button type="button" onClick={handleHabitatClick}
                          title={`Mở Habitat modal (rules/members/topics): ${b.habitatName}`}
                          style={{ background: 'none', border: 'none', padding: 0, fontSize: 12,
                                   fontWeight: 600, color: 'var(--fg-0)', cursor: 'pointer',
                                   textDecoration: 'underline', textDecorationStyle: 'dotted',
                                   textDecorationColor: 'var(--fg-4)', textUnderlineOffset: 3,
                                   overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {b.habitatName}
                  </button>
                  <Pill color="var(--fg-3)" label={b.habitatKind} size="xs" tone="ghost" />
                  {b.tribeName && <Pill color="var(--accent)" label={b.tribeName} size="xs" tone="soft" uppercase={false} />}
                  {b.habitatMembers > 0 && <span style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>{(b.habitatMembers / 1000).toFixed(b.habitatMembers > 9999 ? 0 : 1)}k</span>}
                  {/* Join status chip — tầng 2 */}
                  <span title={`Join status (tầng 2 — membership per-habitat): ${joinLabel}`}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 3,
                                 padding: '0 6px', fontSize: 9, fontFamily: 'var(--font-mono)',
                                 fontWeight: 700, borderRadius: 3, textTransform: 'uppercase',
                                 background: joinColor + (b.joinStatus === 'joined' ? '1a' : '22'),
                                 color: joinColor,
                                 border: `1px solid ${joinColor}66` }}>
                    {joinIcon} {joinLabel}
                  </span>
                  {/* Phase chip — tầng 3 */}
                  <PhasePill phase={b.currentPhase} size="sm"
                             title={`Engagement phase (tầng 3 — strategy step): ${phaseLabel}`} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--fg-2)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {b.approachMd ? b.approachMd.split('\n')[0] : <em style={{ color: 'var(--fg-4)' }}>chưa viết approach</em>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {b.cadence && <span style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }} title="Cadence">⏱ {b.cadence}</span>}
                {b.tone && <span style={{ fontSize: 10, color: 'var(--fg-3)' }} title={`Tone: ${b.tone}`}>🎵</span>}
                {b.templates.length > 0 && <span style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }} title={`${b.templates.length} templates`}>📝 {b.templates.length}</span>}
              </div>
            </div>
            );
          })}
        </div>
      )}

      {picking && (
        <ResourcePicker
          title="Chọn community để add brief"
          hint="Habitat trong cùng project. Add brief = link account này × community + viết phương án tiếp cận."
          items={addable}
          getKey={(h) => h.id}
          renderItem={(h) => ({
            title: h.name,
            subtitle: `${h.kind}${h.tribeName ? ` · tribe: ${h.tribeName}` : ''}${h.url ? ` · ${h.url}` : ''}`,
          })}
          onPick={(h) => {
            setCreatingHabitatId(h.id);
            setCreatingHabitatLabel(`${h.name} · ${h.kind}${h.tribeName ? ` · tribe: ${h.tribeName}` : ''}`);
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
          createLabel="+ New habitat"
          onCreateNew={async () => {
            // Lazy-load tribes for the form's tribe-picker dropdown
            const t = await listTribesForProject(projectId);
            setTribesForPicker(t as TribeRow[]);
            setPicking(false);
            setShowQuickHabitat(true);
          }}
          emptyMessage={
            <>Project này chưa có habitat (community) nào, hoặc account đã có brief cho mọi community.<br />
            Click <strong>+ New habitat</strong> bên dưới để tạo nhanh tại đây.</>
          }
        />
      )}

      {showQuickHabitat && (
        <HabitatFormModal
          projectId={projectId}
          habitat={null}
          tribes={tribesForPicker}
          platforms={platforms}
          onClose={() => setShowQuickHabitat(false)}
          onCreated={(newHabitatId) => {
            // Auto-pick the just-created habitat into the brief flow
            setCreatingHabitatId(newHabitatId);
            setCreatingHabitatLabel('(new habitat)');
          }}
        />
      )}

      {/* Edit modal — for existing brief */}
      {editing && (
        <BriefEditModal
          projectId={projectId}
          accountId={accountId}
          habitatId={editing.habitatId}
          accountLabel={accountLabel}
          habitatLabel={`${editing.habitatName} · ${editing.habitatKind}`}
          habitatUrl={editing.habitatUrl}
          existing={editing}
          onClose={() => { setEditing(null); refresh(); }}
        />
      )}

      {/* Create modal — for new (account, habitat) pair */}
      {creatingHabitatId != null && (
        <BriefEditModal
          projectId={projectId}
          accountId={accountId}
          habitatId={creatingHabitatId}
          accountLabel={accountLabel}
          habitatLabel={creatingHabitatLabel}
          existing={null}
          onClose={() => { setCreatingHabitatId(null); refresh(); }}
        />
      )}
    </Collapsible>
  );
}
