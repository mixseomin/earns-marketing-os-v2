// HIỆU CHỈNH BƯỚC HỎI KHUNG (soi-cau-hoi.ts): chạy câu hỏi kiểm khung trên BỘ MẪU đã dán nhãn (scripts/du-lieu/hieu-chinh-hoi-<phim>.json) → tỉ lệ
// BÁO NHẦM (khung đúng mà trả "không") và BỎ SÓT (khung sai mà trả "có") theo từng MÃ câu (co / vang / ngoai / ket / mo / dang / vat / mat / lung).
// Kết quả quyết câu nào được CHẶN (báo nhầm thấp) và câu nào chỉ cảnh báo (soat-huong.mts › laChan). Tốn ~0,3¢ / khung — chạy khi anh duyệt.
//   … tsx scripts/hieu-chinh-hoi.mts <tap_id> scripts/du-lieu/hieu-chinh-hoi-353.json [--clip-dat=1,2,3,…]
import { existsSync, readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { hoiKhung } from '../src/lib/xuong-video/soi-cau-hoi';
import { cauHoiKhung, loiTuDapAn, type CauHoi } from '../src/lib/xuong-video/cau-hoi-khung';
import { mapCanh, mapNhanVat, type Row } from '../src/lib/xuong-video/doc-db';
import { kgCua, type KhongGianTap } from '../src/lib/xuong-video/khong-gian';

const tap = Number(process.argv[2]); const tep = process.argv[3]; if (!tap || !tep) { console.error('cần <tap_id> <bộ mẫu.json>'); process.exit(1); }
const clipDat = (process.argv.find((a) => a.startsWith('--clip-dat='))?.slice(11) ?? '').split(',').map(Number).filter(Boolean);
const db = getDb()!;
const kgt = (((await db.execute(sql`SELECT khong_gian FROM xv_tap WHERE id = ${tap}`)) as unknown as Row[])[0]?.khong_gian ?? null) as KhongGianTap | null;
const phimId = Number((((await db.execute(sql`SELECT phim_id FROM xv_tap WHERE id = ${tap}`)) as unknown as Row[])[0]?.phim_id) ?? 0) || null;
const nvs = ((await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${phimId}`)) as unknown as Row[]).map(mapNhanVat);
const ds = ((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tap} ORDER BY thu_tu`)) as unknown as Row[]).map(mapCanh);
type Mau = { canh: number; luc: 'dau' | 'ket'; url: string; dung?: boolean; sai?: string[]; ghi?: string };
const bo = JSON.parse(readFileSync(tep, 'utf8')) as { mau: Mau[] };
const mau: Mau[] = [...bo.mau];
for (const so of clipDat) { const c = ds.find((x) => x.thu_tu === so); if (!c) continue; for (const [l, luc] of [['clip_dau', 'dau'], ['clip_ket', 'ket']] as const) { const f = `/tmp/soat-noi-${tap}/${c.id}-${l}.jpg`; if (existsSync(f)) mau.push({ canh: c.id, luc, url: f, dung: true, ghi: `clip #${so} ${luc}` }); } }
type Dem = { hoi: number; nham: number; sot: number; dung: number };
const bang = new Map<string, Dem>(); const dem = (ma: string) => bang.get(ma) ?? bang.set(ma, { hoi: 0, nham: 0, sot: 0, dung: 0 }).get(ma)!;
const nhom = (ma: string) => ma.split(':')[0]!;
let i = 0; const chay = async () => { while (i < mau.length) { const m = mau[i++]!; const c = ds.find((x) => x.id === m.canh); if (!c) continue;
  const toan = ['ws', 'ews'].includes(c.ky_thuat?.co_canh ?? '');
  const hoi: CauHoi[] = cauHoiKhung({ canh: { ...c, khung_xam: null, may_3d: null } as never, nhanVat: nvs, kg: kgCua(kgt, c), luc: m.luc }).filter((x) => (toan ? /^(co|vang|ngoai):|^(mo|ket)$/ : /^(co|dang|vat|vang|ngoai|chen|lung|mat):|^(mo|ket)$/).test(x.ma));
  const dap = await hoiKhung(db, phimId, m.url, hoi).catch(() => null); if (!dap) { console.log(`  ! ${m.ghi ?? m.url}: không hỏi được`); continue; }
  const loi = new Set(loiTuDapAn(hoi, dap).map((x) => /^\[([^\]]+)\]/.exec(x.mo_ta)?.[1] ?? ''));
  const mong = new Set(m.sai ?? []);
  for (const q of hoi) { const d = dem(nhom(q.ma)); d.hoi++; const baoLoi = loi.has(q.ma), phaiLoi = mong.has(q.ma);
    if (baoLoi && !phaiLoi) { d.nham++; console.log(`  báo nhầm [${q.ma}] ${m.ghi ?? ''}: ${q.hoi}`); } else if (!baoLoi && phaiLoi) { d.sot++; console.log(`  BỎ SÓT [${q.ma}] ${m.ghi ?? ''}`); } else d.dung++; } } };
await Promise.all(Array.from({ length: 6 }, chay));
console.log(`\n${mau.length} khung · theo mã câu:`);
for (const [ma, d] of [...bang].sort()) console.log(`  ${ma.padEnd(6)} hỏi ${String(d.hoi).padStart(3)} · đúng ${String(d.dung).padStart(3)} · báo nhầm ${d.nham} (${Math.round((d.nham / Math.max(1, d.hoi)) * 100)}%) · bỏ sót ${d.sot}${d.nham / Math.max(1, d.hoi) <= 0.05 ? '  → đủ tin để CHẶN' : '  → chỉ cảnh báo'}`);
process.exit(0);
