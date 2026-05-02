'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { MediaRow } from '@/lib/data';
import { createMediaAsset, updateMediaAsset, deleteMediaAsset, suggestMediaMeta, type MediaInput } from '@/lib/actions/vaults';
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
  const [editing, setEditing] = useState<MediaRow | null>(null);
  const [creating, setCreating] = useState(false);

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
      <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '8px 0' }}>
        <button className="btn primary" onClick={() => setCreating(true)}>+ New asset</button>
      </div>
      {items.length === 0 ? (
        <EmptyState icon="🎬" title="No media" description="Upload hoặc external link asset đầu tiên." compact />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
          {items.map((m) => (
            <div key={m.id} className="panel" style={{ cursor: 'pointer', overflow: 'hidden' }} onClick={() => setEditing(m)}>
              {m.kind === 'image' && (
                <div style={{ aspectRatio: '16 / 10', background: 'var(--bg-2)', overflow: 'hidden' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.url} alt={m.filename} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}
              <div style={{ padding: '6px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14 }}>{KIND_ICON[m.kind] ?? '🗂'}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{m.filename}</span>
                  {m.hot && <span style={{ fontSize: 10, color: 'var(--neon-amber)' }}>🔥</span>}
                </div>
                <div style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', marginTop: 2 }}>
                  {m.kind} · {fmtSize(m.sizeBytes)}{m.width && m.height ? ` · ${m.width}×${m.height}` : ''}
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
        <MediaFormModal asset={editing} projectId={projectId} onClose={() => { setEditing(null); setCreating(false); }} />
      )}
    </>
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
