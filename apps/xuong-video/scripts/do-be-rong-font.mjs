// Đo bề rộng từng ký tự của các font chữ màn (12/10/2026 — "SIGNED. HER TERMS." Playfair Black chữ hoa tràn khung: ước 0,4 × cỡ
// cho mọi font/mọi ký tự hụt gần gấp đôi với serif đậm viết hoa). Đọc thẳng TTF (cmap + hmtx), quy về đơn vị libass: libass co font
// sao cho winAscent + winDescent = cỡ ASS, nên bề rộng px = advance / (winAscent + winDescent) × cỡ.
// Chạy lại khi thêm font: node apps/xuong-video/scripts/do-be-rong-font.mjs → ghi src/lib/xuong-video/be-rong-font.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const goc = join(dirname(fileURLToPath(import.meta.url)), '..');
const FONT = {
  'DejaVu Sans': join(goc, 'scripts/font/DejaVuSans-Bold.ttf'),   // bản xuất dùng Bold (Style Bold=-1), chép từ box3 /usr/share/fonts
  'Montserrat Black': join(goc, 'public/fonts/Montserrat-Black.ttf'),
  'Montserrat ExtraBold': join(goc, 'public/fonts/Montserrat-ExtraBold.ttf'),
  'Playfair Display Black': join(goc, 'public/fonts/PlayfairDisplay-Black.ttf'),
};
const VIET = 'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ';
let KY = '';
for (let c = 32; c < 127; c++) KY += String.fromCharCode(c);
KY += '·•—–→←…‘’“”«»°×€£¥' + VIET + VIET.toUpperCase();

function doc(tep) {
  const b = readFileSync(tep);
  const n = b.readUInt16BE(4); const bang = {};
  for (let i = 0; i < n; i++) { const o = 12 + i * 16; bang[b.toString('latin1', o, o + 4)] = b.readUInt32BE(o + 8); }
  const hhea = bang.hhea, os2 = bang['OS/2'];
  const em = os2 != null ? b.readUInt16BE(os2 + 74) + b.readUInt16BE(os2 + 76) : b.readInt16BE(hhea + 4) - b.readInt16BE(hhea + 6);
  const soHm = b.readUInt16BE(hhea + 34);
  const adv = (g) => b.readUInt16BE(bang.hmtx + Math.min(g, soHm - 1) * 4);
  // cmap: ưu tiên format 12 (3,10), rồi format 4 (3,1)
  const cm = bang.cmap; const nb = b.readUInt16BE(cm + 2); let f4 = null, f12 = null;
  for (let i = 0; i < nb; i++) {
    const p = b.readUInt16BE(cm + 4 + i * 8), e = b.readUInt16BE(cm + 6 + i * 8), o = cm + b.readUInt32BE(cm + 8 + i * 8), f = b.readUInt16BE(o);
    if (p === 3 && f === 12) f12 = o; else if (p === 3 && e === 1 && f === 4) f4 = o;
  }
  const glyph = (cp) => {
    if (f12 != null) { const ng = b.readUInt32BE(f12 + 12); for (let i = 0; i < ng; i++) { const o = f12 + 16 + i * 12; const s = b.readUInt32BE(o), e = b.readUInt32BE(o + 4); if (cp >= s && cp <= e) return b.readUInt32BE(o + 8) + cp - s; } return 0; }
    const sx2 = b.readUInt16BE(f4 + 6); const end = f4 + 14, start = end + sx2 + 2, delta = start + sx2, ro = delta + sx2;
    for (let i = 0; i < sx2 / 2; i++) {
      if (cp > b.readUInt16BE(end + i * 2)) continue;
      const s = b.readUInt16BE(start + i * 2); if (cp < s) return 0;
      const d = b.readInt16BE(delta + i * 2), r = b.readUInt16BE(ro + i * 2);
      if (!r) return (cp + d) & 0xffff;
      const g = b.readUInt16BE(ro + i * 2 + r + (cp - s) * 2); return g ? (g + d) & 0xffff : 0;
    }
    return 0;
  };
  const out = {};
  for (const ch of KY) { const g = glyph(ch.codePointAt(0)); if (g) out[ch] = Math.round((adv(g) / em) * 1000); }
  out.__em = Math.round((b.readUInt16BE(bang.head + 18) / em) * 10000) / 10000;   // unitsPerEm / (winAscent + winDescent)
  return out;
}

const bangDo = Object.fromEntries(Object.entries(FONT).map(([ten, tep]) => [ten, doc(tep)]));
const ts = `// SINH TỰ ĐỘNG bởi scripts/do-be-rong-font.mjs — đừng sửa tay. Bề rộng ký tự theo phần nghìn cỡ chữ ASS (libass), đọc từ TTF.
export const BE_RONG_FONT: Record<string, Record<string, number>> = ${JSON.stringify(Object.fromEntries(Object.entries(bangDo).map(([t, d]) => [t, Object.fromEntries(Object.entries(d).filter(([c]) => c !== '__em'))])))};
/** unitsPerEm / (winAscent + winDescent): CSS font-size = cỡ ASS × số này. */
export const EM_CSS: Record<string, number> = ${JSON.stringify(Object.fromEntries(Object.entries(bangDo).map(([t, d]) => [t, d.__em])))};
`;
writeFileSync(join(goc, 'src/lib/xuong-video/be-rong-font.ts'), ts);
for (const [ten, d] of Object.entries(bangDo)) console.log(ten, Object.keys(d).length, 'ký tự · H', d.H, 'a', d.a, 'space', d[' ']);
