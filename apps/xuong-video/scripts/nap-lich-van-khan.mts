// NẠP LỊCH VĂN KHẤN — chạy TRONG box3, đọc mã đã lên qua GHA (/opt/earns-marketing-os-v2).
// Thay đường cũ: nap-may.sh trên iMac tính lịch rồi rsync mp4 + scp nap-may.mts sang box3 → mã không có trong git,
// deploy sau đó xoá mất. Giờ lõi âm lịch + dữ liệu + ảnh + loader đều nằm trong repo, không chép gì từ Mac.
//   ssh root@167.233.241.16 'cd /opt/earns-marketing-os-v2 && set -a && . ./.env.production && set +a && cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/nap-lich-van-khan.mts --ngay 120'
//   --xem: chỉ in lịch, KHÔNG đụng DB. 0₫, không gọi AI.
// Bài lịch vào sổ với luu_tru = true: chuẩn Phòng Nội dung hiện bắt goc.id + hook.qc từ spy mà lịch không có;
// không bịa số, không mở lại bài đã lưu trữ. Video lấy URL R2 có sẵn trong sổ, KHÔNG dựng/tải video từ Mac.
// tra-repo-ok: bản chuyển của bộ có sẵn ios-chung/noi-dung/nap-may.mts + Tools/van-khan/lich-dang.mjs (Giỗ Chạp);
// chỉ đổi chỗ chạy (iMac → box3) và nguồn video (upload → reuse R2), không dựng đường nạp mới.
import fs from 'node:fs';
import { sql } from 'drizzle-orm';
import { getDb, closeDb } from '@mos2/db';
import * as L from './lich-am-van-khan.mjs';

type Nguay = { day: number; month: number; year: number };
type Bai = { slug: string; chu_de: string; video: string; nen_url: string; dang: Record<string, unknown> };
type VideoCu = { id: number; slug: string; video: string | null; video_url: string | null; giay: string | number | null };

const doc = (ten: string) => JSON.parse(fs.readFileSync(new URL(ten, import.meta.url), 'utf8'));
const DL = doc('./du-lieu-van-khan.json'), ANH = doc('./anh-nguon-van-khan.json');
L.napDuLieu(DL);

const a = process.argv.slice(2);
const lay = (k: string) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
const soNgay = Math.max(1, Number(lay('--ngay')) || 120);
const xem = a.includes('--xem');
const iso = (s: Nguay) => `${s.year}-${String(s.month).padStart(2, '0')}-${String(s.day).padStart(2, '0')}`;
// Ngày "hôm nay" của lịch = GMT+7. box3 chạy UTC nên dùng new Date() ở đây sẽ lệch một ngày sau 17:00.
const homNayGmt7 = (): Nguay => {
  const [y, m, d] = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10).split('-').map(Number);
  return { year: y, month: m, day: d };
};

const BIEN = ['', '-0', '-2', '-3'];   // ảnh nền xoay cho rằm / mùng 1
const P: Record<string, { id: string; offerings: string[]; so_buoc: number }> = Object.fromEntries(DL.prayers.map((p: { id: string }) => [p.id, p]));
// câu móc theo loại dịp: giữ nguyên lời của lich-dang.mjs (Giỗ Chạp) để bài không đổi giọng
const MOC: Record<string, (t: string, n: string) => string> = {
  ram: (t, n) => `${t} là ${n}. Khấn Thổ công trước hay gia tiên trước?`,
  mung1: (t, n) => `${t} rơi vào ${n}. Bài khấn của nhà bạn đã đủ 2 phần chưa?`,
  'ong-tao': (t, n) => `${n} là ngày tiễn ông Táo. Cúng trước 12 giờ trưa, bài khấn đây`,
  'giao-thua': (t, n) => `Giao thừa năm nay vào đêm ${n}. Ngoài trời khấn trước, trong nhà khấn sau?`,
  'mung-1-tet': (t, n) => `Sáng mùng 1 Tết (${n}) cả nhà đứng trước ban thờ, ai đọc bài?`,
  'hoa-vang': (t, n) => `Hoá vàng mùng 3 Tết (${n}) hay mùng 4? Bài khấn tiễn ông bà đây`,
  'than-tai': (t, n) => `Vía Thần Tài ${n}: cửa hàng nhà bạn đã có bài khấn ghi đúng tên chưa?`,
  'ram-gieng': (t, n) => `"Lễ quanh năm không bằng rằm tháng Giêng": năm nay là ${n}`,
  'le-chua': (t, n) => `${t} (${n}): lên chùa khấn gì ở ban Tam Bảo?`,
  'thanh-minh': (t, n) => `Tết Thanh minh ${n}: ra mộ khấn thần linh trước, rồi mới tới ông bà`,
  'ram-thang-7': (t, n) => `Rằm tháng Bảy ${n}: ba lễ, ba bài khấn, cúng cái nào trước?`,
};

