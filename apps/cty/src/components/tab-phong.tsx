'use client';
// Thanh tab của ngăn/trang phòng (YDNI "một màn, không cuộn"): phần đầu ghim, chỉ vùng tab cuộn. Bộ tab và thứ tự CỐ ĐỊNH theo
// loại phòng, nhãn mang số đếm; tab vừa xem nhớ theo phòng (localStorage). Nội dung mọi tab dựng sẵn ở máy chủ, đổi tab = ẩn/hiện.
// `trong` = thanh tab lồng trong một tab khác (chọn dây chuyền trong tab Dây chuyền): cao theo nội dung, khung ngoài là chỗ cuộn duy nhất.
// `thamSo` = ghi tab đang chọn vào URL (?<thamSo>=<tab>, history.replaceState — không bắt máy chủ dựng lại) để gửi link đúng tab; URL thắng
// tab đã nhớ. `macDinh` = tab mở khi chưa nhớ gì (vd dây chuyền đang có việc gấp nhất).
import { useEffect, useState } from 'react';

export type TabMuc = { key: string; nhan: string; so?: string | number };

export function TabPhong({ khoa, tabs, dau, children, trong, thamSo, macDinh }: { khoa: string; tabs: TabMuc[]; dau?: React.ReactNode; children: React.ReactNode[]; trong?: boolean; thamSo?: string; macDinh?: string }) {
  const [tab, setTab] = useState(macDinh && tabs.some((t) => t.key === macDinh) ? macDinh : tabs[0]!.key);
  useEffect(() => {
    let v: string | null = null;
    try { v = thamSo ? new URLSearchParams(window.location.search).get(thamSo) : null; } catch { /* không đọc được URL */ }
    try { v ??= localStorage.getItem(`cty.tab.${khoa}`); } catch { /* mặc định */ }
    if (v && tabs.some((t) => t.key === v)) setTab(v);
  }, [khoa, tabs, thamSo]);
  const chon = (k: string) => {
    setTab(k); try { localStorage.setItem(`cty.tab.${khoa}`, k); } catch { /* chỉ nhớ tới F5 */ }
    if (thamSo) { const u = new URL(window.location.href); u.searchParams.set(thamSo, k); window.history.replaceState(null, '', u); }
  };
  return (
    <div className={`cty-tabkhung${trong ? ' cty-tabkhung-trong' : ''}`}>
      <div className="cty-tabdau">
        {dau}
        <div className="cty-tabs" role="tablist">
          {tabs.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => chon(t.key)}>
              {t.nhan}{t.so != null && t.so !== '' && <span className="cty-tab-so">{t.so}</span>}
            </button>
          ))}
        </div>
      </div>
      {tabs.map((t, i) => <div key={t.key} role="tabpanel" className="cty-tabnoi" hidden={tab !== t.key}>{children[i]}</div>)}
    </div>
  );
}
