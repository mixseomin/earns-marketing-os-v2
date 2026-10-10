// Avatar pixel 7×7 đối xứng, sinh từ tên (ổn định, không random); màu theo phòng. Thay bằng sprite pixel-agents khi văn phòng lên.
export function Avatar({ seed, hue, size = 44 }: { seed: string; hue: number; size?: number }) {
  let h = 2166136261; for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  const cells: string[] = [];
  for (let y = 0; y < 7; y++) for (let x = 0; x < 4; x++) {
    h = (Math.imul(h, 1103515245) + 12345) >>> 0;
    if ((h >>> 16) % 3 !== 0) { cells.push(`<rect x="${x}" y="${y}" width="1" height="1"/>`); if (x < 3) cells.push(`<rect x="${6 - x}" y="${y}" width="1" height="1"/>`); }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-0.5 -0.5 8 8" shape-rendering="crispEdges"><rect x="-0.5" y="-0.5" width="8" height="8" rx="1" fill="hsl(${hue} 40% 92%)"/><g fill="hsl(${hue} 55% 42%)">${cells.join('')}</g></svg>`;
  return <img src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`} width={size} height={size} alt="" style={{ borderRadius: 6, display: 'block' }} />;
}
export const HUE: Record<string, number> = {
  'vp-giam-doc': 200, 'du-an': 150, 'sach': 30, 'adfond': 0, 'dung-san-pham': 260, 'marketing': 320, 'noi-dung': 45,
  'ky-thuat': 220, 'thue-ngoai': 90, 'kinh-doanh': 110, 'phap-che': 20, 'an-toan-tk': 180, 'nghien-cuu-thi-truong': 280,
};
