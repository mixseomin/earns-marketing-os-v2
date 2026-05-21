'use client';

// Plan Cockpit — single-screen 3-column interactive plan management.
// URL params: ?goal=<id>&step=<id> (browseable, F5-safe, shareable).

import { useState, useTransition, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Pill } from '@/components/ui';
import {
  updateStepStatus,
  updateStepField,
  updateGoalStatus,
  aiGenerateStepDraft,
  aiSuggestNextSteps,
} from '@/lib/actions/plan-cockpit';
import type {
  PlanRow, GoalRow, StepRow, RiskRow, AiContextRow, ActivityLogRow,
  ProjectBrandRow, PlatformAccountRow,
} from '@/lib/data-plan-cockpit';

function useUrlParam(key: string, defaultValue: string): [string, (v: string) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const value = params.get(key) ?? defaultValue;
  const set = (v: string) => {
    const next = new URLSearchParams(params.toString());
    if (!v || v === defaultValue) next.delete(key);
    else next.set(key, v);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  return [value, set];
}

const STATUS_META: Record<string, { color: string; label: string }> = {
  todo: { color: '#6b7280', label: 'CHƯA' },
  doing: { color: '#3b82f6', label: 'ĐANG' },
  done: { color: '#10b981', label: 'XONG' },
  blocked: { color: '#ef4444', label: 'VƯỚNG' },
  skipped: { color: '#9ca3af', label: 'BỎ' },
};

const PROBABILITY_COLOR: Record<string, string> = { low: '#10b981', medium: '#f59e0b', high: '#ef4444' };
const IMPACT_COLOR: Record<string, string> = { low: '#10b981', medium: '#f59e0b', high: '#ef4444' };
const VI_LEVEL: Record<string, string> = { low: 'thấp', medium: 'vừa', high: 'cao' };

const CHANNEL_ICON: Record<string, string> = {
  reddit: '🟠', twitter: '🐦', hackernews: '🧡', devto: '⌨️', producthunt: '🐱',
  indiehackers: '🚀', linkedin: '🔵', beehiiv: '🐝', sparkloop: '✨',
  email: '✉️', discord: '💬',
};

export interface PlanCockpitProps {
  plan: PlanRow;
  goals: GoalRow[];
  steps: StepRow[];
  risks: RiskRow[];
  aiContext: AiContextRow | null;
  activity: ActivityLogRow[];
  activeGoalId: number | null;
  activeStepId: number | null;
  projectBrand: ProjectBrandRow | null;
  accounts: PlatformAccountRow[];
}

export function PlanCockpit({ plan, goals, steps, risks, aiContext, activity, activeGoalId, activeStepId, projectBrand, accounts }: PlanCockpitProps) {
  const [, setGoalUrl] = useUrlParam('goal', '');
  const [, setStepUrl] = useUrlParam('step', '');
  const [, startTransition] = useTransition();

  // First active goal fallback
  const currentGoal = useMemo(() => goals.find((g) => g.id === activeGoalId) || goals[0] || null, [goals, activeGoalId]);
  const currentSteps = useMemo(() => (currentGoal ? steps.filter((s) => s.goalId === currentGoal.id) : []), [steps, currentGoal]);
  const expandedStep = useMemo(() => steps.find((s) => s.id === activeStepId) || null, [steps, activeStepId]);

  const planProgress = plan.targetMrrUsd > 0 ? Math.min(100, Math.round((plan.currentMrrUsd / plan.targetMrrUsd) * 100)) : 0;

  return (
    <div style={styles.root}>
      {/* ── HEADER ─────────────────────────────────────── */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={{ fontSize: 18 }}>🎯</span>
          <div>
            <div style={styles.planName}>{plan.name}</div>
            {plan.description && <div style={styles.planDesc}>{plan.description}</div>}
          </div>
        </div>
        <div style={styles.headerRight}>
          <Pill color={STATUS_META[plan.status]?.color || '#6b7280'} label={plan.status.toUpperCase()} tone="soft" />
          <div style={styles.mrrBlock}>
            <span style={styles.mrrCurrent}>${plan.currentMrrUsd}</span>
            <span style={styles.mrrSep}>/</span>
            <span style={styles.mrrTarget}>${plan.targetMrrUsd} MRR</span>
            <div style={styles.progressBar}>
              <div style={{ ...styles.progressFill, width: `${planProgress}%` }} />
            </div>
            <span style={styles.progressPct}>{planProgress}%</span>
          </div>
        </div>
      </header>

      {/* ── 3-COL GRID ─────────────────────────────────── */}
      <div style={styles.grid}>
        {/* LEFT: Goal Tree */}
        <aside style={styles.left}>
          <div style={styles.colHeader}>
            <span>Mục tiêu ({goals.length})</span>
            <button style={styles.btnIconSm} title="Thêm mục tiêu (sắp có)" disabled>+</button>
          </div>
          <div style={styles.goalList}>
            {goals.map((g) => (
              <GoalListItem
                key={g.id}
                goal={g}
                isActive={currentGoal?.id === g.id}
                onClick={() => { setStepUrl(''); setGoalUrl(String(g.id)); }}
              />
            ))}
          </div>
        </aside>

        {/* CENTER: Brand Kit + Active Goal Detail + Steps */}
        <main style={styles.center}>
          <BrandKitCard plan={plan} brand={projectBrand} accounts={accounts} />
          {!currentGoal && <div style={styles.empty}>Chưa có mục tiêu. Thêm 1 cái để bắt đầu.</div>}
          {currentGoal && (
            <>
              <GoalDetailHeader
                goal={currentGoal}
                planSlug={plan.slug}
                onStatusChange={(status) => startTransition(() => { void updateGoalStatus(currentGoal.id, status, plan.slug); })}
              />

              <div style={styles.sectionTitle}>
                <span>Các bước ({currentSteps.length})</span>
                <span style={styles.muted}>
                  {currentSteps.filter((s) => s.status === 'done').length} xong · {currentSteps.filter((s) => s.status === 'doing').length} đang làm
                </span>
              </div>

              <div style={styles.stepTableWrap}>
                <table style={styles.stepTable}>
                  <thead>
                    <tr>
                      <th style={{ ...styles.th, width: 28 }}>STT</th>
                      <th style={{ ...styles.th, width: 220 }}>Kênh</th>
                      <th style={styles.th}>Hành động</th>
                      <th style={{ ...styles.th, width: 90 }}>Chỉ tiêu</th>
                      <th style={{ ...styles.th, width: 90 }}>Giờ</th>
                      <th style={{ ...styles.th, width: 110 }}>Tần suất</th>
                      <th style={{ ...styles.th, width: 80 }}>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentSteps.length === 0 && (
                      <tr><td colSpan={7} style={styles.tdEmpty}>Chưa có bước nào. Click ✨ AI đề xuất bên dưới.</td></tr>
                    )}
                    {currentSteps.map((s, i) => (
                      <StepTableRow
                        key={s.id}
                        idx={i + 1}
                        step={s}
                        isExpanded={expandedStep?.id === s.id}
                        planSlug={plan.slug}
                        onToggleExpand={() => setStepUrl(expandedStep?.id === s.id ? '' : String(s.id))}
                      />
                    ))}
                  </tbody>
                </table>
                <button
                  style={styles.aiSuggestBtn}
                  onClick={() => startTransition(async () => {
                    const r = await aiSuggestNextSteps(currentGoal.id, plan.slug);
                    if (r.ok) alert((r.suggestions || []).join('\n'));
                  })}
                >
                  ✨ AI: đề xuất bước tiếp
                </button>
              </div>

              {/* Risks tied to current goal OR global */}
              <div style={styles.sectionTitle}>
                <span>Rủi ro ({risks.filter((r) => r.goalId === null || r.goalId === currentGoal.id).length})</span>
              </div>
              <div style={styles.riskList}>
                {risks.filter((r) => r.goalId === null || r.goalId === currentGoal.id).map((r) => (
                  <RiskItem key={r.id} risk={r} />
                ))}
              </div>
            </>
          )}
        </main>

        {/* RIGHT: AI + Live Data */}
        <aside style={styles.right}>
          <div style={styles.colHeader}>Trợ lý AI</div>
          <div style={styles.aiPanel}>
            <div style={styles.aiSection}>
              <div style={styles.aiSectionTitle}>💬 Coach</div>
              <div style={styles.aiCoachBox}>
                {aiContext?.aiBrief ? (
                  <pre style={styles.aiBriefText}>{aiContext.aiBrief}</pre>
                ) : (
                  <div style={styles.muted}>Chưa có brief hôm nay. AI sẽ tự tạo lúc 6h sáng.</div>
                )}
                <button
                  style={styles.btnSecondarySm}
                  onClick={() => startTransition(async () => {
                    alert('AI brief — stub. Sẽ wire Claude API ở Phase 3.');
                  })}
                >
                  Làm mới brief
                </button>
              </div>
            </div>

            <div style={styles.aiSection}>
              <div style={styles.aiSectionTitle}>📊 Dữ liệu thực</div>
              <LiveDataPanel snapshot={aiContext?.snapshot || {}} refreshedAt={aiContext?.refreshedAt} />
            </div>

            <div style={styles.aiSection}>
              <div style={styles.aiSectionTitle}>🤖 Hành động nhanh</div>
              <div style={styles.aiActions}>
                <button style={styles.btnGhost} disabled>• Tinh chỉnh tiêu đề issue</button>
                <button style={styles.btnGhost} disabled>• Chấm điểm deal (commission/EPC)</button>
                <button style={styles.btnGhost} disabled>• Tìm newsletter peer để swap</button>
                <button style={styles.btnGhost} disabled>• Dự đoán CTR cho draft</button>
              </div>
              <div style={styles.muted}>(Wire ở Phase 3)</div>
            </div>
          </div>
        </aside>
      </div>

      {/* ── FOOTER: Activity strip ─────────────────────── */}
      <footer style={styles.footer}>
        <span style={styles.muted}>Hoạt động:</span>
        {activity.length === 0 && <span style={styles.muted}>Chưa có hoạt động nào.</span>}
        {activity.map((a, i) => (
          <span key={a.id} style={styles.activityItem}>
            <span style={styles.muted}>{a.createdAt}</span>{' '}
            <strong>{a.actor}</strong> {a.action} <em>{a.entityType}</em>
            {i < activity.length - 1 && <span style={styles.activitySep}>•</span>}
          </span>
        ))}
      </footer>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────

function GoalListItem({ goal, isActive, onClick }: { goal: GoalRow; isActive: boolean; onClick: () => void }) {
  const pct = goal.targetValue ? Math.min(100, Math.round((Number(goal.currentValue) / Number(goal.targetValue)) * 100)) : 0;
  return (
    <button onClick={onClick} style={{ ...styles.goalItem, ...(isActive ? styles.goalItemActive : {}) }}>
      <div style={styles.goalItemHead}>
        <span style={{ ...styles.goalDot, background: STATUS_META[goal.status]?.color || '#6b7280' }} />
        <span style={styles.goalName}>{goal.name}</span>
      </div>
      <div style={styles.goalMeta}>
        {goal.targetValue && (
          <>
            <span style={styles.goalNumbers}>
              {Number(goal.currentValue)}/{Number(goal.targetValue)} {goal.targetUnit}
            </span>
            <div style={styles.goalProgressBar}>
              <div style={{ ...styles.goalProgressFill, width: `${pct}%`, background: STATUS_META[goal.status]?.color || '#6b7280' }} />
            </div>
          </>
        )}
      </div>
      {goal.deadline && <div style={styles.goalDeadline}>Hạn {goal.deadline}</div>}
    </button>
  );
}

function GoalDetailHeader({ goal, planSlug, onStatusChange }: { goal: GoalRow; planSlug: string; onStatusChange: (s: string) => void }) {
  void planSlug;
  const pct = goal.targetValue ? Math.min(100, Math.round((Number(goal.currentValue) / Number(goal.targetValue)) * 100)) : 0;
  return (
    <div style={styles.goalDetailHead}>
      <div style={styles.goalDetailTitle}>📌 {goal.name}</div>
      <div style={styles.goalDetailRow}>
        <select
          value={goal.status}
          onChange={(e) => onStatusChange(e.target.value)}
          style={styles.statusSelect}
        >
          {Object.entries(STATUS_META).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        {goal.targetValue && (
          <span style={styles.muted}>
            {Number(goal.currentValue)}/{Number(goal.targetValue)} {goal.targetUnit} ({pct}%)
          </span>
        )}
        {goal.deadline && <span style={styles.muted}>Hạn {goal.deadline}</span>}
      </div>
      {goal.targetValue && (
        <div style={styles.goalProgressBarBig}>
          <div style={{ ...styles.goalProgressFillBig, width: `${pct}%`, background: STATUS_META[goal.status]?.color || '#6b7280' }} />
        </div>
      )}
    </div>
  );
}

function StepTableRow({ idx, step, isExpanded, planSlug, onToggleExpand }: { idx: number; step: StepRow; isExpanded: boolean; planSlug: string; onToggleExpand: () => void }) {
  const [, startTransition] = useTransition();
  const target = step.targetMetric as { kind?: string; value?: number };
  const statusColor = STATUS_META[step.status]?.color || '#6b7280';

  return (
    <>
      <tr style={{ ...styles.tr, ...(isExpanded ? styles.trActive : {}), borderLeft: `2px solid ${statusColor}` }} onClick={onToggleExpand}>
        <td style={styles.tdIdx}>{idx}</td>
        <td style={styles.td}>
          <div style={styles.cellChannel}>
            {step.channel && <span style={styles.stepChannelIcon}>{CHANNEL_ICON[step.channel] || '•'}</span>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
              <span style={styles.cellChannelName}>{step.channel || '—'}</span>
              {step.channelTarget && <span style={styles.cellChannelTarget}>{step.channelTarget}</span>}
            </div>
          </div>
        </td>
        <td style={styles.td}>
          <span style={styles.cellAction}>{step.name}</span>
          {step.notes && !isExpanded && <span style={styles.cellActionNote}>{step.notes}</span>}
        </td>
        <td style={styles.td}>
          {target?.value ? (
            <span style={styles.cellTarget}>{target.value} {target.kind}</span>
          ) : <span style={styles.muted}>—</span>}
        </td>
        <td style={styles.td}>{step.timeEstimate || <span style={styles.muted}>—</span>}</td>
        <td style={styles.td}>{step.cadence || <span style={styles.muted}>—</span>}</td>
        <td style={styles.td} onClick={(e) => e.stopPropagation()}>
          <select
            value={step.status}
            onChange={(e) => startTransition(() => { void updateStepStatus(step.id, e.target.value, planSlug); })}
            style={{ ...styles.statusSelectSm, color: statusColor, borderColor: statusColor }}
          >
            {Object.entries(STATUS_META).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </td>
      </tr>
      {isExpanded && (
        <tr style={styles.expandRow}>
          <td colSpan={7} style={styles.expandCell}>
            <div style={styles.stepBody}>
              <FieldRow label="Kênh">
                <InlineEditText
                  value={step.channel || ''}
                  placeholder="reddit, twitter, hackernews..."
                  onSave={(v) => startTransition(() => { void updateStepField(step.id, 'channel', v || null, planSlug); })}
                />
              </FieldRow>
              <FieldRow label="Đích kênh">
                <InlineEditText
                  value={step.channelTarget || ''}
                  placeholder="r/Newsletters, @handle..."
                  onSave={(v) => startTransition(() => { void updateStepField(step.id, 'channel_target', v || null, planSlug); })}
                />
              </FieldRow>
              <FieldRow label="Ước tính giờ">
                <InlineEditText
                  value={step.timeEstimate || ''}
                  placeholder="1h, 30 phút, full day..."
                  onSave={(v) => startTransition(() => { void updateStepField(step.id, 'time_estimate', v || null, planSlug); })}
                />
              </FieldRow>
              <FieldRow label="Tần suất">
                <InlineEditText
                  value={step.cadence || ''}
                  placeholder="weekly, 1 shot, ongoing, 1/tuần max..."
                  onSave={(v) => startTransition(() => { void updateStepField(step.id, 'cadence', v || null, planSlug); })}
                />
              </FieldRow>
              <FieldRow label="Hạn">
                <InlineEditText
                  value={step.dueDate || ''}
                  placeholder="YYYY-MM-DD"
                  onSave={(v) => startTransition(() => { void updateStepField(step.id, 'due_date', v || null, planSlug); })}
                />
              </FieldRow>
              <FieldRow label="Người làm">
                <InlineEditText
                  value={step.owner || ''}
                  placeholder="me / ai / @user"
                  onSave={(v) => startTransition(() => { void updateStepField(step.id, 'owner', v || null, planSlug); })}
                />
              </FieldRow>
              <FieldRow label="Ghi chú">
                <InlineEditText
                  value={step.notes || ''}
                  placeholder="Bối cảnh, lưu ý, điều kiện cần..."
                  onSave={(v) => startTransition(() => { void updateStepField(step.id, 'notes', v || null, planSlug); })}
                  multiline
                />
              </FieldRow>
              <FieldRow label="Nội dung nháp">
                <div style={{ flex: 1 }}>
                  <InlineEditText
                    value={step.draftContent || ''}
                    placeholder="Bài post, tiêu đề email, tweet body..."
                    onSave={(v) => startTransition(() => { void updateStepField(step.id, 'draft_content', v || null, planSlug); })}
                    multiline
                  />
                  <button
                    style={styles.btnAi}
                    onClick={() => startTransition(async () => {
                      const r = await aiGenerateStepDraft(step.id, planSlug);
                      if (!r.ok) alert(r.error || 'AI lỗi');
                    })}
                  >
                    ✨ AI: tạo nháp
                  </button>
                  {step.aiGenerated && <span style={styles.aiBadge}>AI tạo</span>}
                </div>
              </FieldRow>
              <FieldRow label="URL bằng chứng">
                <InlineEditText
                  value={step.evidenceUrl || ''}
                  placeholder="Dán URL sau khi xong"
                  onSave={(v) => startTransition(() => { void updateStepField(step.id, 'evidence_url', v || null, planSlug); })}
                />
              </FieldRow>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={styles.fieldRow}>
      <div style={styles.fieldLabel}>{label}</div>
      <div style={styles.fieldValue}>{children}</div>
    </div>
  );
}

function InlineEditText({ value, placeholder, onSave, multiline }: { value: string; placeholder?: string; onSave: (v: string) => void; multiline?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value);
  if (!editing) {
    return (
      <span
        onClick={() => setEditing(true)}
        style={{ ...styles.inlineDisplay, color: value ? 'inherit' : '#9ca3af' }}
      >
        {value || placeholder || '(click để sửa)'}
      </span>
    );
  }
  if (multiline) {
    return (
      <textarea
        autoFocus
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => { setEditing(false); if (v !== value) onSave(v); }}
        style={styles.inlineTextarea}
        rows={3}
      />
    );
  }
  return (
    <input
      autoFocus
      type="text"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { setEditing(false); if (v !== value) onSave(v); }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setV(value); setEditing(false); } }}
      style={styles.inlineInput}
      placeholder={placeholder}
    />
  );
}

function RiskItem({ risk }: { risk: RiskRow }) {
  return (
    <div style={styles.riskItem}>
      <div style={styles.riskHead}>
        <span>⚠️</span>
        <span style={styles.riskName}>{risk.name}</span>
        <Pill color={PROBABILITY_COLOR[risk.probability] || '#6b7280'} label={`KN:${VI_LEVEL[risk.probability] || risk.probability}`} tone="soft" />
        <Pill color={IMPACT_COLOR[risk.impact] || '#6b7280'} label={`AH:${VI_LEVEL[risk.impact] || risk.impact}`} tone="soft" />
      </div>
      {risk.mitigation && <div style={styles.riskMitigation}>↪ {risk.mitigation}</div>}
    </div>
  );
}

function BrandKitCard({ plan, brand, accounts }: { plan: PlanRow; brand: ProjectBrandRow | null; accounts: PlatformAccountRow[] }) {
  // No project linked → CTA to link
  if (!plan.projectId) {
    return (
      <div style={styles.brandCardWarn}>
        <div style={styles.brandCardWarnIcon}>⚠️</div>
        <div style={{ flex: 1 }}>
          <div style={styles.brandCardWarnTitle}>Chưa có MOS2 project liên kết</div>
          <div style={styles.brandCardWarnDesc}>
            Plan này chưa có brand entity. Tạo MOS2 project (brand identity, tài khoản, AI squads) rồi link plan vào để có context cụ thể thay vì playbook trừu tượng.
          </div>
        </div>
        <a href="/p/new" style={styles.btnPrimary}>+ Tạo project</a>
      </div>
    );
  }

  // Project linked but brand fields empty → setup needed
  const hasBrandIdentity = brand && (brand.website || brand.oneLiner || brand.bio);
  const projectUrl = `/p/${plan.projectId}`;
  const settingsUrl = `/p/${plan.projectId}/settings`;
  const accountsUrl = `/p/${plan.projectId}/resources`;

  return (
    <div style={styles.brandCard}>
      <div style={styles.brandCardHeader}>
        <div style={styles.brandCardLeft}>
          <span style={{ fontSize: 22 }}>{brand?.emoji || '📦'}</span>
          <div>
            <div style={styles.brandCardTitle}>
              <a href={projectUrl} style={styles.brandLink}>{brand?.name || plan.projectId}</a>
              <span style={styles.brandCardMode}>{brand?.modeId || 'no-mode'}</span>
            </div>
            <div style={styles.brandCardOneLiner}>
              {brand?.oneLiner || <span style={styles.muted}>Chưa có one-liner. <a href={settingsUrl} style={styles.brandLink}>Thêm trong cài đặt project →</a></span>}
            </div>
          </div>
        </div>
        <div style={styles.brandCardRight}>
          <a href={projectUrl} style={styles.btnSecondarySm}>Mở project →</a>
        </div>
      </div>

      {!hasBrandIdentity && (
        <div style={styles.brandSetupWarn}>
          ⚠️ Brand identity rỗng (website, one-liner, bio chưa có). Setup tại <a href={settingsUrl} style={styles.brandLink}>Cài đặt project →</a>
        </div>
      )}

      <div style={styles.brandFields}>
        <BrandField label="Website" value={brand?.website} settingsUrl={settingsUrl} />
        <BrandField label="Bio" value={brand?.bio} settingsUrl={settingsUrl} />
        <BrandField label="Persona" value={brand?.persona} settingsUrl={settingsUrl} />
        <BrandField label="Hashtags" value={brand?.hashtags} settingsUrl={settingsUrl} />
      </div>

      <div style={styles.brandAccountsBlock}>
        <div style={styles.brandAccountsHeader}>
          <span>Tài khoản liên kết ({accounts.length})</span>
          <a href={accountsUrl} style={styles.brandLinkSm}>Quản lý →</a>
        </div>
        {accounts.length === 0 ? (
          <div style={styles.muted}>
            Chưa có tài khoản nào. <a href={accountsUrl} style={styles.brandLink}>Thêm Beehiiv / Awin / PartnerStack / Reddit / Twitter →</a>
          </div>
        ) : (
          <div style={styles.brandAccountsList}>
            {accounts.map((a) => (
              <a key={a.id} href={a.url || accountsUrl} target={a.url ? '_blank' : undefined} rel="noreferrer" style={styles.brandAccountChip} title={`${a.platformKey} · ${a.status}`}>
                <span style={styles.brandAccountIcon}>{CHANNEL_ICON[a.platformKey] || '•'}</span>
                <span style={styles.brandAccountHandle}>{a.handle}</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BrandField({ label, value, settingsUrl }: { label: string; value?: string | null; settingsUrl: string }) {
  return (
    <div style={styles.brandFieldRow}>
      <span style={styles.brandFieldLabel}>{label}</span>
      {value ? (
        <span style={styles.brandFieldValue}>{value}</span>
      ) : (
        <a href={settingsUrl} style={styles.brandFieldEmpty}>(chưa có — click để thêm)</a>
      )}
    </div>
  );
}

function LiveDataPanel({ snapshot, refreshedAt }: { snapshot: Record<string, unknown>; refreshedAt?: string }) {
  const fields = [
    { key: 'beehiiv_subs', label: 'Beehiiv subs' },
    { key: 'awin_pending_usd', label: 'Awin chờ duyệt', prefix: '$' },
    { key: 'awin_approved_usd', label: 'Awin đã duyệt', prefix: '$' },
    { key: 'partnerstack_mrr_usd', label: 'PartnerStack MRR', prefix: '$' },
    { key: 'reddit_karma', label: 'Reddit karma' },
  ];
  return (
    <div style={styles.liveData}>
      {fields.map((f) => {
        const val = snapshot[f.key];
        return (
          <div key={f.key} style={styles.liveDataRow}>
            <span style={styles.liveDataLabel}>{f.label}</span>
            <span style={styles.liveDataValue}>
              {val == null ? <span style={{ color: '#9ca3af' }}>—</span> : `${f.prefix || ''}${String(val)}`}
            </span>
          </div>
        );
      })}
      {refreshedAt && <div style={styles.muted}>Cập nhật {refreshedAt}</div>}
      <div style={{ ...styles.muted, fontSize: 10, marginTop: 4 }}>
        API kết nối Beehiiv/Awin/PartnerStack/Reddit đang stub. Wire sau.
      </div>
    </div>
  );
}

// ─── Inline styles (minimal Tailwind dep, full control) ────────────

const styles: Record<string, React.CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)', fontSize: 13, color: 'var(--mos2-text, #e5e7eb)', background: 'var(--mos2-bg, #0f1115)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--mos2-border, #1f2937)', gap: 16 },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 },
  planName: { fontSize: 15, fontWeight: 600 },
  planDesc: { fontSize: 11, color: '#9ca3af', maxWidth: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  headerRight: { display: 'flex', alignItems: 'center', gap: 12 },
  mrrBlock: { display: 'flex', alignItems: 'center', gap: 6 },
  mrrCurrent: { fontWeight: 600, color: '#10b981' },
  mrrSep: { color: '#6b7280' },
  mrrTarget: { color: '#9ca3af' },
  progressBar: { width: 80, height: 6, background: '#1f2937', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', background: '#10b981', transition: 'width 0.3s' },
  progressPct: { fontSize: 11, color: '#9ca3af', minWidth: 30 },

  grid: { display: 'grid', gridTemplateColumns: '240px 1fr 320px', flex: 1, minHeight: 0, gap: 0 },
  left: { borderRight: '1px solid var(--mos2-border, #1f2937)', overflowY: 'auto', display: 'flex', flexDirection: 'column' },
  center: { overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 },
  right: { borderLeft: '1px solid var(--mos2-border, #1f2937)', overflowY: 'auto', display: 'flex', flexDirection: 'column' },

  colHeader: { padding: '8px 12px', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--mos2-border, #1f2937)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  btnIconSm: { background: 'transparent', border: '1px solid #374151', color: '#9ca3af', borderRadius: 4, width: 20, height: 20, fontSize: 12, cursor: 'pointer' },

  goalList: { display: 'flex', flexDirection: 'column', gap: 2, padding: 4 },
  goalItem: { background: 'transparent', border: '1px solid transparent', borderRadius: 6, padding: '8px 10px', cursor: 'pointer', textAlign: 'left', color: 'inherit', display: 'flex', flexDirection: 'column', gap: 4 },
  goalItemActive: { background: '#1f2937', border: '1px solid #374151' },
  goalItemHead: { display: 'flex', alignItems: 'center', gap: 6 },
  goalDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  goalName: { fontSize: 12, fontWeight: 500, lineHeight: 1.3 },
  goalMeta: { display: 'flex', alignItems: 'center', gap: 6, marginLeft: 14 },
  goalNumbers: { fontSize: 11, color: '#9ca3af' },
  goalProgressBar: { flex: 1, height: 3, background: '#1f2937', borderRadius: 2, overflow: 'hidden' },
  goalProgressFill: { height: '100%', transition: 'width 0.3s' },
  goalDeadline: { fontSize: 10, color: '#6b7280', marginLeft: 14 },

  empty: { color: '#9ca3af', padding: 20, textAlign: 'center' },

  brandCard: { background: 'linear-gradient(180deg, #1a1d24 0%, #161922 100%)', border: '1px solid #2d3748', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 4 },
  brandCardWarn: { background: '#1c1917', border: '1px solid #f59e0b', borderRadius: 8, padding: 12, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 },
  brandCardWarnIcon: { fontSize: 24 },
  brandCardWarnTitle: { fontWeight: 600, fontSize: 13, color: '#f59e0b', marginBottom: 2 },
  brandCardWarnDesc: { fontSize: 11, color: '#d6d3d1', lineHeight: 1.4 },
  brandCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  brandCardLeft: { display: 'flex', gap: 10, flex: 1, minWidth: 0 },
  brandCardRight: { display: 'flex', gap: 6, flexShrink: 0 },
  brandCardTitle: { display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 14, fontWeight: 600 },
  brandCardMode: { fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: 'var(--font-mono, monospace)' },
  brandCardOneLiner: { fontSize: 11, color: '#d1d5db', marginTop: 2, lineHeight: 1.4 },
  brandLink: { color: '#60a5fa', textDecoration: 'none' },
  brandLinkSm: { color: '#60a5fa', textDecoration: 'none', fontSize: 10 },
  brandSetupWarn: { background: '#1c1917', border: '1px solid #44403c', borderRadius: 4, padding: '6px 8px', fontSize: 11, color: '#fbbf24' },
  brandFields: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: 11 },
  brandFieldRow: { display: 'flex', gap: 6, alignItems: 'baseline' },
  brandFieldLabel: { color: '#6b7280', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, minWidth: 60 },
  brandFieldValue: { color: '#e5e7eb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  brandFieldEmpty: { color: '#6b7280', fontSize: 10, textDecoration: 'none', fontStyle: 'italic' },
  brandAccountsBlock: { borderTop: '1px solid #2d3748', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6 },
  brandAccountsHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 },
  brandAccountsList: { display: 'flex', flexWrap: 'wrap', gap: 4 },
  brandAccountChip: { display: 'inline-flex', alignItems: 'center', gap: 4, background: '#1f2937', border: '1px solid #374151', borderRadius: 4, padding: '3px 6px', fontSize: 11, color: '#e5e7eb', textDecoration: 'none' },
  brandAccountIcon: { fontSize: 12 },
  brandAccountHandle: { fontSize: 11 },
  btnPrimary: { background: '#3b82f6', color: 'white', padding: '6px 12px', borderRadius: 4, textDecoration: 'none', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap' },

  goalDetailHead: { padding: '8px 0 12px', borderBottom: '1px solid #1f2937', marginBottom: 8 },
  goalDetailTitle: { fontSize: 16, fontWeight: 600, marginBottom: 8 },
  goalDetailRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 },
  goalProgressBarBig: { height: 8, background: '#1f2937', borderRadius: 4, overflow: 'hidden', marginTop: 4 },
  goalProgressFillBig: { height: '100%', transition: 'width 0.3s' },

  sectionTitle: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, padding: '12px 0 6px' },
  muted: { color: '#9ca3af', fontSize: 11 },

  stepTableWrap: { display: 'flex', flexDirection: 'column', gap: 6 },
  stepTable: { width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12, background: '#0f1115', border: '1px solid #1f2937', borderRadius: 6, overflow: 'hidden' },
  th: { textAlign: 'left', padding: '6px 8px', fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, background: '#0a0c10', borderBottom: '1px solid #1f2937' },
  tr: { cursor: 'pointer', borderBottom: '1px solid #1f2937', transition: 'background 0.15s' },
  trActive: { background: '#161922' },
  td: { padding: '8px 8px', verticalAlign: 'top', borderBottom: '1px solid #1f2937', lineHeight: 1.4 },
  tdIdx: { padding: '8px 6px', textAlign: 'center', color: '#6b7280', fontFamily: 'var(--font-mono, monospace)', fontSize: 11, borderBottom: '1px solid #1f2937', verticalAlign: 'top' },
  tdEmpty: { padding: 20, textAlign: 'center', color: '#6b7280' },
  cellChannel: { display: 'flex', alignItems: 'flex-start', gap: 6, minWidth: 0 },
  cellChannelName: { fontSize: 12, fontWeight: 500, textTransform: 'capitalize' },
  cellChannelTarget: { fontSize: 10, color: '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 },
  cellAction: { fontSize: 12, fontWeight: 500, display: 'block' },
  cellActionNote: { fontSize: 10, color: '#9ca3af', display: 'block', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  cellTarget: { fontSize: 11, color: '#10b981', whiteSpace: 'nowrap' },
  expandRow: { background: '#161922' },
  expandCell: { padding: 0, background: '#0a0c10', borderTop: 'none', borderBottom: '1px solid #1f2937' },
  stepChannelIcon: { fontSize: 14, lineHeight: 1, marginTop: 1 },
  statusSelect: { background: '#1f2937', color: '#e5e7eb', border: '1px solid #374151', borderRadius: 4, padding: '2px 6px', fontSize: 11 },
  statusSelectSm: { background: '#1f2937', color: '#e5e7eb', border: '1px solid #374151', borderRadius: 4, padding: '2px 4px', fontSize: 10, fontWeight: 600 },

  stepBody: { padding: '8px 12px 12px 28px', borderTop: '1px solid #1f2937', display: 'flex', flexDirection: 'column', gap: 6 },
  fieldRow: { display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12 },
  fieldLabel: { color: '#9ca3af', minWidth: 110, fontSize: 11, paddingTop: 4 },
  fieldValue: { flex: 1, display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: 4 },
  inlineDisplay: { cursor: 'text', padding: '3px 6px', borderRadius: 4, display: 'inline-block', minHeight: 22, lineHeight: 1.4, wordBreak: 'break-word' },
  inlineInput: { background: '#1f2937', color: '#e5e7eb', border: '1px solid #3b82f6', borderRadius: 4, padding: '3px 6px', fontSize: 12, width: '100%', fontFamily: 'inherit' },
  inlineTextarea: { background: '#1f2937', color: '#e5e7eb', border: '1px solid #3b82f6', borderRadius: 4, padding: '6px 8px', fontSize: 12, width: '100%', fontFamily: 'inherit', resize: 'vertical' },
  btnAi: { background: '#312e81', color: '#c7d2fe', border: '1px solid #4f46e5', borderRadius: 4, padding: '3px 8px', fontSize: 11, cursor: 'pointer', marginTop: 4, marginRight: 4 },
  aiBadge: { fontSize: 10, color: '#a78bfa', marginLeft: 4 },

  aiSuggestBtn: { background: '#1f2937', color: '#a78bfa', border: '1px dashed #4f46e5', borderRadius: 6, padding: '8px 10px', fontSize: 12, cursor: 'pointer', marginTop: 4, textAlign: 'left' },

  riskList: { display: 'flex', flexDirection: 'column', gap: 6 },
  riskItem: { background: '#1c1917', border: '1px solid #292524', borderLeft: '3px solid #f59e0b', borderRadius: 4, padding: '6px 10px' },
  riskHead: { display: 'flex', alignItems: 'center', gap: 6 },
  riskName: { flex: 1, fontSize: 12 },
  riskMitigation: { marginTop: 4, fontSize: 11, color: '#9ca3af', paddingLeft: 18 },

  aiPanel: { padding: 8, display: 'flex', flexDirection: 'column', gap: 12 },
  aiSection: { display: 'flex', flexDirection: 'column', gap: 4 },
  aiSectionTitle: { fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 },
  aiCoachBox: { background: '#161922', border: '1px solid #1f2937', borderRadius: 6, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 },
  aiBriefText: { fontFamily: 'inherit', fontSize: 11, color: '#e5e7eb', whiteSpace: 'pre-wrap', margin: 0 },
  btnSecondarySm: { background: '#1f2937', color: '#9ca3af', border: '1px solid #374151', borderRadius: 4, padding: '3px 8px', fontSize: 11, cursor: 'pointer', alignSelf: 'flex-start' },

  liveData: { background: '#161922', border: '1px solid #1f2937', borderRadius: 6, padding: 8, display: 'flex', flexDirection: 'column', gap: 4 },
  liveDataRow: { display: 'flex', justifyContent: 'space-between', fontSize: 11 },
  liveDataLabel: { color: '#9ca3af' },
  liveDataValue: { fontWeight: 500 },

  aiActions: { display: 'flex', flexDirection: 'column', gap: 2 },
  btnGhost: { background: 'transparent', color: '#6b7280', border: 'none', textAlign: 'left', fontSize: 11, padding: '2px 0', cursor: 'not-allowed', fontFamily: 'inherit' },

  footer: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderTop: '1px solid #1f2937', fontSize: 11, color: '#9ca3af', overflowX: 'auto', whiteSpace: 'nowrap' },
  activityItem: { display: 'inline-flex', alignItems: 'center', gap: 4 },
  activitySep: { margin: '0 6px', color: '#374151' },
};
