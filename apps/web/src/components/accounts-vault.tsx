'use client';

import { useState, useTransition, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { PlatformRow, AccountRow } from '@/lib/data';
import type { Project } from '@/lib/mock/types';
import {
  createAccount, updateAccount, deleteAccount, setAccountStatus, toggleChecklistItem,
  listDirectusAccountsForPlatform, importDirectusAccount,
  setAccountApiToken, revealAccountApiToken, clearAccountApiToken,
  type AccountStatus, type AuthMethod, type DirectusAccountSummary,
} from '@/lib/actions/accounts';
import { runAccountAutoCheck, type AutoCheckReport } from '@/lib/actions/warmup';
import { Pill, EmptyState } from './ui';
import { fillTemplate } from '@/lib/template';
import { AIFormParser } from './ai-form-parser';
import { NoFillInput } from './no-fill-input';
import { PlatformPicker } from './platform-picker';

const STATUSES: { key: AccountStatus; label: string; color: string; dot: string }[] = [
  { key: 'todo',     label: 'TODO',     color: '#60a5fa', dot: '🔵' },
  { key: 'creating', label: 'CREATING', color: '#fb923c', dot: '🟠' },
  { key: 'warming',  label: 'WARMING',  color: '#fbbf24', dot: '🟡' },
  { key: 'active',   label: 'ACTIVE',   color: '#10b981', dot: '🟢' },
  { key: 'limited',  label: 'LIMITED',  color: '#a78bfa', dot: '🟣' },
  { key: 'blocked',  label: 'BLOCKED',  color: '#6b7280', dot: '🚫' },
  { key: 'banned',   label: 'BANNED',   color: '#f87171', dot: '🔴' },
];

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
  const s = STATUSES.find((x) => x.key === status) ?? STATUSES[0]!;
  return <Pill color={s.color} icon={s.dot} label={s.label} size="xs" />;
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

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      alert('Clipboard write failed — copy manually.');
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
          <>
            <button type="button"
                    onClick={() => setVariant(-1)}
                    title="Primary"
                    className="btn ghost"
                    style={{ fontSize: 9, padding: '1px 5px', background: variant === -1 ? 'var(--accent-soft)' : undefined, color: variant === -1 ? 'var(--accent)' : undefined }}>1</button>
            {snippet.alt.map((_, i) => (
              <button key={i} type="button"
                      onClick={() => setVariant(i)}
                      title={`Alt ${i + 1} (shorter)`}
                      className="btn ghost"
                      style={{ fontSize: 9, padding: '1px 5px', background: variant === i ? 'var(--accent-soft)' : undefined, color: variant === i ? 'var(--accent)' : undefined }}>{i + 2}</button>
            ))}
          </>
        )}
        <button type="button"
                onClick={handleCopy}
                className="btn"
                style={{
                  fontSize: 10, padding: '2px 8px',
                  background: copied ? 'rgba(16,185,129,.1)' : undefined,
                  borderColor: copied ? 'rgba(16,185,129,.4)' : undefined,
                  color: copied ? '#10b981' : undefined,
                }}>
          {copied ? '✓ Copied' : '📋 Copy'}
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

