'use client';

// Multi-channel Outreach hub for a backlink task (stacked ON the task drawer, no page nav). One owner
// reached via N channels. EMAIL/FORM panel = the SAME OutreachEmailBody the /outreach page uses (one
// visual language, not a bespoke copy — see feedback about matching the house drawer). Social/comment =
// "touches" (outreach_touches), ext-assisted. Tabs · panel · touch history · roll-up.
import { useEffect, useState, type ReactNode } from 'react';
import { Drawer } from '@/components/ui';
import type { OutreachProspect } from '@/lib/actions/outreach';
import { loadProspect, setProspectStatus } from '@/lib/actions/outreach-mutations';
import { listTouches, addTouch, saveTouch, genTouch, markTouchSent, deleteTouch, getProspectSender, type Touch } from '@/lib/actions/outreach-touches';
import { OutreachEmailBody, Badge, ChannelTag, oStyles, type Sender } from '@/components/outreach-email-drawer';
import { CHANNELS, CHANNEL_BY_KEY } from '@/lib/outreach/channels';

const { btn, lbl, taStyle, inputStyle } = oStyles;
const fmtDay = (s: string | null) => (s ? new Date(s).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : '');
const chLabel = (k: string) => CHANNEL_BY_KEY[k]?.label || k;
const chIcon = (k: string) => CHANNEL_BY_KEY[k]?.icon || '•';

