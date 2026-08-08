'use client';

// EmailSendPrep — the send-ready package for a 📧 email-issue task. Shows the REAL email in
// detail (from · subject A/B · preheader · body as the recipient sees it) plus the recipient
// list, the send time, and the offer link — all prepared before sending. Read-view by default
// (YDNI), one ✏️ to edit. Lazy-loads prep_payload.email. Standard across every email card.

import { useEffect, useState } from 'react';
import { getEmailPrep, saveEmailPrep, EMPTY_EMAIL_PREP, type EmailPrep } from '@/lib/actions/email-prep';
import { CampaignLinkPicker } from './campaign-link-picker';

const lbl: React.CSSProperties = { fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--fg-3)', marginBottom: 3 };
const field: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '5px 8px', background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 5, color: 'var(--fg-0)', fontSize: 12 };
const btn: React.CSSProperties = { padding: '3px 10px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5, color: 'var(--fg-1)', fontSize: 11, cursor: 'pointer' };
const meta: React.CSSProperties = { fontSize: 12, color: 'var(--fg-1)' };

function fmtSend(s: string): string {
  if (!s) return '— chưa đặt';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function EmailSendPrep({ taskId, defaultSendAt }: { taskId: number; defaultSendAt?: string | null }) {
  const [prep, setPrep] = useState<EmailPrep | null | undefined>(undefined); // undefined = loading
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EmailPrep>(EMPTY_EMAIL_PREP);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    getEmailPrep(taskId).then((p) => { if (live) setPrep(p); }).catch(() => { if (live) setPrep(null); });
    return () => { live = false; };
  }, [taskId]);

  const startEdit = () => {
    setDraft(prep ?? { ...EMPTY_EMAIL_PREP, sendAt: defaultSendAt ? `${defaultSendAt}T14:00` : '' });
    setEditing(true);
  };
  const save = async () => {
    setSaving(true);
    const r = await saveEmailPrep(taskId, draft);
    setSaving(false);
    if (r.ok) { setPrep(draft); setEditing(false); }
  };
  const set = (k: keyof EmailPrep) => (v: string) => setDraft((d) => ({ ...d, [k]: v }));

  const wrap: React.CSSProperties = { border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg-2)', padding: 12, marginTop: 8 };

  if (prep === undefined) return <div data-comp="ui.EmailSendPrep" style={{ ...wrap, color: 'var(--fg-3)', fontSize: 11 }}>đang tải gói gửi…</div>;

  return (
    <div data-comp="ui.EmailSendPrep" style={wrap}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>📧 Email thật — gói gửi</span>
        {prep && (
          <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 7px', borderRadius: 999, color: prep.status === 'ready' ? 'var(--ok,#22c55e)' : 'var(--neon-amber)', border: `1px solid ${prep.status === 'ready' ? 'var(--ok,#22c55e)' : 'var(--neon-amber)'}` }}>
            {prep.status === 'ready' ? '✓ sẵn sàng gửi' : '✎ draft'}
          </span>
        )}
        <span style={{ flex: 1 }} />
        {!editing && <button type="button" onClick={startEdit} style={btn}>{prep ? '✏️ Sửa' : '＋ Chuẩn bị'}</button>}
      </div>

      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}><div style={lbl}>From name</div><input value={draft.fromName} onChange={(e) => set('fromName')(e.target.value)} style={field} placeholder="MilitaryCalc" /></div>
            <div style={{ flex: 1 }}><div style={lbl}>From email</div><input value={draft.fromEmail} onChange={(e) => set('fromEmail')(e.target.value)} style={field} placeholder="news@militarycalc.com" /></div>
          </div>
          <div><div style={lbl}>Subject A</div><input value={draft.subject} onChange={(e) => set('subject')(e.target.value)} style={field} /></div>
          <div><div style={lbl}>Subject B (A/B, tuỳ chọn)</div><input value={draft.subjectB} onChange={(e) => set('subjectB')(e.target.value)} style={field} /></div>
          <div><div style={lbl}>Preheader (preview inbox)</div><input value={draft.preheader} onChange={(e) => set('preheader')(e.target.value)} style={field} /></div>
          <div><div style={lbl}>Body — email thật</div><textarea value={draft.bodyMd} onChange={(e) => set('bodyMd')(e.target.value)} rows={12} style={{ ...field, resize: 'vertical', fontFamily: 'var(--font-mono)', lineHeight: 1.5 }} /></div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ flex: 2, minWidth: 160 }}><div style={lbl}>Danh sách</div><input value={draft.listName} onChange={(e) => set('listName')(e.target.value)} style={field} placeholder="MilitaryCalc list" /></div>
            <div style={{ flex: 2, minWidth: 160 }}><div style={lbl}>Segment</div><input value={draft.segment} onChange={(e) => set('segment')(e.target.value)} style={field} placeholder="Engaged (opened ≤90d)" /></div>
            <div style={{ flex: 1, minWidth: 80 }}><div style={lbl}>Số gửi</div><input value={draft.recipientCount} onChange={(e) => set('recipientCount')(e.target.value)} style={field} placeholder="~800" /></div>
            <div style={{ flex: 1, minWidth: 80 }}><div style={lbl}>Tổng list</div><input value={draft.listTotal} onChange={(e) => set('listTotal')(e.target.value)} style={field} placeholder="11,028" /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 160 }}><div style={lbl}>Giờ gửi</div><input type="datetime-local" value={draft.sendAt} onChange={(e) => set('sendAt')(e.target.value)} style={{ ...field, colorScheme: 'dark' }} /></div>
            <div style={{ flex: 1, minWidth: 120 }}><div style={lbl}>Provider</div><input value={draft.provider} onChange={(e) => set('provider')(e.target.value)} style={field} placeholder="Mailjet" /></div>
            <div style={{ minWidth: 120 }}><div style={lbl}>Trạng thái</div>
              <select value={draft.status} onChange={(e) => set('status')(e.target.value)} style={field}>
                <option value="draft">draft</option>
                <option value="ready">sẵn sàng gửi</option>
              </select>
            </div>
          </div>
          <div><div style={lbl}>Offer / sản phẩm chèn</div>
            <CampaignLinkPicker value={draft.offerUrl} onChange={(v) => setDraft((d) => ({ ...d, offerUrl: v }))} />
            <input value={draft.offerLabel} onChange={(e) => set('offerLabel')(e.target.value)} style={{ ...field, marginTop: 5 }} placeholder="Nhãn offer (vd RemoveMe)" />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
            <button type="button" onClick={save} disabled={saving} style={{ ...btn, fontWeight: 700, color: 'var(--accent)', borderColor: 'var(--accent)' }}>{saving ? '…' : '💾 Lưu gói gửi'}</button>
            <button type="button" onClick={() => setEditing(false)} style={btn}>Huỷ</button>
          </div>
        </div>
      ) : !prep ? (
        <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>Chưa chuẩn bị. Bấm <b>＋ Chuẩn bị</b> để soạn email thật + danh sách + giờ gửi.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Inbox-style preview — as the recipient sees it */}
          <div style={{ border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg-1)', overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--line)' }}>
              <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>From: <span style={{ color: 'var(--fg-1)' }}>{prep.fromName || '—'} &lt;{prep.fromEmail || '—'}&gt;</span></div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--fg-0)', marginTop: 2 }}>{prep.subject || '(chưa có subject)'}</div>
              {prep.subjectB && <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 1 }}>A/B: {prep.subjectB}</div>}
              {prep.preheader && <div style={{ fontSize: 11.5, color: 'var(--fg-3)', marginTop: 2, fontStyle: 'italic' }}>{prep.preheader}</div>}
            </div>
            <div style={{ padding: '10px 12px', fontSize: 12.5, color: 'var(--fg-1)', whiteSpace: 'pre-wrap', lineHeight: 1.55, maxHeight: 300, overflowY: 'auto' }}>
              {prep.bodyMd || <span style={{ color: 'var(--fg-4)' }}>(chưa có nội dung)</span>}
            </div>
          </div>
          {/* Send meta */}
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '5px 10px', alignItems: 'baseline' }}>
            <span style={lbl}>👥 Danh sách</span>
            <span style={meta}>{prep.listName || '—'}{prep.segment ? ` · ${prep.segment}` : ''}{prep.recipientCount ? ` · ${prep.recipientCount}${prep.listTotal ? ` / ${prep.listTotal}` : ''}` : ''}</span>
            <span style={lbl}>🕐 Giờ gửi</span>
            <span style={meta}>{fmtSend(prep.sendAt)}{prep.provider ? ` · qua ${prep.provider}` : ''}</span>
            <span style={lbl}>🔗 Offer</span>
            <span style={meta}>{prep.offerLabel || prep.offerUrl
              ? <>{prep.offerLabel || 'link'}{prep.offerUrl ? <> → <a href={prep.offerUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>mở ↗</a></> : <span style={{ color: 'var(--neon-amber)' }}> · chưa có link (offer pending?)</span>}</>
              : <span style={{ color: 'var(--fg-4)' }}>—</span>}</span>
          </div>
        </div>
      )}
    </div>
  );
}
