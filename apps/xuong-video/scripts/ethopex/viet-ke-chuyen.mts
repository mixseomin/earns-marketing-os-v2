// VIẾT KỊCH BẢN QC KỂ CHUYỆN TỰ ĐỘNG cho máy sinh (anh 29/10/2026: viết bằng AI rẻ qua ckey — "AI rẻ qua cổng ckey"). Thay việc con viết tay lô JSON (lo-2610*-ke-chuyen.json).
// Nguồn sự thật = TRANG PHIM công khai (og:description / special_desc / mô tả tập) + POSTER (og:image, mô hình nhìn ảnh để tả nhân vật) — không bịa trái phim.
// Khuôn = bản thắng #55604 Step Back (kể ngôi thứ nhất, 6 cảnh chữ ngắn, câu 1 là hook, cú lật hiện trong hình ở cảnh 5) + luật AFS/Meta (không vũ khí, máu, gợi dục, mặc kín).
// Ra: lô JSON một phim (đúng khuôn tao-lo.mts) → chạy tao-lo → in {tap, giong, chi_vnd}. Giá thật VNĐ ở usage.x_ckey.cost (Sonnet ckey ~vài trăm ₫/phim).
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/ethopex/viet-ke-chuyen.mts '<json một dòng của hang-ke-chuyen>'
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { goiAi, MO_HINH } from '../../../../packages/cong-ai/index.mjs';

type Phim = { content_id: number; ten: string; url: string; nguon: string; lang: 'en' | 'es' };
const p = JSON.parse(process.argv[2] ?? '{}') as Phim;
if (!p.content_id || !p.url) { console.error('cần JSON {content_id, ten, url, nguon, lang}'); process.exit(1); }
// GỌI AI QUA CỔNG AI CHUNG spy (anh 16/11/2026 "1 nguồn dùng API duy nhất cho mọi model") — tệp này không giữ khoá, không chọn tuyến: packages/cong-ai

// ── 1. sự thật từ trang phim ──
const giaiMa = (s: string) => s.replace(/\\u003c/g, '<').replace(/\\u003e/g, '>').replace(/\\u0026/g, '&').replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"')
  .replace(/&amp;/g, '&').replace(/&([a-z])(acute|tilde|grave|uml);/gi, '$1').replace(/&ntilde;/g, 'ñ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
const html = execFileSync('curl', ['-sL', '-A', 'Mozilla/5.0', '--max-time', '30', p.url], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const meta = (k: string) => new RegExp(`<meta[^>]+(?:property|name)="${k}"[^>]+content="([^"]*)"`, 'i').exec(html)?.[1] ?? '';
const tomTat = [...new Set([meta('og:description'), meta('description'), ...[...html.matchAll(/"(?:special_desc|introduce|shortPlayIntroduce|synopsis)"\s*:\s*"((?:[^"\\]|\\.){40,2000})"/g)].map((m) => m[1]!),
  // DramaBox: tóm tắt nằm ở "introduction" — chỉ lấy CÁI ĐẦU (phim của trang); các "introduction" sau là phim gợi ý khác (85250 hỏng 3 lần vì og:description chỉ 'DramaBox <tên> full movie')
  /"introduction"\s*:\s*"((?:[^"\\]|\\.){40,2000})"/.exec(html)?.[1] ?? '']
  .map(giaiMa).filter((x) => x.length > 30))].join('\n').slice(0, 3000);
