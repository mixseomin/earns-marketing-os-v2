// Giọng đọc: NHIỀU model (anh yêu cầu 08/10/2026 "voice cũng cần nhiều model + option, không chỉ ElevenLabs").
// - fal: toàn bộ model text-to-speech trong danh mục fal (MiniMax, ElevenLabs, Chatterbox, Gemini TTS, Qwen3, Inworld, xAI, Kokoro…);
//   tên trường chữ/giọng/ngôn ngữ + danh sách giọng ĐỌC TỪ OpenAPI của từng model (enum hoặc examples), không viết tay từng model.
// - ElevenLabs trực tiếp (khoá ELEVENLABS_API_KEY trên box): mọi giọng trong tài khoản (giọng clone, giọng thêm từ thư viện),
//   tính vào gói ElevenLabs của tài khoản thay vì fal. Không có khoá thì nhóm này không hiện.
import 'server-only';

type Truong = { type?: string; enum?: unknown[]; examples?: unknown[]; anyOf?: Array<{ enum?: unknown[]; $ref?: string }>; allOf?: Array<{ $ref?: string }>; $ref?: string; properties?: Record<string, Truong>; description?: string };
export type MoHinhGiong = { key: string; ten: string; nhom: string; giaCents: number | null; donVi: '1k_ky_tu' | 'giay' | 'luot' | 'khac'; giaText: string };
export type MoTaGiong = { truongChu: string; truongGiong: string[] | null; giong: string[]; truongNgonNgu: string | null; ngonNgu: string[] };

const ELEVEN = 'https://api.elevenlabs.io/v1';
export const coElevenTrucTiep = () => !!process.env.ELEVENLABS_API_KEY;

/** Giá TTS từ chữ fal: "$0.1 per 1000 characters" · "0.002 per generated audio seconds". */
function giaTts(t: string): { cents: number | null; donVi: MoHinhGiong['donVi'] } {
  const s = t.replace(/\*\*/g, '');
  const k = s.match(/\$?\s*([0-9]*\.?[0-9]+)\s*\$?\s*per\s*1[,.]?000\s*char/i);
  if (k) return { cents: parseFloat(k[1]!) * 100, donVi: '1k_ky_tu' };
  const k2 = s.match(/per\s*1[,.]?000\s*char[^$]{0,20}\$\s?([0-9]*\.?[0-9]+)/i);   // "Cost per 1,000 Characters | $0.05"
  if (k2) return { cents: parseFloat(k2[1]!) * 100, donVi: '1k_ky_tu' };
  const g = s.match(/\$?\s*([0-9]*\.?[0-9]+)\s*\$?\s*per\s*(generated\s*)?(audio\s*)?(compute\s*)?second/i);
  if (g) return { cents: parseFloat(g[1]!) * 100, donVi: 'giay' };
  const p = s.match(/\$\s?([0-9]*\.?[0-9]+)\s*per\s*(generated\s*)?minute/i);
  if (p) return { cents: (parseFloat(p[1]!) * 100) / 60, donVi: 'giay' };
  const l = s.match(/\$\s?([0-9]*\.?[0-9]+)\s*per\s*(generation|request|call)/i);
  if (l) return { cents: parseFloat(l[1]!) * 100, donVi: 'luot' };
  return { cents: null, donVi: 'khac' };
}

