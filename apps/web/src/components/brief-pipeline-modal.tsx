'use client';

// BriefPipelineModal — pipeline bài cho 1 brief (account×habitat của 1
// dòng seeding): Cần chuẩn bị / Sẽ đăng / Đã đăng. In-place (KHÔNG
// navigate), mở từ Cockpit. Click 1 bài → mở brief editor tại chỗ.

import { useState, useEffect, useTransition } from 'react';
import { listBriefPipeline, markCardSeeded, type BriefPipeline, type PipelineCard, type PostedEntry } from '@/lib/actions/seeding';
import { PHASE_LABEL, PHASE_COLOR } from '@/lib/phase-plan';
import type { Phase } from '@/lib/phase-plan';
import { formatMeta, formatColors } from '@/lib/content-formats';
import { Spinner, EmptyState, FormatIcon, IconGlobe, IconCheck, IconGear, ModalHeader } from './ui';

const COL_LABEL: Record<string, string> = {
  backlog: 'Ý tưởng', needs: 'Chờ duyệt', production: 'Đang làm',
  escalated: 'Đang kẹt', strategic: 'Kế hoạch dài',
};

function phaseChip(p: string) {
  const ph = p as Phase;
  const color = PHASE_COLOR[ph] ?? 'var(--fg-4)';
  return (
    <span style={{ padding: '0 5px', fontSize: 8.5, fontFamily: 'var(--font-mono)', fontWeight: 700,
                   borderRadius: 3, textTransform: 'uppercase', background: color + '22',
                   color, border: `1px solid ${color}66` }}>
      {PHASE_LABEL[ph] ?? p}
    </span>
  );
}
function typeChip(ct: string | null, lang?: string) {
  const key = ct ?? 'text';
  const fm = formatMeta(key);
  const col = formatColors(key);
  return (
    <span title={fm.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 3,
          fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
          padding: '1px 6px', borderRadius: 3,
          background: col.bg, color: col.fg, border: `1px solid ${col.border}` }}>
      <FormatIcon kind={key} size={11} /> {fm.label}
      {lang ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: 'var(--fg-4)' }}>
        · <IconGlobe size={10} />{lang.toUpperCase()}</span> : null}
    </span>
  );
}

