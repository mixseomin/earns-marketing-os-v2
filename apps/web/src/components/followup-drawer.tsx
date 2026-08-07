'use client';

// FollowupDrawer — click a 📌 pill on the plays calendar → view + advance a deferred-work item.
// Read: title · detail (context to resume) · dated progress log. Write: status (chờ/đang/xong/kẹt/bỏ),
// come-back date, append a progress note, delete. All go through the followups server actions.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Drawer } from '@/components/ui';
import { FOLLOWUP_META, FOLLOWUP_STATUS, type Followup } from '@/lib/followup-status';
import { updateFollowup, deleteFollowup } from '@/lib/actions/followups';

const lbl: React.CSSProperties = { display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-4)', marginBottom: 5, fontFamily: 'var(--font-mono)' };
const inp: React.CSSProperties = { padding: '6px 9px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--fg-1)', fontSize: 13 };
const miniBtn: React.CSSProperties = { padding: '6px 10px', borderRadius: 6, border: '1px solid var(--line)', background: 'transparent', color: 'var(--fg-3)', fontSize: 12, cursor: 'pointer' };

export function FollowupDrawer({ followup, projectLabel, onClose }: { followup: Followup; projectLabel?: string; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState('');
  const [due, setDue] = useState(followup.due ?? '');
  const [confirmDel, setConfirmDel] = useState(false);

  const f = followup;
  const meta = FOLLOWUP_META[f.status];
  const refresh = () => start(() => router.refresh());
  const patch = async (p: { status?: string; due?: string; note?: string }) => { await updateFollowup(f.id, p); refresh(); };

  return (
    <Drawer onClose={onClose} width={520}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>📌 FOLLOW-UP · {projectLabel ?? f.projectId}</div>
          <h2 style={{ margin: '4px 0 0', fontSize: 17, fontWeight: 700 }}>{f.title}</h2>
        </div>

        <div>
          <label style={lbl}>Trạng thái</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {FOLLOWUP_STATUS.map((s) => {
              const m = FOLLOWUP_META[s];
              const on = f.status === s;
              return (
                <button key={s} type="button" disabled={pending} onClick={() => patch({ status: s })}
                  style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${on ? m.color : 'var(--line)'}`,
                    background: on ? `color-mix(in srgb, ${m.color} 22%, transparent)` : 'transparent',
                    color: on ? m.color : 'var(--fg-3)' }}>{m.icon} {m.label}</button>
              );
            })}
          </div>
        </div>

        <div>
          <label style={lbl}>🗓 Ngày hẹn lại</label>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)}
              onBlur={() => { if (due !== (f.due ?? '')) patch({ due }); }} style={inp} />
            {due && <button type="button" onClick={() => { setDue(''); patch({ due: '' }); }} style={miniBtn}>xoá ngày</button>}
          </div>
        </div>

        {f.detail && (
          <div>
            <label style={lbl}>Chi tiết (để nối tiếp)</label>
            <div style={{ fontSize: 13, color: 'var(--fg-2)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{f.detail}</div>
          </div>
        )}

        {f.notes && (
          <div>
            <label style={lbl}>Nhật ký tiến độ</label>
            <pre style={{ margin: 0, fontSize: 12, color: 'var(--fg-3)', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', lineHeight: 1.6 }}>{f.notes}</pre>
          </div>
        )}

        <div>
          <label style={lbl}>Thêm ghi chú tiến độ</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="làm tới đâu / chặn ở đâu…"
              onKeyDown={(e) => { if (e.key === 'Enter' && note.trim()) { patch({ note }); setNote(''); } }}
              style={{ ...inp, flex: 1 }} />
            <button type="button" disabled={!note.trim() || pending} onClick={() => { patch({ note }); setNote(''); }} style={miniBtn}>ghi</button>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--fg-4)' }}>{meta.icon} {meta.label}{f.updated ? ` · sửa ${f.updated}` : ''}</span>
          <button type="button"
            onClick={async () => { if (!confirmDel) { setConfirmDel(true); return; } await deleteFollowup(f.id); onClose(); refresh(); }}
            style={{ ...miniBtn, color: '#ef4444', borderColor: '#ef444455' }}>{confirmDel ? 'Chắc chắn xoá?' : 'Xoá'}</button>
        </div>
      </div>
    </Drawer>
  );
}
