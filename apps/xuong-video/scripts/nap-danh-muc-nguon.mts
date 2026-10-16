// Nạp DANH MỤC model của các nguồn vào Sổ nguồn AI (xv_nguon_model, nguon-ai.ts) — 0đ, chỉ đọc trang / API danh mục công khai của nguồn.
// Anh 16/10/2026: "sao ít mô hình video thế" → sổ chỉ có 15 dòng nhập tay trong khi fal bán 329 model video, ShopAIKey 23, APIMaster 7.
//   fal       : danhMucFal() (fal.ts, đọc hết các trang) — giá từ chuỗi giá của fal, link = trang model trên fal.ai
//   ShopAIKey : https://shopaikey.com/models (dữ liệu nhúng: name, price credit/lượt) — $1 credit = 3.250₫ tiền nạp thật
//   APIMaster : https://apimaster.ai/api/pricing (model_price; video tính theo giây — đo 15/10/2026, scripts/du-lieu/cong-api/README.md)
// Luật giá (CHECK trong 0263): có giá thì phải có link trang chứa giá. Không quy được về đơn vị chuẩn (clip không ghi số giây, chuỗi giá lạ)
// thì vẫn ghi model + link, để trống giá — không đoán. Dòng đã có (khớp ma_job) chỉ cập nhật giá / link / ngày đọc, giữ nguyên khớp nội dung + tật.
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/nap-danh-muc-nguon.mts [--xem]
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { danhMucFal } from '../src/lib/xuong-video/fal';

const XEM = process.argv.includes('--xem');
const VND_MOI_CENT = 260;          // 26.000₫ ≈ $1
const VND_MOI_CREDIT_SAK = 3250;   // ShopAIKey: $1 credit = 3.250₫ tiền nạp
const GIAY_CHUAN = 8;              // đơn vị chuẩn video: 1 clip 8s 720p không tiếng
type Dong = { nguon: string; loai: 'video' | 'anh'; model: string; gia: number | null; goc: string; link: string; ma: string[] };
const lay = async (u: string) => (await fetch(u, { headers: { 'user-agent': 'Mozilla/5.0', accept: 'application/json,text/html' }, signal: AbortSignal.timeout(40_000) })).text();
const LA_VIDEO = /video|veo|vidu|kling|sora|seedance|hailuo|wan-?\d|pika|runway|ltx|hunyuan/i;
const LA_ANH = /image|banana|flux|seedream|imagen|recraft|ideogram/i;

const ds: Dong[] = [];
// ── fal ──
for (const m of await danhMucFal()) {
  const link = `https://fal.ai/models/${m.id}`;
  const giay = m.gia.khongTieng['720p'] ?? m.gia.chinh['720p'];
  const gia = m.loai === 'video' ? (giay != null ? Math.round(giay * GIAY_CHUAN * VND_MOI_CENT) : null) : (m.gia.anh?.[0] != null ? Math.round(m.gia.anh[0] * VND_MOI_CENT) : null);
  // Giá gốc một dòng: bỏ dòng tiêu đề của bản tóm tắt giá (gia-fal.ts › tomGia.moTa), nối các mức bằng ' · '.
  const goc = (m.giaText || '').split('\n').slice(1).map((x) => x.replace(/^[•\s]+/, '').trim()).filter(Boolean).join(' · ') || 'fal chưa công bố giá';
  ds.push({ nguon: 'fal', loai: m.loai, model: m.ten, gia, goc, link, ma: [`fal|fal:${m.id}`] });
}
// ── ShopAIKey ── (một model có thể có nhiều kênh giá khác nhau → lấy kênh rẻ nhất)
{
  const s = (await lay('https://shopaikey.com/models')).replace(/\\"/g, '"');
  const re = /\{"name":"([^"]+)","input":[^,]*,"completion":[^,]*,"price":([0-9.]+)/g;
  const re2 = new Map<string, number>();
  for (const m of s.matchAll(re)) { const p = Number(m[2]); if (Number.isFinite(p) && p > 0) re2.set(m[1]!, Math.min(re2.get(m[1]!) ?? Infinity, p)); }
  for (const [ten, p] of re2) {
    const loai = LA_VIDEO.test(ten) ? 'video' : LA_ANH.test(ten) ? 'anh' : null;
    if (!loai) continue;
    const giayClip = Number(ten.match(/(\d+)s\b/)?.[1] ?? NaN);
    const gia = loai === 'anh' ? Math.round(p * VND_MOI_CREDIT_SAK) : Number.isFinite(giayClip) ? Math.round((p * VND_MOI_CREDIT_SAK / giayClip) * GIAY_CHUAN) : null;
    ds.push({ nguon: 'shopaikey', loai, model: ten, gia, goc: `${Math.round(p * 1000) / 1000} credit / lượt${loai === 'video' ? (Number.isFinite(giayClip) ? ` (clip ${giayClip}s)` : ' — tên không ghi số giây, chưa quy được') : ''}`, link: 'https://shopaikey.com/models', ma: [`shopaikey|${ten}`, `shopaikey|shopaikey:${ten}`] });
  }
}
// ── APIMaster ──
{
  const j = JSON.parse(await lay('https://apimaster.ai/api/pricing')) as { data?: { model_name: string; model_price?: number }[] };
  for (const x of j.data ?? []) {
    const loai = LA_VIDEO.test(x.model_name) ? 'video' : LA_ANH.test(x.model_name) ? 'anh' : null;
    if (!loai || !x.model_price) continue;
    const gia = loai === 'video' ? Math.round(x.model_price * GIAY_CHUAN * 26000) : Math.round(x.model_price * 26000);
    ds.push({ nguon: 'apimaster', loai, model: x.model_name, gia, goc: `model_price ${x.model_price}${loai === 'video' ? ' (theo giây)' : ' / ảnh'}`, link: 'https://apimaster.ai/api/pricing', ma: [] });
  }
}

