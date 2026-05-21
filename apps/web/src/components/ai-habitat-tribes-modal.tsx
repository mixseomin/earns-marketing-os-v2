'use client';

// AIHabitatTribesModal — AI phân loại habitat vào tribe (M2M: 1 habitat
// có thể thuộc NHIỀU tribe, 1 cái là primary). Operator review/sửa từng
// dòng rồi bulk-apply. URL-synced ?m=ai-habitat-tribes. KHÔNG đóng khi
// click backdrop (tránh mất review).

import { useState, useTransition, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { suggestHabitatTribes, type HabitatTribeSuggestion } from '@/lib/ai/habitat-tribe-suggest';
import { bulkAssignHabitatTribe } from '@/lib/actions/tribes-crud';
import type { TribeRow } from '@/lib/data';
import { Spinner, Segmented } from './ui';

const fld: React.CSSProperties = { padding: '4px 6px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5, color: 'var(--fg-0)', fontSize: 12, outline: 'none' };
const lbl: React.CSSProperties = { fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, display: 'block' };

interface Row extends HabitatTribeSuggestion {
  _selected: boolean;
  _tribeIds: number[];          // toàn bộ tribe đã chọn
  _primaryId: number | null;    // tribe trội (phải nằm trong _tribeIds)
}

function confColor(c: number) {
  return c >= 70 ? 'var(--ok)' : c >= 40 ? 'var(--warn)' : 'var(--bad)';
}

export function AIHabitatTribesModal({
  projectId, tribes, onClose, onAssigned,
}: {
  projectId: string;
  tribes: TribeRow[];
  onClose: () => void;
  onAssigned?: () => void;
}) {
  const router = useRouter();
  const options = tribes.filter((t) => t.lifecycle !== 'defunct');
  const [scope, setScope] = useState<'needs-fix' | 'all'>('needs-fix');
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [instruction, setInstruction] = useState('');
  const [saving, startSave] = useTransition();
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const run = useCallback(async (sc: 'needs-fix' | 'all', extra?: string) => {
    setLoading(true); setStarted(true); setError(null); setSaveMsg(null);
    try {
      const res = await suggestHabitatTribes({ projectId, scope: sc, extraInstruction: extra });
      if (!res.ok || !res.suggestions) {
        setError(res.error || 'AI lỗi không rõ'); setRows([]);
      } else {
        setRows(res.suggestions.map((s) => {
          const ids = [s.primaryTribeId, ...s.alsoTribeIds].filter((x): x is number => x != null);
          return {
            ...s,
            _tribeIds: ids,
            _primaryId: s.primaryTribeId,
            // tick sẵn khi có gợi ý VÀ primary khác tribe hiện tại
            _selected: s.primaryTribeId != null && s.primaryTribeId !== s.currentTribeId,
          };
        }));
      }
    } catch (e) {
      setError(`Gọi AI thất bại: ${(e as Error).message || String(e)}`);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const patch = (i: number, p: Partial<Row>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...p } : r)));

  // toggle membership của 1 tribe trong dòng i
  const toggleTribe = (i: number, tid: number) => {
    setRows((prev) => prev.map((r, idx) => {
      if (idx !== i) return r;
      const has = r._tribeIds.includes(tid);
      let ids = has ? r._tribeIds.filter((x) => x !== tid) : [...r._tribeIds, tid];
      let primary = r._primaryId;
      if (has && primary === tid) primary = ids[0] ?? null;       // bỏ primary → primary kế tiếp
      if (!has && primary == null) primary = tid;                  // tribe đầu → primary
      return { ...r, _tribeIds: ids, _primaryId: primary, _selected: r._selected && ids.length > 0 };
    }));
  };
  const setPrimary = (i: number, tid: number) =>
    setRows((prev) => prev.map((r, idx) => idx === i
      ? { ...r, _primaryId: tid, _tribeIds: r._tribeIds.includes(tid) ? r._tribeIds : [...r._tribeIds, tid] }
      : r));

  const selected = rows.filter((r) => r._selected && r._tribeIds.length > 0);

  const apply = () => {
    if (selected.length === 0) return;
    startSave(async () => {
      const res = await bulkAssignHabitatTribe(
        projectId,
        selected.map((r) => ({
          habitatId: r.habitatId,
          tribeIds: r._tribeIds,
          primaryTribeId: r._primaryId,
        })),
      );
      if (!res.ok) { setSaveMsg(res.error || 'Lỗi khi gán'); return; }
      router.refresh();
      onAssigned?.();
      onClose();
    });
  };

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ width: 'min(1000px, 100%)', maxWidth: 1000 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div style={{ flex: 1 }}>
            <div className="id-line">✨ AI · HABITAT → TRIBES</div>
            <h2>Gán habitat vào tribe (nhiều tribe / 1 primary)</h2>
            <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>
              1 community có thể thuộc nhiều tribe. ★ = tribe trội (primary, đồng bộ vào habitat.tribe_id). Click chip để bật/tắt, click ★ để đổi primary.
            </div>
          </div>
          <button className="btn ghost" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label style={lbl}>Phạm vi</label>
              <Segmented
                options={[
                  { value: 'needs-fix', label: 'Cần sửa', title: 'Habitat chưa gắn tribe hoặc đang gắn tribe defunct' },
                  { value: 'all', label: 'Tất cả', title: 'Mọi habitat của dự án' },
                ]}
                value={scope}
                onChange={(v) => setScope(v as 'needs-fix' | 'all')}
              />
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <label style={lbl}>Chỉ dẫn thêm <span style={{ color: 'var(--fg-4)', textTransform: 'none' }}>// optional</span></label>
              <input type="text" value={instruction} onChange={(e) => setInstruction(e.target.value)}
                     style={{ ...fld, width: '100%' }} placeholder='vd "forum học thuật ưu tiên natal-chart-students"'
                     autoComplete="off" data-1p-ignore data-lpignore="true" name="ai-hab-hint" />
            </div>
            <button className="btn primary" disabled={loading || saving} onClick={() => run(scope, instruction.trim() || undefined)}
                    title="Gọi AI phân loại habitat vào tribe">
              {loading ? <><Spinner size="xs" /> Đang nghĩ</> : started ? '🔄 Tạo lại' : '▶ Tạo gợi ý'}
            </button>
          </div>

          {error && (
            <div style={{ padding: 8, background: 'rgba(255,77,94,.1)', border: '1px solid rgba(255,77,94,.4)', color: 'var(--bad)', fontSize: 12, borderRadius: 5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              ⚠ {error}
            </div>
          )}

          {!started && !loading && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12, border: '1px dashed var(--line)', borderRadius: 6 }}>
              Chọn phạm vi rồi bấm <strong style={{ color: 'var(--accent)' }}>▶ Tạo gợi ý</strong> để AI phân loại habitat vào tribe.
            </div>
          )}

          {loading && !error && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}>
              <Spinner size="sm" /> <span style={{ marginLeft: 6 }}>AI đang phân loại habitat…</span>
            </div>
          )}

          {!loading && !error && rows.length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--fg-3)' }}>
                <span>{rows.length} habitat · {selected.length} sẽ áp dụng</span>
                <span style={{ flex: 1 }} />
                <button className="btn ghost" style={{ fontSize: 10, padding: '2px 8px' }}
                        onClick={() => setRows((p) => p.map((r) => ({ ...r, _selected: r._tribeIds.length > 0 })))}>Chọn hết</button>
                <button className="btn ghost" style={{ fontSize: 10, padding: '2px 8px' }}
                        onClick={() => setRows((p) => p.map((r) => ({ ...r, _selected: false })))}>Bỏ hết</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {rows.map((r, i) => (
                  <div key={r.habitatId}
                       style={{ padding: '7px 9px', borderRadius: 6,
                                background: r._selected ? 'var(--accent-soft)' : 'var(--bg-2)',
                                border: `1px solid ${r._selected ? 'var(--accent-line)' : 'var(--line)'}` }}>
                    {/* Top: checkbox + habitat + current + conf */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="checkbox" checked={r._selected}
                             disabled={r._tribeIds.length === 0}
                             onChange={(e) => patch(i, { _selected: e.target.checked })}
                             style={{ cursor: 'pointer' }} title="Tick để áp dụng dòng này" />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ fontSize: 12, color: 'var(--fg-0)' }}>{r.habitatName}</span>
                        <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)', marginLeft: 6 }}>{r.habitatKind}</span>
                      </div>
                      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)',
                                     color: r.currentTribeDefunct ? 'var(--warn)' : 'var(--fg-3)' }}
                            title="Tribe primary hiện tại">
                        {r.currentTribeName ? `hiện: ${r.currentTribeName}${r.currentTribeDefunct ? ' (defunct)' : ''}` : 'chưa gắn'}
                      </span>
                      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: confColor(r.confidence) }}
                            title={`Độ chắc chắn ${r.confidence}%`}>
                        {r.confidence}
                      </span>
                    </div>

                    {/* reason */}
                    {r.reason && (
                      <div style={{ fontSize: 10.5, color: 'var(--fg-3)', margin: '3px 0 5px 24px' }}>{r.reason}</div>
                    )}

                    {/* tribe chips: click = toggle, ★ = set primary */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginLeft: 24 }}>
                      {options.map((t) => {
                        const on = r._tribeIds.includes(t.id);
                        const isPrim = on && r._primaryId === t.id;
                        return (
                          <span key={t.id}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4,
                                         padding: '2px 7px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
                                         border: `1px solid ${on ? 'var(--accent-line)' : 'var(--line)'}`,
                                         background: on ? 'var(--accent-soft)' : 'transparent',
                                         color: on ? 'var(--accent)' : 'var(--fg-3)' }}>
                            {on && (
                              <button type="button" title={isPrim ? 'Đang là primary' : 'Đặt làm primary'}
                                      onClick={(e) => { e.stopPropagation(); setPrimary(i, t.id); }}
                                      style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0,
                                               fontSize: 11, color: isPrim ? 'var(--warn)' : 'var(--fg-4)' }}>
                                {isPrim ? '★' : '☆'}
                              </button>
                            )}
                            <span onClick={() => toggleTribe(i, t.id)}>{t.name}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {saveMsg && (
            <div style={{ padding: 8, background: 'rgba(255,180,0,.1)', border: '1px solid rgba(255,180,0,.4)', color: 'var(--warn)', fontSize: 12, borderRadius: 5 }}>
              {saveMsg}
            </div>
          )}
        </div>

        <div className="modal-foot">
          <div className="meta">
            {selected.length} habitat sẽ được gán
            {selected.length > 0 && ` · primary: ${selected.filter((r) => r._primaryId != null).length}/${selected.length}`}
          </div>
          <div className="modal-foot-actions">
            <button className="btn ghost" onClick={onClose} disabled={saving}>Đóng</button>
            <button className="btn primary" onClick={apply} disabled={saving || loading || selected.length === 0}>
              {saving ? <><Spinner size="xs" /> Đang gán</> : `✏️ Gán ${selected.length} habitat`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
