// LỌC NGUỒN hòm góp ý "Của tôi" theo NƠI ĐANG XEM (anh 19/11/2026: card castle.on.tc không được hiện ở mos2.on.tc).
// Mỗi trang ngoài có hòm riêng trên cùng bảng human_tasks, nhận ra bằng source_url:
//   etp / etp2.on.tc → chỉ card nguồn etp/etp2 · castle.on.tc → chỉ card nguồn castle · mos2 (mọi nơi khác) → loại cả hai.
// Hòm castle chạy trong iframe mos2.on.tc/nhung/gop-y?trang=https://castle.on.tc/… (host vẫn là mos2) → đọc ?trang= trong Referer.
// apps/etp2 có luật lọc riêng (chỉ nguồn etp) — đổi nguồn etp thì sửa cả hai. Tự kiểm: gop-y-loc-nguon.test.mts.
export type LocNguon = { mau: string; khop: boolean };

const NGUON = {
  etp: '^https?://etp2?\\.on\\.tc(/|$)',
  castle: '^https?://castle\\.on\\.tc(/|$)',
};
const NGOAI_MOS2 = '^https?://(etp2?|castle)\\.on\\.tc(/|$)';

function hostCua(x: string | null | undefined) { return String(x ?? '').split(':')[0]!.toLowerCase(); }

/** Nơi đang xem: host của request, hoặc host của ?trang= khi đang ở khung nhúng /nhung/gop-y. */
export function noiDangXem(host: string | null | undefined, referer?: string | null): string {
  let h = hostCua(host);
  try {
    const r = new URL(String(referer ?? ''));
    if (r.pathname.startsWith('/nhung/gop-y')) { const t = r.searchParams.get('trang'); if (t) h = new URL(t).hostname.toLowerCase(); }
  } catch { /* không có referer hợp lệ → giữ host */ }
  return h;
}

export function boLocNguon(host: string | null | undefined, referer?: string | null): LocNguon {
  const h = noiDangXem(host, referer);
  if (/^etp2?\.on\.tc$/.test(h)) return { mau: NGUON.etp, khop: true };
  if (h === 'castle.on.tc') return { mau: NGUON.castle, khop: true };
  return { mau: NGOAI_MOS2, khop: false };
}
