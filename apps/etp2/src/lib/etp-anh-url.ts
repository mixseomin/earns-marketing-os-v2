// ẢNH PHIM / CREATIVE: đường tương đối đi qua cùng miền /api/ethopex/anh (03/11/2026: trình duyệt không tải được CDN thẳng); CDN gốc ở route đó.
// Một nguồn cho ngăn phim (etp-phim.ts) + phiếu lên camp (etp-phieu-len.ts) — 27/11/2026 phiếu đưa đường tương đối thẳng vào <img> nên poster vỡ.
export const anhUrl = (p: unknown) => (typeof p === 'string' && p.trim() ? (/^https?:\/\//.test(p) ? p : `/api/ethopex/anh?p=${encodeURIComponent(p.replace(/^\/+/, ''))}`) : null);
