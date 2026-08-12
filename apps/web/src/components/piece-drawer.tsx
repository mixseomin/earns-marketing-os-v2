'use client';

// PieceDrawer — bấm pill 📝 "Bài đăng" trên lịch plays → mở TẠI CHỖ, không nhảy trang.
// 3 tab vì một bài có ba câu hỏi khác nhau vào ba thời điểm khác nhau:
//   Overview  — hôm nay đăng gì, trạng thái, khi nào (thứ người ta mở ra xem 90% số lần)
//   Prepare   — đủ điều kiện chạy chưa: nơi/giờ/account/browser/asset + chuỗi việc + caption
//   Logs      — đã đăng thật những lần nào, link đâu, số liệu ra sao
// Mọi thực thể trong tab Prepare là chip EntityRef → bấm mở đúng drawer của nó (account /
// browser-profile / media / task) ngay tại chỗ, không phải đi tra ở trang khác.

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Drawer, EntityRef } from '@/components/ui';
import { CHANNELS, STATUSES, ANGLE_GROUPS, angleOf, tagVal, tagIds } from '@/lib/content-channels';
import { updateContentPiece, getPieceDetail, type ContentInput } from '@/lib/actions/content';
import type { CalPiece } from '@/lib/data';

const lbl: React.CSSProperties = { display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-4)', marginBottom: 5, fontFamily: 'var(--font-mono)' };
const inp: React.CSSProperties = { padding: '6px 9px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--fg-1)', fontSize: 13, width: '100%' };
const missing = <em style={{ color: 'var(--neon-amber)' }}>chưa có</em>;

const STATUS_COLOR: Record<string, string> = {
  draft: 'var(--fg-3)', approved: 'var(--neon-cyan)', scheduled: 'var(--neon-amber)',
  published: 'var(--ok)', archived: 'var(--fg-4)',
};

type TabKey = 'overview' | 'prepare' | 'logs';
const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'overview', label: 'Overview' }, { key: 'prepare', label: 'Prepare' }, { key: 'logs', label: 'Logs' },
];

