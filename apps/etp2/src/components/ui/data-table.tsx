'use client';
// Đã chuyển sang gói dùng chung @mos2/bang (studio cũng dùng) — giữ đường import cũ cho mọi trang mos2.
// tra-repo-ok: lớp bọc nhỏ quanh DataTable của nhà, không phải khối mã mới
import { useEffect, useRef } from 'react';
import { DataTable as BangGoc } from '@mos2/bang/data-table';
export * from '@mos2/bang/data-table';

// CHỐNG GIẬT Ở ĐÁY TRANG (etp2 #1713 anh 20/11/2026 "sticky của phim cứ giật giật hiện/ẩn liên tục", cuối Cây camp): bản dính dòng nhóm (tr.dt-nhom-dinh trong
// khối tiêu đề dính .dt-dau) chiếm chỗ trong dòng chảy → hiện = trang dài thêm một dòng, ẩn = ngắn lại. Đứng ở đáy trang, ẩn làm trình duyệt kẹp scrollTop lùi
// đúng một dòng → bảng chưa "cuộn hết" nữa → hiện lại → dài ra → ẩn… (đo: scrollHeight 5645 ↔ 5591 mỗi khung). Gốc: TỔNG CHIỀU CAO phải không đổi theo bản dính.
// Ô đệm ngay sau bảng = cao bản dính khi nó ẩn, 0 khi nó hiện → trang luôn dài như lúc có bản dính, không còn kẹp scrollTop, hết vòng lặp. Đặt trong
// MutationObserver (chạy trước khi trình duyệt dựng lại khung) nên không có khung nào lệch. Mọi DataTable của etp2 đi qua đây.
export const DataTable = ((props: Parameters<typeof BangGoc>[0]) => {
  const demRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const dem = demRef.current, bang = dem?.previousElementSibling as HTMLElement | null;
    if (!dem || !bang) return;
    let cao = 0;
    const xet = () => {
      const tr = bang.querySelector<HTMLTableRowElement>('.dt-dau tr.dt-nhom-dinh');
      if (tr) cao = Math.max(cao, Math.round(tr.getBoundingClientRect().height));
      const h = tr ? 0 : cao;
      if (dem.style.height !== `${h}px`) dem.style.height = `${h}px`;
    };
    const mo = new MutationObserver(xet);
    mo.observe(bang, { childList: true, subtree: true }); xet();
    return () => mo.disconnect();
  }, []);
  return <><BangGoc {...props} /><div ref={demRef} aria-hidden className="dt-dem-dinh" style={{ height: 0, flex: 'none', pointerEvents: 'none' }} /></>;
}) as typeof BangGoc;
