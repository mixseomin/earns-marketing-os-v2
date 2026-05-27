'use client';

// Seeding Cockpit — bề mặt vận hành tập trung cho nhịp seeding / nhận
// diện thương hiệu. Hàng đợi Quá hạn → Đến hạn → Tuần này → Sắp tới,
// footprint 30 ngày, semi-auto sinh nháp, mark-seeded. Modal lịch
// URL-synced (?m=schedule&mId=<briefId>).

import { useState, useMemo, useEffect, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { SeedingQueueItem, SeedingStatus } from '@/lib/actions/seeding';
import {
  generateDueDrafts, generateOneDraft,
  retireAccount, reviveAccount, cleanupUnpostedDrafts,
} from '@/lib/actions/seeding';
import { getBriefForModal, getHabitatRowAction, reassignBriefAccount, autoFixBriefAccount, type BriefRow, type BriefModalCtx } from '@/lib/actions/community-briefs';
import { SwapAccountButton } from './swap-account-button';
import type { TribeRow, PlatformRow, AccountRow, HabitatRow } from '@/lib/data';
import type { Project } from '@/lib/mock/types';
import { getAccountForEdit } from '@/lib/actions/accounts';
import { AccountFormModal } from './accounts-vault';
import { HabitatFormModal } from './habitat-form-modal';
import { PHASE_LABEL, PHASE_COLOR, type Phase } from '@/lib/phase-plan';
import { useModalParam } from '@/lib/use-modal-param';
import { allowedFormats, formatMeta, effectiveMix, formatColors } from '@/lib/content-formats';
import {
  Spinner, Segmented, EmptyState, SiteFavicon, FormatIcon,
  IconFilePlus, IconList, IconBan, IconGear, IconUndo,
  IconTrash, IconGlobe, IconClock, IconChevron, IconWarn, IconSwap, IconPencil, IconX, IconDots, InfoHint,
} from './ui';
import { ScheduleEditModal } from './schedule-edit-modal';
import { BriefEditModal } from './brief-edit-modal';
import { TribeFormModal } from './tribe-form-modal';
import { BriefPipelineModal } from './brief-pipeline-modal';

// STATUS_META + ACCT_STATUS_META đã centralize trong @/lib/status-meta để
// đồng bộ với accounts-vault + brief-edit-modal. Adapter giữ shape cũ.
import { SEEDING_STATUS_META, ACCOUNT_STATUS_META } from '@/lib/status-meta';
import { LangChip } from './lang-chip';
const STATUS_META: Record<SeedingStatus, { label: string; color: string }> =
  Object.fromEntries(
    (Object.entries(SEEDING_STATUS_META) as Array<[SeedingStatus, typeof SEEDING_STATUS_META[SeedingStatus]]>)
      .map(([k, v]) => [k, { label: v.label, color: v.color }]),
  ) as Record<SeedingStatus, { label: string; color: string }>;

import {
  ACCT_STATUS_META, blockingIssues, isDeadStatus, notReady,
  platformIssue, expectedPlatformForKind, type SeedingIssue,
} from '@/lib/seeding-issues';

const RETIRE_REASONS = [
  { key: 'banned',  label: 'Bị banned vĩnh viễn' },
  { key: 'lost-login', label: 'Mất login / 2FA' },
  { key: 'suspend-loop', label: 'Tự suspend sau tạo' },
  { key: 'other', label: 'Lý do khác' },
];

function dueLabel(d: number): string {
  if (d === 0) return 'hôm nay';
  if (d < 0) return `quá ${-d}d`;
  return `còn ${d}d`;
}
function healthColor(pct: number) {
  return pct >= 80 ? 'var(--ok)' : pct >= 40 ? 'var(--warn)' : 'var(--bad)';
}

// In-place opener — KHÔNG navigate (rule modal/drawer-first: click entity
// → mở modal tại chỗ, URL-synced qua useModalParam, F5 giữ nguyên trang).
function EntityLink({ onClick, title, color, children }: {
  onClick: () => void; title: string; color?: string; children: React.ReactNode;
}) {
  return (
    <span role="button" tabIndex={0} title={title}
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
          style={{ color: color ?? 'inherit', borderBottom: '1px dotted currentColor', cursor: 'pointer' }}>
      {children}
    </span>
  );
}

export function SeedingCockpit({ projectId, projectName, project, platforms, queue, tribes }: {
  projectId: string;
  projectName: string;
  project: Project;
  platforms: PlatformRow[];
  queue: SeedingQueueItem[];
  tribes: TribeRow[];
}) {
  const router = useRouter();
  const modal = useModalParam('m'); // ?m=schedule&mId=<briefId>
  // Nested modal params — chồng lên brief modal mà không đè `?m`. F5 giữ
  // được account/habitat overlay. acct = account overlay, hab = habitat overlay.
  const acctNested = useModalParam('acct'); // ?acct=open&acctId=<accountId>
  const habNested = useModalParam('hab');   // ?hab=open&habId=<habitatId>
  const [busy, startBusy] = useTransition();
  const [statusFilter, setStatusFilter] = useState<'active' | 'all'>('active');
  // Filter theo loại blocking issue — click chip ở banner → lọc queue chỉ hiển
  // thị các dòng có issue đó. null = không filter.
  const [issueFilter, setIssueFilter] = useState<'no-url' | 'acct-dead' | 'acct-not-ready' | 'platform-mismatch' | 'no-posts' | 'incomplete-posts' | 'ready' | null>(null);
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  // In-place "account chết" confirm panel (KHÔNG navigate, KHÔNG native confirm)
  const [retiring, setRetiring] = useState<
    { accountId: number; handle: string; platformLabel: string; scheduleCount: number } | null>(null);
  const [retireReason, setRetireReason] = useState<string>('banned');
  const [retireText, setRetireText] = useState('');
  const [confirmCleanup, setConfirmCleanup] = useState<number | null>(null); // accountId 2-step
  const [expandedDead, setExpandedDead] = useState<Set<number>>(() => new Set()); // collapse default
  const [expandedNeed, setExpandedNeed] = useState<Set<string>>(() => new Set()); // platformKey set
  const [expandedNeedJoin, setExpandedNeedJoin] = useState<Set<string>>(() => new Set());
  const [fmtMenuFor, setFmtMenuFor] = useState<number | null>(null); // scheduleId mở menu chọn format
  const [actionMenuFor, setActionMenuFor] = useState<number | null>(null); // scheduleId mở overflow menu
  // Account + Habitat overlay CHỒNG lên brief modal. Trước đây dùng local
  // state để không đè `?m` (brief modal slot), nhưng F5 mất overlay. Giờ
  // dùng useModalParam('acct') / useModalParam('hab') — URL param riêng
  // chạy parallel với `?m`, F5 giữ nguyên cả 3 modal nếu mở.
  const accountOverlayId = acctNested.numId;
  const habitatOverlayId = habNested.numId;
  const setAccountOverlayId = (id: number | null) => {
    if (id == null) acctNested.close();
    else acctNested.open('open', id);
  };
  const setHabitatOverlayId = (id: number | null) => {
    if (id == null) habNested.close();
    else habNested.open('open', id);
  };
  // Counter để buộc BriefModalLoader re-fetch khi overlay con (account/habitat
  // /post mutation) thay đổi data nền. Bump → loader invalidate cache + reload.
  const [briefReloadKey, setBriefReloadKey] = useState(0);
  const briefReloadTimer = useRef<number | null>(null);
  const reloadBrief = (delayMs = 350) => {
    if (briefReloadTimer.current != null) window.clearTimeout(briefReloadTimer.current);
    briefReloadTimer.current = window.setTimeout(() => {
      if (briefModalIdRef.current != null) invalidateBriefModal(projectId, briefModalIdRef.current);
      setBriefReloadKey((n) => n + 1);
    }, delayMs);
  };
  // Track briefModalId qua ref để overlay onClose có thể đọc id hiện tại mà
  // không cần kéo dep chain (briefModalId compute từ URL, ổn định trong scope).
  const briefModalIdRef = useRef<number | null>(null);
  useEffect(() => () => {
    if (briefReloadTimer.current != null) window.clearTimeout(briefReloadTimer.current);
  }, []);
  // Chốt nhịp KHÔNG còn ở queue (gây chốt mù) — giờ đi qua pipeline modal,
  // bấm "Đánh dấu đã đăng" cạnh đúng bài (markCardSeeded), undo nằm ở đó.
  // Deep-link brief: mở thẳng tab phase + bung 1 bài (từ pipeline). Focus
  // (phase+cardId) ĐƯỢC GHI VÀO URL (?bfp=&bfc=) để F5 mở lại ĐÚNG bài.
  type BriefFocus = { briefId: number; phase: string; cardId?: number };
  const readFocusFromUrl = (): BriefFocus | null => {
    if (typeof window === 'undefined') return null;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('m') !== 'brief') return null;
    const bid = Number(sp.get('mId'));
    const ph = sp.get('bfp');
    if (!bid || !ph) return null;
    const fc = sp.get('bfc');
    return { briefId: bid, phase: ph, cardId: fc ? Number(fc) : undefined };
  };
  const [briefFocus, setBriefFocus] = useState<BriefFocus | null>(() => readFocusFromUrl());
  // Ghi/xoá bfp,bfc trên URL (shallow, giữ nguyên param khác — cùng cơ chế useModalParam).
  const writeFocusUrl = (phase: string | null, cardId?: number) => {
    if (typeof window === 'undefined') return;
    const next = new URLSearchParams(window.location.search);
    if (phase) {
      next.set('bfp', phase);
      if (cardId != null) next.set('bfc', String(cardId)); else next.delete('bfc');
    } else { next.delete('bfp'); next.delete('bfc'); }
    const qs = next.toString();
    window.history.replaceState({}, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  };
  const focusPost = (briefId: number, phase: string, cardId?: number) => {
    setBriefFocus({ briefId, phase, cardId });
    writeFocusUrl(phase, cardId);
    modal.open('brief', briefId);
  };
  const clearFocus = () => { setBriefFocus(null); writeFocusUrl(null); };
  const openBrief = (briefId: number) => { clearFocus(); modal.open('brief', briefId); };
  // Gán account đúng cho brief sai nền tảng (reuse AccountFormModal: pick
  // MOS2 / import Directus chưa dùng / tạo mới) → reassignBriefAccount.
  const [reassign, setReassign] = useState<
    { briefId: number; habitatId: number; presetPlatformKey?: string; label: string;
      habitatName: string; habitatKind: string; habitatUrl: string | null } | null>(null);
  const doAutoFix = (it: SeedingQueueItem) => {
    startBusy(async () => {
      const res = await autoFixBriefAccount(projectId, it.briefId);
      setMsg(res.ok
        ? `✓ Tự fix @${it.accountHandle} · ${it.habitatName}: ${res.message}`
        : `Auto-fix lỗi: ${res.error ?? '?'} — thử "chọn tay".`);
      router.refresh();
    });
  };
  const onPickedAccount = (newAccountId: number) => {
    if (!reassign) return;
    const r = reassign;
    setReassign(null);
    startBusy(async () => {
      const res = await reassignBriefAccount(projectId, r.briefId, newAccountId);
      setMsg(res.ok
        ? `Đã gán account mới cho ${r.label} — kiểm tra dòng đã hết cảnh báo sai nền tảng.`
        : (res.error ?? 'Lỗi gán account'));
      router.refresh();
    });
  };

  const editingBriefId = modal.is('schedule') ? modal.numId : null;
  const briefModalId = modal.is('brief') ? modal.numId : null;
  useEffect(() => { briefModalIdRef.current = briefModalId; }, [briefModalId]);
  const tribeModalId = modal.is('tribe') ? modal.numId : null;
  const pipelineId = modal.is('pipeline') ? modal.numId : null;
  // Legacy: `?m=acct` cũ (deep-link sharing) — fall back qua accountOverlayId
  // để cùng 1 modal handle. Mới mọi callsite dùng setAccountOverlayId → nested
  // param `?acct=open&acctId=`. Giữ legacy để URL cũ vẫn hoạt động.
  const acctModalId = accountOverlayId ?? (modal.is('acct') ? modal.numId : null);
  const tribeRow = tribeModalId != null ? tribes.find((t) => t.id === tribeModalId) ?? null : null;

  // Search-only (status filter applied later, only to live rows).
  const searchOnly = useMemo(() => {
    if (!q.trim()) return queue;
    const s = q.toLowerCase();
    return queue.filter((x) =>
      x.habitatName.toLowerCase().includes(s) ||
      x.accountHandle.toLowerCase().includes(s) ||
      (x.tribeName ?? '').toLowerCase().includes(s));
  }, [queue, q]);

  // "Cần tạo account" → briefs có account.status ∈ {todo, creating}. Gom theo
  // platform thay vì account (vì user cần biết platform nào cần đăng ký, không
  // phải account nào). Luôn hiện regardless of statusFilter — đây là DEMAND
  // signal (community cần seeding nhưng chưa có account ready). Bug 2026-05-22:
  // sau khi cascade joinStatus, briefs ẩn khỏi default view → user không biết
  // platform nào còn cần tạo account.
  const needAccountGroups = useMemo(() => {
    const NEED = new Set(['todo', 'creating']);
    const by = new Map<string, { platformLabel: string; rows: SeedingQueueItem[] }>();
    for (const x of searchOnly) {
      if (!NEED.has(x.accountStatus)) continue;
      const key = x.platformKey || x.platformLabel || 'unknown';
      const existing = by.get(key);
      if (existing) existing.rows.push(x);
      else by.set(key, { platformLabel: x.platformLabel || key, rows: [x] });
    }
    return [...by.entries()].map(([platformKey, group]) => {
      const accounts = new Set(group.rows.map((r) => r.accountId)).size;
      const habitats = new Set(group.rows.map((r) => r.habitatId)).size;
      const totalEstimatedPosts = group.rows.reduce((s, x) => s + Math.max(0, x.backlogCount), 0);
      return {
        platformKey,
        platformLabel: group.platformLabel,
        rows: group.rows,
        accounts,           // số account cần tạo (distinct)
        habitats,           // số community đang chờ
        totalEstimatedPosts,
      };
    }).sort((a, b) => b.habitats - a.habitats);
  }, [searchOnly]);

  // "Cần join community" — account đã active nhưng join_status != 'joined'.
  // Bug 2026-05-22: user đổi account todo → active, cascade rule trước đó đã
  // reset join_status='not_joined'. Brief status thành 'not-joined' → ẩn khỏi
  // default filter (overdue/due/upcoming). User mất tracking → tưởng brief
  // biến mất. Giờ hiện section riêng, group theo platform để user biết "đã
  // tạo account xong, giờ phải join N community nào".
  const needJoinGroups = useMemo(() => {
    const by = new Map<string, { platformLabel: string; rows: SeedingQueueItem[] }>();
    for (const x of searchOnly) {
      // Chỉ pick: account active (loại trừ todo/creating/dead) + chưa joined.
      // Account todo/creating đã ở NeedAccountSection, không trùng.
      if (x.accountStatus !== 'active') continue;
      if (x.status !== 'not-joined') continue;
      const key = x.platformKey || x.platformLabel || 'unknown';
      const existing = by.get(key);
      if (existing) existing.rows.push(x);
      else by.set(key, { platformLabel: x.platformLabel || key, rows: [x] });
    }
    return [...by.entries()].map(([platformKey, group]) => {
      const accounts = new Set(group.rows.map((r) => r.accountId)).size;
      const habitats = new Set(group.rows.map((r) => r.habitatId)).size;
      const totalBacklog = group.rows.reduce((s, x) => s + Math.max(0, x.backlogCount), 0);
      return {
        platformKey, platformLabel: group.platformLabel, rows: group.rows,
        accounts, habitats, totalBacklog,
      };
    }).sort((a, b) => b.habitats - a.habitats);
  }, [searchOnly]);

  // Account chết → gom theo account, hiển thị riêng (luôn hiện, kể cả filter
  // "Đang chạy") để không bao giờ biến mất âm thầm + có chỗ revive/dọn.
  const deadGroups = useMemo(() => {
    const by = new Map<number, SeedingQueueItem[]>();
    for (const x of searchOnly) {
      if (!isDeadStatus(x.accountStatus)) continue;
      (by.get(x.accountId) ?? by.set(x.accountId, []).get(x.accountId)!).push(x);
    }
    return [...by.entries()].map(([accountId, rows]) => {
      const r0 = rows[0]!;
      const unpostedApprox = rows.reduce((s, x) => s + x.backlogCount, 0);
      const seededApprox = rows.reduce((s, x) => s + x.touches30d, 0);
      return {
        accountId,
        handle: r0.accountHandle,
        platformKey: r0.platformKey,
        platformLabel: r0.platformLabel,
        accountStatus: r0.accountStatus,
        blockReason: r0.accountBlockReason,
        rows,
        unpostedApprox,
        seededApprox,
      };
    }).sort((a, b) => a.handle.localeCompare(b.handle));
  }, [searchOnly]);

  const liveList = useMemo(() => {
    // Khi user chọn filter 'acct-dead' → KHÔNG exclude dead (cần xem để fix).
    let list = issueFilter === 'acct-dead'
      ? searchOnly
      : searchOnly.filter((x) => !isDeadStatus(x.accountStatus));
    // Exclude need-account briefs khỏi main list — đã hiện ở section "Cần tạo
    // account" riêng phía trên (luôn visible). Trừ khi user filter rõ ràng.
    if (issueFilter !== 'acct-not-ready') {
      list = list.filter((x) => x.accountStatus !== 'todo' && x.accountStatus !== 'creating');
    }
    // Exclude need-join briefs (account active nhưng not_joined) — đã hiện ở
    // NeedJoinSection riêng. Trừ khi filter chuyên biệt.
    list = list.filter((x) => !(x.accountStatus === 'active' && x.status === 'not-joined'));
    if (statusFilter === 'active' && !issueFilter) {
      list = list.filter((x) => x.status === 'overdue' || x.status === 'due' || x.status === 'upcoming');
    }
    if (issueFilter === 'ready') {
      list = list.filter((x) => blockingIssues(x).length === 0);
    } else if (issueFilter) {
      list = list.filter((x) => blockingIssues(x).some((i) => i.kind === issueFilter));
    }
    return list;
  }, [searchOnly, statusFilter, issueFilter]);

  const buckets = useMemo(() => {
    const b: Record<string, SeedingQueueItem[]> = { overdue: [], due: [], week: [], later: [], rest: [] };
    for (const x of liveList) {
      if (x.status === 'overdue') b.overdue!.push(x);
      else if (x.status === 'due') b.due!.push(x);
      else if (x.status === 'upcoming' && x.daysUntilDue <= 7) b.week!.push(x);
      else if (x.status === 'upcoming') b.later!.push(x);
      else b.rest!.push(x);
    }
    return b;
  }, [liveList]);

  const stats = useMemo(() => {
    const live = queue.filter((x) => !isDeadStatus(x.accountStatus));
    const active = live.filter((x) => x.status !== 'paused');
    const needAction = live.filter((x) => x.status === 'overdue' || x.status === 'due').length;
    const touches30d = queue.reduce((s, x) => s + x.touches30d, 0);
    const adh = active.length ? Math.round(active.reduce((s, x) => s + x.adherencePct, 0) / active.length) : 0;
    const deadAccts = new Set(queue.filter((x) => isDeadStatus(x.accountStatus)).map((x) => x.accountId)).size;
    const notReadyAccts = new Set(queue.filter((x) => notReady(x.accountStatus)).map((x) => x.accountId)).size;
    const mismatch = new Set(queue.filter((x) => platformIssue(x)).map((x) => x.briefId)).size;
    // Habitat thiếu URL — block markPosted + không mở community được.
    const noUrlHabitats = new Set(queue.filter((x) => !x.habitatUrl).map((x) => x.habitatId)).size;
    return { total: queue.length, needAction, touches30d, adh, deadAccts, notReadyAccts, mismatch, noUrlHabitats };
  }, [queue]);

  // Blocking issues toàn queue — chia theo loại + đếm ready (không issue).
  const issuesGrouped = useMemo(() => {
    const noUrl: SeedingQueueItem[] = [];
    const acctDead: SeedingQueueItem[] = [];
    const acctNotReady: SeedingQueueItem[] = [];
    const platMismatch: SeedingQueueItem[] = [];
    const noPosts: SeedingQueueItem[] = [];
    const incompletePosts: SeedingQueueItem[] = [];
    let readyCount = 0;
    for (const it of queue) {
      const list = blockingIssues(it);
      if (list.length === 0) { readyCount++; continue; }
      for (const i of list) {
        if (i.kind === 'no-url') noUrl.push(it);
        else if (i.kind === 'acct-dead') acctDead.push(it);
        else if (i.kind === 'acct-not-ready') acctNotReady.push(it);
        else if (i.kind === 'platform-mismatch') platMismatch.push(it);
        else if (i.kind === 'no-posts') noPosts.push(it);
        else if (i.kind === 'incomplete-posts') incompletePosts.push(it);
      }
    }
    const totalIssues = noUrl.length + acctDead.length + acctNotReady.length
                      + platMismatch.length + noPosts.length + incompletePosts.length;
    return { noUrl, acctDead, acctNotReady, platMismatch, noPosts, incompletePosts, totalIssues, ready: readyCount };
  }, [queue]);

  const doGenerate = () => {
    startBusy(async () => {
      const res = await generateDueDrafts(projectId);
      if (!res.ok) { setMsg(res.error ?? 'Lỗi'); return; }
      if (res.created > 0) {
        setMsg(`Đã sinh ${res.created} bài nháp vào backlog (cột Ý tưởng trên Board). Bấm 📝 ở dòng để xem.`);
      } else if (res.dueTotal === 0) {
        setMsg('Không có lịch nào đến hạn — chưa cần sinh nháp. Dùng 📝+ ở từng dòng nếu muốn tạo trước.');
      } else {
        const parts: string[] = [];
        if (res.skippedAutoOff) parts.push(`${res.skippedAutoOff} tắt auto-draft (chỉ là PLAN)`);
        if (res.skippedHasBacklog) parts.push(`${res.skippedHasBacklog} đã có nháp chờ`);
        setMsg(`0 sinh: ${res.dueTotal} lịch đến hạn nhưng ${parts.join(', ') || 'không đủ điều kiện'}. Dùng 📝+ ở dòng để tạo thủ công.`);
      }
      router.refresh();
    });
  };
  const doGenerateOne = (it: SeedingQueueItem, contentType?: string) => {
    setFmtMenuFor(null);
    startBusy(async () => {
      const res = await generateOneDraft(projectId, it.briefId, it.currentPhase, contentType,
        { platformKey: it.platformKey, platformCategory: it.platformCategory,
          laneType: it.laneType, laneLang: it.laneLang });
      if (res.ok) {
        const fm = formatMeta(res.contentType ?? 'text');
        setMsg(`Đã tạo nháp ${fm.icon} ${fm.label} ${res.cardRef ?? ''} cho @${it.accountHandle} · ${it.habitatName}. Mở xem ↓`);
        openBrief(it.briefId);
      } else {
        setMsg(res.error ?? 'Lỗi tạo nháp');
      }
      router.refresh();
    });
  };

  const doRetire = () => {
    if (!retiring) return;
    const acctId = retiring.accountId;
    const handle = retiring.handle;
    const status: 'banned' | 'blocked' = retireReason === 'banned' ? 'banned' : 'blocked';
    const reasonLabel = RETIRE_REASONS.find((r) => r.key === retireReason)?.label ?? retireReason;
    const reason = retireText.trim() ? `${reasonLabel}: ${retireText.trim()}` : reasonLabel;
    startBusy(async () => {
      const res = await retireAccount(projectId, acctId, status, reason);
      setRetiring(null); setRetireText(''); setRetireReason('banned');
      if (res.ok) {
        setMsg(`@${handle} → ${status.toUpperCase()}. Đã tạm dừng ${res.schedulesPaused} lịch · giữ ${res.seededTouches} lần seed (lịch sử) · ${res.unpostedDrafts} nháp chưa đăng còn ở backlog (dọn ở thẻ account bên dưới).`);
      } else {
        setMsg(res.error ?? 'Lỗi đánh dấu account');
      }
      router.refresh();
    });
  };
  const doRevive = (accountId: number, handle: string) => {
    startBusy(async () => {
      const res = await reviveAccount(projectId, accountId);
      setMsg(res.ok
        ? `Khôi phục @${handle} → ACTIVE. Bỏ tạm dừng ${res.schedulesResumed} lịch — flow seeding chạy lại.`
        : (res.error ?? 'Lỗi khôi phục'));
      router.refresh();
    });
  };
  const doCleanup = (accountId: number, handle: string) => {
    startBusy(async () => {
      const res = await cleanupUnpostedDrafts(projectId, accountId);
      setConfirmCleanup(null);
      setMsg(`Đã xoá ${res.deleted} nháp chưa đăng của @${handle}. Bài đã đăng + lịch sử seed giữ nguyên.`);
      router.refresh();
    });
  };

  const Row = (it: SeedingQueueItem) => {
    const sm = STATUS_META[it.status];
    return (
      <div key={it.scheduleId}
           onMouseEnter={() => prefetchBriefModal(projectId, it.briefId)}
           style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center',
                    padding: '8px 10px', background: 'var(--bg-2)', border: '1px solid var(--line)',
                    borderLeft: `3px solid ${sm.color}`, borderRadius: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
          {/* Favicon (avatar) = entry point cho brief — click mở Brief modal.
              Account chip click mở Account modal, Habitat chip click mở Habitat
              modal. Mỗi đối tượng click vào đúng nó. */}
          <button type="button"
                  onClick={() => openBrief(it.briefId)}
                  title={`Mở brief: ${it.accountHandle} × ${it.habitatName} (chiến lược + bài)`}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                           display: 'inline-flex', borderRadius: 7 }}>
            <SiteFavicon url={it.habitatUrl} kind={it.habitatKind} size={30}
                         title="" style={{ borderRadius: 7 }} />
          </button>
          <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)' }}>
              <EntityLink color="var(--fg-0)" onClick={() => setAccountOverlayId(it.accountId)}
                title={`Mở Account modal: @${it.accountHandle} (status/credential/persona)`}>@{it.accountHandle}</EntityLink>
            </span>
            {notReady(it.accountStatus) && (() => {
              const m = ACCT_STATUS_META[it.accountStatus]
                ?? { label: it.accountStatus.toUpperCase(), color: 'var(--warn)', dot: '⚠', hint: 'Account chưa active' };
              return (
                <span title={m.hint}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '0 6px',
                               fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, borderRadius: 3,
                               textTransform: 'uppercase', background: m.color + '22', color: m.color,
                               border: `1px solid ${m.color}66` }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.color, flexShrink: 0 }} />
                  {m.label}
                </span>
              );
            })()}
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)',
                           display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              {it.platformKey && (
                <img src={`https://cdn.simpleicons.org/${it.platformKey}/d4d4d8`}
                     alt="" width={11} height={11} style={{ opacity: 0.85 }} />
              )}
              {it.platformLabel}
            </span>
            <span style={{ color: 'var(--fg-4)' }}>·</span>
            <span style={{ fontSize: 11.5, color: 'var(--fg-1)' }}>
              <EntityLink color="var(--fg-1)" onClick={() => setHabitatOverlayId(it.habitatId)}
                title={`Mở Habitat modal: ${it.habitatName} (rules/members/topics)`}>{it.habitatName}</EntityLink>
            </span>
            <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)' }}>{it.habitatKind}</span>
            {!it.habitatUrl && (
              <button type="button"
                      onClick={(e) => { e.stopPropagation(); setHabitatOverlayId(it.habitatId); }}
                      title={`Habitat "${it.habitatName}" chưa có URL → không mở community, không đăng, không markPosted được. Click để mở sửa habitat điền URL.`}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '0 6px',
                               fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, borderRadius: 3,
                               textTransform: 'uppercase', background: 'rgba(251,191,36,.15)',
                               color: 'var(--warn)', border: '1px solid rgba(251,191,36,.5)',
                               cursor: 'pointer' }}>
                <IconWarn size={10} /> Thiếu URL · sửa
              </button>
            )}
            {(() => {
              const issue = platformIssue(it);
              return issue ? (
                <span title={issue}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '0 6px',
                               fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, borderRadius: 3,
                               textTransform: 'uppercase', background: 'rgba(251,191,36,.15)',
                               color: 'var(--warn)', border: '1px solid rgba(251,191,36,.5)' }}>
                  <IconWarn size={10} /> sai nền tảng
                </span>
              ) : null;
            })()}
            {it.tribeName && (
              <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)' }}>◍ {it.tribeId != null
                ? <EntityLink color="var(--fg-4)" onClick={() => modal.open('tribe', it.tribeId!)}
                    title="Mở tribe (identity/lexicon/psychographic) tại chỗ">{it.tribeName}</EntityLink>
                : it.tribeName}</span>
            )}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '0 5px', fontSize: 9,
                           fontFamily: 'var(--font-mono)', fontWeight: 700, borderRadius: 3, textTransform: 'uppercase',
                           background: PHASE_COLOR[it.currentPhase] + '22', color: PHASE_COLOR[it.currentPhase],
                           border: `1px solid ${PHASE_COLOR[it.currentPhase]}66` }}>
              {PHASE_LABEL[it.currentPhase]}
            </span>
          </div>
          <div style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span title="Trạng thái" style={{ color: sm.color, fontWeight: 700 }}>{sm.label} · {dueLabel(it.daysUntilDue)}</span>
            <span title="Tần suất">mỗi {it.frequencyDays}d</span>
            <span title="Lần seed gần nhất">{it.lastSeededAt ? `seed ${new Date(it.lastSeededAt).toLocaleDateString()}` : 'chưa seed'}</span>
            <span title="Bám cadence 30 ngày" style={{ color: healthColor(it.adherencePct) }}>
              ▮ {it.adherencePct}% ({it.touches30d}/30d)
            </span>
            {(() => {
              const isMix = !it.laneType || it.laneType === 'mix';
              const effLang = it.laneLang || it.habitatLang;
              const inheritFromHabitat = !it.laneLang;
              const langTitle = it.laneLang
                ? `Lane đăng bằng ${it.laneLang.toUpperCase()} (override)`
                : `Kế thừa ngôn ngữ habitat: ${it.habitatLang.toUpperCase()} (*)`;
              const langChip = (
                <LangChip mode="static" code={effLang} size="sm" title={langTitle}
                          variant={inheritFromHabitat ? 'neutral' : 'accent'} />
              );
              if (!isMix) {
                const fm = formatMeta(it.laneType);
                const col = formatColors(it.laneType);
                return (
                  <span title={`Lane cố định: ${fm.label}. ${fm.hint}`}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                                 color: col.fg, fontWeight: 600 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4,
                                   padding: '1px 7px', borderRadius: 3,
                                   background: col.bg, border: `1px solid ${col.border}` }}>
                      <FormatIcon kind={it.laneType} size={13} /> {fm.label}
                    </span>{langChip}
                  </span>
                );
              }
              const mix = effectiveMix(it.platformKey, it.platformCategory, it.phaseFormatMix);
              const ranked = Object.entries(mix).sort((a, b) => b[1] - a[1]);
              const src = it.phaseFormatMix && Object.keys(it.phaseFormatMix).length > 0 ? 'override phase' : 'mặc định platform';
              const full = ranked.map(([k, w]) => `${formatMeta(k).label} ${w}`).join(' · ');
              return (
                <span title={`Lane MIX — xoay loại nội dung (${src}): ${full}. Bấm "loại" để ép 1 loại.`}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--fg-3)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--fg-4)' }}>
                    <FormatIcon kind="mix" size={12} /> mix:
                  </span>
                  {ranked.slice(0, 4).map(([k, w]) => (
                    <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                      <FormatIcon kind={k} size={12} />
                      <span style={{ color: 'var(--fg-4)' }}>{w}</span>
                    </span>
                  ))}
                  {ranked.length > 4 && <span style={{ color: 'var(--fg-4)' }}>+{ranked.length - 4}</span>}
                  {langChip}
                </span>
              );
            })()}
            <EntityLink
              color={it.backlogCount > 0 ? 'var(--accent)' : 'var(--fg-4)'}
              onClick={() => modal.open('pipeline', it.briefId)}
              title={it.backlogCount > 0
                ? `${it.completeCount}/${it.backlogCount} nháp đã ĐỦ DATA (nội dung + ảnh nếu visual). Mở pipeline xem chi tiết.`
                : 'Mở pipeline bài: cần chuẩn bị / sẽ đăng / đã đăng'}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <IconList size={11} />
                {it.backlogCount > 0
                  ? <>{it.backlogCount} nháp{' '}
                      <span style={{ color: it.completeCount === it.backlogCount ? 'var(--ok)' : 'var(--warn)', fontWeight: 700 }}>
                        ({it.completeCount}/{it.backlogCount} đủ)
                      </span></>
                  : 'xem bài'}
              </span>
            </EntityLink>
            {it.autoDraft && <span title="Bán tự động: tự sinh nháp khi đến hạn" style={{ color: 'var(--fg-4)' }}>auto</span>}
          </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          {/* CTA chính — mọi việc của brief (xem bài, chốt nhịp, sửa nội dung)
              vào đây. Các action khác gom vào menu ⋯ overflow. */}
          <button className="btn primary" disabled={busy} onClick={() => modal.open('pipeline', it.briefId)}
                  title="Mở danh sách bài của cặp account×habitat này. Xem bài kỳ này đăng GÌ / Ở ĐÂU, rồi bấm 'Đánh dấu đã đăng' ngay cạnh bài đó để chốt nhịp."
                  style={{ fontSize: 11, padding: '4px 9px', fontWeight: 700,
                           display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <IconList size={13} /> Bài &amp; chốt nhịp <IconChevron dir="right" size={11} />
          </button>
          {/* Auto-fix conditional — chỉ khi sai nền tảng (issue rõ ràng cần
              fix nhanh, không cần chôn vào menu overflow). */}
          {platformIssue(it) && (
            <button className="btn" disabled={busy} onClick={() => doAutoFix(it)}
                    title="Sai nền tảng — TỰ ĐỘNG fix: tự tạo/khớp platform → tìm account MOS2 sẵn → import từ Directus → tạo tạm. 1 click."
                    style={{ fontSize: 11, padding: '4px 8px', color: 'var(--warn)',
                             display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <IconSwap size={13} /> tự fix
            </button>
          )}
          {/* ⋯ overflow menu — gom action theo scope (brief vs account) */}
          <span style={{ position: 'relative', display: 'inline-flex' }}>
            <button className="btn" disabled={busy}
                    onClick={() => setActionMenuFor(actionMenuFor === it.scheduleId ? null : it.scheduleId)}
                    title="Hành động khác"
                    style={{ fontSize: 11, padding: '4px 8px',
                             display: 'inline-flex', alignItems: 'center' }}>
              <IconDots size={14} />
            </button>
            {actionMenuFor === it.scheduleId && (
              <>
                <div onClick={() => setActionMenuFor(null)}
                     style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 41,
                              minWidth: 220, background: 'var(--bg-1)', border: '1px solid var(--line-2)',
                              borderRadius: 6, boxShadow: '0 12px 32px rgba(0,0,0,.5)', padding: 4 }}>
                  {/* ── Theo brief / lane này ── */}
                  <div style={{ padding: '4px 8px 4px', fontSize: 9, fontFamily: 'var(--font-mono)',
                                color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                    Brief × habitat × lane này
                  </div>
                  <button className="btn ghost" disabled={busy}
                          onClick={() => { setActionMenuFor(null); doGenerateOne(it); }}
                          title="Tạo 1 nháp vào backlog — tự xoay loại theo mix nếu lane là 'mix'."
                          style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8,
                                   fontSize: 11.5, padding: '5px 8px', textAlign: 'left', color: 'var(--fg-1)' }}>
                    <IconFilePlus size={13} /> Tạo nháp ngay
                  </button>
                  {(!it.laneType || it.laneType === 'mix') && (
                    <button className="btn ghost" disabled={busy}
                            onClick={() => { setActionMenuFor(null); setFmtMenuFor(it.scheduleId); }}
                            title="Lane mix — chọn 1 loại cụ thể (text / ảnh / video / link…) để ép sinh."
                            style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8,
                                     fontSize: 11.5, padding: '5px 8px', textAlign: 'left', color: 'var(--fg-1)' }}>
                      <IconChevron dir="down" size={11} /> Tạo nháp theo loại
                    </button>
                  )}
                  <button className="btn ghost"
                          onClick={() => { setActionMenuFor(null); modal.open('schedule', it.briefId); }}
                          title="Lanes manager — thêm/sửa lịch (tần suất, loại, ngôn ngữ) cho cặp này."
                          style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8,
                                   fontSize: 11.5, padding: '5px 8px', textAlign: 'left', color: 'var(--fg-1)' }}>
                    <IconGear size={13} /> Schedule (lanes)
                  </button>
                  {/* ── Theo account (cross-brief) ── */}
                  <div style={{ marginTop: 4, borderTop: '1px solid var(--line)', padding: '6px 8px 4px',
                                fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)',
                                textTransform: 'uppercase', letterSpacing: '.06em' }}>
                    Account @{it.accountHandle} (mọi brief)
                  </div>
                  <button className="btn ghost" disabled={busy}
                          onClick={() => { setActionMenuFor(null); setAccountOverlayId(it.accountId); }}
                          title={`Sửa profile @${it.accountHandle} — login / handle / status / persona / proxy. Áp dụng cho mọi brief dùng account này.`}
                          style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8,
                                   fontSize: 11.5, padding: '5px 8px', textAlign: 'left',
                                   color: notReady(it.accountStatus) ? 'var(--warn)' : 'var(--fg-1)' }}>
                    <IconPencil size={13} /> Sửa account
                  </button>
                  {!isDeadStatus(it.accountStatus) && (
                    <button className="btn ghost" disabled={busy}
                            onClick={() => { setActionMenuFor(null); setRetiring({ accountId: it.accountId, handle: it.accountHandle, platformLabel: it.platformLabel, scheduleCount: queue.filter((x) => x.accountId === it.accountId).length }); setRetireReason('banned'); setRetireText(''); }}
                            title="Account đã banned / mất login / không dùng được nữa → tạm dừng MỌI lịch của nó (cross-brief)."
                            style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8,
                                     fontSize: 11.5, padding: '5px 8px', textAlign: 'left', color: 'var(--bad)' }}>
                      <IconBan size={13} /> Đánh dấu ngưng dùng
                    </button>
                  )}
                  {platformIssue(it) && (
                    <button className="btn ghost" disabled={busy}
                            onClick={() => { setActionMenuFor(null); setReassign({
                              briefId: it.briefId, habitatId: it.habitatId,
                              presetPlatformKey: it.habitatPlatformKey || expectedPlatformForKind(it.habitatKind) || undefined,
                              label: `@${it.accountHandle} · ${it.habitatName}`,
                              habitatName: it.habitatName, habitatKind: it.habitatKind, habitatUrl: it.habitatUrl,
                            }); }}
                            title="Chọn/tạo account thủ công cho brief này (sai nền tảng — tự fix không khớp ý)."
                            style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8,
                                     fontSize: 11.5, padding: '5px 8px', textAlign: 'left', color: 'var(--fg-1)' }}>
                      <IconSwap size={13} /> Gán account khác (tay)
                    </button>
                  )}
                </div>
              </>
            )}
            {/* Format-pick menu (giữ riêng để overflow menu trỏ vào) */}
            {fmtMenuFor === it.scheduleId && (!it.laneType || it.laneType === 'mix') && (
              <>
                <div onClick={() => setFmtMenuFor(null)}
                     style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 41,
                              minWidth: 180, background: 'var(--bg-1)', border: '1px solid var(--line-2)',
                              borderRadius: 6, boxShadow: '0 12px 32px rgba(0,0,0,.5)', padding: 4 }}>
                  <div style={{ padding: '4px 8px 4px', fontSize: 9, fontFamily: 'var(--font-mono)',
                                color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                    Chọn loại để tạo nháp
                  </div>
                  {allowedFormats(it.platformKey, it.platformCategory).map((f) => (
                    <button key={f.key} className="btn ghost" disabled={busy}
                            onClick={() => doGenerateOne(it, f.key)} title={f.hint}
                            style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 7,
                                     fontSize: 11.5, padding: '5px 8px', textAlign: 'left', color: 'var(--fg-1)' }}>
                      <FormatIcon kind={f.key} size={14} />{f.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </span>
        </div>
      </div>
    );
  };

  const Bucket = ({ title, items, accent }: { title: string; items: SeedingQueueItem[]; accent: string }) =>
    items.length === 0 ? null : (
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.06em',
                      color: accent, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: accent }} />{title}
          <span style={{ color: 'var(--fg-4)' }}>{items.length}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>{items.map(Row)}</div>
      </div>
    );

  // Thẻ account chết — COLLAPSE mặc định: chỉ 1 dòng tóm tắt + action;
  // bấm ▸ mới bung lý do + danh sách lịch.
  type DeadGroup = (typeof deadGroups)[number];
  type NeedGroup = (typeof needAccountGroups)[number];
  const toggleDead = (id: number) => setExpandedDead((prev) => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const toggleNeed = (platformKey: string) => setExpandedNeed((prev) => {
    const n = new Set(prev); n.has(platformKey) ? n.delete(platformKey) : n.add(platformKey); return n;
  });
  const toggleNeedJoin = (platformKey: string) => setExpandedNeedJoin((prev) => {
    const n = new Set(prev); n.has(platformKey) ? n.delete(platformKey) : n.add(platformKey); return n;
  });

  // NeedJoinSection — account active nhưng chưa join community. Bước
  // tiếp theo sau khi tạo account: đi vào platform, click join, accept invite.
  // Visual khác NeedAccountSection: vàng (warning, không phải info xanh).
  type NeedJoinGroup = (typeof needJoinGroups)[number];
  const NeedJoinSection = ({ groups, onOpenBrief }: {
    groups: NeedJoinGroup[];
    onOpenBrief: (briefId: number, focusPhase?: string) => void;
  }) => {
    const totalHabitats = groups.reduce((s, g) => s + g.habitats, 0);
    const totalAccounts = groups.reduce((s, g) => s + g.accounts, 0);
    return (
      <div style={{ marginBottom: 12, border: '1px solid rgba(251,191,36,.5)', borderRadius: 6,
                    background: 'rgba(251,191,36,.06)', overflow: 'hidden' }}>
        <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8,
                      borderBottom: '1px solid rgba(251,191,36,.25)' }}>
          <span style={{ fontSize: 14 }}>🔗</span>
          <strong style={{ fontSize: 13, color: 'var(--warn)' }}>Cần join community</strong>
          <span style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
            {totalAccounts} account · {totalHabitats} community · {groups.length} platform
          </span>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 10, color: 'var(--fg-4)', fontStyle: 'italic' }}>
            Account đã ready nhưng CHƯA accept invite / submit join request. Mở community, join, rồi đánh dấu ở Brief.
          </span>
        </div>
        {groups.map((g) => {
          const open = expandedNeedJoin.has(g.platformKey);
          const platform = platforms.find((p) => p.key === g.platformKey);
          return (
            <div key={g.platformKey} style={{ borderTop: '1px solid rgba(251,191,36,.15)' }}>
              <div style={{ padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => toggleNeedJoin(g.platformKey)}
                        title={open ? 'Thu gọn' : 'Mở danh sách community cần join'}
                        style={{ background: 'none', border: 'none', cursor: 'pointer',
                                 color: 'var(--warn)', padding: 0, display: 'inline-flex', alignItems: 'center' }}>
                  <IconChevron dir={open ? 'down' : 'right'} size={13} />
                </button>
                <SiteFavicon iconSlug={platform?.iconSlug ?? ''} kind={g.platformKey}
                             size={16} title={g.platformLabel} />
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-0)', cursor: 'pointer' }}
                      onClick={() => toggleNeedJoin(g.platformKey)}>
                  {g.platformLabel}
                </span>
                <span style={{ padding: '0 6px', fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                               textTransform: 'uppercase', borderRadius: 3, background: 'var(--warn)', color: '#0d1117' }}>
                  Join {g.habitats}
                </span>
                <span style={{ fontSize: 10.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
                  {g.accounts} account · ~{g.totalBacklog} bài backlog đã prep
                </span>
              </div>
              {open && (
                <div style={{ padding: '4px 12px 10px 36px', display: 'flex',
                              flexDirection: 'column', gap: 4 }}>
                  {g.rows.map((r) => (
                    <div key={r.scheduleId} style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px',
                      background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 4,
                      fontSize: 11,
                    }}>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
                        @{r.accountHandle}
                      </span>
                      <span style={{ color: 'var(--fg-4)' }}>×</span>
                      <span style={{ color: 'var(--fg-1)' }}>{r.habitatName}</span>
                      <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)' }}>
                        ({r.habitatKind}{r.tribeName ? ` · ${r.tribeName}` : ''})
                      </span>
                      <span style={{ flex: 1 }} />
                      <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)',
                                     color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>
                        {r.backlogCount > 0 ? `${r.backlogCount} bài chờ` : ''}
                      </span>
                      {r.habitatUrl && (
                        <a href={r.habitatUrl} target="_blank" rel="noopener noreferrer"
                           title="Mở community trong tab mới → click Join / accept invite"
                           style={{ fontSize: 10, padding: '2px 8px', color: 'var(--warn)',
                                    textDecoration: 'none', borderRadius: 3,
                                    border: '1px solid rgba(251,191,36,.4)',
                                    background: 'rgba(251,191,36,.12)', fontWeight: 700,
                                    whiteSpace: 'nowrap' }}>
                          ↗ Mở để join
                        </a>
                      )}
                      <button type="button" onClick={() => onOpenBrief(r.briefId)}
                              title="Mở Brief modal → đánh dấu join status sau khi đã join thật"
                              style={{ fontSize: 10, padding: '2px 8px',
                                       background: 'var(--warn)', color: '#0d1117',
                                       border: 'none', borderRadius: 3, cursor: 'pointer',
                                       fontWeight: 700 }}>
                        ✓ Đánh dấu
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // NeedAccountSection — hiển thị các briefs ở trạng thái account-NEVER-CREATED
  // (todo/creating) grouped by platform. UI xanh dương (info, task-to-do —
  // không phải error như dead account). Click platform header bung danh sách
  // habitats cần seeding + nút "Mở Account" để jump tới Account modal tạo.
  const NeedAccountSection = ({ groups, onOpenAccount, onOpenBrief }: {
    groups: NeedGroup[];
    onOpenAccount: (accountId: number) => void;
    onOpenBrief: (briefId: number) => void;
  }) => {
    const totalHabitats = groups.reduce((s, g) => s + g.habitats, 0);
    const totalAccounts = groups.reduce((s, g) => s + g.accounts, 0);
    return (
      <div style={{ marginBottom: 12, border: '1px solid #2563eb', borderRadius: 6,
                    background: 'rgba(59,130,246,.06)', overflow: 'hidden' }}>
        {/* Header summary cho cả section */}
        <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8,
                      borderBottom: '1px solid rgba(59,130,246,.25)' }}>
          <span style={{ fontSize: 14 }}>➕</span>
          <strong style={{ fontSize: 13, color: '#60a5fa' }}>Cần tạo account để seeding</strong>
          <span style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
            {totalAccounts} account · {totalHabitats} community đang chờ · {groups.length} platform
          </span>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 10, color: 'var(--fg-4)', fontStyle: 'italic' }}>
            Briefs đã có chiến lược + lịch nhưng chưa có account thật → tạo account để start seeding.
          </span>
        </div>
        {/* Per-platform rows */}
        {groups.map((g) => {
          const open = expandedNeed.has(g.platformKey);
          const platform = platforms.find((p) => p.key === g.platformKey);
          return (
            <div key={g.platformKey} style={{
              borderTop: '1px solid rgba(59,130,246,.15)',
            }}>
              <div style={{ padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => toggleNeed(g.platformKey)}
                        title={open ? 'Thu gọn' : 'Mở danh sách community đang chờ'}
                        style={{ background: 'none', border: 'none', cursor: 'pointer',
                                 color: '#60a5fa', padding: 0, display: 'inline-flex', alignItems: 'center' }}>
                  <IconChevron dir={open ? 'down' : 'right'} size={13} />
                </button>
                <SiteFavicon iconSlug={platform?.iconSlug ?? ''} kind={g.platformKey}
                             size={16} title={g.platformLabel} />
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-0)', cursor: 'pointer' }}
                      onClick={() => toggleNeed(g.platformKey)}>
                  {g.platformLabel}
                </span>
                <span style={{ padding: '0 6px', fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                               textTransform: 'uppercase', borderRadius: 3, background: '#3b82f6', color: '#fff' }}>
                  Cần {g.accounts} acc
                </span>
                <span style={{ fontSize: 10.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
                  {g.habitats} community · ~{g.totalEstimatedPosts} bài backlog đang chờ
                </span>
                <span style={{ flex: 1 }} />
                {/* Signup link nhanh nếu platform có */}
                {platform?.signupUrl && (
                  <a href={platform.signupUrl} target="_blank" rel="noopener noreferrer"
                     title={`Mở trang đăng ký official: ${platform.signupUrl}`}
                     style={{ fontSize: 10.5, padding: '3px 9px',
                              background: 'rgba(59,130,246,.18)', color: '#60a5fa',
                              border: '1px solid rgba(59,130,246,.4)', borderRadius: 4,
                              textDecoration: 'none', whiteSpace: 'nowrap', fontWeight: 700 }}>
                    ↗ Signup
                  </a>
                )}
                {/* Group account-id distinct → jump nhanh tới account đầu tiên */}
                {(() => {
                  const firstAcct = g.rows[0]!.accountId;
                  return (
                    <button type="button" onClick={() => onOpenAccount(firstAcct)}
                            title="Mở Account modal để hoàn tất setup (điền credential, đổi status → active)"
                            style={{ fontSize: 10.5, padding: '3px 9px', fontWeight: 700,
                                     background: '#3b82f6', color: '#fff',
                                     border: 'none', borderRadius: 4, cursor: 'pointer',
                                     whiteSpace: 'nowrap' }}>
                      ➕ Mở Account
                    </button>
                  );
                })()}
              </div>
              {open && (
                <div style={{ padding: '4px 12px 10px 36px', display: 'flex',
                              flexDirection: 'column', gap: 4 }}>
                  {g.rows.map((r) => (
                    <div key={r.scheduleId} style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px',
                      background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 4,
                      fontSize: 11,
                    }}>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
                        @{r.accountHandle}
                      </span>
                      <span style={{ color: 'var(--fg-4)' }}>×</span>
                      <span style={{ color: 'var(--fg-1)' }}>{r.habitatName}</span>
                      <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)' }}>
                        ({r.habitatKind}{r.tribeName ? ` · ${r.tribeName}` : ''})
                      </span>
                      <span style={{ flex: 1 }} />
                      <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)',
                                     color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>
                        {r.backlogCount > 0 ? `${r.backlogCount} bài chờ` : 'chưa có bài'}
                        {r.currentPhase && ` · phase ${r.currentPhase}`}
                      </span>
                      <SwapAccountButton
                        projectId={projectId}
                        briefId={r.briefId}
                        currentAccountId={r.accountId}
                        onSwapped={() => router.refresh()}
                      />
                      <button type="button" onClick={() => onOpenBrief(r.briefId)}
                              title="Mở Brief modal — xem chiến lược + bài đã prep"
                              style={{ fontSize: 10, padding: '2px 7px', background: 'transparent',
                                       color: 'var(--fg-2)', border: '1px solid var(--line)',
                                       borderRadius: 3, cursor: 'pointer' }}>
                        Brief ↗
                      </button>
                      {r.habitatUrl && (
                        <a href={r.habitatUrl} target="_blank" rel="noopener noreferrer"
                           title="Mở community trong tab mới"
                           style={{ fontSize: 10, padding: '2px 7px', color: 'var(--accent)',
                                    textDecoration: 'none', borderRadius: 3,
                                    border: '1px solid var(--accent-line)',
                                    background: 'var(--accent-soft)' }}>
                          ↗
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };
  const DeadAccountCard = ({ g }: { g: DeadGroup }) => {
    const open = expandedDead.has(g.accountId);
    return (
      <div style={{ marginBottom: 6, border: '1px solid var(--bad)', borderRadius: 6,
                    background: 'rgba(248,113,113,.05)', overflow: 'hidden' }}>
        <div style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => toggleDead(g.accountId)} title={open ? 'Thu gọn' : 'Mở chi tiết + danh sách lịch'}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bad)',
                           padding: 0, display: 'inline-flex', alignItems: 'center' }}>
            <IconChevron dir={open ? 'down' : 'right'} size={13} />
          </button>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-0)', cursor: 'pointer',
                         display: 'inline-flex', alignItems: 'center', gap: 4 }}
                onClick={() => toggleDead(g.accountId)}>
            <IconBan size={13} color="var(--bad)" /> @{g.handle}
          </span>
          <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)',
                         display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            {g.platformKey && (
              <img src={`https://cdn.simpleicons.org/${g.platformKey}/9ca3af`}
                   alt="" width={11} height={11} style={{ opacity: 0.85 }} />
            )}
            {g.platformLabel}
          </span>
          <span style={{ padding: '0 6px', fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                         textTransform: 'uppercase', borderRadius: 3, background: 'var(--bad)', color: '#fff' }}>
            {g.accountStatus}
          </span>
          <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)' }}>
            {g.rows.length} lịch · {g.unpostedApprox} nháp{g.blockReason ? ` · ${g.blockReason}` : ''}
          </span>
          <span style={{ flex: 1 }} />
          <button className="btn ghost" disabled={busy} onClick={() => doRevive(g.accountId, g.handle)}
                  title="Account dùng lại được → status ACTIVE + bỏ tạm dừng mọi lịch (flow chạy lại)"
                  style={{ fontSize: 10.5, padding: '3px 7px', color: 'var(--ok)',
                           display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <IconUndo size={12} /> Khôi phục
          </button>
          {confirmCleanup === g.accountId ? (
            <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>
              <button className="btn ghost" disabled={busy} onClick={() => doCleanup(g.accountId, g.handle)}
                      style={{ fontSize: 10.5, padding: '3px 7px', color: 'var(--bad)', fontWeight: 700 }}>
                ⚠ Xoá thật {g.unpostedApprox > 0 ? `(${g.unpostedApprox}+)` : ''}
              </button>
              <button className="btn ghost" disabled={busy} onClick={() => setConfirmCleanup(null)}
                      style={{ fontSize: 10.5, padding: '3px 7px' }}>Huỷ</button>
            </span>
          ) : (
            <button className="btn ghost" disabled={busy} onClick={() => setConfirmCleanup(g.accountId)}
                    title="Xoá các nháp community-seed CHƯA đăng (col Ý tưởng) của account này. Bài đã đăng + lịch sử KHÔNG đụng."
                    style={{ fontSize: 10.5, padding: '3px 7px', color: 'var(--bad)',
                             display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <IconTrash size={12} /> Dọn nháp
            </button>
          )}
        </div>
        {open && (
          <>
            <div style={{ padding: '6px 10px', fontSize: 10.5, color: 'var(--fg-3)',
                          background: 'rgba(248,113,113,.04)', borderTop: '1px solid rgba(248,113,113,.2)' }}>
              Bài đã đăng/seed = lịch sử, giữ nguyên (xem trong brief / Board). ~{g.seededApprox} seed/30d. Nháp CHƯA đăng thì vô dụng với account này → dùng 🗑 Dọn nháp.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '8px 10px' }}>{g.rows.map(Row)}</div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="page" style={{ padding: 16 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <IconClock size={18} /> Seeding
            <span style={{ fontSize: 12, color: 'var(--fg-4)', fontWeight: 400 }}>{projectName}</span>
            <InfoHint label="Cách hoạt động">
              Mỗi cặp <strong>account × habitat</strong> có nhiều <strong>lane</strong> = (loại nội dung × ngôn ngữ),
              mỗi lane tần suất riêng — hiển thị 1 dòng. <strong>⚙</strong> = Lanes manager (thêm/sửa/xoá lane).
              <strong>Chốt nhịp</strong> = đánh dấu đã đăng kỳ này. <strong>📋 bài</strong> = pipeline cần chuẩn bị / sẽ đăng / đã đăng.
              Bài sinh ra = card cột <strong>Ý tưởng</strong> trên Board.
            </InfoHint>
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            {([
              [`${stats.total} lịch`, 'var(--fg-3)'],
              [`${stats.needAction} cần làm`, stats.needAction > 0 ? 'var(--warn)' : 'var(--fg-3)'],
              [`${stats.touches30d} touch/30d`, 'var(--fg-3)'],
              [`bám ${stats.adh}%`, healthColor(stats.adh)],
            ] as [string, string][]).map(([t, c]) => (
              <span key={t} style={{ padding: '1px 8px', fontSize: 10.5, fontFamily: 'var(--font-mono)',
                                     borderRadius: 999, background: 'var(--bg-2)', border: '1px solid var(--line)',
                                     color: c }}>{t}</span>
            ))}
            {/* StatWarn cho từng loại issue đã chuyển hết sang banner "Vấn đề
                chặn kế hoạch" phía dưới (chip click filter) — tránh trùng lặp. */}
          </div>
        </div>
        <div className="page-actions" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Segmented options={[{ value: 'active', label: 'Đang chạy' }, { value: 'all', label: 'Tất cả' }]}
                     value={statusFilter} onChange={(v) => setStatusFilter(v as 'active' | 'all')} />
          <input placeholder="Tìm habitat / account / tribe…" value={q} onChange={(e) => setQ(e.target.value)}
                 style={{ padding: '6px 10px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--fg-0)', fontSize: 12, outline: 'none', minWidth: 200 }} />
          <button className="btn primary" disabled={busy} onClick={doGenerate}
                  title="Sinh sẵn 1 bài nháp vào backlog cho mọi lịch đến hạn (auto + chưa có nháp)">
            {busy ? <><Spinner size="xs" /> Đang sinh</> : '▶ Sinh bài đến hạn'}
          </button>
        </div>
      </div>

      {/* Chip filter — click 1 chip = lọc queue bên dưới theo loại. 'ready'
          xanh = không issue, sẵn sàng seed. acct-dead đỏ; 3 loại còn lại
          vàng. Không banner background — chỉ chip + 1 dòng hint nhỏ. */}
      {(issuesGrouped.ready + issuesGrouped.totalIssues) > 0 && (() => {
        type Sev = 'ok' | 'bad' | 'warn';
        type ChipKey = NonNullable<typeof issueFilter>;
        const allChips: Array<{ key: ChipKey; label: string; n: number; sev: Sev }> = [
          { key: 'ready',             label: 'Sẵn sàng',            n: issuesGrouped.ready,                  sev: 'ok'   },
          { key: 'no-posts',          label: 'Thiếu bài',           n: issuesGrouped.noPosts.length,         sev: 'warn' },
          { key: 'incomplete-posts',  label: 'Thiếu nội dung',      n: issuesGrouped.incompletePosts.length, sev: 'warn' },
          { key: 'no-url',            label: 'Thiếu URL',           n: issuesGrouped.noUrl.length,           sev: 'warn' },
          { key: 'acct-not-ready',    label: 'Account chưa active', n: issuesGrouped.acctNotReady.length,    sev: 'warn' },
          { key: 'platform-mismatch', label: 'Sai nền tảng',        n: issuesGrouped.platMismatch.length,    sev: 'warn' },
          { key: 'acct-dead',         label: 'Account ngưng',       n: issuesGrouped.acctDead.length,        sev: 'bad'  },
        ];
        const chips = allChips.filter((c) => c.n > 0);
        const COLORS: Record<Sev, { fg: string; bg: string; border: string }> = {
          ok:   { fg: 'var(--ok)',   bg: 'rgba(74,222,128,.13)',  border: 'rgba(74,222,128,.45)' },
          warn: { fg: 'var(--warn)', bg: 'rgba(251,191,36,.13)',  border: 'rgba(251,191,36,.45)' },
          bad:  { fg: 'var(--bad)',  bg: 'rgba(248,113,113,.13)', border: 'rgba(248,113,113,.45)' },
        };
        return (
          <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center',
                        gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10.5, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>
              lọc:
            </span>
            {chips.map((c) => {
              const on = issueFilter === c.key;
              const col = COLORS[c.sev];
              return (
                <button key={c.key} type="button"
                        onClick={() => setIssueFilter(on ? null : c.key)}
                        title={on ? 'Click để bỏ filter' : `Lọc queue: ${c.label}`}
                        style={{ padding: '2px 9px', fontSize: 10.5, fontFamily: 'var(--font-mono)', fontWeight: 700,
                                 borderRadius: 999, textTransform: 'uppercase',
                                 background: on ? col.fg : col.bg,
                                 color: on ? '#fff' : col.fg,
                                 border: `1px solid ${on ? col.fg : col.border}`,
                                 cursor: 'pointer' }}>
                  {c.label} {c.n}
                </button>
              );
            })}
            {issueFilter && (
              <button type="button" onClick={() => setIssueFilter(null)}
                      style={{ fontSize: 10.5, padding: '2px 9px', background: 'transparent',
                               border: '1px solid var(--line)', borderRadius: 4, color: 'var(--fg-3)',
                               cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>
                ✕ Bỏ lọc
              </button>
            )}
          </div>
        );
      })()}

      {msg && (
        <div style={{ padding: 8, marginBottom: 10, background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', color: 'var(--accent)', fontSize: 12, borderRadius: 5, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ flex: 1 }}>{msg}</span>
          <button onClick={() => setMsg(null)} title="Đóng"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', display: 'inline-flex' }}>
            <IconX size={13} />
          </button>
        </div>
      )}

      {queue.length === 0 ? (
        <EmptyState icon="⏱" title="Chưa có lịch seeding nào"
          description="Vào trang Tribes → mở 1 account-brief → '+ Lịch seed' để tạo nhịp seeding cho cộng đồng đó." />
      ) : (liveList.length === 0 && deadGroups.length === 0 && needAccountGroups.length === 0 && needJoinGroups.length === 0) ? (
        <EmptyState icon="🔍" title="Không có lịch match filter" compact />
      ) : (
        <>
          {/* "Cần tạo account" — DEMAND signal, luôn hiện trên cùng để user
              chủ động tạo account thay vì chờ. */}
          {needAccountGroups.length > 0 && (
            <NeedAccountSection
              groups={needAccountGroups}
              onOpenAccount={(accountId) => setAccountOverlayId(accountId)}
              onOpenBrief={(briefId) => modal.open('brief', briefId)}
            />
          )}
          {/* "Cần join community" — account đã ready nhưng chưa join. Step
              tiếp theo sau tạo account. */}
          {needJoinGroups.length > 0 && (
            <NeedJoinSection
              groups={needJoinGroups}
              onOpenBrief={(briefId) => modal.open('brief', briefId)}
            />
          )}
          {deadGroups.map((g) => <DeadAccountCard key={g.accountId} g={g} />)}
          <Bucket title="Quá hạn" items={buckets.overdue!} accent="var(--bad)" />
          <Bucket title="Đến hạn" items={buckets.due!} accent="var(--warn)" />
          <Bucket title="Tuần này" items={buckets.week!} accent="var(--accent)" />
          <Bucket title="Sắp tới" items={buckets.later!} accent="var(--fg-3)" />
          {statusFilter === 'all' && <Bucket title="Tạm dừng / Ngoài phase" items={buckets.rest!} accent="var(--fg-4)" />}
        </>
      )}

      {editingBriefId != null && (
        <ScheduleEditModal projectId={projectId} briefId={editingBriefId}
                           onClose={() => modal.close()} onSaved={() => { modal.close(); router.refresh(); }} />
      )}

      {/* In-place: KHÔNG navigate. URL ?m=brief/tribe&mId=… (cùng trang /seeding), F5 mở lại. */}
      {briefModalId != null && (
        <BriefModalLoader
          projectId={projectId} briefId={briefModalId}
          focus={briefFocus && briefFocus.briefId === briefModalId ? briefFocus : null}
          onFocusChange={(phase, cardId) => {
            if (phase) { setBriefFocus({ briefId: briefModalId!, phase, cardId }); writeFocusUrl(phase, cardId); }
            else { setBriefFocus(null); writeFocusUrl(null); }
          }}
          onOpenAccount={(accId) => setAccountOverlayId(accId)}
          onOpenHabitat={(habId) => setHabitatOverlayId(habId)}
          externalReloadKey={briefReloadKey}
          onClose={() => { clearFocus(); modal.close(); }}
          onSaved={() => { clearFocus(); modal.close(); router.refresh(); }} />
      )}
      {tribeRow && (
        <TribeFormModal projectId={projectId} tribe={tribeRow}
                        onClose={() => { modal.close(); router.refresh(); }} />
      )}
      {pipelineId != null && (
        <BriefPipelineModal projectId={projectId} briefId={pipelineId}
                            onClose={() => modal.close()}
                            onOpenPost={(phase, cardId) => {
                              if (phase) focusPost(pipelineId, phase, cardId);
                              else openBrief(pipelineId);
                            }} />
      )}

      {reassign && (
        <AccountFormModal
          account={null}
          project={project}
          projectId={projectId}
          platforms={platforms}
          presetPlatformKey={reassign.presetPlatformKey}
          pickContextHabitatId={reassign.habitatId}
          pickContext={{
            purpose: 'Gán account đúng nền tảng cho brief',
            habitatName: reassign.habitatName,
            habitatKind: reassign.habitatKind,
            habitatUrl: reassign.habitatUrl,
          }}
          onClose={() => setReassign(null)}
          onCreated={onPickedAccount}
        />
      )}

      {/* Account modal — dùng nested param `?acct=open&acctId=N` (chồng trên
          brief modal, không đè `?m`). Legacy `?m=acct&mId=N` fallback qua
          acctModalId. Close: clear cả 2 path. */}
      {acctModalId != null && (
        <AccountModalLoader
          projectId={projectId} accountId={acctModalId}
          project={project} platforms={platforms}
          // Cross-modal: click habitat trong AccountBriefsSection → mở Habitat
          // modal overlay (đè lên Account modal). Click brief icon → mở Brief
          // modal (đè cả Account + Habitat — brief là top stack).
          onOpenHabitat={(habId) => setHabitatOverlayId(habId)}
          // Click brief từ Account overlay → đóng account+habitat trước,
          // nếu không account overlay che mất brief modal click.
          onOpenBrief={(briefId) => {
            setAccountOverlayId(null);
            setHabitatOverlayId(null);
            modal.open('brief', briefId);
          }}
          onClose={() => {
            // Đóng cả 2 paths: nested overlay (mới) + legacy `?m=acct`.
            if (accountOverlayId != null) setAccountOverlayId(null);
            if (modal.is('acct')) modal.close();
            router.refresh();
            // Account có thể đã đổi platform/status/persona → brief modal
            // (header pill, formats…) cần re-fetch. 0ms = ngay khi đóng.
            reloadBrief(0);
          }} />
      )}
      {/* Habitat modal CHỒNG — cùng lý do với account: edit platform/url/kind/
          mod rules cho community. Đóng → về brief. */}
      {habitatOverlayId != null && (
        <HabitatModalLoader
          projectId={projectId} habitatId={habitatOverlayId}
          tribes={tribes} platforms={platforms}
          // Cross-modal: click @accountHandle trong HabitatBriefsSection → mở
          // Account modal overlay. Click brief icon → mở Brief modal.
          onOpenAccount={(accountId) => setAccountOverlayId(accountId)}
          // Click brief từ Accounts engaging trong habitat overlay → ĐÓNG
          // habitat overlay trước (nếu không nó che brief modal phía dưới
          // → click vào brief không bắt được event), sau đó mở brief modal.
          onOpenBrief={(briefId) => {
            setHabitatOverlayId(null);
            modal.open('brief', briefId);
          }}
          onClose={() => {
            setHabitatOverlayId(null);
            router.refresh();
            // Habitat có thể đã đổi allowed_formats_override / kind / url /
            // platform → brief modal cần load lại allowedFormats để menu
            // "+ Tạo 1 bài" và pickers hiển thị đúng format mới.
            reloadBrief(0);
          }} />
      )}

      {/* Confirm "account chết" — in-place dialog (KHÔNG navigate, KHÔNG native confirm) */}
      {retiring && (
        <div className="modal-backdrop" onClick={() => !busy && setRetiring(null)}>
          <div className="modal" style={{ width: 'min(520px, 96vw)', maxWidth: 520 }}
               onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div style={{ flex: 1 }}>
                <div className="id-line">ACCOUNT KHÔNG CÒN DÙNG ĐƯỢC</div>
                <h2 style={{ fontSize: 15, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IconBan size={16} color="var(--bad)" /> @{retiring.handle}
                  <span style={{ color: 'var(--fg-3)', fontSize: 11, fontFamily: 'var(--font-mono)', marginLeft: 8 }}>{retiring.platformLabel}</span>
                </h2>
              </div>
              <button className="btn ghost" onClick={() => setRetiring(null)} disabled={busy}>✕</button>
            </div>
            <div className="modal-body" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 11.5, color: 'var(--fg-2)', lineHeight: 1.55 }}>
                Sẽ <strong>tạm dừng {retiring.scheduleCount} lịch</strong> của account này (không xoá — khôi phục được).
                Bài <strong>đã đăng / đã seed</strong> giữ nguyên làm lịch sử. Nháp <strong>chưa đăng</strong> sẽ được
                liệt kê ở thẻ account để bạn quyết dọn.
              </div>
              <div>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 5 }}>Lý do</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {RETIRE_REASONS.map((r) => (
                    <button key={r.key} type="button" onClick={() => setRetireReason(r.key)}
                            style={{ fontSize: 11, padding: '4px 10px', borderRadius: 5, cursor: 'pointer',
                                     border: `1px solid ${retireReason === r.key ? 'var(--bad)' : 'var(--line)'}`,
                                     background: retireReason === r.key ? 'rgba(248,113,113,.15)' : 'var(--bg-2)',
                                     color: retireReason === r.key ? 'var(--bad)' : 'var(--fg-2)', fontWeight: retireReason === r.key ? 700 : 400 }}>
                      {r.label}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 10, color: 'var(--fg-4)', marginTop: 6 }}>
                  → status = <strong>{retireReason === 'banned' ? 'BANNED (mất hẳn)' : 'BLOCKED (tạm, có thể khôi phục)'}</strong>
                </div>
              </div>
              <input type="text" value={retireText} onChange={(e) => setRetireText(e.target.value)}
                     placeholder="Ghi chú thêm (tuỳ chọn) — vd: Reddit permaban 2026-05-17"
                     autoComplete="off" data-1p-ignore data-lpignore="true" name="retire-note"
                     style={{ padding: '7px 9px', background: 'var(--bg-2)', color: 'var(--fg-0)',
                              border: '1px solid var(--line)', borderRadius: 5, fontSize: 12, outline: 'none' }} />
            </div>
            <div className="modal-foot">
              <div className="meta">Cascade: account → tất cả lịch của nó</div>
              <div className="modal-foot-actions">
                <button className="btn ghost" onClick={() => setRetiring(null)} disabled={busy}>Huỷ</button>
                <button className="btn danger" onClick={doRetire} disabled={busy}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  {busy ? <><Spinner size="xs" /> Đang xử lý</>
                        : <><IconBan size={13} /> Đánh dấu {retireReason === 'banned' ? 'BANNED' : 'BLOCKED'}</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Cache + prefetch để modal mở "tức thì" — server action lần đầu sau khi
// service restart bị Next 15 warm-up chậm 1-3s. Pre-warm khi user hover
// dòng queue (chưa click): khi click thật → response đã sẵn / on-the-fly.
// TTL ngắn (45s) để không cache stale qua sửa.
type BriefModalRes = Awaited<ReturnType<typeof getBriefForModal>>;
type Pending = Promise<BriefModalRes>;
const briefCache = new Map<string, { at: number; promise: Pending }>();
const BRIEF_TTL = 45_000;
function fetchBriefModal(projectId: string, briefId: number): Pending {
  const key = `${projectId}/${briefId}`;
  const hit = briefCache.get(key);
  if (hit && Date.now() - hit.at < BRIEF_TTL) return hit.promise;
  const promise = getBriefForModal(projectId, briefId);
  briefCache.set(key, { at: Date.now(), promise });
  // Nếu fail thì xoá để lần sau retry sạch.
  promise.catch(() => briefCache.delete(key));
  return promise;
}
function prefetchBriefModal(projectId: string, briefId: number): void {
  void fetchBriefModal(projectId, briefId);
}
function invalidateBriefModal(projectId: string, briefId: number): void {
  briefCache.delete(`${projectId}/${briefId}`);
}

// Fetch the full BriefRow for the clicked seeding row, then render
// BriefEditModal IN PLACE (no navigation). Module-scope (không định nghĩa
// component bên trong component — xem project-patterns.md).
function BriefModalLoader({ projectId, briefId, focus, onClose, onSaved, onFocusChange, onOpenAccount, onOpenHabitat, externalReloadKey = 0 }: {
  projectId: string;
  briefId: number;
  focus: { briefId: number; phase: string; cardId?: number } | null;
  onClose: () => void;
  onSaved: () => void;
  onFocusChange?: (phase: string, cardId?: number) => void;
  onOpenAccount?: (accountId: number) => void;
  onOpenHabitat?: (habitatId: number) => void;
  // Parent bump khi overlay con (account/habitat) lưu xong → loader re-fetch.
  externalReloadKey?: number;
}) {
  const [row, setRow] = useState<BriefRow | null>(null);
  const [ctx, setCtx] = useState<BriefModalCtx | null>(null);
  const [phaseCounts, setPhaseCounts] = useState<Record<string, number>>({});
  const [phaseTypeCounts, setPhaseTypeCounts] = useState<Record<string, Record<string, number>>>({});
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  // Tăng reloadKey → re-fetch ctx + counts (debounced) khi posts mutate.
  const [reloadKey, setReloadKey] = useState(0);
  const reloadTimer = useRef<number | null>(null);
  const handlePostsChanged = () => {
    // Debounce 350ms để chùm nhiều edit (đổi loại + save body + …) chỉ tốn
    // 1 round-trip. Invalidate cache trước để fetch lấy data mới.
    if (reloadTimer.current != null) window.clearTimeout(reloadTimer.current);
    reloadTimer.current = window.setTimeout(() => {
      invalidateBriefModal(projectId, briefId);
      setReloadKey((n) => n + 1);
    }, 350);
  };
  useEffect(() => () => {
    if (reloadTimer.current != null) window.clearTimeout(reloadTimer.current);
  }, []);
  useEffect(() => {
    let cancel = false;
    // Lần đầu (reloadKey=0 + externalReloadKey=0) → show 'loading'. Reload
    // sau khi mutate → giữ UI (counts cập nhật mượt, không flash spinner).
    if (reloadKey === 0 && externalReloadKey === 0) setState('loading');
    // fetchBriefModal: cache 45s + dedup. Nếu user đã hover prefetch trước
    // khi click, promise có sẵn → resolve gần như tức thì.
    fetchBriefModal(projectId, briefId)
      .then((res) => {
        if (cancel) return;
        if (res) {
          setRow(res.row); setCtx(res.ctx);
          setPhaseCounts(res.phaseCounts ?? {});
          setPhaseTypeCounts(res.phaseTypeCounts ?? {});
          setState('ready');
        }
        else setState('error');
      })
      .catch(() => { if (!cancel) setState('error'); });
    return () => { cancel = true; };
  }, [projectId, briefId, reloadKey, externalReloadKey]);

  if (state === 'loading') {
    return (
      <div className="modal-backdrop">
        <div className="modal" style={{ width: 'min(420px,100%)', padding: 28, textAlign: 'center' }}
             onClick={(e) => e.stopPropagation()}>
          <Spinner size="sm" /> <span style={{ marginLeft: 6, fontSize: 12, color: 'var(--fg-3)' }}>Đang tải brief…</span>
        </div>
      </div>
    );
  }
  if (state === 'error' || !row || !ctx) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal" style={{ width: 'min(420px,100%)', padding: 24 }} onClick={(e) => e.stopPropagation()}>
          <div style={{ fontSize: 12, color: 'var(--bad)' }}>⚠ Không tải được brief #{briefId}.</div>
          <button className="btn ghost" onClick={onClose} style={{ marginTop: 12 }}>Đóng</button>
        </div>
      </div>
    );
  }
  return (
    <BriefEditModal
      projectId={projectId}
      accountId={ctx.accountId}
      habitatId={ctx.habitatId}
      accountLabel={ctx.accountLabel}
      habitatLabel={ctx.habitatLabel}
      habitatUrl={ctx.habitatUrl}
      habitatKind={ctx.habitatKind}
      platformKey={ctx.platformKey}
      platformCategory={ctx.platformCategory}
      platformAllowedFormats={ctx.platformAllowedFormats}
      habitatAllowedFormats={ctx.habitatAllowedFormats}
      accountStatus={ctx.accountStatus}
      accountBlockReason={ctx.accountBlockReason}
      phaseCounts={phaseCounts}
      phaseTypeCounts={phaseTypeCounts}
      existing={row}
      initialTab={focus?.phase ? (focus.phase as 'overview' | Phase | 'history' | 'detect') : undefined}
      focusCardId={focus?.cardId}
      postsReloadKey={externalReloadKey}
      onFocusChange={onFocusChange}
      onOpenAccount={onOpenAccount}
      onOpenHabitat={onOpenHabitat}
      onPostsChanged={handlePostsChanged}
      onClose={onSaved}
    />
  );
}

// Tải AccountRow đầy đủ rồi mở AccountFormModal ở CHẾ ĐỘ SỬA tại chỗ
// (sửa account tạm: điền login/handle/status) — không rời trang Seeding.
function AccountModalLoader({ projectId, accountId, project, platforms, onClose, onOpenHabitat, onOpenBrief }: {
  projectId: string;
  accountId: number;
  project: Project;
  platforms: PlatformRow[];
  onClose: () => void;
  onOpenHabitat?: (habitatId: number) => void;
  onOpenBrief?: (briefId: number) => void;
}) {
  const [row, setRow] = useState<AccountRow | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    let cancel = false;
    setState('loading');
    getAccountForEdit(projectId, accountId)
      .then((r) => { if (cancel) return; if (r) { setRow(r); setState('ready'); } else setState('error'); })
      .catch(() => { if (!cancel) setState('error'); });
    return () => { cancel = true; };
  }, [projectId, accountId]);

  if (state === 'loading') {
    return (
      <div className="modal-backdrop">
        <div className="modal" style={{ width: 'min(420px,100%)', padding: 28, textAlign: 'center' }}
             onClick={(e) => e.stopPropagation()}>
          <Spinner size="sm" /> <span style={{ marginLeft: 6, fontSize: 12, color: 'var(--fg-3)' }}>Đang tải account…</span>
        </div>
      </div>
    );
  }
  if (state === 'error' || !row) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal" style={{ width: 'min(420px,100%)', padding: 24 }} onClick={(e) => e.stopPropagation()}>
          <div style={{ fontSize: 12, color: 'var(--bad)' }}>⚠ Không tải được account #{accountId}.</div>
          <button className="btn ghost" onClick={onClose} style={{ marginTop: 12 }}>Đóng</button>
        </div>
      </div>
    );
  }
  return (
    <AccountFormModal
      account={row}
      project={project}
      projectId={projectId}
      platforms={platforms}
      onClose={onClose}
      onOpenHabitat={onOpenHabitat}
      onOpenBrief={onOpenBrief}
    />
  );
}

// Habitat loader — fetch HabitatRow đầy đủ rồi mở HabitatFormModal in-place
// từ brief modal header (chip community click → edit platform/url/kind/
// posting rules/topics). Cùng pattern AccountModalLoader.
function HabitatModalLoader({ projectId, habitatId, tribes, platforms, onClose, onOpenAccount, onOpenBrief }: {
  projectId: string;
  habitatId: number;
  tribes: TribeRow[];
  platforms: PlatformRow[];
  onClose: () => void;
  onOpenAccount?: (accountId: number) => void;
  onOpenBrief?: (briefId: number) => void;
}) {
  const [row, setRow] = useState<HabitatRow | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [refetchTick, setRefetchTick] = useState(0);
  useEffect(() => {
    let cancel = false;
    if (refetchTick === 0) setState('loading');  // first load
    getHabitatRowAction(projectId, habitatId)
      .then((r) => { if (cancel) return; if (r) { setRow(r); setState('ready'); } else setState('error'); })
      .catch(() => { if (!cancel) setState('error'); });
    return () => { cancel = true; };
  }, [projectId, habitatId, refetchTick]);
  // Refresh callback exposed cho child (HabitatSelectorsSection "↻ refresh"
  // button) — re-fetch habitat row + bump tick để section re-render với
  // value mới scrape từ ext.
  const refreshRow = () => setRefetchTick((n) => n + 1);

  if (state === 'loading') {
    return (
      <div className="modal-backdrop">
        <div className="modal" style={{ width: 'min(420px,100%)', padding: 28, textAlign: 'center' }}
             onClick={(e) => e.stopPropagation()}>
          <Spinner size="sm" /> <span style={{ marginLeft: 6, fontSize: 12, color: 'var(--fg-3)' }}>Đang tải habitat…</span>
        </div>
      </div>
    );
  }
  if (state === 'error' || !row) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal" style={{ width: 'min(420px,100%)', padding: 24 }} onClick={(e) => e.stopPropagation()}>
          <div style={{ fontSize: 12, color: 'var(--bad)' }}>⚠ Không tải được habitat #{habitatId}.</div>
          <button className="btn ghost" onClick={onClose} style={{ marginTop: 12 }}>Đóng</button>
        </div>
      </div>
    );
  }
  return (
    <HabitatFormModal
      projectId={projectId}
      habitat={row}
      tribes={tribes}
      platforms={platforms}
      onClose={onClose}
      onOpenAccount={onOpenAccount}
      onOpenBrief={onOpenBrief}
      onRefreshHabitatRow={refreshRow}
    />
  );
}
