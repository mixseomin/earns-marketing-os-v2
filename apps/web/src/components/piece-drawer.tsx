'use client';

// PieceDrawer — bấm pill 📝 "Bài đăng" trên lịch plays → mở TẠI CHỖ, không nhảy trang.
// 3 tab vì một bài có ba câu hỏi khác nhau vào ba thời điểm khác nhau:
//   Overview  — hôm nay đăng gì, trạng thái, khi nào (thứ người ta mở ra xem 90% số lần)
//   Prepare   — đủ điều kiện chạy chưa: nơi/giờ/account/browser/asset + chuỗi việc + caption
//   Logs      — đã đăng thật những lần nào, link đâu, số liệu ra sao
// Mọi thực thể trong tab Prepare là chip EntityRef → bấm mở đúng drawer của nó (account /
// browser-profile / media / task) ngay tại chỗ, không phải đi tra ở trang khác.

import { useCallback, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Drawer, EntityRef, EntityPicker, type EntityOption } from '@/components/ui';
import { readManagedPages } from '@/components/account-metrics';
import { ChannelFavicon } from '@/components/ui';
import { CHANNELS, STATUSES, ANGLE_GROUPS, STYLES, CHANNEL_PLATFORM, angleOf, formatOf, formatsFor, styleOf, tagVal, tagIds, pieceGaps, pieceRisks } from '@/lib/content-channels';
import { updateContentPiece, createContentPiece, checkPieceLinks, getPieceDetail, type ContentInput } from '@/lib/actions/content';
import { todayLocal } from '@/lib/local-day';
import { PiecePreview, forgetPieceBody } from '@/components/piece-preview';
import type { CalPiece } from '@/lib/data';

const lbl: React.CSSProperties = { display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-4)', marginBottom: 5, fontFamily: 'var(--font-mono)' };
const inp: React.CSSProperties = { padding: '6px 9px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--fg-1)', fontSize: 13, width: '100%' };
const pickBtn: React.CSSProperties = { padding: '3px 9px', borderRadius: 6, border: '1px dashed var(--line)', background: 'transparent', color: 'var(--fg-3)', fontSize: 11.5, cursor: 'pointer' };

const STATUS_COLOR: Record<string, string> = {
  draft: 'var(--fg-3)', approved: 'var(--neon-cyan)', scheduled: 'var(--neon-amber)',
  published: 'var(--ok)', archived: 'var(--fg-4)',
};

type TabKey = 'overview' | 'prepare' | 'logs';
const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'overview', label: 'Overview' }, { key: 'prepare', label: 'Prepare' }, { key: 'logs', label: 'Logs' },
];

