'use client';
// HÒM GÓP Ý 💬 DÙNG CHUNG — giao diện. Gom từ hòm studio (apps/xuong-video/src/components/gop-y.tsx + image-attach.tsx, 10/10/2026)
// để mọi app con dùng MỘT bản, không chép: tab "Gửi góp ý" (loại · mô tả · ảnh: chụp trang / Ctrl+V / kéo thả / chọn file / URL,
// nháp + ảnh sống qua F5, ngữ cảnh tự gom lúc gửi) · "Của tôi" + "Hỏi đáp" (luồng trao đổi ngay tại đây: trả lời / làm lại / duyệt xong).
// Phần riêng của từng app đi vào qua props: `hd` (server action của app, bọc @mos2/gop-y/server), `Khung` (drawer của app),
// `nut` (class nút), `xemAnh` (xem ảnh to), `chonNgan`/`chonLoi` (selector để gom ngữ cảnh), `khoa` (tiền tố localStorage).
import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ComponentType, type ReactNode } from 'react';
import type { GopYCuaToi, TinTraoDoi, Kq } from './server';

export type HanhDongGopY = {
  guiGopY: (input: { loai: string; noiDung: string; trang: string; anhUrls: string[]; nguCanh?: string }) => Promise<Kq & { id?: number }>;
  dsGopYCuaToi: () => Promise<GopYCuaToi[]>;
  docTraoDoi: (taskId: number) => Promise<TinTraoDoi[]>;
  guiTraoDoi: (input: { taskId: number; noiDung: string; anhUrls: string[]; xuLy: string }) => Promise<Kq>;
  taiAnhGopY: (dataUrl: string) => Promise<{ ok: boolean; url?: string; error?: string }>;
  xoaAnhGopY?: (url: string) => Promise<unknown>;
};
export type KhungHom = ComponentType<{ onClose: () => void; tieuDe: ReactNode; dau: ReactNode; children: ReactNode }>;
export type CauHinhHom = {
  ten: string; khoa: string; hd: HanhDongGopY; Khung: KhungHom;
  nut?: { thuong: string; chinh: string }; xemAnh?: (url: string) => void; chonNgan?: string; chonLoi?: string;
};
type Cfg = { khoa: string; hd: HanhDongGopY; xemAnh?: (url: string) => void; nut: { thuong: string; chinh: string }; chonNgan: string; chonLoi: string };
const Ctx = createContext<Cfg | null>(null);

/** Xem ảnh to ngay trên trang (app không đưa `xemAnh` riêng) — không mở tab mới. Bấm bất kỳ đâu / Esc là đóng. */
function xemAnhTaiCho(url: string) {
  const nen = document.createElement('div');
  nen.style.cssText = 'position:fixed;inset:0;z-index:100;background:rgba(0,0,0,.82);display:flex;align-items:center;justify-content:center;cursor:zoom-out;padding:16px';
  const im = document.createElement('img'); im.src = url; im.alt = '';
  im.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;border-radius:6px';
  nen.appendChild(im);
  const dong = () => { nen.remove(); document.removeEventListener('keydown', esc, true); };
  const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); dong(); } };
  nen.onclick = dong; document.addEventListener('keydown', esc, true); document.body.appendChild(nen);
}

// localStorage an toàn (riêng tư / đầy / máy chủ → coi như chưa lưu).
function docLT(khoa: string): string | null { try { return localStorage.getItem(khoa); } catch { return null; } }
function ghiLT(khoa: string, v: string | null): void { try { if (v == null) localStorage.removeItem(khoa); else localStorage.setItem(khoa, v); } catch { /* riêng tư / đầy */ } }
function docJsonLT<T>(khoa: string, macDinh: T): T { const s = docLT(khoa); if (s == null) return macDinh; try { return JSON.parse(s) as T; } catch { return macDinh; } }
const ghiJsonLT = (khoa: string, v: unknown): void => ghiLT(khoa, JSON.stringify(v));
function useNho<T extends string>(khoa: string, macDinh: T, hopLe?: readonly T[]): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => { const s = docLT(khoa) as T | null; return s != null && (!hopLe || hopLe.includes(s)) ? s : macDinh; });
  return [v, (x: T) => { setV(x); ghiLT(khoa, x); }];
}
function gioVN(iso: string | Date = new Date(), o: { giay?: boolean; chiGio?: boolean } = {}): string {
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', ...(o.giay ? { second: '2-digit' } : {}), ...(o.chiGio ? {} : { day: '2-digit', month: '2-digit' }) });
}

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
const docMeta = (): Record<string, AnhMeta> => docJsonLT<Record<string, AnhMeta> | null>(KHO_META, null) ?? {};
const ghiMeta = (url: string, m: AnhMeta) => {
  const all = docMeta(); all[url] = m; const keys = Object.keys(all); for (const k of keys.slice(0, Math.max(0, keys.length - 200))) delete all[k];
  ghiJsonLT(KHO_META, all);
};

