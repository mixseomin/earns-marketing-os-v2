"""SOÁT 18+ PHIM BẰNG AI (anh 02/11/2026 chọn "A": nhận phim ở chế độ Tự động thì máy tự lên camp — bước soát poster thay Claude xem tay).
Poster phim (etp.thu_vien_phim.anh, CDN dofez) + tên + tóm tắt (trang tập 1 nguồn) → mô hình nhìn ảnh rẻ qua ckey (tuyến sống, Haiku trước — cùng đường nhom_goc.py)
→ ghi qua ĐÚNG lệnh soát hiện có: kiem-phim-18.py --soat <id> ok|cam "<ghi>" (sổ ethopex_soat_18; cam = kèm danh sách cấm) — mọi cổng (máy sinh, nhan-ban) đọc sổ đó.
Luật = luật soát poster của quy trình phim mới (phim-moi.py): máu / vết thương · súng / vũ khí · gợi dục / nội y / hở hang · cởi trần ôm hôn / giường · khoả thân → loại.
Không chấm được (lỗi mạng / ảnh) → trả None, KHÔNG ghi sổ (cổng vẫn chặn — kín).
  python3 apps/etp/soat_18_ai.py <content_id…> [--ghi]   (không --ghi: chỉ in)"""
import json, os, re, subprocess, sys, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nhom_goc import _q, _spy, _tuyen

K18 = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "xuong-video", "scripts", "ethopex", "kiem-phim-18.py")
LUAT = """You screen a short-drama POSTER (plus title and synopsis) before it is advertised on Facebook. Answer with the tool.
dat = false if the POSTER shows ANY of: blood, wounds or gore · a gun, knife or other weapon (held, pointed or displayed) · sexual or suggestive content (lingerie,
underwear, cleavage-focused framing, seductive pose) · shirtless people embracing / kissing, couples in bed · nudity or near-nudity. Otherwise dat = true.
NOT a weapon (do not fail for it): robots, mecha, armor, spaceships or other sci-fi machines, magic effects, crowns / scepters as costume (anh 03/11/2026: Mech King bị loại oan vì robot).
NOT a violation either (anh 03/11/2026: Dragonborn Bloodcore + My Choice Makes the Dragon King bị loại oan): fantasy armor / costumes with no weapon actually visible,
dragons and other creatures, glowing magic veins, dark markings / tattoos / cracks on skin that are a fantasy effect (only fail for wounds when blood or open injury is visible).
Fail only for a violation you can clearly SEE. If you are unsure or find no clear violation, dat = true — never fail "to be safe".
The synopsis only helps you understand the poster — judge the IMAGE. vi_pham = the violated items (empty when dat = true). ly_do = one short sentence in Vietnamese.
Title: """

def _tom_tat(url):
    if not url: return ""
    try:
        h = urllib.request.urlopen(urllib.request.Request(url, headers={"user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36"}), timeout=20).read().decode("utf-8", "ignore")
        m = re.search(r'<meta[^>]+(?:property|name)="(?:og:description|description)"[^>]+content="([^"]*)"', h)
        return (m.group(1) if m else "").replace("&#x27;", "'").replace("&quot;", '"').replace("&amp;", "&")[:800]
    except Exception: return ""

def soat(content_id, ghi=True):
    """→ (dat True/False | None, chi_vnd, ly_do)"""
    db = os.environ["DATABASE_URL"]; _, khoa = _spy()
    r = _q(f"select coalesce(ten, '') || '|' || coalesce(anh, '') || '|' || coalesce(url, '') from etp.thu_vien_phim where content_id = {int(content_id)}", db)
    ten, anh, url = (r.split("|", 2) + ["", "", ""])[:3]
    if not anh: return None, 0, "không có poster trong kho thư viện (etp.thu_vien_phim)"
    anh = anh if anh.startswith("http") else f"https://acdn.dofez.com/{anh.lstrip('/')}"
    chu = f"{ten}\nSynopsis: {_tom_tat(url)}"
    chi, loi = 0.0, ""
    for model in _tuyen()[:3]:
        try:
            body = {"model": model, "max_tokens": 300, "messages": [{"role": "user", "content": [{"type": "image_url", "image_url": {"url": anh}}, {"type": "text", "text": LUAT + chu}]}],
                    "tools": [{"type": "function", "function": {"name": "ket_qua", "parameters": {"type": "object", "required": ["dat", "vi_pham", "ly_do"], "properties": {
                        "dat": {"type": "boolean"}, "vi_pham": {"type": "array", "items": {"type": "string"}}, "ly_do": {"type": "string"}}}}}],
                    "tool_choice": {"type": "function", "function": {"name": "ket_qua"}}}
            r = json.load(urllib.request.urlopen(urllib.request.Request("https://api.xah.io/v1/chat/completions", data=json.dumps(body).encode(), headers={"Authorization": f"Bearer {khoa}", "content-type": "application/json"}), timeout=120))
            chi += float(((r.get("usage") or {}).get("x_ckey") or {}).get("cost") or 0)
            a = json.loads(r["choices"][0]["message"]["tool_calls"][0]["function"]["arguments"])
            if not isinstance(a.get("dat"), bool): loi = f"{model}: trả lời lạ"; continue
            ly = f"AI soát poster ({model.split('/')[-1]}): {str(a.get('ly_do') or '')[:160]}" + (f" — {', '.join(a.get('vi_pham') or [])}" if not a["dat"] else "")
            if ghi: subprocess.run(["python3", K18, "--soat", str(int(content_id)), "ok" if a["dat"] else "cam", ly], capture_output=True, text=True, timeout=60)
            return a["dat"], round(chi), ly
        except Exception as e: loi = f"{model}: {str(e)[:120]}"
    return None, round(chi), loi

if __name__ == "__main__":
    ids = [int(x) for x in sys.argv[1:] if x.isdigit()]; tong = 0
    for i in ids:
        d, c, ly = soat(i, ghi="--ghi" in sys.argv); tong += c; print(f"{i}: {d} · {c}₫ · {ly}")
    print(f"tổng {tong}₫")