function lich(hn: Nguay, days: number): Bai[] {
  const le = L.sapToi({ holidaysOn: true }, hn, days);
  const trungLe = new Set(le.map((x: { solar: Nguay }) => L.jd(x.solar)));
  const thang: { src: string; title: string; solar: Nguay; lunar: { day: number; month: number; leap: boolean }; prayer: string }[] = [];
  for (let n = L.jd(hn); n <= L.jd(hn) + days; n++) {
    const s = L.tuJd(n), l = L.toLunar(s);
    if ((l.day === 1 || l.day === 15) && !trungLe.has(n))
      thang.push({ src: l.day === 1 ? 'mung1' : 'ram', title: '', solar: s, lunar: l, prayer: 'ram-mung-1' });
  }
  const ds: Bai[] = [], daCo = new Set<string>();
  let xoay = 0;
  for (const x of [...le, ...thang].sort((p, q) => L.jd(p.solar) - L.jd(q.solar))) {
    if (!x.prayer || !P[x.prayer]) continue;
    const ngay = iso(x.solar);
    if (L.jd(x.solar) - L.jd(hn) < 1) continue;   // hôm nay rồi thì không kịp hạn 3 ngày trước
    const dungNgayThang = x.src === 'ram' || x.src === 'mung1' || x.prayer === 'ram-mung-1';
    const loai = dungNgayThang ? (x.lunar.day === 1 ? 'mung1' : 'ram')
      : x.hol?.id === 'tet' ? 'mung-1-tet' : x.hol?.id === 'tat-nien' ? 'giao-thua' : x.prayer;
    const tenThang = (m: number) => (m === 11 ? 'Mười một' : L.tenThangAm(m));   // "tháng Một" dễ đọc nhầm thành tháng 1
    const tenDip = x.src === 'ram' || x.src === 'mung1' ? `${x.lunar.day === 1 ? 'Mùng 1' : 'Rằm'} tháng ${tenThang(x.lunar.month)}` : x.title;
    const nhan = `${L.weekday(x.solar).toLowerCase()} ${x.solar.day}/${x.solar.month}`;
    const bien = dungNgayThang ? BIEN[xoay++ % BIEN.length] : '';
    const vid = `${x.prayer}${bien}`, p = P[x.prayer], link = `https://giochap.com/van-khan/${x.prayer}/`;
    const tu = iso(L.tuJd(L.jd(x.solar) - 3)), den = iso(L.tuJd(L.jd(x.solar) - 1));
    const sam = p.offerings[0].replace(/\.$/, '');
    const t0 = (MOC[loai] ?? MOC['le-chua'])(tenDip, nhan), title = t0.charAt(0).toUpperCase() + t0.slice(1);
    const slug = `vk-${ngay}-${x.prayer}`;
    if (daCo.has(slug)) continue;   // hai dịp trùng ngày / cùng bài khấn chỉ nạp một lần
    daCo.add(slug);
    ds.push({
      slug, chu_de: `${tenDip} · ${ngay}`, video: vid, nen_url: ANH[vid]?.src ?? ANH[x.prayer].src,
      dang: {
        title,
        description: [
          `${tenDip} năm nay vào ${nhan} dương lịch (${L.amNgan(x.lunar)} âm).`,
          `Sắm lễ: ${sam.charAt(0).toLowerCase()}${sam.slice(1)}. Video có đủ ${p.so_buoc} bước làm lễ.`,
          `Bài khấn đầy đủ, gõ tên nhà bạn là bài tự điền sẵn, đọc liền một mạch: ${link}`,
        ].join('\n'),
        link, nhom: dungNgayThang ? 'Rằm, mùng 1' : 'Ngày lễ', dang_tu: tu, dang_den: den, ngay_cung: ngay,
      },
    });
  }
  return ds;
}

const homNay = homNayGmt7(), ds = lich(homNay, soNgay);
if (xem) {
  for (const r of ds) console.error(`${r.dang.dang_tu}..${r.dang.dang_den}  ${r.video.padEnd(14)} ${r.dang.title}`);
  console.log(JSON.stringify({ hom_nay: iso(homNay), so_ngay: soNgay, so_bai: ds.length }));
  process.exit(0);
}

