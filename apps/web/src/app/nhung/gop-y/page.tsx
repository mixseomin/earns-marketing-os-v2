'use client';
// HÒM GÓP Ý CHUẨN cho TRANG TĨNH (castle.on.tc …): trang tĩnh không chạy được React / server action, nên nó mở trang này trong một iframe
// trong suốt phủ màn (nạp bằng <script src="https://mos2.on.tc/api/gop-y-ngoai/nut">). Hòm chính là GopYMos2 mà layout gốc đã gắn —
// trang này chỉ nối: ?trang= → window.__trangGopY (card mang đúng trang người dùng đang đứng), ngữ cảnh + ảnh khung hình trang ngoài
// gửi qua postMessage → window.__nguCanhTrang / hàng ảnh __anhGopY, mở hòm ('gop-y:mo'), hòm đóng ('gop-y:dong') → báo trang ngoài ẨN iframe (nút chuẩn nạp sẵn và giữ iframe để lần mở sau tức thì).
import { useEffect, useState } from 'react';
import { tieuDeNut, type DemGopY } from '@mos2/gop-y/nut';

export default function NhungGopY() {
  // BÁO CHỜ (anh 17/11/2026: "nếu phải đợi thì phải thông báo chờ"): ảnh trang ngoài đưa vào (chụp trang + ảnh thật chọn ở castle 📷) phải tải lên R2
  // mới hiện trong ô đính kèm (~10–20 s) → dải báo trên cùng tới khi đủ ảnh; quá 60 s thì báo lỗi thay vì để im.
  const [cho, setCho] = useState<{ can: number; luc: number } | null>(null);
  const [baoCho, setBaoCho] = useState<string>('');
  useEffect(() => {
    if (!cho) return;
    let goc: number | null = null;
    const dem = () => document.querySelectorAll('[data-comp="ui.ImageAttach"] img').length;
    const t = setInterval(() => {
      if (!document.querySelector('[data-comp="ui.ImageAttach"]')) return;
      if (goc === null) goc = dem(); // ảnh nháp cũ khôi phục lúc hòm mở — không tính
      const co = dem() - goc, giay = Math.round((Date.now() - cho.luc) / 1000);
      if (co >= cho.can) { setBaoCho(''); setCho(null); return; }
      setBaoCho(giay > 60 ? `⚠ Mới lên ${co}/${cho.can} ảnh sau ${giay} s — ảnh còn lại không tải lên được; đóng hòm mở lại, hoặc gửi luôn với ảnh đang có`
        : `⏳ Đang đưa ${cho.can} ảnh (ảnh chụp trang + ảnh thật đã chọn) vào ô đính kèm… ${co}/${cho.can} · ${giay} s — chờ đủ rồi hãy Gửi`);
    }, 300);
    return () => clearInterval(t);
  }, [cho]);
  useEffect(() => {
    const w = window as unknown as { __trangGopY?: () => string; __nguCanhTrang?: () => string; __anhGopY?: string[] };
    const trang = new URLSearchParams(location.search).get('trang') || '';
    if (/^https?:\/\//.test(trang)) w.__trangGopY = () => trang;
    let goc = '*'; try { goc = new URL(trang).origin; } catch { /* không có trang → không trả lời ai */ }
    const nhan = (e: MessageEvent) => {
      if (goc === '*' || e.origin !== goc || e.source !== window.parent) return;
      const d = (e.data || {}) as { loai?: string; trang?: string; nguCanh?: string; anh?: string | null; anhThem?: string[] };
      if (d.loai !== 'gop-y:mo') return;
      // iframe được nút chuẩn NẠP SẴN từ lúc trang mở → trang một-trang (studio2…) đã đổi URL; card phải mang URL lúc bấm, không phải lúc nạp
      if (typeof d.trang === 'string') { try { if (new URL(d.trang).origin === goc) { const t = d.trang.slice(0, 2000); w.__trangGopY = () => t; } } catch { /* URL hỏng → giữ ?trang= */ } }
      const nc = String(d.nguCanh || '').slice(0, 1000); w.__nguCanhTrang = () => nc;
      if (typeof d.anh === 'string' && d.anh.startsWith('data:image/')) (w.__anhGopY ||= []).push(d.anh);
      for (const u of Array.isArray(d.anhThem) ? d.anhThem.slice(0, 5) : []) if (typeof u === 'string' && u.startsWith('data:image/')) (w.__anhGopY ||= []).push(u); // ảnh thật trang ngoài đã chọn (castle 📷) — vào ô ảnh đính kèm như ảnh chụp trang
      const can = (typeof d.anh === 'string' && d.anh.startsWith('data:image/') ? 1 : 0) + (Array.isArray(d.anhThem) ? d.anhThem.slice(0, 5).filter((u) => typeof u === 'string' && u.startsWith('data:image/')).length : 0);
      if (can) setCho({ can, luc: Date.now() });
      window.dispatchEvent(new CustomEvent('gop-y:mo'));
    };
    const dong = (e: Event) => { if (goc !== '*') window.parent.postMessage({ loai: 'gop-y:dong', vuaGui: (e as CustomEvent<{ vuaGui?: number }>).detail?.vuaGui ?? null }, goc); };
    // số nút 💬 (đang làm / kẹt / chờ ý kiến) → trang ngoài tô nút của nó đúng chuẩn (packages/gop-y/src/nut.ts)
    const dem = (e: Event) => { const x = (e as CustomEvent<DemGopY>).detail; if (goc !== '*' && x) window.parent.postMessage({ loai: 'gop-y:dem', working: x.working, ket: x.ket ?? 0, can_y_kien: x.can_y_kien, tieuDe: tieuDeNut(null, x) }, goc); };
    window.addEventListener('message', nhan); window.addEventListener('gop-y:dong', dong); window.addEventListener('gop-y:dem', dem);
    if (goc !== '*') window.parent.postMessage({ loai: 'gop-y:san-sang' }, goc);
    return () => { window.removeEventListener('message', nhan); window.removeEventListener('gop-y:dong', dong); window.removeEventListener('gop-y:dem', dem); };
  }, []);
  // nền trong suốt để thấy trang ngoài phía sau ngăn hòm
  return (
    <>
      <style>{'html,body{background:transparent!important}'}</style>
      {baoCho && (
        <div role="status" style={{ position: 'fixed', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 2147483001, maxWidth: 'min(560px, calc(100vw - 24px))', padding: '8px 14px', borderRadius: 8,
          background: baoCho.startsWith('⚠') ? 'var(--red, #b42318)' : 'var(--amber, #b54708)', color: '#fff', font: '600 13px system-ui, sans-serif', boxShadow: '0 4px 16px rgba(0,0,0,.35)' }}>{baoCho}</div>
      )}
    </>
  );
}
