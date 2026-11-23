// LỌC NGUỒN hòm góp ý "Của tôi" theo NƠI ĐANG XEM (anh 19/11/2026: card castle.on.tc không được hiện ở mos2.on.tc).
// Mỗi trang ngoài có hòm riêng trên cùng bảng human_tasks, nhận ra bằng source_url. SỔ TRANG RIÊNG dưới đây là NGUỒN DUY NHẤT:
// lọc "Của tôi", tên hòm trên khung (components/gop-y-mos2.tsx), danh sách trang tĩnh được gửi (api/gop-y-ngoai) đều đọc từ đây.
// Trang mới = một dòng trong TRANG_RIENG (23/11/2026: worlds / sprawl thiếu dòng → hòm nhúng hiện cả 63 card mos2).
// Hòm nhúng chạy trong iframe mos2.on.tc/nhung/gop-y?trang=https://<host>/… (host vẫn là mos2) → đọc ?trang= trong Referer.
// apps/etp2 có luật lọc riêng (chỉ nguồn etp) — đổi nguồn etp thì sửa cả hai. Tự kiểm: gop-y-loc-nguon.test.mts.
export type LocNguon = { mau: string; khop: boolean };

/** khoa · ten = tên hòm hiện trên khung · host = mẫu tên máy (regex, không neo) · tinh = trang tĩnh gửi qua /api/gop-y-ngoai */
export const TRANG_RIENG: { khoa: string; ten: string; host: string; tinh?: boolean }[] = [
  { khoa: 'etp', ten: 'Ethopex', host: 'etp2?\\.on\\.tc' },
  { khoa: 'castle', ten: 'Lâu đài', host: 'castle\\.on\\.tc', tinh: true },
  { khoa: 'studio2', ten: 'Studio 2', host: 'studio2\\.on\\.tc' },
  { khoa: 'dantranh', ten: 'Đàn Tranh', host: 'dantranh2?\\.on\\.tc' },
  { khoa: 'sprawl', ten: 'Sprawl', host: 'sprawl\\.on\\.tc', tinh: true },
  { khoa: 'worlds', ten: 'Sổ Thế Giới', host: 'worlds\\.on\\.tc', tinh: true },
];

const mauNguon = (host: string) => `^https?://(${host})(/|$)`;
const NGOAI_MOS2 = mauNguon(TRANG_RIENG.map((t) => t.host).join('|'));

function hostCua(x: string | null | undefined) { return String(x ?? '').split(':')[0]!.toLowerCase(); }

/** Trang riêng của một host (null = mos2 / city / nơi khác). */
export function trangRieng(host: string | null | undefined) {
  const h = hostCua(host);
  return TRANG_RIENG.find((t) => new RegExp(`^(${t.host})$`).test(h)) ?? null;
}

/** Trang tĩnh được gửi góp ý qua /api/gop-y-ngoai. */
export function laTrangTinh(host: string | null | undefined) { return !!trangRieng(host)?.tinh; }

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
  const t = trangRieng(noiDangXem(host, referer));
  return t ? { mau: mauNguon(t.host), khop: true } : { mau: NGOAI_MOS2, khop: false };
}