export function TaskOutreachDrawer({ projectId, prospectId, onClose, onChange, backgrounded }: {
  projectId: string; prospectId: number; onClose: () => void; onChange: () => void; backgrounded?: boolean;
}) {
  const [p, setP] = useState<OutreachProspect | null>(null);
  const [touches, setTouches] = useState<Touch[]>([]);
  const [sender, setSender] = useState<Sender>({ name: 'Jake Miller', email: 'hello@militarycalc.com' });
  const [sel, setSel] = useState<string>('');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 1800); };
  const reloadTouches = async () => setTouches(await listTouches(projectId, prospectId));
  const reloadAll = async () => { const [pr, ts] = await Promise.all([loadProspect(projectId, prospectId), listTouches(projectId, prospectId)]); setP(pr); setTouches(ts); onChange(); };
  useEffect(() => { let live = true; (async () => { const [pr, ts, sd] = await Promise.all([loadProspect(projectId, prospectId), listTouches(projectId, prospectId), getProspectSender(projectId, prospectId)]); if (!live) return; setP(pr); setTouches(ts); setSender(sd); setSel(pr?.email ? 'email' : 'contact_form'); })(); return () => { live = false; }; }, [projectId, prospectId]);

  if (!p) return <Drawer onClose={onClose} width={560} zIndex={320} backgrounded={backgrounded}><div style={{ fontSize: 13, color: 'var(--fg-3)' }}>Đang tải…</div></Drawer>;

  const primaryChannel = p.email ? 'email' : 'contact_form';
  const isPrimary = sel === primaryChannel;
  const selTouch = touches.find((t) => t.channel === sel) || null;
  const presentChannels = [primaryChannel, ...touches.map((t) => t.channel)];
  const addable = CHANNELS.filter((c) => !presentChannels.includes(c.key) && c.key !== 'email' && c.key !== 'contact_form');

  const copy = (t: string, m: string) => { navigator.clipboard?.writeText(t).then(() => flash(m)).catch(() => {}); };
  const doStatus = async (s: string) => { setBusy(s); await setProspectStatus(projectId, prospectId, s); await reloadAll(); setBusy(null); };
  const addChannel = async (channel: string) => { setBusy('add'); const r = await addTouch(projectId, prospectId, channel, ''); setBusy(null); setAdding(false); if (r.ok && r.touch) { await reloadTouches(); setSel(channel); } else flash(r.error || 'lỗi'); };
  const genTouchContent = async () => { if (!selTouch) return; setBusy('gen'); const r = await genTouch(projectId, prospectId, selTouch.id); setBusy(null); if (r.ok && r.content) { await reloadTouches(); flash('✓ đã sinh'); } else flash(r.error || 'lỗi sinh'); };
  const saveTouchField = async (patch: { targetRef?: string; content?: string }) => { if (!selTouch) return; await saveTouch(projectId, selTouch.id, patch); await reloadTouches(); };
  const markSent = async () => { if (!selTouch) return; setBusy('sent'); await markTouchSent(projectId, prospectId, selTouch.id); await reloadAll(); setBusy(null); flash('✓ đã đánh dấu gửi'); };
  const delTouch = async () => { if (!selTouch) return; setBusy('del'); await deleteTouch(projectId, selTouch.id); await reloadTouches(); setSel(primaryChannel); setBusy(null); onChange(); };

  const pill = (key: string, badge: string, active: boolean, onClick: () => void) => (
    <button key={key} type="button" onClick={onClick} title={CHANNEL_BY_KEY[key]?.tip || key}
      style={{ ...btn, fontWeight: 700, ...(active ? { borderColor: 'var(--neon-lime)', color: 'var(--neon-lime)', background: 'color-mix(in srgb, var(--neon-lime) 14%, transparent)' } : {}) }}>
      {chIcon(key)} {chLabel(key)}{badge}
    </button>
  );

  return (
    <Drawer onClose={onClose} width={560} zIndex={320} backgrounded={backgrounded}>
      {/* Header = OWNER — matches the /outreach EmailDrawer header exactly */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{p.agentName}</div>
          <div style={{ color: 'var(--fg-3)', fontSize: 12, display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
            <span>{p.base || '—'}</span><ChannelTag email={p.email || null} /><Badge status={p.status} />
          </div>
        </div>
        <button type="button" onClick={onClose} style={{ ...btn, fontSize: 14, padding: '2px 9px' }}>✕</button>
      </div>

      {/* CHANNEL BAR */}
      <div style={{ margin: '14px 0 0' }}>
        <div style={lbl}>Kênh <span style={{ color: 'var(--fg-4)' }}>· hover xem cách tiếp cận</span></div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {pill(primaryChannel, SENDABLE_DONE(p.status) ? ' ✓' : ' •', isPrimary, () => setSel(primaryChannel))}
          {touches.map((t) => pill(t.channel, t.status === 'sent' ? ' ✓' : t.status === 'replied' ? ' ↩' : ' •', sel === t.channel, () => setSel(t.channel)))}
          <div style={{ position: 'relative' }}>
            <button type="button" onClick={() => setAdding((v) => !v)} style={{ ...btn, borderStyle: 'dashed' }}>+ kênh</button>
            {adding && (
              <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 5, background: 'var(--bg-0)', border: '1px solid var(--line)', borderRadius: 8, padding: 6, boxShadow: '0 8px 24px rgba(0,0,0,.3)', maxHeight: 260, overflowY: 'auto', minWidth: 190 }}>
                {addable.length === 0 ? <div style={{ fontSize: 11, color: 'var(--fg-3)', padding: 6 }}>Đã thêm hết kênh.</div> : addable.map((c) => (
                  <button key={c.key} type="button" onClick={() => addChannel(c.key)} title={c.tip} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '5px 8px', fontSize: 12, background: 'none', border: 'none', color: 'var(--fg-1)', cursor: 'pointer', borderRadius: 5 }}>{c.icon} {c.label}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ACTIVE CHANNEL PANEL */}
      <div style={{ margin: '12px 0 0', paddingTop: 12, borderTop: '1px solid var(--line)' }}>
        {isPrimary ? (
          /* The standard email/form body, reused verbatim from /outreach */
          <OutreachEmailBody projectId={projectId} prospect={p} sender={sender} onAfterAction={reloadAll} />
        ) : selTouch ? (
          <>
            <div style={{ ...lbl, color: 'var(--fg-2)', fontSize: 11 }}>Đang: {chIcon(sel)} {chLabel(sel)}</div>
            <div style={lbl}>Tới</div>
            <input defaultValue={selTouch.targetRef} onBlur={(e) => saveTouchField({ targetRef: e.target.value })} placeholder="@handle hoặc URL profile/post của họ" autoComplete="off" style={inputStyle} />
            <div style={{ fontSize: 11.5, color: 'var(--fg-3)', margin: '0 0 8px' }}>Cách: {CHANNEL_BY_KEY[sel]?.tip}</div>
            <div style={lbl}>Nội dung ({chLabel(sel)})</div>
            <textarea value={selTouch.content} onChange={(e) => setTouches((ts) => ts.map((t) => t.id === selTouch.id ? { ...t, content: e.target.value } : t))} onBlur={(e) => saveTouchField({ content: e.target.value })} rows={6} placeholder="Bấm ✨ Sinh để AI viết theo giọng kênh này" style={taStyle} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '14px 0 0', alignItems: 'center' }}>
              <button type="button" onClick={genTouchContent} disabled={!!busy} style={{ ...btn, padding: '7px 12px', fontWeight: 700, borderColor: 'var(--accent)', color: 'var(--accent)' }}>{busy === 'gen' ? '⏳…' : '✨ Sinh'}</button>
              {selTouch.targetRef && <a href={selTouch.targetRef.startsWith('http') ? selTouch.targetRef : `https://${selTouch.targetRef.replace(/^@/, '')}`} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" style={{ ...btn, padding: '7px 12px', textDecoration: 'none', display: 'inline-block' }}>Mở {chLabel(sel)} ↗</a>}
              <button type="button" onClick={() => copy(selTouch.content, '✓ đã copy — dán vào ' + chLabel(sel))} style={{ ...btn, padding: '7px 12px' }}>Copy</button>
              {selTouch.status !== 'sent' ? <button type="button" onClick={markSent} disabled={!!busy} style={{ ...btn, padding: '7px 12px', fontWeight: 700, borderColor: 'var(--neon-lime)', color: 'var(--neon-lime)' }}>✓ Đã gửi</button> : <span style={{ fontSize: 12, color: 'var(--neon-lime)', fontWeight: 700 }}>✓ đã gửi {fmtDay(selTouch.sentAt)}</span>}
              <button type="button" onClick={delTouch} disabled={!!busy} style={{ ...btn, padding: '7px 12px', color: 'var(--bad)', borderColor: 'var(--bad)' }}>Xoá kênh</button>
            </div>
            <p style={{ fontSize: 11, color: 'var(--fg-3)', margin: '12px 0 0', lineHeight: 1.5 }}>Ext-assisted: mở {chLabel(sel)} của họ, dán nội dung, tự bấm Send, rồi ✓ Đã gửi. (Auto-paste qua ext = bản sau.)</p>
          </>
        ) : null}
      </div>

      {/* TOUCH HISTORY */}
      <div style={{ margin: '16px 0 0', paddingTop: 12, borderTop: '1px solid var(--line)' }}>
        <div style={lbl}>Lịch sử chạm</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <HistRow icon={chIcon(primaryChannel)} label={chLabel(primaryChannel)} status={<Badge status={p.status} />} day={fmtDay(p.sentAt)} />
          {touches.filter((t) => t.status === 'sent' || t.status === 'replied').map((t) => (
            <HistRow key={t.id} icon={chIcon(t.channel)} label={chLabel(t.channel)} status={<span style={{ fontSize: 11, color: t.status === 'replied' ? 'var(--neon-violet)' : 'var(--neon-cyan)' }}>{t.status === 'replied' ? 'đã hồi' : 'đã gửi'}</span>} day={fmtDay(t.sentAt)} />
          ))}
          {(!p.sentAt && touches.every((t) => t.status !== 'sent')) && <div style={{ fontSize: 11.5, color: 'var(--fg-4)' }}>Chưa chạm kênh nào.</div>}
        </div>
      </div>

      {/* ROLL-UP RESULT */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '14px 0 0', alignItems: 'center', paddingTop: 12, borderTop: '1px solid var(--line)' }}>
        <span style={{ ...lbl, margin: 0 }}>Kết quả:</span>
        <button type="button" onClick={() => doStatus('replied')} disabled={!!busy} style={btn}>Đã hồi</button>
        <button type="button" onClick={() => doStatus('interested')} disabled={!!busy} style={{ ...btn, borderColor: 'var(--neon-lime)', color: 'var(--neon-lime)' }}>Quan tâm</button>
        <button type="button" onClick={() => doStatus('declined')} disabled={!!busy} style={btn}>Từ chối</button>
      </div>

      {msg && <div style={{ fontSize: 12, color: 'var(--fg-2)', marginTop: 10 }}>{msg}</div>}
      <p style={{ fontSize: 11, color: 'var(--fg-3)', margin: '12px 0 0', lineHeight: 1.5 }}>Trạng thái đồng bộ 2 chiều với backlink task (gửi bất kỳ kênh → task chuyển &ldquo;Chờ duyệt&rdquo;).</p>
    </Drawer>
  );
}

const SENDABLE_DONE = (s: string) => ['sent', 'followup_1', 'followup_2', 'replied', 'interested', 'embedded'].includes(s);

function HistRow({ icon, label, status, day }: { icon: string; label: string; status: ReactNode; day: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11.5, color: 'var(--fg-2)' }}>
      <span style={{ width: 78, color: 'var(--fg-1)' }}>{icon} {label}</span>
      <span>{status}</span>
      {day && <span style={{ color: 'var(--fg-4)', marginLeft: 'auto' }}>{day}</span>}
    </div>
  );
}