let khoDm: { luc: number; ds: MoHinhGiong[] } | null = null;
/** Danh mục model giọng: ElevenLabs trực tiếp (nếu có khoá) + mọi model text-to-speech của fal (cache 6 giờ). */
export async function dsMoHinhGiong(): Promise<MoHinhGiong[]> {
  const ds: MoHinhGiong[] = [];
  if (coElevenTrucTiep()) {
    ds.push({ key: 'elevenlabs:eleven_v3', ten: 'ElevenLabs v3 — tài khoản anh', nhom: 'ElevenLabs (tài khoản anh)', giaCents: null, donVi: 'khac', giaText: 'Tính vào gói ElevenLabs của tài khoản (ký tự trong gói), không qua fal.' });
    ds.push({ key: 'elevenlabs:eleven_multilingual_v2', ten: 'ElevenLabs Multilingual v2 — tài khoản anh', nhom: 'ElevenLabs (tài khoản anh)', giaCents: null, donVi: 'khac', giaText: 'Tính vào gói ElevenLabs của tài khoản.' });
  }
  if (!khoDm || Date.now() - khoDm.luc > 6 * 3600_000) {
    try {
      const r = await fetch('https://fal.ai/api/models?categories=text-to-speech&limit=100', { headers: { accept: 'application/json' } });
      const j = (await r.json()) as { items?: Array<Record<string, unknown>> };
      const fal = (j.items ?? []).map((m) => String(m.id ?? '')).filter((id) => id && !/voice-clone|voice-design|clone-voice|stream|batch|realtime/.test(id));
      const items = new Map((j.items ?? []).map((m) => [String(m.id), m]));
      const tao = (giaTrang: Map<string, string>) => fal.map((id) => {
        const m = items.get(id)!; const goc = String(m.pricingInfoOverride ?? '').trim() || giaTrang.get(id) || ''; const g = giaTts(goc);
        const hang = id.split('/')[0] === 'fal-ai' ? id.split('/')[1] : id.split('/')[0];
        return { key: id, ten: String(m.title ?? id), nhom: `fal · ${hang}`, giaCents: g.cents, donVi: g.donVi, giaText: goc.replace(/\*\*/g, '') || 'fal chưa công bố giá' } as MoHinhGiong;
      });
      khoDm = { luc: Date.now(), ds: tao(new Map()) };
      // Danh mục fal để trống giá ở nhiều model TTS; giá vẫn ghi trên trang riêng của model → đọc NỀN (không bắt người bấm chờ ~10 giây),
      // đọc xong thì thay danh mục có giá.
      const thieu = fal.filter((id) => !String(items.get(id)?.pricingInfoOverride ?? '').trim());
      void (async () => {
        const giaTrang = new Map<string, string>();
        await Promise.all(thieu.map(async (id) => {
          try {
            const h = await (await fetch(`https://fal.ai/models/${id}`, { signal: AbortSignal.timeout(8000) })).text();
            const t = h.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&quot;|\\"/g, ' ').replace(/\s+/g, ' ');
            const m = t.match(/(?:cost|charged)[^.$]{0,40}\$\s?[0-9.]+[^.]{0,60}/i);
            if (m) giaTrang.set(id, m[0]);
          } catch { /* thôi */ }
        }));
        khoDm = { luc: Date.now(), ds: tao(giaTrang) };
      })();
    } catch { /* giữ kho cũ */ }
  }
  return [...ds, ...(khoDm?.ds ?? [])];
}

const khoMoTa = new Map<string, MoTaGiong>();
/** Đọc OpenAPI của model fal → trường chữ, trường giọng (có thể lồng: voice_setting.voice_id), danh sách giọng, trường ngôn ngữ. */
async function moTaFal(id: string): Promise<MoTaGiong> {
  if (khoMoTa.has(id)) return khoMoTa.get(id)!;
  const rong: MoTaGiong = { truongChu: 'text', truongGiong: null, giong: [], truongNgonNgu: null, ngonNgu: [] };
  try {
    const r = await fetch(`https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=${encodeURIComponent(id)}`);
    const j = (await r.json()) as { components?: { schemas?: Record<string, Truong> } };
    const sc = j.components?.schemas ?? {};
    const k = Object.keys(sc).find((x) => /Input$/.test(x)) ?? Object.keys(sc)[0];
    const p = (k && sc[k]?.properties) || {};
    const ref = (f?: Truong) => { const x = f?.$ref ?? f?.allOf?.[0]?.$ref ?? f?.anyOf?.find((a) => a.$ref)?.$ref; return x ? sc[x.split('/').pop()!] : undefined; };
    const giaTri = (f?: Truong) => [...(f?.enum ?? []), ...(f?.anyOf?.flatMap((a) => a.enum ?? []) ?? []), ...(f?.enum ? [] : (f?.examples ?? []))]
      .filter((x): x is string => typeof x === 'string');
    const truongChu = ['text', 'prompt', 'input', 'gen_text', 'script'].find((x) => p[x]) ?? 'text';
    let truongGiong: string[] | null = null; let giong: string[] = [];
    for (const f of ['voice', 'voice_id', 'speaker', 'voice_name', 'preset_voice']) if (p[f]) { truongGiong = [f]; giong = giaTri(p[f]); break; }
    if (!truongGiong) for (const [f, v] of Object.entries(p)) {
      const con = ref(v)?.properties;
      if (con && /voice/.test(f)) { const t = ['voice_id', 'voice', 'name'].find((x) => con[x]); if (t) { truongGiong = [f, t]; giong = giaTri(con[t]); break; } }
    }
    const truongNgonNgu = ['language_code', 'language', 'language_boost', 'lang'].find((x) => p[x]) ?? null;
    const mt: MoTaGiong = { truongChu, truongGiong, giong: [...new Set(giong)].slice(0, 200), truongNgonNgu, ngonNgu: truongNgonNgu ? giaTri(p[truongNgonNgu]) : [] };
    khoMoTa.set(id, mt);
    return mt;
  } catch (e) { console.error('[giong] đọc OpenAPI', id, e); return rong; }
}

