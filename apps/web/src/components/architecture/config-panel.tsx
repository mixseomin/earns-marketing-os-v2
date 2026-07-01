'use client';

import { useState, useTransition } from 'react';
import type { SceneEvent } from '@/lib/scene-events';
import { saveSceneEvents } from '@/lib/actions/scene-events';

// CONFIG · Event taxonomy + bảng điểm familiarity. 1 nguồn (app_settings.scene_events) →
// backend recomputeFamiliarity + ext (_KIND_LABEL) cùng đọc → hết lệch điểm.
// 2 tầng: (1) chuẩn hoá event (kind/dir/toggle), (2) điểm. dir=theirs = reciprocation (họ engage lại).

const inp: React.CSSProperties = { background: 'var(--bg-0)', color: 'var(--fg-0)', border: '1px solid var(--line)', borderRadius: 5, padding: '3px 7px', fontFamily: 'var(--font-mono)', fontSize: 12, width: '100%', boxSizing: 'border-box' };
const th: React.CSSProperties = { textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-4)', padding: '4px 8px', fontWeight: 700, whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '4px 8px', verticalAlign: 'middle' };
const btn: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 12, padding: '5px 12px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--fg-1)', cursor: 'pointer' };

const NEW_EVENT: SceneEvent = { kind: '', label: '', emoji: '•', dir: 'ours', toggle: false, score: 10 };

export function ConfigPanel({ initial }: { initial: SceneEvent[] }) {
  const [rows, setRows] = useState<SceneEvent[]>(() => initial.map((e) => ({ ...e })));
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const patch = (i: number, k: keyof SceneEvent, v: unknown) => {
    setRows((r) => r.map((e, j) => (j === i ? { ...e, [k]: v } : e)));
    setDirty(true); setMsg(null);
  };
  const add = () => { setRows((r) => [...r, { ...NEW_EVENT }]); setDirty(true); setMsg(null); };
  const del = (i: number) => { setRows((r) => r.filter((_, j) => j !== i)); setDirty(true); setMsg(null); };

  const save = () => start(async () => {
    const res = await saveSceneEvents(rows);
    if (res.ok) { setDirty(false); setMsg({ ok: true, text: 'Đã lưu · backend + ext sẽ áp ngay lượt tính điểm kế' }); }
    else setMsg({ ok: false, text: res.error || 'Lưu lỗi' });
  });

  // preview: familiarity một người sau N event mẫu (giúp thấy trọng số áp thế nào)
  const theirs = rows.find((e) => e.dir === 'theirs')?.score ?? 0;

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: 'var(--fg-0)' }}>Event &amp; Scoring · familiarity</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-4)' }}>app_settings · scene_events</span>
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)', lineHeight: 1.55, marginBottom: 12 }}>
        Chuẩn hoá thao tác thành <b style={{ color: 'var(--fg-1)' }}>event</b> rồi tra <b style={{ color: 'var(--fg-1)' }}>điểm</b>. <b style={{ color: 'var(--accent)' }}>toggle</b> = có nghịch đảo (unfollow/unlike) → ext dùng state-sync on/off. <b style={{ color: 'var(--accent)' }}>dir=theirs</b> = họ engage lại mình (reciprocation, override mọi kind). Điểm cap 100 · warm ≥ 60. Sửa ở đây = backend + ext đọc chung, không hardcode.
      </div>

      <div style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: 'var(--bg-2)' }}>
            <tr>
              <th style={{ ...th, width: 42 }}>Emoji</th>
              <th style={{ ...th, width: 150 }}>Label</th>
              <th style={{ ...th, width: 120 }}>kind</th>
              <th style={{ ...th, width: 92 }}>Dir</th>
              <th style={{ ...th, width: 62, textAlign: 'center' }}>Toggle</th>
              <th style={{ ...th, width: 70 }}>Điểm</th>
              <th style={{ ...th, width: 30 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((e, i) => {
              const isDefault = e.kind === 'default';
              return (
                <tr key={i} style={{ borderTop: '1px solid var(--line)', background: e.dir === 'theirs' ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : undefined }}>
                  <td style={{ ...td, textAlign: 'center' }}><input value={e.emoji} onChange={(ev) => patch(i, 'emoji', ev.target.value)} style={{ ...inp, textAlign: 'center', padding: '3px 2px' }} /></td>
                  <td style={td}><input value={e.label} onChange={(ev) => patch(i, 'label', ev.target.value)} style={inp} /></td>
                  <td style={td}><input value={e.kind} disabled={isDefault} onChange={(ev) => patch(i, 'kind', ev.target.value)} title={isDefault ? 'fallback — không đổi kind' : ''} style={{ ...inp, opacity: isDefault ? 0.6 : 1 }} /></td>
                  <td style={td}>
                    <select value={e.dir} onChange={(ev) => patch(i, 'dir', ev.target.value)} style={inp}>
                      <option value="ours">ours</option>
                      <option value="theirs">theirs</option>
                    </select>
                  </td>
                  <td style={{ ...td, textAlign: 'center' }}><input type="checkbox" checked={e.toggle} onChange={(ev) => patch(i, 'toggle', ev.target.checked)} style={{ cursor: 'pointer', width: 15, height: 15 }} /></td>
                  <td style={td}><input type="number" min={0} max={100} value={e.score} onChange={(ev) => patch(i, 'score', Number(ev.target.value))} style={{ ...inp, textAlign: 'right' }} /></td>
                  <td style={{ ...td, textAlign: 'center' }}>{!isDefault && <button onClick={() => del(i)} title="Xoá" style={{ background: 'transparent', border: 0, color: 'var(--fg-4)', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>✕</button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
        <button onClick={add} style={btn}>+ Thêm event</button>
        <button onClick={save} disabled={pending || !dirty} style={{ ...btn, borderColor: dirty ? 'var(--accent)' : 'var(--line)', color: dirty ? 'var(--accent)' : 'var(--fg-3)', cursor: dirty && !pending ? 'pointer' : 'default' }}>{pending ? '⏳ đang lưu…' : dirty ? '💾 Lưu config' : '✓ Đã lưu'}</button>
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--fg-4)' }}>reciprocation (họ engage lại) = <b style={{ color: 'var(--accent)' }}>+{theirs}</b>/lần</span>
        {msg && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: msg.ok ? 'var(--ok)' : 'var(--bad)' }}>{msg.ok ? '✓ ' : '⚠ '}{msg.text}</span>}
      </div>
    </div>
  );
}
