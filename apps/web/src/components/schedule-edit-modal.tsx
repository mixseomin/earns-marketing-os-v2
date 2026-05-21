'use client';

// ScheduleEditModal — Lanes manager cho 1 brief (account×habitat). Mỗi
// brief có NHIỀU lane = (loại nội dung, ngôn ngữ) với tần suất + cadence
// riêng. Mở từ Cockpit / Tribes (?m=schedule&mId=<briefId>). KHÔNG đóng
// khi click backdrop (tránh mất chỉnh).

import { useState, useEffect, useTransition, useCallback } from 'react';
import {
  listBriefLanes, upsertSchedule, deleteSchedule,
  type BriefLanesView, type LaneRow,
} from '@/lib/actions/seeding';
import type { Phase } from '@/lib/phase-plan';
import { PHASES, PHASE_LABEL, PHASE_COLOR } from '@/lib/phase-plan';
import { allowedFormats, formatMeta } from '@/lib/content-formats';
import { Spinner, FormatIcon, IconGlobe, IconTrash, FormModal, fieldStyle, labelStyle } from './ui';

const SELECTABLE: Phase[] = (PHASES as readonly Phase[]).filter((p) => p !== 'paused');
const lbl = labelStyle;
// Mini-size field cho inline pickers trong lane row.
const fld: React.CSSProperties = { ...fieldStyle({ size: 'sm' }), width: undefined };

const LANGS: { v: string; l: string }[] = [
  { v: '', l: '(kế thừa habitat)' },
  { v: 'en', l: 'English' }, { v: 'vi', l: 'Tiếng Việt' }, { v: 'zh', l: '中文' },
  { v: 'ja', l: '日本語' }, { v: 'ko', l: '한국어' }, { v: 'fr', l: 'Français' },
  { v: 'es', l: 'Español' }, { v: 'de', l: 'Deutsch' }, { v: 'pt', l: 'Português' },
  { v: 'ru', l: 'Русский' }, { v: 'multi', l: 'Multi' },
];
function langLabel(v: string): string {
  return LANGS.find((x) => x.v === v)?.l ?? v.toUpperCase();
}
// Cho <option> (native select không render SVG được → giữ emoji).
function typeLabel(ct: string): string {
  return ct === 'mix' ? '🎲 Mix (xoay theo formatMix)' : `${formatMeta(ct).icon} ${formatMeta(ct).label}`;
}
// Cho JSX (render kèm <FormatIcon/>).
function typeLabelPlain(ct: string): string {
  return ct === 'mix' ? 'Mix (xoay theo formatMix)' : formatMeta(ct).label;
}

export function ScheduleEditModal({ projectId, briefId, onClose, onSaved }: {
  projectId: string;
  briefId: number;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<BriefLanesView | null>(null);
  const [busy, startBusy] = useTransition();

  const reload = useCallback(async () => {
    setError(null);
    try {
      const res = await listBriefLanes(projectId, briefId);
      if (!res.ok || !res.view) { setError(res.error || 'Không tải được lanes'); return; }
      setView(res.view);
    } catch (e) {
      setError(`Lỗi: ${(e as Error).message || String(e)}`);
    }
  }, [projectId, briefId]);

  useEffect(() => {
    let cancel = false;
    (async () => { setLoading(true); await reload(); if (!cancel) setLoading(false); })();
    return () => { cancel = true; };
  }, [reload]);

  const refresh = () => { startBusy(async () => { await reload(); onSaved?.(); }); };

  const fmtOptions = view
    ? ['mix', ...allowedFormats(view.platformKey, view.platformCategory).map((f) => f.key)]
    : ['mix'];

  return (
    <FormModal
      kind="lanes"
      action="edit"
      idText={`brief #${briefId}`}
      title={view ? `@${view.accountHandle} · ${view.habitatName}` : 'Lanes seeding'}
      subtitle={view
        ? <span>
            Lịch đăng theo loại nội dung × ngôn ngữ ·{' '}
            Phase <strong style={{ color: PHASE_COLOR[view.currentPhase] }}>{PHASE_LABEL[view.currentPhase]}</strong>
            {' · '}lang habitat <strong>{view.habitatLang}</strong>
            {' · '}{view.lanes.length} lane
          </span>
        : 'Lịch đăng theo loại nội dung × ngôn ngữ'}
      width={820}
      preventBackdropClose
      onClose={onClose}
    >
        <div className="modal-body" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}>
              <Spinner size="sm" /> <span style={{ marginLeft: 6 }}>Đang tải…</span>
            </div>
          ) : error ? (
            <div style={{ padding: 8, background: 'rgba(255,77,94,.1)', border: '1px solid rgba(255,77,94,.4)', color: 'var(--bad)', fontSize: 12, borderRadius: 5, whiteSpace: 'pre-wrap' }}>⚠ {error}</div>
          ) : view && (
            <>
              {view.lanes.length === 0 && (
                <div style={{ fontSize: 11.5, color: 'var(--fg-3)', padding: 10, background: 'var(--bg-2)',
                              border: '1px dashed var(--line)', borderRadius: 6 }}>
                  Chưa có lane nào. Thêm lane đầu tiên bên dưới — vd <strong>Mix</strong> (xoay theo platform) mỗi 3 ngày,
                  hoặc <strong>🎬 Video</strong> mỗi 14 ngày, <strong>🖼️ Ảnh</strong> mỗi 5 ngày…
                </div>
              )}
              {view.lanes.map((ln) => (
                <LaneCard key={ln.scheduleId} projectId={projectId} briefId={briefId}
                          lane={ln} onChanged={refresh} />
              ))}

              <AddLaneForm projectId={projectId} briefId={briefId}
                           fmtOptions={fmtOptions} habitatLang={view.habitatLang}
                           suggested={view.suggested}
                           existing={view.lanes}
                           onAdded={refresh} />
            </>
          )}
        </div>

        <div className="modal-foot">
          <div className="meta">{view ? `${view.lanes.length} lane · brief #${briefId}` : ''}</div>
          <div className="modal-foot-actions">
            <button className="btn ghost" onClick={onClose} disabled={busy}>Đóng</button>
          </div>
        </div>
    </FormModal>
  );
}

