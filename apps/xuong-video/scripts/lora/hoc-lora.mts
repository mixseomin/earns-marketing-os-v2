// HỌC LoRA cho một nhân vật từ bộ ảnh học (scripts/lora/sinh-anh-hoc.mts): gom ảnh ĐẠT so mặt → zip → fal flux-lora-fast-training ($2 / lượt) →
// ghi xv_nhan_vat.lora { url, trigger, bo_hoc, so_anh, luc }. TỐN TIỀN — chỉ chạy với DUYET_SINH_1_LAN=1 sau khi anh duyệt.
//   cd apps/xuong-video && DUYET_SINH_1_LAN=1 NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/lora/hoc-lora.mts <nhan_vat_id> <url bo-hoc.json> [--trigger=xxx]
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { taoJob, xongJob } from '../../src/lib/xuong-video/doc-db';
import { guiFal, khoaFal } from '../../src/lib/xuong-video/fal';
import { uploadToR2 } from '../../src/lib/r2';

const id = Number(process.argv[2]); const boHoc = process.argv[3];
if (!id || !boHoc) { console.error('cần <nhan_vat_id> <url bo-hoc.json>'); process.exit(1); }
if (process.env.DUYET_SINH_1_LAN !== '1') { console.error('TỐN TIỀN ($2) — chỉ chạy với DUYET_SINH_1_LAN=1 sau khi anh duyệt'); process.exit(1); }
const trigger = (process.argv.find((a) => a.startsWith('--trigger=')) ?? `--trigger=nv${id}xv`).slice(10);
const bo = (await (await fetch(boHoc)).json()) as { ten: string; anh: { url: string; dat: boolean }[] };
const anh = bo.anh.filter((x) => x.dat);
if (anh.length < 10) { console.error(`chỉ ${anh.length} ảnh đạt so mặt — cần ≥ 10`); process.exit(1); }
const thu = await mkdtemp(join(tmpdir(), 'lora-'));
try {
  for (const [i, x] of anh.entries()) await writeFile(join(thu, `${String(i + 1).padStart(2, '0')}.png`), Buffer.from(await (await fetch(x.url)).arrayBuffer()));
  await promisify(execFile)('python3', ['-c', 'import sys,zipfile,glob,os;z=zipfile.ZipFile(sys.argv[1]+"/bo.zip","w");[z.write(f,os.path.basename(f)) for f in sorted(glob.glob(sys.argv[1]+"/*.png"))];z.close()', thu]);
  const zipUrl = await uploadToR2(`xuong-video/lora/${id}/bo-${Date.now()}.zip`, await readFile(join(thu, 'bo.zip')), 'application/zip');
  if (!zipUrl) throw new Error('không đẩy được zip');
  const db = getDb()!;
  const job = await taoJob(db, { nhan: `LoRA · học ${bo.ten} (${anh.length} ảnh)`, nhan_vat_id: id, loai: 'lora', provider: 'fal', model: 'fal:fal-ai/flux-lora-fast-training', request: { zip: zipUrl, trigger } });
  const g = await guiFal('fal-ai/flux-lora-fast-training', { images_data_url: zipUrl, trigger_word: trigger, create_masks: true });
  if (!g.ok) { await xongJob(db, job, { loi: g.loi }); throw new Error(g.loi); }
  const t = JSON.parse(g.taskId) as { s: string; r: string }; const h = { Authorization: `Key ${khoaFal() ?? ''}` };
  for (let i = 0; i < 360; i++) {   // tối đa 60 phút
    await new Promise((o) => setTimeout(o, 10_000));
    const st = (await (await fetch(t.s, { headers: h })).json().catch(() => ({}))) as { status?: string };
    if (i % 6 === 0) console.log(`· ${i / 6} phút: ${st.status}`);
    if (st.status !== 'COMPLETED') continue;
    const kq = (await (await fetch(t.r, { headers: h })).json()) as { diffusers_lora_file?: { url?: string }; detail?: unknown };
    const url = kq.diffusers_lora_file?.url;
    if (!url) { await xongJob(db, job, { loi: JSON.stringify(kq).slice(0, 300) }); throw new Error('fal xong mà không có tệp LoRA'); }
    // chép tệp LoRA về R2 nhà mình — đường fal.media là kho tạm, có thể hết hạn
    const r2 = await uploadToR2(`xuong-video/lora/${id}/${trigger}-${Date.now()}.safetensors`, Buffer.from(await (await fetch(url)).arrayBuffer()), 'application/octet-stream');
    await xongJob(db, job, { output_url: r2 ?? url, chi_phi_cents: 200 });
    await db.execute(sql`UPDATE xv_nhan_vat SET lora = ${JSON.stringify({ url: r2 ?? url, url_fal: url, trigger, bo_hoc: boHoc, so_anh: anh.length, luc: new Date().toISOString() })}::jsonb, updated_at = now() WHERE id = ${id}`);
    console.log(JSON.stringify({ lora: url, trigger, so_anh: anh.length })); process.exit(0);
  }
  await xongJob(db, job, { loi: `quá 60 phút — tra: ${t.r}` }); throw new Error(`quá 60 phút — tra: ${t.r}`);
} finally { await rm(thu, { recursive: true, force: true }).catch(() => {}); }
