// WORKER CHẤM CREATIVE ETHOPEX (anh 25/10/2026: "chấm điểm sao lại cài trên iMac" → Cloudflare Worker, tài khoản Eimagini Workers Paid).
// Mỗi phút (Cron Trigger): nhận việc từ mos2 (GET /api/ext/etp-cham — hàng etp.cham_hang: nút "Chấm" trên etp.on.tc + creative mới) → chấm 4 lớp → trả kết quả (POST).
//   ảnh      20 khung cắt bằng Media binding từ bản video tạm trong R2 (tải từ img.on.tc MỘT lần) → lưu R2 khung/<creative>/<n>.jpg, trang etp hiện qua /khung/…
//   giọng    tách tiếng (Media binding, ≤ 60s / lượt) → Whisper large-v3-turbo (Workers AI)
//   chữ      Claude đọc nguyên văn chữ trên các khung (thay OCR) → luật từ cấm / CTA (một nguồn: kiem-thoai.py / cta_qc.py, dong-bo.py xuất ra kho)
//   nội dung Claude (chuỗi rẻ ckey → ShopAIKey → Anthropic) xem 20 khung + chữ + lời → điểm 0–10 từng tiêu chí (etp.tieu_chi); HAI lượt, lấy điểm thấp,
//            lệch ≥ 4 → cần người xem. Kết luận: cấm khi Meta ≤ 5 · cần xem khi Meta ≤ 7 hoặc AFS ≤ 7. CHỈ CHẤM — không đụng camp / luật.
interface Env {
  MEDIA: any; AI: any; R2: R2Bucket;
  MOS2_EXT_KEY: string; KHOA_THU: string; CKEY_API_KEY?: string; SHOPAIKEY_API_KEY?: string; ANTHROPIC_API_KEY?: string;
}
type TieuChi = { nhom: string; ma: string; ten: string; mo_ta: string };
type Mau = { thoai: string; thoai_hoa: string[]; cta: string; cta_hoa: string[]; phu: string; phu_hoa: string[]; nut_chuan: string };
type Viec = { creative_id: number; video: string; dur: number; doan: string | null; phim: string | null };
type KetClaude = { noi_dung?: string; chu?: string; diem?: Record<string, number>; ly_do?: Record<string, string>; khung?: Record<string, number[]>; duong?: string };

