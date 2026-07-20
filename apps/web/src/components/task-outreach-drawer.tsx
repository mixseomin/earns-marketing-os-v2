'use client';

// In-place Outreach drawer for a backlink task (opens stacked ON the task drawer, no page nav).
// Reuses the shared outreach server actions (send / draft / status) — the pitch you see is what
// sends. Structured as a multi-channel hub: Email/Form is wired now; social DM + comment are the
// planned channels (see decision 2026-07-20-outreach-multichannel). Not the MilitaryCalc-hardcoded
// EmailDrawer on /outreach — this one is project-agnostic.
import { useEffect, useState, type CSSProperties } from 'react';
import { Drawer } from '@/components/ui';
import type { OutreachProspect } from '@/lib/actions/outreach';
import { loadProspect, updateProspectDraft, setProspectStatus, markFormSubmitted } from '@/lib/actions/outreach-mutations';
import { sendProspectEmail } from '@/lib/actions/outreach-send';
import { CHANNELS } from '@/lib/outreach/channels';

const STATUS_META: Record<string, { label: string; color: string }> = {
  to_send: { label: 'Chưa gửi', color: 'var(--fg-3)' },
  sent: { label: 'Đã gửi', color: 'var(--neon-cyan)' },
  followup_1: { label: 'Follow-up 1', color: 'var(--neon-amber)' },
  followup_2: { label: 'Follow-up 2', color: 'var(--neon-amber)' },
  replied: { label: 'Đã hồi', color: 'var(--neon-violet)' },
  interested: { label: 'Quan tâm', color: 'var(--neon-lime)' },
  embedded: { label: 'Đã đặt link ★', color: 'var(--neon-lime)' },
  declined: { label: 'Từ chối', color: 'var(--fg-3)' },
  bounced: { label: 'Bounced', color: 'var(--bad)' },
  unreachable: { label: 'Không liên hệ được', color: 'var(--bad)' },
  no_response: { label: 'Không hồi', color: 'var(--fg-3)' },
};
const SENDABLE = new Set(['to_send', 'sent', 'followup_1', 'followup_2']);
const gmailUrl = (to: string, subject: string, body: string) => `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
const btn: CSSProperties = { fontSize: 12, padding: '5px 11px', borderRadius: 6, border: '1px solid var(--line, var(--bg-3))', background: 'var(--bg-2)', color: 'var(--fg-1)', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 600 };
const lbl: CSSProperties = { fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 3px' };
const taStyle: CSSProperties = { width: '100%', fontSize: 12, fontFamily: 'var(--font-mono)', lineHeight: 1.5, padding: 10, borderRadius: 8, border: '1px solid var(--bg-3)', background: 'var(--bg-1)', color: 'var(--fg-1)', resize: 'vertical' };
const inputStyle: CSSProperties = { width: '100%', padding: '6px 9px', fontSize: 13, borderRadius: 6, border: '1px solid var(--bg-3)', background: 'var(--bg-1)', color: 'var(--fg-0)' };

export function TaskOutreachDrawer({ projectId, prospectId, onClose, onChange, backgrounded }: {
  projectId: string; prospectId: number; onClose: () => void; onChange: () => void; backgrounded?: boolean;
}) {
  const [p, setP] = useState<OutreachProspect | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmSend, setConfirmSend] = useState(false);

  useEffect(() => {
    let live = true;
    loadProspect(projectId, prospectId).then((pr) => { if (!live) return; setP(pr); setSubject(pr?.emailSubject ?? ''); setBody(pr?.emailBody ?? ''); });
    return () => { live = false; };
  }, [projectId, prospectId]);

  const isForm = !p?.email;
  const formLink = (p?.contactUrl || p?.website || '').trim();
  const sm = p ? (STATUS_META[p.status] || { label: p.status, color: 'var(--fg-2)' }) : null;
  const sendable = p ? SENDABLE.has(p.status) : false;
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 1600); };

  const saveDraft = async () => { setBusy('save'); await updateProspectDraft(projectId, prospectId, { subject, body }); setBusy(null); flash('✓ đã lưu nháp'); onChange(); };
  const doSend = async () => {
    setBusy('send'); setConfirmSend(false);
    const r = await sendProspectEmail(projectId, prospectId, { subject, body });
    setBusy(null);
    if (r.ok) { flash('✓ đã gửi'); const pr = await loadProspect(projectId, prospectId); setP(pr); onChange(); }
    else flash('✗ ' + (r.error || 'gửi lỗi'));
  };
  const doStatus = async (s: string) => { setBusy(s); await setProspectStatus(projectId, prospectId, s); const pr = await loadProspect(projectId, prospectId); setP(pr); setBusy(null); onChange(); };
  const doFormSubmitted = async () => { setBusy('form'); await markFormSubmitted(projectId, prospectId); const pr = await loadProspect(projectId, prospectId); setP(pr); setBusy(null); flash('✓ đã đánh dấu gửi form'); onChange(); };
  const copy = (t: string, m: string) => { navigator.clipboard?.writeText(t).then(() => flash(m)).catch(() => {}); };

  return (
    <Drawer onClose={onClose} width={560} zIndex={320} backgrounded={backgrounded} closeOnOutside={false}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>Outreach {isForm ? '· Form' : '· Email'}</h2>
          <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 3, display: 'flex', gap: 6, alignItems: 'center' }}>
            <span>{p?.agentName || '…'}</span>
            {sm && <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 99, background: `color-mix(in srgb, ${sm.color} 18%, transparent)`, color: sm.color, fontWeight: 700 }}>{sm.label}</span>}
          </div>
        </div>
        <button type="button" onClick={onClose} style={{ ...btn, padding: '2px 9px' }}>✕</button>
      </div>

      {!p ? <div style={{ fontSize: 13, color: 'var(--fg-3)', marginTop: 16 }}>Đang tải…</div> : (<>
        {/* Channels — reach the SAME owner via whichever is open (taxonomy ported from orit.app).
            Email/form wired now; social/messaging/dev = ext-assisted, đang xây (xem plan multi-channel). */}
        <div style={{ margin: '14px 0 0' }}>
          <div style={lbl}>Kênh liên hệ <span style={{ color: 'var(--fg-4)' }}>· hover xem cách tiếp cận</span></div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {CHANNELS.map((c) => {
              const active = (c.key === 'email' && !isForm) || (c.key === 'contact_form' && isForm);
              const planned = c.send === 'assisted';
              return (
                <span key={c.key} title={c.tip + (planned ? ' · (ext-assisted, sắp có)' : '')}
                  style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, border: `1px solid ${active ? 'var(--neon-lime)' : 'var(--bg-3)'}`, background: active ? 'color-mix(in srgb, var(--neon-lime) 15%, transparent)' : 'transparent', color: active ? 'var(--neon-lime)' : planned ? 'var(--fg-4)' : 'var(--fg-2)', opacity: planned ? 0.7 : 1 }}>
                  {c.icon} {c.label}{planned ? ' ·' : ''}
                </span>
              );
            })}
          </div>
        </div>

        {/* To / form link */}
        <div style={{ margin: '14px 0 0' }}>
          <div style={lbl}>{isForm ? 'Gửi qua form của họ' : 'Gửi tới'}</div>
          {isForm ? (
            formLink ? <a href={formLink} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" style={{ ...btn, textDecoration: 'none', display: 'inline-block', borderColor: 'var(--neon-amber)', color: 'var(--neon-amber)' }}>Mở form {hostOf(formLink)} ↗</a>
              : <div style={{ fontSize: 13, color: 'var(--fg-3)' }}>Chưa có link liên hệ.</div>
          ) : <div style={{ fontSize: 13, color: 'var(--fg-0)' }}>{p.email} <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>· gửi qua Mailjet</span></div>}
        </div>

        {/* Subject + body (editable — what you see is what sends) */}
        <div style={{ margin: '12px 0 0' }}>
          <div style={lbl}>Tiêu đề <span style={{ color: 'var(--fg-3)' }}>· sửa được</span></div>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} autoComplete="off" style={{ ...inputStyle, fontWeight: 600 }} />
        </div>
        <div style={{ margin: '10px 0 0' }}>
          <div style={lbl}>Nội dung <span style={{ color: 'var(--fg-3)' }}>· sửa greeting/wording trước khi gửi</span></div>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={14} style={taStyle} />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0 0', alignItems: 'center' }}>
          {!isForm && sendable && !confirmSend && (
            <button type="button" onClick={() => setConfirmSend(true)} disabled={!!busy} style={{ ...btn, fontWeight: 700, borderColor: 'var(--neon-lime)', color: 'var(--neon-lime)' }}>{busy === 'send' ? 'Đang gửi…' : (p.status === 'to_send' ? 'Gửi qua Mailjet' : 'Gửi follow-up')}</button>
          )}
          {!isForm && sendable && confirmSend && (<>
            <button type="button" onClick={doSend} disabled={!!busy} style={{ ...btn, fontWeight: 800, background: 'var(--neon-lime)', color: 'var(--bg-0)', borderColor: 'var(--neon-lime)' }}>Xác nhận: gửi {p.email}</button>
            <button type="button" onClick={() => setConfirmSend(false)} style={btn}>Huỷ</button>
          </>)}
          {!isForm && <a href={gmailUrl(p.email || '', subject, body)} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" style={{ ...btn, textDecoration: 'none', display: 'inline-block' }}>Mở Gmail ↗</a>}
          {isForm && sendable && <button type="button" onClick={doFormSubmitted} disabled={!!busy} style={{ ...btn, fontWeight: 700, borderColor: 'var(--neon-lime)', color: 'var(--neon-lime)' }}>✓ Đã gửi form</button>}
          <button type="button" onClick={() => copy(isForm ? body : `Subject: ${subject}\n\n${body}`, '✓ đã copy')} style={btn}>Copy</button>
          <button type="button" onClick={saveDraft} disabled={!!busy} style={btn}>{busy === 'save' ? '…' : 'Lưu nháp'}</button>
        </div>

        {/* Record outcome */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '12px 0 0', alignItems: 'center' }}>
          <span style={{ ...lbl, margin: 0 }}>Kết quả:</span>
          <button type="button" onClick={() => doStatus('replied')} disabled={!!busy} style={{ ...btn, fontSize: 11 }}>Đã hồi</button>
          <button type="button" onClick={() => doStatus('interested')} disabled={!!busy} style={{ ...btn, fontSize: 11, borderColor: 'var(--neon-lime)', color: 'var(--neon-lime)' }}>Quan tâm</button>
          <button type="button" onClick={() => doStatus('declined')} disabled={!!busy} style={{ ...btn, fontSize: 11 }}>Từ chối</button>
        </div>

        {msg && <div style={{ fontSize: 12, color: 'var(--fg-2)', marginTop: 10 }}>{msg}</div>}
        <p style={{ fontSize: 11, color: 'var(--fg-4)', margin: '14px 0 0', lineHeight: 1.5 }}>
          Trạng thái đồng bộ 2 chiều với backlink task (gửi → task chuyển &ldquo;Chờ duyệt&rdquo;). DM mạng xã hội + comment sẽ thêm sau (xem plan multi-channel).
        </p>
      </>)}
    </Drawer>
  );
}