// 1 lane = 1 thẻ sửa tại chỗ (freq / phases / auto / pause) + xoá 2-bước.
function LaneCard({ projectId, briefId, lane, onChanged }: {
  projectId: string;
  briefId: number;
  lane: LaneRow;
  onChanged: () => void;
}) {
  const [freq, setFreq] = useState(lane.frequencyDays);
  const [phases, setPhases] = useState<Phase[]>(lane.activePhases);
  const [paused, setPaused] = useState(lane.paused);
  const [autoDraft, setAutoDraft] = useState(lane.autoDraft);
  const [confirmDel, setConfirmDel] = useState(false);
  const [saving, startSave] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const dirty = freq !== lane.frequencyDays || paused !== lane.paused
    || autoDraft !== lane.autoDraft
    || JSON.stringify([...phases].sort()) !== JSON.stringify([...lane.activePhases].sort());

  const togglePhase = (p: Phase) =>
    setPhases((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  const save = () => startSave(async () => {
    setErr(null);
    const res = await upsertSchedule(projectId, briefId, {
      scheduleId: lane.scheduleId, frequencyDays: freq, activePhases: phases, paused, autoDraft,
    });
    if (!res.ok) { setErr(res.error ?? 'Lưu thất bại'); return; }
    onChanged();
  });
  const del = () => {
    if (!confirmDel) { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 4000); return; }
    startSave(async () => { await deleteSchedule(projectId, lane.scheduleId); onChanged(); });
  };

  return (
    <div style={{ border: `1px solid ${paused ? 'var(--line)' : 'var(--accent-line)'}`, borderRadius: 7,
                  background: 'var(--bg-2)', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-0)',
                       display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <FormatIcon kind={lane.contentType} size={14} /> {typeLabelPlain(lane.contentType)}
        </span>
        <span style={{ padding: '0 6px', fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                       borderRadius: 3, background: 'var(--bg-3)', color: 'var(--fg-2)',
                       border: '1px solid var(--line)', display: 'inline-flex', alignItems: 'center', gap: 3 }}
              title="Ngôn ngữ lane (rỗng = kế thừa habitat)">
          <IconGlobe size={10} /> {lane.language ? langLabel(lane.language) : 'kế thừa'}
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)' }}>
          {lane.touches} seed{lane.lastSeededAt ? ` · ${new Date(lane.lastSeededAt).toLocaleDateString()}` : ' · chưa seed'}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <label style={lbl}>Tần suất // mỗi N ngày</label>
          <input type="number" min={1} max={90} value={freq}
                 onChange={(e) => setFreq(Math.max(1, Math.min(90, Number(e.target.value) || 1)))}
                 style={{ ...fld, width: 80 }} />
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--fg-4)', paddingBottom: 6 }}>
          ≈ {Math.round(30 / Math.max(1, freq))} bài/30d
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--fg-2)', cursor: 'pointer', paddingBottom: 4 }}>
          <input type="checkbox" checked={autoDraft} onChange={(e) => setAutoDraft(e.target.checked)} />
          auto-draft
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--fg-2)', cursor: 'pointer', paddingBottom: 4 }}>
          <input type="checkbox" checked={paused} onChange={(e) => setPaused(e.target.checked)} />
          tạm dừng
        </label>
      </div>

      <div>
        <label style={lbl}>Phase áp dụng // trống = mọi phase</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {SELECTABLE.map((p) => {
            const on = phases.includes(p);
            return (
              <span key={p} onClick={() => togglePhase(p)}
                    style={{ padding: '1px 7px', borderRadius: 4, fontSize: 10, cursor: 'pointer',
                             border: `1px solid ${on ? PHASE_COLOR[p] : 'var(--line)'}`,
                             background: on ? PHASE_COLOR[p] + '22' : 'transparent',
                             color: on ? PHASE_COLOR[p] : 'var(--fg-4)', fontWeight: on ? 700 : 400 }}>
                {on ? '✓ ' : ''}{PHASE_LABEL[p]}
              </span>
            );
          })}
        </div>
      </div>

      {err && <div style={{ fontSize: 11, color: 'var(--bad)' }}>⚠ {err}</div>}

      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button className="btn danger" onClick={del} disabled={saving}
                style={{ fontSize: 11, padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: 4,
                         ...(confirmDel ? { animation: 'pulseDanger 1s ease-in-out infinite' } : {}) }}>
          {confirmDel ? '⚠ Xoá thật?' : <><IconTrash size={12} /> Xoá lane</>}
        </button>
        <button className="btn primary" onClick={save} disabled={saving || !dirty}
                style={{ fontSize: 11, padding: '3px 10px' }}>
          {saving ? <><Spinner size="xs" /> Lưu</> : dirty ? 'Lưu lane' : 'Đã lưu'}
        </button>
      </div>
    </div>
  );
}

