// ẢNH NỀN THẬT TỰ ĐỘNG cho video máy dựng (anh 18/10/2026: "các bài đăng, nội dung đều rất lười thêm ảnh minh hoạ từ pexels… phải cho vào luật").
// Video chưa có nen_url lúc xuất → tìm ảnh dọc Pexels theo chủ đề (truy vấn của mẫu, mặc định chu_de), KHÔNG trùng ảnh đã dùng trong cùng máy,
// ghi nen_url rồi mới dựng. Một chỗ cho mọi mẫu / máy / phim mới tự làm — không mẫu nào phải nhớ tự đi lấy ảnh. Khoá PEXELS_KEY (env box3).
// Pexels: free, dùng thương mại, không cần ghi nguồn; WAF chặn UA mặc định → luôn gửi UA trình duyệt (skill design/stock-photo-apis).

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
type AnhPexels = { id: number; src: { original: string }; avg_color?: string | null };

/** id ảnh Pexels trong một URL ảnh (images.pexels.com/photos/<id>/…) — để so trùng. */
export const idPexels = (u: string | null | undefined): number | null => { const m = String(u ?? '').match(/pexels\.com\/photos\/(\d+)\//); return m ? Number(m[1]) : null; };
/** URL ảnh dọc 1080x1920 cắt sẵn. */
export const urlDoc = (p: AnhPexels) => `${p.src.original}?auto=compress&cs=tinysrgb&w=1080&h=1920&fit=crop`;
/** Độ sáng cảm nhận 0–1 từ màu trung bình Pexels (avg_color '#rrggbb'); không có màu = coi như đủ sáng (không loại oan). */
export const doSang = (p: AnhPexels): number => { const m = String(p.avg_color ?? '').match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i); if (!m) return 1; const [r, g, b] = m.slice(1).map((h) => parseInt(h, 16)); return (0.299 * r! + 0.587 * g! + 0.114 * b!) / 255; };
/** Ảnh tối hơn mức này nhìn gần như đen trên điện thoại (video #842 cảnh 3, trời đêm trơn, 31/10/2026) — mọi bài phải "nhìn rõ chứ không phủ tối" (luật chung 18/10/2026). */
export const SANG_TOI_THIEU = 0.14;
/** Ảnh đầu tiên chưa dùng (theo id) đủ sáng, hoặc null. */
export const chonChuaDung = (ds: AnhPexels[], daDung: Set<number>) => ds.find((p) => !daDung.has(p.id) && doSang(p) >= SANG_TOI_THIEU) ?? null;

/** Tìm một ảnh dọc chưa dùng cho truy vấn (thử thêm truy vấn ngắn hơn nếu trang đầu đã dùng hết). Ném lỗi khi không có khoá / không có ảnh: không dựng video thiếu ảnh. */
export async function timAnhNen(truyVan: string, daDung: Set<number>, key = process.env.PEXELS_KEY): Promise<string> {
  if (!key) throw new Error('thiếu PEXELS_KEY — không dựng video thiếu ảnh nền thật');
  const tu = truyVan.trim().split(/\s+/); let toiNhat: AnhPexels | null = null;
  for (const q of [...new Set([tu.join(' '), tu.slice(0, 2).join(' ')])].filter(Boolean)) {
    const r = await fetch(`https://api.pexels.com/v1/search?${new URLSearchParams({ query: q, orientation: 'portrait', per_page: '30' })}`, { headers: { Authorization: key, 'User-Agent': UA }, signal: AbortSignal.timeout(20_000) });
    if (!r.ok) throw new Error(`Pexels ${r.status} cho "${q}"`);
    const ds = ((await r.json()) as { photos?: AnhPexels[] }).photos ?? [];
    const p = chonChuaDung(ds, daDung);
    if (p) return urlDoc(p);
    for (const x of ds) if (!daDung.has(x.id) && (!toiNhat || doSang(x) > doSang(toiNhat))) toiNhat = x;
  }
  if (toiNhat) return urlDoc(toiNhat);   // mọi ảnh còn lại đều tối (chủ đề đêm) → lấy ảnh sáng nhất, không dừng video
  throw new Error(`Pexels không còn ảnh chưa dùng cho "${truyVan}"`);
}

// ── VIDEO NỀN THẬT (mẫu khai nenVideo — vd canh-dong, 26/10/2026): Pexels Videos, dọc, 6–30s, lấy tệp 1080×1920 (hd) — cùng luật không trùng trong máy.
type VideoPexels = { id: number; duration: number; video_files: { width: number; height: number; link: string; quality: string }[] };
/** id video Pexels trong URL tệp (videos.pexels.com/video-files/<id>/…). */
export const idPexelsVideo = (u: string | null | undefined): number | null => { const m = String(u ?? '').match(/video-files\/(\d+)\//); return m ? Number(m[1]) : null; };
/** Tệp dọc gần 1080×1920 nhất của một video (ưu tiên đúng 1080 rộng, rồi hd). */
export const tepDoc = (v: VideoPexels) => [...v.video_files].filter((f) => f.height > f.width).sort((a, b) => Math.abs(a.width - 1080) - Math.abs(b.width - 1080) || (b.quality === 'hd' ? 1 : 0) - (a.quality === 'hd' ? 1 : 0))[0] ?? null;
/** Danh sách ứng viên video dọc chưa dùng (theo thứ tự Pexels trả) — may-dung.ts › timVideoNenDong tải từng cái đo chuyển động rồi mới nhận. */
export async function ungVienVideoNen(truyVan: string, daDung: Set<number>, key = process.env.PEXELS_KEY): Promise<{ id: number; url: string; giay: number }[]> {
  if (!key) throw new Error('thiếu PEXELS_KEY — không dựng video thiếu cảnh thật');
  const tu = truyVan.trim().split(/\s+/);
  for (const q of [...new Set([tu.join(' '), tu.slice(0, 2).join(' ')])].filter(Boolean)) {
    const r = await fetch(`https://api.pexels.com/videos/search?${new URLSearchParams({ query: q, orientation: 'portrait', size: 'medium', per_page: '20' })}`, { headers: { Authorization: key, 'User-Agent': UA }, signal: AbortSignal.timeout(20_000) });
    if (!r.ok) throw new Error(`Pexels video ${r.status} cho "${q}"`);
    const ds = (((await r.json()) as { videos?: VideoPexels[] }).videos ?? []).filter((v) => v.duration >= 6 && v.duration <= 30 && !daDung.has(v.id)).map((v) => ({ v, f: tepDoc(v) })).filter((x) => x.f).map((x) => ({ id: x.v.id, url: x.f!.link, giay: x.v.duration }));
    if (ds.length) return ds;
  }
  throw new Error(`Pexels không còn video dọc chưa dùng cho "${truyVan}"`);
}
export async function timVideoNen(truyVan: string, daDung: Set<number>, key = process.env.PEXELS_KEY): Promise<string> { return (await ungVienVideoNen(truyVan, daDung, key))[0]!.url; }
