'use client';

// Multi-channel Outreach hub for a backlink task (opens stacked ON the task drawer, no page nav).
// One owner (prospect) reached via N channels: email/form live on the prospect (auto-send via Mailjet
// unchanged); social/messaging/dev = "touches" (outreach_touches) sent ext-assisted (open + paste +
// mark sent). Tabs per channel · per-channel panel · touch history · roll-up. Project-agnostic (NOT the
// MilitaryCalc-hardcoded EmailDrawer on /outreach). See 2026-07-20-outreach-multichannel-plan.
import { useEffect, useState, type CSSProperties } from 'react';
import { Drawer } from '@/components/ui';
import type { OutreachProspect } from '@/lib/actions/outreach';
import { loadProspect, updateProspectDraft, setProspectStatus, markFormSubmitted } from '@/lib/actions/outreach-mutations';
import { sendProspectEmail } from '@/lib/actions/outreach-send';
import { listTouches, addTouch, saveTouch, genTouch, markTouchSent, deleteTouch, type Touch } from '@/lib/actions/outreach-touches';
import { CHANNELS, CHANNEL_BY_KEY } from '@/lib/outreach/channels';

const STATUS_META: Record<string, { label: string; color: string }> = {
  to_send: { label: 'Chưa gửi', color: 'var(--fg-3)' }, sent: { label: 'Đã gửi', color: 'var(--neon-cyan)' },
  followup_1: { label: 'Follow-up 1', color: 'var(--neon-amber)' }, followup_2: { label: 'Follow-up 2', color: 'var(--neon-amber)' },
  replied: { label: 'Đã hồi', color: 'var(--neon-violet)' }, interested: { label: 'Quan tâm', color: 'var(--neon-lime)' },
  embedded: { label: 'Đã đặt link ★', color: 'var(--neon-lime)' }, declined: { label: 'Từ chối', color: 'var(--fg-3)' },
  bounced: { label: 'Bounced', color: 'var(--bad)' }, unreachable: { label: 'Không liên hệ được', color: 'var(--bad)' }, no_response: { label: 'Không hồi', color: 'var(--fg-3)' },
};
const SENDABLE = new Set(['to_send', 'sent', 'followup_1', 'followup_2']);
const gmailUrl = (to: string, subject: string, body: string) => `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
const hostOf = (u: string) => { try { return new URL(u.startsWith('http') ? u : 'https://' + u).hostname.replace(/^www\./, ''); } catch { return u; } };
const fmtDay = (s: string | null) => (s ? new Date(s).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : '');
const btn: CSSProperties = { fontSize: 12, padding: '5px 11px', borderRadius: 6, border: '1px solid var(--line, var(--bg-3))', background: 'var(--bg-2)', color: 'var(--fg-1)', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 600 };
const lbl: CSSProperties = { fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 3px' };
const taStyle: CSSProperties = { width: '100%', fontSize: 12, fontFamily: 'var(--font-mono)', lineHeight: 1.5, padding: 10, borderRadius: 8, border: '1px solid var(--bg-3)', background: 'var(--bg-1)', color: 'var(--fg-1)', resize: 'vertical' };
const inputStyle: CSSProperties = { width: '100%', padding: '6px 9px', fontSize: 13, borderRadius: 6, border: '1px solid var(--bg-3)', background: 'var(--bg-1)', color: 'var(--fg-0)' };

const chLabel = (k: string) => CHANNEL_BY_KEY[k]?.label || k;
const chIcon = (k: string) => CHANNEL_BY_KEY[k]?.icon || '•';

export function TaskOutreachDrawer({ projectId, prospectId, onClose, onChange, backgrounded }: {
  projectId: string; prospectId: number; onClose: () => void; onChange: () => void; backgrounded?: boolean;
}) {
  const [p, setP] = useState<OutreachProspect | null>(null);
  const [touches, setTouches] = useState<Touch[]>([]);
  const [sel, setSel] = useState<string>('');           // selected channel key
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmSend, setConfirmSend] = useState(false);
  const [adding, setAdding] = useState(false);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 1800); };
  const reloadTouches = async () => setTouches(await listTouches(projectId, prospectId));
  const reloadAll = async () => {
    const [pr, ts] = await Promise.all([loadProspect(projectId, prospectId), listTouches(projectId, prospectId)]);
    setP(pr); setTouches(ts); setSubject(pr?.emailSubject ?? ''); setBody(pr?.emailBody ?? '');
  };
  useEffect(() => { let live = true; (async () => { const [pr, ts] = await Promise.all([loadProspect(projectId, prospectId), listTouches(projectId, prospectId)]); if (!live) return; setP(pr); setTouches(ts); setSubject(pr?.emailSubject ?? ''); setBody(pr?.emailBody ?? ''); setSel(pr?.email ? 'email' : 'contact_form'); })(); return () => { live = false; }; }, [projectId, prospectId]);

  if (!p) return <Drawer onClose={onClose} width={560} zIndex={320} backgrounded={backgrounded} closeOnOutside={false}><div style={{ fontSize: 13, color: 'var(--fg-3)' }}>Đang tải…</div></Drawer>;

  const primaryChannel = p.email ? 'email' : 'contact_form';
  const isPrimary = sel === primaryChannel;
  const selTouch = touches.find((t) => t.channel === sel) || null;
  const presentChannels = [primaryChannel, ...touches.map((t) => t.channel)];
  const sm = STATUS_META[p.status] || { label: p.status, color: 'var(--fg-2)' };
  const sendable = SENDABLE.has(p.status);
  const formLink = (p.contactUrl || p.website || '').trim();
  const addable = CHANNELS.filter((c) => !presentChannels.includes(c.key) && c.key !== 'email' && c.key !== 'contact_form');

  // primary email/form status for the badge + history
  const primaryStatus = p.status;
  const primarySent = p.sentAt;

  const copy = (t: string, m: string) => { navigator.clipboard?.writeText(t).then(() => flash(m)).catch(() => {}); };
  // email actions
  const saveEmailDraft = async () => { setBusy('save'); await updateProspectDraft(projectId, prospectId, { subject, body }); setBusy(null); flash('✓ đã lưu nháp'); onChange(); };
  const doSendEmail = async () => { setBusy('send'); setConfirmSend(false); const r = await sendProspectEmail(projectId, prospectId, { subject, body }); setBusy(null); if (r.ok) { flash('✓ đã gửi'); await reloadAll(); onChange(); } else flash('✗ ' + (r.error || 'gửi lỗi')); };
  const doFormSubmitted = async () => { setBusy('form'); await markFormSubmitted(projectId, prospectId); await reloadAll(); setBusy(null); flash('✓ đã đánh dấu gửi form'); onChange(); };
  const doStatus = async (s: string) => { setBusy(s); await setProspectStatus(projectId, prospectId, s); await reloadAll(); setBusy(null); onChange(); };
  // touch actions
  const addChannel = async (channel: string) => { setBusy('add'); const r = await addTouch(projectId, prospectId, channel, ''); setBusy(null); setAdding(false); if (r.ok && r.touch) { await reloadTouches(); setSel(channel); } else flash(r.error || 'lỗi'); };
  const genTouchContent = async () => { if (!selTouch) return; setBusy('gen'); const r = await genTouch(projectId, prospectId, selTouch.id); setBusy(null); if (r.ok && r.content) { await reloadTouches(); flash('✓ đã sinh'); } else flash(r.error || 'lỗi sinh'); };
  const saveTouchField = async (patch: { targetRef?: string; content?: string }) => { if (!selTouch) return; await saveTouch(projectId, selTouch.id, patch); await reloadTouches(); };
  const markSent = async () => { if (!selTouch) return; setBusy('sent'); await markTouchSent(projectId, prospectId, selTouch.id); await reloadAll(); setBusy(null); flash('✓ đã đánh dấu gửi'); onChange(); };
  const delTouch = async () => { if (!selTouch) return; setBusy('del'); await deleteTouch(projectId, selTouch.id); await reloadTouches(); setSel(primaryChannel); setBusy(null); onChange(); };

  const pill = (key: string, sentBadge: string, active: boolean, onClick: () => void) => (
    <button key={key} type="button" onClick={onClick} title={CHANNEL_BY_KEY[key]?.tip || key}
      style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, cursor: 'pointer', border: `1px solid ${active ? 'var(--neon-lime)' : 'var(--bg-3)'}`, background: active ? 'color-mix(in srgb, var(--neon-lime) 16%, transparent)' : 'var(--bg-2)', color: active ? 'var(--neon-lime)' : 'var(--fg-2)', whiteSpace: 'nowrap' }}>
      {chIcon(key)} {chLabel(key)}{sentBadge}
    </button>
  );

  return (
    <Drawer onClose={onClose} width={560} zIndex={320} backgrounded={backgrounded} closeOnOutside={false}>
      {/* Header = OWNER (not channel) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>Outreach</h2>
          <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 3, display: 'flex', gap: 6, alignItems: 'center' }}>
            <span>{p.agentName}</span>
            <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 99, background: `color-mix(in srgb, ${sm.color} 18%, transparent)`, color: sm.color, fontWeight: 700 }}>{sm.label}</span>
          </div>
        </div>
        <button type="button" onClick={onClose} style={{ ...btn, padding: '2px 9px' }}>✕</button>
      </div>

      {/* CHANNEL BAR — one pill per present channel + add */}
      <div style={{ margin: '14px 0 0' }}>
        <div style={lbl}>Kênh <span style={{ color: 'var(--fg-4)' }}>· hover xem cách tiếp cận</span></div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {pill(primaryChannel, SENDABLE.has(primaryStatus) && primaryStatus !== 'to_send' ? ' ✓' : primaryStatus === 'to_send' ? ' •' : '', isPrimary, () => setSel(primaryChannel))}
          {touches.map((t) => pill(t.channel, t.status === 'sent' ? ' ✓' : t.status === 'replied' ? ' ↩' : ' •', sel === t.channel, () => setSel(t.channel)))}
          <div style={{ position: 'relative' }}>
            <button type="button" onClick={() => setAdding((v) => !v)} style={{ ...btn, padding: '3px 9px', fontSize: 11, borderStyle: 'dashed' }}>+ kênh</button>
            {adding && (
              <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 5, background: 'var(--bg-0)', border: '1px solid var(--bg-3)', borderRadius: 8, padding: 6, boxShadow: '0 8px 24px rgba(0,0,0,.3)', maxHeight: 260, overflowY: 'auto', minWidth: 180 }}>
                {addable.length === 0 ? <div style={{ fontSize: 11, color: 'var(--fg-3)', padding: 6 }}>Đã thêm hết kênh.</div> : addable.map((c) => (
                  <button key={c.key} type="button" onClick={() => addChannel(c.key)} title={c.tip} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '5px 8px', fontSize: 12, background: 'none', border: 'none', color: 'var(--fg-1)', cursor: 'pointer', borderRadius: 5 }}>
                    {c.icon} {c.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ACTIVE CHANNEL PANEL */}
      <div style={{ margin: '14px 0 0', paddingTop: 12, borderTop: '1px solid var(--bg-3)' }}>
        <div style={{ ...lbl, color: 'var(--fg-2)', fontSize: 11 }}>Đang: {chIcon(sel)} {chLabel(sel)}</div>

        {isPrimary ? (
          /* EMAIL / FORM (prospect-native) */
          <>
            {p.email ? (
              <div style={{ fontSize: 13, color: 'var(--fg-0)', margin: '2px 0 8px' }}>Tới: {p.email} <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>· gửi qua Mailjet</span></div>
            ) : (
              <div style={{ margin: '2px 0 8px' }}>{formLink ? <a href={formLink} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" style={{ ...btn, textDecoration: 'none', display: 'inline-block', borderColor: 'var(--neon-amber)', color: 'var(--neon-amber)' }}>Mở form {hostOf(formLink)} ↗</a> : <span style={{ fontSize: 13, color: 'var(--fg-3)' }}>Chưa có link liên hệ.</span>}</div>
            )}
            <div style={lbl}>Tiêu đề · sửa được</div>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} autoComplete="off" style={{ ...inputStyle, fontWeight: 600, marginBottom: 8 }} />
            <div style={lbl}>Nội dung · sửa được</div>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} style={taStyle} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '10px 0 0', alignItems: 'center' }}>
              {p.email && sendable && !confirmSend && <button type="button" onClick={() => setConfirmSend(true)} disabled={!!busy} style={{ ...btn, fontWeight: 700, borderColor: 'var(--neon-lime)', color: 'var(--neon-lime)' }}>{busy === 'send' ? 'Đang gửi…' : (p.status === 'to_send' ? 'Gửi qua Mailjet' : 'Gửi follow-up')}</button>}
              {p.email && sendable && confirmSend && (<><button type="button" onClick={doSendEmail} disabled={!!busy} style={{ ...btn, fontWeight: 800, background: 'var(--neon-lime)', color: 'var(--bg-0)', borderColor: 'var(--neon-lime)' }}>Xác nhận: gửi {p.email}</button><button type="button" onClick={() => setConfirmSend(false)} style={btn}>Huỷ</button></>)}
              {p.email && <a href={gmailUrl(p.email, subject, body)} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" style={{ ...btn, textDecoration: 'none', display: 'inline-block' }}>Mở Gmail ↗</a>}
              {!p.email && sendable && <button type="button" onClick={doFormSubmitted} disabled={!!busy} style={{ ...btn, fontWeight: 700, borderColor: 'var(--neon-lime)', color: 'var(--neon-lime)' }}>✓ Đã gửi form</button>}
              <button type="button" onClick={() => copy(p.email ? `Subject: ${subject}\n\n${body}` : body, '✓ đã copy')} style={btn}>Copy</button>
              <button type="button" onClick={saveEmailDraft} disabled={!!busy} style={btn}>{busy === 'save' ? '…' : 'Lưu nháp'}</button>
            </div>
          </>
        ) : selTouch ? (
          /* TOUCH channel (social / messaging / dev) — ext-assisted */
          <>
            <div style={lbl}>Tới</div>
            <input defaultValue={selTouch.targetRef} onBlur={(e) => saveTouchField({ targetRef: e.target.value })} placeholder="@handle hoặc URL profile/post của họ" autoComplete="off" style={{ ...inputStyle, marginBottom: 6 }} />
            <div style={{ fontSize: 11.5, color: 'var(--fg-3)', margin: '0 0 8px' }}>Cách: {CHANNEL_BY_KEY[sel]?.tip}</div>
            <div style={lbl}>Nội dung ({chLabel(sel)})</div>
            <textarea value={selTouch.content} onChange={(e) => setTouches((ts) => ts.map((t) => t.id === selTouch.id ? { ...t, content: e.target.value } : t))} onBlur={(e) => saveTouchField({ content: e.target.value })} rows={6} placeholder="Bấm ✨ Sinh để AI viết theo giọng kênh này" style={taStyle} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '10px 0 0', alignItems: 'center' }}>
              <button type="button" onClick={genTouchContent} disabled={!!busy} style={{ ...btn, fontWeight: 700, color: 'var(--accent)', borderColor: 'var(--accent)' }}>{busy === 'gen' ? '⏳…' : '✨ Sinh'}</button>
              {selTouch.targetRef && <a href={selTouch.targetRef.startsWith('http') ? selTouch.targetRef : `https://${selTouch.targetRef.replace(/^@/, '')}`} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" style={{ ...btn, textDecoration: 'none', display: 'inline-block' }}>Mở {chLabel(sel)} ↗</a>}
              <button type="button" onClick={() => copy(selTouch.content, '✓ đã copy — dán vào ' + chLabel(sel))} style={btn}>Copy</button>
              {selTouch.status !== 'sent' ? <button type="button" onClick={markSent} disabled={!!busy} style={{ ...btn, fontWeight: 700, borderColor: 'var(--neon-lime)', color: 'var(--neon-lime)' }}>✓ Đã gửi</button> : <span style={{ fontSize: 12, color: 'var(--neon-lime)', fontWeight: 700 }}>✓ đã gửi {fmtDay(selTouch.sentAt)}</span>}
              <button type="button" onClick={delTouch} disabled={!!busy} style={{ ...btn, color: 'var(--bad)', borderColor: 'color-mix(in srgb, var(--bad) 50%, transparent)' }}>Xoá kênh</button>
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--fg-4)', margin: '8px 0 0', lineHeight: 1.5 }}>Ext-assisted: mở {chLabel(sel)} của họ, dán nội dung, tự bấm Send, rồi ✓ Đã gửi. (Auto-paste qua ext = bản sau.)</div>
          </>
        ) : null}
      </div>

      {/* TOUCH HISTORY */}
      <div style={{ margin: '16px 0 0', paddingTop: 12, borderTop: '1px solid var(--bg-3)' }}>
        <div style={lbl}>Lịch sử chạm</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <HistRow icon={chIcon(primaryChannel)} label={chLabel(primaryChannel)} status={STATUS_META[primaryStatus]?.label || primaryStatus} day={fmtDay(primarySent)} />
          {touches.filter((t) => t.status === 'sent' || t.status === 'replied').map((t) => (
            <HistRow key={t.id} icon={chIcon(t.channel)} label={chLabel(t.channel)} status={t.status === 'replied' ? 'đã hồi' : 'đã gửi'} day={fmtDay(t.sentAt)} />
          ))}
          {(!primarySent && touches.every((t) => t.status !== 'sent')) && <div style={{ fontSize: 11.5, color: 'var(--fg-4)' }}>Chưa chạm kênh nào.</div>}
        </div>
      </div>

      {/* ROLL-UP RESULT */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '14px 0 0', alignItems: 'center', paddingTop: 12, borderTop: '1px solid var(--bg-3)' }}>
        <span style={{ ...lbl, margin: 0 }}>Kết quả:</span>
        <button type="button" onClick={() => doStatus('replied')} disabled={!!busy} style={{ ...btn, fontSize: 11 }}>Đã hồi</button>
        <button type="button" onClick={() => doStatus('interested')} disabled={!!busy} style={{ ...btn, fontSize: 11, borderColor: 'var(--neon-lime)', color: 'var(--neon-lime)' }}>Quan tâm</button>
        <button type="button" onClick={() => doStatus('declined')} disabled={!!busy} style={{ ...btn, fontSize: 11 }}>Từ chối</button>
      </div>

      {msg && <div style={{ fontSize: 12, color: 'var(--fg-2)', marginTop: 10 }}>{msg}</div>}
      <p style={{ fontSize: 11, color: 'var(--fg-4)', margin: '12px 0 0', lineHeight: 1.5 }}>Trạng thái đồng bộ 2 chiều với backlink task (gửi bất kỳ kênh → task chuyển &ldquo;Chờ duyệt&rdquo;).</p>
    </Drawer>
  );
}

function HistRow({ icon, label, status, day }: { icon: string; label: string; status: string; day: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11.5, color: 'var(--fg-2)' }}>
      <span style={{ width: 74, color: 'var(--fg-1)' }}>{icon} {label}</span>
      <span style={{ color: 'var(--fg-3)' }}>{status}</span>
      {day && <span style={{ color: 'var(--fg-4)', marginLeft: 'auto' }}>{day}</span>}
    </div>
  );
}
