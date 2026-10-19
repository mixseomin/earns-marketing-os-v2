// KHUÔN QC PHIM NGẮN (Ethopex): chữ trên màn ngắn + tên phim ở shot 1 + thẻ cuối xem miễn phí. Dùng chung cho tao-lo.mts và them-the-cuoi.mts.
const NEN: Record<string, string> = { reelshort: 'ReelShort', netshort: 'NetShort', dramabox: 'DramaBox' };
/** chữ trên màn gọn: ≤ maxTu từ giữ nguyên; dài hơn thì cắt ở DẤU CÂU gần nhất (≥ 4 từ) — không cắt giữa cụm (bản đầu ra "So I took a job at the…") */
export function rutChu(s: string, maxTu = 10): string {
  const c = s.trim(); const w = c.split(/\s+/);
  if (w.length <= maxTu) return c;
  const m = [...c.matchAll(/[.,;:!?—]/g)].map((x) => x.index!).filter((i) => c.slice(0, i).split(/\s+/).length >= 4 && c.slice(0, i).split(/\s+/).length <= maxTu);
  return m.length ? c.slice(0, m.at(-1)! + 1).replace(/[,;:—]$/, '…') : c;
}
export function khuonQcPhim(ten: string, lang: 'en' | 'es', nguon: string, loi: string[]) {
  const nen = NEN[nguon] ?? 'our app';
  const chu = loi.map((l, i) => (i === 0 ? `${rutChu(l)}\n"${ten}"` : rutChu(l)));
  const theCuoi = lang === 'es'
    ? { chu: `"${ten}"\nMIRA TODOS LOS EPISODIOS GRATIS`, loi: `Mira "${ten}" gratis. Todos los episodios.` }
    : { chu: `"${ten}"\nWATCH FULL EPISODES FREE`, loi: `Watch "${ten}" free. Full episodes now.` };
  return {
    chu,
    qcTen: lang === 'es' ? `${ten} — miniserie, gratis en ${nen}` : `${ten} — short drama, free on ${nen}`,
    theCuoi: { ...theCuoi, anh: 'Movie key art poster composition of the main characters from the reference poster, dramatic backlight, empty dark space in the lower third for title text, vertical 9:16.', dong: 'Slow cinematic push-in on the key art, light flares, characters hold still.' },
  };
}
