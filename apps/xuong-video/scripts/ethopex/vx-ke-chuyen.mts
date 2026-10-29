// PHIM QC KỂ CHUYỆN BẰNG VideoExpress — $0 (anh 29/10/2026: "các video dạng kể truyện trc dùng các model AI để sinh nên tốn tiền… VideoExpress free thì thử làm 1 film").
// Thay ba bước tốn tiền của tu-lam-phim (keyframe nano-banana · clip Veo · giọng ElevenLabs) bằng ba tính năng VideoExpress đã mua (tk #677 htuan82):
//   giọng  POST /import/text_to_speech (Microsoft Neural, có cảm xúc)            → kết quả qua websocket {mediaUrl}
//   ảnh    POST /ai/api/generate_image_consistent_character (mẫu = poster phim) → websocket → preview/<uuid>.jpg  — giữ mặt / áo nhân vật theo poster
//   clip   POST /ai/api/image2video (uuid ảnh vừa sinh, videoOnly, dài theo giọng) → My AI Videos khớp uuid → mp4
// Chạy trên iMac (br giữ phiên VideoExpress), đọc kịch bản tập từ box3, tải mọi thứ về ~/.cache/ethopex/vx-kc/<tap>/; sổ so.json cho chạy tiếp khi đứt.
// Ghép MP4 = scripts/ethopex/vx-nap-tap.mts trên box3 (nạp R2 + ghi xv_canh + chayXuat của studio, 0đ).
//   ~/bin/br use 677 && ~/bin/br goto https://app.videoexpress.ai/
//   cd /Users/htuan/Me/GitHub/earns-marketing-os-v2/apps/xuong-video && ../../node_modules/.bin/tsx scripts/ethopex/vx-ke-chuyen.mts --tap=646 [--giong=en-US-AvaMultilingualNeural] [--toc=1.1]
// VideoExpress chỉ cho 5 clip render song song và giữ file 40 ngày → gửi theo nhịp ≤ 5, tải về ngay.
import { execFileSync, execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { brEval, catId, getMedia, napKhung, ngu, trenApp } from '../vx-br.mts';

const gia = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const tap = Number(gia('tap'));
if (!tap) { console.error('cần --tap=<id tập>'); process.exit(1); }
const GIONG = gia('giong') ?? 'en-US-AvaMultilingualNeural';
// tốc độ đọc: thanh của VideoExpress 0,5–2, mặc định 1 — gửi 0 bị kẹp về 0,5 (đọc chậm gấp đôi, lỗi lần chạy đầu 29/10); QC kể chuyện đọc nhanh hơn thường một chút
const TOC = gia('toc') ?? '1.1';
const SONG_SONG = 5;
const D = `${process.env.HOME}/.cache/ethopex/vx-kc/${tap}`; mkdirSync(D, { recursive: true });
type Canh = { id: number; so: number; giay: number; loi: string; anh: string; dong: string; chu: string; pd: string };
type Ghi = { tts?: string; am?: string; amGiay?: number; anhUuid?: string; anh?: string; vidUuid?: string; vid?: string; vidGiay?: number };

// ── kịch bản tập từ box3 (một lần, giữ ở tap.json) ──
const tepTap = `${D}/tap.json`;
if (!existsSync(tepTap)) {
  const q = (s: string) => execFileSync('ssh', ['root@167.233.241.16', `cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; psql "$DATABASE_URL" -tAc ${JSON.stringify(s)}`], { encoding: 'utf8' }).trim();
  const canh = JSON.parse(q(`select json_agg(json_build_object('id',id,'so',thu_tu,'giay',thoi_luong_s,'loi',loi_thoai,'anh',prompt_anh,'dong',prompt_video,'chu',chu_man,'pd',phan_doan) order by thu_tu) from xv_canh where tap_id=${tap}`));
  const meta = JSON.parse(q(`select row_to_json(x) from (select p.id phim, p.poster_url, p.kinh_thanh->>'ngon_ngu' lang, (select mo_ta from xv_nhan_vat where phim_id=p.id and loai='nhan_vat' limit 1) cast_ from xv_tap t join xv_phim p on p.id=t.phim_id where t.id=${tap}) x`));
  writeFileSync(tepTap, JSON.stringify({ meta, canh }, null, 1));
}
const { meta, canh } = JSON.parse(readFileSync(tepTap, 'utf8')) as { meta: { phim: number; poster_url: string; lang: string; cast_: string }; canh: Canh[] };
const tepSo = `${D}/so.json`;
const so: { poster?: number; canh: Record<string, Ghi> } = existsSync(tepSo) ? JSON.parse(readFileSync(tepSo, 'utf8')) : { canh: {} };
const luu = () => writeFileSync(tepSo, JSON.stringify(so, null, 1));
const g = (c: Canh) => (so.canh[c.so] ??= {});
const giayTep = (f: string) => Number(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 ${JSON.stringify(f)}`, { encoding: 'utf8' }).trim());
const tai = (url: string, f: string) => execFileSync('curl', ['-sSfL', '-o', f, url]);

if (!trenApp()) { console.error('br chưa ở app.videoexpress.ai — chạy: ~/bin/br use 677 && ~/bin/br goto https://app.videoexpress.ai/'); process.exit(2); }
const HDR = `{"Content-Type":"application/x-www-form-urlencoded; charset=UTF-8","X-Requested-With":"XMLHttpRequest"}`;
// gửi + đăng ký websocket TRONG CÙNG một lượt eval (kết quả ảnh / giọng chỉ đẩy qua websocket lúc vừa xong — đăng ký muộn là mất)
const gui = (duong: string, du: Record<string, string>): { success?: boolean; uuid?: string; msg?: string; message?: string } => brEval(`(async()=>{window.__vx=window.__vx||{};
  const r=await (await fetch(${JSON.stringify(duong)},{method:"POST",headers:${HDR},body:${JSON.stringify(new URLSearchParams(du).toString())}})).json().catch(e=>({success:false,msg:String(e)}));
  if(r.uuid)app.createSubscription(r.uuid,(u,x)=>{window.__vx[u]=x});return r})()`);
const ketQua = (): Record<string, string> => { const x = brEval<unknown>(`JSON.stringify(window.__vx||{})`); return typeof x === 'string' ? JSON.parse(x) : (x as Record<string, string>); };
async function cho(uuids: string[], phut: number) {
  for (let t = 0; t < phut * 6; t++) { const k = ketQua(); if (uuids.every((u) => k[u])) return k; await ngu(10_000); }
  return ketQua();
}

// ── 1. GIỌNG kể từng cảnh (biết độ dài giọng trước → đặt độ dài clip) ──
const chuaAm = canh.filter((c) => !g(c).am);
for (const c of chuaAm) {
  const r = gui('/import/text_to_speech', { text: c.loi, lang: meta.lang === 'es' ? 'es-MX' : 'en-US', voice: GIONG, emotion: '', translate: '0', project_id: '0', gender: '', type: 'microsoft', option_speed: TOC, option_pitch: '0' });
  if (!r.uuid) { console.log(`✗ giọng #${c.so}: ${r.msg ?? r.message ?? JSON.stringify(r)}`); continue; }
  g(c).tts = r.uuid;
}
luu();
if (chuaAm.length) {
  const k = await cho(chuaAm.map((c) => g(c).tts!).filter(Boolean), 5);
  for (const c of chuaAm) { const x = k[g(c).tts!]; if (!x) { console.log(`✗ giọng #${c.so}: chưa về`); continue; }
    const f = `${D}/am-${c.so}.mp3`; tai((JSON.parse(x) as { mediaUrl: string }).mediaUrl, f); g(c).am = f; g(c).amGiay = giayTep(f); console.log(`✓ giọng #${c.so} ${g(c).amGiay!.toFixed(1)}s`); }
  luu();
}

// ── 2. ẢNH từng cảnh, mẫu nhân vật = poster ──
if (!so.poster) {
  const f = `${D}/poster.png`; if (!existsSync(f)) { tai(meta.poster_url, `${D}/poster.src`); execSync(`ffmpeg -loglevel error -y -i ${JSON.stringify(`${D}/poster.src`)} ${JSON.stringify(f)}`); }
  so.poster = (await napKhung(f, catId('default'))) ?? undefined; luu();
  if (!so.poster) { console.error('✗ không nạp được poster'); process.exit(1); }
}
// CHỈ nhân vật cảnh này gọi tên (VIẾT HOA trong prompt_anh) — nhét cả dàn vai vào mọi cảnh thì cảnh nào cũng ra cả đoàn như poster, còn nhân đôi nhân vật (lần chạy đầu 29/10)
const VAI = meta.cast_.replace(/^[^:]*:\s*/, '').split(/;\s*/).map((x) => { const i = x.indexOf('='); return { ten: x.slice(0, i).trim(), ta: x.slice(i + 1).trim() }; }).filter((v) => v.ten);
const vaiCua = (c: Canh) => VAI.filter((v) => new RegExp(`\\b${v.ten}\\b`).test(c.anh));
const chuaAnh = canh.filter((c) => !g(c).anh);
for (const c of chuaAnh) {
  const prompt = `Photorealistic cinematic vertical short-drama film still, real actors, dramatic warm lighting, shallow depth of field, glossy high-end color grade. ${vaiCua(c).length ? `Only these people appear, each exactly once (match the reference photo faces, hair and wardrobe): ${vaiCua(c).map((v) => `${v.ten} = ${v.ta}`).join('; ')}. Other background people are strangers, not from the reference. ` : ''}Scene: ${c.anh} No text, no captions, no logo, no watermark.`.slice(0, 1800);
  const r = gui('/ai/api/generate_image_consistent_character', { prompt, type: 'photorealistic', mediaId: String(so.poster), mediaId2: '0', aspect: '9:16', generatorName: 'consistent_character' });
  if (!r.uuid) { console.log(`✗ ảnh #${c.so}: ${r.msg ?? r.message ?? JSON.stringify(r)}`); continue; }
  g(c).anhUuid = r.uuid;
}
luu();
if (chuaAnh.length) {
  const k = await cho(chuaAnh.map((c) => g(c).anhUuid!).filter(Boolean), 6);
  for (const c of chuaAnh) { const x = k[g(c).anhUuid!]; if (!x || !/^https?:/.test(x)) { console.log(`✗ ảnh #${c.so}: ${x ?? 'chưa về'}`); continue; }
    const f = `${D}/anh-${c.so}.jpg`; tai(x, f); g(c).anh = f; console.log(`✓ ảnh #${c.so}`); }
  luu();
}

if (process.argv.includes('--chi-anh')) { console.log(`ảnh + giọng xong ở ${D} — soát ảnh rồi chạy lại không có --chi-anh để sinh clip`); process.exit(0); }

// ── 3. CLIP từ ảnh: không tiếng (giọng kể lồng sau), dài = giọng + 0,8s, trong 4–8s; tối đa 5 render song song ──
const VID = catId('my_ai_videos');
const doiClip = () => canh.filter((c) => g(c).anhUuid && g(c).anh && !g(c).vid);
for (let nhip = 0; nhip < 40 && doiClip().length; nhip++) {
  const ds = getMedia(VID, 60).results;
  for (const c of doiClip().filter((c) => g(c).vidUuid)) {
    const m = ds.find((x) => x.uuid === g(c).vidUuid);
    if (m && !m.isPending && m.mediaPath) { const f = `${D}/vid-${c.so}.mp4`; tai(m.mediaPath, f); g(c).vid = f; g(c).vidGiay = giayTep(f); console.log(`✓ clip #${c.so} ${g(c).vidGiay!.toFixed(1)}s`); }
  }
  const dangChay = doiClip().filter((c) => g(c).vidUuid).length;
  for (const c of doiClip().filter((c) => !g(c).vidUuid).slice(0, Math.max(0, SONG_SONG - dangChay))) {
    const dai = Math.min(8, Math.max(4, Math.ceil((g(c).amGiay ?? c.giay) + 0.8)));
    const prompt = `Photorealistic live-action vertical short-drama clip; the first frame is exact — keep every face, hair, outfit and the set unchanged. ${c.dong} Natural, motivated movement; background stays fixed. The narration is an off-screen voice-over: nobody in frame talks or moves their lips. No on-screen text.`;
    const r = brEval<{ success?: boolean; uuid?: string; msg?: string; message?: string }>(`fetch("/ai/api/image2video",{method:"POST",headers:${HDR},body:${JSON.stringify(new URLSearchParams({ type: 'photorealistic', imagePrompt: '', prompt, uuid: g(c).anhUuid!, imageUuid: g(c).anhUuid!, mediaId: '0', saveImage: '1', audioMediaId: '0', isShared: '0', aspect: '9:16', enhanceHumanFace: '0', improveHumanFace: '0', isTalkingVideoFromText: '0', isNarrationVideo: '0', enhanceVideoPrompt: '0', videoOnly: '1', videoLength: String(dai), mode: 'advanced', speed: '', generatorName: 'create_from_prompt', faceImageMediaId: '0', faceSwap: '0' }).toString())}}).then(r=>r.json()).catch(e=>({success:false,msg:String(e)}))`);
    if (!r.uuid) { console.log(`✗ clip #${c.so}: ${r.msg ?? r.message ?? JSON.stringify(r)}`); break; }
    g(c).vidUuid = r.uuid; console.log(`→ gửi clip #${c.so} (${dai}s)`);
  }
  luu();
  if (doiClip().length) await ngu(40_000);
}
const thieu = canh.filter((c) => !g(c).am || !g(c).anh || !g(c).vid).map((c) => `#${c.so}`);
console.log(thieu.length ? `chưa đủ: ${thieu.join(' ')} — chạy lại lệnh để làm tiếp` : `✓ đủ ${canh.length} cảnh ở ${D} — nạp + xuất: scripts/ethopex/vx-nap-tap.mts trên box3`);
process.exit(thieu.length ? 1 : 0);
