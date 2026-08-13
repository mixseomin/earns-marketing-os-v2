'use client';

// PieceForm — soạn MỘT bài đăng, mở ngay tại /plays. Đây là toàn bộ Content Studio cũ:
// AI co-pilot, kênh, tribe, persona, hook, thân bài, tag, trạng thái, lưu trữ — không còn
// trang riêng. Studio cũ là surface thứ hai cho cùng một dữ liệu: bài tạo bên đó không có
// NGÀY nên rơi khỏi lịch (query lịch đòi scheduled_at), và bản dựng bên đó là một khối
// giả lập khác hẳn thứ sẽ đăng. Ở đây ngày là bắt buộc và bản dựng dùng chính PiecePreview
// của lịch — soạn xong thấy ngay đúng bài đó nằm đâu trong tuần.

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FormModal, FormModalFooter } from '@/components/ui/form-modal';
import { MultiSelect, Segmented, ConfirmDeleteButton } from '@/components/ui';
import { PiecePreview, forgetPieceBody } from '@/components/piece-preview';
import { CHANNELS, STATUSES, ANGLE_GROUPS, ANGLES, angleLabel, tagVal, type ContentStatus } from '@/lib/content-channels';
import { createContentPiece, updateContentPiece, archiveContentPiece, generateContent, getPieceDetail, pieceFormOptions } from '@/lib/actions/content';
import { todayLocal } from '@/lib/local-day';
import type { CalPiece, MediaRow } from '@/lib/data';

const lbl: React.CSSProperties = { display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-4)', marginBottom: 5, fontFamily: 'var(--font-mono)' };
const inp: React.CSSProperties = { padding: '6px 9px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--fg-1)', fontSize: 13, width: '100%' };

/** Chọn MỘT — dựng trên MultiSelect của nhà (có ô tìm + đếm) thay cho <select> trần. */
function One({ label, options, value, onChange, disabled }: {
  label: string; options: Array<{ value: string; label: string }>; value: string;
  onChange: (v: string) => void; disabled?: boolean;
}) {
  const cur = options.find((o) => o.value === value);
  return (
    <div style={{ opacity: disabled ? 0.55 : 1, pointerEvents: disabled ? 'none' : undefined }}>
      <MultiSelect label={cur?.label ?? label} options={options} selected={value ? [value] : []}
        onChange={(v) => onChange(v.length ? String(v[v.length - 1]) : '')} popupWidth={340} />
    </div>
  );
}