const db = getDb();
if (!db) throw new Error('thiếu DATABASE_URL — chạy trong box3 sau khi nạp .env.production');
const MAY = 'giochap-van-khan';
const [may] = (await db.execute(sql`select id from xv_may where ma = ${MAY}`)) as unknown as { id: number }[];
let mayId: number;
if (may) mayId = may.id;
else {
  // chỉ tạo khi máy chưa có — máy đang chạy thì giữ nguyên cấu hình đã duyệt trên sổ
  const tao = (await db.execute(sql`insert into xv_may
    (ma, ten, du_an, mau, muc_dich, nguon, luat, dang, chay, ngach, hook_sp, la_san_pham)
    values (${MAY}, ${'Văn khấn theo ngày âm · Giỗ Chạp'}, ${'clane'}, ${'van-khan-ngoai'},
      ${'App Giỗ Chạp · giochap.com/van-khan (bài khấn điền sẵn tên)'},
      ${JSON.stringify({ dung: 0, tong: 12, mo_ta: 'Lịch âm Hồ Ngọc Đức (lõi app Giỗ Chạp) → các dịp trong N ngày tới; lịch sinh bằng scripts/nap-lich-van-khan.mts' })}::jsonb,
      ${JSON.stringify([
        'Mỗi dịp (rằm, mùng 1, ngày lễ) một bài, đăng trong 3 ngày trước ngày cúng (dang_tu..dang_den)',
        'Video dựng ngoài studio (Giỗ Chạp Tools/van-khan/de-video.mjs); loader chỉ dùng URL R2 có sẵn trong sổ',
        'Link đích = giochap.com/van-khan/<bài>/ (máy đăng gắn UTM)',
      ])}::jsonb,
      ${JSON.stringify([{ nen: 'facebook', ten: 'Facebook Reels', tk: 'Page Lời hay ý đẹp', may: 'iMac', gio: '20:00', gio_tu: '17:00', tran: 1,
        kem: 'link giochap.com/van-khan/<bài> trong mô tả · đăng qua Graph API (box3)',
        br: { api: true, ten: 'Lời hay ý đẹp', acct: '568', graph_id: '108889671544459' } }])}::jsonb,
      true, ${['san-pham']}::text[], ${[2443]}::integer[], false)
    returning id`)) as unknown as { id: number }[];
  mayId = tao[0].id;
}

// URL video cũ trong sổ (đã lên R2 từ lúc dựng bằng video.py) — loader KHÔNG tải mp4 từ Mac
const cu = (await db.execute(sql`select id, slug, de->>'video' as video, video_url, giay
  from xv_may_video where may_id = ${mayId} and slug like 'vk-%' and de->>'video' is not null`)) as unknown as VideoCu[];
const urlTheoVideo = new Map<string, { url: string; giay: number | null }>();
for (const r of cu) if (r.video && r.video_url && !urlTheoVideo.has(r.video)) urlTheoVideo.set(r.video, { url: r.video_url, giay: Number(r.giay) || null });
const slugCu = new Map(cu.map((r) => [r.slug, r.id]));
const thieu = [...new Set(ds.map((r) => r.video))].filter((v) => !urlTheoVideo.has(v));
if (thieu.length) throw new Error(`video chưa có URL R2 trong sổ: ${thieu.join(', ')} — phải dựng video đó (Giỗ Chạp video.py) rồi nạp URL vào sổ trước; loader không tải mp4 từ Mac`);

let them = 0, capNhat = 0, giuNguyen = 0;
for (const r of ds) {
  const video = urlTheoVideo.get(r.video)!;
  const idCu = slugCu.get(r.slug);
  if (!idCu) {
    await db.execute(sql`insert into xv_may_video
      (may_id, slug, chu_de, de, dang, nen_url, video_url, giay, xuat_luc, luu_tru)
      values (${mayId}, ${r.slug}, ${r.chu_de}, ${JSON.stringify({ video: r.video })}::jsonb,
        ${JSON.stringify(r.dang)}::jsonb, ${r.nen_url}, ${video.url}, ${video.giay}, now(), true)
      on conflict (may_id, slug) do nothing`);
    them++;
    continue;
  }
  // bài cũ: chỉ sửa chữ/ảnh nếu lịch đổi; KHÔNG đụng luu_tru, da_dang, cham, duyet, xuat_luc, video_url
  const doi = (await db.execute(sql`update xv_may_video set chu_de = ${r.chu_de}, dang = ${JSON.stringify(r.dang)}::jsonb,
    nen_url = ${r.nen_url}, updated_at = now()
    where id = ${idCu} and (chu_de is distinct from ${r.chu_de} or dang is distinct from ${JSON.stringify(r.dang)}::jsonb
      or nen_url is distinct from ${r.nen_url}) returning id`)) as unknown as { id: number }[];
  doi.length ? capNhat++ : giuNguyen++;
}

console.log(JSON.stringify({ hom_nay: iso(homNay), so_ngay: soNgay, so_bai: ds.length, them, cap_nhat: capNhat, giu_nguyen: giuNguyen, luu_tru: true }));
await closeDb();
process.exit(0);
