'use client';

// Sau mỗi deploy, tab đang mở giữ mã cũ: mọi server action (gửi góp ý, sinh ảnh, tự làm mới) trả 404 và nút đứng "…" mãi
// (góp ý #1194, 08/10/2026). Ở đây: hỏi mã bản mỗi 20 giây + bắt lỗi "Failed to find Server Action"; thấy bản mới thì
// tự tải lại nếu anh không đang gõ dở, còn đang gõ thì hiện thanh báo để anh bấm (nháp góp ý tự giữ qua F5).
import { useEffect, useState } from 'react';

const dangGo = () => {
  const a = document.activeElement as HTMLElement | null;
  return !!a && (a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && !['checkbox', 'radio', 'range', 'button'].includes((a as HTMLInputElement).type)) || a.isContentEditable);
};

export function TheoDoiBan({ banDau }: { banDau: string }) {
  const [moi, setMoi] = useState(false);
  useEffect(() => {
    let xong = false;
    const coBanMoi = () => {
      if (xong) return;
      if (!dangGo()) { xong = true; window.location.reload(); return; }
      setMoi(true);
    };
    const hoi = async () => {
      try {
        const r = await fetch('/api/xv/ban', { cache: 'no-store' });
        const j = (await r.json()) as { ban?: string };
        if (j.ban && j.ban !== banDau) coBanMoi();
      } catch { /* mạng chập — lần sau hỏi lại */ }
    };
    const t = setInterval(() => { if (document.visibilityState === 'visible') void hoi(); }, 20_000);
    const khiHien = () => { if (document.visibilityState === 'visible') void hoi(); };
    const loiAction = (ev: PromiseRejectionEvent) => {
      const m = ev.reason instanceof Error ? ev.reason.message : String(ev.reason ?? '');
      if (/Server Action|older or newer deployment|deployment/i.test(m)) { ev.preventDefault(); void hoi(); setMoi(true); }
    };
    document.addEventListener('visibilitychange', khiHien);
    window.addEventListener('unhandledrejection', loiAction);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', khiHien); window.removeEventListener('unhandledrejection', loiAction); };
  }, [banDau]);
  if (!moi) return null;
  return (
    <div style={{ position: 'fixed', left: '50%', top: 10, transform: 'translateX(-50%)', zIndex: 1000, background: 'var(--amber)', color: '#111', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, boxShadow: '0 6px 20px rgba(0,0,0,.4)', display: 'flex', gap: 10, alignItems: 'center' }}>
      Studio vừa cập nhật bản mới — tải lại để các nút chạy tiếp (nháp góp ý vẫn giữ).
      <button type="button" onClick={() => window.location.reload()} style={{ background: '#111', color: '#fff', border: 0, borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontWeight: 700 }}>↻ Tải lại</button>
    </div>
  );
}
