// BẢNG SƠ ĐỒ SHOT của một cảnh (0đ) — lõi vẽ src/lib/xuong-video/so-do-shot.ts (cùng hình với thẻ shot trên storyboard). Thay bộ vẽ Python cũ (26/10/2026).
//   Từ studio : --tap=<id> --phan-doan="Thang máy"      (sơ đồ cảnh 2D + sổ đồ vật + biểu cảm của các shot đã có)
//   Từ tệp    : --bang=scripts/so-do/<cảnh>.json         (bảng shot nháp chưa ghi vào tập — khuôn xem so-do/thang-may-356.json)
//   --noi : bảng NỐI CẮT (chỉ --tap) — mỗi cú cắt một cặp [CUỐI shot trước | ĐẦU shot sau]; shot nối động tác vẽ đầu bắt đầu quay (mũi tên cam)
//   --ra=<tệp .jpg> (bảng có chữ cho người duyệt) · --sach=<thư mục> (so-<N>.png từng khung trơn làm ảnh bố cục cho model — anh-tu-so-do.mts)
//   cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/ve-so-do.mts --bang=scripts/so-do/thang-may-356.json --ra=/tmp/so-do.jpg
import { mkdirSync, readFileSync } from 'node:fs';
import sharp from 'sharp';
import { svgSoDoShot, veShotTuCanh, type VeShot } from '../src/lib/xuong-video/so-do-shot';

const gia = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
type O = { so: number | string; ve: VeShot; giay?: number; co: string; dien?: string; thoai?: string; ke?: string };

