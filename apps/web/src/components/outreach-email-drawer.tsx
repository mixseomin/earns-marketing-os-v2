'use client';

// The standard outreach EMAIL/FORM drawer body — extracted from outreach-page's EmailDrawer so it can
// be reused inside the multi-channel task drawer (one visual language, not a bespoke copy). Sender is a
// prop now (de-hardcoded from "Jake Miller <hello@militarycalc.com>") so it works for any project.
// OutreachEmailBody = embeddable panel (no shell); EmailDrawer = the /outreach shell wrapping it.
import { useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import type { OutreachProspect } from '@/lib/actions/outreach';
import { buildEmailForProspect } from '@/lib/outreach-template';
import { setProspectStatus, markFormSubmitted, updateProspectContact, updateProspectDraft } from '@/lib/actions/outreach-mutations';
import { sendProspectEmail } from '@/lib/actions/outreach-send';

export type Sender = { name: string; email: string };

const EXT = { target: '_blank', rel: 'noopener noreferrer', referrerPolicy: 'no-referrer' } as const;
const gmailUrl = (to: string, subject: string, body: string) => `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
const STATUS_META: Record<string, { label: string; color: string }> = {
  to_send: { label: 'To send', color: 'var(--fg-3)' }, sent: { label: 'Sent', color: 'var(--neon-cyan)' },
  followup_1: { label: 'Follow-up 1', color: 'var(--neon-amber)' }, followup_2: { label: 'Follow-up 2', color: 'var(--neon-amber)' },
  replied: { label: 'Replied', color: 'var(--neon-violet)' }, interested: { label: 'Interested', color: 'var(--neon-lime)' },
  embedded: { label: 'Embedded ★', color: 'var(--neon-lime)' }, declined: { label: 'Declined', color: 'var(--fg-3)' },
  bounced: { label: 'Bounced', color: 'var(--bad)' }, unreachable: { label: 'Unreachable', color: 'var(--bad)' }, no_response: { label: 'No response', color: 'var(--fg-3)' },
};
const meta = (s: string) => STATUS_META[s] || { label: s, color: 'var(--fg-2)' };
const ACTIVE = new Set(['sent', 'followup_1', 'followup_2']);
const SENDABLE = new Set(['to_send', 'sent', 'followup_1', 'followup_2']);

const btn: CSSProperties = { fontSize: 11, padding: '3px 9px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--fg-1)', cursor: 'pointer', whiteSpace: 'nowrap' };
const taStyle: CSSProperties = { width: '100%', fontSize: 12, fontFamily: 'var(--font-mono)', lineHeight: 1.5, padding: 10, borderRadius: 8, border: '1px solid var(--bg-3)', background: 'var(--bg-1)', color: 'var(--fg-1)', resize: 'vertical' };
const lbl: CSSProperties = { fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 3px' };
const inputStyle: CSSProperties = { width: '100%', padding: '6px 9px', fontSize: 13, borderRadius: 6, border: '1px solid var(--bg-3)', background: 'var(--bg-1)', color: 'var(--fg-0)', marginBottom: 8 };

// Shared style constants so sibling drawers (the multi-channel task drawer) match this one EXACTLY.
export const oStyles = { btn, lbl, taStyle, inputStyle };

export function Badge({ status }: { status: string }) {
  const m = meta(status);
  return <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 99, background: `color-mix(in srgb, ${m.color} 18%, transparent)`, color: m.color, fontWeight: 700, whiteSpace: 'nowrap' }}>{m.label}</span>;
}
export function ChannelTag({ email }: { email: string | null }) {
  const isForm = !email;
  return <span style={{ fontSize: 9, fontWeight: 700, padding: '0 5px', borderRadius: 99, background: isForm ? 'color-mix(in srgb, var(--neon-amber) 22%, transparent)' : 'color-mix(in srgb, var(--neon-cyan) 18%, transparent)', color: isForm ? 'var(--neon-amber)' : 'var(--neon-cyan)' }}>{isForm ? 'FORM' : 'EMAIL'}</span>;
}
function CopyField({ label, value }: { label: string; value: string }) {
  const [c, setC] = useState(false);
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '0 0 6px' }}>
      <div style={{ width: 70, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
      <div style={{ flex: 1, fontSize: 13, color: value ? 'var(--fg-0)' : 'var(--fg-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value || '— (optional, leave blank)'}</div>
      {value && <button style={btn} onClick={() => { navigator.clipboard?.writeText(value).then(() => { setC(true); setTimeout(() => setC(false), 1200); }).catch(() => {}); }}>{c ? '✓' : 'Copy'}</button>}
    </div>
  );
}

// Embeddable email/form panel. No outer shell, no owner-name header — the container supplies those.
export function OutreachEmailBody({ projectId, prospect: p, sender, pending, onAfterAction }: {
  projectId: string; prospect: OutreachProspect; sender: Sender; pending?: boolean; onAfterAction: () => void;
}) {
  const router = useRouter();
  const isFollowup = ACTIVE.has(p.status);
  const sendable = SENDABLE.has(p.status);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [didCopy, setDidCopy] = useState(false);
  const [savedDraft, setSavedDraft] = useState(false);
  const [send, setSend] = useState<'idle' | 'confirm' | 'sending' | 'sent' | 'error'>('idle');
  const [err, setErr] = useState('');
  const [formBusy, setFormBusy] = useState(false);
  const [cur, setCur] = useState({ email: p.email ?? '', contactUrl: p.contactUrl ?? '', website: p.website ?? '' });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(cur);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const copyLocal = (text: string) => { navigator.clipboard?.writeText(text).then(() => { setDidCopy(true); setTimeout(() => setDidCopy(false), 1500); }).catch(() => {}); };
  const saveDraft = async () => { await updateProspectDraft(projectId, p.id, { subject, body }); setSavedDraft(true); setTimeout(() => setSavedDraft(false), 1500); router.refresh(); };
  const resetTpl = () => { if (p.source === 'backlink') { setSubject(''); setBody(''); return; } const e = buildEmailForProspect({ agentName: p.agentName, base: p.base, status: p.status, source: p.source }); setSubject(e.subject); setBody(e.body); };
  useEffect(() => {
    const c = { email: p.email ?? '', contactUrl: p.contactUrl ?? '', website: p.website ?? '' };
    setCur(c); setDraft(c); setEditing(false); setSaveErr('');
    setSend('idle'); setErr(''); setFormBusy(false); setDidCopy(false); setSavedDraft(false);
    if (p.emailBody) { setSubject(p.emailSubject ?? ''); setBody(p.emailBody); }
    else if (p.source === 'backlink') { setSubject(p.emailSubject ?? ''); setBody(''); }
    else { const e = buildEmailForProspect({ agentName: p.agentName, base: p.base, status: p.status, source: p.source }); setSubject(e.subject); setBody(e.body); }
  }, [p.id, p.email, p.contactUrl, p.website, p.agentName, p.base, p.status, p.emailSubject, p.emailBody, p.source]);

  const isForm = !cur.email.trim();
  const formLink = (cur.contactUrl || cur.website || '').trim();
  const doSend = async () => { setSend('sending'); const res = await sendProspectEmail(projectId, p.id, { subject, body }); if (res.ok) { setSend('sent'); setTimeout(onAfterAction, 900); } else { setSend('error'); setErr(res.error || 'Send failed'); } };
  const doForm = async (kind: 'submitted' | 'unreachable') => { setFormBusy(true); if (kind === 'submitted') await markFormSubmitted(projectId, p.id); else await setProspectStatus(projectId, p.id, 'unreachable'); onAfterAction(); };
  const openEdit = () => { setDraft(cur); setSaveErr(''); setEditing(true); };
  const saveEdit = async () => { setSaving(true); setSaveErr(''); const res = await updateProspectContact(projectId, p.id, draft); setSaving(false); if (res.ok) { setCur(draft); setEditing(false); router.refresh(); } else setSaveErr(res.error || 'Save failed'); };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '2px 0 0' }}>
        {!editing && <button onClick={openEdit} style={{ ...btn, fontSize: 11 }} title="Fix the email / form link from what you found on their site">✎ Edit contact</button>}
      </div>

      {editing ? (
        <div style={{ margin: '10px 0 0' }}>
          <div style={lbl}>Fix contact (from what is actually on their site)</div>
          <div style={lbl}>Email</div>
          <input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="leave blank = form-only" autoComplete="off" style={inputStyle} />
          <div style={lbl}>Contact form URL</div>
          <input value={draft.contactUrl} onChange={(e) => setDraft({ ...draft, contactUrl: e.target.value })} placeholder="https://their-site.com/contact" autoComplete="off" style={inputStyle} />
          <div style={lbl}>Website</div>
          <input value={draft.website} onChange={(e) => setDraft({ ...draft, website: e.target.value })} placeholder="https://their-site.com" autoComplete="off" style={inputStyle} />
          {saveErr && <div style={{ fontSize: 12, color: 'var(--bad)', margin: '0 0 8px' }}>✗ {saveErr}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ ...btn, padding: '7px 14px', fontWeight: 700, borderColor: 'var(--neon-lime)', color: 'var(--neon-lime)' }} disabled={saving} onClick={saveEdit}>{saving ? 'Saving…' : 'Save'}</button>
            <button style={{ ...btn, padding: '7px 12px' }} disabled={saving} onClick={() => setEditing(false)}>Cancel</button>
          </div>
          <p style={{ color: 'var(--fg-3)', fontSize: 11, margin: '12px 0 0' }}>Add an <b>email</b> to upgrade a FORM prospect to EMAIL (then you can auto-send). <b>Website</b> is what the GA4 embed-detector matches on - keep it their real homepage.</p>
        </div>
      ) : isForm ? (
        <>
          <div style={{ margin: '14px 0 0' }}>
            <div style={lbl}>Submit via their contact form</div>
            {formLink ? <a href={formLink} {...EXT} style={{ ...btn, padding: '7px 12px', textDecoration: 'none', display: 'inline-block', borderColor: 'var(--neon-amber)', color: 'var(--neon-amber)', fontWeight: 700 }}>Open {hostOf(formLink)} form ↗</a> : <div style={{ fontSize: 13, color: 'var(--fg-3)' }}>No contact link on file.</div>}
            <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 6 }}>Opens with no referrer - their site won&apos;t see this tool. Contact forms usually have one message box and no subject, so paste the message below into it.</div>
          </div>
          <div style={{ margin: '14px 0 0' }}>
            <div style={lbl}>Form fields - copy each into the matching box on their form</div>
            <CopyField label="Name" value={sender.name} />
            <CopyField label="Email" value={sender.email} />
            <div style={{ ...lbl, marginTop: 6 }}>Message <span style={{ color: 'var(--fg-3)' }}>· editable</span></div>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} style={taStyle} />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '14px 0 0', alignItems: 'center' }}>
            <button style={{ ...btn, padding: '7px 12px' }} onClick={() => copyLocal(body)}>{didCopy ? '✓ Copied' : 'Copy message'}</button>
            <button style={{ ...btn, padding: '7px 12px' }} onClick={saveDraft} title="Save your edits without sending">{savedDraft ? '✓ Saved' : 'Save draft'}</button>
            <button style={{ ...btn, padding: '7px 12px' }} onClick={resetTpl} title="Regenerate from template (discards edits)">Reset</button>
            {sendable && (<>
              <button style={{ ...btn, padding: '7px 14px', fontWeight: 700, borderColor: 'var(--neon-lime)', color: 'var(--neon-lime)' }} disabled={formBusy} onClick={() => doForm('submitted')}>{formBusy ? 'Saving…' : '✓ Submitted the form'}</button>
              <button style={{ ...btn, padding: '7px 12px', borderColor: 'var(--bad)', color: 'var(--bad)' }} disabled={formBusy} onClick={() => doForm('unreachable')} title="Broken form, not a real form, captcha-blocked, or won't send">Can&apos;t send / form broken</button>
            </>)}
          </div>
        </>
      ) : (
        <>
          <div style={{ margin: '14px 0 0' }}>
            <div style={lbl}>From</div>
            <div style={{ fontSize: 13, color: 'var(--fg-1)' }}>{sender.name} &lt;{sender.email}&gt;</div>
            <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>Sent via Mailjet · replies land in your inbox</div>
          </div>
          <div style={{ margin: '12px 0 0' }}>
            <div style={lbl}>To</div>
            <div style={{ fontSize: 13, color: 'var(--fg-0)' }}>{cur.email}</div>
          </div>
          <div style={{ margin: '12px 0 0' }}>
            <div style={lbl}>Subject <span style={{ color: 'var(--fg-3)' }}>· editable</span>{isFollowup && <span style={{ color: 'var(--neon-amber)' }}> · follow-up</span>}</div>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} autoComplete="off" style={{ ...inputStyle, fontWeight: 600, marginBottom: 0 }} />
          </div>
          <div style={{ margin: '12px 0 0' }}>
            <div style={lbl}>Body <span style={{ color: 'var(--fg-3)' }}>· editable — fix the greeting/wording before sending</span></div>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={16} style={taStyle} />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '14px 0 0', alignItems: 'center' }}>
            {sendable && send === 'idle' && <button style={{ ...btn, padding: '7px 14px', fontSize: 13, fontWeight: 700, borderColor: 'var(--neon-lime)', color: 'var(--neon-lime)' }} disabled={pending} onClick={() => setSend('confirm')}>{isFollowup ? 'Send follow-up' : 'Send email'}</button>}
            {sendable && send === 'confirm' && (<>
              <button style={{ ...btn, padding: '7px 14px', fontSize: 13, fontWeight: 800, background: 'var(--neon-lime)', color: 'var(--bg-0)', borderColor: 'var(--neon-lime)' }} onClick={doSend}>Confirm: email {cur.email} now</button>
              <button style={{ ...btn, padding: '7px 12px' }} onClick={() => setSend('idle')}>Cancel</button>
            </>)}
            {send === 'sending' && <span style={{ fontSize: 13, color: 'var(--fg-2)' }}>Sending…</span>}
            {send === 'sent' && <span style={{ fontSize: 13, color: 'var(--neon-lime)', fontWeight: 700 }}>✓ Sent</span>}
            {send === 'error' && <span style={{ fontSize: 12, color: 'var(--bad)' }}>✗ {err}</span>}
            {send !== 'sending' && send !== 'sent' && (<>
              <button style={{ ...btn, padding: '7px 12px' }} onClick={() => copyLocal(`Subject: ${subject}\n\n${body}`)}>{didCopy ? '✓ Copied' : 'Copy email'}</button>
              <a href={gmailUrl(cur.email, subject, body)} {...EXT} style={{ ...btn, padding: '7px 12px', textDecoration: 'none', display: 'inline-block' }}>Open in Gmail ↗</a>
              <button style={{ ...btn, padding: '7px 12px' }} onClick={saveDraft} title="Save your edits without sending">{savedDraft ? '✓ Saved' : 'Save draft'}</button>
              <button style={{ ...btn, padding: '7px 12px' }} onClick={resetTpl} title="Regenerate from template (discards edits)">Reset</button>
            </>)}
          </div>
          <p style={{ color: 'var(--fg-3)', fontSize: 11, margin: '12px 0 0' }}>Send goes out through Mailjet from {sender.email} (replies come to your inbox) and advances the pipeline. Or open it prefilled in Gmail to send by hand.</p>
        </>
      )}
    </>
  );
}

// Full /outreach shell (fixed-inset slide-over) wrapping the body. Kept so the outreach page is unchanged.
export function EmailDrawer({ projectId, prospect: p, sender, pending, onClose, onAfterAction }: {
  projectId: string; prospect: OutreachProspect; sender: Sender; pending: boolean; onClose: () => void; onAfterAction: () => void;
}) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 60, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(560px, 96vw)', height: '100%', background: 'var(--bg-0)', borderLeft: '1px solid var(--bg-3)', overflowY: 'auto', padding: 18, boxShadow: '-8px 0 24px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{p.agentName}</div>
            <div style={{ color: 'var(--fg-3)', fontSize: 12, display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
              <span>{p.base || '—'}</span><ChannelTag email={p.email || null} /><Badge status={p.status} />
            </div>
          </div>
          <button onClick={onClose} style={{ ...btn, fontSize: 14, padding: '2px 9px' }}>✕</button>
        </div>
        <OutreachEmailBody projectId={projectId} prospect={p} sender={sender} pending={pending} onAfterAction={onAfterAction} />
      </div>
    </div>
  );
}