// POSTER: kho Ethopex trước (ethopex_content.anh → acdn.dofez.com, CDN mở) — og:image của app gốc có CDN chặn bot bằng trang JavaScript (ReelShort crazymaplestudios:
// curl nhận về HTML thay ảnh, lần chạy đầu máy sinh 29/10 hỏng ở bước sinh). og:image chỉ là dự phòng khi kho chưa có.
const anhKho = (() => { try { return execFileSync('bash', ['-c', `. /root/.secrets/spy.env; psql "$DATABASE_URL" -tAc "select anh from ethopex_content where id = ${Number(p.content_id)}"`], { encoding: 'utf8' }).trim(); } catch { return ''; } })();
const poster = anhKho ? (/^https?:/.test(anhKho) ? anhKho : `https://acdn.dofez.com/${anhKho}`) : meta('og:image');
if (!tomTat || !poster) { console.error(`✗ trang phim thiếu ${!tomTat ? 'tóm tắt' : 'poster'}: ${p.url}`); process.exit(3); }

// ── 2. mô hình viết (ép khuôn bằng công cụ — cùng cách spy) ──
const ES = p.lang === 'es';
const LUAT = `You write a first-person storytelling video ad (vertical short drama, ~22 seconds) for the short drama "${p.ten}". Language of every "loi" line: ${ES ? 'Spanish (Latin American)' : 'English'}.
FACTS (official synopsis from the drama page — the ONLY source of plot; never invent events that contradict it, never add plot points it does not support):
${tomTat}
The attached image is the official poster: describe the characters exactly as they look on it (age, hair, outfit) so an image model can redraw them.
RULES (winning template + Meta/AFS ad policy):
- Narrator = the main character on the poster, speaking in first person ("I…"). Exactly 6 scenes.
- Scene 1 "loi" is the hook: a shocking or curious first line that makes viewers stop scrolling. Each "loi" 5–14 words, one sentence, natural spoken voice-over.
- Arc: hook → setup → betrayal / humiliation → low point → the twist (scene 5, the reversal must be VISIBLE in the image) → payoff tease (scene 6, ends on suspense, no spoilers of the ending).
- "anh" = one film still: the place + ONLY the characters present, named in CAPS exactly as in "nhan_vat", what each is doing, where they stand. One location per scene. 1–2 sentences.
- "dong" = the single motion that happens in a 4-second clip + one camera move. Restrained, realistic acting. Nobody speaks on screen (the lines are voice-over).
- NEVER: weapons, blood, injuries, violence, sexual content, kissing, nudity, lingerie, bed scenes; everyone fully and modestly dressed. No text, logos or app names in images.
- Lines must be clean for Meta ads: no words about prostitution / escorts / sex / sleeping with someone / seduction, death / killing / murder / suicide, drugs, swearing or insults, and no "tap / click" calls to action — retell such plot points in safe words ("a cruel rumor", "they ruined my name").
- "nhan_vat": "NAME = short visual description; NAME = …" for every character used (narrator first, mark "(narrator)").
- "nguoi_ke": the narrator's gender, "nu" or "nam".`;
const SCHEMA = { type: 'object', required: ['nhan_vat', 'nguoi_ke', 'boi_canh', 'canh'], properties: {
  nhan_vat: { type: 'string' }, nguoi_ke: { type: 'string', enum: ['nu', 'nam'] },
  boi_canh: { type: 'object', required: ['ten', 'mo_ta'], properties: { ten: { type: 'string' }, mo_ta: { type: 'string' } } },
  canh: { type: 'array', minItems: 6, maxItems: 6, items: { type: 'object', required: ['loi', 'anh', 'dong'], properties: { loi: { type: 'string' }, anh: { type: 'string' }, dong: { type: 'string' } } } } } };
type KichBan = { nhan_vat: string; nguoi_ke: 'nu' | 'nam'; boi_canh: { ten: string; mo_ta: string }; canh: { loi: string; anh: string; dong: string }[] };
let kq: KichBan | null = null;
let chi = 0, loi = '';
// CỔNG CHỮ = đúng danh sách từ cấm cat-canh / kiem-thoai.py dùng (một nguồn) — kiểm kết quả cổng AI
const tuCam = (canh: { loi: string }[]): string[] => (JSON.parse(execFileSync('python3', ['-c', `import importlib.util as u,json,sys;s=u.spec_from_file_location('k','scripts/ethopex/kiem-thoai.py');m=u.module_from_spec(s);s.loader.exec_module(m);print(json.dumps([m.soat(c) for c in json.load(sys.stdin)]))`],
      { input: JSON.stringify(canh.map((c) => c.loi)), encoding: 'utf8' }).trim().split('\n').pop()!) as (string | null)[]).map((w, i) => (w ? `#${i + 1} "${w}"` : '')).filter(Boolean);
