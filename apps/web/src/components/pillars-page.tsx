'use client';

// /p/[id]/pillars page — list + CRUD content pillars cho 1 project.
// Pillar = macro positioning ("Educational depth", "Cultural bridge VN")
// gắn voice + key_messages + forbidden + languages. Cards inherit.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  createContentPillar, updateContentPillar, deleteContentPillar,
  type ContentPillarRow,
} from '@/lib/actions/content-pillars';
import { VOICE_PROFILES, VOICE_PROFILE_META, type VoiceProfile } from '@/lib/ai/voice-profile';
import type { TribeRow } from '@/lib/data';
import { Spinner } from './ui';
import { TagsInput } from './tags-input';

const CONTENT_KINDS = ['seed', 'blog', 'email', 'thread'] as const;
const LANGUAGE_OPTS = ['en', 'vi', 'es', 'fr', 'zh', 'ja', 'ko', 'multi'] as const;

interface Props {
  projectId: string;
  pillars: ContentPillarRow[];
  tribes: TribeRow[];
}

export function PillarsPage({ projectId, pillars, tribes }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<ContentPillarRow | null | 'new'>(null);

  return (
    <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 1400, margin: '0 auto' }}>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>📚 Trụ cột nội dung</h1>
        <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>
          {pillars.length} trụ cột · định vị nội dung cho toàn dự án
        </span>
        <span style={{ flex: 1 }} />
        <button className="btn primary" onClick={() => setEditing('new')}>
          + Tạo trụ cột mới
        </button>
      </header>

      {pillars.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--fg-3)',
                      background: 'var(--bg-2)', border: '1px dashed var(--line)', borderRadius: 8 }}>
          <div style={{ fontSize: 14, marginBottom: 10 }}>Chưa có trụ cột nội dung nào.</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 14 }}>
            Trụ cột = chiến lược nội dung lớn (3-5 cái / dự án). Mỗi trụ cột có giọng điệu + thông điệp chính + audience + ngôn ngữ.<br />
            Bài viết (blog / seeding / email / thread) kế thừa vị thế từ trụ cột.
          </div>
          <button className="btn primary" onClick={() => setEditing('new')}>+ Tạo trụ cột đầu tiên</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pillars.map((p) => (
            <PillarRow key={p.id} pillar={p} tribes={tribes} onEdit={() => setEditing(p)} />
          ))}
        </div>
      )}

      {editing != null && (
        <PillarFormModal
          projectId={projectId}
          pillar={editing === 'new' ? null : editing}
          tribes={tribes}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); router.refresh(); }}
        />
      )}
    </div>
  );
}