// Tên trùng trong cùng nguồn + loại (fal có nhiều bản cùng tiêu đề) → thêm mã model cho khác nhau.
const dem = new Map<string, number>();
for (const d of ds) dem.set(`${d.nguon}|${d.loai}|${d.model}`, (dem.get(`${d.nguon}|${d.loai}|${d.model}`) ?? 0) + 1);
for (const d of ds) if ((dem.get(`${d.nguon}|${d.loai}|${d.model}`) ?? 0) > 1) d.model = `${d.model} · ${(d.ma[0] ?? d.link).split('/').slice(-2).join('/')}`;

const tk = (k: string) => ds.filter((d) => d.nguon === k);
console.log(`đọc được: fal ${tk('fal').length} (video ${tk('fal').filter((d) => d.loai === 'video').length}) · ShopAIKey ${tk('shopaikey').length} · APIMaster ${tk('apimaster').length} · có giá ${ds.filter((d) => d.gia != null).length}/${ds.length}`);
if (XEM) { for (const d of ds.slice(0, 15)) console.log(d.nguon, d.loai, d.model, d.gia, '|', d.goc.slice(0, 60)); process.exit(0); }

const db = getDb()!;
const cu = (await db.execute(sql`SELECT id, nguon_key, ma_job FROM xv_nguon_model`)) as unknown as { id: number; nguon_key: string; ma_job: string[] }[];
const theoMa = new Map<string, number>();
for (const r of cu) for (const m of r.ma_job ?? []) theoMa.set(m, Number(r.id));
let capNhat = 0, them = 0;
for (const d of ds) {
  const id = d.ma.map((m) => theoMa.get(m)).find((x) => x != null);
  if (id != null) {
    await db.execute(sql`UPDATE xv_nguon_model SET gia_vnd = ${d.gia}, gia_goc = ${d.goc}, link = ${d.link}, ngay_doc = now()::date, updated_at = now() WHERE id = ${id}`);
    capNhat++;
  } else {
    const r = (await db.execute(sql`INSERT INTO xv_nguon_model (nguon_key, loai, model, gia_vnd, gia_goc, link, ngay_doc, ma_job) VALUES (${d.nguon}, ${d.loai}, ${d.model}, ${d.gia}, ${d.goc}, ${d.link}, now()::date, ${`{${d.ma.map((m) => `"${m.replace(/"/g, '')}"`).join(',')}}`}::text[])
      ON CONFLICT (nguon_key, loai, model, goi) DO UPDATE SET gia_vnd = EXCLUDED.gia_vnd, gia_goc = EXCLUDED.gia_goc, link = EXCLUDED.link, ngay_doc = EXCLUDED.ngay_doc, updated_at = now() RETURNING (xmax = 0) AS moi`)) as unknown as { moi: boolean }[];
    if (r[0]?.moi) them++; else capNhat++;
  }
}
console.log(`ghi sổ: thêm ${them} · cập nhật ${capNhat}`);
process.exit(0);
