'use client';
// LUỒNG TRAO ĐỔI của card góp ý — một component dùng chung: drawer card trên plays (backlinks-page) và hòm góp ý 💬 (gop-y-mos2, mos2 + city.on.tc).
// Tách ra 25/10/2026: anh xem lại góp ý trong hòm city thì bị mở sang tab plays mới — giờ đọc / Rework / Duyệt xong ngay trong ngăn.
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { docTraoDoiCard, guiTraoDoiCard } from '@/lib/actions/gop-y-mos2';
import { uploadImage, deleteImage } from '@/lib/actions/uploads';
import { StatusSegmented } from '@/components/ui';

const btn: CSSProperties = { fontSize: 11, padding: '3px 9px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--fg-1)', cursor: 'pointer', whiteSpace: 'nowrap' };

/* Luồng trao đổi của card GÓP Ý — đọc + reply NGAY TRONG DRAWER (dữ liệu sống bên adfond,
 * đi qua proxy /api/adfond/trao-doi để phiên MOS2 gác cửa và khoá nằm server-side).
 * Reply mặc định REWORK: bản ghi adfond về đang-làm, card này về To-do — onChange refresh
 * để pill trạng thái nói thật ngay. */
/* MỘT đường hiện duy nhất: LUỒNG TRAO ĐỔI. Trước đây có thêm `phao` — bản dự phòng dựng từ
 * `draft`/`instructions`, chỉ render khi luồng RỖNG. Luồng không bao giờ rỗng (tin gốc luôn là
 * phần tử đầu), nên đường ấy chết, và thứ CHỈ có ở đó — link trang bị lỗi — biến mất khỏi mọi
 * card suốt từ 26/08 tới 29/08/2026 mà không ai thấy: nhìn drawer vẫn đủ chữ và ảnh.
 *
 * Bài học nằm ở HÌNH DẠNG chứ không ở dòng code: một nội dung mà có hai đường hiện, trong đó
 * một đường gần như không chạy, thì đường ấy ruỗng dần và không có gì báo. Nên đường thứ hai
 * bị bỏ hẳn — thiếu dữ liệu thì phải thiếu Ở CHỖ NHÌN THẤY. `scripts/check-gop-y-surface.mjs`
 * canh phần còn lại: mọi trường trong TinTraoDoi phải có chỗ render. */
