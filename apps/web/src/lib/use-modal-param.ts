'use client';

// ──────────────────────────────────────────────────────────────────
// useModalParam — DEFAULT design cho mọi modal trong MOS2.
//
// Nguyên tắc: URL là source-of-truth cho modal đang mở. F5 / share link
// → mở lại đúng modal đó ở đúng page. Dùng shallow history.replaceState
// nên KHÔNG trigger RSC roundtrip mỗi lần open/close (UI vẫn instant).
//
// Mỗi "modal slot" = cặp param: `<key>` (modal nào) + `<key>Id` (target id).
//  - Page-level modal: key = 'm'  → ?m=habitat-edit&mId=12
//  - Modal lồng nhau (modal trong drawer): key khác, vd 'sub' → ?sub=brief&subId=7
//
// Quy ước đặt tên modal value: '<entity>-<action>' (habitat-edit, tribe-new,
// account-new, brief-edit, ...). Component derive open/close + target từ URL,
// KHÔNG dùng useState riêng cho việc đóng/mở modal nữa.
//
// Cách dùng:
//   const modal = useModalParam();                 // key='m'
//   modal.open('habitat-edit', habitat.id);        // ?m=habitat-edit&mId=<id>
//   modal.is('habitat-edit')                        // boolean
//   modal.id                                        // '<id>' | null
//   modal.close();                                  // xoá cả 2 param
//
// Nested: const sub = useModalParam('sub');
// ──────────────────────────────────────────────────────────────────

import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

export interface ModalParam {
  /** Raw value của ?<key>= (vd 'habitat-edit'), hoặc null nếu không mở. */
  value: string | null;
  /** Raw value của ?<key>Id= (vd '12'), hoặc null. */
  id: string | null;
  /** id ép kiểu number, hoặc null nếu thiếu/không parse được. */
  numId: number | null;
  /** Mở modal: set ?<key>=m (+ ?<key>Id=mid nếu có). */
  open: (m: string, mid?: string | number | null) => void;
  /** Đóng modal hiện tại: xoá cả ?<key>= và ?<key>Id=. */
  close: () => void;
  /** modal.is('habitat-edit') → true nếu ?<key>=habitat-edit. */
  is: (m: string) => boolean;
}

export function useModalParam(key = 'm'): ModalParam {
  const pathname = usePathname();
  const sp = useSearchParams();
  const idKey = `${key}Id`;

  // Local mirror = source of truth cho RE-RENDER. window.history.replaceState
  // KHÔNG trigger useSearchParams update (đó là lý do shallow URL sync nhanh),
  // nên nếu chỉ đọc sp.get() thì open()/close() sẽ không re-render. Init từ
  // URL khi mount → F5 / deep-link mở lại đúng modal.
  const [value, setValue] = useState<string | null>(() => sp.get(key));
  const [id, setId] = useState<string | null>(() => sp.get(idKey));

  // Đồng bộ 1 chiều URL → state khi điều hướng thật (back/forward, Link).
  // useSearchParams đổi tham chiếu khi router navigate; bỏ qua thay đổi do
  // chính replaceState gây ra vì sp không đổi trong trường hợp đó.
  useEffect(() => {
    setValue(sp.get(key));
    setId(sp.get(idKey));
  }, [sp, key, idKey]);

  const numId = id != null && id !== '' && !Number.isNaN(Number(id)) ? Number(id) : null;

  const write = useCallback(
    (m: string | null, mid?: string | number | null) => {
      setValue(m);
      setId(m && mid != null && mid !== '' ? String(mid) : null);
      if (typeof window === 'undefined') return;
      const next = new URLSearchParams(window.location.search);
      if (!m) {
        next.delete(key);
        next.delete(idKey);
      } else {
        next.set(key, m);
        if (mid != null && mid !== '') next.set(idKey, String(mid));
        else next.delete(idKey);
      }
      const qs = next.toString();
      window.history.replaceState({}, '', qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, key, idKey],
  );

  const open = useCallback((m: string, mid?: string | number | null) => write(m, mid), [write]);
  const close = useCallback(() => write(null), [write]);
  const is = useCallback((m: string) => value === m, [value]);

  return { value, id, numId, open, close, is };
}