// Một lượt qua cổng (donk → ckey sống → fal, không chính hãng); lời dính từ cấm / sai khuôn → lượt sau bỏ tuyến đó (bo_tuyen)
try {
  const pb = await fetch(poster, { headers: { 'user-agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(30e3) });
  const anh = Buffer.from(await pb.arrayBuffer()).toString('base64'), mt = (pb.headers.get('content-type') || 'image/jpeg').split(';')[0];
  const r = await goiAi<KichBan>({ viec: 'xv-ke-chuyen', ma: String(p.content_id), model: MO_HINH.sonnet, max_tokens: 3000, schema: SCHEMA, bo_chinh_hang: true,
    noi_dung: [{ type: 'image', source: { type: 'base64', media_type: mt, data: anh } }, { type: 'text', text: LUAT }] },
    { kiem: (x) => { if (!(x?.canh?.length === 6 && x.nhan_vat)) return 'sai khuôn'; const dinh = tuCam(x.canh); return dinh.length ? `lời dính từ cấm ${dinh.join(', ')}` : null; } });
  kq = r.kq; chi += r.chi_usd * 26000;
} catch (e) { loi = String(e).slice(0, 300); }
if (!kq) { console.error(`✗ cổng AI không viết được (${loi}) · đã tiêu ${Math.round(chi)}₫`); process.exit(4); }

// ── 3. lô JSON một phim → tao-lo (khuôn studio + cổng) ──
const D = '/var/tmp/vx-kc/lo'; if (!existsSync(D)) mkdirSync(D, { recursive: true });
const tep = `${D}/lo-${p.content_id}-${Date.now()}.json`;
writeFileSync(tep, JSON.stringify({
  ghi_chu: `Máy sinh kể chuyện VideoExpress (viet-ke-chuyen.mts, cổng AI ${Math.round(chi)}₫) — khuôn bản thắng #55604, truyện theo tóm tắt trang phim, hình không vũ khí / máu / gợi dục.`,
  khuon: { ti_le: '9:16', do_phan_giai: '1080p', so_canh: 6, giay_canh: 4, the_cuoi: { en: 'Watch the full series for free · Learn More', es: 'Mira la serie completa gratis · Más información' } },
  phim: [{ content_id: p.content_id, ten: p.ten, lang: p.lang, nguon: p.nguon, giong: kq.nguoi_ke === 'nam' ? 'Brian' : 'Sarah', poster, url: p.url, nhan_vat: kq.nhan_vat,
    trang_phim: tomTat.slice(0, 1200), boi_canh: kq.boi_canh, canh: kq.canh }],
}, null, 1));
const ra = execFileSync('../../node_modules/.bin/tsx', ['scripts/ethopex/tao-lo.mts', tep], { encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '--conditions=react-server' } });
const tap = (JSON.parse(ra.trim().split('\n').pop()!) as { tap: number }[])[0]?.tap;
if (!tap) { console.error(`✗ tao-lo không tạo tập:\n${ra}`); process.exit(5); }
const GIONG = { en: { nu: 'en-US-AvaMultilingualNeural', nam: 'en-US-AndrewMultilingualNeural' }, es: { nu: 'es-MX-DaliaNeural', nam: 'es-MX-JorgeNeural' } } as const;
console.log(JSON.stringify({ tap, giong: GIONG[p.lang][kq.nguoi_ke], chi_vnd: Math.round(chi), lo: tep }));
process.exit(0);