export function PieceDrawer({ piece, projectLabel, accounts = [], browserProfiles = [], media = [], tasks = [], replies = [], onOpenPiece, onOpenTask, onClose }: {
  piece: CalPiece; projectLabel?: string; onClose: () => void;
  /** Comment đầu đã có của bài này (piece con, tag replyto:) */
  replies?: CalPiece[];
  /** Mở một bài khác trong cùng drawer stack (dùng để nhảy từ comment sang bài cha). */
  onOpenPiece?: (id: number) => void;
  accounts?: Array<{ id: number; platformKey: string; handle: string | null; status: string; browserProfileId?: number | null; accountStats?: Record<string, unknown> }>;
  browserProfiles?: Array<{ id: number; label: string; externalId: string | null; lastOpenedAt: string | null }>;
  media?: Array<{ id: number; url: string; filename: string; kind: string }>;
  tasks?: Array<{ id: number; title: string; siteState: string; siteScheduledAt: string | null; publishUrl?: string | null }>;
  onOpenTask?: (id: number) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<TabKey>('overview');
  const [pick, setPick] = useState<null | 'acct' | 'browser' | 'asset' | 'chain' | 'place' | 'angle' | 'format' | 'style'>(null);
  const [editBody, setEditBody] = useState(false);
  const [linkMsg, setLinkMsg] = useState<string>('');
  const [hook, setHook] = useState(piece.subject ?? '');
  const [date, setDate] = useState(piece.date);
  const [url, setUrl] = useState('');
  const [detail, setDetail] = useState<{ bodyMd: string; publishUrl: string | null; publishedAt: string | null; metrics: Record<string, string | number> } | null>(null);

  const ch = CHANNELS.find((c) => c.id === piece.channel);
  const a = angleOf(piece.tags);
  const fmt = formatOf(piece.tags);
  const sty = styleOf(piece.tags);
  const place = tagVal(piece.tags, 'place');
  const time = tagVal(piece.tags, 'time');
  const acct = accounts.find((x) => x.id === Number(tagVal(piece.tags, 'acct')));
  // Profile: tag thắng, không có thì lấy profile gắn sẵn của account. (Viết gộp vào 1 biểu thức
  // find() là sai: `===` bám chặt hơn `||` nên nó luôn khớp phần tử đầu.)
  const profId = Number(tagVal(piece.tags, 'browser')) || acct?.browserProfileId || 0;
  const prof = browserProfiles.find((x) => x.id === profId);
  const assetIds = tagIds(piece.tags, 'asset');
  // Nơi đăng = Page mà CHÍNH account đó quản (account_stats.pages) — đọc qua readManagedPages,
  // nguồn dùng chung với /environments + bảng Accounts, không tự bới jsonb ở đây.
  const managed = readManagedPages(acct?.accountStats).pages;
  const placeLabel = managed.find((p) => p.url === place)?.name ?? place;
  // asset:media:<id,id> = ảnh đã nằm trong vault (hiện thumbnail + mở media drawer).
  const assets = tagIds(piece.tags, 'asset').map((id) => media.find((m) => m.id === id)).filter(Boolean) as Array<{ id: number; url: string; filename: string }>;
  const chainIds = tagIds(piece.tags, 'chain');
  const chain = chainIds.map((id) => tasks.find((t) => t.id === id)).filter(Boolean) as NonNullable<typeof tasks>;
  const gaps = pieceGaps(piece, { accounts, browserProfiles, media, tasks, today: todayLocal() });
  const risks = pieceRisks(piece, { replies });
  const parentId = Number(tagVal(piece.tags, 'replyto')) || 0;

  useEffect(() => { getPieceDetail(piece.id, piece.projectId).then(setDetail); }, [piece.id, piece.projectId]);

  const refresh = () => start(() => router.refresh());
  const patch = async (p: Partial<ContentInput>) => {
    await updateContentPiece(piece.id, piece.projectId, p);
    forgetPieceBody(piece.id);   // bản dựng ở lịch/feed đang nhớ thân bài cũ
    refresh();
  };
  /** Ghi 1 khoá của lược đồ tag (angle:/acct:/browser:/asset:…) — thiếu thì CHỌN ngay tại đây,
   *  không phải nhớ cú pháp tag rồi đi gõ ở chỗ khác. */
  const setTag = (k: string, v: string) => patch({ tags: [...piece.tags.filter((t) => !t.startsWith(`${k}:`)), ...(v ? [`${k}:${v}`] : [])] });

  // Danh sách cho EntityPicker: lấy từ dữ liệu trang ĐÃ tải, không gọi thêm. useCallback bắt buộc —
  // picker nạp lại mỗi khi `load` đổi định danh, truyền arrow trần vào là lặp vô hạn.
  const loadAccounts = useCallback(async (): Promise<EntityOption[]> => accounts
    .map((x) => ({ key: `a:${x.id}`, label: x.handle ?? x.platformKey, sub: `${x.platformKey} · ${x.status}`, fallbackIcon: '👤', match: x.platformKey === CHANNEL_PLATFORM[piece.channel], data: x }))
    .sort((p, n) => Number(n.match) - Number(p.match)), [accounts, piece.channel]);
  const loadProfiles = useCallback(async (): Promise<EntityOption[]> => browserProfiles
    .map((x) => ({ key: `b:${x.id}`, label: x.label, sub: x.externalId ?? '', fallbackIcon: '🖥', data: x })), [browserProfiles]);
  const loadMedia = useCallback(async (): Promise<EntityOption[]> => media
    .filter((m) => m.kind === 'image')
    .map((m) => ({ key: `m:${m.id}`, label: m.filename, avatar: m.url, data: m })), [media]);
  const loadPlaces = useCallback(async (): Promise<EntityOption[]> => managed
    .map((p) => ({ key: `pg:${p.url}`, label: p.name, sub: p.url.replace(/^https?:\/\/(www\.)?/, ''), fallbackIcon: '📍', data: p })), [managed]);
  // Kiểu bài đổi theo KÊNH: fb-post có album/poll/share, blog thì không. Đưa cả 13 kiểu ra chọn là
  // mời người ta gắn sai (rồi runner đi tìm nút không tồn tại).
  const loadFormats = useCallback(async (): Promise<EntityOption[]> => formatsFor(piece.channel)
    .map((f) => ({ key: `fmt:${f.id}`, label: f.label, sub: f.icon, fallbackIcon: f.icon, data: { format: f.id } })), [piece.channel]);
  const loadStyles = useCallback(async (): Promise<EntityOption[]> => STYLES
    .map((x) => ({ key: `sty:${x.id}`, label: x.label, sub: x.hint, fallbackIcon: x.icon, data: { style: x.id } })), []);
  const loadAngles = useCallback(async (): Promise<EntityOption[]> => ANGLE_GROUPS
    .flatMap((g) => g.angles.map((x) => ({ key: `ang:${x}`, label: x, sub: g.label, fallbackIcon: '◆', data: { angle: x } }))), []);
  // Card chuẩn bị = việc trên chính board này (produce/review/publish), chưa xong xếp trước.
  const loadTasks = useCallback(async (): Promise<EntityOption[]> => tasks
    .filter((t) => !chainIds.includes(t.id))
    .map((t) => ({ key: `t:${t.id}`, label: t.title, sub: `#${t.id} · ${t.siteState}${t.siteScheduledAt ? ` · ${t.siteScheduledAt.slice(0, 10)}` : ''}`, fallbackIcon: '🗂', data: t }))
    .sort((p, n) => Number(String(p.sub).includes('completed')) - Number(String(n.sub).includes('completed'))), [tasks, chainIds]);

  /** Một dòng "runner cần gì". `need` = ô này PHỤ THUỘC thứ chưa có → khoá lại + nói rõ thiếu gì,
   *  thay vì để bấm vào rồi mở ra danh sách rỗng (ô "nơi đăng" chỉ có dữ liệu sau khi chọn account:
   *  page là page CỦA account đó). Dòng phụ thuộc cũng phải nằm SAU dòng nó phụ thuộc. */
  const row = (k: string, v: React.ReactNode, need?: string) => (
    <>
      <span style={{ color: need ? 'var(--fg-4)' : 'var(--fg-4)', opacity: need ? 0.6 : 1 }}>{k}</span>
      <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={need ? { opacity: 0.45, pointerEvents: 'none' } : undefined}>{v}</span>
        {need && <em style={{ fontSize: 11.5, color: 'var(--neon-amber)', fontStyle: 'normal' }}>← {need}</em>}
      </span>
    </>
  );

  return (
    <Drawer onClose={onClose} width={760}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>
            📝 BÀI ĐĂNG #{piece.id} · <ChannelFavicon channel={piece.channel} size={13} /> {ch?.label ?? piece.channel} · {projectLabel ?? piece.projectId}
            {a && <> · <span style={{ color: a.group.color }}>{a.group.label}/{a.angle}</span></>}
          </div>
          <h2 style={{ margin: '4px 0 0', fontSize: 17, fontWeight: 700 }}>{piece.title}</h2>
        </div>

        {gaps.length > 0 && (
          <div style={{ padding: '8px 11px', borderRadius: 7, border: '1px solid var(--neon-amber)', background: 'color-mix(in srgb, var(--neon-amber) 12%, transparent)', fontSize: 12.5 }}>
            <b style={{ color: 'var(--neon-amber)' }}>⚠ Thiếu nguyên liệu ({gaps.length})</b>
            {piece.status !== 'draft' && <span style={{ color: 'var(--fg-4)' }}> — bài đã {piece.status}, runner chưa chạy được</span>}
            <ul style={{ margin: '5px 0 0', paddingLeft: 18, color: 'var(--fg-2)' }}>
              {gaps.map((g) => <li key={g}>{g}</li>)}
            </ul>
          </div>
        )}

        {parentId > 0 && (
          // Mở đúng piece comment thì trước đây nó trông như một bài rời: không thấy nó là comment
          // của bài nào, cũng không có đường sang bài cha.
          <div style={{ padding: '7px 11px', borderRadius: 7, border: '1px solid var(--line)', background: 'var(--bg-2)', fontSize: 12.5, display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: 'var(--fg-3)' }}>↩ Đây là <b>comment đầu</b> của bài #{parentId}</span>
            <button type="button" style={{ ...pickBtn, marginLeft: 'auto' }} onClick={() => onOpenPiece?.(parentId)}>mở bài cha</button>
          </div>
        )}
        {risks.length > 0 && (
          // Khác banner "thiếu nguyên liệu": cái kia là chạy KHÔNG được, cái này là chạy được nhưng
          // bài sẽ bị dìm. Hai loại vấn đề, hai chỗ, không gộp cho gọn.
          <div style={{ padding: '8px 11px', borderRadius: 7, border: '1px solid var(--neon-blue)', background: 'color-mix(in srgb, var(--neon-blue) 10%, transparent)', fontSize: 12.5 }}>
            <b style={{ color: 'var(--neon-blue)' }}>🔗 Bài có link — rủi ro phân phối ({risks.length})</b>
            <ul style={{ margin: '5px 0 0', paddingLeft: 18, color: 'var(--fg-2)' }}>
              {risks.map((r) => <li key={r}>{r}</li>)}
            </ul>
          </div>
        )}

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
          {/* BÀI THẬT, dựng đúng thứ sẽ lên: account nào đứng tên, caption nguyên văn, ảnh kèm.
              Duyệt bằng mô tả ("card ảnh + 8 số liệu") là duyệt cái mình tưởng tượng, không phải
              cái sẽ đăng — nên preview đứng TRƯỚC nút trạng thái, đọc rồi mới bấm approved. */}
          <div>
            <label style={lbl}>Bài sẽ đăng (xem trước)</label>
            {/* Cùng MỘT khối xem trước với lịch plays (PiecePreview) — trước đây drawer vẽ riêng một
                bản, sửa bên này thì lịch vẫn hiển thị kiểu cũ. Soạn TẠI CHỖ: bấm đúp để mở ô nhập,
                rời chuột là lưu (nút cũ đẩy sang /studio, mất drawer + mất ngữ cảnh đang xem). */}
            {editBody ? (
              <textarea autoFocus defaultValue={detail?.bodyMd ?? ''} rows={12} disabled={pending}
                style={{ ...inp, fontSize: 13, lineHeight: 1.55, resize: 'vertical' }}
                onBlur={async (e) => {
                  const v = e.target.value;
                  setEditBody(false);
                  if (v !== (detail?.bodyMd ?? '')) { setDetail((d) => (d ? { ...d, bodyMd: v } : d)); await patch({ bodyMd: v }); }
                }} />
            ) : (
              <div onDoubleClick={() => setEditBody(true)} title="Bấm đúp để sửa nội dung">
                <PiecePreview piece={piece} accounts={accounts} media={media} body={detail?.bodyMd} replies={replies} editableReplies />
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button type="button" onClick={() => setEditBody(true)} disabled={pending || editBody} style={pickBtn}>✎ Soạn nội dung</button>
              <button type="button" onClick={() => navigator.clipboard?.writeText(detail?.bodyMd ?? '')} disabled={!detail?.bodyMd} style={pickBtn}>Copy caption</button>
              {/* Comment đầu = một bài CON (tag replyto:) chứ không phải một ô text đính kèm: nó có
                  account riêng, duyệt riêng, kiểm link riêng — đúng như lúc đăng thật (đăng bài xong
                  mới comment). Kiểu "link ở comment đầu" của Facebook/group nằm ở đây. */}
              <button type="button" disabled={pending} style={pickBtn}
                onClick={async () => {
                  await createContentPiece(piece.projectId, {
                    title: `Comment đầu · ${piece.title}`.slice(0, 90),
                    channel: piece.channel,
                    subject: 'Comment đầu (link)',
                    bodyMd: '',
                    status: 'draft',
                    scheduledAt: new Date(`${piece.date}T09:00:00`),
                    tags: [`replyto:${piece.id}`, 'format:comment',
                      ...piece.tags.filter((t) => /^(acct|browser|place|time|src):/.test(t))],
                  });
                  refresh();
                }}>＋ comment đầu</button>
              <button type="button" disabled={pending} style={pickBtn}
                onClick={async () => {
                  setLinkMsg('đang kiểm…');
                  const r = await checkPieceLinks(piece.id, piece.projectId);
                  setLinkMsg(r.results.length
                    ? r.results.map((x) => `${x.status || 'lỗi mạng'} ${x.url.replace(/^https?:\/\/(www\.)?/, '')}`).join(' · ')
                    : 'bài này không có link nào');
                  refresh();
                }}>Kiểm link đích</button>
            </div>
            {linkMsg && <div style={{ marginTop: 5, fontSize: 11.5, color: /(^|\s)(200|301|302)/.test(linkMsg) || linkMsg.startsWith('đang') || linkMsg.startsWith('bài này') ? 'var(--fg-3)' : 'var(--neon-amber)' }}>{linkMsg}</div>}
          </div>
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
              <button type="button" disabled={pending} onClick={() => setPick('angle')}
                style={{ ...inp, textAlign: 'left', cursor: 'pointer', color: a ? a.group.color : 'var(--fg-4)' }}>
                {a ? `${a.group.label} / ${a.angle}` : '— chọn angle —'}
              </button>
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Trình bày</label>
              <button type="button" disabled={pending} onClick={() => setPick('style')}
                style={{ ...inp, textAlign: 'left', cursor: 'pointer', color: sty ? 'var(--fg-1)' : 'var(--fg-4)' }}>
                {sty ? `${sty.icon} ${sty.label}` : '— chọn cách trình bày —'}
              </button>
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Kiểu bài</label>
              <button type="button" disabled={pending} onClick={() => setPick('format')}
                style={{ ...inp, textAlign: 'left', cursor: 'pointer', color: fmt ? 'var(--fg-1)' : 'var(--fg-4)' }}>
                {fmt ? `${fmt.icon} ${fmt.label}` : '— chọn kiểu —'}
              </button>
            </div>
          </div>
        </>)}

        {tab === 'prepare' && (<>
          <div>
            <label style={lbl}>Runner cần gì để chạy</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 12px', fontSize: 12.5, alignItems: 'center' }}>
              {row('Account', <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {acct && <EntityRef kind="account" id={acct.id} project={piece.projectId} label={`${acct.handle ?? acct.platformKey} · ${acct.status}`} />}
                <button type="button" style={pickBtn} disabled={pending} onClick={() => setPick('acct')}>{acct ? 'đổi account' : '＋ chọn account'}</button>
              </span>)}
              {row('Browser', <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {prof && <EntityRef kind="browser-profile" id={prof.id} label={prof.label} title={prof.externalId ?? undefined} />}
                <button type="button" style={pickBtn} disabled={pending} onClick={() => setPick('browser')}>{prof ? 'đổi browser' : '＋ chọn browser'}</button>
              </span>)}
              {row('Nơi đăng', <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {place && <a href={place.startsWith('http') ? place : undefined} target="_blank" rel="noreferrer" style={{ color: 'var(--neon-blue)' }}>{placeLabel}</a>}
                <button type="button" style={pickBtn} disabled={pending} onClick={() => setPick('place')}>{place ? 'đổi nơi đăng' : '＋ chọn nơi đăng'}</button>
              </span>, !acct ? 'chọn account trước (page lấy theo account)'
                : !managed.length ? 'account này chưa có page nào trong vault' : undefined)}
              {row('Giờ', <input type="time" style={{ ...inp, maxWidth: 120 }} defaultValue={time} disabled={pending}
                onChange={(e) => setTag('time', e.target.value)} />)}
              {row('Asset', <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {assets.map((m) => (
                  <span key={m.id} style={{ display: 'inline-flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.url} alt={m.filename} style={{ width: 132, height: 132, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)', cursor: 'pointer' }}
                      onClick={() => window.open(m.url, '_blank')} />
                    <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <EntityRef kind="media" id={m.id} label={m.filename} />
                      <button type="button" style={pickBtn} disabled={pending}
                        onClick={() => setTag('asset', `media:${assetIds.filter((x) => x !== m.id).join(',')}`)}>✕</button>
                    </span>
                  </span>
                ))}
                <button type="button" style={pickBtn} disabled={pending} onClick={() => setPick('asset')}>＋ thêm ảnh</button>
              </div>)}
            </div>
          </div>

          <div>
            <label style={lbl}>Chuỗi chuẩn bị</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12.5 }}>
              {chain.map((t) => (
                <div key={t.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ color: 'var(--fg-4)', fontFamily: 'var(--font-mono)', fontSize: 11, width: 82 }}>{t.siteScheduledAt ?? '—'}</span>
                  <EntityRef kind="task" id={t.id} project={piece.projectId} label={t.title} onOpen={onOpenTask ? () => onOpenTask(t.id) : undefined} />
                  <span style={{ marginLeft: 'auto', color: ['completed', 'verified'].includes(t.siteState) ? 'var(--ok)' : 'var(--fg-4)' }}>{t.siteState}</span>
                  <button type="button" style={pickBtn} disabled={pending}
                    onClick={() => setTag('chain', chainIds.filter((x) => x !== t.id).join(','))}>✕</button>
                </div>
              ))}
              <button type="button" style={{ ...pickBtn, alignSelf: 'flex-start' }} disabled={pending} onClick={() => setPick('chain')}>＋ gắn card chuẩn bị</button>
            </div>
          </div>

          {/* Caption không lặp ở đây: bản THẬT + chỗ soạn nằm ở tab Overview. Prepare chỉ lo nguyên liệu. */}
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

      {pick === 'acct' && (
        <EntityPicker title="Chọn account đứng tên bài" hint="Account trong vault. Dấu ✓ = cùng nền tảng với kênh của bài."
          load={loadAccounts} value={acct ? { key: `a:${acct.id}` } : undefined} onClose={() => setPick(null)}
          onPick={async (o) => { setPick(null); await setTag('acct', String((o.data as { id: number }).id)); }} />
      )}
      {pick === 'browser' && (
        <EntityPicker title="Chọn browser profile" hint="Phiên đăng nhập runner sẽ mở. Bỏ trống thì lấy theo profile gắn sẵn của account."
          load={loadProfiles} value={prof ? { key: `b:${prof.id}` } : undefined} onClose={() => setPick(null)}
          onPick={async (o) => { setPick(null); await setTag('browser', String((o.data as { id: number }).id)); }} />
      )}
      {pick === 'place' && (
        <EntityPicker title="Chọn nơi đăng" hint={acct ? `Page ${acct.handle ?? acct.platformKey} đang quản.` : 'Chọn account trước — nơi đăng lấy từ Page account đó quản.'}
          load={loadPlaces} value={place ? { key: `pg:${place}` } : undefined} onClose={() => setPick(null)}
          onPick={async (o) => { setPick(null); await setTag('place', (o.data as { url: string }).url); }}
          emptyHint={acct
            ? <>Account này chưa có Page nào trong vault. Mở facebook.com rồi bấm <b>⬇ Nhập Pages</b> trên ext Crew để quét về.</>
            : <>Chưa chọn account. Đóng bảng này, bấm <b>＋ chọn account</b> trước.</>} />
      )}
      {pick === 'style' && (
        <EntityPicker title="Chọn cách trình bày" hint="Hình dạng của chữ — feed mà bài nào cũng 'hook / giải thích / CTA' thì tới bài thứ tư người ta lướt qua không đọc."
          load={loadStyles} value={sty ? { key: `sty:${sty.id}` } : undefined} onClose={() => setPick(null)}
          onPick={async (o) => { setPick(null); await setTag('style', (o.data as { style: string }).style); }} />
      )}
      {pick === 'format' && (
        <EntityPicker title="Chọn kiểu bài" hint="Cùng kênh nhưng đăng ra khác hẳn: text trơn, ảnh đơn, album, bài chèn link, poll, share lại, comment trong thread. Bản dựng bài và runner đều đọc theo kiểu này."
          load={loadFormats} value={fmt ? { key: `fmt:${fmt.id}` } : undefined} onClose={() => setPick(null)}
          onPick={async (o) => { setPick(null); await setTag('format', (o.data as { format: string }).format); }} />
      )}
      {pick === 'angle' && (
        <EntityPicker title="Chọn angle" hint="Bài này LÀM GÌ cho người đọc. Dòng phụ = nhóm (HÚT/TIN/CHUYỂN ĐỔI/CỘNG ĐỒNG/TÁI DÙNG)."
          load={loadAngles} value={a ? { key: `ang:${a.angle}` } : undefined} onClose={() => setPick(null)}
          onPick={async (o) => { setPick(null); await setTag('angle', (o.data as { angle: string }).angle); }} />
      )}
      {pick === 'chain' && (
        <EntityPicker title="Gắn card chuẩn bị" hint="Việc phải xong trước khi đăng (dựng ảnh, soát số, card đăng)."
          load={loadTasks} onClose={() => setPick(null)}
          onPick={async (o) => { const id = (o.data as { id: number }).id; setPick(null); await setTag('chain', [...new Set([...chainIds, id])].join(',')); }} />
      )}
      {pick === 'asset' && (
        <EntityPicker title="Thêm ảnh vào bài" hint="Ảnh trong vault media của dự án."
          load={loadMedia} onClose={() => setPick(null)}
          onPick={async (o) => {
            const id = (o.data as { id: number }).id;
            setPick(null);
            await setTag('asset', `media:${[...new Set([...assetIds, id])].join(',')}`);
          }} />
      )}
    </Drawer>
  );
}