export function BriefPipelineModal({ projectId, briefId, onClose, onOpenPost }: {
  projectId: string;
  briefId: number;
  onClose: () => void;
  // Mở brief editor TẠI ĐÚNG bài (tab phase + bung card). cardId rỗng = mở chung.
  onOpenPost: (phase: string, cardId?: number) => void;
}) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [pl, setPl] = useState<BriefPipeline | null>(null);
  const [bump, setBump] = useState(0);
  const [marking, startMark] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    if (bump === 0) setState('loading');
    listBriefPipeline(projectId, briefId)
      .then((r) => {
        if (cancel) return;
        if (r.ok && r.pipeline) { setPl(r.pipeline); setState('ready'); }
        else setState('error');
      })
      .catch(() => { if (!cancel) setState('error'); });
    return () => { cancel = true; };
  }, [projectId, briefId, bump]);

  const markPosted = (c: PipelineCard) => startMark(async () => {
    const res = await markCardSeeded(projectId, briefId, c.id);
    if (res.ok) {
      const w = res.warnings && res.warnings.length ? ` ⚠ ${res.warnings.join(' · ')}` : '';
      setNote(`✓ Đã đánh dấu ${c.cardRef} đã đăng → "Đã đăng" + dời nhịp lane "${res.laneType}".${w}`);
      setBump((n) => n + 1);
    } else {
      setNote(`⛔ ${res.error ?? 'Không đánh dấu được'}`);
    }
  });

  const CardRow = (c: PipelineCard) => (
    <div key={c.id} onClick={() => onOpenPost(c.phase, c.id)}
         title="Mở đúng bài này trong brief editor (tab phase + bung card)"
         style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px', cursor: 'pointer',
                  background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5 }}>
      <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)', flexShrink: 0 }}>{c.cardRef}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--fg-0)', overflow: 'hidden',
                     textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title || '(chưa có tiêu đề)'}</span>
      {typeChip(c.contentType, c.targetLang)}
      <span title={c.complete ? 'Đã đủ data (nội dung + media)' : `Thiếu: ${c.missing.join(' + ')}`}
            style={{ flexShrink: 0, padding: '1px 7px', fontSize: 9, fontWeight: 700, borderRadius: 999,
                     color: c.complete ? 'var(--ok)' : 'var(--warn)',
                     background: c.complete ? 'rgba(74,222,128,.13)' : 'rgba(251,191,36,.13)',
                     border: `1px solid ${c.complete ? 'rgba(74,222,128,.45)' : 'rgba(251,191,36,.45)'}` }}>
        {c.complete ? '✓ đủ data' : `thiếu ${c.missing.join('+')}`}
      </span>
      {phaseChip(c.phase)}
      <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)', flexShrink: 0 }}
            title={`Cột board: ${COL_LABEL[c.col] ?? c.col}`}>{COL_LABEL[c.col] ?? c.col}</span>
      {c.dispatchReady && <span title="dispatch_ready" style={{ fontSize: 9, color: 'var(--ok)' }}>● ready</span>}
      <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)', flexShrink: 0 }}>
        {new Date(c.updatedAt).toLocaleDateString()}
      </span>
      <button className="btn primary" disabled={marking}
              onClick={(e) => { e.stopPropagation(); markPosted(c); }}
              title="Tôi vừa TỰ TAY đăng bài này lên cộng đồng → bấm để đánh dấu ĐÃ ĐĂNG (gắn đúng bài, dời nhịp lane khớp loại+ngôn ngữ). Đây là NÚT BẤM, không phải trạng thái."
              style={{ flexShrink: 0, fontSize: 10, padding: '4px 9px', fontWeight: 700,
                       display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <IconCheck size={11} /> Đánh dấu đã đăng
      </button>
    </div>
  );

  const PostedRow = (e: PostedEntry, i: number) => (
    <div key={i} onClick={e.cardId && !e.deleted ? () => onOpenPost(e.phase, e.cardId!) : undefined}
         style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px',
                  cursor: e.cardId && !e.deleted ? 'pointer' : 'default',
                  background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5,
                  borderLeft: '3px solid var(--ok)' }}>
      <span style={{ color: 'var(--ok)', flexShrink: 0, display: 'inline-flex' }}><IconCheck size={12} /></span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--fg-1)', overflow: 'hidden',
                     textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {e.deleted ? `card #${e.cardId} (đã xoá)` : (e.title || (e.cardId ? `card #${e.cardId}` : 'seed thủ công (không gắn card)'))}
      </span>
      {e.contentType && typeChip(e.contentType)}
      {e.phase && phaseChip(e.phase)}
      <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', flexShrink: 0 }}>
        {e.at ? new Date(e.at).toLocaleDateString() : '—'}
      </span>
    </div>
  );

  const Section = ({ title, accent, count, ready, children }: {
    title: string; accent: string; count: number; ready?: number; children: React.ReactNode;
  }) => (
    <div>
      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
                    letterSpacing: '.06em', color: accent, marginBottom: 6, display: 'flex',
                    alignItems: 'center', gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: 3, background: accent }} />{title}
        <span style={{ color: 'var(--fg-4)' }}>{count}</span>
        {ready != null && count > 0 && (
          <span style={{ textTransform: 'none', color: ready === count ? 'var(--ok)' : 'var(--warn)' }}>
            · {ready}/{count} đủ data
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{children}</div>
    </div>
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 'min(820px, 96vw)', maxWidth: 820 }} onClick={(e) => e.stopPropagation()}>
        <ModalHeader
          kind="pipeline"
          action="view"
          idText={`brief #${briefId}`}
          title={pl ? `@${pl.accountHandle} · ${pl.habitatName}` : 'Pipeline bài'}
          subtitle={pl
            ? `${pl.prep.length} cần chuẩn bị · ${pl.upcoming.length} sẽ đăng · ${pl.posted.length} đã đăng — click 1 bài để mở đúng bài đó`
            : 'Cần chuẩn bị / Sẽ đăng / Đã đăng'}
          onClose={onClose}
          onRefresh={() => setBump((b) => b + 1)}
        />

        <div className="modal-body" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {note && (
            <div style={{ padding: '7px 10px', fontSize: 11.5, borderRadius: 5,
                          background: 'var(--accent-soft)', border: '1px solid var(--accent-line)',
                          color: 'var(--accent)' }}>{note}</div>
          )}
          {state === 'loading' ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}>
              <Spinner size="sm" /> <span style={{ marginLeft: 6 }}>Đang tải…</span>
            </div>
          ) : state === 'error' || !pl ? (
            <div style={{ padding: 8, background: 'rgba(255,77,94,.1)', border: '1px solid rgba(255,77,94,.4)',
                          color: 'var(--bad)', fontSize: 12, borderRadius: 5 }}>⚠ Không tải được pipeline.</div>
          ) : (pl.prep.length + pl.upcoming.length + pl.posted.length === 0) ? (
            <EmptyState icon="📋" compact title="Chưa có bài nào"
              description="Dùng 📝+ nháp ở dòng (hoặc ▶ Sinh bài đến hạn) để tạo bài đầu tiên." />
          ) : (
            <>
              <Section title="Cần chuẩn bị" accent="var(--warn)" count={pl.prep.length}
                       ready={pl.prep.filter((c) => c.complete).length}>
                {pl.prep.length === 0
                  ? <span style={{ fontSize: 11, color: 'var(--fg-4)' }}>— không có nháp chờ chuẩn bị</span>
                  : pl.prep.map(CardRow)}
              </Section>
              <Section title="Sẽ đăng (đã sẵn sàng)" accent="var(--accent)" count={pl.upcoming.length}
                       ready={pl.upcoming.filter((c) => c.complete).length}>
                {pl.upcoming.length === 0
                  ? <span style={{ fontSize: 11, color: 'var(--fg-4)' }}>— chưa có bài nào sẵn sàng</span>
                  : pl.upcoming.map(CardRow)}
              </Section>
              <Section title="Đã đăng / đã seed" accent="var(--ok)" count={pl.posted.length}>
                {pl.posted.length === 0
                  ? <span style={{ fontSize: 11, color: 'var(--fg-4)' }}>— chưa seed lần nào</span>
                  : pl.posted.map(PostedRow)}
              </Section>
            </>
          )}
        </div>

        <div className="modal-foot">
          <div className="meta">
            {pl ? `${pl.prep.length} cần chuẩn bị · ${pl.upcoming.length} sẽ đăng · ${pl.posted.length} đã đăng` : ''}
          </div>
          <div className="modal-foot-actions">
            <button className="btn ghost" onClick={onClose}>Đóng</button>
            <button className="btn primary" onClick={() => onOpenPost('', undefined)}
                    title="Mở cấu hình brief (Overview: approach/cadence/phase) — KHÔNG phải để xem 1 bài"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <IconGear size={13} /> Cấu hình brief
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
