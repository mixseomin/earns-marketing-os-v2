'use client';
// MỘT chỗ hiện giờ cho cả cty.on.tc (#1269): mọi mốc thời gian đi qua <Gio>/<KhoangGio>, luôn kèm múi giờ. Mặc định GMT+7;
// đổi ở ô chọn trên thanh đầu (<ChonMuiGio>), nhớ theo trình duyệt. Máy chủ dựng sẵn GMT+7, trình duyệt đổi nếu anh chọn khác.
import { useSyncExternalStore } from 'react';

export const MUI_GIO = [
  { k: 'Asia/Ho_Chi_Minh', nhan: 'GMT+7' },
  { k: 'UTC', nhan: 'UTC' },
  { k: 'America/New_York', nhan: 'New York' },
] as const;
const MAC_DINH = MUI_GIO[0].k;
const KHOA = 'cty.mui-gio';
const SU_KIEN = 'cty:mui-gio';

const doc = (): string => { try { const v = localStorage.getItem(KHOA); return MUI_GIO.some((m) => m.k === v) ? v! : MAC_DINH; } catch { return MAC_DINH; } };
const nghe = (f: () => void) => { window.addEventListener(SU_KIEN, f); window.addEventListener('storage', f); return () => { window.removeEventListener(SU_KIEN, f); window.removeEventListener('storage', f); }; };
const useMui = () => useSyncExternalStore(nghe, doc, () => MAC_DINH);
const nhanMui = (k: string) => MUI_GIO.find((m) => m.k === k)?.nhan ?? k;

function dd(iso: string, tz: string, o: { ngay?: boolean; giay?: boolean }) {
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('vi-VN', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false, ...(o.giay !== false ? { second: '2-digit' } : {}), ...(o.ngay ? { day: '2-digit', month: '2-digit', year: 'numeric' } : {}) });
}

/** Một mốc: "22:23:34 10/10/2026 GMT+7". `ngay=false` bỏ ngày, `mui=false` bỏ nhãn múi (khi đứng cạnh nhãn chung). */
export function Gio({ iso, ngay = true, giay = true, mui = true }: { iso?: string | null; ngay?: boolean; giay?: boolean; mui?: boolean }) {
  const tz = useMui();
  if (!iso) return <span className="cty-muted">—</span>;
  return <time dateTime={iso} title={new Date(iso).toISOString()}>{dd(iso, tz, { ngay, giay })}{mui && <span className="cty-mui"> {nhanMui(tz)}</span>}</time>;
}

/** Bắt đầu → kết thúc, cùng ngày thì chỉ ghi ngày một lần: "22:23:34 → 22:23:43 · 10/10/2026 GMT+7". Chưa xong → "đang chạy". */
export function KhoangGio({ tu, den, ngay = true }: { tu?: string | null; den?: string | null; ngay?: boolean }) {
  const tz = useMui();
  if (!tu) return <span className="cty-muted">—</span>;
  const ngayTu = dd(tu, tz, { ngay: true }).split(' ').slice(1).join(' ');
  return (
    <span className="cty-khoang">
      <time dateTime={tu}>{dd(tu, tz, {})}</time> → {den ? <time dateTime={den}>{dd(den, tz, {})}</time> : <i>đang chạy</i>}
      {ngay && <> · {ngayTu}</>}<span className="cty-mui"> {nhanMui(tz)}</span>
    </span>
  );
}

/** Nhãn múi giờ đang dùng — cho đầu cột khi từng ô bỏ nhãn (`mui={false}`). */
export function MuiNhan() { return <span className="cty-mui">({nhanMui(useMui())})</span>; }

export function ChonMuiGio() {
  const tz = useMui();
  return (
    <select className="cty-chon-mui" aria-label="Múi giờ" value={tz}
      onChange={(e) => { try { localStorage.setItem(KHOA, e.target.value); } catch { /* không lưu được: chỉ đổi tới lúc tải lại */ } window.dispatchEvent(new Event(SU_KIEN)); }}>
      {MUI_GIO.map((m) => <option key={m.k} value={m.k}>{m.nhan}</option>)}
    </select>
  );
}