/** Danh sách giọng của một model (cho ô chọn). ElevenLabs trực tiếp: giọng trong tài khoản (tên + id). */
export async function giongCua(model: string): Promise<{ id: string; ten: string }[]> {
  if (model.startsWith('elevenlabs:')) {
    if (!coElevenTrucTiep()) return [];
    try {
      const r = await fetch(`${ELEVEN}/voices`, { headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY! } });
      const j = (await r.json()) as { voices?: Array<{ voice_id: string; name: string; category?: string; labels?: Record<string, string> }> };
      return (j.voices ?? []).map((v) => ({ id: v.voice_id, ten: `${v.name}${v.labels ? ` · ${Object.values(v.labels).filter(Boolean).slice(0, 3).join(', ')}` : ''}${v.category && v.category !== 'premade' ? ` (${v.category})` : ''}` }));
    } catch { return []; }
  }
  return (await moTaFal(model)).giong.map((g) => ({ id: g, ten: g }));
}

/** Đầu vào đúng khuôn của model: chữ + giọng + ngôn ngữ + cảm xúc (MiniMax có trường emotion; ElevenLabs v3 hiểu thẻ [sad]…). */
export async function dauVaoGiongTheoModel(model: string, v: { text: string; voice: string; ngonNgu: string; camXuc: number; theLoai: string }): Promise<Record<string, unknown>> {
  const buon = v.theLoai === 'kinh_di' ? 'fearful' : 'sad';
  const emotion = v.camXuc >= 3 ? 'happy' : v.camXuc <= -3 ? buon : 'neutral';
  const the = /eleven/.test(model) && /v3/.test(model) ? (v.camXuc >= 3 ? '[excited] ' : v.camXuc <= -3 ? (v.theLoai === 'kinh_di' ? '[whispers] ' : '[sad] ') : '') : '';
  if (model.startsWith('elevenlabs:')) return { text: the + v.text, voice_id: v.voice, model_id: model.slice('elevenlabs:'.length) };
  const mt = await moTaFal(model);
  const o: Record<string, unknown> = { [mt.truongChu]: the + v.text };
  if (mt.truongGiong && v.voice) {
    if (mt.truongGiong.length === 2) o[mt.truongGiong[0]!] = { [mt.truongGiong[1]!]: v.voice, ...(/minimax/.test(model) ? { emotion, speed: 1 } : {}) };
    else o[mt.truongGiong[0]!] = v.voice;
  }
  if (mt.truongNgonNgu) {
    const muon = v.ngonNgu === 'vi' ? ['Vietnamese', 'vi', 'vi-VN', 'vietnamese'] : ['English', 'en', 'en-US', 'english'];
    const hop = mt.ngonNgu.find((x) => muon.includes(x)) ?? (mt.ngonNgu.length ? null : muon[1]);
    if (hop) o[mt.truongNgonNgu] = hop;
  }
  if (/minimax/.test(model)) o.output_format = 'url';
  return o;
}

/** Gọi ElevenLabs trực tiếp (chạy được cả trong Worker): trả bytes mp3. */
export async function ttsElevenTrucTiep(input: { text: string; voice_id: string; model_id: string }, key: string): Promise<{ ok: true; data: ArrayBuffer } | { ok: false; loi: string }> {
  const r = await fetch(`${ELEVEN}/text-to-speech/${encodeURIComponent(input.voice_id)}?output_format=mp3_44100_128`, {
    method: 'POST', headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' },
    body: JSON.stringify({ text: input.text, model_id: input.model_id }),
  });
  if (!r.ok) return { ok: false, loi: `ElevenLabs ${r.status}: ${(await r.text()).slice(0, 200)}` };
  return { ok: true, data: await r.arrayBuffer() };
}