const MOS2 = 'https://mos2.on.tc/api/ext/etp-cham';
const SO_KHUNG = 20, CAM_META = 5, XEM = 7;
const MO_HINH = 'claude-sonnet-5-5';
const CKEY = ['duc121026ab/claude-sonnet-5-5', 'thanhnhan9023/claude-sonnet-5.5'];   // = CKEY_CLAUDE['claude-sonnet-5-5'] (studio claude.ts / soat_doan.py)
const vn = () => { const d = new Date(Date.now() + 7 * 3600_000); const p = (n: number) => String(n).padStart(2, '0'); return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())} ${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`; };
const b64 = (b: Uint8Array) => { let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };
async function theoNhom<T, R>(ds: T[], n: number, f: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const ra: R[] = new Array(ds.length); let k = 0;
  await Promise.all(Array.from({ length: Math.min(n, ds.length) }, async () => { while (k < ds.length) { const i = k++; ra[i] = await f(ds[i]!, i); } }));
  return ra;
}

async function cat(env: Env, key: string, out: Record<string, unknown>, transform?: Record<string, unknown>): Promise<Uint8Array> {
  const o = await env.R2.get(key); if (!o) throw new Error('mất bản video tạm');
  let m = env.MEDIA.input(o.body); if (transform) m = m.transform(transform);
  return new Uint8Array(await (await m.output(out).response()).arrayBuffer());
}

// ĐỘ DÀI THẬT của video: đọc hộp mvhd trong tệp mp4 (đầu tệp nếu faststart, không thì cuối tệp) — creative cũ không theo khuôn
// "đoạn + thẻ cuối", ước theo đoạn cắt làm mốc khung vượt cuối video (25/10/2026: #51921 chỉ cắt được 5/20 khung)
async function doDaiMp4(env: Env, key: string, dai: number): Promise<number | null> {
  const doc = async (r: R2Range) => { const o = await env.R2.get(key, { range: r }); return o ? new Uint8Array(await o.arrayBuffer()) : null; };
  for (const r of [{ offset: 0, length: Math.min(dai, 2 << 20) }, { suffix: Math.min(dai, 8 << 20) }] as R2Range[]) {
    const b = await doc(r); if (!b) continue;
    for (let i = 0; i + 32 < b.length; i++) {
      if (b[i] !== 0x6d || b[i + 1] !== 0x76 || b[i + 2] !== 0x68 || b[i + 3] !== 0x64) continue;   // 'mvhd'
      const dv = new DataView(b.buffer, b.byteOffset + i + 4), v1 = dv.getUint8(0) === 1;
      const ts = v1 ? dv.getUint32(20) : dv.getUint32(12), du = v1 ? Number(dv.getBigUint64(24)) : dv.getUint32(16);
      if (ts > 0 && du > 0) return du / ts;
    }
  }
  return null;
}

function cauHoi(tc: TieuChi[], giong: string) {
  const ds = tc.map((x) => `- "${x.nhom}.${x.ma}": ${x.mo_ta}`).join('\n');
  return `You review a Facebook/Instagram video ad for a short drama. The ${SO_KHUNG} images are frames 1–${SO_KHUNG} of the video in time order (the last frames are the end card). Look closely at clothing, skin and body contact.\n`
    + `Spoken voice transcript (speech recognition, may repeat phrases by mistake — ignore repetition): ${giong.slice(0, 2500) || '(none)'}\n`
    + `Score EACH criterion from 0 to 10 where 10 = fully compliant / no risk, 7 = minor doubt, 4 or less = Meta or Google would very likely reject:\n${ds}\n`
    + `Reply ONLY JSON: {"chu": "<ALL on-screen text you can read in the frames, verbatim, joined with ' / '>", "noi_dung": "<2 sentences in Vietnamese: what happens in the video>", `
    + `"diem": {"<group.code>": <0-10>, ...every criterion...}, "ly_do": {"<group.code>": "<short reason in Vietnamese naming the frame / words, only for scores below 10>"}, `
    + `"khung": {"<group.code>": [<frame numbers 1-${SO_KHUNG} that show the problem, only for scores below 10>]}}`;
}

async function claude(env: Env, anh: Uint8Array[], hoi: string, can: string[]): Promise<KetClaude> {
  const nd = [{ role: 'user', content: [...anh.map((a) => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64(a) } })), { type: 'text', text: hoi }] }];
  const duong: [string, string, string, string][] = [];
  if (env.CKEY_API_KEY) for (const m of CKEY) duong.push(['ckey', 'https://api.xah.io/v1/messages', env.CKEY_API_KEY, m]);
  if (env.SHOPAIKEY_API_KEY) duong.push(['shopaikey', 'https://api.shopaikey.com/v1/messages', env.SHOPAIKEY_API_KEY, MO_HINH]);
  if (env.ANTHROPIC_API_KEY) duong.push(['anthropic', 'https://api.anthropic.com/v1/messages', env.ANTHROPIC_API_KEY, MO_HINH]);
  const loi: string[] = [];
  for (const [ten, url, k, m] of duong) {
    try {
      const h: Record<string, string> = { 'x-api-key': k, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' };
      if (ten !== 'anthropic') h.authorization = `Bearer ${k}`;
      const r = await fetch(url, { method: 'POST', headers: h, body: JSON.stringify({ model: m, max_tokens: 2000, messages: nd }) });
      const j = await r.json() as { content?: { type: string; text?: string }[]; error?: unknown };
      const t = (j.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
      if (!t) throw new Error(`HTTP ${r.status} ${JSON.stringify(j.error ?? j).slice(0, 120)}`);
      const o = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)) as KetClaude;
      const thieu = can.filter((c) => typeof o.diem?.[c] !== 'number');
      if (thieu.length) throw new Error(`thiếu điểm ${thieu.slice(0, 3).join(', ')}`);
      return { ...o, duong: `${ten}:${m}` };
    } catch (e) { loi.push(`${ten} ${m}: ${String(e).slice(0, 120)}`); }
  }
  throw new Error(`mọi đường Claude lỗi — ${loi.join(' | ').slice(0, 300)}`);
}

// từ cấm / CTA trên chữ + lời (luật một nguồn từ kho) → danh sách câu dính
function soat(mau: Mau | null, chu: string, loi_noi: string) {
  if (!mau) return { thoai: [] as string[], cta: [] as string[] };
  const tim = (t: string, re: string, hoa: string[], co = 'iu') => [new RegExp(re, co), ...hoa.map((x) => new RegExp(x, 'u'))].flatMap((r) => { const m = t.match(r); return m ? [m[0]] : []; });
  const boNut = (t: string) => t.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(new RegExp(mau.nut_chuan, 'giu'), ' ');
  const thoai = [...tim(chu, mau.thoai, mau.thoai_hoa).map((x) => `chữ: «${x}»`), ...tim(loi_noi, mau.thoai, mau.thoai_hoa).map((x) => `lời: «${x}»`)];
  const cta = [...tim(chu, mau.cta, mau.cta_hoa), ...tim(boNut(chu), mau.phu, mau.phu_hoa)].map((x) => `«${x}»`);
  return { thoai, cta };
}

// BÁO BƯỚC về mos2 (bảng chấm trực tiếp trên etp.on.tc — anh 25/10/2026 "thiếu bảng live chi tiết") — lỗi báo không làm hỏng lượt chấm
const bao = (env: Env, cr: number, buoc: string) => fetch(MOS2, { method: 'POST', headers: { authorization: `Bearer ${env.MOS2_EXT_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ creative_id: cr, buoc }) }).catch(() => null);

