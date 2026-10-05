'use client';

// Reusable image attachment control — drag & drop, Ctrl+V paste, a Paste button (mobile /
// where Ctrl+V is awkward), file picker, and add-by-URL. Uploads immediately to R2 and shows a
// coloured success/error status. `value` is the list of attached URLs. Use anywhere attachments
// are needed (blocker report, feedback form, …).
import { useState, useRef, useEffect, type CSSProperties } from 'react';
import { uploadImage, deleteImage } from '@/lib/actions/uploads';

// Delete uploaded (unsent) attachments from R2. Call from a form's Cancel/close so nothing is
// orphaned. No-op for external "Thêm URL" links.
export function discardAttachments(urls: string[]) { for (const u of urls) void deleteImage(u); }


// Server action bị Next chặn body >1MB (không nới) — ảnh chụp màn retina vượt trần đó thường xuyên.
const TRAN_ACTION = 950_000;
/** Cạnh dài tối đa sau thu nhỏ: đủ đọc chữ trên ảnh chụp màn 1440p, nhẹ hơn nhiều lần bản retina 2880px. */
const CANH_MAX = 2000;
type KichCo = { w: number; h: number; kb: number };
type AnhMeta = KichCo & { goc?: KichCo | null };
type Cho = { id: number; xem: string; buoc: 'nen' | 'tai' | 'loi'; goc: KichCo | null; sau?: KichCo; loi: string | null };
let seq = 0;
const kb = (n: number) => Math.max(1, Math.round(n / 1024));
const tenKc = (k: KichCo) => `${k.w}×${k.h} · ${k.kb >= 1024 ? `${(k.kb / 1024).toFixed(1)}MB` : `${k.kb}KB`}`;

/** Thu nhỏ + nén một ảnh: cạnh dài > CANH_MAX thì co lại; ảnh nặng thì mã hoá lại WebP (Safari không mã hoá WebP → JPEG).
 *  Ảnh nhỏ sẵn (≤ CANH_MAX, ≤ 400KB) và GIF giữ nguyên. Trả data URL + kích thước gốc/sau để hiện cho người gửi. */
async function thuNho(bl: Blob): Promise<{ du: string; goc: KichCo; sau: KichCo }> {
  const bmp = await createImageBitmap(bl);
  const goc = { w: bmp.width, h: bmp.height, kb: kb(bl.size) };
  const tiLe = Math.min(1, CANH_MAX / Math.max(bmp.width, bmp.height));
  const duGoc = () => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(bl); });
  if (bl.type === 'image/gif' || (tiLe === 1 && bl.size <= 400_000)) { bmp.close(); return { du: await duGoc(), goc, sau: goc }; }
  const c = document.createElement('canvas');
  let du = '';
  // Hạ chất lượng trước; ảnh dày chi tiết mà q 0.35 vẫn quá trần (đo: 2000px nhiều chữ màu ra 1,6MB WebP) thì co tiếp
  // kích thước ×0.75 — tới khi lọt trần, không bao giờ đẩy lên server một ảnh chắc chắn bị chặn.
  for (let co = tiLe; ; co *= 0.75) {
    c.width = Math.max(1, Math.round(bmp.width * co)); c.height = Math.max(1, Math.round(bmp.height * co));
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    for (const q of [0.85, 0.7, 0.5, 0.35]) {
      du = c.toDataURL('image/webp', q);
      if (!du.startsWith('data:image/webp')) du = c.toDataURL('image/jpeg', q);
      if (du.length <= TRAN_ACTION) break;
    }
    if (du.length <= TRAN_ACTION || c.width < 400) break;
  }
  bmp.close();
  return { du, goc, sau: { w: c.width, h: c.height, kb: kb(Math.round(du.length * 0.75)) } };
}

// Kích thước ảnh đã lên giữ ở localStorage theo URL: ảnh trên img.on.tc không có CORS nên sau F5 trình duyệt không đọc lại được
// dung lượng. Mất kho (riêng tư / xoá dữ liệu) thì ô chỉ hiện W×H đo từ <img>.
const KHO_META = 'image-attach.meta';
const docMeta = (): Record<string, AnhMeta> => { try { return JSON.parse(localStorage.getItem(KHO_META) ?? '{}') ?? {}; } catch { return {}; } };
const ghiMeta = (url: string, m: AnhMeta) => {
  try { const all = docMeta(); all[url] = m; const keys = Object.keys(all); for (const k of keys.slice(0, Math.max(0, keys.length - 200))) delete all[k]; localStorage.setItem(KHO_META, JSON.stringify(all)); } catch { /* đầy/chặn */ }
};

const btn: CSSProperties = { fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--fg-1)', cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 };