function PillarRow({ pillar, tribes, onEdit }: {
  pillar: ContentPillarRow; tribes: TribeRow[]; onEdit: () => void;
}) {
  const voiceMeta = VOICE_PROFILE_META[pillar.voiceProfile];
  const tribeNames = pillar.tribeIds.map((id) => tribes.find((t) => t.id === id)?.name).filter(Boolean);
  return (
    <div onClick={onEdit}
         style={{ padding: 14, background: 'var(--bg-2)', border: '1px solid var(--line)',
                  borderRadius: 6, cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <h3 title={pillar.tagline ? `"${pillar.tagline}"` : pillar.name}
            style={{ margin: 0, fontSize: 16, fontWeight: 700, cursor: 'help' }}>
          {pillar.name}
        </h3>
        <span style={{ fontSize: 10, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>
          /{pillar.slug}
        </span>
        {pillar.status !== 'active' && (
          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3,
                         background: 'var(--bg-1)', color: 'var(--warn)' }}>
            {pillar.status}
          </span>
        )}
        <span style={{ flex: 1 }} />
        <span title={`Ưu tiên ${pillar.priority}/100`}
              style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
          ⚡ {pillar.priority}
        </span>
        <span title={`${pillar.cardCount} bài đã gắn trụ cột này`}
              style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3,
                       background: 'var(--accent-soft)', color: 'var(--accent)',
                       fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
          {pillar.cardCount} bài
        </span>
      </div>
      {/* Tagline ẩn — đã có trong tooltip của h3 (hover xem) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: 11 }}>
        <Chip icon={voiceMeta.icon} label={voiceMeta.label} title={`Giọng: ${voiceMeta.short}`} color="violet" />
        {pillar.languages.map((lang) => (
          <Chip key={lang} icon="🌐" label={lang} title={`Hỗ trợ ngôn ngữ: ${lang}`} color="blue" />
        ))}
        {tribeNames.map((name) => (
          <Chip key={name} icon="🎯" label={name!} title="Đối tượng" color="amber" />
        ))}
        {pillar.preferredTypes.map((k) => (
          <Chip key={k} icon="" label={k} title={`Loại nội dung: ${k}`} color="slate" />
        ))}
        {pillar.keyMessages.length > 0 && (
          <span title={pillar.keyMessages.map((m) => `• ${m}`).join('\n')}
                style={{ fontSize: 10, color: 'var(--ok)', cursor: 'help' }}>
            🎯 {pillar.keyMessages.length} thông điệp
          </span>
        )}
        {pillar.forbiddenMsgs.length > 0 && (
          <span title={pillar.forbiddenMsgs.map((m) => `• ${m}`).join('\n')}
                style={{ fontSize: 10, color: 'var(--bad)', cursor: 'help' }}>
            🚫 {pillar.forbiddenMsgs.length} cấm kỵ
          </span>
        )}
      </div>
    </div>
  );
}

function Chip({ icon, label, title, color }: { icon: string; label: string; title?: string; color: 'violet' | 'blue' | 'amber' | 'slate' }) {
  const c = {
    violet: { bg: 'rgba(157,108,255,0.12)', fg: 'var(--neon-violet)', border: 'rgba(157,108,255,0.4)' },
    blue:   { bg: 'rgba(96,165,250,0.12)',  fg: '#60a5fa',           border: 'rgba(96,165,250,0.4)' },
    amber:  { bg: 'rgba(251,191,36,0.12)',  fg: '#fbbf24',           border: 'rgba(251,191,36,0.4)' },
    slate:  { bg: 'var(--bg-1)',            fg: 'var(--fg-3)',       border: 'var(--line)' },
  }[color];
  return (
    <span title={title} style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '1px 6px', fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
      background: c.bg, color: c.fg, border: `1px solid ${c.border}`, borderRadius: 3,
    }}>
      {icon && <span>{icon}</span>}{label}
    </span>
  );
}

function PillarFormModal({ projectId, pillar, tribes, onClose, onSaved }: {
  projectId: string;
  pillar: ContentPillarRow | null;       // null = create
  tribes: TribeRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isCreate = !pillar;
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: pillar?.name ?? '',
    slug: pillar?.slug ?? '',
    tagline: pillar?.tagline ?? '',
    positioningMd: pillar?.positioningMd ?? '',
    keyMessages: pillar?.keyMessages ?? [],
    forbiddenMsgs: pillar?.forbiddenMsgs ?? [],
    languages: pillar?.languages ?? ['en'],
    voiceProfile: (pillar?.voiceProfile ?? 'regular') as string,
    voiceNotes: pillar?.voiceNotes ?? '',
    preferredTypes: pillar?.preferredTypes ?? [],
    seoPillarUrl: pillar?.seoPillarUrl ?? '',
    seoKeywords: pillar?.seoKeywords ?? [],
    externalTag: pillar?.externalTag ?? '',
    priority: pillar?.priority ?? 50,
    status: pillar?.status ?? 'active',
    tribeIds: pillar?.tribeIds ?? [],
  });
  const setF = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const fld: React.CSSProperties = { width: '100%', padding: '6px 8px', background: 'var(--bg-2)',
    border: '1px solid var(--line)', borderRadius: 5, color: 'var(--fg-0)', fontSize: 13, outline: 'none' };
  const lbl: React.CSSProperties = { fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)',
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, display: 'block' };

  const handleSave = () => {
    setBusy(true); setError(null);
    startTransition(async () => {
      const res = isCreate
        ? await createContentPillar(projectId, form)
        : await updateContentPillar(projectId, pillar!.id, form);
      setBusy(false);
      if (!res.ok) { setError(res.error ?? 'Lỗi lưu pillar'); return; }
      onSaved();
    });
  };

  const handleDelete = () => {
    if (!pillar) return;
    setBusy(true); setError(null);
    startTransition(async () => {
      const res = await deleteContentPillar(projectId, pillar.id);
      setBusy(false);
      if (!res.ok) { setError(res.error ?? 'Lỗi xoá pillar'); return; }
      onSaved();
    });
  };

  const toggleLang = (lang: string) => {
    const next = form.languages.includes(lang)
      ? form.languages.filter((l) => l !== lang)
      : [...form.languages, lang];
    setF('languages', next.length > 0 ? next : ['en']);
  };

  const toggleType = (k: string) => {
    setF('preferredTypes', form.preferredTypes.includes(k)
      ? form.preferredTypes.filter((x) => x !== k)
      : [...form.preferredTypes, k]);
  };

  const toggleTribe = (id: number) => {
    setF('tribeIds', form.tribeIds.includes(id)
      ? form.tribeIds.filter((x) => x !== id)
      : [...form.tribeIds, id]);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 'min(900px, 95vw)', maxHeight: '92vh', overflowY: 'auto' }}
           onClick={(e) => e.stopPropagation()}>
        <div className="modal-head" style={{ display: 'flex', alignItems: 'center', padding: 14, gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div className="id-line">{isCreate ? 'TRỤ CỘT MỚI' : `Trụ cột #${pillar!.id}`}</div>
            <h2 style={{ margin: 0, fontSize: 18 }}>{isCreate ? '+ Tạo trụ cột mới' : pillar!.name}</h2>
          </div>
          <button className="btn ghost" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
            <div>
              <label style={lbl}>Tên *</label>
              <input type="text" value={form.name} onChange={(e) => setF('name', e.target.value)}
                     style={fld} placeholder="Chiều sâu giáo dục (SEO + uy tín)" autoFocus />
            </div>
            <div>
              <label style={lbl}>Slug</label>
              <input type="text" value={form.slug} onChange={(e) => setF('slug', e.target.value)}
                     style={{ ...fld, fontFamily: 'var(--font-mono)' }} placeholder="tự động từ tên" />
            </div>
          </div>
          <div>
            <label style={lbl}>Tagline (1 dòng pitch ngắn)</label>
            <input type="text" value={form.tagline} onChange={(e) => setF('tagline', e.target.value)}
                   style={fld} placeholder="Astrology có chiều sâu, không phải horoscope dạo" />
          </div>
          <div>
            <label style={lbl}>Vị thế (markdown — mô tả chi tiết trụ cột)</label>
            <textarea value={form.positioningMd} onChange={(e) => setF('positioningMd', e.target.value)}
                      placeholder={'Thị trường astrology online đang bão hòa với 2 thái cực: content rẻ tiền và báo cáo AI generic. Astrolas chiếm khoảng trống giữa: phân tích sâu nhưng dễ tiếp cận...'}
                      rows={4}
                      style={{ ...fld, fontFamily: 'var(--font-mono)', fontSize: 12, resize: 'vertical' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={lbl} title="Thông điệp cốt lõi của trụ cột — AI phải phản ánh ít nhất 1 trong mỗi bài.">
                🎯 Thông điệp chính
              </label>
              <TagsInput value={form.keyMessages}
                         onChange={(arr) => setF('keyMessages', arr)}
                         placeholder='vd: "natal chart > sun sign"' />
            </div>
            <div>
              <label style={lbl} title="Thông điệp / từ ngữ CẤM cho trụ cột — bảo vệ định vị thương hiệu.">
                🚫 Cấm kỵ
              </label>
              <TagsInput value={form.forbiddenMsgs}
                         onChange={(arr) => setF('forbiddenMsgs', arr)}
                         placeholder='vd: "horoscope dạo", "TikTok vibes"' />
            </div>
          </div>

          <div>
            <label style={lbl} title="Ngôn ngữ trụ cột hỗ trợ. Bài có target_lang không trong list → cảnh báo mismatch.">
              🌐 Ngôn ngữ hỗ trợ
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {LANGUAGE_OPTS.map((l) => {
                const on = form.languages.includes(l);
                return (
                  <button key={l} type="button" onClick={() => toggleLang(l)}
                          style={{
                            padding: '4px 10px', fontSize: 12, fontWeight: 700, borderRadius: 4,
                            background: on ? 'rgba(96,165,250,0.15)' : 'var(--bg-2)',
                            color: on ? '#60a5fa' : 'var(--fg-3)',
                            border: `1px solid ${on ? 'rgba(96,165,250,0.45)' : 'var(--line)'}`,
                            fontFamily: 'var(--font-mono)', cursor: 'pointer',
                          }}>{on ? '✓ ' : ''}{l}</button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={lbl}>🎙 Giọng điệu</label>
              <select value={form.voiceProfile} onChange={(e) => setF('voiceProfile', e.target.value)}
                      style={{ ...fld, fontWeight: 700 }}>
                {VOICE_PROFILES.map((p) => {
                  const m = VOICE_PROFILE_META[p];
                  return <option key={p} value={p}>{m.icon} {m.label} — {m.short}</option>;
                })}
              </select>
            </div>
            <div>
              <label style={lbl}>Ưu tiên (0-100)</label>
              <input type="number" min={0} max={100} value={form.priority}
                     onChange={(e) => setF('priority', Number(e.target.value) || 0)}
                     style={{ ...fld, fontFamily: 'var(--font-mono)' }} />
            </div>
          </div>

          <div>
            <label style={lbl} title="Bổ sung ngữ cảnh giọng cho AI (vd: 'học thuật nhưng không khô')">
              Ghi chú giọng (tuỳ chọn)
            </label>
            <textarea value={form.voiceNotes} onChange={(e) => setF('voiceNotes', e.target.value)}
                      placeholder="học thuật nhưng accessible, dùng analogy đời thường"
                      rows={2}
                      style={{ ...fld, fontFamily: 'var(--font-mono)', fontSize: 12, resize: 'vertical' }} />
          </div>

          <div>
            <label style={lbl}>📦 Loại nội dung ưu tiên</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {CONTENT_KINDS.map((k) => {
                const on = form.preferredTypes.includes(k);
                return (
                  <button key={k} type="button" onClick={() => toggleType(k)}
                          style={{
                            padding: '4px 10px', fontSize: 12, fontWeight: 700, borderRadius: 4,
                            background: on ? 'var(--accent-soft)' : 'var(--bg-2)',
                            color: on ? 'var(--accent)' : 'var(--fg-3)',
                            border: `1px solid ${on ? 'var(--accent-line)' : 'var(--line)'}`,
                            fontFamily: 'var(--font-mono)', cursor: 'pointer',
                          }}>{on ? '✓ ' : ''}{k}</button>
                );
              })}
            </div>
          </div>

          {tribes.length > 0 && (
            <div>
              <label style={lbl}>🎯 Đối tượng audience (chọn nhiều)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {tribes.map((t) => {
                  const on = form.tribeIds.includes(t.id);
                  return (
                    <button key={t.id} type="button" onClick={() => toggleTribe(t.id)}
                            title={t.descText || t.psychographic || t.name}
                            style={{
                              padding: '4px 10px', fontSize: 12, fontWeight: 700, borderRadius: 4,
                              background: on ? 'rgba(251,191,36,0.15)' : 'var(--bg-2)',
                              color: on ? '#fbbf24' : 'var(--fg-3)',
                              border: `1px solid ${on ? 'rgba(251,191,36,0.45)' : 'var(--line)'}`,
                              cursor: 'pointer',
                            }}>{on ? '✓ ' : ''}{t.name}</button>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
            <div>
              <label style={lbl}>🔗 URL bài pillar (bài pillar SEO đã publish)</label>
              <input type="url" value={form.seoPillarUrl} onChange={(e) => setF('seoPillarUrl', e.target.value)}
                     style={{ ...fld, fontFamily: 'var(--font-mono)' }}
                     placeholder="https://astrolas.com/blog/saturn-return-explained" />
            </div>
            <div>
              <label style={lbl}>Trạng thái</label>
              <select value={form.status} onChange={(e) => setF('status', e.target.value)} style={fld}>
                <option value="active">đang dùng</option>
                <option value="paused">tạm dừng</option>
                <option value="archived">lưu trữ</option>
              </select>
            </div>
          </div>
          <div>
            <label style={lbl}>🔎 Từ khoá SEO (target cho cluster bài)</label>
            <TagsInput value={form.seoKeywords}
                       onChange={(arr) => setF('seoKeywords', arr)}
                       placeholder='vd: "saturn return", "natal chart reading"' />
          </div>

          {/* External tag — map sang content_pieces.pillar enum của Directus
              (Astrolas dashboard). Datalist suggest các tag chuẩn của Astrolas
              nhưng vẫn cho free-text vì project khác có enum khác. */}
          <div>
            <label style={lbl} title="Map sang content_pieces.pillar enum của Directus dashboard (Astrolas dùng: mundane / technique / demo / education / weekly-forecast). Khi MOS2 push bài sang Directus, dùng tag này.">
              🔗 Tag mapping ngoài <span style={{ color: 'var(--fg-4)', textTransform: 'none', fontWeight: 400, marginLeft: 4 }}>
                (map sang pillar của Directus dashboard)
              </span>
            </label>
            <input type="text" value={form.externalTag} onChange={(e) => setF('externalTag', e.target.value)}
                   list="astrolas-pillar-tags"
                   placeholder="VD: education (Astrolas)  /  educational-depth  /  weekly-forecast"
                   style={{ ...fld, fontFamily: 'var(--font-mono)', fontSize: 12 }} />
            <datalist id="astrolas-pillar-tags">
              <option value="mundane">mundane (Astrolas: daily/weekly/mundane chart)</option>
              <option value="technique">technique (Astrolas: deep astrology technique)</option>
              <option value="demo">demo (Astrolas: product demo, walkthrough)</option>
              <option value="education">education (Astrolas: explanatory content)</option>
              <option value="weekly-forecast">weekly-forecast (Astrolas: weekly transit)</option>
            </datalist>
            <div style={{ marginTop: 3, fontSize: 10, color: 'var(--fg-4)' }}>
              💡 Astrolas dashboard (as.on.tc) dùng <code>content_pieces.pillar</code> enum đơn giản —
              tag này để map giữa MOS2 strategy ↔ Astrolas tag layer khi sync.
            </div>
          </div>

          {error && <div style={{ fontSize: 11, color: 'var(--bad)' }}>⚠ {error}</div>}
        </div>

        <div className="modal-foot" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 14,
                                              justifyContent: 'space-between',
                                              borderTop: '1px solid var(--line)' }}>
          {!isCreate ? (
            confirmDelete ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--bad)' }}>Xác nhận xoá trụ cột?</span>
                <button className="btn" style={{ background: 'var(--bad)', color: '#fff' }}
                        onClick={handleDelete} disabled={busy}>
                  {busy ? <Spinner size="xs" /> : 'Xoá'}
                </button>
                <button className="btn ghost" onClick={() => setConfirmDelete(false)}>Huỷ</button>
              </div>
            ) : (
              <button className="btn ghost" onClick={() => setConfirmDelete(true)}
                      style={{ color: 'var(--bad)' }}>🗑 Xoá trụ cột</button>
            )
          ) : <span />}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn ghost" onClick={onClose} disabled={busy}>Huỷ</button>
            <button className="btn primary" onClick={handleSave} disabled={busy || !form.name.trim()}>
              {busy ? <><Spinner size="xs" /> Đang lưu</> : isCreate ? '+ Tạo trụ cột' : '💾 Lưu'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
