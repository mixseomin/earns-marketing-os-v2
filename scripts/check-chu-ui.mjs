#!/usr/bin/env node
// LUẬT CHỮ CHO NGƯỜI DÙNG (anh 25/10/2026: "khi thiết kế cho người dùng thì phải dùng ngôn ngữ dễ đọc, trình bày dễ hiểu… sửa vào code thành luật").
// Ca thật: cây camp etp.on.tc hiện chữ rê chuột "đoạn 82923:693-758 đang chạy ở 12 camp — trần 3 camp / đoạn" và
// "…đã xếp hàng cắt góc mới (ethopex_can_goc_moi)" — mã nội bộ, khoá DB, câu máy ghi lọt thẳng ra màn hình.
// Quét chữ HIỂN THỊ (thuộc tính title / aria-label / placeholder và chữ giữa thẻ JSX) trong các tệp giao diện, chặn:
//   - khoá kiểu snake_case (ethopex_can_goc_moi, xv_khoa_ngoai, so_ngay) — tên bảng / khoá nội bộ
//   - mã đoạn kiểu 82923:693-758 (content:từ-đến)
//   - tên bảng có schema (etp.camp, etp.phim_bao_hoa)
// Biểu thức ${…} trong chuỗi bị bỏ qua (đó là mã, không phải chữ). Chữ đến từ DB thì dịch tại nguồn hoặc qua hàm lời thường (vd loiThuong).
// Cho phép từng dòng: thêm chú thích `chu-ui-ok` trên cùng dòng. Chạy: node scripts/check-chu-ui.mjs [tệp…] — deploy.sh chạy trước build.
import fs from 'node:fs';
import path from 'node:path';

const GOC = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
// Tệp giao diện thuộc luật — thêm tệp mới vào đây khi dựng màn mới cho người dùng (mặc định: mọi màn etp / ethopex + extension)
const MAC_DINH = [
  'apps/web/src/components/etp-view.tsx',
  'apps/web/src/components/ethopex-view.tsx',
  'apps/web/src/components/cot-am-duong.tsx',
  'apps/ethopex-ext/ly-do.js',
];
const tep = process.argv.slice(2).filter((x) => !x.startsWith('--')).length ? process.argv.slice(2).filter((x) => !x.startsWith('--')) : MAC_DINH;
// TỰ KIỂM (--tu-kiem): đúng các câu anh chỉ ra 25/10/2026 phải bị chặn; câu lời thường phải qua
if (process.argv.includes('--tu-kiem')) {
  const tam = path.join(GOC, 'scripts', '.chu-ui-tu-kiem.tsx');
  fs.writeFileSync(tam, [
    "<span title={`đoạn ${c.doan} đang chạy`}>x</span>",
    "<span title=\"…đã xếp hàng cắt góc mới (ethopex_can_goc_moi)\">x</span>",
    "<span title=\"đoạn 82923:693-758 đang chạy ở 12 camp\">x</span>",
    "<h3>Rào chắn (etp.cau_hinh)</h3>",
    "<span title={`${c.cung_doan} camp đang dùng cùng đoạn video này — nên tối đa 3`}>x</span>",
    "<span>{c.camp_id} lãi</span>",
  ].join('\n'));
  const { execFileSync } = await import('node:child_process');
  let ra = ''; try { ra = execFileSync('node', [new URL(import.meta.url).pathname, path.relative(GOC, tam)], { encoding: 'utf8' }); } catch (e) { ra = String(e.stdout); }
  fs.rmSync(tam);
  const bat = (ra.match(/✗/g) || []).length;
  console.log(ra.trim()); console.log(bat === 3 ? 'tự kiểm: 3/3 câu mã nội bộ bị chặn, câu lời thường qua ✓' : `tự kiểm HỎNG: chặn ${bat} (cần đúng 3)`); process.exit(bat === 3 ? 0 : 1);
}

const LUAT = [
  [/\b[a-z]{2,}_[a-z]{2,}(?:_[a-z0-9]+)*\b/, 'khoá nội bộ snake_case'],
  [/\b\d{4,}:\d+-\d+\b/, 'mã đoạn content:từ-đến'],
  [/\betp\.[a-z_]+\b|\bxv_[a-z_]+\b/, 'tên bảng DB'],
];
// bỏ phần ${…} (mã) ra khỏi chuỗi trước khi soi
const boMa = (s) => { let o = '', sau = 0; for (let i = 0; i < s.length; i++) { if (s[i] === '$' && s[i + 1] === '{') { sau++; i++; continue; } if (sau && s[i] === '{') sau++; else if (sau && s[i] === '}') { sau--; continue; } if (!sau) o += s[i]; } return o; };

let loi = 0;
for (const t of tep) {
  const f = path.join(GOC, t);
  if (!fs.existsSync(f)) continue;
  const dong = fs.readFileSync(f, 'utf8').split('\n');
  dong.forEach((l, i) => {
    if (/chu-ui-ok/.test(l) || /^\s*(\/\/|\*|\/\*)/.test(l)) return;
    const chu = [];
    // thuộc tính hiển thị: title="…" title={`…`} title={'…'} aria-label / placeholder / searchPlaceholder
    for (const m of l.matchAll(/(?:title|aria-label|placeholder|searchPlaceholder|label)=(?:"([^"]*)"|\{`([^`]*)`\}|\{'([^']*)'\}|\{"([^"]*)"\})/g)) chu.push(m[1] ?? m[2] ?? m[3] ?? m[4] ?? '');
    // chữ giữa thẻ JSX: >chữ<  (không chứa { })
    for (const m of l.matchAll(/>([^<>{}]*[A-Za-zÀ-ỹ][^<>{}]*)</g)) chu.push(m[1]);
    // extension (chuỗi HTML dựng tay): title="…" bên trong chuỗi '…'
    if (t.endsWith('.js')) for (const m of l.matchAll(/title="' \+ esc\(([^)]*)\)/g)) chu.push(m[1].replace(/'[^']*'/g, (x) => x));
    for (const c of chu) {
      // chuỗi ghép tay (extension): chỉ lấy phần trong dấu nháy; còn lại bỏ truy cập thuộc tính x.y_z (tên biến, không hiện ra)
      let s = /' \+ |\+ '/.test(c) ? [...c.matchAll(/'([^']*)'/g)].map((m) => m[1]).join(' ') : boMa(c);
      if (/=>|===|!==|&&|;\s*(const|let|return)\b/.test(s)) continue;
      const bang = s.match(/\b(?:etp|public)\.[a-z_]+\b|\bxv_[a-z_]+\b/);   // tên bảng DB — soi trước khi bỏ truy cập thuộc tính
      if (bang) { loi++; console.log(`  ✗ ${t}:${i + 1}  tên bảng DB: «${bang[0]}»  trong «${s.trim().slice(0, 90)}»`); continue; }
      s = s.replace(/(?:\?\.|\.)[a-z_][a-z0-9_]*/gi, ' ');
      for (const [re, ten] of LUAT) {
        const m = s.match(re);
        if (m) { loi++; console.log(`  ✗ ${t}:${i + 1}  ${ten}: «${m[0]}»  trong «${s.trim().slice(0, 90)}»`); break; }
      }
    }
  });
}
if (loi) { console.log(`\n${loi} chỗ chữ cho người dùng còn mã nội bộ — viết lại bằng lời thường (vd "12 camp đang dùng cùng đoạn video này — nên tối đa 3"), hoặc dịch qua hàm lời thường. Luật: scripts/check-chu-ui.mjs`); process.exit(1); }
console.log(`chữ giao diện sạch mã nội bộ ✓ (${tep.length} tệp)`);
