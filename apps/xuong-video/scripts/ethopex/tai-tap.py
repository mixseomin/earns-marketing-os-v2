#!/usr/bin/env python3
"""TẢI TẬP PHIM TỪ SITE GỐC (anh 21/10/2026: đợt NetShort + DramaBox — creative cắt đoạn 20–30s + 2–3' trong phim; nguồn = tập miễn phí trên site,
không phụ thuộc QC spy). Chỉ đọc trang công khai + tải mp4 tập miễn phí (NetShort mở ~tập 1–8, DramaBox tập đầu) + poster (og:image).
Dùng: tai-tap.py <link phim> <thư mục ra> [số tập=3]  → <ra>/tap01.mp4 …, <ra>/poster.jpg, <ra>/tap.json ([{tap, giay, url}])"""
import html as H, json, os, re, subprocess, sys, urllib.request

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
def lay(url, ref=None):
    h = {"User-Agent": UA, "Accept": "text/html,image/avif,image/webp,image/*,*/*;q=0.8"}
    if ref: h["Referer"] = ref
    return urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=40).read()
def sach(u): return u.replace("\\u0026", "&").replace("\\u002F", "/").replace("\\/", "/").rstrip("\\")

def video_trong(html):
    """link mp4 của tập đang mở trên trang (NetShort cfcdn · DramaBox hwvideo…narrowv3.mp4)"""
    for m in re.findall(r'https?:(?:\\u002F|\\?/){2}cfcdn\.netshort\.com[^"\s]+', html): return sach(m)
    for m in re.findall(r'https?:(?:\\u002F|\\?/){2}[^"\s]*dramaboxdb\.com[^"\s]+?\.mp4\?[^"\s]+', html): return sach(m)
    return None

def tap_url(goc, html, n):
    if "netshort.com" in goc: return goc if n == 1 else f"{goc.split('?')[0]}-ep-{n}"
    m = [sach(x) for x in re.findall(r'(?:https?://www\.dramabox\.com)?/video/\d{11}_[^"\s/]+/\d+_Episode-' + str(n) + r'\b', html)]
    return (m[0] if m[0].startswith("http") else "https://www.dramabox.com" + m[0]) if m else (goc if n == 1 else None)

def main(goc, ra, so=3):
    os.makedirs(ra, exist_ok=True)
    html1 = lay(goc).decode("utf-8", "ignore"); kq = []
    og = re.search(r'<meta[^>]+property="og:image"[^>]+content="([^"]+)"|<meta[^>]+content="([^"]+)"[^>]+property="og:image"', html1)
    if og:
        try:
            u = H.unescape(og.group(1) or og.group(2)).split("@")[0]   # 21/10/2026: tên có dấu nháy ra "&#x27;" → 400 nếu không giải mã HTML
            b = lay(u, ref=goc)
            if len(b) < 2000 or b[:1] in (b"<", b"{"): raise ValueError("poster không phải ảnh")
            open(os.path.join(ra, "poster.jpg"), "wb").write(b)
        except Exception as e: print("poster loi:", e, file=sys.stderr)
    for n in range(1, so + 1):
        u = tap_url(goc, html1, n)
        if not u: break
        html = html1 if n == 1 else lay(u).decode("utf-8", "ignore")
        v = video_trong(html)
        if not v: print(f"tap {n}: khong co video (khoa / het tap mien phi)", file=sys.stderr); break
        ra_tap = os.path.join(ra, f"tap{n:02d}.mp4")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-headers", f"User-Agent: {UA}\r\nReferer: {goc}\r\n", "-i", v, "-c", "copy", ra_tap], check=True, timeout=900)
        giay = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", ra_tap]).strip() or 0)
        kq.append({"tap": n, "giay": round(giay, 1), "url": u})
    json.dump(kq, open(os.path.join(ra, "tap.json"), "w"), ensure_ascii=False)
    print(json.dumps({"phim": goc, "tap": [(x["tap"], x["giay"]) for x in kq], "poster": os.path.exists(os.path.join(ra, "poster.jpg")) and os.path.getsize(os.path.join(ra, "poster.jpg")) > 2000}, ensure_ascii=False))

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 3)
