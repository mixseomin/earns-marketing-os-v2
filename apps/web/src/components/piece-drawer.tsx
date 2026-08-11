'use client';

// PieceDrawer — bấm pill 📝 "Bài đăng" trên lịch plays → xem/sửa NGAY TẠI CHỖ, không nhảy trang.
// Cùng khuôn với FollowupDrawer (📌): lịch là một, mọi thứ trên lịch mở ra tại chỗ. Trước đây pill
// bài đăng đẩy sang /p/<id>/studio — người đang xem lịch tháng bị văng khỏi ngữ cảnh, và phải nhớ
// hai surface. Sửa/đăng xong ở đây; soạn nội dung dài vẫn ở Studio (nút mở cuối drawer).
// YDNI: chỉ 5 thứ người ta động tới trên lịch (hook · trạng thái · ngày · angle · link đã đăng).

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Drawer } from '@/components/ui';
import { CHANNELS, STATUSES, ANGLE_GROUPS, angleOf } from '@/lib/content-channels';
import { updateContentPiece, getPieceDetail } from '@/lib/actions/content';
import type { CalPiece } from '@/lib/data';

const lbl: React.CSSProperties = { display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-4)', marginBottom: 5, fontFamily: 'var(--font-mono)' };
const inp: React.CSSProperties = { padding: '6px 9px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--fg-1)', fontSize: 13, width: '100%' };

const STATUS_COLOR: Record<string, string> = {
  draft: 'var(--fg-3)', approved: 'var(--neon-cyan)', scheduled: 'var(--neon-amber)',
  published: 'var(--ok)', archived: 'var(--fg-4)',
};

// Đọc 'khoá:giá trị' trong tags — nơi/giờ/account/browser/asset/chuỗi việc đều nằm ở đó (không migration).
const tagVal = (tags: string[], k: string) => tags.find((t) => t.startsWith(`${k}:`))?.slice(k.length + 1) ?? '';

