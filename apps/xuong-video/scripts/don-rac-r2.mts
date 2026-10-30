// (0đ) MÁY DỌN RÁC R2 của studio — luật ở src/lib/xuong-video/don-rac.ts. Chạy trên box3 (cần sudo postgres để quét MỌI DB).
// Phòng Tài nguyên (apps/cty/worker/tai-nguyen.mjs) gọi `--chay` mỗi đêm sau 03:00 giờ VN; kết quả vào báo cáo 08:00.
//   cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/don-rac-r2.mts [--chay] [--json]
//     (mặc định chạy thử: chỉ đếm)
//   … scripts/don-rac-r2.mts --tra <khoá-trong-thùng-rác | khoá gốc>     trả một tệp từ thùng rác về chỗ cũ
// In dòng cuối là JSON kết quả.
import { execFileSync } from 'node:child_process';
import { listR2, copyR2, deleteFromR2 } from '../src/lib/r2';
import { chonRac, khoThamChieu, khoaRac, khoaTuRac, GOC, RAC } from '../src/lib/xuong-video/don-rac';

const chay = process.argv.includes('--chay');
const ngay = new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10);   // ngày VN
const theoLo = async <T,>(ds: T[], n: number, f: (x: T) => Promise<void>) => { for (let i = 0; i < ds.length; i += n) await Promise.all(ds.slice(i, i + n).map(f)); };

const tra = process.argv[process.argv.indexOf('--tra') + 1];
if (process.argv.includes('--tra')) {
  if (!tra) { console.error('thiếu khoá'); process.exit(1); }
  const trongRac = tra.startsWith(RAC) ? [tra] : (await listR2(RAC)).map((x) => x.key).filter((k) => khoaTuRac(k) === tra);
  if (!trongRac.length) { console.error(`không thấy ${tra} trong thùng rác`); process.exit(1); }
  const k = trongRac.sort().pop()!, ve = khoaTuRac(k)!;
  const ok = (await copyR2(k, ve)) && (await deleteFromR2(k));
  console.log(JSON.stringify({ tra: ve, ok })); process.exit(ok ? 0 : 1);
}

// Kho tham chiếu: mọi chuỗi xuong-video/… trong MỌI DB của box3 + tệp /opt, /var/lib (bỏ node_modules / .git / .next) — ~3 phút
const RE = `xuong-video/[^[:space:]"'<>\\(),]+`;
// biểu thức đi qua biến môi trường RE (có dấu nháy đơn bên trong, nhét thẳng vào lệnh sh là vỡ cú pháp)
const sh = (c: string) => execFileSync('sh', ['-c', c], { encoding: 'utf8', maxBuffer: 512e6, timeout: 15 * 6e4, env: { ...process.env, RE } });
const chuoi = [
  ...sh(`sudo -u postgres pg_dumpall -a 2>/dev/null | grep -aoE "$RE" | sort -u`).split('\n'),
  ...sh(`grep -rIaohE --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next --exclude-dir=.cache "$RE" /opt /var/lib/cty /var/lib/spy 2>/dev/null | sort -u || true`).split('\n'),
];
const ref = khoThamChieu(chuoi);
const ds = await listR2(GOC);
const kq = chonRac(ds, ref, Date.now());

let chuyen = 0, chuyenMb = 0, xoa = 0, xoaMb = 0, loi = 0;
if (chay && !kq.dung) {
  await theoLo(kq.rac, 8, async (t) => { if ((await copyR2(t.key, khoaRac(t.key, ngay))) && (await deleteFromR2(t.key))) { chuyen++; chuyenMb += t.size / 1e6; } else loi++; });
  await theoLo(kq.xoaHan, 8, async (t) => { if (await deleteFromR2(t.key)) { xoa++; xoaMb += t.size / 1e6; } else loi++; });
}
const racMb = (k: string) => Math.round(ds.filter((t) => t.key.startsWith(k)).reduce((a, t) => a + t.size, 0) / 1e6);
console.log(JSON.stringify({
  ngay, chay, quet: kq.quet, cu: kq.cu, tham_chieu: ref.khoa.size, dung: kq.dung,
  [chay ? 'da_chuyen_rac' : 'se_chuyen_rac']: chay ? chuyen : kq.rac.length, rac_mb: kq.tongRacMb, con_lai: kq.conLai,
  [chay ? 'da_xoa_han' : 'se_xoa_han']: chay ? xoa : kq.xoaHan.length, xoa_han_mb: Math.round(kq.xoaHan.reduce((a, t) => a + t.size, 0) / 1e6),
  thung_rac_mb: Math.round(racMb(RAC) + chuyenMb - xoaMb), loi, theo_thu_muc: Object.fromEntries(Object.entries(kq.theoThuMuc).map(([k, v]) => [k, { n: v.n, mb: Math.round(v.mb) }])),
}));
process.exit(0);
