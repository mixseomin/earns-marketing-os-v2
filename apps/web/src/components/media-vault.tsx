'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { MediaRow } from '@/lib/data';
import { createMediaAsset, updateMediaAsset, deleteMediaAsset, suggestMediaMeta, uploadMediaAsset, type MediaInput } from '@/lib/actions/vaults';
import { useModalParam } from '@/lib/use-modal-param';
import { EmptyState, StatsStrip, type StatCard } from './ui';
import { AIFormParser } from './ai-form-parser';

const KIND_ICON: Record<string, string> = { image: '🖼', video: '🎬', audio: '🎵', doc: '📄', other: '🗂' };

function fmtSize(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function MediaVault({ items, projectId }: { items: MediaRow[]; projectId: string }) {
  const modal = useModalParam();
  const editing = modal.is("edit") ? items.find((x) => x.id === modal.numId) ?? null : null;
  const creating = modal.is("new");
  const [zoom, setZoom] = useState<MediaRow | null>(null);

  const stats: StatCard[] = [
    { key: 'total', label: 'Total', value: items.length, color: 'var(--fg-0)' },
    { key: 'hot', label: 'Hot reuse', value: items.filter((i) => i.hot).length, color: 'var(--neon-amber)' },
    { key: 'image', label: 'Image', value: items.filter((i) => i.kind === 'image').length, color: 'var(--neon-cyan)' },
    { key: 'video', label: 'Video', value: items.filter((i) => i.kind === 'video').length, color: 'var(--neon-violet)' },
    { key: 'size', label: 'Total size', value: fmtSize(items.reduce((s, i) => s + i.sizeBytes, 0)), color: 'var(--ok)' },
  ];

  return (
    <>
      <StatsStrip cards={stats} />
      <QuickPasteUpload projectId={projectId} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '8px 0' }}>
        <button className="btn primary" onClick={() => modal.open("new")}>+ New asset (URL)</button>
      </div>
      {items.length === 0 ? (
        <EmptyState icon="🎬" title="No media" description="Upload hoặc external link asset đầu tiên." compact />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
          {items.map((m) => (
            <div key={m.id} className="panel" style={{ cursor: 'pointer', overflow: 'hidden' }} onClick={() => modal.open("edit", m.id)}>
              {m.kind === 'image' && (
                <div
                  style={{ aspectRatio: '16 / 10', background: 'var(--bg-2)', overflow: 'hidden', position: 'relative', cursor: 'zoom-in' }}
                  onClick={(e) => { e.stopPropagation(); setZoom(m); }}
                  title="Click to zoom"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.url} alt={m.notes?.trim() || m.filename} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <span style={{ position: 'absolute', top: 5, right: 5, background: 'rgba(0,0,0,.55)', color: '#fff', borderRadius: 4, fontSize: 11, padding: '1px 5px', lineHeight: 1.4 }}>🔍</span>
                </div>
              )}
              <div style={{ padding: '6px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14 }}>{KIND_ICON[m.kind] ?? '🗂'}</span>
                  <span title={m.notes?.trim() || m.filename} style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{m.notes?.trim() || m.filename}</span>
                  {m.hot && <span style={{ fontSize: 10, color: 'var(--neon-amber)' }}>🔥</span>}
                </div>
                <div style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {m.kind} · {fmtSize(m.sizeBytes)}{m.width && m.height ? ` · ${m.width}×${m.height}` : ''}{m.notes?.trim() ? ` · ${m.filename}` : ''}
                </div>
                {m.tags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
                    {m.tags.slice(0, 3).map((tag) => <span key={tag} className="chip" style={{ fontSize: 9, padding: '1px 5px' }}>{tag}</span>)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {(editing || creating) && (
        <MediaFormModal asset={editing} projectId={projectId} onClose={() => modal.close()} />
      )}
      {zoom && <Lightbox media={zoom} onClose={() => setZoom(null)} />}
    </>
  );
}

// Fullscreen image/video preview. Click backdrop or Esc to close.
function Lightbox({ media, onClose }: { media: MediaRow; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);

  return (
    <div onClick={onClose}
         style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(4,6,12,.88)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'zoom-out' }}>
      {media.kind === 'video'
        ? <video src={media.url} controls autoPlay onClick={(e) => e.stopPropagation()} style={{ maxWidth: '92vw', maxHeight: '80vh', borderRadius: 8 }} />
        // eslint-disable-next-line @next/next/no-img-element
        : <img src={media.url} alt={media.notes?.trim() || media.filename} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '92vw', maxHeight: '80vh', objectFit: 'contain', borderRadius: 8, boxShadow: '0 10px 50px rgba(0,0,0,.6)' }} />}
      <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 14, maxWidth: '82vw', textAlign: 'center', color: '#e8ecf4' }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{media.notes?.trim() || media.filename}</div>
        <div style={{ fontSize: 11, color: '#9aa2b4', marginTop: 3, fontFamily: 'var(--font-mono)' }}>
          {media.filename}{media.width && media.height ? ` · ${media.width}×${media.height}` : ''} · {fmtSize(media.sizeBytes)}
        </div>
        {media.tags.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center', marginTop: 6 }}>
            {media.tags.map((t) => <span key={t} className="chip" style={{ fontSize: 10 }}>{t}</span>)}
          </div>
        )}
      </div>
      <button onClick={onClose} aria-label="Close"
              style={{ position: 'absolute', top: 18, right: 22, background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.25)', color: '#fff', borderRadius: 6, padding: '4px 11px', cursor: 'pointer', fontSize: 16 }}>✕</button>
    </div>
  );
}

// Paste a screenshot (⌘V), describe it, save — straight to R2 + library.
// Built for fast screenshot capture: stays open, clears after each save.
function QuickPasteUpload({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [desc, setDesc] = useState('');
  const [tags, setTags] = useState('');
  const [hot, setHot] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const accept = (f: File) => {
    if (!f.type.startsWith('image/') && !f.type.startsWith('video/')) { setErr('Chỉ nhận ảnh hoặc video'); return; }
    setErr(null); setOkMsg(null);
    setFile(f);
    const u = URL.createObjectURL(f);
    setPreview(u);
    setDims(null);
    if (f.type.startsWith('image/')) {
      const img = new window.Image();
      img.onload = () => setDims({ w: img.naturalWidth, h: img.naturalHeight });
      img.src = u;
    }
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items; if (!items) return;
    for (const it of items) if (it.type.startsWith('image/')) { const f = it.getAsFile(); if (f) { e.preventDefault(); accept(f); return; } }
  };
  const onDrop = (e: React.DragEvent) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) accept(f); };

  // Global paste: copy a screenshot, hit ⌘V anywhere on the page (unless an
  // edit modal is open, which has its own paste handling).
  useEffect(() => {
    const h = (e: ClipboardEvent) => {
      if (document.querySelector('.modal-backdrop')) return;       // edit modal open
      const items = e.clipboardData?.items; if (!items) return;
      for (const it of items) if (it.type.startsWith('image/')) { const f = it.getAsFile(); if (f) { accept(f); return; } }
    };
    document.addEventListener('paste', h);
    return () => document.removeEventListener('paste', h);
  }, []);

  const clear = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null); setPreview(null); setDims(null); setDesc(''); setTags(''); setHot(false);
  };

  const save = () => {
    if (!file) return;
    const fd = new FormData();
    fd.set('file', file);
    fd.set('projectId', projectId);
    fd.set('description', desc);
    fd.set('tags', tags);
    fd.set('hot', hot ? '1' : '0');
    if (dims) { fd.set('width', String(dims.w)); fd.set('height', String(dims.h)); }
    start(async () => {
      const r = await uploadMediaAsset(fd);
      if (!r.ok) { setErr(r.error || 'Upload failed'); return; }
      clear();
      setOkMsg('Saved ✓ — paste the next one');
      router.refresh();
      setTimeout(() => setOkMsg(null), 2500);
    });
  };

  const fld: React.CSSProperties = { width: '100%', padding: '6px 8px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5, color: 'var(--fg-0)', fontSize: 13, outline: 'none' };
  const lbl: React.CSSProperties = { fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, display: 'block' };

  return (
    <div
      className="panel"
      tabIndex={0}
      onPaste={onPaste}
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
      style={{ padding: 12, marginBottom: 8, border: `1px dashed ${file ? 'var(--line)' : 'var(--neon-cyan)'}`, outline: 'none' }}
    >
      <input ref={fileInput} type="file" accept="image/*,video/*" hidden
             onChange={(e) => { const f = e.target.files?.[0]; if (f) accept(f); e.target.value = ''; }} />

      {!file ? (
        <div onClick={() => fileInput.current?.click()} style={{ cursor: 'pointer', textAlign: 'center', padding: '14px 8px' }}>
          <div style={{ fontSize: 20, marginBottom: 4 }}>📋</div>
          <div style={{ fontSize: 13, color: 'var(--fg-1)', fontWeight: 600 }}>Dán screenshot (⌘V) để thêm nhanh vào thư viện</div>
          <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 3 }}>hoặc kéo-thả ảnh/video · hoặc bấm để chọn file</div>
          {okMsg && <div style={{ fontSize: 11, color: 'var(--ok)', marginTop: 6 }}>{okMsg}</div>}
          {err && <div style={{ fontSize: 11, color: 'var(--bad)', marginTop: 6 }}>⚠ {err}</div>}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: '0 0 180px' }}>
            {file.type.startsWith('image/')
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={preview!} alt="paste preview" style={{ width: '100%', borderRadius: 6, border: '1px solid var(--line)', display: 'block' }} />
              : <video src={preview!} controls style={{ width: '100%', borderRadius: 6, border: '1px solid var(--line)' }} />}
            <div style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', marginTop: 4 }}>
              {fmtSize(file.size)}{dims ? ` · ${dims.w}×${dims.h}` : ''} · {file.type || 'unknown'}
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <span style={lbl}>Mô tả (kèm theo ảnh)</span>
              <textarea autoFocus style={{ ...fld, minHeight: 56, resize: 'vertical' }}
                        placeholder="VD: Panel overview — 3 mode + lock% + status READY"
                        value={desc} onChange={(e) => setDesc(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <span style={lbl}>Tags (phẩy)</span>
                <input style={fld} placeholder="screenshot, mql5, hedge-panel" value={tags} onChange={(e) => setTags(e.target.value)} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer', paddingBottom: 6, whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={hot} onChange={(e) => setHot(e.target.checked)} /> 🔥 Hot
              </label>
            </div>
            {err && <div style={{ fontSize: 11, color: 'var(--bad)' }}>⚠ {err}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn ghost" onClick={clear} disabled={pending}>Clear</button>
              <button className="btn primary" onClick={save} disabled={pending}>{pending ? '⟲ Uploading…' : 'Save to library'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MediaFormModal({ asset, projectId, onClose }: { asset: MediaRow | null; projectId: string; onClose: () => void }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [probing, setProbing] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const isCreate = !asset;
  const [form, setForm] = useState({
    kind: (asset?.kind ?? 'image') as MediaInput['kind'],
    filename: asset?.filename ?? '',
    url: asset?.url ?? '',
    mimeType: asset?.mimeType ?? '',
    sizeBytes: asset?.sizeBytes ?? 0,
    width: asset?.width ?? '',
    height: asset?.height ?? '',
    durationSec: asset?.durationSec ?? '',
    hot: asset?.hot ?? false,
    tagsStr: (asset?.tags ?? []).join(', '),
    notes: asset?.notes ?? '',
  });
  const setF = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm((f) => ({ ...f, [k]: v }));

  // Auto-detect: when URL changes (debounced), probe metadata.
  // - For images: <img onload> gives natural width/height.
  // - For all kinds: HEAD fetch returns Content-Type + Content-Length (CORS dependent).
  // - Filename: derive from URL path basename if filename empty.
  useEffect(() => {
    const url = form.url.trim();
    if (!url || !/^https?:\/\//.test(url)) return;
    const t = setTimeout(async () => {
      setProbing(true);
      try {
        // Filename auto-fill if empty
        if (!form.filename) {
          const m = url.match(/\/([^/?#]+?)(?:\?.*)?(?:#.*)?$/);
          if (m) setForm((f) => f.filename ? f : { ...f, filename: m[1]! });
        }
        // HEAD fetch for MIME + size (CORS may block; ignore failures silently)
        try {
          const head = await fetch(url, { method: 'HEAD', mode: 'cors' });
          const ct = head.headers.get('content-type');
          const cl = head.headers.get('content-length');
          if (ct) setForm((f) => f.mimeType ? f : { ...f, mimeType: ct.split(';')[0]!.trim() });
          if (cl) setForm((f) => f.sizeBytes ? f : { ...f, sizeBytes: Number(cl) });
        } catch { /* CORS or offline */ }
        // Image dimensions via <img>
        if (form.kind === 'image') {
          const img = new window.Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            setForm((f) => ({
              ...f,
              width: f.width === '' || f.width === 0 ? img.naturalWidth : f.width,
              height: f.height === '' || f.height === 0 ? img.naturalHeight : f.height,
            }));
          };
          img.src = url;
        }
        // Video duration + dimensions via <video>
        if (form.kind === 'video') {
          const vid = document.createElement('video');
          vid.preload = 'metadata';
          vid.onloadedmetadata = () => {
            setForm((f) => ({
              ...f,
              width: f.width === '' || f.width === 0 ? vid.videoWidth : f.width,
              height: f.height === '' || f.height === 0 ? vid.videoHeight : f.height,
              durationSec: f.durationSec === '' || f.durationSec === 0 ? Math.round(vid.duration) : f.durationSec,
            }));
          };
          vid.src = url;
        }
      } finally {
        setProbing(false);
      }
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.url, form.kind]);

  const handleAiSuggest = () => {
    if (!form.filename && !form.url) { setError('Cần filename hoặc URL trước khi AI suggest'); return; }
    setAiBusy(true);
    setError(null);
    suggestMediaMeta({ filename: form.filename, url: form.url, kind: form.kind })
      .then((res) => {
        if (!res.ok) { setError(res.error || 'AI suggest failed'); return; }
        setForm((f) => ({
          ...f,
          tagsStr: res.tags?.length ? res.tags.join(', ') : f.tagsStr,
          notes: res.notes || f.notes,
        }));
      })
      .finally(() => setAiBusy(false));
  };

  const fld: React.CSSProperties = { width: '100%', padding: '6px 8px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5, color: 'var(--fg-0)', fontSize: 13, outline: 'none' };
  const lbl: React.CSSProperties = { fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, display: 'block' };

  const handleSave = () => {
    if (!form.filename.trim() || !form.url.trim()) { setError('filename + url required'); return; }
    const payload: MediaInput = {
      kind: form.kind, filename: form.filename, url: form.url,
      mimeType: form.mimeType || null,
      sizeBytes: Number(form.sizeBytes) | 0,
      width: form.width === '' ? null : Number(form.width) | 0,
      height: form.height === '' ? null : Number(form.height) | 0,
      durationSec: form.durationSec === '' ? null : Number(form.durationSec) | 0,
      hot: form.hot,
      tags: form.tagsStr.split(',').map((s) => s.trim()).filter(Boolean),
      notes: form.notes || null,
    };
    startTransition(async () => {
      const res = isCreate ? await createMediaAsset(payload, projectId) : await updateMediaAsset(asset!.id, payload, projectId);
      if (!res.ok) { setError(res.error || 'Save failed'); return; }
      router.refresh(); onClose();
    });
  };
  const handleDelete = () => {
    if (!asset) return;
    if (!confirm(`Delete "${asset.filename}"?`)) return;
    startTransition(async () => { await deleteMediaAsset(asset.id, projectId); router.refresh(); onClose(); });
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) e.stopPropagation(); }}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div><div className="id-line">{asset ? `#${asset.id}` : 'NEW MEDIA'}</div><h2>{isCreate ? '+ New media asset' : `Edit ${asset!.filename}`}</h2></div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {error && <div style={{ padding: '8px 14px', background: 'rgba(255,77,94,.08)', borderBottom: '1px solid rgba(255,77,94,.3)', color: 'var(--bad)', fontSize: 12 }}>⚠ {error}</div>}
        <AIFormParser
          currentValues={form}
          context="Media asset form. Parse from URL (image/video link), file metadata paste, screenshot of asset listing."
          schema={[
            { key: 'kind', label: 'Asset kind', type: 'enum', enumValues: ['image', 'video', 'audio', 'document', 'other'] },
            { key: 'filename', label: 'Filename' },
            { key: 'url', label: 'URL/path to asset' },
            { key: 'mimeType', label: 'MIME type (image/png, video/mp4, ...)' },
            { key: 'sizeBytes', label: 'Size in bytes (number)', type: 'number' },
            { key: 'width', label: 'Width pixels (number)', type: 'number' },
            { key: 'height', label: 'Height pixels (number)', type: 'number' },
            { key: 'durationSec', label: 'Duration in seconds (number, video/audio only)', type: 'number' },
            { key: 'notes', label: 'Notes' },
          ]}
          onApply={(v) => setForm((f) => ({
            ...f,
            kind: (v.kind as MediaInput['kind']) || f.kind,
            filename: typeof v.filename === 'string' ? v.filename : f.filename,
            url: typeof v.url === 'string' ? v.url : f.url,
            mimeType: typeof v.mimeType === 'string' ? v.mimeType : f.mimeType,
            sizeBytes: typeof v.sizeBytes === 'number' ? v.sizeBytes : f.sizeBytes,
            width: typeof v.width === 'number' ? v.width : f.width,
            height: typeof v.height === 'number' ? v.height : f.height,
            durationSec: typeof v.durationSec === 'number' ? v.durationSec : f.durationSec,
            notes: typeof v.notes === 'string' ? v.notes : f.notes,
          }))}
        />
        <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <span style={lbl}>Kind</span>
            <select style={fld} value={form.kind} onChange={(e) => setF('kind', e.target.value as MediaInput['kind'])}>
              {Object.entries(KIND_ICON).map(([k, ic]) => <option key={k} value={k}>{ic} {k}</option>)}
            </select>
          </div>
          <div>
            <span style={lbl}>Filename *</span>
            <input style={fld} value={form.filename} onChange={(e) => setF('filename', e.target.value)} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <span style={lbl}>
              URL *
              {probing && <span style={{ marginLeft: 8, fontSize: 9, color: 'var(--neon-cyan)', textTransform: 'none', letterSpacing: 0 }}>⟲ probing…</span>}
            </span>
            <input style={fld} type="url" placeholder="https://... or s3://..." value={form.url} onChange={(e) => setF('url', e.target.value)} />
            <div style={{ fontSize: 9, color: 'var(--fg-4)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
              Paste URL → auto-detect MIME/size/width/height (CORS dependent).
            </div>
          </div>
          <div><span style={lbl}>MIME</span><input style={fld} placeholder="image/png" value={form.mimeType} onChange={(e) => setF('mimeType', e.target.value)} /></div>
          <div><span style={lbl}>Size (bytes)</span><input style={fld} type="number" value={form.sizeBytes} onChange={(e) => setF('sizeBytes', Number(e.target.value) | 0)} /></div>
          <div><span style={lbl}>Width</span><input style={fld} type="number" value={form.width} onChange={(e) => setF('width', e.target.value)} /></div>
          <div><span style={lbl}>Height</span><input style={fld} type="number" value={form.height} onChange={(e) => setF('height', e.target.value)} /></div>
          <div><span style={lbl}>Duration (s)</span><input style={fld} type="number" value={form.durationSec} onChange={(e) => setF('durationSec', e.target.value)} /></div>
          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 6 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.hot} onChange={(e) => setF('hot', e.target.checked)} />
              🔥 Hot reuse
            </label>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <span style={{ ...lbl, marginBottom: 0 }}>Tags (comma-separated)</span>
              <button type="button" onClick={handleAiSuggest} disabled={aiBusy}
                      className="btn"
                      style={{ marginLeft: 'auto', fontSize: 10, padding: '2px 8px' }}
                      title="OpenAI gpt-4o-mini suggests tags + notes từ filename/URL">
                {aiBusy ? '⟲ thinking…' : '🤖 AI suggest'}
              </button>
            </div>
            <input style={fld} value={form.tagsStr} onChange={(e) => setF('tagsStr', e.target.value)} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <span style={lbl}>Notes</span>
            <textarea style={{ ...fld, minHeight: 60 }} value={form.notes} onChange={(e) => setF('notes', e.target.value)} />
          </div>
        </div>
        <div className="modal-foot">
          <div className="meta">{isCreate ? 'New' : 'Editing'}</div>
          <div className="modal-foot-actions">
            {!isCreate && <button className="btn danger" onClick={handleDelete}>🗑 Delete</button>}
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            <button className="btn primary" onClick={handleSave}>{isCreate ? 'Create' : 'Save'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
