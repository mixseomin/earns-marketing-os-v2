"""NHÓM GỐC PHIM tự chấm trên poster (thiếu poster → 4 khung giữa video creative đã chấm) (anh 29/10/2026: "dừng các phim ngoài âu mỹ … chặn khi lên camp target US" → "làm cho kín").
Cổng cong.kiem gặp phim chưa có etp.phim.nhom_goc thì gọi cham(content_id) NGAY lúc định lên camp (theo sự kiện, không chạy nền):
poster (ethopex_content.anh, CDN dofez) + tên phim → mô hình nhìn ảnh rẻ qua ai_chu.py (donk → ckey, Haiku trước) → ghi nhom_goc.
Luật chấm giống lần chấm tay 200 phim (apps/etp/phan-tich/nhom-goc-phim.json): theo NGOẠI HÌNH diễn viên; hoat_hinh CHỈ khi nhìn ra tranh vẽ / hoạt hình 2D-3D;
phim làm bằng AI mà nhìn như người thật xếp theo ngoại hình. Không chấm được (lỗi mạng / ảnh) → trả None, cổng CHẶN (kín: chưa biết nhóm thì không lên).
  python3 apps/etp/nhom_goc.py <content_id…> [--ghi]   (không --ghi: chỉ in, không ghi kho)"""
import json, os, re, subprocess, sys, urllib.request
NHOM = ["au_my", "trung", "an", "latin", "dong_a", "da_mau", "hoat_hinh"]
LUAT = """Classify this short-drama poster by the LOOK of the cast. Answer with the tool.
You may get the poster PLUS several frames from the episodes: judge the MAJORITY of the cast across ALL images, never one face (anh 04/11/2026: "Big Mistake:
Torturing The Hidden Billionaire" — mostly white cast + one tanned grey-haired lead — was wrongly "an"). Tanned / olive / weathered skin on Western features is au_my,
NOT an; "an" only when most of the cast clearly looks South Asian. An American-style production (English title, Western setting) with a mostly white cast is au_my.
Judge the MAJORITY of the cast, never one face (anh 04/11/2026: "Big Mistake: Torturing The Hidden Billionaire" — 3 white actors + a tanned grey-haired lead — was wrongly "an").
Tanned, olive or weathered skin on Western features is au_my, NOT an. "an" only when most of the cast clearly looks South Asian (Indian / Pakistani / Bangladeshi).
An American-style production (English title, Western setting / clothing) whose cast is mostly white is au_my.
nhom: au_my = white / Western-looking cast (US, Europe, also AI-generated but photorealistic Western faces) · trung = Chinese / East-Asian Chinese production look · an = Indian / South Asian cast ·
latin = Latino / Hispanic-looking cast · dong_a = Korean / Japanese / Southeast Asian · da_mau = Black cast · hoat_hinh = ONLY if the poster is clearly a drawing / painting / 2D anime / 3D cartoon,
NOT a photo. A poster made with AI that looks like real photographed people is NOT hoat_hinh — classify it by the faces. Spanish or other-language titles do not decide the group: look at the faces.
First decide kieu_anh: "tranh_ve" if the image is rendered like a painting / digital illustration / anime / 3D cartoon — tell-tales: painterly brush texture, airbrushed
doll-like skin with no pores, oversized glossy eyes, glowing fantasy-art lighting, characters that look drawn rather than photographed. "anh_chup" only if it looks like a real
camera photo of real people (film still, studio shot), even if retouched or AI-made. When in doubt between a glossy fantasy illustration and a photo, choose tranh_ve.
Title: """
_q = lambda s, db: subprocess.run(["psql", db, "-tAc", s], capture_output=True, text=True, timeout=30).stdout.strip()
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import ai_chu as AI   # MỘT đường gọi AI (donk → ckey)
def _spy(): return subprocess.run(["bash", "-c", ". /root/.secrets/spy.env; echo \"$DATABASE_URL|$CKEY_KEY\""], capture_output=True, text=True).stdout.strip().split("|", 1)

