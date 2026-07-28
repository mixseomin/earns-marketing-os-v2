'use client';

// Multi-channel Outreach hub for a backlink task (stacked ON the task drawer, no page nav). One owner
// reached via N channels. EMAIL/FORM panel = the SAME OutreachEmailBody the /outreach page uses (one
// visual language, not a bespoke copy — see feedback about matching the house drawer). Social/comment =
// "touches" (outreach_touches), ext-assisted. Tabs · panel · touch history · roll-up.
import { useEffect, useState, type ReactNode } from 'react';
import { Drawer, GuardedButton, Collapsible, InfoHint } from '@/components/ui';
import type { OutreachProspect } from '@/lib/actions/outreach';
import { loadProspect, setProspectStatus } from '@/lib/actions/outreach-mutations';
import { listTouches, addTouch, saveTouch, genTouch, markTouchSent, deleteTouch, getProspectSender, listSendAs, type Touch, type SentAs } from '@/lib/actions/outreach-touches';
import { OutreachEmailBody, Badge, ChannelTag, oStyles, type Sender } from '@/components/outreach-email-drawer';
import { SendAsPicker } from '@/components/send-as-picker';
import { CHANNELS, CHANNEL_BY_KEY } from '@/lib/outreach/channels';

const { btn, lbl, taStyle, inputStyle } = oStyles;
const fmtDay = (s: string | null) => (s ? new Date(s).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : '');
const chLabel = (k: string) => CHANNEL_BY_KEY[k]?.label || k;
const chIcon = (k: string) => CHANNEL_BY_KEY[k]?.icon || '•';
// `sel` identifies a TAB: 'email'/'contact_form' (the primary channel on the prospect) or a touch id (string).
// Touches can repeat a channel (FB 1, FB 2…), so a tab is a touch id, not a channel key. Resolve ?ch= on load.
const resolveSel = (initial: string | undefined, ts: Touch[], primary: string): string => {
  if (!initial) return primary;
  if (initial === 'email' || initial === 'contact_form') return initial;
  if (ts.some((t) => String(t.id) === initial)) return initial;   // a specific touch id
  const byCh = ts.find((t) => t.channel === initial);             // backward-compat ?ch=facebook → first such touch
  return byCh ? String(byCh.id) : primary;
};

