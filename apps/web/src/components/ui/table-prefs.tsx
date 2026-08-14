'use client';

// Trạng thái NGƯỜI DÙNG của một bảng (cột bật/tắt · sắp xếp · lọc-cột · thẻ/bảng) — đọc TRÊN SERVER
// từ cookie rồi bơm xuống, để lần sơn ĐẦU TIÊN đã đúng.
//
// Trước đây mỗi thứ được khôi phục trong một useEffect riêng, tức là SAU khi đã vẽ: F5 là thấy bảng
// nháy — hiện đủ cột/đủ dòng rồi mới co lại. Không sửa được ở tầng effect (effect luôn chạy sau paint),
// nên server phải biết trước. Một cookie cho một bảng: `tbl.<persistKey>` = {c,s,f,v}.
//
// Provider đặt ở app/layout → MỌI bảng có sẵn, không phải nối dây từng trang (kiểu nối tay chỉ chạy
// cho 2/13 bảng, 11 bảng còn lại vẫn nháy — đúng cái vừa dính).
import { createContext, useContext, type ReactNode } from 'react';

export interface TablePref {
  c?: Record<string, boolean>;                      // nhóm cột đang bật
  s?: { key: string; dir: 'asc' | 'desc' }[];       // sắp xếp (nhiều cột)
  f?: Record<string, { op: string; val: string }>;  // lọc theo từng cột
  v?: 'card' | 'table';                             // chế độ nhìn
}

const Ctx = createContext<Record<string, TablePref>>({});
const EMPTY: TablePref = {};

export function TablePrefsProvider({ value, children }: { value: Record<string, TablePref>; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTablePref(persistKey?: string): TablePref {
  const all = useContext(Ctx);
  return (persistKey ? all[persistKey] : undefined) ?? EMPTY;
}

export const tblCookie = (k: string) => `tbl.${k}`;

// Ghi MỘT mảnh vào cookie của bảng. Đọc-gộp-ghi vì có 4 người ghi (cột/sort/lọc/view) — ghi đè cả
// object thì bật cột xong là mất sort.
export function writeTablePref(persistKey: string | undefined, patch: TablePref): void {
  if (!persistKey || typeof document === 'undefined') return;
  const name = tblCookie(persistKey);
  let cur: TablePref = {};
  const hit = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
  if (hit) { try { cur = JSON.parse(decodeURIComponent(hit.slice(name.length + 1))); } catch { /* cookie hỏng → coi như trống */ } }
  const next = { ...cur, ...patch };
  document.cookie = `${name}=${encodeURIComponent(JSON.stringify(next))}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}