def cham(content_id, ghi=True, them=None):
    """→ (nhom | None, chi_vnd, ly_do) · them = ảnh cảnh trong phim (URL hoặc data URI) — POSTER + CẢNH chấm cùng lúc (anh 04/11/2026 "quét poster + vài cảnh trong phim")"""
    db = os.environ["DATABASE_URL"]; spy_db, khoa = _spy()
    ten = _q(f"select coalesce(ten, '') from etp.phim where content_id = {int(content_id)}", db) or _q(f"select coalesce(ten, '') from ethopex_content where id = {int(content_id)}", spy_db)
    anh = _q(f"select coalesce(anh, '') from ethopex_content where id = {int(content_id)}", spy_db)
    khung = _q(f"""select u from (select distinct on (c.creative_id) c.creative_id, c.lop->'anh'->'khung_url' k from etp.cham c join etp.creative r using (creative_id)
                    where r.content_id = {int(content_id)} and jsonb_array_length(coalesce(c.lop->'anh'->'khung_url', '[]')) >= 8 order by c.creative_id) x,
                    jsonb_array_elements_text(x.k) with ordinality e(u, n) where n in (3, 11) limit 2""", db).split()
    them = list(them or []) + khung
    if anh: anh_ds, nguon = [anh if anh.startswith("http") else f"https://acdn.dofez.com/{anh}"] + them[:6], ("poster + " + str(len(them[:6])) + " cảnh" if them else "poster")
    elif them: anh_ds, nguon = them[:6], f"{len(them[:6])} cảnh trong phim"
    else:   # THIẾU POSTER (anh 31/10/2026 "dùng video thumb nào đó đc ko?"): phim chỉ team chạy, spy chưa có → khung giữa video creative của phim đã chấm (Worker etp-cham)
        anh_ds, nguon = _q(f"""select u from (select distinct on (c.creative_id) c.creative_id, c.lop->'anh'->'khung_url' k from etp.cham c join etp.creative r using (creative_id)
                               where r.content_id = {int(content_id)} and jsonb_array_length(coalesce(c.lop->'anh'->'khung_url', '[]')) >= 8 order by c.creative_id) x,
                               jsonb_array_elements_text(x.k) with ordinality e(u, n) where n in (3, 7, 11, 15) limit 4""", db).split(), "khung video QC"
        if not anh_ds:   # còn thiếu → poster og:image trên chính trang phim (anh 07/11/2026 "phim ko có poster thì vào site của phim mà lấy")
            try:
                import importlib.util as _u
                _s = _u.spec_from_file_location("tai_tap", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "xuong-video", "scripts", "ethopex", "tai-tap.py")); TT = _u.module_from_spec(_s); _s.loader.exec_module(TT)
                url = _q(f"select coalesce(url, '') from ethopex_content where id = {int(content_id)}", spy_db)
                og = TT.og_anh(url) if url else None
                if og: anh_ds, nguon = [og], "poster trang phim"
            except Exception as e: print("poster trang phim lỗi:", e, file=sys.stderr)
        if not anh_ds: return None, 0, "không có poster trong kho Ethopex, trang phim không có ảnh og:image, chưa có creative nào chấm xong để lấy khung"
    noi = [*({"type": "image_url", "image_url": {"url": u}} for u in anh_ds), {"type": "text", "text": (LUAT if nguon.startswith("poster") else LUAT.replace("this short-drama poster", "these frames from the short drama's ad video")) + ten}]
    def kiem(a):
        if a.get("kieu_anh") == "tranh_ve": a["nhom"] = "hoat_hinh"   # tranh vẽ thắng ngoại hình (anh: phim kiểu tranh vẽ phải chỉ rõ)
        return None if a.get("nhom") in NHOM else f"nhóm lạ {a.get('nhom')}"
    a, chi, model, loi = AI.goi(noi, max_tokens=200, kiem=kiem, timeout=120, cong_cu=("ghi_nhom", {"type": "object", "required": ["kieu_anh", "nhom", "ly_do"],
        "properties": {"kieu_anh": {"type": "string", "enum": ["anh_chup", "tranh_ve"]}, "nhom": {"type": "string", "enum": NHOM}, "ly_do": {"type": "string"}}}))   # donk → ckey: ai_chu.py
    if not a: return None, round(chi), loi
    if ghi: _q(f"insert into etp.phim (content_id, ten, nhom_goc) values ({int(content_id)}, $T${ten}$T$, '{a['nhom']}') on conflict (content_id) do update set nhom_goc = excluded.nhom_goc", db)
    return a["nhom"], round(chi), f"{model} ({nguon}): {str(a.get('ly_do'))[:120]}"

if __name__ == "__main__":
    ids = [int(x) for x in sys.argv[1:] if x.isdigit()]; tong = 0
    them = json.loads(sys.stdin.read() or "[]") if "--khung-stdin" in sys.argv else []   # ảnh cảnh (data URI) máy chạy dòng (iMac) gửi qua stdin
    for i in ids:
        n, c, ly = cham(i, ghi="--ghi" in sys.argv, them=them); tong += c; print(f"{i}: {n} · {c}₫ · {ly}")
    print(f"tổng {tong}₫")
