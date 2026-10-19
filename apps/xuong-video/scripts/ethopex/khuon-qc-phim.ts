// KHUÔN QC PHIM NGẮN (Ethopex): chữ trên màn ngắn + tên phim ở shot 1 + thẻ cuối xem miễn phí. Dùng chung cho tao-lo.mts và them-the-cuoi.mts.
const NEN: Record<string, string> = { reelshort: 'ReelShort', netshort: 'NetShort', dramabox: 'DramaBox' };
/** ≤ maxTu từ, giữ dấu chấm lửng / chấm than cuối nếu có */
export function rutChu(s: string, maxTu = 7): string {
  const w = s.replace(/^\.\.\./, '').trim().split(/\s+/);
  return w.length <= maxTu ? s.trim() : `${w.slice(0, maxTu).join(' ').replace(/[,;:]$/, '')}…`;
}
export function khuonQcPhim(ten: string, lang: 'en' | 'es', nguon: string, loi: string[]) {
  const nen = NEN[nguon] ?? 'our app';
  const chu = loi.map((l, i) => (i === 0 ? `${rutChu(l, 9)}\n"${ten}"` : rutChu(l)));
  const theCuoi = lang === 'es'
    ? { chu: `"${ten}"\nMIRA TODOS LOS EPISODIOS GRATIS`, loi: `Mira "${ten}" gratis. Todos los episodios.` }
    : { chu: `"${ten}"\nWATCH FULL EPISODES FREE`, loi: `Watch "${ten}" free. Full episodes now.` };
  return {
    chu,
    qcTen: lang === 'es' ? `${ten} — miniserie, gratis en ${nen}` : `${ten} — short drama, free on ${nen}`,
    theCuoi: { ...theCuoi, anh: 'Movie key art poster composition of the main characters from the reference poster, dramatic backlight, empty dark space in the lower third for title text, vertical 9:16.', dong: 'Slow cinematic push-in on the key art, light flares, characters hold still.' },
  };
}
