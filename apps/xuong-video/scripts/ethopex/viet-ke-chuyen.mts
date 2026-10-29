// VIẾT KỊCH BẢN QC KỂ CHUYỆN TỰ ĐỘNG cho máy sinh (anh 29/10/2026: viết bằng AI rẻ qua ckey — "AI rẻ qua cổng ckey"). Thay việc con viết tay lô JSON (lo-2610*-ke-chuyen.json).
// Nguồn sự thật = TRANG PHIM công khai (og:description / special_desc / mô tả tập) + POSTER (og:image, mô hình nhìn ảnh để tả nhân vật) — không bịa trái phim.
// Khuôn = bản thắng #55604 Step Back (kể ngôi thứ nhất, 6 cảnh chữ ngắn, câu 1 là hook, cú lật hiện trong hình ở cảnh 5) + luật AFS/Meta (không vũ khí, máu, gợi dục, mặc kín).
// Ra: lô JSON một phim (đúng khuôn tao-lo.mts) → chạy tao-lo → in {tap, giong, chi_vnd}. Giá thật VNĐ ở usage.x_ckey.cost (Sonnet ckey ~vài trăm ₫/phim).
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/ethopex/viet-ke-chuyen.mts '<json một dòng của hang-ke-chuyen>'
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

type Phim = { content_id: number; ten: string; url: string; nguon: string; lang: 'en' | 'es' };
const p = JSON.parse(process.argv[2] ?? '{}') as Phim;
if (!p.content_id || !p.url) { console.error('cần JSON {content_id, ten, url, nguon, lang}'); process.exit(1); }
const KHOA = readFileSync('/root/.secrets/spy.env', 'utf8').match(/^CKEY_KEY=(.*)$/m)?.[1]?.trim();
if (!KHOA) { console.error('thiếu CKEY_KEY (/root/.secrets/spy.env)'); process.exit(1); }
// tuyến ckey SỐNG do spy bảo trì (/var/lib/spy/ckey-tuyen.json, đo 6 giờ/lần) — Sonnet trước (kịch bản cần chất lượng), Haiku dự phòng
const TUYEN = (() => { try { const j = JSON.parse(readFileSync('/var/lib/spy/ckey-tuyen.json', 'utf8')) as { dong: Record<string, string[]> }; return [...(j.dong.sonnet ?? []), ...(j.dong.haiku ?? [])]; }
  catch { return ['ckey:haiphu95pdp/claude-sonnet-5-5', 'ckey:nghiaphan0633/claude-haiku-5.5']; } })().map((m) => m.replace(/^ckey:/, ''));

// ── 1. sự thật từ trang phim ──
const giaiMa = (s: string) => s.replace(/\\u003c/g, '<').replace(/\\u003e/g, '>').replace(/\\u0026/g, '&').replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"')
  .replace(/&amp;/g, '&').replace(/&([a-z])(acute|tilde|grave|uml);/gi, '$1').replace(/&ntilde;/g, 'ñ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
const html = execFileSync('curl', ['-sL', '-A', 'Mozilla/5.0', '--max-time', '30', p.url], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const meta = (k: string) => new RegExp(`<meta[^>]+(?:property|name)="${k}"[^>]+content="([^"]*)"`, 'i').exec(html)?.[1] ?? '';
const tomTat = [...new Set([meta('og:description'), meta('description'), ...[...html.matchAll(/"(?:special_desc|introduce|shortPlayIntroduce|synopsis)"\s*:\s*"((?:[^"\\]|\\.){40,2000})"/g)].map((m) => m[1]!)]
  .map(giaiMa).filter((x) => x.length > 30))].join('\n').slice(0, 3000);
const poster = meta('og:image');
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
let kq: { nhan_vat: string; nguoi_ke: 'nu' | 'nam'; boi_canh: { ten: string; mo_ta: string }; canh: { loi: string; anh: string; dong: string }[] } | null = null;
let chi = 0, loi = '';
for (const model of TUYEN) {
  try {
    const r = await fetch('https://api.xah.io/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${KHOA}`, 'content-type': 'application/json' }, signal: AbortSignal.timeout(5 * 60e3),
      body: JSON.stringify({ model, max_tokens: 3000, messages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url: poster } }, { type: 'text', text: LUAT }] }],
        tools: [{ type: 'function', function: { name: 'ghi_kich_ban', description: 'Ghi kịch bản QC kể chuyện', parameters: SCHEMA } }], tool_choice: { type: 'function', function: { name: 'ghi_kich_ban' } } }) });
    const j = await r.json() as { usage?: { x_ckey?: { cost?: number } }; error?: unknown; choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[] };
    chi += Number(j.usage?.x_ckey?.cost ?? 0);
    const a = j.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const x = a ? JSON.parse(a) : null;
    // CỔNG CHỮ = đúng danh sách từ cấm cat-canh / kiem-thoai.py dùng (một nguồn): câu nào dính thì thử tuyến kế, không để tới bước dựng mới bị chặn
    const dinh = x?.canh?.length === 6 ? (JSON.parse(execFileSync('python3', ['-c', `import importlib.util as u,json,sys;s=u.spec_from_file_location('k','scripts/ethopex/kiem-thoai.py');m=u.module_from_spec(s);s.loader.exec_module(m);print(json.dumps([m.soat(c) for c in json.load(sys.stdin)]))`],
      { input: JSON.stringify(x.canh.map((c: { loi: string }) => c.loi)), encoding: 'utf8' }).trim().split('\n').pop()!) as (string | null)[]).map((w, i) => (w ? `#${i + 1} "${w}"` : '')).filter(Boolean) : [];
    if (x?.canh?.length === 6 && x.nhan_vat && !dinh.length) { kq = x; break; }
    if (dinh.length) { loi = `${model}: lời dính từ cấm ${dinh.join(', ')}`; continue; }
    loi = `${model}: ${JSON.stringify(j.error ?? 'sai khuôn').slice(0, 160)}`;
  } catch (e) { loi = `${model}: ${String(e).slice(0, 160)}`; }
}
if (!kq) { console.error(`✗ ckey không viết được (${loi}) · đã tiêu ${Math.round(chi)}₫`); process.exit(4); }

// ── 3. lô JSON một phim → tao-lo (khuôn studio + cổng) ──
const D = '/var/tmp/vx-kc/lo'; if (!existsSync(D)) mkdirSync(D, { recursive: true });
const tep = `${D}/lo-${p.content_id}-${Date.now()}.json`;
writeFileSync(tep, JSON.stringify({
  ghi_chu: `Máy sinh kể chuyện VideoExpress (viet-ke-chuyen.mts, ckey ${Math.round(chi)}₫) — khuôn bản thắng #55604, truyện theo tóm tắt trang phim, hình không vũ khí / máu / gợi dục.`,
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
