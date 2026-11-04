// NHÚNG FONT vào SVG lá số của astrolas.com (dùng chung lay.mjs · hop.mjs): mọi url(...) font trỏ /fonts/*.ttf của site → data: URL base64.
// HamburgSymbols = ký hiệu hành tinh + cung; thiếu → ký hiệu hiện thành chữ cái, nên còn font chưa nhúng là NÉM LỖI, không ghi SVG.
const SITE = 'https://astrolas.com';
const fontCache = new Map();
export async function nhungFont(svg) {   // mọi url(...) font trong SVG → data: URL
  const urls = [...new Set([...svg.matchAll(/url\((['"]?)([^'")]+\.(?:ttf|woff2?|otf)(?:\?[^'")]*)?)\1\)/g)].map((m) => m[2]))];
  for (const u of urls) {
    const abs = new URL(u, SITE).href;
    if (!fontCache.has(abs)) { const r = await fetch(abs); if (!r.ok) throw new Error(`không tải được font ${abs} (${r.status})`);
      const kieu = abs.match(/\.(ttf|woff2?|otf)/)[1]; fontCache.set(abs, `data:font/${kieu === 'ttf' ? 'ttf' : kieu};base64,${Buffer.from(await r.arrayBuffer()).toString('base64')}`); }
    svg = svg.split(u).join(fontCache.get(abs));
  }
  if (/url\((['"]?)\/fonts\//.test(svg)) throw new Error('còn font trỏ /fonts/ chưa nhúng');
  return { svg, so: urls.length };
}

