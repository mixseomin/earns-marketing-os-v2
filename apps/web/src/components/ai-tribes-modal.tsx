'use client';

// AITribesModal — sinh tribe bằng AI dựa trên context CHÍNH dự án, cho
// operator review/sửa/tick rồi bulk-create. URL-synced qua ?m=ai-tribes
// (mở từ tribes-real-page). KHÔNG đóng khi click backdrop (tránh mất data).

import { useState, useTransition, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { suggestTribesForProject, type SuggestedTribe } from '@/lib/ai/tribe-suggest';
import { createTribe } from '@/lib/actions/tribes-crud';
import { TagsInput } from './tags-input';
import { Spinner } from './ui';

const fld: React.CSSProperties = { width: '100%', padding: '6px 8px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5, color: 'var(--fg-0)', fontSize: 13, outline: 'none' };
const lbl: React.CSSProperties = { fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, display: 'block' };

interface EditableTribe extends SuggestedTribe {
  _selected: boolean;
  _dupe: boolean;       // tên trùng tribe đã có
  _open: boolean;       // expand để sửa
}

export function AITribesModal({
  projectId, existingNames, onClose, onCreated,
}: {
  projectId: string;
  existingNames: string[];
  onClose: () => void;
  onCreated?: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<EditableTribe[]>([]);
  const [instruction, setInstruction] = useState('');
  const [saving, startSave] = useTransition();
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const lowerExisting = existingNames.map((n) => n.trim().toLowerCase());

  const run = useCallback(async (extra?: string) => {
    setLoading(true); setStarted(true); setError(null); setSaveMsg(null);
    try {
      const res = await suggestTribesForProject({ projectId, extraInstruction: extra });
      if (!res.ok || !res.tribes) {
        setError(res.error || 'AI lỗi không rõ');
        setItems([]);
      } else {
        setItems(res.tribes.map((t) => {
          const dupe = lowerExisting.includes(t.name.trim().toLowerCase());
          return { ...t, _selected: !dupe, _dupe: dupe, _open: false };
        }));
      }
    } catch (e) {
      setError(`Gọi AI thất bại: ${(e as Error).message || String(e)}`);
      setItems([]);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const patch = (i: number, p: Partial<EditableTribe>) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...p } : it)));

  const selectedCount = items.filter((t) => t._selected).length;

  const handleCreate = () => {
    const chosen = items.filter((t) => t._selected && t.name.trim());
    if (chosen.length === 0) return;
    startSave(async () => {
      let ok = 0; const errs: string[] = [];
      for (const t of chosen) {
        const r = await createTribe(projectId, {
          name: t.name.trim(),
          descText: t.descText,
          signal: t.signal,
          sentiment: t.sentiment,
          lifecycle: 'discovery',
          lexicon: t.lexicon,
          avoid: t.avoid,
          psychographic: t.psychographic,
        });
        if (r.ok) ok++; else errs.push(`${t.name}: ${r.error}`);
      }
      if (errs.length) {
        setSaveMsg(`Đã tạo ${ok}/${chosen.length}. Lỗi: ${errs.join(' · ')}`);
        router.refresh();
      } else {
        router.refresh();
        onCreated?.();
        onClose();
      }
    });
  };

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ width: 'min(820px, 100%)', maxWidth: 820 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div style={{ flex: 1 }}>
            <div className="id-line">✨ AI · TRIBE SUGGESTIONS</div>
            <h2>Gợi ý Tribes theo context dự án</h2>
            <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>
              AI suy nhóm khán giả từ one-liner / bio + community thật của dự án. Sửa thoải mái rồi tick để tạo.
            </div>
          </div>
          <button className="btn ghost" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Re-generate bar */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Chỉ dẫn thêm <span style={{ color: 'var(--fg-4)', textTransform: 'none' }}>// optional — vd "tập trung Gen-Z", "tách nhóm Vedic"</span></label>
              <input type="text" value={instruction} onChange={(e) => setInstruction(e.target.value)}
                     style={fld} placeholder="để trống = suy thuần từ context dự án"
                     autoComplete="off" data-1p-ignore data-lpignore="true" name="ai-tribe-hint" />
            </div>
            <button className="btn primary" disabled={loading || saving} onClick={() => run(instruction.trim() || undefined)}
                    title="Gọi AI sinh danh sách tribe (áp chỉ dẫn nếu có)">
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
              Bấm <strong style={{ color: 'var(--accent)' }}>▶ Tạo gợi ý</strong> để AI phân tích context dự án và đề xuất tribes.
            </div>
          )}

          {loading && !error && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}>
              <Spinner size="sm" /> <span style={{ marginLeft: 6 }}>AI đang phân tích context dự án…</span>
            </div>
          )}

          {!loading && !error && items.length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--fg-3)' }}>
                <span>{items.length} đề xuất · {selectedCount} đã chọn</span>
                <span style={{ flex: 1 }} />
                <button className="btn ghost" style={{ fontSize: 10, padding: '2px 8px' }}
                        onClick={() => setItems((p) => p.map((t) => ({ ...t, _selected: !t._dupe })))}>Chọn hết (trừ trùng)</button>
                <button className="btn ghost" style={{ fontSize: 10, padding: '2px 8px' }}
                        onClick={() => setItems((p) => p.map((t) => ({ ...t, _selected: false })))}>Bỏ hết</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {items.map((t, i) => (
                  <div key={i} style={{
                    border: `1px solid ${t._selected ? 'var(--accent-line)' : 'var(--line)'}`,
                    borderRadius: 6, background: t._selected ? 'var(--accent-soft)' : 'var(--bg-2)',
                    opacity: t._dupe && !t._selected ? 0.6 : 1,
                  }}>
                    {/* Header row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px' }}>
                      <input type="checkbox" checked={t._selected}
                             onChange={(e) => patch(i, { _selected: e.target.checked })}
                             style={{ cursor: 'pointer' }} title="Tick để tạo tribe này" />
                      <input type="text" value={t.name} onChange={(e) => patch(i, { name: e.target.value })}
                             style={{ ...fld, fontWeight: 600, padding: '4px 8px' }} />
                      {t._dupe && (
                        <span title="Tên trùng tribe đã có — sẽ lỗi nếu tạo"
                              style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(255,180,0,.15)', color: 'var(--warn)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>trùng</span>
                      )}
                      <span title="Sentiment" style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: t.sentiment > 0 ? 'var(--ok)' : t.sentiment < 0 ? 'var(--bad)' : 'var(--fg-3)', whiteSpace: 'nowrap' }}>
                        {t.sentiment > 0 ? '+' : ''}{t.sentiment}
                      </span>
                      <button className="btn ghost" style={{ fontSize: 10, padding: '2px 7px' }}
                              onClick={() => patch(i, { _open: !t._open })}
                              title={t._open ? 'Thu gọn' : 'Mở để sửa chi tiết'}>
                        {t._open ? '▾' : '▸'}
                      </button>
                    </div>

                    {!t._open ? (
                      <div style={{ padding: '0 10px 8px 34px', fontSize: 11.5, color: 'var(--fg-2)', lineHeight: 1.45 }}>
                        {t.descText || <em style={{ color: 'var(--fg-4)' }}>chưa có mô tả</em>}
                        {t.lexicon.length > 0 && (
                          <div style={{ marginTop: 3, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
                            lexicon: {t.lexicon.slice(0, 6).join(', ')}{t.lexicon.length > 6 ? '…' : ''}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ padding: '0 10px 10px 34px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div>
                          <label style={lbl}>Mô tả</label>
                          <textarea value={t.descText} onChange={(e) => patch(i, { descText: e.target.value })} rows={2}
                                    style={{ ...fld, fontFamily: 'var(--font-sans)', resize: 'vertical' }} />
                        </div>
                        <div>
                          <label style={lbl}>Signal <span style={{ color: 'var(--fg-4)', textTransform: 'none' }}>// vì sao đáng theo đuổi</span></label>
                          <textarea value={t.signal} onChange={(e) => patch(i, { signal: e.target.value })} rows={2}
                                    style={{ ...fld, fontFamily: 'var(--font-sans)', resize: 'vertical' }} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <div>
                            <label style={lbl}>Psychographic</label>
                            <input type="text" value={t.psychographic} onChange={(e) => patch(i, { psychographic: e.target.value })} style={fld} />
                          </div>
                          <div>
                            <label style={lbl}>Sentiment <span style={{ color: 'var(--fg-4)', textTransform: 'none' }}>{t.sentiment}</span></label>
                            <input type="range" min={-100} max={100} step={5} value={t.sentiment}
                                   onChange={(e) => patch(i, { sentiment: Number(e.target.value) })} style={{ width: '100%' }} />
                          </div>
                        </div>
                        <div>
                          <label style={lbl}>Lexicon <span style={{ color: 'var(--fg-4)', textTransform: 'none' }}>// từ nhóm dùng (giữ nguyên ngữ)</span></label>
                          <TagsInput value={t.lexicon} onChange={(v) => patch(i, { lexicon: v })} placeholder="natal chart, transit…" />
                        </div>
                        <div>
                          <label style={lbl}>Avoid <span style={{ color: 'var(--fg-4)', textTransform: 'none' }}>// từ/định kiến nhóm ghét</span></label>
                          <TagsInput value={t.avoid} onChange={(v) => patch(i, { avoid: v })} placeholder="fortune-telling, fake guru…" />
                        </div>
                      </div>
                    )}
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
          <div className="meta">{selectedCount} tribe sẽ được tạo (lifecycle = discovery)</div>
          <div className="modal-foot-actions">
            <button className="btn ghost" onClick={onClose} disabled={saving}>Đóng</button>
            <button className="btn primary" onClick={handleCreate}
                    disabled={saving || loading || selectedCount === 0}>
              {saving ? <><Spinner size="xs" /> Đang tạo</> : `➕ Thêm ${selectedCount} tribe đã chọn`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