export function ImageAttach({ value, onChange, folder = 'uploads', max = 6 }: {
  value: string[]; onChange: (urls: string[]) => void; folder?: string; max?: number;
}) {
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [drag, setDrag] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [urlText, setUrlText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const [cho, setCho] = useState<Cho[]>([]);
  const [meta, setMeta] = useState<Record<string, AnhMeta>>({});
  useEffect(() => { setMeta(docMeta()); }, []);
  // Dòng "✓ Đã tải lên N ảnh" là tin của MỘT lượt tải — số ảnh giảm (✕ một ảnh, Huỷ nháp, form gửi xong) thì nó thành sai
  // (anh báo 05/10/2026: xoá ảnh rồi vẫn ghi "có 1 ảnh đã tải lên"). Bắt ở đây cho mọi đường làm giảm, kể cả đường từ form cha.
  const soTruoc = useRef(value.length);
  useEffect(() => {
    if (value.length < soTruoc.current) setStatus(null);
    soTruoc.current = value.length;
  }, [value.length]);
  const full = value.length + cho.filter((c) => c.buoc !== 'loi').length >= max;
  const addUrls = (urls: string[]) => onChange([...value, ...urls].slice(0, max));

  // MỖI ẢNH MỘT DÒNG TRẠNG THÁI (anh chốt 05/10/2026): trước đây chỉ có "Đang tải N ảnh…" chung, không biết ảnh nào đang ở bước
  // nào, đã thu nhỏ chưa, lên tới bao nhiêu KB. Giờ: ô xem trước + bước (nén → tải → xong/lỗi) + kích thước sau khi lên.
  const datCho = (id: number, p: Partial<Cho>) => setCho((ds) => ds.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const pushBlobs = async (blobs: Blob[]) => {
    const room = max - value.length;
    const take = blobs.slice(0, Math.max(0, room));
    if (!take.length) { setStatus({ ok: false, text: `Tối đa ${max} ảnh` }); return; }
    setStatus(null);
    const viec = take.map((bl) => ({ bl, c: { id: ++seq, xem: URL.createObjectURL(bl), buoc: 'nen' as const, goc: null, loi: null } }));
    setCho((ds) => [...ds, ...viec.map((v) => v.c)]);
    const done: string[] = [];
    let loi = 0;
    for (const { bl, c } of viec) {
      try {
        const n = await thuNho(bl);
        datCho(c.id, { goc: n.goc, buoc: 'tai', sau: n.sau });
        if (n.du.length > TRAN_ACTION) throw new Error(`ảnh vẫn ${(n.du.length * 0.75 / 1e6).toFixed(1)}MB sau nén — cắt nhỏ vùng chụp`);
        const r = await uploadImage(n.du, folder);
        if (!r.ok || !r.url) throw new Error(r.error || 'upload lỗi');
        done.push(r.url);
        ghiMeta(r.url, { ...n.sau, goc: n.goc });
        setMeta(docMeta());
        setCho((ds) => ds.filter((x) => x.id !== c.id)); URL.revokeObjectURL(c.xem);
      } catch (e) {
        loi++; datCho(c.id, { buoc: 'loi', loi: e instanceof Error ? e.message : 'upload lỗi' });
      }
    }
    if (done.length) onChange([...value, ...done].slice(0, max));
    setStatus(loi ? { ok: false, text: `${loi} ảnh lỗi — xem ô đỏ bên dưới` } : { ok: true, text: `✓ Đã tải lên ${done.length} ảnh` });
  };
  const pushDataUrls = async (dataUrls: string[]) => pushBlobs(await Promise.all(dataUrls.map((d) => fetch(d).then((r) => r.blob()))));

  const addFiles = async (files: FileList | File[] | null | undefined) => {
    const imgs = files ? [...files].filter((f) => f.type.startsWith('image/')) : [];
    if (imgs.length) await pushBlobs(imgs);
  };

  // Ctrl+V Ở BẤT KỲ Ô NÀO cùng drawer/form (anh báo 05/10/2026: đang gõ mô tả mà dán ảnh không ăn — onPaste chỉ gắn trên khung
  // ảnh, con trỏ nằm ở textarea anh em thì sự kiện không bao giờ tới). Nghe ở document, nhận khi chỗ dán chung vùng với khung
  // này (cùng ui.Drawer / form gần nhất, hoặc chưa focus gì). Chỉ chặn mặc định khi clipboard CÓ ẢNH — dán chữ vẫn vào ô như thường.
  const hopRef = useRef<HTMLDivElement>(null);
  const addFilesRef = useRef(addFiles);
  addFilesRef.current = addFiles;
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const hop = hopRef.current;
      if (!hop || e.defaultPrevented) return;
      const imgs = [...(e.clipboardData?.items || [])].filter((i) => i.type.startsWith('image/')).map((i) => i.getAsFile()).filter(Boolean) as File[];
      if (!imgs.length) return;
      const t = e.target instanceof Element ? e.target : null;
      const vung = hop.closest('[data-comp="ui.Drawer"], form') ?? hop.parentElement;
      if (t && t !== document.body && !(vung?.contains(t) || hop.contains(t))) return;
      e.preventDefault();
      void addFilesRef.current(imgs);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, []);

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
      ref={hopRef}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); void addFiles(e.dataTransfer?.files); }}
      style={{ border: `1px dashed ${drag ? 'var(--accent)' : 'var(--line)'}`, borderRadius: 8, padding: 10, background: drag ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'var(--bg-1)', display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <div style={{ fontSize: 10.5, color: 'var(--fg-4)', textAlign: 'center' }}>Kéo thả · Ctrl+V ở bất kỳ ô nào (kể cả khi đang gõ) · bấm Paste</div>
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

      {status && <div style={{ fontSize: 11.5, fontWeight: 700, textAlign: 'center', padding: '4px 8px', borderRadius: 6, color: status.ok ? 'var(--ok,#22c55e)' : 'var(--bad,#ef4444)', background: `color-mix(in srgb, ${status.ok ? 'var(--ok,#22c55e)' : 'var(--bad,#ef4444)'} 12%, transparent)` }}>{status.text}</div>}

      {(value.length > 0 || cho.length > 0) && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {value.map((u, i) => {
            const m = meta[u];
            return (
              <div key={u} style={{ position: 'relative', width: 96 }}>
                <a href={u} target="_blank" rel="noopener noreferrer"><img src={u} alt={`ảnh ${i + 1}`}
                  onLoad={(e) => { if (!m) { const im = e.currentTarget; setMeta((x) => ({ ...x, [u]: { w: im.naturalWidth, h: im.naturalHeight, kb: 0 } })); } }}
                  style={{ width: 96, height: 64, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--ok,#22c55e)', display: 'block' }} /></a>
                <div title={m?.goc && (m.goc.w !== m.w || m.goc.kb !== m.kb) ? `gốc ${tenKc(m.goc)} → đã thu nhỏ/nén` : 'giữ nguyên ảnh gốc'}
                  style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', marginTop: 2, lineHeight: 1.3 }}>
                  <span style={{ color: 'var(--ok,#22c55e)' }}>✓</span> {m ? (m.kb ? tenKc(m) : `${m.w}×${m.h}`) : '…'}
                  {m?.goc && m.goc.kb !== m.kb && <div style={{ color: 'var(--fg-4)' }}>gốc {tenKc(m.goc)}</div>}
                </div>
                <button type="button" onClick={() => { void deleteImage(u); onChange(value.filter((_, j) => j !== i)); }} title="Bỏ (xoá luôn khỏi storage)" style={{ position: 'absolute', top: -7, right: -7, width: 18, height: 18, borderRadius: 999, border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--fg-1)', cursor: 'pointer', fontSize: 11, lineHeight: '16px', padding: 0 }}>✕</button>
              </div>
            );
          })}
          {cho.map((c) => (
            <div key={c.id} style={{ position: 'relative', width: 96 }}>
              <img src={c.xem} alt="" style={{ width: 96, height: 64, objectFit: 'cover', borderRadius: 6, display: 'block', opacity: c.buoc === 'loi' ? 1 : 0.45,
                border: `1px solid ${c.buoc === 'loi' ? 'var(--bad,#ef4444)' : 'var(--accent)'}` }} />
              <div style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', marginTop: 2, lineHeight: 1.3, color: c.buoc === 'loi' ? 'var(--bad,#ef4444)' : 'var(--accent)' }}>
                {c.buoc === 'nen' ? '⏳ đang thu nhỏ…' : c.buoc === 'tai' ? `⬆ đang tải${c.sau ? ` ${tenKc(c.sau)}` : '…'}` : `⚠ ${c.loi}`}
                {c.goc && c.buoc !== 'loi' && <div style={{ color: 'var(--fg-4)' }}>gốc {tenKc(c.goc)}</div>}
              </div>
              {c.buoc === 'loi' && <button type="button" onClick={() => { URL.revokeObjectURL(c.xem); setCho((ds) => ds.filter((x) => x.id !== c.id)); }} title="Bỏ ảnh lỗi"
                style={{ position: 'absolute', top: -7, right: -7, width: 18, height: 18, borderRadius: 999, border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--fg-1)', cursor: 'pointer', fontSize: 11, lineHeight: '16px', padding: 0 }}>✕</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
