// CẦU NỐI VideoExpress.ai — THUẦN API (anh 27/10/2026 "nếu ko đc cứ dùng api qua token của họ"). Gọi chính các endpoint /ai/api/* + /library/*
// TỪ TRONG TRANG qua `br eval fetch`: same-origin nên COOKIE PHIÊN tự đính kèm = token của họ. Bỏ hẳn điều khiển DOM/picker (SPA React quá chập chờn).
// Giữ mặt nhân vật: nạp khung đã duyệt (so-N-that.png) làm khung đầu rồi image2video chỉ ra lệnh chuyển động — mặt/áo/thẻ giữ nguyên (kiểm 27/10).
// LƯU Ý: VideoExpress chỉ giữ file 40 ngày → lấy về ngay. Shot < 3s: sinh tối thiểu ~4s, dung-tu-video.mts cắt lại.
// Payload image2video bắt được 27/10: form-urlencoded, trả thẳng {success,uuid}. Upload: POST /library/upload/4 FormData{file,categoryId} → "OK".
// Tài khoản: vault acct #677 (profile br htuan82). Chạy sau khi `br use 677` + `br goto https://app.videoexpress.ai/` (để có phiên trong tab).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const BR = `${process.env.HOME}/bin/br`;
export const ngu = (ms: number) => new Promise((r) => setTimeout(r, ms));
export function brEval<T = unknown>(js: string): T {
  const out = execFileSync(BR, ['eval', '--main', js], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
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
export async function napKhung(file: string, catDefault: number): Promise<number | null> {
  const b64 = readFileSync(file).toString('base64');
  brEval(`window.__b64=""`);
  for (let i = 0; i < b64.length; i += 300_000) brEval(`window.__b64+=${JSON.stringify(b64.slice(i, i + 300_000))}`);
  const res = brEval<string>(`(async()=>{const s=window.__b64;const bin=atob(s);const a=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);const fd=new FormData();fd.append("file",new Blob([a],{type:"image/png"}),"f.png");fd.append("categoryId","${catDefault}");const r=await fetch("/library/upload/4",{method:"POST",headers:{"X-Requested-With":"XMLHttpRequest"},body:fd});return (await r.text()).trim().slice(0,50)})()`);
  brEval(`window.__b64=""`);
  if (!/^OK$/i.test(res)) { console.log(`  ! upload hỏng: ${res}`); return null; }
  const moi = getMedia(catDefault, 1).results[0];           // ảnh mới nhất = ảnh vừa nạp (upload đồng bộ)
  return moi ? moi.id : null;
}

// GỬI image2video qua fetch. prompt = chỉ đạo chuyển động (+ lời thoại VN cho shot thoại — VideoExpress TỰ sinh tiếng, $0). Trả uuid. isShared=0, aspect 9:16.
// enhance=false cho shot THOẠI: giữ nguyên câu tiếng Việt, không để máy tự viết lại prompt (anh chốt 27/10 dùng native speech).
export function guiShot(mediaId: number, prompt: string, enhance = true): string | null {
  const body = [
    'type=human', 'imagePrompt=', `prompt=${encodeURIComponent(prompt)}`, 'uuid=', `mediaId=${mediaId}`,
    'audioMediaId=0', 'isShared=0', 'aspect=9%3A16', 'enhanceHumanFace=0', 'isTalkingVideoFromText=0',
    'isNarrationVideo=0', `enhanceVideoPrompt=${enhance ? 1 : 0}`, 'videoOnly=0', 'speed=', 'generatorName=create_from_prompt',
    'faceImageMediaId=0', 'faceSwap=0', 'mode=',
  ].join('&');
  const r = brEval<{ success?: boolean; uuid?: string; message?: string }>(
    `fetch("/ai/api/image2video",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded; charset=UTF-8","X-Requested-With":"XMLHttpRequest"},body:${JSON.stringify(body)}}).then(r=>r.json()).catch(e=>({success:false,message:String(e)}))`,
  );
  if (!r.success || !r.uuid) { console.log(`  ! image2video từ chối: ${r.message ?? JSON.stringify(r)}`); return null; }
  return r.uuid;
}
