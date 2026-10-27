// CẦU NỐI br ↔ VideoExpress.ai (anh 27/10/2026 "dựng đi") — thư viện dùng chung cho vx-gui.mts (gửi lô) + vx-lay.mts (lấy về).
// $0: lái ĐÚNG giao diện web qua `br` như người thật (nạp ảnh → Image to Video → Create Video), KHÔNG gọi thẳng API riêng bằng cookie → không đụng ToS.
// Giữ mặt nhân vật: nạp KHUNG ĐÃ DUYỆT của studio (so-N-that.png) làm khung đầu, chỉ ra lệnh chuyển động — mặt/áo/thẻ giữ nguyên (đã kiểm 27/10 với Hạ).
// LƯU Ý: VideoExpress chỉ giữ file 40 ngày → lấy về ngay. Shot < 3s: nó sinh tối thiểu ~4s, dung-tu-video.mts cắt lại theo giây phát.
// Tài khoản: vault acct #677 (profile br htuan82). Chạy sau khi `br use 677` + app mở ở màn editor.
import { execFileSync } from 'node:child_process';

const BR = `${process.env.HOME}/bin/br`;
export const ngu = (ms: number) => new Promise((r) => setTimeout(r, ms));

// br eval --main: trả JSON ở DÒNG CUỐI (daemon có thể in dòng khai trước) → lấy dòng cuối cùng parse được.
export function brEval<T = unknown>(js: string): T {
  const out = execFileSync(BR, ['eval', '--main', js], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const dong = out.trim().split('\n');
  for (let i = dong.length - 1; i >= 0; i--) { try { return JSON.parse(dong[i]) as T; } catch {} }
  return out.trim() as unknown as T;
}
export const brClick = (sel: string) => { try { execFileSync(BR, ['click', sel], { encoding: 'utf8' }); } catch {} };
export const brPost = (verb: string, body: Record<string, unknown>) =>
  execFileSync(BR, ['post', verb, JSON.stringify(body)], { encoding: 'utf8' });

// đọc danh sách media một category (fetch cùng nguồn trong trang — đọc thư viện của chính mình, lành)
export function getMedia(catId: number, limit = 50): { total: string; results: VxItem[] } {
  return brEval(`fetch("/api/library/get_media/4?categoryId=${catId}&page=1&start=0&limit=${limit}&orderBy=id&orderDir=desc",{headers:{"X-Requested-With":"XMLHttpRequest"}}).then(r=>r.json())`);
}
export type VxItem = { id: number; name: string; uuid: string; isPending: boolean; mediaPath: string; fileName: string; extension: string; frameSize: string; duration: number };

// map tên folder → categoryId (id theo tài khoản, tên cố định: default / my_ai_videos / images …)
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

// NẠP một khung lên folder Default, đặt media-name = tag (để Use from Library tìm lại). Bỏ qua nếu tag đã có.
export async function napKhung(file: string, tag: string, catDefault: number): Promise<void> {
  const daCo = getMedia(catDefault, 100).results.some((r) => r.name === tag);
  if (daCo) { console.log(`  · ${tag}: đã có trong thư viện, bỏ qua nạp`); return; }
  brClick('Media Library'); await ngu(1500);
  // mở folder Default
  brEval(`(()=>{const l=[...document.querySelectorAll("*")].find(x=>/^Default$/.test((x.textContent||"").trim())&&x.querySelectorAll("*").length<2&&x.offsetParent);if(!l)return 0;const t=l.closest("div"),r=t.getBoundingClientRect();["mousedown","mouseup","click","dblclick"].forEach(e=>t.dispatchEvent(new MouseEvent(e,{bubbles:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2})));return 1})()`);
  await ngu(1500);
  // nút "Upload file" tạo <input type=file> ẩn
  brEval(`(()=>{const b=[...document.querySelectorAll("button,a,label,div,span")].find(x=>/^Upload file$/i.test((x.textContent||"").trim())&&x.offsetParent);if(b)b.click();return document.querySelectorAll("input[type=file]").length})()`);
  await ngu(600);
  brPost('upload', { selector: 'input[type=file]', file }); // daemon /upload = setInputFiles (không cần hộp thoại OS)
  await ngu(1200);
  // đặt media-name = tag rồi bấm "Upload files"
  brEval(`(()=>{const inp=[...document.querySelectorAll("input[type=text]")].find(i=>i.offsetParent&&/upload media/i.test(i.closest("[class]")?.parentElement?.innerText||document.body.innerText));const set=(el,v)=>{const d=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,"value").set;d.call(el,v);el.dispatchEvent(new Event("input",{bubbles:true}))};if(inp)set(inp,${JSON.stringify(tag)});const b=[...document.querySelectorAll("button")].find(x=>/^\\s*Upload files\\s*$/i.test((x.textContent||"").trim())&&x.offsetParent);if(b)b.click();return !!b})()`);
  // chờ xong (hộp "Upload Media" biến mất hoặc tag xuất hiện)
  for (let i = 0; i < 24; i++) {
    await ngu(2500);
    const ok = brEval<boolean>(`(()=>{const dlg=/Upload Media/i.test(document.body.innerText);return !dlg})()`);
    if (ok) break;
  }
  // đóng hộp nếu còn
  brEval(`(()=>{const c=[...document.querySelectorAll("button")].find(x=>x.textContent.trim()==="Close"&&x.offsetParent);if(c)c.click();return 1})()`);
  await ngu(800);
  console.log(`  · ${tag}: đã nạp`);
}

// GỬI một shot: mở Create Video From Prompt → 9:16 → prompt chuyển động → Use from Library (tìm tag) → Create Video.
// Trả uuid của job vừa tạo (item my_ai_videos mới nhất chưa có trong daBiet), hoặc null.
export async function guiShot(tag: string, prompt: string, catVideo: number, daBiet: Set<string>): Promise<string | null> {
  brClick('Create with AI'); await ngu(1800);
  brClick('Create Video From Prompt'); await ngu(1800);
  // 9:16 + prompt chuyển động vào ô "Video and Audio Prompt" (ta[1]) + xoá ta[0] + TẮT auto-enhance
  brEval(`(()=>{const v=[...document.querySelectorAll("button")].find(x=>/vertical 9:16/i.test(x.textContent)&&x.offsetParent&&x.getBoundingClientRect().top<160);if(v)v.click();const ta=document.querySelectorAll("textarea");const set=(el,val)=>{const d=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,"value").set;d.call(el,val);el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}))};if(ta[0])set(ta[0],"");if(ta[1])set(ta[1],${JSON.stringify(prompt)});const enh=[...document.querySelectorAll("input[type=checkbox]")].find(c=>/enhance my image/i.test(c.closest("label")?.textContent||c.parentElement?.textContent||""));if(enh&&enh.checked)enh.click();return 1})()`);
  await ngu(600);
  // Use from Library → mở Default → Search tag → chọn → Choose
  brEval(`(()=>{const b=[...document.querySelectorAll("button,a,label")].find(x=>/use from library/i.test(x.textContent||"")&&x.offsetParent);if(b)b.click();return 1})()`);
  await ngu(2500);
  brEval(`(()=>{const l=[...document.querySelectorAll("*")].find(x=>/^Default$/.test((x.textContent||"").trim())&&x.querySelectorAll("*").length<2&&x.offsetParent);if(l){const t=l.closest("div"),r=t.getBoundingClientRect();["mousedown","mouseup","click","dblclick"].forEach(e=>t.dispatchEvent(new MouseEvent(e,{bubbles:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2})));}return 1})()`);
  await ngu(1800);
  brEval(`(()=>{const s=[...document.querySelectorAll("input")].find(i=>i.offsetParent&&/search/i.test(i.placeholder||""));const set=(el,v)=>{const d=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,"value").set;d.call(el,v);el.dispatchEvent(new Event("input",{bubbles:true}))};if(s)set(s,${JSON.stringify(tag)});return !!s})()`);
  await ngu(1800);
  const chon = brEval<string>(`(()=>{document.body.click();const tile=[...document.querySelectorAll("[style*=background-image]")].find(x=>/cdn-ny-b|userfiles/i.test(getComputedStyle(x).backgroundImage||"")&&x.getBoundingClientRect().width>80);if(!tile)return "no-tile";const r=tile.getBoundingClientRect();tile.dispatchEvent(new MouseEvent("click",{bubbles:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2}));const c=[...document.querySelectorAll("button")].find(x=>/^\\s*Choose\\s*$/i.test((x.textContent||"").trim())&&x.offsetParent);if(c){c.click();return "chose"}return "no-choose"})()`);
  if (chon !== 'chose') { console.log(`  ! ${tag}: không chọn được khung (${chon})`); brEval(`(()=>{const c=[...document.querySelectorAll("button")].find(x=>x.textContent.trim()==="Close"&&x.offsetParent);if(c)c.click();return 1})()`); return null; }
  await ngu(2000);
  const cvOk = brEval<boolean>(`(()=>{const cv=[...document.querySelectorAll("button")].find(x=>/create video/i.test(x.textContent)&&x.offsetParent);return cv?!cv.disabled:false})()`);
  if (!cvOk) { console.log(`  ! ${tag}: nút Create Video chưa bật`); return null; }
  brClick('Create Video'); await ngu(4000);
  const err = brEval<string>(`(()=>{const t=document.body.innerText;return (t.match(/(error|limit|exceed|maximum|not enough|insufficient)[^\\n]{0,40}/i)||[""])[0]})()`);
  if (err) { console.log(`  ! ${tag}: ${err}`); return null; }
  // khớp uuid: item my_ai_videos mới nhất chưa biết (POST image2video không trả uuid ra URL → đọc list ngay)
  for (let i = 0; i < 6; i++) {
    await ngu(2500);
    const moi = getMedia(catVideo, 5).results.find((r) => !daBiet.has(r.uuid));
    if (moi) { daBiet.add(moi.uuid); return moi.uuid; }
  }
  return null;
}