export function TraoDoiCard({ feedbackId, taskId, onChange }: { feedbackId?: number; taskId: number; onChange: () => void }) {
  // Hai nguồn một UI: card adfond (feedbackId — luồng sống bên adfond, đi proxy) và card
  // góp ý MOS2 bản địa (prep_payload.trao_doi, server action). Khác nhau CHỈ ở chỗ
  // đọc/ghi/tải ảnh — bong bóng + composer dùng chung, sửa một chỗ ăn cả hai.
  // `trang` = trang ĐANG BỊ LỖI, chỉ tin gốc có (adfond `feedback.trang`, hoặc `goc.trang` của
  // card góp ý MOS2 bản địa). Xem chú thích chỗ render bên dưới.
  type Tin = { id?: number; nguoi: string; noiDung: string; xuLy: string | null; luc: string; trang?: string; nguCanh?: string; anh: Array<{ id?: number; ten?: string | null; url: string }> };
  const [tin, setTin] = useState<Tin[] | null>(null);
  const [loiNap, setLoiNap] = useState('');
  const [noiDung, setNoiDung] = useState('');
  const [anh, setAnh] = useState<Array<{ id?: number; url?: string; ten: string; xem: string }>>([]);
  const [xuLy, setXuLy] = useState('rework');
  const [tai, setTai] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const nap = useCallback(() => {
    /* NẠP HỎNG ≠ LUỒNG RỖNG. Trước đây cả hai nhánh `.catch(() => setTin([]))`, nên adfond sập
       là drawer nói "chưa có phản hồi" — sai theo hướng tệ nhất: người đọc tin là chưa ai xử. */
    setLoiNap('');
    if (feedbackId != null) {
      fetch(`/api/adfond/trao-doi?feedback=${feedbackId}`)
        .then((r) => r.json()).then((d) => setTin(Array.isArray(d.tin) ? d.tin : []))
        .catch(() => { setTin([]); setLoiNap('Không đọc được luồng trao đổi từ adfond — thử tải lại; nội dung góp ý nằm bên bản ghi gốc (nút ↗ ở trên).'); });
    } else {
      docTraoDoiCard(taskId)
        .then((ds) => setTin(ds.map((t) => ({ ...t, anh: (t.anh || []).map((u) => ({ url: u })) }))))
        .catch(() => { setTin([]); setLoiNap('Không đọc được luồng trao đổi của card này.'); });
    }
  }, [feedbackId, taskId]);
  useEffect(() => { nap(); }, [nap]);

  // Nén như form adfond: giữ điểm ảnh, re-encode JPEG 0.72 khi ≥400KB — PNG retina qua trần 1MB.
  const nenAnh = async (f: File): Promise<File> => {
    if (f.size < 400_000 || !f.type.startsWith('image/') || f.type === 'image/gif') return f;
    try {
      const bmp = await createImageBitmap(f);
      const c = document.createElement('canvas');
      c.width = bmp.width; c.height = bmp.height;
      c.getContext('2d')?.drawImage(bmp, 0, 0);
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.72));
      if (blob && blob.size < f.size) return new File([blob], f.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
    } catch { /* không nén được — gửi bản gốc, adfond còn trần */ }
    return f;
  };

  const themAnh = async (files: File[]) => {
    setErr('');
    for (const goc of files.filter((f) => f.type.startsWith('image/'))) {
      setTai((d) => d + 1);
      try {
        const f = await nenAnh(goc);
        if (feedbackId != null) {
          const fd = new FormData(); fd.set('file', f);
          const r = await fetch('/api/adfond/trao-doi/anh', { method: 'POST', body: fd });
          const d = await r.json().catch(() => null);
          if (!r.ok || !d?.id) { setErr(String(d?.error || `adfond trả ${r.status}`)); continue; }
          setAnh((c) => [...c, { id: Number(d.id), ten: f.name, xem: URL.createObjectURL(goc) }]);
        } else {
          // card MOS2 bản địa: ảnh đi đường R2 sẵn có. Server action bị Next chặn body 1MB —
          // nenAnh giữ nguyên GIF/ảnh không co được, nên PHẢI kiểm trần + catch, không thì
          // action ném và lỗi biến mất trong im lặng (caller gọi void themAnh).
          const du = await new Promise<string>((res, rej) => { const rd = new FileReader(); rd.onload = () => res(rd.result as string); rd.onerror = rej; rd.readAsDataURL(f); });
          if (du.length > 950_000) { setErr(`"${f.name}" còn ${(du.length / 1e6).toFixed(1)}MB sau nén — quá trần gửi. Cắt nhỏ vùng chụp.`); continue; }
          const r = await uploadImage(du, 'gop-y');
          if (!r.ok || !r.url) { setErr(r.error || 'upload lỗi'); continue; }
          setAnh((c) => [...c, { url: r.url!, ten: f.name, xem: URL.createObjectURL(goc) }]);
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'upload lỗi');
      } finally { setTai((d) => d - 1); }
    }
  };

  const gui = async () => {
    setBusy(true); setErr('');
    let ok = false; let loi = '';
    if (feedbackId != null) {
      const r = await fetch('/api/adfond/trao-doi', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedbackId, noiDung, anhIds: anh.map((a) => a.id), xuLy }),
      });
      const d = await r.json().catch(() => null);
      ok = !!(r.ok && d?.ok); loi = String(d?.error || `adfond trả ${r.status}`);
    } else {
      const d = await guiTraoDoiCard({ taskId, noiDung: noiDung.trim() || (xuLy === 'duyet' ? 'Duyệt' : ''), anhUrls: anh.map((a) => a.url!).filter(Boolean), xuLy });
      ok = d.ok; loi = d.error || 'không gửi được';
    }
    setBusy(false);
    if (!ok) { setErr(loi); return; }
    anh.forEach((a) => URL.revokeObjectURL(a.xem));
    setNoiDung(''); setAnh([]); nap();
    if (xuLy !== 'ghi_chu') onChange();   // card vừa đổi trạng thái — pill phải đổi ngay
  };

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
        💬 Trao đổi{tin?.length ? ` · ${tin.length}` : ''}
      </div>
      {tin === null ? <div style={{ fontSize: 11.5, color: 'var(--fg-4)' }}>đang tải…</div>
        : loiNap ? <div style={{ fontSize: 11.5, color: 'var(--bad,#ef4444)', lineHeight: 1.5 }}>{loiNap}</div>
        : tin.length === 0 ? <div style={{ fontSize: 11.5, color: 'var(--fg-4)' }}>Chưa có phản hồi — AI ghi vào đây khi xử xong.</div>
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tin.map((t) => (
              <div key={t.id ?? t.luc} style={{ border: `1px solid ${t.nguoi === 'ai' ? 'color-mix(in srgb, var(--accent) 45%, transparent)' : 'var(--line)'}`, background: t.nguoi === 'ai' ? 'color-mix(in srgb, var(--accent) 7%, transparent)' : 'var(--bg-2)', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 10.5, color: 'var(--fg-3)', marginBottom: 4 }}>
                  <b style={{ color: t.nguoi === 'ai' ? 'var(--accent)' : 'var(--fg-2)', textTransform: t.nguoi === 'ai' ? 'uppercase' : 'none' }}>{t.nguoi === 'ai' ? 'AI' : t.nguoi}</b>
                  {t.xuLy === 'rework' && <span style={{ border: '1px solid var(--warn,#ffb03c)', color: 'var(--warn,#ffb03c)', borderRadius: 4, padding: '0 5px', fontSize: 10 }}>rework</span>}
                  <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{t.luc.slice(0, 16).replace('T', ' ')}</span>
                </div>
                <div style={{ fontSize: 12.5, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{t.noiDung}</div>
                {/* TRANG BỊ LỖI — câu trả lời cho "sửa ở đâu", tức thứ cần trước cả lời báo.
                    Trước 29/08/2026 drawer không có đường nào tới nó: link chỉ nằm trong
                    `draft`, mà draft chỉ hiện khi luồng RỖNG (`phao` bên dưới) — luồng thì
                    không bao giờ rỗng vì tin gốc luôn là phần tử đầu. Nhánh ấy chết từ lúc
                    viết, người mở card chỉ thấy lời than + ảnh rồi phải tự đoán trang nào. */}
                {t.trang && (
                  <a href={t.trang} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'inline-block', marginTop: 6, fontSize: 11, color: 'var(--accent)', textDecoration: 'underline dotted', wordBreak: 'break-all' }}>
                    ↗ Trang bị lỗi: {t.trang.replace(/^https?:\/\//, '')}
                  </a>
                )}
                {t.nguCanh && <div style={{ marginTop: 4, fontSize: 11, color: 'var(--fg-3)', wordBreak: 'break-word' }}>🧭 {t.nguCanh}</div>}
                {t.anh.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                    {t.anh.map((a) => (
                      <a key={a.id ?? a.url} href={a.url} target="_blank" rel="noopener noreferrer">
                        <img src={a.url} alt={a.ten ?? ''} style={{ height: 64, borderRadius: 5, border: '1px solid var(--line)', display: 'block' }} />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

      <div style={{ marginTop: 8, border: '1px solid var(--line)', borderRadius: 8, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <textarea
          rows={2} placeholder="Reply… (Ctrl+V dán ảnh)" value={noiDung}
          onChange={(e) => setNoiDung(e.target.value)}
          onPaste={(e) => {
            const fs = [...(e.clipboardData?.items ?? [])].filter((i) => i.kind === 'file' && i.type.startsWith('image/')).map((i) => i.getAsFile()).filter((f): f is File => !!f);
            if (fs.length) { e.preventDefault(); void themAnh(fs); }
          }}
          style={{ width: '100%', resize: 'vertical', background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 6, padding: '6px 8px', fontSize: 12.5, color: 'var(--fg-1)', fontFamily: 'inherit' }}
        />
        {anh.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {anh.map((a) => (
              <span key={a.id ?? a.url} style={{ position: 'relative' }}>
                <img src={a.xem} alt={a.ten} style={{ height: 48, borderRadius: 5, border: '2px solid var(--ok,#22c55e)', display: 'block' }} />
                <button type="button" aria-label={`Bỏ ảnh ${a.ten}`}
                  onClick={() => {
                    URL.revokeObjectURL(a.xem);
                    if (a.url) void deleteImage(a.url);
                    setAnh((c) => c.filter((x) => x !== a));
                  }}
                  style={{ position: 'absolute', top: -6, right: -6, width: 16, height: 16, lineHeight: '13px', borderRadius: 999, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--fg-3)', cursor: 'pointer', fontSize: 10, padding: 0 }}>✕</button>
              </span>
            ))}
          </div>
        )}
        {err && <div style={{ fontSize: 11.5, color: 'var(--bad,#ef4444)' }}>{err}</div>}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button type="button" onClick={() => fileRef.current?.click()} title="Đính ảnh" style={{ ...btn, padding: '2px 8px' }}>📎</button>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { void themAnh([...(e.target.files ?? [])]); e.target.value = ''; }} />
          {tai > 0 && <span style={{ fontSize: 11, color: 'var(--fg-4)' }}>đang tải ảnh…</span>}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
            <StatusSegmented size="sm" value={xuLy}
              options={[{ value: 'rework', label: 'Rework', color: 'var(--warn,#ffb03c)' }, { value: 'duyet', label: 'Duyệt xong', color: 'var(--ok,#22c55e)' }, { value: 'ghi_chu', label: 'Ghi chú', color: 'var(--fg-2)' }]}
              onChange={setXuLy} />
            <button type="button" disabled={busy || tai > 0 || (!noiDung.trim() && xuLy !== 'duyet')} onClick={() => void gui()}
              style={{ ...btn, padding: '3px 12px', opacity: busy || tai > 0 || (!noiDung.trim() && xuLy !== 'duyet') ? .5 : 1, cursor: busy ? 'default' : 'pointer', fontWeight: 700 }}>
              {busy ? '…' : '📨 Gửi'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