async function chamMot(env: Env, v0: Viec, tc: TieuChi[], mau: Mau | null) {
  let v = v0;
  const cr = v.creative_id, key = `tam/${cr}.mp4`, loi: string[] = [];
  await bao(env, cr, 'tải video vào kho tạm Cloudflare');
  const lop: Record<string, unknown> = {};
  // video tạm vào R2 MỘT lần (mỗi lượt Media binding cần luồng mới — cắt từ R2, không kéo lại từ box3)
  const r = await fetch(v.video); const dai = Number(r.headers.get('content-length') ?? 0);
  if (!r.ok || !r.body || !dai) throw new Error(`không tải được video (${r.status})`);
  const { readable, writable } = new FixedLengthStream(dai); r.body.pipeTo(writable); await env.R2.put(key, readable);
  const that = await doDaiMp4(env, key, dai); if (that && that > 1) v = { ...v, dur: that };
  await bao(env, cr, `đã tải video ${(dai / 1048576).toFixed(0)} MB · dài ${v.dur.toFixed(0)}s · cắt ${SO_KHUNG} khung`);
  try {
    // ảnh: 20 khung chia đều, khung cuối sát thẻ kết
    const moc = Array.from({ length: SO_KHUNG }, (_, i) => Math.min(v.dur - 1.2, ((i + 0.5) * v.dur) / SO_KHUNG));
    let daCat = 0;
    const anh = (await theoNhom(moc, 5, async (t) => { try { const a = await cat(env, key, { mode: 'frame', time: `${t.toFixed(1)}s`, format: 'jpg' }, { width: 384 }); if (++daCat % 5 === 0) await bao(env, cr, `cắt khung ${daCat}/${SO_KHUNG}`); return a; } catch { return null; } }))
      .filter((x): x is Uint8Array => !!x);
    if (anh.length < SO_KHUNG / 2) throw new Error(`chỉ cắt được ${anh.length}/${SO_KHUNG} khung`);
    await Promise.all(anh.map((a, i) => env.R2.put(`khung/${cr}/${i + 1}.jpg`, a, { httpMetadata: { contentType: 'image/jpeg', cacheControl: 'public, max-age=31536000' } })));
    const goc = 'https://etp-cham.eimagini-info.workers.dev';
    lop.anh = { luc: vn(), so_khung: anh.length, giay: v.dur, khung_url: anh.map((_, i) => `${goc}/khung/${cr}/${i + 1}.jpg?v=${Date.now()}`) };
    await bao(env, cr, `đã cắt ${anh.length} khung · tách tiếng + chép giọng (Whisper)`);
    // giọng: từng đoạn ≤ 60s → Whisper; gộp câu lặp liền nhau (Whisper hay lặp ảo trên nhạc)
    let giong = '';
    try {
      const doan: [number, number][] = []; for (let t = 0; t < v.dur; t += 60) doan.push([t, Math.min(60, v.dur - t)]);
      const chu = await Promise.all(doan.filter(([, d]) => d >= 1).map(async ([t, d]) => {
        const am = await cat(env, key, { mode: 'audio', time: `${t}s`, duration: `${Math.floor(d)}s` });
        const k = await env.AI.run('@cf/openai/whisper-large-v3-turbo', { audio: b64(am) }) as { text?: string; transcription_info?: { language?: string } };
        return { text: (k.text ?? '').trim(), lang: k.transcription_info?.language };
      }));
      const cau = chu.map((c) => c.text).join(' ').split(/(?<=[.!?¿¡])\s+/).filter(Boolean); const gon: string[] = [];
      for (const c of cau) if (!gon.length || c.toLowerCase() !== gon[gon.length - 1]!.toLowerCase()) gon.push(c);
      giong = gon.join(' ');
      lop.giong = { luc: vn(), noi_dung: giong.slice(0, 4000), ngon_ngu: chu[0]?.lang ?? null, loi: [] };
    } catch (e) { loi.push(`giọng: ${String(e).slice(0, 120)}`); }
    // nội dung + chữ: Claude hai lượt độc lập, lấy điểm thấp
    await bao(env, cr, lop.giong ? `đã chép giọng ${giong.split(/\s+/).filter(Boolean).length} từ · Claude chấm 2 lượt` : 'giọng lỗi · Claude chấm 2 lượt');
    const can = tc.map((x) => `${x.nhom}.${x.ma}`), hoi = cauHoi(tc, giong);
    const ls = await Promise.all([claude(env, anh, hoi, can), claude(env, anh, hoi, can)]);
    const diem: Record<string, number> = {}, ly: Record<string, string> = {}, khung: Record<string, number[]> = {};
    for (const k of can) {
      const a = Math.round(ls[0]!.diem![k]!), b = Math.round(ls[1]!.diem![k]!), thap = a <= b ? 0 : 1;
      diem[k] = Math.min(a, b);
      if (diem[k]! < 10) ly[k] = String(ls[thap]!.ly_do?.[k] ?? '').slice(0, 300);
      if (Math.abs(a - b) >= 4) { diem[k] = Math.min(diem[k]!, 7); ly[k] = `hai lượt chấm lệch ${a} / ${b} — cần người xem. ${ly[k] ?? ''}`.slice(0, 300); }
      const kh = [...new Set(ls.flatMap((x) => (x.khung?.[k] ?? []).map(Number)).filter((n) => n >= 1 && n <= anh.length))].sort((x, y) => x - y);
      if (kh.length && diem[k]! < 10) khung[k] = kh;
    }
    await bao(env, cr, `Claude xong (${ls.map((x) => x.duong).join(' + ')}) · soát luật từ cấm / CTA`);
    const chu = [...new Set(ls.map((x) => (x.chu ?? '').trim()).filter(Boolean))].join(' / ');
    const s = soat(mau, chu, giong);
    lop.chu = { luc: vn(), noi_dung: chu.slice(0, 4000), loi: s.thoai, cta: s.cta };
    if (lop.giong) (lop.giong as { loi: string[] }).loi = s.thoai.filter((x) => x.startsWith('lời'));
    lop.noi_dung = { luc: vn(), tom_tat: String(ls[0]!.noi_dung ?? '').slice(0, 600), duong: ls.map((x) => x.duong).join(' + ') };
    // luật máy đọc chữ / lời kéo điểm xuống (không tự kết cấm)
    if (s.thoai.length && 'meta.ngon_tu' in diem) { diem['meta.ngon_tu'] = Math.min(diem['meta.ngon_tu']!, 6); ly['meta.ngon_tu'] = `máy đọc thấy từ cấm: ${s.thoai.join('; ')}`.slice(0, 300); }
    if (s.cta.length && 'afs.cta' in diem) { diem['afs.cta'] = Math.min(diem['afs.cta']!, 4); ly['afs.cta'] = `chữ dụ nhấp: ${s.cta.join('; ')}`.slice(0, 300); }
    const vals = (g: string) => Object.entries(diem).filter(([k]) => k.startsWith(`${g}.`)).map(([, x]) => x);
    const meta = Math.min(...vals('meta')), afs = Math.min(...vals('afs'));
    const ket = meta <= CAM_META ? 'cam' : meta <= XEM || afs <= XEM ? 'xem' : 'ok';
    return { creative_id: cr, lop, diem, ly_do: ly, khung, meta, afs, ket, loi: loi.join('; ') || null };
  } finally { await env.R2.delete(key); }
}

