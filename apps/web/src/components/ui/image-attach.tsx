'use client';

// Reusable image attachment control — drag & drop, Ctrl+V paste, a Paste button (mobile /
// where Ctrl+V is awkward), file picker, and add-by-URL. Uploads immediately to R2 and shows a
// coloured success/error status. `value` is the list of attached URLs. Use anywhere attachments
// are needed (blocker report, feedback form, …).
import { useState, useRef, type CSSProperties } from 'react';
import { uploadImage, deleteImage } from '@/lib/actions/uploads';

// Delete uploaded (unsent) attachments from R2. Call from a form's Cancel/close so nothing is
// orphaned. No-op for external "Thêm URL" links.
export function discardAttachments(urls: string[]) { for (const u of urls) void deleteImage(u); }

const btn: CSSProperties = { fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--fg-1)', cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 };

export function ImageAttach({ value, onChange, folder = 'uploads', max = 6 }: {
  value: string[]; onChange: (urls: string[]) => void; folder?: string; max?: number;
}) {
  const [busy, setBusy] = useState(0);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [drag, setDrag] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [urlText, setUrlText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const full = value.length >= max;
  const addUrls = (urls: string[]) => onChange([...value, ...urls].slice(0, max));

  const readAsDataUrl = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(f); });

  const pushDataUrls = async (dataUrls: string[]) => {
    const room = max - value.length;
    const take = dataUrls.slice(0, Math.max(0, room));
    if (!take.length) { setStatus({ ok: false, text: `Tối đa ${max} ảnh` }); return; }
    setBusy((n) => n + take.length);
    const done: string[] = [];
    for (const du of take) {
      const r = await uploadImage(du, folder);
      if (r.ok && r.url) done.push(r.url); else setStatus({ ok: false, text: r.error || 'upload lỗi' });
    }
    setBusy((n) => Math.max(0, n - take.length));
    if (done.length) { onChange([...value, ...done].slice(0, max)); setStatus({ ok: true, text: `✓ Đã tải lên ${done.length} ảnh` }); }
  };

  const addFiles = async (files: FileList | File[] | null | undefined) => {
    const imgs = files ? [...files].filter((f) => f.type.startsWith('image/')) : [];
    if (!imgs.length) return;
    await pushDataUrls(await Promise.all(imgs.map(readAsDataUrl)));
  };

  // "Paste" button — read the clipboard directly (mobile / when the textarea isn't focused).
  const pasteClipboard = async () => {
    try {
      const items = await navigator.clipboard.read();
      const blobs: File[] = [];
      for (const it of items) {
        const type = it.types.find((t) => t.startsWith('image/'));
        if (type) { const b = await it.getType(type); blobs.push(new File([b], 'paste.png', { type })); }
      }
      if (blobs.length) await addFiles(blobs); else setStatus({ ok: false, text: 'Clipboard không có ảnh' });
    } catch { setStatus({ ok: false, text: 'Trình duyệt chặn đọc clipboard — dùng Ctrl+V hoặc Chọn file' }); }
  };

  // "Chụp trang" — capture the screen/tab via the native picker, grab one frame.
  const capture = async () => {
    try {
      const md = navigator.mediaDevices as MediaDevices & { getDisplayMedia?: (c: unknown) => Promise<MediaStream> };
      if (!md?.getDisplayMedia) { setStatus({ ok: false, text: 'Trình duyệt không hỗ trợ chụp màn hình' }); return; }
      const stream = await md.getDisplayMedia({ video: true });
      const video = document.createElement('video'); video.srcObject = stream; await video.play();
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      canvas.getContext('2d')!.drawImage(video, 0, 0);
      stream.getTracks().forEach((t) => t.stop());
      await pushDataUrls([canvas.toDataURL('image/png')]);
    } catch { setStatus({ ok: false, text: 'Đã huỷ / không chụp được' }); }
  };

  return (
    <div
      data-comp="ui.ImageAttach"
      tabIndex={0}
      onPaste={(e) => { const imgs = [...(e.clipboardData?.items || [])].filter((i) => i.type.startsWith('image/')).map((i) => i.getAsFile()).filter(Boolean) as File[]; if (imgs.length) { e.preventDefault(); void addFiles(imgs); } }}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); void addFiles(e.dataTransfer?.files); }}
      style={{ border: `1px dashed ${drag ? 'var(--accent)' : 'var(--line)'}`, borderRadius: 8, padding: 10, background: drag ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'var(--bg-1)', display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <div style={{ fontSize: 10.5, color: 'var(--fg-4)', textAlign: 'center' }}>Kéo thả · Ctrl+V · bấm Paste</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button type="button" onClick={capture} disabled={full} style={btn}>📷 Chụp trang</button>
        <button type="button" onClick={pasteClipboard} disabled={full} style={btn}>📋 Paste</button>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={full} style={btn}>🖼 Chọn file</button>
        <button type="button" onClick={() => setUrlOpen((v) => !v)} disabled={full} style={btn}>🔗 Thêm URL</button>
        <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => { void addFiles(e.target.files); e.target.value = ''; }} />
      </div>

      {urlOpen && !full && (
        <div style={{ display: 'flex', gap: 6 }}>
          <input value={urlText} onChange={(e) => setUrlText(e.target.value)} placeholder="https://…/ảnh.png" autoComplete="off"
            style={{ flex: 1, minWidth: 0, fontSize: 12, padding: '5px 8px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--fg-0)' }} />
          <button type="button" onClick={() => { const u = urlText.trim(); if (/^https?:\/\//.test(u)) { addUrls([u]); setUrlText(''); setUrlOpen(false); setStatus({ ok: true, text: '✓ Đã thêm URL ảnh' }); } else setStatus({ ok: false, text: 'URL không hợp lệ' }); }} style={btn}>Thêm</button>
        </div>
      )}

      {busy > 0 && <div style={{ fontSize: 11, color: 'var(--fg-3)', textAlign: 'center' }}>Đang tải {busy} ảnh…</div>}
      {status && <div style={{ fontSize: 11.5, fontWeight: 700, textAlign: 'center', padding: '4px 8px', borderRadius: 6, color: status.ok ? 'var(--ok,#22c55e)' : 'var(--bad,#ef4444)', background: `color-mix(in srgb, ${status.ok ? 'var(--ok,#22c55e)' : 'var(--bad,#ef4444)'} 12%, transparent)` }}>{status.text}</div>}

      {value.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {value.map((u, i) => (
            <div key={i} style={{ position: 'relative' }}>
              <a href={u} target="_blank" rel="noopener noreferrer"><img src={u} alt={`ảnh ${i + 1}`} style={{ width: 74, height: 56, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--line)', display: 'block' }} /></a>
              <button type="button" onClick={() => { void deleteImage(u); onChange(value.filter((_, j) => j !== i)); }} title="Bỏ (xoá luôn khỏi storage)" style={{ position: 'absolute', top: -7, right: -7, width: 18, height: 18, borderRadius: 999, border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--fg-1)', cursor: 'pointer', fontSize: 11, lineHeight: '16px', padding: 0 }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
