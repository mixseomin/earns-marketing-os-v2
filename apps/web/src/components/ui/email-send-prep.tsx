'use client';

// EmailSendPrep — the send-ready package for a 📧 email-issue task. Shows the REAL email in
// detail (from · subject A/B · preheader · body as the recipient sees it) plus the recipient
// list, the send time, and the offer link — all prepared before sending. Read-view by default
// (YDNI), one ✏️ to edit. Lazy-loads prep_payload.email. Standard across every email card.

import { useEffect, useState } from 'react';
import { getEmailPrep, saveEmailPrep, generateEmailPrep, getSendStats, type SendStats, type LinkClick } from '@/lib/actions/email-prep';
import { EMPTY_EMAIL_PREP, type EmailPrep, type EmailSource, isFreshSource, sourceAgeDays, MAX_SOURCE_AGE_DAYS } from '@/lib/email-prep-shape';
import { CampaignLinkPicker } from './campaign-link-picker';

const lbl: React.CSSProperties = { fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--fg-3)', marginBottom: 3 };
const field: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '5px 8px', background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 5, color: 'var(--fg-0)', fontSize: 12 };
const btn: React.CSSProperties = { padding: '3px 10px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5, color: 'var(--fg-1)', fontSize: 11, cursor: 'pointer' };
const meta: React.CSSProperties = { fontSize: 12, color: 'var(--fg-1)' };

// Render body with markdown links [text](url) as anchors (never a naked tracking URL) and bare URLs
// autolinked to a short label - what the recipient will actually see, not the raw link.
function renderBody(md: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s)]+)/g;
  let last = 0, m: RegExpExecArray | null, k = 0;
  while ((m = re.exec(md))) {
    if (m.index > last) out.push(md.slice(last, m.index));
    const url = m[2] || m[3] || '';
    const text = m[1] || url.replace(/^https?:\/\/(www\.)?/, '').split(/[/?]/)[0];
    out.push(<a key={k++} href={url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>{text}</a>);
    last = re.lastIndex;
  }
  if (last < md.length) out.push(md.slice(last));
  return out;
}

