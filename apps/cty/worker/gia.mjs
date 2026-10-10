// GIÁ MÔ HÌNH — một nguồn cho proxy (trần chi, fail-closed), số liệu quy trình, Sổ chi, chi phí lượt. Bảng: worker/gia-model.json
// (USD / 1M token [vào, ra]). Khớp tiền tố DÀI NHẤT (gpt-4o-mini thắng gpt-4o). Không có giá → null: bên gọi tự quyết (proxy chặn).
import fs from 'node:fs';
import path from 'node:path';
import { GOC } from './goc.mjs';

const GIA = JSON.parse(fs.readFileSync(path.join(GOC, 'worker', 'gia-model.json'), 'utf8'));
export function giaCua(model) {
  const ten = String(model).includes(':') ? String(model).split(':')[1] : String(model);
  const k = Object.keys(GIA).filter((x) => x !== '_' && ten.startsWith(x)).sort((a, b) => b.length - a.length)[0];
  return k ? GIA[k] : null;
}
/** USD của một lượt gọi; không có giá → null. */
export const tienUsd = (model, u) => { const g = giaCua(model); return g && u ? ((u.input_tokens || 0) * g[0] + (u.output_tokens || 0) * g[1]) / 1e6 : null; };

if ((process.argv[1] || '').endsWith('gia.mjs') && process.argv.includes('--tu-kiem')) {
  const a = (c, m) => { if (!c) { console.error('✗ gia:', m); process.exit(1); } };
  a(giaCua('openai:gpt-4o-mini')[0] === 0.15 && giaCua('openai:gpt-4o')[0] === 2.5, 'tiền tố dài nhất (4o-mini ≠ 4o)');
  a(giaCua('claude:sonnet') === null && tienUsd('x:y', { input_tokens: 1 }) === null, 'không có giá → null');
  a(Math.abs(tienUsd('openai:gpt-4.1-nano', { input_tokens: 1e6, output_tokens: 1e6 }) - 0.5) < 1e-12, 'tính tiền');
  console.log('✓ gia: 3 ca'); process.exit(0);
}