const btn: CSSProperties = { fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--fg-1)', cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 };

/** `upload` thay đường tải mặc định (hòm góp ý) — vd ảnh tham chiếu anchor đi taiAnhLen. Ảnh đã tải chỉ gỡ khỏi danh sách, không xoá file. */
export function ImageAttach({ value, onChange, max = 6, upload, xemAnh, xoaAnh, nhanBo = 'Bỏ ảnh' }: {
  value: string[]; onChange: (urls: string[]) => void; max?: number;
  upload: (dataUrl: string) => Promise<{ ok: boolean; url?: string; error?: string }>;
  xemAnh?: (url: string) => void; xoaAnh?: (url: string) => unknown; nhanBo?: string;
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
  // Danh sách ảnh HIỆN TẠI qua ref: lượt tải chạy vài giây, `value` bắt lúc bắt đầu đã cũ khi nó xong — ghi `[...value cũ, mới]`
  // là đè mất ảnh của lượt tải song song / ảnh vừa ✕ (anh báo 05/10/2026: dán ảnh rồi gõ thì mất cả chữ lẫn ảnh).
  const valueRef = useRef(value);
  valueRef.current = value;
  const addUrls = (urls: string[]) => onChange([...valueRef.current, ...urls].slice(0, max));

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
        const r = await upload(n.du);
        if (!r.ok || !r.url) throw new Error(r.error || 'upload lỗi');
        done.push(r.url);
        ghiMeta(r.url, { ...n.sau, goc: n.goc });
        setMeta(docMeta());
        setCho((ds) => ds.filter((x) => x.id !== c.id)); URL.revokeObjectURL(c.xem);
      } catch (e) {
        loi++; datCho(c.id, { buoc: 'loi', loi: e instanceof Error ? e.message : 'upload lỗi' });
      }
    }
    if (done.length) onChange([...valueRef.current, ...done].slice(0, max));
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
      style={{ border: `1px dashed ${drag ? 'var(--cyan)' : 'var(--line)'}`, borderRadius: 8, padding: 10, background: drag ? 'color-mix(in srgb, var(--cyan) 8%, transparent)' : 'var(--bg-1)', display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <div style={{ fontSize: 10.5, color: 'var(--fg-4)', textAlign: 'center' }}>Kéo thả · Ctrl+V (cả khi đang gõ trong form này) · bấm Paste</div>
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
                <img src={u} alt={`ảnh ${i + 1}`} onClick={() => (xemAnh ?? xemAnhTaiCho)(u)}
                  onLoad={(e) => { if (!m) { const im = e.currentTarget; setMeta((x) => ({ ...x, [u]: { w: im.naturalWidth, h: im.naturalHeight, kb: 0 } })); } }}
                  style={{ width: 96, height: 64, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--ok,#22c55e)', display: 'block', cursor: 'zoom-in' }} />
                <div title={m?.goc && (m.goc.w !== m.w || m.goc.kb !== m.kb) ? `gốc ${tenKc(m.goc)} → đã thu nhỏ/nén` : 'giữ nguyên ảnh gốc'}
                  style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', marginTop: 2, lineHeight: 1.3 }}>
                  <span style={{ color: 'var(--ok,#22c55e)' }}>✓</span> {m ? (m.kb ? tenKc(m) : `${m.w}×${m.h}`) : '…'}
                  {m?.goc && m.goc.kb !== m.kb && <div style={{ color: 'var(--fg-4)' }}>gốc {tenKc(m.goc)}</div>}
                </div>
                <button type="button" onClick={() => { void xoaAnh?.(u); onChange(value.filter((_, j) => j !== i)); }} title={nhanBo} style={{ position: 'absolute', top: -7, right: -7, width: 18, height: 18, borderRadius: 999, border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--fg-1)', cursor: 'pointer', fontSize: 11, lineHeight: '16px', padding: 0 }}>✕</button>
              </div>
            );
          })}
          {cho.map((c) => (
            <div key={c.id} style={{ position: 'relative', width: 96 }}>
              <img src={c.xem} alt="" style={{ width: 96, height: 64, objectFit: 'cover', borderRadius: 6, display: 'block', opacity: c.buoc === 'loi' ? 1 : 0.45,
                border: `1px solid ${c.buoc === 'loi' ? 'var(--bad,#ef4444)' : 'var(--cyan)'}` }} />
              <div style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', marginTop: 2, lineHeight: 1.3, color: c.buoc === 'loi' ? 'var(--bad,#ef4444)' : 'var(--cyan)' }}>
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

type TabGopY = 'gui' | 'cua-toi' | 'hoi-dap';
type Nhap = { loai: string; noiDung: string; anh: string[] };
const TRANG_MOI: Nhap = { loai: 'loi', noiDung: '', anh: [] };
const docNhap = (KHOA: string): Nhap => {
  const v = docJsonLT<Partial<Record<keyof Nhap, unknown>> | null>(KHOA, null);
  if (!v || typeof v !== 'object') return TRANG_MOI;
  return { loai: v.loai === 'cau_hoi' ? 'cau_hoi' : 'loi', noiDung: typeof v.noiDung === 'string' ? v.noiDung : '', anh: Array.isArray(v.anh) ? v.anh.filter((u: unknown): u is string => typeof u === 'string') : [] };
};

const TT: Record<string, { nhan: string; mau: string }> = {
  review: { nhan: 'Chờ duyệt', mau: 'var(--amber)' }, pending: { nhan: 'Chờ xử', mau: 'var(--fg-3)' },
  claimed: { nhan: 'Đang làm', mau: 'var(--cyan)' }, submitted: { nhan: 'Đang làm', mau: 'var(--cyan)' },
  broken: { nhan: 'Kẹt', mau: 'var(--red)' }, completed: { nhan: 'Xong', mau: 'var(--lime)' },
  verified: { nhan: 'Xong', mau: 'var(--lime)' }, dropped: { nhan: 'Bỏ qua', mau: 'var(--fg-4)' },
};
const nhomTT = (t: string) => (t === 'submitted' ? 'claimed' : t === 'verified' ? 'completed' : t);
const DA_DONG = new Set(['completed', 'dropped']);
const cach = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 60 ? `${m} phút trước` : m < 2880 ? `${Math.round(m / 60)} giờ trước` : `${Math.round(m / 1440)} ngày trước`;
};
const lbl: CSSProperties = { fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 };
const oNhap: CSSProperties = { width: '100%', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, padding: '7px 9px', fontSize: 12.5, color: 'var(--fg-1)', fontFamily: 'inherit' };

// Lỗi JavaScript gần nhất của trang (tối đa 5) — gom từ lúc mở trang để góp ý mang theo, khỏi phải mở console.
const loiJs: string[] = [];
function ghiLoiJs(s: string) { loiJs.push(`${gioVN(new Date(), { giay: true, chiGio: true })} ${s.slice(0, 200)}`); if (loiJs.length > 5) loiJs.shift(); }

/** Ngữ cảnh lúc gửi: màn · phim/tập/cảnh/timeline đang mở · lỗi đang hiện · lỗi JS · thiết bị. */
function docNguCanh(chonNgan: string, chonLoi: string): string {
  const chu = (e: Element | null | undefined) => (e?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
  const nc = [...document.querySelectorAll('[data-ngu-canh]')].filter((d) => !d.closest('[data-gop-y]')).map((d) => d.getAttribute('data-ngu-canh')).filter(Boolean);
  const drawer = [...document.querySelectorAll(chonNgan)].filter((d) => !d.querySelector('[data-gop-y]')).map((d) => chu(d.querySelector('h2, h3'))).filter(Boolean);
  const loiMan = [...document.querySelectorAll(chonLoi)].map((e) => chu(e)).filter(Boolean).slice(0, 5);
  const ua = navigator.userAgent;
  const may = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'khác';
  const tdt = /Edg\//.test(ua) ? 'Edge' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : '?';
  return [
    `màn: ${document.title}`,
    nc.length ? `đang xem: ${nc.join(' › ')}` : '',
    drawer.length ? `ngăn mở: ${drawer.join(' › ')}` : '',
    loiMan.length ? `lỗi trên màn: ${loiMan.join(' | ')}` : '',
    loiJs.length ? `lỗi JS: ${loiJs.join(' | ')}` : '',
    `${may} · ${tdt} · ${window.innerWidth}×${window.innerHeight}`,
  ].filter(Boolean).join(' · ');
}

function FormGopY({ onGui }: { onGui: (id: number, loai: string) => void }) {
  const c = useContext(Ctx)!; const KHOA = `${c.khoa}.gop-y.nhap`; const nc0 = () => docNguCanh(c.chonNgan, c.chonLoi);
  const [nhap, setNhap] = useState<Nhap>(TRANG_MOI);
  const [trang, setTrang] = useState('');
  const [nc, setNc] = useState('');
  const [busy, setBusy] = useState(false);
  const [ket, setKet] = useState('');
  useEffect(() => {
    setNhap(docNhap(KHOA));
    const doc = () => { setTrang(window.location.href); setNc(nc0()); };
    doc(); const t = setInterval(doc, 1000); return () => clearInterval(t);
  }, []);
  const ghi = (doi: (n: Nhap) => Nhap) => setNhap((cu) => { const n = doi(cu); ghiJsonLT(KHOA, n); return n; });
  const xoaNhap = () => { for (const u of nhap.anh) void c.hd.xoaAnhGopY?.(u); ghi(() => TRANG_MOI); ghiLT(KHOA, null); };
  const gui = async () => {
    setBusy(true); setKet('');
    let r: Awaited<ReturnType<HanhDongGopY['guiGopY']>>;
    try { r = await c.hd.guiGopY({ loai: nhap.loai, noiDung: nhap.noiDung, trang: window.location.href, anhUrls: nhap.anh, nguCanh: nc0() }); }
    catch (e) { setBusy(false); setKet(`⚠ Chưa gửi được (${e instanceof Error ? e.message.slice(0, 80) : 'lỗi mạng'}) — nếu trang vừa cập nhật, bấm ↻ Tải lại rồi gửi lại; nháp vẫn giữ.`); return; }
    setBusy(false);
    if (!r.ok || !r.id) { setKet(`⚠ ${r.error}`); return; }
    ghiLT(KHOA, null);
    setNhap(TRANG_MOI);
    setKet('');
    onGui(r.id, nhap.loai);   // khung tự đóng; nút nổi báo ✓ #id (#1225)
  };
  const trong = !nhap.noiDung.trim();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div style={lbl}>Loại</div>
        <select value={nhap.loai} onChange={(e) => { const v = e.target.value; ghi((n) => ({ ...n, loai: v })); }} style={{ ...oNhap, cursor: 'pointer' }}>
          <option value="loi">Báo lỗi / góp ý</option>
          <option value="cau_hoi">Câu hỏi</option>
        </select>
      </div>
      <div>
        <div style={lbl}>Mô tả</div>
        <textarea rows={5} autoFocus placeholder="Sai ở đâu, mong đợi thấy gì…" value={nhap.noiDung}
          onChange={(e) => { const v = e.target.value; ghi((n) => ({ ...n, noiDung: v })); }} style={{ ...oNhap, resize: 'vertical', outline: 'none' }} />
        <div style={{ fontSize: 10.5, color: 'var(--fg-4)', marginTop: 3 }}>Nháp và ảnh tự giữ — F5 không mất.</div>
      </div>
      <ImageAttach value={nhap.anh} onChange={(urls) => ghi((n) => ({ ...n, anh: urls }))} max={6} upload={c.hd.taiAnhGopY} xemAnh={c.xemAnh} xoaAnh={c.hd.xoaAnhGopY} />
      <details style={{ fontSize: 11, color: 'var(--fg-3)' }}>
        <summary style={{ cursor: 'pointer' }}>🔗 Trang + ngữ cảnh sẽ gửi kèm (tự gom)</summary>
        <div style={{ marginTop: 4, wordBreak: 'break-all' }}>{trang}</div>
        <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{nc.split(' · ').join('\n')}</div>
      </details>
      {ket && <div style={{ fontSize: 11.5, color: ket.startsWith('✓') ? 'var(--lime)' : 'var(--red)' }}>{ket}</div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className={c.nut.thuong} onClick={xoaNhap} disabled={trong && !nhap.anh.length}>Huỷ</button>
        <button type="button" className={c.nut.chinh} disabled={busy || trong} onClick={() => void gui()}>{busy ? '…' : '📨 Gửi'}</button>
      </div>
    </div>
  );
}

function Luong({ id, onXong }: { id: number; onXong: () => void }) {
  const c = useContext(Ctx)!;
  const [td, setTd] = useState<TinTraoDoi[] | null>(null);
  const [chu, setChu] = useState('');
  const [anh, setAnh] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [loi, setLoi] = useState('');
  const nap = () => { void c.hd.docTraoDoi(id).then(setTd); };
  useEffect(nap, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const gui = async (xuLy: string) => {
    setBusy(true); setLoi('');
    let r: Awaited<ReturnType<HanhDongGopY['guiTraoDoi']>>;
    try { r = await c.hd.guiTraoDoi({ taskId: id, noiDung: chu, anhUrls: anh, xuLy }); }
    catch { setBusy(false); setLoi('Chưa gửi được — nếu trang vừa cập nhật, bấm ↻ Tải lại rồi gửi lại.'); return; }
    setBusy(false);
    if (!r.ok) { setLoi(r.error ?? 'lỗi'); return; }
    setChu(''); setAnh([]); nap(); onXong();
  };
  if (!td) return <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>đang đọc…</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
      {td.map((t, i) => (
        <div key={i} style={{ borderLeft: `2px solid ${t.xuLy === 'duyet' ? 'var(--lime)' : t.xuLy === 'rework' ? 'var(--amber)' : 'var(--line)'}`, paddingLeft: 8 }}>
          <div style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
            <b style={{ color: 'var(--fg-2)' }}>{t.nguoi}</b> · {gioVN(t.luc)}{t.xuLy ? ` · ${t.xuLy === 'duyet' ? 'đã duyệt' : 'làm lại'}` : ''}
          </div>
          <div style={{ fontSize: 12.5, whiteSpace: 'pre-wrap', marginTop: 2 }}>{t.noiDung}</div>
          {t.nguCanh && <div style={{ fontSize: 10.5, color: 'var(--fg-4)', marginTop: 2 }}>{t.nguCanh}</div>}
          {!!t.anh?.length && <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>{t.anh.map((u) => <img key={u} src={u} alt="" onClick={() => (c.xemAnh ?? xemAnhTaiCho)(u)} style={{ width: 90, height: 60, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--line)', cursor: 'zoom-in' }} />)}</div>}
        </div>
      ))}
      <textarea rows={3} placeholder="Trả lời…" value={chu} onChange={(e) => setChu(e.target.value)} style={{ ...oNhap, resize: 'vertical' }} />
      <ImageAttach value={anh} onChange={setAnh} max={6} upload={c.hd.taiAnhGopY} xemAnh={c.xemAnh} xoaAnh={c.hd.xoaAnhGopY} />
      {loi && <div style={{ fontSize: 11.5, color: 'var(--red)' }}>⚠ {loi}</div>}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button type="button" className={c.nut.thuong} disabled={busy || !chu.trim()} onClick={() => void gui('')}>💬 Trả lời</button>
        <button type="button" className={c.nut.thuong} disabled={busy || !chu.trim()} onClick={() => void gui('rework')} title={chu.trim() ? 'Chưa đạt — card về Chờ xử' : 'Gõ chỗ chưa đạt vào ô trả lời rồi bấm'}>↩ Làm lại</button>
        <button type="button" className={c.nut.chinh} disabled={busy} onClick={() => void gui('duyet')} title="Đạt — đóng card (không cần gõ gì)">✓ Duyệt xong</button>
      </div>
    </div>
  );
}

const THU_TU = ['review', 'pending', 'claimed', 'broken', 'completed', 'dropped'];
function CuaToi({ ds, onNap, trong = 'Chưa có góp ý nào.' }: { ds: GopYCuaToi[] | null; onNap: () => void; trong?: string }) {
  const c = useContext(Ctx)!;
  const [mo, setMo] = useState<number | null>(null);
  // Bộ lọc như hòm mos2: chip trạng thái (bấm lại để bỏ lọc) + ô tìm theo nội dung / số card / trang. Nhớ chip theo trình duyệt.
  const [loc, datLoc] = useNho<string>(`${c.khoa}.gop-y.loc`, '');
  const [q, setQ] = useState('');
  if (ds === null) return <div style={{ fontSize: 12, color: 'var(--fg-3)', padding: 8 }}>đang đọc…</div>;
  if (!ds.length) return <div style={{ fontSize: 12.5, color: 'var(--fg-3)', padding: '18px 8px', textAlign: 'center' }}>{trong}</div>;
  const dem = new Map<string, number>();
  for (const b of ds) { const k = nhomTT(b.trangThai); dem.set(k, (dem.get(k) ?? 0) + 1); }
  const nd = q.trim().toLowerCase();
  const hien = ds.filter((b) => (!loc || nhomTT(b.trangThai) === loc) && (!nd || b.noiDung.toLowerCase().includes(nd) || String(b.id).includes(nd) || b.trang.toLowerCase().includes(nd)));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center', marginBottom: 2 }}>
        <button type="button" onClick={() => datLoc('')} style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 999, cursor: 'pointer', border: `1px solid ${!loc ? 'var(--cyan)' : 'var(--line)'}`, color: !loc ? 'var(--fg-1)' : 'var(--fg-3)', background: 'var(--bg-2)' }}>Tất cả <b>{ds.length}</b></button>
        {THU_TU.filter((k) => dem.get(k)).map((k) => (
          <button key={k} type="button" onClick={() => datLoc(loc === k ? '' : k)}
            style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 999, cursor: 'pointer', border: `1px solid ${loc === k ? TT[k]!.mau : 'var(--line)'}`, color: loc === k ? 'var(--fg-1)' : 'var(--fg-3)', background: 'var(--bg-2)' }}>
            {TT[k]!.nhan} <b>{dem.get(k)}</b>
          </button>
        ))}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="tìm…" style={{ ...oNhap, width: 130, padding: '3px 8px', fontSize: 11.5, marginLeft: 'auto' }} />
      </div>
      {!hien.length && <div style={{ fontSize: 12, color: 'var(--fg-3)', padding: 8 }}>Không mục nào khớp.</div>}
      {hien.map((b) => {
        const tt = TT[nhomTT(b.trangThai)] ?? TT.pending!;
        return (
          <div key={b.id} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', background: 'var(--bg-2)', opacity: DA_DONG.has(nhomTT(b.trangThai)) && mo !== b.id ? 0.7 : 1 }}>
            <div onClick={() => setMo(mo === b.id ? null : b.id)} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
                <span style={{ border: `1px solid ${tt.mau}`, color: tt.mau, borderRadius: 4, padding: '0 5px' }}>{tt.nhan}</span>
                <b style={{ color: 'var(--fg-2)' }}>#{b.id}</b><span>{b.loai === 'cau_hoi' ? 'hỏi' : 'lỗi'}</span>
                <span style={{ marginLeft: 'auto' }}>cập nhật {cach(b.capNhat)}{b.soTin ? ` · ${b.soTin} tin` : ''}</span>
              </div>
              <div style={{ fontSize: 12.5, marginTop: 4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: mo === b.id ? 99 : 2, WebkitBoxOrient: 'vertical' }}>{b.noiDung}</div>
              {b.tinCuoi && mo !== b.id && <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><b>{b.tinCuoi.nguoi}</b>: {b.tinCuoi.noiDung}</div>}
            </div>
            {mo === b.id && (
              <>
                <Luong id={b.id} onXong={onNap} />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function HomGopY(p: CauHinhHom) {
  const { ten, khoa, hd, Khung } = p;
  const cfg: Cfg = { khoa, hd, xemAnh: p.xemAnh, nut: p.nut ?? { thuong: 'gy-btn', chinh: 'gy-btn chinh' }, chonNgan: p.chonNgan ?? '[role=dialog]', chonLoi: p.chonLoi ?? '[data-loi]' };
  const [mo, setMo] = useState(false);
  const [tab, doiTab] = useNho<TabGopY>(`${khoa}.gop-y.tab`, 'gui', ['gui', 'cua-toi', 'hoi-dap']);
  const [vuaGui, setVuaGui] = useState<number | null>(null);
  useEffect(() => { if (vuaGui == null) return; const t = setTimeout(() => setVuaGui(null), 4000); return () => clearTimeout(t); }, [vuaGui]);
  const [ds, setDs] = useState<GopYCuaToi[] | null>(null);
  useEffect(() => {
    const e = (ev: ErrorEvent) => ghiLoiJs(ev.message || String(ev.error));
    const r = (ev: PromiseRejectionEvent) => ghiLoiJs(`promise: ${ev.reason instanceof Error ? ev.reason.message : String(ev.reason)}`);
    const m = () => setMo(true);
    window.addEventListener('error', e); window.addEventListener('unhandledrejection', r); window.addEventListener('gop-y:mo', m);
    return () => { window.removeEventListener('error', e); window.removeEventListener('unhandledrejection', r); window.removeEventListener('gop-y:mo', m); };
  }, []);
  const nap = () => { void hd.dsGopYCuaToi().then(setDs); };
  useEffect(() => {
    if (!mo) return;
    nap();
  }, [mo]);
  const conMo = ds?.filter((b) => !DA_DONG.has(nhomTT(b.trangThai))).length ?? 0;
  // Câu hỏi có tab riêng (#1227): mỗi câu vẫn là một card bình thường, mở ra thấy câu trả lời và trả lời tiếp được.
  const hoi = ds?.filter((b) => b.loai === 'cau_hoi') ?? null;
  const hoiCoTraLoi = hoi?.filter((b) => b.soTin > 0 && !DA_DONG.has(nhomTT(b.trangThai))).length ?? 0;
  const daGui = (id: number) => { setVuaGui(id); setMo(false); nap(); };
  return (
    <Ctx.Provider value={cfg}>
      {!mo && <button type="button" aria-label="Góp ý / báo lỗi" title={vuaGui ? `Đã gửi card #${vuaGui}` : 'Góp ý / báo lỗi về màn đang xem'} onClick={() => setMo((v) => !v)}
        style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 60, minWidth: 40, height: 40, padding: vuaGui ? '0 12px' : 0, borderRadius: 999, border: `1px solid ${vuaGui ? 'var(--lime)' : 'var(--line)'}`, background: 'var(--bg-2)', color: vuaGui ? 'var(--lime)' : 'var(--fg-2)', cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,0,0,.35)', fontSize: vuaGui ? 12 : 17, transition: 'all .2s' }}>{vuaGui ? `✓ đã gửi #${vuaGui}` : '💬'}</button>}
      {mo && (
        <Khung onClose={() => setMo(false)} tieuDe={`💬 Góp ý / báo lỗi · ${ten}`} dau={
          <div style={{ display: 'flex', gap: 4 }}>
            <button type="button" className={tab === 'gui' ? cfg.nut.chinh : cfg.nut.thuong} onClick={() => doiTab('gui')}>Gửi góp ý</button>
            <button type="button" className={tab === 'cua-toi' ? cfg.nut.chinh : cfg.nut.thuong} onClick={() => doiTab('cua-toi')}>Của tôi{conMo ? ` (${conMo})` : ''}</button>
            <button type="button" className={tab === 'hoi-dap' ? cfg.nut.chinh : cfg.nut.thuong} onClick={() => doiTab('hoi-dap')} title="Câu hỏi đã gửi + câu trả lời; trả lời tiếp ngay trong luồng">Hỏi đáp{hoi?.length ? ` (${hoiCoTraLoi ? `${hoiCoTraLoi} có trả lời · ` : ''}${hoi.length})` : ''}</button>
          </div>
        }>
          <div data-gop-y="">
            {tab === 'gui' ? <FormGopY onGui={daGui} /> : tab === 'hoi-dap' ? <CuaToi ds={hoi} onNap={nap} trong="Chưa có câu hỏi nào — chọn Loại: Câu hỏi khi gửi." /> : <CuaToi ds={ds} onNap={nap} />}
          </div>
        </Khung>
      )}
    </Ctx.Provider>
  );
}
