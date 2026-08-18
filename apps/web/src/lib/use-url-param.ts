'use client';

// Filter/state trên URL. MỘT hook, hai cách dùng — trước đây environments-page tự định nghĩa cả
// useUrlParam lẫn useUrlPatch với cùng một thân hàm, sửa một chỗ là lệch chỗ kia.
//
// GOTCHA đã dính (2026-08-09): setter dựng URL mới từ snapshot `useSearchParams()` lúc render. Gọi
// 2-3 setter trong CÙNG một handler (nút "✕ bỏ lọc" xoá 3 filter) thì cả ba tính từ cùng snapshot và
// router.replace sau đè lên trước → chỉ thay đổi cuối sống sót. Đổi nhiều key thì PHẢI dùng patch().
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

export function useUrlState() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const write = (next: URLSearchParams) => {
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  /** Đổi nhiều key trong MỘT lần ghi URL. Giá trị rỗng = xoá key.
   *  Dựng từ window.location.search TƯƠI, KHÔNG từ snapshot useSearchParams: snapshot không thấy
   *  các param ghi shallow (?ed drawer, ?m modal, <pk>.sort/.flt bảng) → patch từ snapshot là XOÁ
   *  chúng khỏi URL mỗi lần bấm facet (drawer đang mở mà F5 mất). */
  const patch = (kv: Record<string, string>) => {
    const next = new URLSearchParams(typeof window === 'undefined' ? params.toString() : window.location.search);
    for (const [k, v] of Object.entries(kv)) { if (v) next.set(k, v); else next.delete(k); }
    write(next);
  };

  const get = (key: string, defaultValue = '') => params.get(key) ?? defaultValue;

  return { get, patch };
}

/** Một key, kiểu [value, setValue]. Đổi NHIỀU key cùng lúc thì dùng useUrlState().patch. */
export function useUrlParam(key: string, defaultValue: string): [string, (v: string) => void] {
  const { get, patch } = useUrlState();
  return [get(key, defaultValue), (v: string) => patch({ [key]: v === defaultValue ? '' : v })];
}