export function PieceDrawer({ piece, projectLabel, accounts = [], browserProfiles = [], tasks = [], onClose }: {
  piece: CalPiece; projectLabel?: string; onClose: () => void;
  /** Vault: để runner biết đăng bằng account nào, mở profile nào — không phải đi tra chỗ khác. */
  accounts?: Array<{ id: number; platformKey: string; handle: string | null; status: string; browserProfileId?: number | null }>;
  browserProfiles?: Array<{ id: number; label: string; externalId: string | null; lastOpenedAt: string | null }>;
  /** Chuỗi việc chuẩn bị (tag chain:<id,id>) — nhìn thấy ngay còn thiếu bước nào. */
  tasks?: Array<{ id: number; title: string; siteState: string; siteScheduledAt: string | null }>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [hook, setHook] = useState(piece.subject ?? '');
  const [date, setDate] = useState(piece.date);
  const [url, setUrl] = useState('');

  const ch = CHANNELS.find((c) => c.id === piece.channel);
  const a = angleOf(piece.tags);
  const place = tagVal(piece.tags, 'place');
  const time = tagVal(piece.tags, 'time');
  const asset = tagVal(piece.tags, 'asset');
  const acct = accounts.find((x) => x.id === Number(tagVal(piece.tags, 'acct')));
  const prof = browserProfiles.find((x) => x.id === Number(tagVal(piece.tags, 'browser')));
  const chain = tagVal(piece.tags, 'chain').split(',').map(Number).filter(Boolean)
    .map((id) => tasks.find((t) => t.id === id)).filter(Boolean) as Array<{ id: number; title: string; siteState: string; siteScheduledAt: string | null }>;
  const [body, setBody] = useState<string>('');
  useEffect(() => { getPieceDetail(piece.id, piece.projectId).then((d) => setBody(d?.bodyMd ?? '')); }, [piece.id, piece.projectId]);
  const refresh = () => start(() => router.refresh());
  // updateContentPiece nhận Partial<ContentInput>; title bắt buộc trong type nên gửi kèm title cũ.
  const patch = async (p: Record<string, unknown>) => {
    await updateContentPiece(piece.id, piece.projectId, { title: piece.title, ...p } as never);
    refresh();
  };

  return (
    <Drawer onClose={onClose} width={520}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>
            📝 BÀI ĐĂNG · {ch?.icon} {ch?.label ?? piece.channel} · {projectLabel ?? piece.projectId}
            {a && <> · <span style={{ color: a.group.color }}>{a.group.label}/{a.angle}</span></>}
          </div>
          <h2 style={{ margin: '4px 0 0', fontSize: 17, fontWeight: 700 }}>{piece.title}</h2>
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
                    background: on ? STATUS_COLOR[s] : 'transparent', color: on ? 'var(--bg-0)' : 'var(--fg-3)' }}>
                  {s}
                </button>
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
                <optgroup key={g.id} label={g.label}>
                  {g.angles.map((x) => <option key={x} value={x}>{x}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

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

        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          <label style={lbl}>Runner cần gì để chạy</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 10px', fontSize: 12.5 }}>
            <span style={{ color: 'var(--fg-4)' }}>Nơi đăng</span><span>{place || <em style={{ color: 'var(--neon-amber)' }}>chưa chọn</em>}</span>
            <span style={{ color: 'var(--fg-4)' }}>Giờ</span><span>{time || <em style={{ color: 'var(--neon-amber)' }}>chưa đặt</em>}</span>
            <span style={{ color: 'var(--fg-4)' }}>Account</span>
            <span>{acct ? <>#{acct.id} {acct.handle} <span style={{ color: acct.status === 'active' ? 'var(--ok)' : 'var(--neon-amber)' }}>({acct.status})</span></> : <em style={{ color: 'var(--neon-amber)' }}>chưa gắn</em>}</span>
            <span style={{ color: 'var(--fg-4)' }}>Browser</span>
            <span>{prof ? <>#{prof.id} {prof.label}<div style={{ color: 'var(--fg-4)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>{prof.externalId}</div></> : <em style={{ color: 'var(--neon-amber)' }}>chưa gắn</em>}</span>
            <span style={{ color: 'var(--fg-4)' }}>Asset</span><span>{asset || <em style={{ color: 'var(--neon-amber)' }}>chưa có</em>}</span>
          </div>
        </div>

        {chain.length > 0 && (
          <div>
            <label style={lbl}>Chuỗi chuẩn bị</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5 }}>
              {chain.map((t) => (
                <div key={t.id} style={{ display: 'flex', gap: 8 }}>
                  <span style={{ color: 'var(--fg-4)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{t.siteScheduledAt ?? '—'}</span>
                  <span style={{ flex: 1 }}>{t.title}</span>
                  <span style={{ color: t.siteState === 'completed' || t.siteState === 'verified' ? 'var(--ok)' : 'var(--fg-4)' }}>{t.siteState}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <label style={lbl}>Caption sẽ đăng</label>
          <textarea readOnly value={body || '(chưa soạn)'} rows={8}
            style={{ ...inp, fontFamily: 'var(--font-mono)', fontSize: 11.5, lineHeight: 1.5, resize: 'vertical' }} />
          <button type="button" onClick={() => navigator.clipboard?.writeText(body)} disabled={!body}
            style={{ marginTop: 5, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--line)', background: 'transparent', color: 'var(--fg-3)', fontSize: 11.5, cursor: 'pointer' }}>
            Copy caption
          </button>
        </div>

        <button type="button" onClick={() => router.push(`/p/${piece.projectId}/studio?m=edit&mId=${piece.id}`)}
          style={{ alignSelf: 'flex-start', padding: '5px 10px', borderRadius: 6, border: '1px solid var(--line)', background: 'transparent', color: 'var(--fg-3)', fontSize: 12, cursor: 'pointer' }}>
          ✎ Soạn nội dung đầy đủ ở Studio
        </button>
      </div>
    </Drawer>
  );
}
