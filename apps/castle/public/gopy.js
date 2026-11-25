// GÓP Ý castle = HÒM CHUẨN MOS2 (anh 17/11/2026: "gửi tasks, ảnh phản biện… phải có chỗ xem, follow, update như góp ý chuẩn ở mos2, không phải gửi lên
// xong không biết đang ở đâu"). Trước đây castle chạy một hộp tự viết chỉ gửi được; nay nút 💬 mở hòm dùng chung của mos2 (/nhung/gop-y trong khung phủ màn,
// nạp bằng script https://mos2.on.tc/api/gop-y-ngoai/nut): GỬI · CỦA TÔI (trạng thái từng thẻ, luồng trả lời, làm lại, duyệt xong) · HỎI ĐÁP.
// Thẻ 🔍 báo lệch (baolech.js), thẻ máy quét và thẻ Claude tạo theo lệnh anh cũng hiện trong "Của tôi".
// ganGopY({ nut, chupAnh: () => dataURL|null, nguCanh: () => string, anhNgoai: () => [dataURL] }) → { mo(kemAnh), dangMo }
const NUT_HOM = 'https://mos2.on.tc/api/gop-y-ngoai/nut';

// KHÔNG TỰ ĐÍNH ẢNH (anh 17/11/2026: "hover vào nút thì thêm option gửi ảnh hiện tại chứ không tự động gửi"): rê chuột / bấm nút 💬 → menu nhỏ trên nút:
// "💬 Góp ý (không kèm ảnh)" · "📸 Góp ý kèm ảnh màn hình hiện tại". Ảnh chụp chỉ đi khi chọn dòng thứ hai; ảnh thật đã chọn ở 📷 vẫn đi kèm (anh tự chọn).
const CSS = `
#gy-menu { position: fixed; display: none; flex-direction: column; gap: 4px; padding: 6px; z-index: 13; background: var(--o, rgba(14,20,30,.92)); border: 1px solid var(--vien, rgba(255,255,255,.18)); border-radius: 10px; box-shadow: 0 6px 20px rgba(0,0,0,.35); }
#gy-menu button { font: 600 13px system-ui, sans-serif; color: var(--chu, #eee); background: rgba(255,255,255,.06); border: 1px solid transparent; border-radius: 7px; padding: 8px 12px; text-align: left; cursor: pointer; white-space: nowrap; }
#gy-menu button:hover { background: rgba(255,255,255,.16); border-color: var(--vien, rgba(255,255,255,.18)); }`;
export function ganGopY({ nut, chupAnh = () => null, nguCanh = () => '', anhNgoai = () => [] }) {
  let kemAnh = false;
  window.__nguCanhTrang = () => nguCanh();   // hòm đọc lúc mở: vị trí thật / chế độ / mã ảnh thật đã chọn (📷)
  window.__chupTrang = () => (kemAnh ? chupAnh() : null); // ảnh khung hình CHỈ khi chọn "kèm ảnh màn hình"
  window.__anhNgoaiTrang = () => anhNgoai();  // ảnh thật đã chọn ở 📷 → hiện thành ảnh đính kèm trong hòm (thấy / bỏ được trước khi gửi)
  nut.removeAttribute('data-gop-y-mo');       // không để script hòm tự mở khi bấm nút — mở qua menu
  nut.setAttribute('data-gop-y-nut', '');     // vẫn là nút hòm: script hòm tô sáng nhấp nhô (AI đang làm) + chấm đỏ (việc kẹt) — chuẩn packages/gop-y/src/nut.ts
  nut.title = 'Góp ý / báo lỗi — chọn có kèm ảnh màn hình hay không; tab thứ hai của hòm xem trạng thái + trả lời mọi thẻ đã gửi';
  if (!document.querySelector(`script[src="${NUT_HOM}"]`)) { const s = document.createElement('script'); s.src = NUT_HOM; s.defer = true; s.onerror = () => console.error('[castle] không nạp được hòm góp ý mos2', NUT_HOM); document.head.append(s); }
  const st = document.createElement('style'); st.textContent = CSS; document.head.append(st);
  const dai = document.createElement('div'); dai.setAttribute('data-gy-dang-lam', ''); dai.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:12;display:none;padding:7px 10px;border:1px solid var(--vien,rgba(255,255,255,.18));border-radius:8px;background:var(--o,rgba(14,20,30,.92));color:var(--chu,#eee);font:12px system-ui,sans-serif;text-align:center;pointer-events:none'; document.body.append(dai);
  const hienDai = () => { try { const f = document.querySelector('iframe[title="Góp ý / báo lỗi"]'); const d = f && f.contentDocument.querySelector('[data-gy-dang-lam]'); if (!d) return; dai.textContent = d.textContent.trim(); if (d.dataset.kySu) dai.dataset.kySu = d.dataset.kySu; dai.style.display = dai.textContent ? 'block' : 'none'; } catch {} };
  const theoDoi = new MutationObserver(hienDai);
  const timHom = new MutationObserver(() => { const f = document.querySelector('iframe[title="Góp ý / báo lỗi"]'); if (f && !f.dataset.theoDoi) { f.dataset.theoDoi = '1'; f.addEventListener('load', () => { try { theoDoi.observe(f.contentDocument.body, { childList: true, subtree: true, characterData: true }); hienDai(); } catch {} }); } if (!f) dai.style.display = 'none'; });
  timHom.observe(document.body, { childList: true });
  const menu = document.createElement('div'); menu.id = 'gy-menu';
  menu.innerHTML = '<button data-anh="0">💬 Góp ý (không kèm ảnh)</button><button data-anh="1">📸 Góp ý kèm ảnh màn hình hiện tại</button>';
  document.body.append(menu);
  let tat = 0;
  const hien = () => { clearTimeout(tat); const r = nut.getBoundingClientRect(); menu.style.display = 'flex';
    const w = menu.offsetWidth, h = menu.offsetHeight; menu.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px'; menu.style.top = Math.max(8, r.top - h - 6) + 'px'; };
  const an = (tre = 250) => { clearTimeout(tat); tat = setTimeout(() => { menu.style.display = 'none'; }, tre); };
  nut.addEventListener('mouseenter', hien); nut.addEventListener('mouseleave', () => an());
  menu.addEventListener('mouseenter', () => clearTimeout(tat)); menu.addEventListener('mouseleave', () => an());
  nut.onclick = (e) => { e.stopPropagation(); if (menu.style.display === 'flex') an(0); else hien(); }; // cảm ứng: bấm để mở menu
  const mo = (anh) => { kemAnh = anh; an(0); window.moGopYMos2?.(); kemAnh = false; }; // script hòm đọc __chupTrang ngay trong lúc mở → trả cờ về ngay, lần mở khác (🔍 › theo dõi) không dính ảnh
  menu.querySelectorAll('button').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); mo(b.dataset.anh === '1'); }; });
  const dangMo = () => !!document.querySelector('iframe[title="Góp ý / báo lỗi"]');
  return { mo: (anh = false) => mo(anh), dangMo };
}

// ảnh khung hình hiện tại: gọi ve() rồi đọc canvas NGAY trong cùng nhịp (không cần preserveDrawingBuffer), thu về cạnh dài 1280 px
export function chupCanvas(src, ve) {
  ve();
  const k = Math.min(1, 1280 / src.width), c = document.createElement('canvas');
  c.width = Math.round(src.width * k); c.height = Math.round(src.height * k); c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.82);
}