function fmtDate(s?: string | null): string {
  if (!s) return '— chưa lên lịch';
  const d = new Date(`${s}T00:00:00`);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function EmailSendPrep({ taskId, defaultSendAt }: { taskId: number; defaultSendAt?: string | null }) {
  const [prep, setPrep] = useState<EmailPrep | null | undefined>(undefined); // undefined = loading
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EmailPrep>(EMPTY_EMAIL_PREP);
  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState<string | null>(null);
  const [send, setSend] = useState<{ sentAt?: string; sentCount?: number; stats?: SendStats; links?: LinkClick[] } | null>(null);
  const [statsBusy, setStatsBusy] = useState(false);
  const refreshStats = async () => {
    setStatsBusy(true);
    const r = await getSendStats(taskId).catch(() => null);
    setStatsBusy(false);
    if (r?.ok && r.sentAt) setSend(r);
  };

  useEffect(() => {
    let live = true;
    getEmailPrep(taskId).then((p) => { if (live) setPrep(p); }).catch(() => { if (live) setPrep(null); });
    getSendStats(taskId).then((r) => { if (live && r.ok && r.sentAt) setSend(r); }).catch(() => {});
    return () => { live = false; };
  }, [taskId]);

  const startEdit = () => {
    setDraft(prep ?? { ...EMPTY_EMAIL_PREP });
    setEditing(true);
  };
  const save = async () => {
    setSaving(true);
    const r = await saveEmailPrep(taskId, draft);
    setSaving(false);
    if (r.ok) { setPrep(draft); setEditing(false); }
  };
  const set = (k: keyof EmailPrep) => (v: string) => setDraft((d) => ({ ...d, [k]: v }));
  const genAI = async () => {
    setAiBusy(true); setAiErr(null);
    const r = await generateEmailPrep(taskId, { offerLabel: draft.offerLabel, offerUrl: draft.offerUrl, segment: draft.segment, audience: draft.listName, sources: draft.sources, articleUrl: draft.articleUrl });
    setAiBusy(false);
    if (!r.ok) { setAiErr(r.error || 'lỗi AI'); return; }
    setDraft((d) => ({ ...d, subject: r.subjectA || d.subject, subjectB: r.subjectB || d.subjectB, preheader: r.preheader || d.preheader, bodyMd: r.bodyMd || d.bodyMd, articleMd: r.articleMd || d.articleMd, keyPoints: r.keyPoints?.length ? r.keyPoints : d.keyPoints }));
  };
  const hasOffer = !!draft.offerLabel.trim();
  const freshCount = draft.sources.filter((s) => s.url?.trim() && isFreshSource(s.date)).length;
  const canGen = hasOffer && freshCount > 0;
  const setSrc = (i: number, k: keyof EmailSource) => (v: string) => setDraft((d) => ({ ...d, sources: d.sources.map((s, j) => j === i ? { ...s, [k]: v } : s) }));
  const addSrc = () => setDraft((d) => ({ ...d, sources: [...d.sources, { title: '', url: '', date: '', publisher: '' }] }));
  const rmSrc = (i: number) => setDraft((d) => ({ ...d, sources: d.sources.filter((_, j) => j !== i) }));

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
          {/* Offer-first + source-first: AI stays locked until an offer AND ≥1 fresh source exist. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px', borderRadius: 6, border: '1px dashed var(--accent)', background: 'color-mix(in srgb, var(--accent) 6%, transparent)' }}>
            <div>
              <div style={lbl}>Bước 1 · Offer / sản phẩm chèn (AI viết mail bám theo cái này)</div>
              <CampaignLinkPicker value={draft.offerUrl} onChange={(v) => setDraft((d) => ({ ...d, offerUrl: v }))} />
              <input value={draft.offerLabel} onChange={(e) => set('offerLabel')(e.target.value)} style={{ ...field, marginTop: 5 }} placeholder="Nhãn offer (vd Walk-In Lab)" />
            </div>
            <div>
              <div style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 6 }}>
                Bước 2 · Nguồn tin (≥1, có link + ngày ≤{MAX_SOURCE_AGE_DAYS} ngày — để kiểm chứng)
                {draft.sources.length > 0 && <span style={{ color: freshCount ? 'var(--ok,#22c55e)' : 'var(--neon-amber)' }}>· {freshCount}/{draft.sources.length} còn mới</span>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {draft.sources.map((s, i) => {
                  const age = sourceAgeDays(s.date);
                  const fresh = !!s.url?.trim() && isFreshSource(s.date);
                  const tone = fresh ? 'var(--ok,#22c55e)' : (s.date ? 'var(--bad,#ef4444)' : 'var(--fg-4)');
                  return (
                    <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                      <input value={s.title} onChange={(e) => setSrc(i, 'title')(e.target.value)} style={{ ...field, flex: 2, minWidth: 120 }} placeholder="Tiêu đề tin" />
                      <input value={s.url} onChange={(e) => setSrc(i, 'url')(e.target.value)} style={{ ...field, flex: 3, minWidth: 160 }} placeholder="https:// link nguồn (nội bộ/thật)" />
                      <input value={s.publisher || ''} onChange={(e) => setSrc(i, 'publisher')(e.target.value)} style={{ ...field, flex: 1, minWidth: 80 }} placeholder="Nguồn" />
                      <input type="date" value={s.date} onChange={(e) => setSrc(i, 'date')(e.target.value)} style={{ ...field, width: 130, colorScheme: 'dark', borderColor: tone }} />
                      <span title={fresh ? 'còn mới' : 'quá 1 tháng / thiếu link'} style={{ fontSize: 10.5, color: tone, minWidth: 54 }}>{age == null ? '—' : fresh ? `🟢 ${age}d` : `🔴 ${age}d`}</span>
                      <button type="button" onClick={() => rmSrc(i)} style={{ ...btn, padding: '3px 7px' }}>✕</button>
                    </div>
                  );
                })}
                <button type="button" onClick={addSrc} style={{ ...btn, alignSelf: 'flex-start' }}>＋ Thêm nguồn</button>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
              <button type="button" onClick={genAI} disabled={aiBusy || !canGen} title={canGen ? '' : 'Cần offer + ≥1 nguồn tin còn mới'} style={{ ...btn, fontWeight: 700, color: canGen ? 'var(--accent)' : 'var(--fg-4)', borderColor: canGen ? 'var(--accent)' : 'var(--line)', cursor: canGen ? 'pointer' : 'not-allowed', opacity: canGen ? 1 : 0.6 }}>{aiBusy ? '⏳ AI đang soạn…' : '✨ Bước 3 · AI soạn email'}</button>
              <span style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>{canGen ? 'offer + nguồn tin + nội dung card → tin trước, offer dẫn cuối · key points' : !hasOffer ? 'chọn offer trước' : 'thêm ≥1 nguồn tin còn mới (≤1 tháng)'}</span>
              {aiErr && <span style={{ fontSize: 10.5, color: 'var(--bad,#ef4444)' }}>⚠ {aiErr}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}><div style={lbl}>From name</div><input value={draft.fromName} onChange={(e) => set('fromName')(e.target.value)} style={field} placeholder="MilitaryCalc" /></div>
            <div style={{ flex: 1 }}><div style={lbl}>From email</div><input value={draft.fromEmail} onChange={(e) => set('fromEmail')(e.target.value)} style={field} placeholder="news@militarycalc.com" /></div>
          </div>
          <div><div style={lbl}>Subject A</div><input value={draft.subject} onChange={(e) => set('subject')(e.target.value)} style={field} /></div>
          <div><div style={lbl}>Subject B (A/B, tuỳ chọn)</div><input value={draft.subjectB} onChange={(e) => set('subjectB')(e.target.value)} style={field} /></div>
          <div><div style={lbl}>Preheader (preview inbox)</div><input value={draft.preheader} onChange={(e) => set('preheader')(e.target.value)} style={field} /></div>
          <div><div style={lbl}>📄 Bài full (đăng lên site — militarycalc /guides) </div><textarea value={draft.articleMd} onChange={(e) => set('articleMd')(e.target.value)} rows={12} style={{ ...field, resize: 'vertical', fontFamily: 'var(--font-mono)', lineHeight: 1.5 }} placeholder="AI sinh bài full (## H2 sections) — đăng lên site, offer anchor + disclosure" /></div>
          <div><div style={lbl}>🔗 URL bài đã đăng (mail tóm tắt link về đây)</div><input value={draft.articleUrl} onChange={(e) => set('articleUrl')(e.target.value)} style={field} placeholder="https://militarycalc.com/guides/<slug> — điền sau khi publish rồi soạn lại mail" /></div>
          <div><div style={lbl}>✉ Mail — bản tóm tắt (dẫn về bài + offer)</div><textarea value={draft.bodyMd} onChange={(e) => set('bodyMd')(e.target.value)} rows={9} style={{ ...field, resize: 'vertical', fontFamily: 'var(--font-mono)', lineHeight: 1.5 }} /></div>
          <div><div style={lbl}>🎯 Key points (nội dung chính — mỗi dòng 1 ý)</div><textarea value={draft.keyPoints.join('\n')} onChange={(e) => setDraft((d) => ({ ...d, keyPoints: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) }))} rows={4} style={{ ...field, resize: 'vertical', lineHeight: 1.5 }} placeholder="AI tự điền khi soạn · tin trước → offer dẫn cuối" /></div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ flex: 2, minWidth: 160 }}><div style={lbl}>Danh sách</div><input value={draft.listName} onChange={(e) => set('listName')(e.target.value)} style={field} placeholder="MilitaryCalc list" /></div>
            <div style={{ flex: 2, minWidth: 160 }}><div style={lbl}>Segment</div><input value={draft.segment} onChange={(e) => set('segment')(e.target.value)} style={field} placeholder="Engaged (opened ≤90d)" /></div>
            <div style={{ flex: 1, minWidth: 80 }}><div style={lbl}>Số gửi</div><input value={draft.recipientCount} onChange={(e) => set('recipientCount')(e.target.value)} style={field} placeholder="~800" /></div>
            <div style={{ flex: 1, minWidth: 80 }}><div style={lbl}>Tổng list</div><input value={draft.listTotal} onChange={(e) => set('listTotal')(e.target.value)} style={field} placeholder="11,028" /></div>
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--fg-4)' }}>📅 Ngày gửi = theo lịch card: <b style={{ color: 'var(--fg-2)' }}>{fmtDate(defaultSendAt)}</b> — đổi trên calendar/lịch (tuỳ chiến lược), không ở đây.</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 110 }}><div style={lbl}>🕐 Giờ gửi</div><input type="time" value={draft.sendTime} onChange={(e) => set('sendTime')(e.target.value)} style={{ ...field, colorScheme: 'dark' }} /></div>
            <div style={{ flex: 2, minWidth: 200 }}><div style={lbl}>Vì sao giờ này (phân tích nhu cầu)</div><input value={draft.sendTimeWhy} onChange={(e) => set('sendTimeWhy')(e.target.value)} style={field} placeholder="vd: 07:00 check trước giờ trực · 19:30 sau bữa tối" /></div>
            <div style={{ flex: 1, minWidth: 110 }}><div style={lbl}>Provider</div><input value={draft.provider} onChange={(e) => set('provider')(e.target.value)} style={field} placeholder="Mailjet" /></div>
            <div style={{ minWidth: 120 }}><div style={lbl}>Trạng thái</div>
              <select value={draft.status} onChange={(e) => set('status')(e.target.value)} style={field}>
                <option value="draft">draft</option>
                <option value="ready">sẵn sàng gửi</option>
              </select>
            </div>
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
          {/* Send results — live Mailjet stats once the issue is sent (this is where you track it) */}
          {send?.sentAt && send.stats && (() => {
            const st = send.stats; const base = st.delivered || st.processed || 1;
            const pct = (n: number) => `${Math.round((n / base) * 100)}%`;
            const cell = (label: string, val: string | number, sub?: string, tone?: string) => (
              <div style={{ flex: 1, minWidth: 72, padding: '6px 8px', background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 6 }}>
                <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-3)' }}>{label}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: tone || 'var(--fg-0)' }}>{val}</div>
                {sub && <div style={{ fontSize: 9.5, color: 'var(--fg-4)' }}>{sub}</div>}
              </div>
            );
            return (
              <div style={{ border: '1px solid var(--accent)', borderRadius: 8, background: 'color-mix(in srgb, var(--accent) 5%, transparent)', padding: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ ...lbl, marginBottom: 0, color: 'var(--accent)' }}>📊 Kết quả gửi · {new Date(send.sentAt).toLocaleString('vi-VN')} · {send.sentCount || st.processed} gửi</span>
                  <span style={{ flex: 1 }} />
                  <button type="button" onClick={refreshStats} disabled={statsBusy} title="Cập nhật số liệu vùng này" style={{ ...btn, padding: '2px 9px', color: 'var(--accent)', borderColor: 'var(--accent)' }}>{statsBusy ? '⏳' : '↻ Cập nhật'}</button>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {cell('Delivered', st.delivered, pct(st.delivered))}
                  {cell('Mở', st.opened, pct(st.opened), 'var(--ok,#22c55e)')}
                  {cell('Click', st.clicked, pct(st.clicked), 'var(--accent)')}
                  {cell('Bounce', st.bounced, pct(st.bounced), st.bounced ? 'var(--neon-amber)' : undefined)}
                  {cell('Unsub', st.unsub, pct(st.unsub))}
                  {cell('Spam', st.spam, '', st.spam ? 'var(--bad,#ef4444)' : undefined)}
                </div>
                {send.links && send.links.length > 0 && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--line)' }}>
                    <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-3)', marginBottom: 4 }}>Click theo link</div>
                    {send.links.map((l, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 11.5, padding: '2px 0' }}>
                        <span style={{ minWidth: 26, fontWeight: 700, color: l.label === 'Offer' ? 'var(--accent)' : 'var(--fg-0)' }}>{l.clicks}</span>
                        <span style={{ minWidth: 96, color: l.label === 'Offer' ? 'var(--accent)' : 'var(--fg-1)' }}>{l.label}</span>
                        <a href={l.url} target="_blank" rel="noreferrer" style={{ color: 'var(--fg-4)', fontSize: 10.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.url.replace(/^https?:\/\/(www\.)?/, '')}</a>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: 10, color: 'var(--fg-4)', marginTop: 6 }}>Guide pageview đo thêm ở GA/PostHog militarycalc → <a href={prep.articleUrl || '#'} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>mở bài ↗</a></div>
              </div>
            );
          })()}
          {/* Inbox-style preview — as the recipient sees it */}
          <div style={{ border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg-1)', overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--line)' }}>
              <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>From: <span style={{ color: 'var(--fg-1)' }}>{prep.fromName || '—'} &lt;{prep.fromEmail || '—'}&gt;</span></div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--fg-0)', marginTop: 2 }}>{prep.subject || '(chưa có subject)'}</div>
              {prep.subjectB && <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 1 }}>A/B: {prep.subjectB}</div>}
              {prep.preheader && <div style={{ fontSize: 11.5, color: 'var(--fg-3)', marginTop: 2, fontStyle: 'italic' }}>{prep.preheader}</div>}
            </div>
            <div style={{ padding: '10px 12px', fontSize: 12.5, color: 'var(--fg-1)', whiteSpace: 'pre-wrap', lineHeight: 1.55, maxHeight: 300, overflowY: 'auto' }}>
              {prep.bodyMd ? renderBody(prep.bodyMd) : <span style={{ color: 'var(--fg-4)' }}>(chưa có nội dung)</span>}
            </div>
          </div>
          {/* Full article — the on-site asset the email drives to (measures interest + SEO) */}
          {(prep.articleMd || prep.articleUrl) && (
            <details style={{ border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg-1)', padding: '8px 12px' }}>
              <summary style={{ cursor: 'pointer', fontSize: 11.5, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ ...lbl, marginBottom: 0 }}>📄 Bài full trên site</span>
                {prep.articleUrl
                  ? <a href={prep.articleUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: 'var(--accent)' }}>{prep.articleUrl.replace(/^https?:\/\/(www\.)?/, '')} ↗</a>
                  : <span style={{ color: 'var(--neon-amber)' }}>chưa publish — điền URL để mail dẫn về</span>}
              </summary>
              {prep.articleMd && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--line)', fontSize: 12, color: 'var(--fg-1)', whiteSpace: 'pre-wrap', lineHeight: 1.55, maxHeight: 360, overflowY: 'auto' }}>{renderBody(prep.articleMd)}</div>
              )}
            </details>
          )}
          {/* Key points — the email's gist at a glance */}
          {prep.keyPoints?.length > 0 && (
            <div style={{ border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg-1)', padding: '8px 12px' }}>
              <div style={{ ...lbl, marginBottom: 5 }}>🎯 Nội dung chính</div>
              <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {prep.keyPoints.map((k, i) => <li key={i} style={{ fontSize: 12, color: 'var(--fg-1)', lineHeight: 1.45 }}>{k}</li>)}
              </ul>
            </div>
          )}
          {/* Sources — every news claim traceable + fresh */}
          {prep.sources?.length > 0 && (
            <div style={{ border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg-1)', padding: '8px 12px' }}>
              <div style={{ ...lbl, marginBottom: 5 }}>📎 Nguồn tin (kiểm chứng · ≤{MAX_SOURCE_AGE_DAYS} ngày)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {prep.sources.map((s, i) => {
                  const age = sourceAgeDays(s.date);
                  const fresh = isFreshSource(s.date);
                  return (
                    <div key={i} style={{ fontSize: 11.5, color: 'var(--fg-1)', display: 'flex', gap: 6, alignItems: 'baseline' }}>
                      <span style={{ color: fresh ? 'var(--ok,#22c55e)' : 'var(--bad,#ef4444)', fontSize: 10.5, minWidth: 44 }}>{age == null ? '—' : fresh ? `🟢 ${age}d` : `🔴 ${age}d`}</span>
                      <a href={s.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>{s.title || s.url}</a>
                      <span style={{ color: 'var(--fg-4)' }}>{s.publisher ? `· ${s.publisher} ` : ''}· {s.date || 'chưa có ngày'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {/* Send meta */}
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '5px 10px', alignItems: 'baseline' }}>
            <span style={lbl}>👥 Danh sách</span>
            <span style={meta}>{prep.listName || '—'}{prep.segment ? ` · ${prep.segment}` : ''}{prep.recipientCount ? ` · ${prep.recipientCount}${prep.listTotal ? ` / ${prep.listTotal}` : ''}` : ''}</span>
            <span style={lbl}>📅 Ngày gửi</span>
            <span style={meta}>{fmtDate(defaultSendAt)} <span style={{ color: 'var(--fg-4)', fontSize: 10.5 }}>· theo lịch (đổi ở calendar)</span></span>
            <span style={lbl}>🕐 Giờ gửi</span>
            <span style={meta}>{prep.sendTime || <span style={{ color: 'var(--fg-4)' }}>— chưa đặt</span>}{prep.provider ? ` · qua ${prep.provider}` : ''}{prep.sendTimeWhy ? <span style={{ color: 'var(--fg-4)', fontSize: 10.5 }}> · {prep.sendTimeWhy}</span> : null}</span>
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
