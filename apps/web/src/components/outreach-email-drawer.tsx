'use client';

// The standard outreach EMAIL/FORM drawer body — extracted from outreach-page's EmailDrawer so it can
// be reused inside the multi-channel task drawer (one visual language, not a bespoke copy). Sender is a
// prop now (de-hardcoded from "Jake Miller <hello@militarycalc.com>") so it works for any project.
// OutreachEmailBody = embeddable panel (no shell); EmailDrawer = the /outreach shell wrapping it.
import { useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import type { OutreachProspect } from '@/lib/actions/outreach';
import { buildEmailForProspect } from '@/lib/outreach-template';
import { setProspectStatus, markFormSubmitted, updateProspectContact, updateProspectDraft, genProspectEmail } from '@/lib/actions/outreach-mutations';
import { sendProspectEmail } from '@/lib/actions/outreach-send';
import { GuardedButton } from '@/components/ui/guarded-button';

export type Sender = { name: string; email: string };

const EXT = { target: '_blank', rel: 'noopener noreferrer', referrerPolicy: 'no-referrer' } as const;
const gmailUrl = (to: string, subject: string, body: string) => `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
const STATUS_META: Record<string, { label: string; color: string }> = {
  to_send: { label: 'Chưa gửi', color: 'var(--fg-3)' }, sent: { label: 'Đã gửi', color: 'var(--neon-cyan)' },
  followup_1: { label: 'Nhắc 1', color: 'var(--neon-amber)' }, followup_2: { label: 'Nhắc 2', color: 'var(--neon-amber)' },
  replied: { label: 'Đã hồi', color: 'var(--neon-violet)' }, interested: { label: 'Quan tâm', color: 'var(--neon-lime)' },
  embedded: { label: 'Đã gắn ★', color: 'var(--neon-lime)' }, declined: { label: 'Từ chối', color: 'var(--fg-3)' },
  bounced: { label: 'Bị trả', color: 'var(--bad)' }, unreachable: { label: 'Ko liên hệ', color: 'var(--bad)' }, no_response: { label: 'Ko hồi', color: 'var(--fg-3)' },
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
      <div style={{ flex: 1, fontSize: 13, color: value ? 'var(--fg-0)' : 'var(--fg-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value || '— (tuỳ chọn)'}</div>
      {value && <button style={btn} onClick={() => { navigator.clipboard?.writeText(value).then(() => { setC(true); setTimeout(() => setC(false), 1200); }).catch(() => {}); }}>{c ? '✓' : 'Copy'}</button>}
    </div>
  );
}

// The legacy hardcoded template is MilitaryCalc-specific (BAH widget pitch). Every OTHER project
// generates its own copy via ✨ Sinh (genProspectEmail — product + Content Pillar). So we only seed
// the old template for militarycalc; elsewhere the body starts blank and the operator hits ✨ Sinh.
const LEGACY_TPL_PROJECT = 'militarycalc';

// Embeddable email/form panel. No outer shell, no owner-name header — the container supplies those.
// `mode` (optional) forces the email vs form view; when omitted it auto-detects from whether an email
// address exists (the /outreach page relies on that). The multi-channel drawer passes it explicitly so
// the Email and Contact-form channel pills each render their own view.
export function OutreachEmailBody({ projectId, prospect: p, sender, pending, mode, onAfterAction }: {
  projectId: string; prospect: OutreachProspect; sender: Sender; pending?: boolean; mode?: 'email' | 'form'; onAfterAction: () => void;
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
  const [gening, setGening] = useState(false);
  const [genErr, setGenErr] = useState('');
  const [emailSaved, setEmailSaved] = useState(false);   // ambient: flash the "Tới" border after silent auto-save (§36)
  const copyLocal = (text: string) => { navigator.clipboard?.writeText(text).then(() => { setDidCopy(true); setTimeout(() => setDidCopy(false), 1500); }).catch(() => {}); };
  const saveDraft = async () => { await updateProspectDraft(projectId, p.id, { subject, body }); setSavedDraft(true); setTimeout(() => setSavedDraft(false), 1500); router.refresh(); };
  // ponytail: only militarycalc keeps its hardcoded BAH template; every other project starts blank and
  // generates per-project copy via ✨ Sinh (genProspectEmail). Never seed MilitaryCalc copy elsewhere.
  const projectTpl = () => (projectId === LEGACY_TPL_PROJECT && p.source !== 'backlink')
    ? buildEmailForProspect({ agentName: p.agentName, base: p.base, status: p.status, source: p.source })
    : { subject: p.emailSubject ?? '', body: '' };
  const resetTpl = () => { const e = projectTpl(); setSubject(e.subject); setBody(e.body); };
  const genEmail = async () => { setGening(true); setGenErr(''); const res = await genProspectEmail(projectId, p.id); setGening(false); if (res.ok) { setSubject(res.subject || ''); setBody(res.body || ''); router.refresh(); } else setGenErr(res.error || 'gen lỗi'); };
  useEffect(() => {
    const c = { email: p.email ?? '', contactUrl: p.contactUrl ?? '', website: p.website ?? '' };
    setCur(c); setDraft(c); setEditing(false); setSaveErr('');
    setSend('idle'); setErr(''); setFormBusy(false); setDidCopy(false); setSavedDraft(false);
    setGenErr('');
    if (p.emailBody) { setSubject(p.emailSubject ?? ''); setBody(p.emailBody); }
    else { const e = projectTpl(); setSubject(e.subject); setBody(e.body); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.id, p.email, p.contactUrl, p.website, p.agentName, p.base, p.status, p.emailSubject, p.emailBody, p.source, projectId]);

  // `mode` (from the channel pill) wins; else fall back to auto-detect for the standalone /outreach drawer.
  const isForm = mode ? mode === 'form' : !cur.email.trim();
  const formLink = (cur.contactUrl || cur.website || '').trim();
  const doSend = async () => { setSend('sending'); const res = await sendProspectEmail(projectId, p.id, { subject, body }); if (res.ok) { setSend('sent'); setTimeout(onAfterAction, 900); } else { setSend('error'); setErr(res.error || 'Send failed'); } };
  const doForm = async (kind: 'submitted' | 'unreachable') => { setFormBusy(true); if (kind === 'submitted') await markFormSubmitted(projectId, p.id); else await setProspectStatus(projectId, p.id, 'unreachable'); onAfterAction(); };
  const openEdit = () => { setDraft(cur); setSaveErr(''); setEditing(true); };
  const saveEdit = async () => { setSaving(true); setSaveErr(''); const res = await updateProspectContact(projectId, p.id, draft); setSaving(false); if (res.ok) { setCur(draft); setEditing(false); router.refresh(); } else setSaveErr(res.error || 'Save failed'); };
  // Inline email edit from the email view's "Tới" field — fill/correct the address without opening the
  // full contact editor (YDNI: the address IS the essential of email compose, not a hidden sub-form).
  const saveEmail = async () => { setSaveErr(''); if (cur.email.trim() === (p.email ?? '')) return; const res = await updateProspectContact(projectId, p.id, cur); if (res.ok) { setEmailSaved(true); setTimeout(() => setEmailSaved(false), 800); router.refresh(); } else setSaveErr(res.error || 'Save failed'); };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '2px 0 0' }}>
        {!editing && (isForm
          ? <button onClick={openEdit} style={{ ...btn, fontSize: 11, fontWeight: 700, borderColor: 'var(--neon-cyan)', color: 'var(--neon-cyan)' }} title="Thêm địa chỉ email của họ → nâng FORM lên EMAIL → gửi tự động qua Mailjet">✉️ Thêm email → gửi tự động</button>
          : <button onClick={openEdit} style={{ ...btn, fontSize: 11 }} title="Sửa email / link form theo đúng thông tin trên trang của họ">✎ Sửa liên hệ</button>)}
      </div>

      {editing ? (
        <div style={{ margin: '10px 0 0' }}>
          <div style={lbl}>Sửa liên hệ (theo đúng trang của họ)</div>
          <div style={lbl}>Email</div>
          <input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="để trống = chỉ dùng form" autoComplete="off" style={inputStyle} />
          <div style={lbl}>URL form liên hệ</div>
          <input value={draft.contactUrl} onChange={(e) => setDraft({ ...draft, contactUrl: e.target.value })} placeholder="https://trang-cua-ho.com/contact" autoComplete="off" style={inputStyle} />
          <div style={lbl}>Website</div>
          <input value={draft.website} onChange={(e) => setDraft({ ...draft, website: e.target.value })} placeholder="https://trang-cua-ho.com" autoComplete="off" style={inputStyle} />
          {saveErr && <div style={{ fontSize: 12, color: 'var(--bad)', margin: '0 0 8px' }}>✗ {saveErr}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ ...btn, padding: '7px 14px', fontWeight: 700, borderColor: 'var(--neon-lime)', color: 'var(--neon-lime)' }} disabled={saving} onClick={saveEdit}>{saving ? 'Đang lưu…' : 'Lưu'}</button>
            <button style={{ ...btn, padding: '7px 12px' }} disabled={saving} onClick={() => setEditing(false)}>Huỷ</button>
          </div>
          <p style={{ color: 'var(--fg-3)', fontSize: 11, margin: '12px 0 0' }}>Thêm <b>email</b> để nâng prospect FORM lên EMAIL (rồi mới auto-send được). <b>Website</b> là cái GA4 embed-detector so khớp — giữ đúng homepage thật của họ.</p>
        </div>
      ) : isForm ? (
        <>
          <div style={{ margin: '14px 0 0' }}>
            <div style={lbl}>Gửi qua form liên hệ của họ</div>
            {formLink ? <a href={formLink} {...EXT} style={{ ...btn, padding: '7px 12px', textDecoration: 'none', display: 'inline-block', borderColor: 'var(--neon-amber)', color: 'var(--neon-amber)', fontWeight: 700 }}>Mở form {hostOf(formLink)} ↗</a> : <div style={{ fontSize: 13, color: 'var(--fg-3)' }}>Chưa có link liên hệ.</div>}
            <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 6 }}>Mở không kèm referrer — trang họ không thấy tool này. Form liên hệ thường chỉ có 1 ô nội dung, không có tiêu đề, nên dán nội dung dưới vào đó.</div>
          </div>
          <div style={{ margin: '14px 0 0' }}>
            <div style={lbl}>Điền form — copy từng ô vào đúng chỗ trên form của họ</div>
            <CopyField label="Tên" value={sender.name} />
            <CopyField label="Email" value={sender.email} />
            <div style={{ ...lbl, marginTop: 6 }}>Nội dung <span style={{ color: 'var(--fg-3)' }}>· sửa được</span></div>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} style={taStyle} />
          </div>
          {genErr && <div style={{ fontSize: 11, color: 'var(--bad)', margin: '8px 0 0' }}>✗ {genErr}</div>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '14px 0 0', alignItems: 'center' }}>
            <button type="button" onClick={genEmail} disabled={gening} style={{ ...btn, padding: '7px 12px', fontWeight: 700, borderColor: 'var(--accent)', color: 'var(--accent)' }} title="AI viết nội dung theo product + Content Pillar của project này">{gening ? '⏳ Đang sinh…' : '✨ Sinh'}</button>
            <button style={{ ...btn, padding: '7px 12px' }} onClick={() => copyLocal(body)}>{didCopy ? '✓ Đã copy' : 'Copy nội dung'}</button>
            {sendable && (<>
              <GuardedButton reason={!body.trim() ? 'Nhập nội dung trước khi đánh dấu đã gửi' : ''} style={{ ...btn, padding: '7px 14px', fontWeight: 700, borderColor: 'var(--neon-lime)', color: 'var(--neon-lime)' }} disabled={formBusy} onClick={() => doForm('submitted')}>{formBusy ? 'Đang lưu…' : '✓ Đã gửi form'}</GuardedButton>
              <button style={{ ...btn, padding: '7px 12px', borderColor: 'var(--bad)', color: 'var(--bad)' }} disabled={formBusy} onClick={() => doForm('unreachable')} title="Form hỏng, không phải form thật, bị captcha chặn, hoặc không gửi được">Ko gửi được / form hỏng</button>
            </>)}
          </div>
          <details style={{ margin: '8px 0 0' }}>
            <summary style={{ fontSize: 11, color: 'var(--fg-3)', cursor: 'pointer', userSelect: 'none' }}>Khác · lưu nháp / đặt lại</summary>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0 0' }}>
              <button style={{ ...btn, padding: '7px 12px' }} onClick={saveDraft} title="Lưu chỉnh sửa mà không gửi">{savedDraft ? '✓ Đã lưu' : 'Lưu nháp'}</button>
              <button style={{ ...btn, padding: '7px 12px' }} onClick={resetTpl} title={projectId === LEGACY_TPL_PROJECT ? 'Tạo lại từ mẫu' : 'Xoá về trống'}>Đặt lại</button>
            </div>
          </details>
        </>
      ) : (
        <>
          <div style={{ margin: '14px 0 0' }}>
            <div style={lbl}>Từ</div>
            <div style={{ fontSize: 13, color: 'var(--fg-1)' }}>{sender.name} &lt;{sender.email}&gt;</div>
            <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>Gửi qua Mailjet · reply về inbox của anh</div>
          </div>
          <div style={{ margin: '12px 0 0' }}>
            <div style={lbl}>Tới <span style={{ color: 'var(--fg-3)' }}>· email của họ — điền/sửa rồi gửi tự động</span></div>
            <input value={cur.email} onChange={(e) => setCur({ ...cur, email: e.target.value })} onBlur={saveEmail}
              placeholder="ten@trang-cua-ho.com" autoComplete="off" style={{ ...inputStyle, marginBottom: 0, color: 'var(--fg-0)', transition: 'box-shadow .2s', ...(emailSaved ? { boxShadow: '0 0 0 2px var(--neon-lime)' } : {}) }} />
            {saveErr && <div style={{ fontSize: 11, color: 'var(--bad)', marginTop: 4 }}>✗ {saveErr}</div>}
          </div>
          <div style={{ margin: '12px 0 0' }}>
            <div style={lbl}>Tiêu đề <span style={{ color: 'var(--fg-3)' }}>· sửa được</span>{isFollowup && <span style={{ color: 'var(--neon-amber)' }}> · nhắc</span>}</div>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} autoComplete="off" style={{ ...inputStyle, fontWeight: 600, marginBottom: 0 }} />
          </div>
          <div style={{ margin: '12px 0 0' }}>
            <div style={lbl}>Nội dung <span style={{ color: 'var(--fg-3)' }}>· sửa được — chỉnh lời chào/câu chữ trước khi gửi</span></div>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={16} style={taStyle} />
          </div>
          {genErr && <div style={{ fontSize: 11, color: 'var(--bad)', margin: '8px 0 0' }}>✗ {genErr}</div>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '14px 0 0', alignItems: 'center' }}>
            <button type="button" onClick={genEmail} disabled={gening} style={{ ...btn, padding: '7px 12px', fontWeight: 700, borderColor: 'var(--accent)', color: 'var(--accent)' }} title="AI viết email theo product + Content Pillar của project này">{gening ? '⏳ Đang sinh…' : '✨ Sinh'}</button>
            {sendable && send === 'idle' && <GuardedButton reason={!cur.email.trim() ? 'Điền email của họ trước' : !body.trim() ? 'Nhập nội dung email trước khi gửi' : ''} disabled={pending} style={{ ...btn, padding: '7px 14px', fontSize: 13, fontWeight: 700, borderColor: 'var(--neon-lime)', color: 'var(--neon-lime)' }} onClick={() => setSend('confirm')}>{isFollowup ? 'Gửi nhắc' : 'Gửi email'}</GuardedButton>}
            {sendable && send === 'confirm' && (<>
              <button style={{ ...btn, padding: '7px 14px', fontSize: 13, fontWeight: 800, background: 'var(--neon-lime)', color: 'var(--bg-0)', borderColor: 'var(--neon-lime)' }} onClick={doSend}>Xác nhận: gửi tới {cur.email}</button>
              <button style={{ ...btn, padding: '7px 12px' }} onClick={() => setSend('idle')}>Huỷ</button>
            </>)}
            {send === 'sending' && <span style={{ fontSize: 13, color: 'var(--fg-2)' }}>Đang gửi…</span>}
            {send === 'sent' && <span style={{ fontSize: 13, color: 'var(--neon-lime)', fontWeight: 700 }}>✓ Đã gửi</span>}
            {send === 'error' && <span style={{ fontSize: 12, color: 'var(--bad)' }}>✗ {err}</span>}
          </div>
          {send !== 'sending' && send !== 'sent' && (
            <details style={{ margin: '8px 0 0' }}>
              <summary style={{ fontSize: 11, color: 'var(--fg-3)', cursor: 'pointer', userSelect: 'none' }}>Khác · copy / Gmail / lưu nháp</summary>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0 0', alignItems: 'center' }}>
                <button style={{ ...btn, padding: '7px 12px' }} onClick={() => copyLocal(`Subject: ${subject}\n\n${body}`)}>{didCopy ? '✓ Đã copy' : 'Copy email'}</button>
                <a href={gmailUrl(cur.email, subject, body)} {...EXT} style={{ ...btn, padding: '7px 12px', textDecoration: 'none', display: 'inline-block' }}>Mở Gmail ↗</a>
                <button style={{ ...btn, padding: '7px 12px' }} onClick={saveDraft} title="Lưu chỉnh sửa mà không gửi">{savedDraft ? '✓ Đã lưu' : 'Lưu nháp'}</button>
                <button style={{ ...btn, padding: '7px 12px' }} onClick={resetTpl} title={projectId === LEGACY_TPL_PROJECT ? 'Tạo lại từ mẫu' : 'Xoá về trống'}>Đặt lại</button>
              </div>
            </details>
          )}
          <p style={{ color: 'var(--fg-3)', fontSize: 11, margin: '12px 0 0' }}>Gửi qua Mailjet từ {sender.email} (reply về inbox của anh) và đẩy pipeline tiến. <b>✨ Sinh</b> = AI viết theo product + Content Pillar của project.</p>
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
