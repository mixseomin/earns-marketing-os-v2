// CẦU NỐI VideoExpress.ai — THUẦN API (anh 27/10/2026 "nếu ko đc cứ dùng api qua token của họ"). Gọi chính các endpoint /ai/api/* + /library/*
// TỪ TRONG TRANG qua `br eval fetch`: same-origin nên COOKIE PHIÊN tự đính kèm = token của họ. Bỏ hẳn điều khiển DOM/picker (SPA React quá chập chờn).
// Giữ mặt nhân vật: nạp khung đã duyệt (so-N-that.png) làm khung đầu rồi image2video chỉ ra lệnh chuyển động — mặt/áo/thẻ giữ nguyên (kiểm 27/10).
// LƯU Ý: VideoExpress chỉ giữ file 40 ngày → lấy về ngay. Shot < 3s: sinh tối thiểu ~4s, dung-tu-video.mts cắt lại.
// Payload image2video bắt được 27/10: form-urlencoded, trả thẳng {success,uuid}. Upload: POST /library/upload/4 FormData{file,categoryId} → "OK".
// Tài khoản: vault acct #677 (profile br htuan82). Chạy sau khi `br use 677` + `br goto https://app.videoexpress.ai/` (để có phiên trong tab).
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';

import './videoexpress.mjs';   // gắn BR_PROFILE = profile riêng VideoExpress cho mọi lệnh br (chạy riêng vx-ke-chuyen cũng không phụ thuộc `br use` dùng chung)
const BR = `${process.env.HOME}/bin/br`;
export const ngu = (ms: number) => new Promise((r) => setTimeout(r, ms));
// MÃ CSRF (26/11/2026: từ 24/11 VideoExpress bắt mọi POST /ai/api/* kèm `_csrf_token` = options.aiApiCsrfToken in trong HTML trang; thiếu → 403
// "csrf_token_invalid · Your session has expired" → máy kể chuyện kẹt phim American Sniper 2 ngày). Gắn MỘT lần ở cầu nối: mỗi lệnh eval tự cài lớp bọc fetch
// của trang (đọc mã từ HTML hiện tại, nạp lại trang là đọc mã mới) → mọi chỗ gọi /ai/api/ (vx-ke-chuyen, vx-br, sau này) có mã, không chỗ nào phải tự nhớ.
const GAN_CSRF = `(()=>{if(window.__vxCsrf)return;const m=document.documentElement.outerHTML.match(/aiApiCsrfToken:\\s*'([^']+)'/);if(!m)return;const tok=m[1],f0=window.fetch.bind(window);window.fetch=(u,o)=>{if(o&&String(o.method||'').toUpperCase()==='POST'&&/\\/ai\\/api\\//.test(String(u))&&typeof o.body==='string'&&!/(^|&)_csrf_token=/.test(o.body))o={...o,body:o.body+(o.body?'&':'')+'_csrf_token='+encodeURIComponent(tok)};return f0(u,o)};window.__vxCsrf=1})()`;
export function brEval<T = unknown>(js: string): T {
  const out = execFileSync(BR, ['eval', '--main', `(${GAN_CSRF}, (${js}))`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const dong = out.trim().split('\n');
  for (let i = dong.length - 1; i >= 0; i--) { try { return JSON.parse(dong[i]) as T; } catch {} }
  return out.trim() as unknown as T;
}

export type VxItem = { id: number; name: string; uuid: string; isPending: boolean; mediaPath: string; frameSize: string; duration: number; extension: string };
export function getMedia(catId: number, limit = 50): { total: string; results: VxItem[] } {
  return brEval(`fetch("/api/library/get_media/4?categoryId=${catId}&page=1&start=0&limit=${limit}&orderBy=id&orderDir=desc",{headers:{"X-Requested-With":"XMLHttpRequest"}}).then(r=>r.json())`);
}
export function catId(ten: string): number {
  const j = brEval<{ data: { id: number; name: string }[] }>(`fetch("/library/get_categories/4",{headers:{"X-Requested-With":"XMLHttpRequest"}}).then(r=>r.json())`);
  const c = j.data.find((x) => x.name === ten);
  if (!c) throw new Error(`không thấy folder '${ten}' (${j.data.map((x) => x.name).join(', ')})`);
  return c.id;
}
export function trenApp(): boolean {
  const u = brEval<{ url?: string }>(`({url:location.href})`);
  return !!u.url && /app\.videoexpress\.ai/.test(u.url) && !/\/login/.test(u.url);
}

// NẠP khung lên folder Default qua fetch (base64 → Blob → FormData). Trả mediaId (id ảnh vừa nạp) hoặc null.
// base64 nạp theo MẢNH vào window.__b64 để không vượt giới hạn độ dài tham số lệnh (ảnh ~600KB → base64 ~800KB).
// Loại tệp nạp (11/11/2026: thêm âm thanh cho đường khớp môi — narration nạp file giọng vào thư mục 'audio')
const loaiTep = (f: string) => /\.mp3$/i.test(f) ? { mime: 'audio/mpeg', duoi: 'mp3' } : /\.wav$/i.test(f) ? { mime: 'audio/wav', duoi: 'wav' } : /\.jpe?g$/i.test(f) ? { mime: 'image/jpeg', duoi: 'jpg' } : { mime: 'image/png', duoi: 'png' };
export async function napKhung(file: string, catDefault: number): Promise<number | null> {
  const b64 = readFileSync(file).toString('base64');
  brEval(`window.__b64=""`);
  for (let i = 0; i < b64.length; i += 300_000) brEval(`window.__b64+=${JSON.stringify(b64.slice(i, i + 300_000))}`);
  const res = brEval<string>(`(async()=>{const s=window.__b64;const bin=atob(s);const a=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);const fd=new FormData();fd.append("file",new Blob([a],{type:"${loaiTep(file).mime}"}),"f.${loaiTep(file).duoi}");fd.append("categoryId","${catDefault}");const r=await fetch("/library/upload/4",{method:"POST",headers:{"X-Requested-With":"XMLHttpRequest"},body:fd});return (await r.text()).trim().slice(0,50)})()`);
  brEval(`window.__b64=""`);
  if (!/^OK$/i.test(res)) { console.log(`  ! upload hỏng: ${res}`); return null; }
  const moi = getMedia(catDefault, 1).results[0];           // ảnh mới nhất = ảnh vừa nạp (upload đồng bộ)
  return moi ? moi.id : null;
}

// GỬI image2video qua fetch. prompt = chỉ đạo chuyển động (+ lời thoại VN cho shot thoại — VideoExpress TỰ sinh tiếng, $0). Trả uuid. isShared=0, aspect 9:16.
// enhance=false cho shot THOẠI: giữ nguyên câu tiếng Việt, không để máy tự viết lại prompt (anh chốt 27/10 dùng native speech).
// lastMediaId (anh 29/10 "tập trung vào ảnh cuối shot và đầu shot sau"): có khung CUỐI → generator first_last_frame, clip chạy từ khung đầu → khung cuối.
//   Nối mạch: đặt khung cuối shot N = khung đầu shot N+1 → cú cắt liền, động tác không giật. (field bundle: mediaId + lastFrameMediaId + generatorName=first_last_frame)
// faceMediaId (01/11/2026): ảnh MẶT nhân vật → faceImageMediaId + faceSwap=1 — khung đầu không thấy mặt (chụp sau vai) thì model bịa mặt khi người quay ra máy
//   (A/B #2→#3 phim #353: 4/4 lượt trôi mặt); neo mặt bằng ảnh như @image của Seedance.
// aspect (02/11/2026): khổ của phim — trước đây ghi cứng 9:16, phim ngang 16:9 (MV gag) cần '16:9'.
// audioMediaId (11/11/2026, anh "voice làm sao khớp môi" → "làm giọng thế đi"): file GIỌNG của studio (MiniMax / ElevenLabs) đã nạp vào thư mục audio →
//   isNarrationVideo=1 — VideoExpress dựng clip miệng nhép theo đúng file đó (giọng cố định từng nhân vật, đúng từng chữ, không in phụ đề lạ).
// TRẦN + KHE VideoExpress (anh 27/11/2026: "tối đa 5 clip render song song, mỗi clip ~4 phút → ~75 clip/giờ, nhưng trần 300/ngày chặn trước").
// Trần ngày đếm ở ĐÂY (guiShot) nên mọi công cụ gửi việc (vx-mot, vx-tap, vx-gui, vx-cum…) cùng một sổ; ngày theo giờ Việt Nam.
// Khe song song đọc thẳng từ VideoExpress (số việc isPending trong My AI Videos) — tính cả việc của công cụ khác, không đoán bằng sổ riêng.
export const TRAN_NGAY = 300, KHE_SONG_SONG = 5;
const THU_SO = `${process.env.HOME}/.cache/videoexpress`;
const ngayVN = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const soNgay = () => `${THU_SO}/gui-${ngayVN()}.log`;
export function daGuiHomNay(): number { try { return readFileSync(soNgay(), 'utf8').split('\n').filter(Boolean).length; } catch { return 0; } }
/** chờ tới khi VideoExpress còn khe (việc đang render < KHE_SONG_SONG) rồi gửi. Khoá thư mục để nhiều tiến trình không cùng thấy "còn khe" rồi cùng gửi. */
export async function guiCoKhe(mediaId: number, prompt: string, enhance = true, hanGiay = 3600): Promise<{ uuid: string | null; loi?: string }> {
  mkdirSync(THU_SO, { recursive: true });
  const khoa = `${THU_SO}/gui.khoa`, t0 = Date.now();
  for (;;) {   // khoá: mkdir là thao tác nguyên tử; khoá bỏ quên > 3 phút (tiến trình chết) thì gỡ
    try { mkdirSync(khoa); break; } catch {
      try { if (Date.now() - statSync(khoa).mtimeMs > 180e3) rmSync(khoa, { recursive: true, force: true }); } catch {}
      if (Date.now() - t0 > hanGiay * 1000) return { uuid: null, loi: `chờ khoá gửi VideoExpress quá ${Math.round(hanGiay / 60)} phút` };
      await ngu(3000);
    }
  }
  try {
    const cat = catId('my_ai_videos');
    for (;;) {
      if (daGuiHomNay() >= TRAN_NGAY) return { uuid: null, loi: `hết trần VideoExpress ${TRAN_NGAY} clip/ngày (${ngayVN()}, giờ VN)` };
      let dang = KHE_SONG_SONG;
      try { dang = getMedia(cat, 60).results.filter((x) => x.isPending).length; } catch {}
      if (dang < KHE_SONG_SONG) break;
      if (Date.now() - t0 > hanGiay * 1000) return { uuid: null, loi: `VideoExpress kín ${KHE_SONG_SONG} khe quá ${Math.round(hanGiay / 60)} phút` };
      await ngu(15_000);
    }
    const uuid = guiShot(mediaId, prompt, enhance);
    if (!uuid) return { uuid: null, loi: 'VideoExpress từ chối image2video' };
    for (let i = 0; i < 6; i++) {   // giữ khoá tới khi việc mới hiện trong danh sách (đếm khe lần sau mới đúng)
      try { if (getMedia(cat, 60).results.some((x) => x.uuid === uuid)) break; } catch {}
      await ngu(5000);
    }
    return { uuid };
  } finally { try { rmSync(khoa, { recursive: true, force: true }); } catch {} }
}
export function guiShot(mediaId: number, prompt: string, enhance = true, lastMediaId = 0, faceMediaId = 0, aspect: '9:16' | '16:9' | '1:1' = '9:16', audioMediaId = 0): string | null {
  const daGui = daGuiHomNay();
  if (daGui >= TRAN_NGAY) { console.log(`  ! hết trần VideoExpress ${TRAN_NGAY} clip/ngày (${ngayVN()}) — không gửi`); return null; }
  const noi = lastMediaId > 0;
  const body = [
    'type=human', 'imagePrompt=', `prompt=${encodeURIComponent(prompt)}`, 'uuid=', `mediaId=${mediaId}`,
    'lastFrameUuid=', `lastFrameMediaId=${noi ? lastMediaId : 0}`,
    `audioMediaId=${audioMediaId}`, 'isShared=0', `aspect=${encodeURIComponent(aspect)}`, 'enhanceHumanFace=0', 'isTalkingVideoFromText=0',
    `isNarrationVideo=${audioMediaId ? 1 : 0}`, `enhanceVideoPrompt=${enhance ? 1 : 0}`, 'videoOnly=0', 'speed=', `generatorName=${noi ? 'first_last_frame' : 'create_from_prompt'}`,
    `faceImageMediaId=${faceMediaId}`, `faceSwap=${faceMediaId ? 1 : 0}`, 'mode=',
  ].join('&');
  const r = brEval<{ success?: boolean; uuid?: string; message?: string }>(
    `fetch("/ai/api/image2video",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded; charset=UTF-8","X-Requested-With":"XMLHttpRequest"},body:${JSON.stringify(body)}}).then(r=>r.json()).catch(e=>({success:false,message:String(e)}))`,
  );
  if (!r.success || !r.uuid) { console.log(`  ! image2video từ chối: ${r.message ?? JSON.stringify(r)}`); return null; }
  try { mkdirSync(THU_SO, { recursive: true }); appendFileSync(soNgay(), `${r.uuid}\n`); } catch {}
  return r.uuid;
}
