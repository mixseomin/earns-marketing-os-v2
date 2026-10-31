// 📋 PHÂN RÃ KỊCH BẢN từ box — MỘT lõi với nút trên tab 📖 Phim (src/lib/xuong-video/phan-ra.ts). Chạy:
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server \
//     ../../node_modules/.bin/tsx scripts/phan-ra.mts --phim=<id> [--tap=<id>] [--ep] [--bao-cao]
//   mặc định : phân rã các tập CHƯA / CŨ (tập có chữ không đổi bỏ qua 0đ), TUẦN TỰ (tập sau thấy món tập trước vừa tạo), rồi in báo cáo chuẩn bị
//   --bao-cao: chỉ in báo cáo (0đ) · --tap=<id>: chỉ một tập · --ep: chạy lại dù chữ tập không đổi
//   --sinh-anh: sau phân rã, xếp sinh hết ảnh thiếu (ảnh gốc anchor → ảnh mẫu biến thể; một lõi với nút 🖼 — phan-ra.ts › sinhAnhThieuDb)
// TỐN TIỀN ~200₫ / tập (1 lượt chữ, chuỗi rẻ trước). chot-tien: cộng dồn dưới ngưỡng tự chạy thì chạy; vượt → cần DUYET_SINH_1_LAN=1 ngay sau khi anh duyệt.
import { getDb } from '@mos2/db';
import { phanRaTapDb, baoCaoChuanBiDb, sinhAnhThieuDb } from '../src/lib/xuong-video/phan-ra';

const gia = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const co = (k: string) => process.argv.includes(`--${k}`);
const phimId = Number(gia('phim') || 0);
if (!phimId) { console.error('cần --phim=<id>'); process.exit(1); }
const db = getDb()!;
const dong = (v: number) => `${Math.round(v).toLocaleString('vi-VN')}₫`;

if (!co('bao-cao')) {
  const bc = await baoCaoChuanBiDb(db, phimId);
  if (!bc) { console.error(`không thấy phim ${phimId}`); process.exit(1); }
  const tapId = Number(gia('tap') || 0);
  const ds = bc.tap.filter((t) => (tapId ? t.id === tapId : co('ep') ? t.trang_thai !== 'trong' : t.trang_thai === 'chua' || t.trang_thai === 'cu'));
  if (!ds.length) console.log('Không tập nào cần phân rã (mọi tập có shot đã phân rã và chữ không đổi).');
  let tong = 0;
  for (const t of ds) {
    console.log(`\n→ tập ${t.so} · ${t.ten} (${t.so_shot} shot, ước ~${dong(bc.uoc[t.id]?.vnd ?? 0)})`);
    const r = await phanRaTapDb(db, t.id, { ep: co('ep') || !!tapId, nguoi: 'script phan-ra' });
    if (!r.ok) { console.log(`  ✗ ${r.loi}`); continue; }
    if (r.data.boQua) { console.log('  · bỏ qua — chữ tập không đổi từ lần trước (0đ)'); continue; }
    tong += r.data.vnd ?? 0;
    console.log(`  ✓ tạo ${r.data.moi} món mới · thêm tập cho ${r.data.themTap} món · gắn lại ${r.data.shotDoi} shot${r.data.vnd != null ? ` · tiền thật ${dong(r.data.vnd)}` : ''}`);
    for (const g of r.data.ghiChu) console.log(`    📝 ${g}`);
    for (const k of r.data.khongKhop) console.log(`    ⚠ ${k}`);
  }
  if (tong) console.log(`\nTổng tiền thật phân rã lượt này: ${dong(tong)}`);
}

if (co('sinh-anh')) {
  const r = await sinhAnhThieuDb(db, phimId);
  if (!r.ok) console.log(`\n✗ sinh ảnh thiếu: ${r.loi}`);
  else {
    console.log(`\n🖼 Đã xếp sinh ${r.data.goc} ảnh gốc + ${r.data.bienThe} ảnh mẫu biến thể (chạy nền)`);
    for (const c of r.data.cho) console.log(`  ⏳ chờ ảnh gốc của cha: ${c}`);
    for (const l of r.data.loi) console.log(`  ✗ ${l}`);
  }
}

const bc = await baoCaoChuanBiDb(db, phimId);
if (bc) {
  console.log(`\n=== BÁO CÁO CHUẨN BỊ phim #${phimId} ===`);
  console.log(`${bc.tong.tap} tập · chưa phân rã ${bc.tong.tap_chua} · cũ ${bc.tong.tap_cu} | cần ${bc.tong.can} món · đủ ${bc.tong.du} · THIẾU ${bc.tong.thieu}`);
  for (const t of bc.tap) console.log(`  tập ${t.so} · ${t.ten}: ${t.trang_thai} · ${t.so_shot} shot · cần ${t.can} · thiếu ${t.thieu}`);
  if (bc.thieu.length) {
    console.log('\nMÓN THIẾU (shot đang dùng mà chưa đủ):');
    for (const m of bc.thieu.slice(0, 60)) console.log(`  · ${m.loai === 'bien_the' ? `${m.cua} · ${m.ten} [${m.nhom}]` : `${m.ten} [${m.nhom}]`} — ${m.ly_do} · tập ${m.tap.join(',')} · ${m.so_shot} shot`);
    if (bc.thieu.length > 60) console.log(`  … và ${bc.thieu.length - 60} món nữa`);
  }
}
process.exit(0);
