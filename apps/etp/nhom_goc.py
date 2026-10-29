"""NHÓM GỐC PHIM tự chấm trên poster (anh 29/10/2026: "dừng các phim ngoài âu mỹ … chặn khi lên camp target US" → "làm cho kín").
Cổng cong.kiem gặp phim chưa có etp.phim.nhom_goc thì gọi cham(content_id) NGAY lúc định lên camp (theo sự kiện, không chạy nền):
poster (ethopex_content.anh, CDN dofez) + tên phim → mô hình nhìn ảnh rẻ qua ckey (tuyến sống /var/lib/spy/ckey-tuyen.json, Haiku trước) → ghi nhom_goc.
Luật chấm giống lần chấm tay 200 phim (apps/etp/phan-tich/nhom-goc-phim.json): theo NGOẠI HÌNH diễn viên; hoat_hinh CHỈ khi nhìn ra tranh vẽ / hoạt hình 2D-3D;
phim làm bằng AI mà nhìn như người thật xếp theo ngoại hình. Không chấm được (lỗi mạng / ảnh) → trả None, cổng CHẶN (kín: chưa biết nhóm thì không lên).
  python3 apps/etp/nhom_goc.py <content_id…> [--ghi]   (không --ghi: chỉ in, không ghi kho)"""
import json, os, re, subprocess, sys, urllib.request
NHOM = ["au_my", "trung", "an", "latin", "dong_a", "da_mau", "hoat_hinh"]
LUAT = """Classify this short-drama poster by the LOOK of the cast. Answer with the tool.
nhom: au_my = white / Western-looking cast (US, Europe, also AI-generated but photorealistic Western faces) · trung = Chinese / East-Asian Chinese production look · an = Indian / South Asian cast ·
latin = Latino / Hispanic-looking cast · dong_a = Korean / Japanese / Southeast Asian · da_mau = Black cast · hoat_hinh = ONLY if the poster is clearly a drawing / painting / 2D anime / 3D cartoon,
NOT a photo. A poster made with AI that looks like real photographed people is NOT hoat_hinh — classify it by the faces. Spanish or other-language titles do not decide the group: look at the faces.
First decide kieu_anh: "tranh_ve" if the image is rendered like a painting / digital illustration / anime / 3D cartoon — tell-tales: painterly brush texture, airbrushed
doll-like skin with no pores, oversized glossy eyes, glowing fantasy-art lighting, characters that look drawn rather than photographed. "anh_chup" only if it looks like a real
camera photo of real people (film still, studio shot), even if retouched or AI-made. When in doubt between a glossy fantasy illustration and a photo, choose tranh_ve.
Title: """
_q = lambda s, db: subprocess.run(["psql", db, "-tAc", s], capture_output=True, text=True, timeout=30).stdout.strip()
def _spy(): return subprocess.run(["bash", "-c", ". /root/.secrets/spy.env; echo \"$DATABASE_URL|$CKEY_KEY\""], capture_output=True, text=True).stdout.strip().split("|", 1)
def _tuyen():
    try: j = json.load(open("/var/lib/spy/ckey-tuyen.json"))["dong"]; return [m.replace("ckey:", "") for m in (j.get("haiku") or []) + (j.get("sonnet") or [])]
    except Exception: return ["nghiaphan0633/claude-haiku-5.5"]

def cham(content_id, ghi=True):
    """→ (nhom | None, chi_vnd, ly_do)"""
    db = os.environ["DATABASE_URL"]; spy_db, khoa = _spy()
    ten = _q(f"select coalesce(ten, '') from etp.phim where content_id = {int(content_id)}", db) or _q(f"select coalesce(ten, '') from ethopex_content where id = {int(content_id)}", spy_db)
    anh = _q(f"select coalesce(anh, '') from ethopex_content where id = {int(content_id)}", spy_db)
    if not anh: return None, 0, "không có poster trong kho Ethopex"
    url = anh if anh.startswith("http") else f"https://acdn.dofez.com/{anh}"
    chi, loi = 0.0, ""
    for model in _tuyen()[:3]:
        try:
            body = {"model": model, "max_tokens": 200, "messages": [{"role": "user", "content": [{"type": "image_url", "image_url": {"url": url}}, {"type": "text", "text": LUAT + ten}]}],
                    "tools": [{"type": "function", "function": {"name": "ghi_nhom", "parameters": {"type": "object", "required": ["kieu_anh", "nhom", "ly_do"], "properties": {"kieu_anh": {"type": "string", "enum": ["anh_chup", "tranh_ve"]}, "nhom": {"type": "string", "enum": NHOM}, "ly_do": {"type": "string"}}}}}],
                    "tool_choice": {"type": "function", "function": {"name": "ghi_nhom"}}}
            r = json.load(urllib.request.urlopen(urllib.request.Request("https://api.xah.io/v1/chat/completions", data=json.dumps(body).encode(), headers={"Authorization": f"Bearer {khoa}", "content-type": "application/json"}), timeout=120))
            chi += float(((r.get("usage") or {}).get("x_ckey") or {}).get("cost") or 0)
            a = json.loads(r["choices"][0]["message"]["tool_calls"][0]["function"]["arguments"])
            if a.get("kieu_anh") == "tranh_ve": a["nhom"] = "hoat_hinh"   # tranh vẽ thắng ngoại hình (anh: phim kiểu tranh vẽ phải chỉ rõ)
            if a.get("nhom") in NHOM:
                if ghi: _q(f"insert into etp.phim (content_id, ten, nhom_goc) values ({int(content_id)}, $T${ten}$T$, '{a['nhom']}') on conflict (content_id) do update set nhom_goc = excluded.nhom_goc", db)
                return a["nhom"], round(chi), f"{model}: {str(a.get('ly_do'))[:120]}"
            loi = f"{model}: nhóm lạ {a.get('nhom')}"
        except Exception as e: loi = f"{model}: {str(e)[:120]}"
    return None, round(chi), loi

if __name__ == "__main__":
    ids = [int(x) for x in sys.argv[1:] if x.isdigit()]; tong = 0
    for i in ids:
        n, c, ly = cham(i, ghi="--ghi" in sys.argv); tong += c; print(f"{i}: {n} · {c}₫ · {ly}")
    print(f"tổng {tong}₫")