async function chay(env: Env, so = 3) {
  const h = { authorization: `Bearer ${env.MOS2_EXT_KEY}`, 'content-type': 'application/json' };
  const r = await fetch(`${MOS2}?so=${so}`, { headers: h });
  if (!r.ok) throw new Error(`mos2 ${r.status}`);
  const j = await r.json() as { viec: Viec[]; tieu_chi?: TieuChi[]; mau?: Mau | null };
  const kq = await Promise.all(j.viec.map(async (v) => {
    let ra: Record<string, unknown>;
    try { ra = await chamMot(env, v, j.tieu_chi ?? [], j.mau ?? null); } catch (e) { ra = { creative_id: v.creative_id, loi: String(e).slice(0, 300) }; }
    await fetch(MOS2, { method: 'POST', headers: h, body: JSON.stringify(ra) });
    return `#${v.creative_id} ${(ra.ket as string) ?? 'lỗi'}${ra.loi ? ` (${ra.loi})` : ''}`;
  }));
  return kq;
}

export default {
  async scheduled(_e: ScheduledController, env: Env, ctx: ExecutionContext) { ctx.waitUntil(chay(env).then((k) => { if (k.length) console.log(k.join(' · ')); })); },
  async fetch(req: Request, env: Env): Promise<Response> {
    const u = new URL(req.url);
    // khung đã cắt — trang etp.on.tc hiện khi rê chuột (ảnh khung quảng cáo, không bí mật)
    const m = u.pathname.match(/^\/khung\/(\d+)\/(\d+)\.jpg$/);
    if (m) { const o = await env.R2.get(`khung/${m[1]}/${m[2]}.jpg`); return o ? new Response(o.body, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=31536000' } }) : new Response('không có', { status: 404 }); }
    if (req.headers.get('authorization') !== `Bearer ${env.KHOA_THU}`) return new Response('cấm', { status: 403 });
    if (u.pathname === '/chay') return Response.json(await chay(env, Number(u.searchParams.get('so') ?? 1)));
    return new Response('?', { status: 404 });
  },
};
