'use client';
// HÒM GÓP Ý CHUẨN cho TRANG TĨNH (castle.on.tc …): trang tĩnh không chạy được React / server action, nên nó mở trang này trong một iframe
// trong suốt phủ màn (nạp bằng <script src="https://mos2.on.tc/api/gop-y-ngoai/nut">). Hòm chính là GopYMos2 mà layout gốc đã gắn —
// trang này chỉ nối: ?trang= → window.__trangGopY (card mang đúng trang người dùng đang đứng), ngữ cảnh + ảnh khung hình trang ngoài
// gửi qua postMessage → window.__nguCanhTrang / hàng ảnh __anhGopY, mở hòm ('gop-y:mo'), hòm đóng ('gop-y:dong') → báo trang ngoài gỡ iframe.
import { useEffect } from 'react';

export default function NhungGopY() {
  useEffect(() => {
    const w = window as unknown as { __trangGopY?: () => string; __nguCanhTrang?: () => string; __anhGopY?: string[] };
    const trang = new URLSearchParams(location.search).get('trang') || '';
    if (/^https?:\/\//.test(trang)) w.__trangGopY = () => trang;
    let goc = '*'; try { goc = new URL(trang).origin; } catch { /* không có trang → không trả lời ai */ }
    const nhan = (e: MessageEvent) => {
      if (goc === '*' || e.origin !== goc || e.source !== window.parent) return;
      const d = (e.data || {}) as { loai?: string; nguCanh?: string; anh?: string | null; anhThem?: string[] };
      if (d.loai !== 'gop-y:mo') return;
      const nc = String(d.nguCanh || '').slice(0, 1000); w.__nguCanhTrang = () => nc;
      if (typeof d.anh === 'string' && d.anh.startsWith('data:image/')) (w.__anhGopY ||= []).push(d.anh);
      for (const u of Array.isArray(d.anhThem) ? d.anhThem.slice(0, 5) : []) if (typeof u === 'string' && u.startsWith('data:image/')) (w.__anhGopY ||= []).push(u); // ảnh thật trang ngoài đã chọn (castle 📷) — vào ô ảnh đính kèm như ảnh chụp trang
      window.dispatchEvent(new CustomEvent('gop-y:mo'));
    };
    const dong = (e: Event) => { if (goc !== '*') window.parent.postMessage({ loai: 'gop-y:dong', vuaGui: (e as CustomEvent<{ vuaGui?: number }>).detail?.vuaGui ?? null }, goc); };
    window.addEventListener('message', nhan); window.addEventListener('gop-y:dong', dong);
    if (goc !== '*') window.parent.postMessage({ loai: 'gop-y:san-sang' }, goc);
    return () => { window.removeEventListener('message', nhan); window.removeEventListener('gop-y:dong', dong); };
  }, []);
  // nền trong suốt để thấy trang ngoài phía sau ngăn hòm
  return <style>{'html,body{background:transparent!important}'}</style>;
}