export function PieceDrawer({ piece, projectLabel, accounts = [], browserProfiles = [], media = [], tasks = [], onOpenTask, onClose }: {
  piece: CalPiece; projectLabel?: string; onClose: () => void;
  accounts?: Array<{ id: number; platformKey: string; handle: string | null; status: string }>;
  browserProfiles?: Array<{ id: number; label: string; externalId: string | null; lastOpenedAt: string | null }>;
  media?: Array<{ id: number; url: string; filename: string; kind: string }>;
  tasks?: Array<{ id: number; title: string; siteState: string; siteScheduledAt: string | null; publishUrl?: string | null }>;
  onOpenTask?: (id: number) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<TabKey>('overview');
  const [hook, setHook] = useState(piece.subject ?? '');
  const [date, setDate] = useState(piece.date);
  const [url, setUrl] = useState('');
  const [detail, setDetail] = useState<{ bodyMd: string; publishUrl: string | null; publishedAt: string | null; metrics: Record<string, string | number> } | null>(null);

  const ch = CHANNELS.find((c) => c.id === piece.channel);
  const a = angleOf(piece.tags);
  const place = tagVal(piece.tags, 'place');
  const time = tagVal(piece.tags, 'time');
  const acct = accounts.find((x) => x.id === Number(tagVal(piece.tags, 'acct')));
  const prof = browserProfiles.find((x) => x.id === Number(tagVal(piece.tags, 'browser')));
  // asset:media:<id,id> = ảnh đã nằm trong vault (hiện thumbnail + mở media drawer).
  const assets = tagIds(piece.tags, 'asset').map((id) => media.find((m) => m.id === id)).filter(Boolean) as Array<{ id: number; url: string; filename: string }>;
  const chain = tagIds(piece.tags, 'chain').map((id) => tasks.find((t) => t.id === id)).filter(Boolean) as NonNullable<typeof tasks>;

  useEffect(() => { getPieceDetail(piece.id, piece.projectId).then(setDetail); }, [piece.id, piece.projectId]);

  const refresh = () => start(() => router.refresh());
  const patch = async (p: Partial<ContentInput>) => {
    await updateContentPiece(piece.id, piece.projectId, p);
    refresh();
  };

  const row = (k: string, v: React.ReactNode) => (
    <><span style={{ color: 'var(--fg-4)' }}>{k}</span><span>{v}</span></>
  );

  return (
    <Drawer onClose={onClose} width={760}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>
            📝 BÀI ĐĂNG #{piece.id} · {ch?.icon} {ch?.label ?? piece.channel} · {projectLabel ?? piece.projectId}
            {a && <> · <span style={{ color: a.group.color }}>{a.group.label}/{a.angle}</span></>}
          </div>
          <h2 style={{ margin: '4px 0 0', fontSize: 17, fontWeight: 700 }}>{piece.title}</h2>
        </div>

        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--line)' }}>
          {TABS.map((t) => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)}
              style={{ padding: '6px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', background: 'transparent', border: 'none',
                color: tab === t.key ? 'var(--fg-0)' : 'var(--fg-4)', borderBottom: `2px solid ${tab === t.key ? 'var(--accent)' : 'transparent'}`, marginBottom: -1 }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'overview' && (<>
          <div>
            <label style={lbl}>Hook (dòng người đọc thấy)</label>
            <input style={inp} value={hook} onChange={(e) => setHook(e.target.value)} disabled={pending}
              onBlur={() => hook !== (piece.subject ?? '') && patch({ subject: hook })} />
          </div>
          <div>
            <label style={lbl}>Trạng thái</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {STATUSES.map((s) => {
                const on = piece.status === s;
                return (
                  <button key={s} type="button" disabled={pending} onClick={() => patch({ status: s })}
                    style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                      border: `1px solid ${on ? STATUS_COLOR[s] : 'var(--line)'}`,
                      background: on ? STATUS_COLOR[s] : 'transparent', color: on ? 'var(--bg-0)' : 'var(--fg-3)' }}>{s}</button>
                );
              })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Ngày đăng</label>
              <input type="date" style={inp} value={date} disabled={pending}
                onChange={(e) => { setDate(e.target.value); patch({ scheduledAt: e.target.value ? new Date(`${e.target.value}T09:00:00`) : null }); }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Angle</label>
              <select style={inp} disabled={pending} value={a?.angle ?? ''}
                onChange={(e) => patch({ tags: [...piece.tags.filter((t) => !t.startsWith('angle:')), ...(e.target.value ? [`angle:${e.target.value}`] : [])] })}>
                <option value="">— chưa gắn —</option>
                {ANGLE_GROUPS.map((g) => (
                  <optgroup key={g.id} label={g.label}>{g.angles.map((x) => <option key={x} value={x}>{x}</option>)}</optgroup>
                ))}
              </select>
            </div>
          </div>
        </>)}

        {tab === 'prepare' && (<>
          <div>
            <label style={lbl}>Runner cần gì để chạy</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 12px', fontSize: 12.5, alignItems: 'center' }}>
              {row('Nơi đăng', place || missing)}
              {row('Giờ', time || missing)}
              {row('Account', acct
                ? <EntityRef kind="account" id={acct.id} project={piece.projectId} label={`${acct.handle ?? acct.platformKey} · ${acct.status}`} />
                : missing)}
              {row('Browser', prof
                ? <EntityRef kind="browser-profile" id={prof.id} label={prof.label} title={prof.externalId ?? undefined} />
                : missing)}
              {row('Asset', assets.length
                ? <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    {assets.map((m) => (
                      <span key={m.id} style={{ display: 'inline-flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={m.url} alt={m.filename} style={{ width: 132, height: 132, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)', cursor: 'pointer' }}
                          onClick={() => window.open(m.url, '_blank')} />
                        <EntityRef kind="media" id={m.id} label={m.filename} />
                      </span>
                    ))}
                  </div>
                : missing)}
            </div>
          </div>

          <div>
            <label style={lbl}>Chuỗi chuẩn bị</label>
            {chain.length === 0 ? <div style={{ fontSize: 12.5, color: 'var(--neon-amber)' }}>chưa gắn chuỗi việc (tag chain:&lt;id&gt;)</div> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12.5 }}>
                {chain.map((t) => (
                  <div key={t.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ color: 'var(--fg-4)', fontFamily: 'var(--font-mono)', fontSize: 11, width: 82 }}>{t.siteScheduledAt ?? '—'}</span>
                    <EntityRef kind="task" id={t.id} project={piece.projectId} label={t.title} onOpen={onOpenTask ? () => onOpenTask(t.id) : undefined} />
                    <span style={{ marginLeft: 'auto', color: ['completed', 'verified'].includes(t.siteState) ? 'var(--ok)' : 'var(--fg-4)' }}>{t.siteState}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label style={lbl}>Caption sẽ đăng</label>
            <textarea readOnly value={detail?.bodyMd || '(chưa soạn)'} rows={9}
              style={{ ...inp, fontFamily: 'var(--font-mono)', fontSize: 11.5, lineHeight: 1.5, resize: 'vertical' }} />
            <button type="button" onClick={() => navigator.clipboard?.writeText(detail?.bodyMd ?? '')} disabled={!detail?.bodyMd}
              style={{ marginTop: 5, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--line)', background: 'transparent', color: 'var(--fg-3)', fontSize: 11.5, cursor: 'pointer' }}>
              Copy caption
            </button>
          </div>

          <button type="button" onClick={() => router.push(`/p/${piece.projectId}/studio?m=edit&mId=${piece.id}`)}
            style={{ alignSelf: 'flex-start', padding: '5px 10px', borderRadius: 6, border: '1px solid var(--line)', background: 'transparent', color: 'var(--fg-3)', fontSize: 12, cursor: 'pointer' }}>
            ✎ Soạn nội dung đầy đủ ở Studio
          </button>
        </>)}

        {tab === 'logs' && (<>
          <div>
            <label style={lbl}>Đã đăng → dán link</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input style={inp} placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} disabled={pending} />
              <button type="button" disabled={pending || !url.trim()}
                onClick={() => patch({ publishUrl: url.trim(), publishedAt: new Date(), status: 'published' })}
                style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--ok)', background: 'var(--ok)', color: 'var(--bg-0)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Đã đăng
              </button>
            </div>
          </div>

          <div>
            <label style={lbl}>Lần đăng thật</label>
            {(() => {
              // Bài này + mọi card publish trong chuỗi đã dán URL = lịch sử đăng thật.
              const logs = [
                ...(detail?.publishUrl ? [{ at: detail.publishedAt, url: detail.publishUrl, from: 'bài' }] : []),
                ...chain.filter((t) => t.publishUrl).map((t) => ({ at: t.siteScheduledAt, url: t.publishUrl!, from: `task #${t.id}` })),
              ];
              if (!logs.length) return <div style={{ fontSize: 12.5, color: 'var(--fg-4)' }}>chưa đăng lần nào</div>;
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12.5 }}>
                  {logs.map((l, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8 }}>
                      <span style={{ color: 'var(--fg-4)', fontFamily: 'var(--font-mono)', fontSize: 11, width: 150 }}>{l.at ? String(l.at).slice(0, 16).replace('T', ' ') : '—'}</span>
                      <a href={l.url} target="_blank" rel="noreferrer" style={{ color: 'var(--neon-blue)', wordBreak: 'break-all' }}>{l.url}</a>
                      <span style={{ marginLeft: 'auto', color: 'var(--fg-4)' }}>{l.from}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          <div>
            <label style={lbl}>Số liệu</label>
            {detail && Object.keys(detail.metrics ?? {}).length > 0 ? (
              <div style={{ display: 'flex', gap: 14, fontSize: 12.5 }}>
                {Object.entries(detail.metrics).map(([k, v]) => (
                  <span key={k}><span style={{ color: 'var(--fg-4)' }}>{k} </span><b>{String(v)}</b></span>
                ))}
              </div>
            ) : <div style={{ fontSize: 12.5, color: 'var(--fg-4)' }}>chưa có (điền reach/click sau 7 ngày để so angle nào ăn)</div>}
          </div>
        </>)}
      </div>
    </Drawer>
  );
}