async function tuTap(tap: number, pd: string): Promise<{ ten: string; ds: O[] }> {
  const { sql } = await import('drizzle-orm'); const { getDb } = await import('@mos2/db'); const { mapCanh, mapNhanVat } = await import('../src/lib/xuong-video/doc-db');
  const { kgCua } = await import('../src/lib/xuong-video/khong-gian'); const db = getDb()!;
  const t = ((await db.execute(sql`SELECT khong_gian, phim_id FROM xv_tap WHERE id = ${tap}`)) as unknown as { khong_gian: never; phim_id: number }[])[0]!;
  const nv = ((await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${t.phim_id}`)) as unknown as never[]).map(mapNhanVat);
  const canh = ((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tap} AND phan_doan = ${pd} AND coalesce(nhanh, '') IN ('', 'A') ORDER BY thu_tu`)) as unknown as never[]).map(mapCanh);
  if (process.argv.includes('--noi')) return { ten: `Tập ${tap} · ${pd} — nối cắt: cuối shot trước | đầu shot sau`, ds: canh.slice(0, -1).flatMap((c, i) => {
    const s2 = canh[i + 1]!; const a = veShotTuCanh(c, kgCua(t.khong_gian, c), nv, { luc: 'ket', sau: s2 }), b = veShotTuCanh(s2, kgCua(t.khong_gian, s2), nv, { luc: 'dau' });
    const noi = c.dan_dung?.noi ? ` · nối: ${c.dan_dung.noi}` : '';
    return [...(a ? [{ so: `${c.thu_tu} cuối`, ve: a, co: a.co, dien: `→ #${s2.thu_tu}${noi}` }] : []), ...(b ? [{ so: `${s2.thu_tu} đầu`, ve: b, co: b.co, dien: `← #${c.thu_tu}` }] : [])]; }) };
  return { ten: `Tập ${tap} · ${pd} — sơ đồ shot (từ studio)`, ds: canh.flatMap((c) => { const ve = veShotTuCanh(c, kgCua(t.khong_gian, c), nv); return ve ? [{ so: c.thu_tu, ve, giay: Number(c.phat_s || c.thoi_luong_s), co: ve.co, dien: (c.dan_dung?.dien ?? c.hanh_dong ?? '').split(/ (?:OBJECT STATE|BODY POSE)/)[0],   // bỏ câu trạng thái dài của prompt khỏi chú thích thoai: (c.thoai ?? []).map((x) => x.loi).filter(Boolean).join(' / ') }] : []; }) };
}
function tuBang(tep: string): { ten: string; ds: O[] } {
  type N = { ma: string; x: number; lung?: boolean; quay?: number; nhin_vao?: string; nhin_huong?: string; mat?: [string, string]; cam?: string[]; deo?: string[] };
  const b = JSON.parse(readFileSync(tep, 'utf8')) as { ten: string; vat_so?: Record<string, string>; ten_vat_vi?: Record<string, string>; nhan_vat: Record<string, { ao: string; toc?: string; ten_db?: string }>;
    shot: { so: number; giay: number; co: string; goc?: string; nguoi?: N[]; do?: { loai: string }[]; dien?: string; thoai?: string; ke?: string }[] };
  const ten = (m: string) => b.nhan_vat[m]?.ten_db ?? b.vat_so?.[m] ?? b.ten_vat_vi?.[m] ?? m;
  const mon = (k: string) => b.vat_so?.[k.split('_')[0]!] ?? b.ten_vat_vi?.[k] ?? k;
  return { ten: b.ten, ds: b.shot.map((s) => ({ so: s.so, giay: s.giay, co: s.co, dien: s.dien, thoai: s.thoai, ke: s.ke, ve: { so: s.so, co: s.co, goc: s.goc, khai: (s.do ?? []).map((o) => mon(o.loai)),
    nguoi: (s.nguoi ?? []).map((n) => ({ ten: ten(n.ma), x: n.x, lung: n.lung, quay: n.quay, mat: n.mat, ao: b.nhan_vat[n.ma]?.ao ?? '#888', toc: b.nhan_vat[n.ma]?.toc as never,
      nhin_vao: n.nhin_vao === 'phia_truoc' ? null : n.nhin_vao ? ten(n.nhin_vao) : null,
      nhin_huong: ({ trai: -1, phai: 1, len: 'len', xuong: 'xuong' } as Record<string, -1 | 1 | 'len' | 'xuong'>)[n.nhin_huong ?? ''] ?? (n.quay ? (n.quay > 0 ? 1 : -1) : 0),
      do: [...(n.deo ?? []).map((k) => ({ mon: mon(k), cam: false })), ...(n.cam ?? []).map((k) => ({ mon: mon(k), cam: true }))] })) } })) };
}

const nguon = gia('tap') ? await tuTap(Number(gia('tap')), gia('phan-doan') ?? '') : gia('bang') ? tuBang(gia('bang')!) : null;
if (!nguon) { console.error('cần --tap + --phan-doan hoặc --bang'); process.exit(1); }
const W = 360, H = 640, CH = 170, G = 12, COT = Number(gia('cot') || (process.argv.includes('--noi') ? 8 : 6));
const TEN_CO: Record<string, string> = { ws: 'Toàn', ms: 'Trung', two: 'Trung đôi', mcu: 'Trung cận', cu: 'Cận', ecu: 'Đặc tả', ots: 'Qua vai', insert: 'Cận đồ', pov: 'Chủ quan' };
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ngat = (s: string, n = 52) => { const o: string[] = []; let d = ''; for (const t of s.split(/\s+/)) { if ((d + ' ' + t).trim().length > n) { o.push(d); d = t; } else d = `${d} ${t}`.trim(); } if (d) o.push(d); return o; };

if (gia('sach')) {
  mkdirSync(gia('sach')!, { recursive: true });
  for (const o of nguon.ds) await sharp(Buffer.from(svgSoDoShot(o.ve, { sach: true }))).png().toFile(`${gia('sach')}/so-${o.so}.png`);
  console.log(gia('sach'), nguon.ds.length); process.exit(0);
}
const hang = Math.ceil(nguon.ds.length / COT), BW = COT * (W + G) + G, BH = 44 + hang * (H + CH + G) + G;
const o = nguon.ds.map((d, i) => {
  const x = G + (i % COT) * (W + G), y = 44 + Math.floor(i / COT) * (H + CH + G);
  const dong = [[`#${d.so}${d.giay ? ` · ${d.giay.toFixed(1).replace('.', ',')}s` : ''} · ${TEN_CO[d.co] ?? d.co}`, '#141414', 16], ...ngat(d.dien ?? '').map((t) => [t, '#3c3c3c', 12.5]),
    ...ngat(d.thoai ? `“${d.thoai}”` : '').map((t) => [t, '#aa1428', 12.5]), ...ngat(d.ke ? `Kể: ${d.ke}` : '').map((t) => [t, '#1e5aaa', 12.5])] as [string, string, number][];
  // mỗi khung là một <svg> lồng (cắt viền) — người tiền cảnh qua vai không tràn sang ô bên
  return `${svgSoDoShot(d.ve).replace('<svg ', `<svg x="${x}" y="${y}" `)}<g transform="translate(${x},${y})"><rect y="${H}" width="${W}" height="${CH}" fill="#fafaf8"/>`
    + dong.slice(0, 9).map(([t, m, s], j) => `<text x="8" y="${H + 20 + j * 17}" font-size="${s}" font-weight="${j ? 400 : 700}" fill="${m}" font-family="DejaVu Sans, Arial, sans-serif">${esc(t)}</text>`).join('') + '</g>';
}).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${BW}" height="${BH}"><defs><marker id="mt" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#ffd228"/></marker></defs><rect width="100%" height="100%" fill="#e1e1de"/><text x="${G}" y="28" font-size="18" font-weight="700" font-family="DejaVu Sans, Arial, sans-serif">${esc(nguon.ten)}</text>${o}</svg>`;
await sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toFile(gia('ra') ?? '/tmp/so-do.jpg'); console.log(gia('ra') ?? '/tmp/so-do.jpg', BW, BH);
process.exit(0);