// Form thêm lane mới (loại + ngôn ngữ + tần suất). Chặn trùng (loại,lang).
function AddLaneForm({ projectId, briefId, fmtOptions, habitatLang, suggested, existing, onAdded }: {
  projectId: string;
  briefId: number;
  fmtOptions: string[];
  habitatLang: string;
  suggested: { frequencyDays: number; activePhases: Phase[] };
  existing: LaneRow[];
  onAdded: () => void;
}) {
  const [ct, setCt] = useState('mix');
  const [lang, setLang] = useState('');
  const [freq, setFreq] = useState(suggested.frequencyDays || 3);
  const [saving, startSave] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const dup = existing.some((l) => l.contentType === ct && l.language === lang);

  const add = () => startSave(async () => {
    setErr(null);
    if (dup) { setErr('Đã có lane (loại, ngôn ngữ) này.'); return; }
    const res = await upsertSchedule(projectId, briefId, {
      contentType: ct, language: lang, frequencyDays: freq,
      activePhases: suggested.activePhases, paused: false, autoDraft: true,
    });
    if (!res.ok) { setErr(res.error ?? 'Thêm thất bại'); return; }
    setCt('mix'); setLang(''); setFreq(suggested.frequencyDays || 3);
    onAdded();
  });

  return (
    <div style={{ border: '1px dashed var(--accent-line)', borderRadius: 7, padding: '8px 10px',
                  display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap', background: 'var(--accent-soft)' }}>
      <div>
        <label style={lbl}>Loại nội dung</label>
        <select value={ct} onChange={(e) => setCt(e.target.value)} style={{ ...fld, minWidth: 150 }}>
          {fmtOptions.map((k) => <option key={k} value={k}>{typeLabel(k)}</option>)}
        </select>
      </div>
      <div>
        <label style={lbl}>Ngôn ngữ</label>
        <select value={lang} onChange={(e) => setLang(e.target.value)} style={{ ...fld, minWidth: 130 }}>
          {LANGS.map((x) => (
            <option key={x.v} value={x.v}>{x.v === '' ? `kế thừa (${habitatLang})` : x.l}</option>
          ))}
        </select>
      </div>
      <div>
        <label style={lbl}>Mỗi N ngày</label>
        <input type="number" min={1} max={90} value={freq}
               onChange={(e) => setFreq(Math.max(1, Math.min(90, Number(e.target.value) || 1)))}
               style={{ ...fld, width: 76 }} />
      </div>
      <button className="btn primary" onClick={add} disabled={saving || dup}
              title={dup ? 'Đã có lane (loại, ngôn ngữ) này' : 'Thêm lane mới cho brief này'}
              style={{ fontSize: 12, padding: '6px 12px' }}>
        {saving ? <><Spinner size="xs" /> Thêm</> : '+ Thêm lane'}
      </button>
      {(err || dup) && <div style={{ fontSize: 11, color: 'var(--bad)', width: '100%' }}>⚠ {err || 'Đã có lane (loại, ngôn ngữ) này.'}</div>}
    </div>
  );
}
