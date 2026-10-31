'use client';
// State nhớ theo trình duyệt (lib/luu-tru): giá trị ngoài danh sách hợp lệ (khoá cũ, sửa tay) → về mặc định.
import { useLayoutEffect, useState } from 'react';
import { docLT, ghiLT } from '@/lib/luu-tru';
import { ghiThamSoUrl } from '@/lib/ghi-url';

/** thamSoUrl: trạng thái đổi cách nhìn cũng nằm trên URL (luật nhà #1255, như ?tlz=) — link/F5 mở đúng chỗ, URL thắng localStorage. */
export function useNho<T extends string>(khoa: string, macDinh: T, hopLe?: readonly T[], thamSoUrl?: string): [T, (v: T) => void] {
  const hop = (s: string | null): s is T => s != null && (!hopLe || hopLe.includes(s as T));
  // Lượt dựng ĐẦU luôn = macDinh (giống HTML máy chủ dựng); URL / localStorage đọc ngay sau đó, TRƯỚC khi vẽ (useLayoutEffect, không nháy).
  // Trước 16/10/2026 đọc thẳng trong khởi tạo → trang chủ mở bằng ?kho=template / ?kho=sanpham lệch HTML máy chủ (React #418).
  const [v, setV] = useState<T>(macDinh);
  useLayoutEffect(() => {
    const u = thamSoUrl ? new URLSearchParams(window.location.search).get(thamSoUrl) : null;
    const s = hop(u) ? u : docLT(khoa);
    if (hop(s) && s !== macDinh) setV(s);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return [v, (x: T) => {
    setV(x); ghiLT(khoa, x);
    if (thamSoUrl) ghiThamSoUrl({ [thamSoUrl]: x });
  }];
}

/** TẬP các nhánh đang GẬP (cây, nhóm, khối mở/gập) nằm trên URL dạng ?thamSo=a,b,c — F5 / chia sẻ link mở đúng y như đang thấy
 *  (anh 31/10/2026: "các phần này khi mở ra cũng phải lưu vào URL để F5 mở ra"). Trạng thái mặc định (không gập gì) = không có tham số. */
export function useGapUrl(thamSo: string): [Set<string>, (k: string) => void] {
  const [gap, setGap] = useState<Set<string>>(new Set());
  useLayoutEffect(() => {
    const u = new URLSearchParams(window.location.search).get(thamSo);
    if (u) setGap(new Set(u.split(',').filter(Boolean)));
  }, [thamSo]);
  return [gap, (k: string) => setGap((s) => {
    const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k);
    ghiThamSoUrl({ [thamSo]: [...n].join(',') || null });
    return n;
  })];
}

/** Một khối mở/gập (<details>, accordion) trên URL: ?mo=kt16,-qc16 — chỉ ghi khi KHÁC mặc định (tên = mở, -tên = gập). URL thắng localStorage. */
export function useMoUrl(ten: string, macDinh: boolean, thamSo = 'mo'): [boolean, (v: boolean) => void] {
  const doc = () => { const ds = (new URLSearchParams(window.location.search).get(thamSo) ?? '').split(',');
    return ds.includes(ten) ? true : ds.includes(`-${ten}`) ? false : null; };
  const [mo, setMo] = useState<boolean>(() => { try { return doc() ?? macDinh; } catch { return macDinh; } });
  return [mo, (v: boolean) => {
    setMo(v);
    const ds = (new URLSearchParams(window.location.search).get(thamSo) ?? '').split(',').filter((x) => x && x !== ten && x !== `-${ten}`);
    if (v !== macDinh) ds.push(v ? ten : `-${ten}`);
    ghiThamSoUrl({ [thamSo]: ds.join(',') || null });
  }];
}
