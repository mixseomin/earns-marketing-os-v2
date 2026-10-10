'use client';
// Thanh tab của ngăn/trang phòng (YDNI "một màn, không cuộn"): phần đầu ghim, chỉ vùng tab cuộn. Bộ tab và thứ tự CỐ ĐỊNH theo
// loại phòng, nhãn mang số đếm; tab vừa xem nhớ theo phòng (localStorage). Nội dung mọi tab dựng sẵn ở máy chủ, đổi tab = ẩn/hiện.
import { useEffect, useState } from 'react';

export type TabMuc = { key: string; nhan: string; so?: string | number };

export function TabPhong({ khoa, tabs, dau, children }: { khoa: string; tabs: TabMuc[]; dau?: React.ReactNode; children: React.ReactNode[] }) {
  const [tab, setTab] = useState(tabs[0]!.key);
  useEffect(() => { try { const v = localStorage.getItem(`cty.tab.${khoa}`); if (v && tabs.some((t) => t.key === v)) setTab(v); } catch { /* mặc định tab đầu */ } }, [khoa, tabs]);
  const chon = (k: string) => { setTab(k); try { localStorage.setItem(`cty.tab.${khoa}`, k); } catch { /* chỉ nhớ tới F5 */ } };
  return (
    <div className="cty-tabkhung">
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