export function PieceForm({ piece, projectId, projects = [], accounts = [], media = [], onClose, onSaved }: {
  /** Có piece = sửa; không có = tạo mới. */
  piece?: CalPiece | null;
  projectId: string;
  projects?: Array<{ id: string; name: string }>;
  accounts?: Array<{ id: number; platformKey: string; handle: string | null; accountStats?: Record<string, unknown> }>;
  media?: MediaRow[];
  onClose: () => void;
  onSaved?: (id?: number) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState('');
  const isCreate = !piece;

  const [f, setF] = useState(() => ({
    projectId: piece?.projectId ?? projectId,
    title: piece?.title ?? '',
    channel: piece?.channel ?? 'fb-post',
    status: (piece?.status ?? 'draft') as ContentStatus,
    // Ngày BẮT BUỘC: bài không có ngày không nằm trên lịch, và lịch là chỗ duy nhất anh xem.
    date: piece?.date ?? todayLocal(),
    time: tagVal(piece?.tags ?? [], 'time'),
    angle: tagVal(piece?.tags ?? [], 'angle'),
    tribeSlug: '',
    persona: '',
    subject: piece?.subject ?? '',
    bodyMd: piece?.body ?? '',
    tagsStr: (piece?.tags ?? []).filter((t) => !/^(time|angle):/.test(t)).join(', '),
    aiNotes: [] as string[],
  }));
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  // Thân bài ở lịch bị cắt 2000 ký tự — sửa từ bản cắt là mất phần đuôi. Nạp bản đầy đủ.
  useEffect(() => {
    if (!piece) return;
    getPieceDetail(piece.id, piece.projectId).then((d) => {
      if (!d) return;
      setF((p) => ({ ...p, bodyMd: p.bodyMd === piece.body ? d.bodyMd : p.bodyMd, tribeSlug: p.tribeSlug || (d.tribeSlug ?? ''), persona: p.persona || (d.persona ?? '') }));
      baseline.current = '';   // nạp xong mới chốt mốc "chưa sửa gì", không thì vừa mở đã báo dirty
    });
  }, [piece]);

  // Skill + tribe chỉ nạp khi mở form (trang /plays gánh 43 project, không kéo sẵn được).
  const [opts, setOpts] = useState<{ skills: Array<{ slug: string; title: string; body: string }>; tribes: Array<{ slug: string; name: string }> }>({ skills: [], tribes: [] });
  useEffect(() => { pieceFormOptions(f.projectId).then(setOpts); }, [f.projectId]);

  const baseline = useRef(JSON.stringify(f));
  if (baseline.current === '') baseline.current = JSON.stringify(f);
  const dirty = JSON.stringify(f) !== baseline.current;

  const [aiPrompt, setAiPrompt] = useState('');
  const [aiSkill, setAiSkill] = useState('');
  const [aiBusy, setAiBusy] = useState(false);

  const tags = useMemo(() => [
    ...f.tagsStr.split(',').map((s) => s.trim()).filter(Boolean).filter((t) => !/^(time|angle):/.test(t)),
    ...(f.time ? [`time:${f.time}`] : []),
    ...(f.angle ? [`angle:${f.angle}`] : []),
  ], [f.tagsStr, f.time, f.angle]);

  // Bản dựng = ĐÚNG khối của lịch, không phải một khung giả lập riêng.
  const preview: CalPiece = {
    id: piece?.id ?? 0, projectId: f.projectId, title: f.title, subject: f.subject || null,
    channel: f.channel, status: f.status, date: f.date, tags,
    hasBody: !!f.bodyMd.trim(), hasLink: /https?:\/\//.test(f.bodyMd), body: f.bodyMd,
    publishUrl: piece?.publishUrl ?? null, publishedAt: piece?.publishedAt ?? null,
  };

  const save = () => {
    if (!f.title.trim()) { setErr('thiếu tiêu đề'); return; }
    if (!f.date) { setErr('thiếu ngày đăng — không có ngày thì bài không lên lịch'); return; }
    const input = {
      title: f.title, channel: f.channel, status: f.status,
      subject: f.subject || null, bodyMd: f.bodyMd, tags,
      tribeSlug: f.tribeSlug || null, persona: f.persona || null,
      scheduledAt: new Date(`${f.date}T${f.time || '09:00'}:00`),
      ...(f.aiNotes.length ? { aiNotes: f.aiNotes } : {}),
    };
    start(async () => {
      const res = isCreate
        ? await createContentPiece(f.projectId, input)
        : await updateContentPiece(piece!.id, piece!.projectId, input);
      if (!res.ok) { setErr(res.error || 'lưu hỏng'); return; }
      if (piece) forgetPieceBody(piece.id);
      router.refresh(); onSaved?.(piece?.id); onClose();
    });
  };

  // Hỏi lại bằng chính cái nút (bấm lần hai), không dùng hộp thoại của trình duyệt — hộp thoại
  // native chặn cả trang và trông như lỗi hệ thống. ui-conventions.
  const archive = () => {
    if (!piece) return;
    start(async () => { await archiveContentPiece(piece.id, piece.projectId); router.refresh(); onSaved?.(); onClose(); });
  };

  const runAi = () => {
    if (!aiPrompt.trim()) { setErr('viết brief trước đã'); return; }
    setAiBusy(true); setErr('');
    generateContent({
      prompt: aiPrompt, channel: f.channel,
      tribeSlug: f.tribeSlug || undefined, persona: f.persona || undefined,
      skillSnippet: opts.skills.find((s) => s.slug === aiSkill)?.body,
    }).then((r) => {
      if (!r.ok) { setErr(r.error || 'AI hỏng'); return; }
      setF((p) => ({ ...p, title: r.title || p.title, subject: r.subject || p.subject, bodyMd: r.bodyMd || p.bodyMd, aiNotes: r.aiNotes ?? p.aiNotes }));
    }).finally(() => setAiBusy(false));
  };

  return (
    <FormModal kind="generic" action={isCreate ? 'create' : 'edit'}
      title={isCreate ? '＋ Bài mới' : `Sửa · ${piece!.title}`}
      idText={isCreate ? 'BÀI MỚI' : `#${piece!.id}`}
      width={1240} dirty={dirty} onClose={onClose}
      bodyStyle={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {err && <div style={{ padding: '8px 14px', background: 'rgba(255,77,94,.08)', borderBottom: '1px solid rgba(255,77,94,.3)', color: 'var(--bad)', fontSize: 12.5 }}>⚠ {err}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', flex: 1, minHeight: 0 }}>
        <div style={{ overflow: 'auto', padding: 14, borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 11 }}>

          <div style={{ padding: 10, background: 'color-mix(in srgb, var(--neon-violet) 7%, transparent)', border: '1px solid color-mix(in srgb, var(--neon-violet) 28%, transparent)', borderRadius: 7 }}>
            <div style={{ ...lbl, color: 'var(--neon-violet)' }}>🤖 Nhờ AI viết nháp</div>
            <textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} rows={2}
              placeholder="Brief: vd 'bài so sánh BAH E-5 San Diego với và không người phụ thuộc, giọng thẳng, kết bằng CTA tính thử'"
              style={{ ...inp, fontSize: 12, resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <div style={{ flex: 1 }}>
                <One label="— giọng mặc định —" value={aiSkill} onChange={setAiSkill}
                  options={opts.skills.map((s) => ({ value: s.slug, label: `✦ ${s.title}` }))} />
              </div>
              <button type="button" className="btn primary" disabled={aiBusy} onClick={runAi} style={{ fontSize: 12 }}>
                {aiBusy ? '⟲ đang viết…' : 'Viết nháp'}
              </button>
            </div>
            {f.aiNotes.length > 0 && (
              <ul style={{ margin: '7px 0 0', paddingLeft: 18, fontSize: 11.5, color: 'var(--fg-2)' }}>
                {f.aiNotes.map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: projects.length > 1 ? '2fr 1fr 1fr' : '2fr 1fr', gap: 8 }}>
            <div>
              <label style={lbl}>Tiêu đề *</label>
              <input style={inp} value={f.title} onChange={(e) => set('title', e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Kênh</label>
              <One label="chọn kênh" value={f.channel} onChange={(v) => set('channel', v)}
                options={CHANNELS.map((c) => ({ value: c.id, label: `${c.icon} ${c.label}` }))} />
            </div>
            {projects.length > 1 && (
              <div>
                <label style={lbl}>Project</label>
                <One label="chọn project" value={f.projectId} disabled={!isCreate} onChange={(v) => set('projectId', v)}
                  options={projects.map((p) => ({ value: p.id, label: p.name }))} />
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr', gap: 8 }}>
            <div>
              <label style={lbl}>Ngày đăng *</label>
              <input type="date" style={inp} value={f.date} onChange={(e) => set('date', e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Giờ</label>
              <input type="time" style={inp} value={f.time} onChange={(e) => set('time', e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Trạng thái</label>
              <Segmented value={f.status} onChange={(v) => set('status', v as ContentStatus)}
                options={STATUSES.map((s) => ({ value: s, label: s }))} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 8 }}>
            <div>
              <label style={lbl}>Góc — bài này làm gì cho người đọc</label>
              <One label="— chưa gắn góc —" value={f.angle} onChange={(v) => set('angle', v)}
                options={ANGLE_GROUPS.flatMap((g) => g.angles.map((a) => ({ value: a, label: `${g.label} · ${angleLabel(a)} — ${ANGLES[a]?.purpose ?? ''}` })))} />
            </div>
            <div>
              <label style={lbl}>Tribe</label>
              <One label="— không —" value={f.tribeSlug} onChange={(v) => set('tribeSlug', v)}
                options={opts.tribes.map((t) => ({ value: t.slug, label: `◍ ${t.name}` }))} />
            </div>
            <div>
              <label style={lbl}>Persona</label>
              <input style={inp} list="piece-form-accounts" value={f.persona} onChange={(e) => set('persona', e.target.value)}
                name="persona-display" autoComplete="off" data-1p-ignore="true" data-lpignore="true" data-form-type="other"
                placeholder={accounts.length ? 'chọn account hoặc tự nhập' : 'tự nhập'} />
              <datalist id="piece-form-accounts">
                {accounts.filter((a) => a.handle).map((a) => <option key={a.id} value={`${a.handle} · ${a.platformKey}`} />)}
              </datalist>
            </div>
          </div>

          <div>
            <label style={lbl}>Hook (dòng người đọc thấy trước)</label>
            <input style={inp} value={f.subject} onChange={(e) => set('subject', e.target.value)} />
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 220 }}>
            <label style={lbl}>Nội dung *</label>
            <textarea style={{ ...inp, flex: 1, minHeight: 220, resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: 12.5, lineHeight: 1.55 }}
              value={f.bodyMd} onChange={(e) => set('bodyMd', e.target.value)} />
          </div>

          <div>
            <label style={lbl}>Tag khác (nơi đăng, account, asset… gắn ở drawer sau khi lưu)</label>
            <input style={inp} value={f.tagsStr} onChange={(e) => set('tagsStr', e.target.value)} placeholder="src:S1, format:short" />
          </div>
        </div>

        <div style={{ overflow: 'auto', padding: 14, background: 'var(--bg-1)' }}>
          <div style={lbl}>Bài sẽ đăng (xem trước)</div>
          <PiecePreview piece={preview} accounts={accounts} media={media} body={f.bodyMd} />
        </div>
      </div>

      <FormModalFooter>
        {!isCreate && <ConfirmDeleteButton onDelete={archive} disabled={pending}
          labelIdle="🗑 Lưu trữ" labelArmed="⚠ Bấm lần nữa — bài rời khỏi lịch"
          title="Đưa bài ra khỏi lịch (không xoá hẳn) / Bấm lần nữa để chắc chắn" />}
        <button type="button" className="btn ghost" onClick={onClose}>Huỷ</button>
        <button type="button" className="btn primary" disabled={pending} onClick={save}>{isCreate ? 'Tạo bài' : 'Lưu'}</button>
      </FormModalFooter>
    </FormModal>
  );
}