export function AccountsVault({ projectId, project, platforms, accounts }: {
  projectId: string;
  project: Project;
  platforms: PlatformRow[];
  accounts: AccountRow[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<AccountRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [filterStatus, setFilterStatus] = useState<AccountStatus | 'all'>('all');
  const [, startTransition] = useTransition();

  const platformMap = useMemo(() => Object.fromEntries(platforms.map((p) => [p.key, p])), [platforms]);
  const filtered = filterStatus === 'all' ? accounts : accounts.filter((a) => a.status === filterStatus);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: accounts.length };
    for (const s of STATUSES) c[s.key] = accounts.filter((a) => a.status === s.key).length;
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
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
            🔐 Accounts <small style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)', fontWeight: 400 }}>// {accounts.length} on {platforms.length} platforms</small>
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--fg-3)' }}>
            Đăng ký tài khoản trên các nền tảng. Click signup → mở tab mới với link đăng ký official.
          </p>
        </div>
        <button className="btn primary" onClick={() => setCreating(true)}>+ New account</button>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        <span className="chip" data-active={filterStatus === 'all' || undefined} onClick={() => setFilterStatus('all')}>
          All <span style={{ marginLeft: 4, opacity: 0.6 }}>{counts.all}</span>
        </span>
        {STATUSES.map((s) => (
          <span key={s.key} className="chip" data-active={filterStatus === s.key || undefined}
                onClick={() => setFilterStatus(s.key)}
                style={{ color: filterStatus === s.key ? s.color : undefined }}>
            {s.dot} {s.label} <span style={{ marginLeft: 4, opacity: 0.6 }}>{counts[s.key] ?? 0}</span>
          </span>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="🔐"
          title={accounts.length === 0 ? 'Chưa có account nào' : `Không có account nào ở status "${filterStatus}"`}
          description={accounts.length === 0 ? 'Tạo account đầu tiên để bắt đầu đăng ký các platform.' : undefined}
          action={accounts.length === 0 ? <button className="btn primary" onClick={() => setCreating(true)}>+ New account</button> : undefined}
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
                    {/* Signup chỉ show khi đang onboarding (todo / creating). Khi đã warming/
                       active/limited/blocked/banned thì account đã exist, không cần signup nữa. */}
                    {pf?.signupUrl && (acc.status === 'todo' || acc.status === 'creating') && (
                      <a href={pf.signupUrl} target="_blank" rel="noopener noreferrer"
                         className="btn primary" style={{ fontSize: 10, padding: '3px 8px' }}>
                        ↗ Signup
                      </a>
                    )}
                    {/* Post chỉ khi active — account đã sẵn sàng publish content. */}
                    {pf?.postUrl && acc.status === 'active' && (
                      <a href={pf.postUrl} target="_blank" rel="noopener noreferrer"
                         className="btn" style={{ fontSize: 10, padding: '3px 8px' }}>
                        + Post
                      </a>
                    )}
                    {LINEAR_FLOW.includes(acc.status as AccountStatus) && acc.status !== 'todo' && (
                      <button className="btn" style={{ fontSize: 10, padding: '3px 8px' }} title="Step back" onClick={() => handleQuickAdvance(acc, -1)}>←</button>
                    )}
                    {LINEAR_FLOW.includes(acc.status as AccountStatus) && acc.status !== 'active' && (
                      <button className="btn primary" style={{ fontSize: 10, padding: '3px 8px' }} title="Advance status" onClick={() => handleQuickAdvance(acc, 1)}>→</button>
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
          onClose={() => { setEditing(null); setCreating(false); }}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Account form modal (create + edit + warmup checklist)
// ──────────────────────────────────────────────────────────────────────

function AccountFormModal({ account, project, projectId, platforms, onClose }: {
  account: AccountRow | null;
  project: Project;
  projectId: string;
  platforms: PlatformRow[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isCreate = !account;

  const [form, setForm] = useState({
    platformKey: account?.platformKey ?? platforms[0]?.key ?? '',
    handle: account?.handle ?? '',
    email: account?.email ?? '',
    status: (account?.status ?? 'todo') as AccountStatus,
    authMethod: (account?.authMethod ?? 'password') as AuthMethod,
    has2fa: account?.has2fa ?? false,
    recoveryInfo: account?.recoveryInfo ?? '',
    monthlyCost: account?.monthlyCost ?? 0,
    blockReason: account?.blockReason ?? '',
    notes: account?.notes ?? '',
  });
  const setF = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const platform = platforms.find((p) => p.key === form.platformKey);

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
      };
      const res = isCreate
        ? await createAccount(projectId, payload)
        : await updateAccount(projectId, account!.id, payload);
      if (!res.ok) { setError(res.error || 'Save failed'); return; }
      router.refresh();
      onClose();
    });
  };

  const handleDelete = () => {
    if (!account) return;
    if (!confirm(`Xoá account "${account.handle || account.platformKey}"? Không thể undo.`)) return;
    startTransition(async () => {
      const res = await deleteAccount(projectId, account.id);
      if (!res.ok) { alert(res.error); return; }
      router.refresh();
      onClose();
    });
  };

  const handleToggleChecklist = (itemKey: string, currentDone: boolean) => {
    if (!account) return;
    startTransition(async () => {
      await toggleChecklistItem(projectId, account.id, itemKey, !currentDone);
      router.refresh();
    });
  };

  const fld: React.CSSProperties = {
    width: '100%', padding: '6px 8px', background: 'var(--bg-2)', border: '1px solid var(--line)',
    borderRadius: 5, color: 'var(--fg-0)', fontSize: 13, outline: 'none',
  };
  const lbl: React.CSSProperties = {
    fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)',
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, display: 'block',
  };

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
      <div className="modal" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div style={{ flex: 1 }}>
            <div className="id-line">
              {account ? `Account #${account.id}` : 'NEW ACCOUNT'}
              {platform && <> • <PlatformIcon slug={platform.iconSlug} /> {platform.label}</>}
            </div>
            <h2>{isCreate ? '+ New account' : `${platform?.label} — @${account!.handle || 'no-handle'}`}</h2>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {error && (
          <div style={{ padding: '8px 14px', background: 'rgba(255,77,94,.08)', borderBottom: '1px solid rgba(255,77,94,.3)', color: 'var(--bad)', fontSize: 12 }}>⚠ {error}</div>
        )}

        <AIFormParser
          currentValues={form}
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

        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <span style={lbl}>Platform *</span>
              <PlatformPicker
                platforms={platforms}
                value={form.platformKey}
                onChange={(k) => setF('platformKey', k)}
                fld={fld}
              />
              {platform && (
                <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11 }}>
                  <a href={platform.signupUrl} target="_blank" rel="noopener noreferrer"
                     style={{ color: 'var(--accent)', textDecoration: 'none' }}>↗ Signup page</a>
                  {platform.postUrl && (
                    <a href={platform.postUrl} target="_blank" rel="noopener noreferrer"
                       style={{ color: 'var(--accent)', textDecoration: 'none' }}>↗ Post page</a>
                  )}
                  <span style={{ color: 'var(--fg-3)' }}>
                    Priority: <b style={{ color: PRIORITY_COLOR[platform.priority] }}>{platform.priority}</b>
                  </span>
                </div>
              )}
            </div>

            {/* Import from as.on.tc — only when creating + bridge enabled. Collapsed by default. */}
            {isCreate && form.platformKey && directusState.enabled && (
              <DirectusImportSection
                state={directusState}
                platformLabel={platform?.label ?? form.platformKey}
                importingId={importingId}
                onImport={handleImport}
              />
            )}
            <div>
              <span style={lbl}>Handle / username</span>
              <NoFillInput
                style={fld}
                placeholder="orit, @oritapp..."
                value={form.handle}
                onChange={(e) => setF('handle', e.target.value)}
              />
            </div>
            <div>
              <span style={lbl}>Email</span>
              <NoFillInput
                style={fld}
                placeholder="account@..."
                value={form.email}
                onChange={(e) => setF('email', e.target.value)}
              />
            </div>
            <div>
              <span style={lbl}>Status</span>
              <select style={fld} value={form.status} onChange={(e) => setF('status', e.target.value as AccountStatus)}>
                {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.dot} {s.label}</option>)}
              </select>
            </div>
            <div>
              <span style={lbl}>Auth method</span>
              <select style={fld} value={form.authMethod} onChange={(e) => setF('authMethod', e.target.value as AuthMethod)}>
                {AUTH_METHODS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
            </div>
            {(form.status === 'limited' || form.status === 'blocked' || form.status === 'banned') && (
              <div style={{ gridColumn: '1 / -1' }}>
                <span style={lbl}>Block reason</span>
                <select style={fld} value={form.blockReason} onChange={(e) => setF('blockReason', e.target.value)}>
                  <option value="">— select —</option>
                  {BLOCK_REASONS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                </select>
              </div>
            )}
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
            <div style={{ gridColumn: '1 / -1' }}>
              <span style={lbl}>Notes</span>
              <textarea style={{ ...fld, minHeight: 60, resize: 'vertical' }} value={form.notes} onChange={(e) => setF('notes', e.target.value)} />
            </div>
          </div>

          {/* API Token (encrypted via pgcrypto) — only edit-mode */}
          {!isCreate && (
            <ApiTokenSection
              projectId={projectId}
              accountId={account!.id}
              hasToken={account!.hasApiToken}
            />
          )}

          {/* Warmup checklist + image specs (only when editing existing account) */}
          {!isCreate && platform && platform.checklist.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className="modal-section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>Warmup checklist · {platform.label}</span>
                {phasesToShow.length === 1 && (
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', fontWeight: 400 }}>
                    showing only "{phasesToShow[0]}" phase (matches account status)
                  </span>
                )}
                {(platform.checklist as Array<{ auto?: string }>).some((c) => c.auto) && (
                  <AutoCheckButton projectId={projectId} accountId={account!.id} />
                )}
              </div>
              {phasesToShow.map((phase) => (
                checklistByPhase[phase].length > 0 && (
                  <div key={phase} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '4px 0' }}>
                      {phase === 'creating' ? '🌱 Creating' : phase === 'warming' ? '🔥 Warming' : '🚀 Active'}
                    </div>
                    {checklistByPhase[phase].map((item) => {
                      const state = account!.warmupChecklist[item.key] ?? { done: false };
                      const snippets = item.snippets ?? [];
                      return (
                        <div key={item.key} style={{ padding: '5px 0', borderBottom: '1px dashed var(--line)' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                            <input type="checkbox" checked={state.done} onChange={() => handleToggleChecklist(item.key, state.done)} style={{ marginTop: 2 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, color: state.done ? 'var(--fg-3)' : 'var(--fg-0)', textDecoration: state.done ? 'line-through' : 'none' }}>
                                {item.key.replace(/_/g, ' ')}
                              </div>
                              {item.tip && <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 2 }}>{item.tip}</div>}
                            </div>
                            {item.actionUrl && (
                              <a href={item.actionUrl} target="_blank" rel="noopener noreferrer"
                                 className="btn" style={{ fontSize: 10, padding: '2px 6px', flexShrink: 0 }}>↗</a>
                            )}
                          </div>
                          {snippets.length > 0 && (
                            <div style={{ marginLeft: 26, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 5 }}>
                              {snippets.map((snip, i) => <SnippetCard key={i} snippet={snip} vars={templateVars} />)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              ))}
            </div>
          )}

          {!isCreate && platform && platform.imageSpecs.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div className="modal-section-title">Image specs</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {platform.imageSpecs.map((s, i) => (
                  <div key={i} style={{ padding: '6px 10px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, fontSize: 11 }}>
                    <div style={{ fontWeight: 600, color: 'var(--fg-0)' }}>{s.label}</div>
                    <div style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>{s.w}×{s.h} {s.kind}</div>
                    {s.note && <div style={{ color: 'var(--warn)', fontSize: 10, marginTop: 2 }}>{s.note}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-foot">
          <div className="meta">{isCreate ? 'New account' : `Editing #${account!.id}`}</div>
          <div className="modal-foot-actions">
            {!isCreate && <button className="btn danger" onClick={handleDelete}>🗑 Delete</button>}
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            <button className="btn primary" onClick={handleSave}>{isCreate ? 'Create account' : 'Save'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ApiTokenSection: write-only set + reveal modal + clear ─────────
// Collapsible Directus import — collapsed by default, only expand if user wants to import.
function DirectusImportSection({
  state, platformLabel, importingId, onImport,
}: {
  state: { loading: boolean; enabled: boolean; accounts: DirectusAccountSummary[]; error?: string };
  platformLabel: string;
  importingId: string | null;
  onImport: (directusId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const count = state.accounts.length;
  // Auto-expand if there's an error or zero accounts is uncertain — but default closed.
  const hasContent = state.loading || state.error || count > 0;

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
        {!state.loading && count > 0 && (
          <span style={{
            padding: '1px 6px', borderRadius: 3,
            background: 'var(--neon-lime)', color: 'var(--bg-0)', fontSize: 9, fontWeight: 700,
          }}>{count} available</span>
        )}
        {!state.loading && count === 0 && !state.error && (
          <span style={{ color: 'var(--fg-3)', fontSize: 10 }}>· no records</span>
        )}
        {state.error && <span style={{ color: 'var(--bad)' }}>· error</span>}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 9, opacity: 0.6 }}>{open ? '▾' : '▸'}</span>
      </button>

      {open && hasContent && (
        <div style={{ marginTop: 6, padding: 10, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6 }}>
          {state.error && <div style={{ fontSize: 11, color: 'var(--bad)', marginBottom: 6 }}>⚠ {state.error}</div>}
          {!state.loading && !state.error && count === 0 && (
            <div style={{ fontSize: 11, color: 'var(--fg-3)', fontStyle: 'italic' }}>
              Không có account nào trên platform &quot;{platformLabel}&quot; trong as.on.tc Directus.
            </div>
          )}
          {count > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
              {state.accounts.map((acc) => (
                <div key={acc.directusId}
                     style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 5, fontSize: 12 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--fg-0)' }}>
                    @{acc.handle || <em style={{ color: 'var(--fg-3)', fontStyle: 'italic' }}>no-handle</em>}
                  </span>
                  {acc.duplicateCount > 1 && (
                    <span title={`Directus has ${acc.duplicateCount} records (variants: ${acc.duplicatePlatformKeys.join(', ')})`}
                          style={{ fontSize: 9, padding: '1px 4px', borderRadius: 3, background: 'rgba(255,176,60,.15)', color: 'var(--warn)', fontFamily: 'var(--font-mono)' }}>
                      ⚠ ×{acc.duplicateCount}
                    </span>
                  )}
                  {acc.email && <span style={{ color: 'var(--fg-3)', fontSize: 11 }}>{acc.email}</span>}
                  <StatusPill status={acc.status} />
                  {acc.has2fa && <span title="2FA" style={{ fontSize: 10 }}>🔐</span>}
                  <span style={{ flex: 1 }} />
                  <button className="btn primary" style={{ fontSize: 10, padding: '3px 8px' }}
                          disabled={importingId === acc.directusId}
                          onClick={() => onImport(acc.directusId)}>
                    {importingId === acc.directusId ? '…' : '↓ Import'}
                  </button>
                </div>
              ))}
            </div>
          )}
          {count > 0 && (
            <div style={{ fontSize: 9.5, color: 'var(--fg-4)', marginTop: 6, fontFamily: 'var(--font-mono)' }}>
              Import = copy + tag <code>imported:directus:&lt;id&gt;</code>. Idempotent.
            </div>
          )}
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
  const [copyOk, setCopyOk] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fld: React.CSSProperties = {
    width: '100%', padding: '6px 8px', background: 'var(--bg-2)', border: '1px solid var(--line)',
    borderRadius: 5, color: 'var(--fg-0)', fontSize: 12, outline: 'none', fontFamily: 'var(--font-mono)',
  };

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
  const handleCopy = async () => {
    if (!revealed) return;
    try { await navigator.clipboard.writeText(revealed); setCopyOk(true); setTimeout(() => setCopyOk(false), 1500); } catch {}
  };
  const handleClear = () => {
    if (!confirm('Xoá API token? Action này không hoàn tác — token plaintext không khôi phục được.')) return;
    startTransition(async () => {
      await clearAccountApiToken(projectId, accountId);
      setRevealed(null);
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
              <button className="btn danger" onClick={handleClear} style={{ fontSize: 11, padding: '4px 10px' }}>🗑 Clear</button>
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
