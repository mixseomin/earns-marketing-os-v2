'use client';
// NHÃN CỘT cho bảng trên điện thoại (#1353): màn ≤ 600px mỗi hàng bảng thành một thẻ dọc (cty.css), ô cần biết nó là cột gì → chép chữ <th>
// sang data-nhan của từng <td> MỘT chỗ cho mọi bảng trong .cty-cuon / .cty-dn-cuon (kể cả bảng trong ngăn kéo mở sau, nhờ MutationObserver).
// ponytail: không sửa từng bảng; bảng có ô gộp cột (colSpan) thì nhãn lệch — chưa có bảng nào như thế.
import { useEffect } from 'react';

function ganNhan() {
  for (const t of document.querySelectorAll<HTMLTableElement>('.cty-cuon table, .cty-dn-cuon table')) {
    const th = [...t.querySelectorAll('thead th')].map((x) => (x as HTMLElement).innerText.replace(/\s+/g, ' ').trim());
    if (!th.length) continue;
    for (const tr of t.querySelectorAll('tbody tr')) [...tr.children].forEach((td, i) => { if (th[i] && (td as HTMLElement).dataset.nhan !== th[i]) (td as HTMLElement).dataset.nhan = th[i]; });
  }
}
export function NhanCot() {
  useEffect(() => {
    let cho = 0; const lai = () => { cancelAnimationFrame(cho); cho = requestAnimationFrame(ganNhan); };
    ganNhan(); const mo = new MutationObserver(lai); mo.observe(document.body, { childList: true, subtree: true });
    return () => { mo.disconnect(); cancelAnimationFrame(cho); };
  }, []);
  return null;
}
