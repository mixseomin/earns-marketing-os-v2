'use client';

// PieceDrawer — bấm pill 📝 "Bài đăng" trên lịch plays → xem/sửa NGAY TẠI CHỖ, không nhảy trang.
// Cùng khuôn với FollowupDrawer (📌): lịch là một, mọi thứ trên lịch mở ra tại chỗ. Trước đây pill
// bài đăng đẩy sang /p/<id>/studio — người đang xem lịch tháng bị văng khỏi ngữ cảnh, và phải nhớ
// hai surface. Sửa/đăng xong ở đây; soạn nội dung dài vẫn ở Studio (nút mở cuối drawer).
// YDNI: chỉ 5 thứ người ta động tới trên lịch (hook · trạng thái · ngày · angle · link đã đăng).

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Drawer } from '@/components/ui';
import { CHANNELS, STATUSES, ANGLE_GROUPS, angleOf } from '@/lib/content-channels';
import { updateContentPiece } from '@/lib/actions/content';
import type { CalPiece } from '@/lib/data';

const lbl: React.CSSProperties = { display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-4)', marginBottom: 5, fontFamily: 'var(--font-mono)' };
const inp: React.CSSProperties = { padding: '6px 9px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--fg-1)', fontSize: 13, width: '100%' };

const STATUS_COLOR: Record<string, string> = {
  draft: 'var(--fg-3)', approved: 'var(--neon-cyan)', scheduled: 'var(--neon-amber)',
  published: 'var(--ok)', archived: 'var(--fg-4)',
};

export function PieceDrawer({ piece, projectLabel, onClose }: { piece: CalPiece; projectLabel?: string; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [hook, setHook] = useState(piece.subject ?? '');
  const [date, setDate] = useState(piece.date);
  const [url, setUrl] = useState('');

  const ch = CHANNELS.find((c) => c.id === piece.channel);
  const a = angleOf(piece.tags);
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

        <button type="button" onClick={() => router.push(`/p/${piece.projectId}/studio?m=edit&mId=${piece.id}`)}
          style={{ alignSelf: 'flex-start', padding: '5px 10px', borderRadius: 6, border: '1px solid var(--line)', background: 'transparent', color: 'var(--fg-3)', fontSize: 12, cursor: 'pointer' }}>
          ✎ Soạn nội dung đầy đủ ở Studio
        </button>
      </div>
    </Drawer>
  );
}
