// Kho tài sản từ box (0đ) — thay cho script tạm viết tay mỗi lần cần "lấy nhạc/clip từ kho" (đã viết .tam-*.mts hai lần, 10/10/2026).
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/kho.mts --ds [--loai=nhac] [--q=jett]
//     … scripts/kho.mts --dung=<id tài sản> --tap=<id> | --canh=<id>     (có ↶ Hoàn tác trên studio)
import { getDb } from '@mos2/db';
import { dsKho, dungTaiSan } from '../src/lib/xuong-video/kho';
import { tien, type LoaiTaiSan } from '../src/lib/xuong-video/kieu';

const lay = (k: string) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? '').slice(k.length + 3);
const db = getDb(); if (!db) { console.error('không có DATABASE_URL'); process.exit(1); }
if (process.argv.includes('--ds')) {
  const ds = await dsKho(db, { loai: lay('loai') ? [lay('loai') as LoaiTaiSan] : undefined, q: lay('q') || undefined });
  for (const t of ds) console.log(`#${t.id} · ${t.loai} · ${t.thuong_hieu} · ${t.ten} · ${tien(t.chi_phi_cents)} · dùng ${t.so_lan_dung}${t.url ? ` · ${t.url}` : ''}`);
  process.exit(0);
}
const id = Number(lay('dung'));
if (!id) { console.error('cách dùng: --ds [--loai= --q=] | --dung=<id> --tap=<id>|--canh=<id>'); process.exit(1); }
const r = await dungTaiSan(db, id, { tapId: Number(lay('tap')) || undefined, canhId: Number(lay('canh')) || undefined }, 'script kho');
console.log(r.ok ? `đã dùng tài sản #${id}` : `✗ ${r.loi}`);
process.exit(r.ok ? 0 : 1);