export function TaskOutreachDrawer({ projectId, prospectId, initialChannel, onChannel, onClose, onChange, backgrounded }: {
  projectId: string; prospectId: number; initialChannel?: string; onChannel?: (c: string) => void; onClose: () => void; onChange: () => void; backgrounded?: boolean;
}) {
  const [p, setP] = useState<OutreachProspect | null>(null);
  const [touches, setTouches] = useState<Touch[]>([]);
  const [sender, setSender] = useState<Sender>({ name: 'Jake Miller', email: 'hello@militarycalc.com' });
  const [sel, setSel] = useState<string>('');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [chQuery, setChQuery] = useState('');                // +kênh dropdown filter (§30: >5 item = searchable)
  const [flashF, setFlashF] = useState('');                  // ambient feedback: which field just auto-saved (§36)
  const [pickerOpen, setPickerOpen] = useState(false);       // <SendAsPicker> open

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 1800); };
  const reloadTouches = async () => setTouches(await listTouches(projectId, prospectId));
  const reloadAll = async () => { const [pr, ts] = await Promise.all([loadProspect(projectId, prospectId), listTouches(projectId, prospectId)]); setP(pr); setTouches(ts); onChange(); };
  useEffect(() => { let live = true; (async () => { const [pr, ts, sd] = await Promise.all([loadProspect(projectId, prospectId), listTouches(projectId, prospectId), getProspectSender(projectId, prospectId)]); if (!live) return; setP(pr); setTouches(ts); setSender(sd); setSel(resolveSel(initialChannel, ts, pr?.email ? 'email' : 'contact_form')); })(); return () => { live = false; }; /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [projectId, prospectId]);
  // Reflect the selected channel tab to the URL (?ch=) so F5 reopens on the same tab. See feedback_url_state.
  useEffect(() => { if (sel && onChannel) onChannel(sel); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [sel]);
  // Auto-default the touch's "gửi bằng" to the best match (comment-as-Page etc.) the first time, so it's
  // never empty. The full choose/create/edit/delete UI lives in <SendAsPicker>.
  useEffect(() => {
    const t = touches.find((x) => String(x.id) === sel);
    if (!t || t.sentAs?.id) return;
    let live = true;
    listSendAs(projectId, t.channel).then((o) => {
      if (!live) return;
      const d = o.find((x) => x.id > 0);   // real account only — Directus-only options (id 0) adopt on explicit pick
      if (d) { const sa = { kind: d.kind, id: d.id, label: d.label }; setTouches((ts) => ts.map((x) => x.id === t.id ? { ...x, sentAs: sa } : x)); saveTouch(projectId, t.id, { sentAs: sa }); }
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, projectId]);

  if (!p) return <Drawer onClose={onClose} width={560} zIndex={320} backgrounded={backgrounded}><div style={{ fontSize: 13, color: 'var(--fg-3)' }}>Đang tải…</div></Drawer>;

  const primaryChannel = p.email ? 'email' : 'contact_form';   // which of the two is selected by default
  const isEmailForm = sel === 'email' || sel === 'contact_form';   // both are always-present direct-channel pills
  const selTouch = touches.find((t) => String(t.id) === sel) || null;
  const addable = CHANNELS.filter((c) => c.key !== 'email' && c.key !== 'contact_form');   // dupes allowed (FB 1, FB 2…)
  const dupLabel = (t: Touch) => { const same = touches.filter((x) => x.channel === t.channel); const i = same.findIndex((x) => x.id === t.id); return same.length > 1 ? `${chLabel(t.channel)} ${i + 1}` : chLabel(t.channel); };

  const copy = (t: string, m: string) => { navigator.clipboard?.writeText(t).then(() => flash(m)).catch(() => {}); };
  const doStatus = async (s: string) => { setBusy(s); await setProspectStatus(projectId, prospectId, s); await reloadAll(); setBusy(null); };
  const addChannel = async (channel: string) => { setBusy('add'); const r = await addTouch(projectId, prospectId, channel, ''); setBusy(null); setAdding(false); if (r.ok && r.touch) { await reloadTouches(); setSel(String(r.touch.id)); } else flash(r.error || 'lỗi'); };
  const genTouchContent = async () => { if (!selTouch) return; setBusy('gen'); const r = await genTouch(projectId, prospectId, selTouch.id); setBusy(null); if (r.ok && r.content) { await reloadTouches(); flash('✓ đã sinh'); } else flash(r.error || 'lỗi sinh'); };
  const flashField = (k: string) => { setFlashF(k); setTimeout(() => setFlashF(''), 800); };
  const flashSt = (k: string) => ({ transition: 'box-shadow .2s', ...(flashF === k ? { boxShadow: '0 0 0 2px var(--neon-lime)' } : {}) });
  const saveTouchField = async (patch: { targetRef?: string; content?: string; resultUrl?: string }, k?: string) => { if (!selTouch) return; await saveTouch(projectId, selTouch.id, patch); if (k) flashField(k); await reloadTouches(); };
  const pickSentAs = (sa: SentAs) => { if (!selTouch) return; setTouches((ts) => ts.map((t) => t.id === selTouch.id ? { ...t, sentAs: sa } : t)); saveTouch(projectId, selTouch.id, { sentAs: sa }); };
  const markSent = async () => { if (!selTouch) return; if (!selTouch.sentAs?.id) { flash('Chọn "Gửi bằng" (danh tính đã dùng) trước'); return; } setBusy('sent'); await markTouchSent(projectId, prospectId, selTouch.id); await reloadAll(); setBusy(null); flash('✓ đã đánh dấu gửi'); };
  const delTouch = async () => { if (!selTouch) return; setBusy('del'); await deleteTouch(projectId, selTouch.id); await reloadTouches(); setSel(primaryChannel); setBusy(null); onChange(); };

  const pill = (key: string, channelKey: string, labelText: string, badge: string, active: boolean, onClick: () => void) => (
    <button key={key} type="button" onClick={onClick} title={CHANNEL_BY_KEY[channelKey]?.tip || channelKey}
      style={{ ...btn, fontWeight: 700, ...(active ? { borderColor: 'var(--neon-lime)', color: 'var(--neon-lime)', background: 'color-mix(in srgb, var(--neon-lime) 14%, transparent)' } : {}) }}>
      {chIcon(channelKey)} {labelText}{badge}
    </button>
  );

  return (
    <Drawer onClose={onClose} width={560} zIndex={320} backgrounded={backgrounded}>
      {/* Header = OWNER (channel-neutral — multi-channel drawer, KHÔNG neo "EMAIL" ở head). Kênh chọn ở thanh dưới. */}
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
        <div style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 5 }}>
          Kênh <span style={{ color: 'var(--fg-4)' }}>· hover xem cách tiếp cận</span>
          <InfoHint size={12}>Trạng thái đồng bộ 2 chiều với backlink task — gửi bất kỳ kênh nào thì task chuyển &ldquo;Chờ duyệt&rdquo;.</InfoHint>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {(['email', 'contact_form'] as const).map((ck) => pill(ck, ck, chLabel(ck), SENDABLE_DONE(p.status) ? ' ✓' : ' •', sel === ck, () => setSel(ck)))}
          {touches.map((t) => pill(String(t.id), t.channel, dupLabel(t), t.status === 'sent' ? ' ✓' : t.status === 'replied' ? ' ↩' : ' •', sel === String(t.id), () => setSel(String(t.id))))}
          <div style={{ position: 'relative' }}>
            <button type="button" onClick={() => { setAdding((v) => !v); setChQuery(''); }} style={{ ...btn, borderStyle: 'dashed' }}>+ kênh</button>
            {adding && (
              <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 5, background: 'var(--bg-0)', border: '1px solid var(--line)', borderRadius: 8, padding: 6, boxShadow: '0 8px 24px rgba(0,0,0,.3)', maxHeight: 280, overflowY: 'auto', minWidth: 200 }}>
                {addable.length === 0 ? <div style={{ fontSize: 11, color: 'var(--fg-3)', padding: 6 }}>Đã thêm hết kênh.</div> : (<>
                  <input autoFocus value={chQuery} onChange={(e) => setChQuery(e.target.value)} placeholder="Lọc kênh…" autoComplete="off"
                    style={{ width: '100%', padding: '5px 8px', fontSize: 12, borderRadius: 5, border: '1px solid var(--bg-3)', background: 'var(--bg-1)', color: 'var(--fg-0)', marginBottom: 5 }} />
                  {addable.filter((c) => c.label.toLowerCase().includes(chQuery.trim().toLowerCase())).map((c) => (
                    <button key={c.key} type="button" onClick={() => addChannel(c.key)} title={c.tip} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '5px 8px', fontSize: 12, background: 'none', border: 'none', color: 'var(--fg-1)', cursor: 'pointer', borderRadius: 5 }}>{c.icon} {c.label}</button>
                  ))}
                </>)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ACTIVE CHANNEL PANEL */}
      <div style={{ margin: '12px 0 0', paddingTop: 12, borderTop: '1px solid var(--line)' }}>
        {isEmailForm ? (
          /* The standard email/form body, reused verbatim from /outreach — mode = which pill is active */
          <OutreachEmailBody projectId={projectId} prospect={p} sender={sender} mode={sel === 'email' ? 'email' : 'form'} onAfterAction={reloadAll} />
        ) : selTouch ? (
          <>
            <div style={{ ...lbl, color: 'var(--fg-2)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 5 }}>
              Đang: {chIcon(selTouch.channel)} {dupLabel(selTouch)}
              <InfoHint size={12}>Cách: {CHANNEL_BY_KEY[selTouch.channel]?.tip} — mở {chLabel(selTouch.channel)} của họ, dán nội dung, tự bấm Send, rồi ✓ Đã gửi + dán URL kết quả. (Auto-paste qua ext = bản sau.)</InfoHint>
            </div>
            <div style={lbl}>Tới</div>
            <input key={'t' + selTouch.id} defaultValue={selTouch.targetRef} onBlur={(e) => saveTouchField({ targetRef: e.target.value }, 'tref')} placeholder="@handle hoặc URL profile/post của họ" autoComplete="off" style={{ ...inputStyle, ...flashSt('tref') }} />
            {/* Gửi bằng (comment/DM as) — account của platform kênh này + identities; đổi lúc nào cũng được, chốt khi ✓ Đã gửi */}
            <div style={lbl}>Gửi bằng <span style={{ color: 'var(--fg-4)' }}>· comment/DM as</span></div>
            <button type="button" onClick={() => setPickerOpen(true)} style={{ ...inputStyle, marginBottom: 8, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ color: selTouch.sentAs?.label ? 'var(--fg-0)' : 'var(--fg-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selTouch.sentAs?.label || 'Chọn danh tính (Page/account)…'}</span>
              <span style={{ color: 'var(--fg-4)', fontSize: 11, flexShrink: 0 }}>chọn / thêm ▸</span>
            </button>
            <div style={lbl}>Nội dung ({chLabel(selTouch.channel)})</div>
            <textarea value={selTouch.content} onChange={(e) => setTouches((ts) => ts.map((t) => t.id === selTouch.id ? { ...t, content: e.target.value } : t))} onBlur={(e) => saveTouchField({ content: e.target.value }, 'tcontent')} rows={6} placeholder="Bấm ✨ Sinh để AI viết theo giọng kênh này" style={{ ...taStyle, ...flashSt('tcontent') }} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '14px 0 0', alignItems: 'center' }}>
              <button type="button" onClick={genTouchContent} disabled={!!busy} style={{ ...btn, padding: '7px 12px', fontWeight: 700, borderColor: 'var(--accent)', color: 'var(--accent)' }}>{busy === 'gen' ? '⏳…' : '✨ Sinh'}</button>
              {selTouch.targetRef && <a href={selTouch.targetRef.startsWith('http') ? selTouch.targetRef : `https://${selTouch.targetRef.replace(/^@/, '')}`} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" style={{ ...btn, padding: '7px 12px', textDecoration: 'none', display: 'inline-block' }}>Mở {chLabel(selTouch.channel)} ↗</a>}
              <button type="button" onClick={() => copy(selTouch.content, '✓ đã copy — dán vào ' + chLabel(selTouch.channel))} style={{ ...btn, padding: '7px 12px' }}>Copy</button>
              {selTouch.status !== 'sent'
                ? <GuardedButton reason={!selTouch.sentAs?.id ? 'Chọn "Gửi bằng" (danh tính) trước' : ''} onClick={markSent} disabled={!!busy} style={{ ...btn, padding: '7px 12px', fontWeight: 700, borderColor: 'var(--neon-lime)', color: 'var(--neon-lime)' }}>✓ Đã gửi</GuardedButton>
                : <span style={{ fontSize: 12, color: 'var(--neon-lime)', fontWeight: 700 }}>✓ đã gửi {fmtDay(selTouch.sentAt)}</span>}
            </div>
            {/* Tracking URL — chỉ hiện SAU khi đã gửi (proof of placement, việc post-send). YDNI: ẩn tới lúc cần. */}
            {selTouch.status === 'sent' && (
              <div style={{ margin: '14px 0 0' }}>
                <div style={lbl}>URL kết quả <span style={{ color: 'var(--fg-4)' }}>· link/comment đã đặt — dán để lưu</span></div>
                <input key={'r' + selTouch.id} defaultValue={selTouch.resultUrl} onBlur={(e) => saveTouchField({ resultUrl: e.target.value }, 'trslt')} placeholder="https://facebook.com/…/posts/… (URL bài/comment vừa đăng)" autoComplete="off" style={{ ...inputStyle, ...flashSt('trslt') }} />
                {selTouch.resultUrl && <a href={selTouch.resultUrl.startsWith('http') ? selTouch.resultUrl : `https://${selTouch.resultUrl}`} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" style={{ fontSize: 11, color: 'var(--accent)' }}>↗ mở link đã đặt</a>}
              </div>
            )}
            <button type="button" onClick={delTouch} disabled={!!busy} style={{ ...btn, padding: '4px 8px', fontSize: 11, color: 'var(--fg-4)', border: 'none', background: 'none', margin: '10px 0 0' }} title="Gỡ kênh này khỏi prospect">Xoá kênh này</button>
          </>
        ) : null}
      </div>

      {/* Lịch sử + Ghi kết quả — occasional, gộp sau 1 click (YDNI §47/§52). Số kênh đã chạm hiện ở hint để liếc. */}
      {(() => {
        const done = touches.filter((t) => t.status === 'sent' || t.status === 'replied');
        const reached = (p.sentAt ? 1 : 0) + done.length;
        return (
          <Collapsible title="Lịch sử & kết quả" marginTop={16} hint={reached ? `${reached} kênh đã chạm` : 'chưa chạm'}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <HistRow icon={chIcon(primaryChannel)} label={chLabel(primaryChannel)} status={<Badge status={p.status} />} day={fmtDay(p.sentAt)} />
              {done.map((t) => (
                <HistRow key={t.id} icon={chIcon(t.channel)} label={dupLabel(t)} status={<span style={{ fontSize: 11, color: t.status === 'replied' ? 'var(--neon-violet)' : 'var(--neon-cyan)' }}>{t.status === 'replied' ? 'đã hồi' : 'đã gửi'}{t.sentAs?.label ? <span style={{ color: 'var(--fg-4)' }}> · bằng {t.sentAs.label}</span> : ''}</span>} day={fmtDay(t.sentAt)} />
              ))}
              {reached === 0 && <div style={{ fontSize: 11.5, color: 'var(--fg-4)' }}>Chưa chạm kênh nào.</div>}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '12px 0 0', alignItems: 'center' }}>
              <span style={{ ...lbl, margin: 0 }}>Ghi kết quả:</span>
              <button type="button" onClick={() => doStatus('replied')} disabled={!!busy} style={btn}>Đã hồi</button>
              <button type="button" onClick={() => doStatus('interested')} disabled={!!busy} style={{ ...btn, borderColor: 'var(--neon-lime)', color: 'var(--neon-lime)' }}>Quan tâm</button>
              <button type="button" onClick={() => doStatus('declined')} disabled={!!busy} style={btn}>Từ chối</button>
            </div>
          </Collapsible>
        );
      })()}

      {msg && <div style={{ fontSize: 12, color: 'var(--fg-2)', marginTop: 10 }}>{msg}</div>}
      {pickerOpen && selTouch && <SendAsPicker projectId={projectId} channel={selTouch.channel} value={selTouch.sentAs} onPick={(sa) => { pickSentAs(sa); setPickerOpen(false); }} onClose={() => setPickerOpen(false)} />}
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
