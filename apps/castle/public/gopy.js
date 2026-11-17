// GÓP Ý castle = HÒM CHUẨN MOS2 (anh 17/11/2026: "gửi tasks, ảnh phản biện… phải có chỗ xem, follow, update như góp ý chuẩn ở mos2, không phải gửi lên
// xong không biết đang ở đâu"). Trước đây castle chạy một hộp tự viết chỉ gửi được; nay nút 💬 mở hòm dùng chung của mos2 (/nhung/gop-y trong khung phủ màn,
// nạp bằng script https://mos2.on.tc/api/gop-y-ngoai/nut): GỬI · CỦA TÔI (trạng thái từng thẻ, luồng trả lời, làm lại, duyệt xong) · HỎI ĐÁP.
// Thẻ 🔍 báo lệch (baolech.js), thẻ máy quét và thẻ Claude tạo theo lệnh anh cũng hiện trong "Của tôi".
// ganGopY({ nut, chupAnh: () => dataURL|null, nguCanh: () => string }) → { mo, dangMo }
const NUT_HOM = 'https://mos2.on.tc/api/gop-y-ngoai/nut';

export function ganGopY({ nut, chupAnh = () => null, nguCanh = () => '' }) {
  window.__nguCanhTrang = () => nguCanh();   // hòm đọc lúc mở: chỗ đứng / chế độ / ảnh thật đã chọn (📷)
  window.__chupTrang = () => chupAnh();       // ảnh khung hình kèm thẻ
  nut.setAttribute('data-gop-y-mo', '');      // script hòm bắt click ở pha capture
  nut.title = 'Góp ý / báo lỗi — gửi kèm ảnh màn hình + chỗ đang đứng; tab "Của tôi" xem trạng thái + trả lời mọi thẻ đã gửi';
  if (!document.querySelector(`script[src="${NUT_HOM}"]`)) { const s = document.createElement('script'); s.src = NUT_HOM; s.defer = true; s.onerror = () => console.error('[castle] không nạp được hòm góp ý mos2', NUT_HOM); document.head.append(s); }
  const dangMo = () => !!document.querySelector('iframe[title="Góp ý / báo lỗi"]');
  return { mo: () => window.moGopYMos2?.(), dangMo };
}

// ảnh khung hình hiện tại: gọi ve() rồi đọc canvas NGAY trong cùng nhịp (không cần preserveDrawingBuffer), thu về cạnh dài 1280 px
export function chupCanvas(src, ve) {
  ve();
  const k = Math.min(1, 1280 / src.width), c = document.createElement('canvas');
  c.width = Math.round(src.width * k); c.height = Math.round(src.height * k); c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.82);
}
