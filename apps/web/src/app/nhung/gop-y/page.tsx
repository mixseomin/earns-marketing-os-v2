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
    // 📷 Chụp trang trong hòm (ImageAttach) → ảnh về đúng ô đính kèm vừa bấm. Hai đường:
    // - trang ngoài tự vẽ được khung hình (__chupKhungTrang, báo qua coKhung lúc mở) → nhờ nó: ẩn hòm, vẽ khung, trả 'gop-y:anh-chup';
    // - còn lại → XIN QUYỀN CHỤP NGAY TRONG IFRAME NÀY, đúng lúc bấm 📷 (iframe có allow display-capture). Xin ở trang cha sau tin postMessage
    //   thì Chrome từ chối «Invalid state» vì cú bấm nằm ở iframe, không phải ở trang cha (worlds 25/11/2026). Có luồng hình rồi mới ẩn
    //   ngăn hòm (iframe trong suốt → khung hình là trang thật phía sau), lấy một khung, hiện lại ngăn.
    let choChup: { xong: (a: string) => void; loi: (e: Error) => void; hen: ReturnType<typeof setTimeout> } | null = null;
    let coKhung = false;
    const nhoKhung = (v: HTMLVideoElement) => {
      const k = Math.min(1, 1600 / Math.max(v.videoWidth, v.videoHeight)), c = document.createElement('canvas');
      c.width = Math.round(v.videoWidth * k); c.height = Math.round(v.videoHeight * k);
      c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.85);
    };
    const anHom = (an: boolean) => {
      let s = document.getElementById('gy-dang-chup');
      if (an && !s) { s = document.createElement('style'); s.id = 'gy-dang-chup'; s.textContent = 'body{opacity:0!important}'; document.head.appendChild(s); }
      if (!an && s) s.remove();
    };
    const chupTab = async (): Promise<string> => {
      const md = navigator.mediaDevices as MediaDevices & { getDisplayMedia?: (c: unknown) => Promise<MediaStream> };
      if (!md?.getDisplayMedia) throw new Error('trình duyệt không hỗ trợ chụp màn hình');
      // gọi ngay trong cú bấm (không await gì trước nó) — còn hiệu lực cú bấm
      const st = await md.getDisplayMedia({ video: { displaySurface: 'browser' }, audio: false, preferCurrentTab: true, selfBrowserSurface: 'include' });
      try {
        const v = document.createElement('video'); v.muted = true; v.srcObject = st; await v.play();
        anHom(true);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        await new Promise((r) => setTimeout(r, 500));   // khung hình mới nhất phải là trang không có ngăn hòm
        return nhoKhung(v);
      } finally { st.getTracks().forEach((t) => t.stop()); anHom(false); }
    };
    const nhoCha = () => new Promise<string>((xong, loi) => {
      if (choChup) { loi(new Error('đang chụp dở')); return; }
      choChup = { xong, loi, hen: setTimeout(() => { choChup = null; loi(new Error('trang không trả ảnh')); }, 90_000) };
      window.parent.postMessage({ loai: 'gop-y:chup' }, goc);
    });
    if (goc !== '*') (w as { __chupNgoaiGopY?: () => Promise<string> }).__chupNgoaiGopY = () => {
      if (!coKhung) return chupTab();
      return nhoCha().catch((e) => { console.warn('[gop-y] khung trang lỗi, xin chụp tab', e); return chupTab(); });
    };
    const nhan = (e: MessageEvent) => {
      if (goc === '*' || e.origin !== goc || e.source !== window.parent) return;
      const d = (e.data || {}) as { loai?: string; trang?: string; nguCanh?: string; anh?: string | null; anhThem?: string[]; loi?: string; coKhung?: boolean };
      if (d.loai === 'gop-y:anh-chup') {
        const c = choChup; if (!c) return;
        choChup = null; clearTimeout(c.hen);
        if (typeof d.anh === 'string' && d.anh.startsWith('data:image/')) c.xong(d.anh); else c.loi(new Error(String(d.loi || 'đã huỷ').slice(0, 160)));
        return;
      }
      if (d.loai !== 'gop-y:mo') return;
      coKhung = d.coKhung === true;
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
