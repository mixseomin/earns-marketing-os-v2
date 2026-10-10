// Một parser frontmatter cho cả app (src/lib/cong-ty.ts) lẫn script (tu-kiem, seed-van-phong) — trước có ba bản chép tay,
// hai bản dính cùng một lỗi (`\s*` sau dấu `:` nuốt newline, giá trị rỗng kéo dòng sau vào). Giá trị: [a, b] → mảng ·
// true/false → boolean · số → number · còn lại chuỗi (bỏ nháy bao). `node scripts/fm.mjs --tu-kiem` = kiểm 5 ca, exit 1 khi lệch.
export function parseFm(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { fm: {}, body: raw };
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([a-zA-Z_][\w-]*):[ \t]*(.*)$/);
    if (!kv) continue;
    const k = kv[1]; const v = kv[2].trim();
    if (v.startsWith('[') && v.endsWith(']')) { fm[k] = v.slice(1, -1).split(',').map((x) => x.trim().replace(/^["']|["']$/g, '')).filter(Boolean); continue; }
    if (v === 'true' || v === 'false') { fm[k] = v === 'true'; continue; }
    if (/^-?\d+(\.\d+)?$/.test(v)) { fm[k] = Number(v); continue; }
    fm[k] = v.replace(/^["']|["']$/g, '');
  }
  return { fm, body: m[2] };
}

if (process.argv.includes('--tu-kiem') && (process.argv[1] || '').endsWith('fm.mjs')) {
  const assert = (c, msg) => { if (!c) { console.error('✗ fm.mjs:', msg); process.exit(1); } };
  const r = parseFm('---\nten: Lan\nbao_cao_cho: \nkind: ai\nskills: [a, b]\nmuc: 2\nok: true\n---\n# Thân\n');
  assert(r.fm.ten === 'Lan', 'chuỗi');
  assert(r.fm.bao_cao_cho === '' && r.fm.kind === 'ai', 'giá trị rỗng không được nuốt dòng sau');
  assert(Array.isArray(r.fm.skills) && r.fm.skills.length === 2 && r.fm.skills[1] === 'b', 'mảng');
  assert(r.fm.muc === 2 && r.fm.ok === true, 'số / boolean');
  assert(r.body.startsWith('# Thân'), 'body');
  const n = parseFm('không có frontmatter');
  assert(Object.keys(n.fm).length === 0 && n.body === 'không có frontmatter', 'không frontmatter');
  console.log('✓ fm.mjs: 5 ca đạt');
}
