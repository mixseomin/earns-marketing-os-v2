"""SOÁT 18+ PHIM BẰNG AI (anh 02/11/2026 chọn "A": nhận phim ở chế độ Tự động thì máy tự lên camp — bước soát poster thay Claude xem tay).
Poster phim (etp.thu_vien_phim.anh, CDN dofez) + tên + tóm tắt (trang tập 1 nguồn) → mô hình nhìn ảnh rẻ qua ckey (tuyến sống, Haiku trước — cùng đường nhom_goc.py)
→ ghi qua ĐÚNG lệnh soát hiện có: kiem-phim-18.py --soat <id> ok|cam "<ghi>" (sổ ethopex_soat_18; cam = kèm danh sách cấm) — mọi cổng (máy sinh, nhan-ban) đọc sổ đó.
Luật = luật soát poster của quy trình phim mới (phim-moi.py): máu / vết thương · súng / vũ khí · gợi dục / nội y / hở hang · cởi trần ôm hôn / giường · khoả thân → loại.
Không chấm được (lỗi mạng / ảnh) → trả None, KHÔNG ghi sổ (cổng vẫn chặn — kín).
  python3 apps/etp/soat_18_ai.py <content_id…> [--ghi]   (không --ghi: chỉ in)"""
import json, os, re, subprocess, sys, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nhom_goc import _q
import ai_chu as AI   # MỘT đường gọi AI (donk → ckey)

K18 = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "xuong-video", "scripts", "ethopex", "kiem-phim-18.py")
LUAT = """You screen a short-drama POSTER (plus title and synopsis) before it is advertised on Facebook. Answer with the tool.
dat = false if the POSTER shows ANY of: blood, wounds or gore · a gun, knife or other weapon (held, pointed or displayed) · sexual content (lingerie,
underwear, an explicitly seductive / sexual pose) · shirtless people embracing / kissing, couples in bed · nudity or near-nudity. Otherwise dat = true.
CLOTHING IS NOT A VIOLATION (anh 04/11/2026: My Ex-Wife is a Secret Billionaire bị loại oan vì váy đỏ cổ sâu): evening gowns, low-cut or V-neck dresses, visible
cleavage in a normal outfit, off-shoulder tops, bare arms / legs, swimwear in a normal non-sexual setting → dat = true. Only fail when it is lingerie / underwear,
(near-)nudity, or the pose / framing is clearly sexual.
NOT a weapon (do not fail for it): robots, mecha, armor, spaceships or other sci-fi machines, magic effects, crowns / scepters as costume (anh 03/11/2026: Mech King bị loại oan vì robot).
NOT a violation either (anh 03/11/2026: Dragonborn Bloodcore + My Choice Makes the Dragon King bị loại oan): fantasy armor / costumes with no weapon actually visible,
dragons and other creatures, glowing magic veins, dark markings / tattoos / cracks on skin that are a fantasy effect (only fail for wounds when blood or open injury is visible).
BLOOD / WOUNDS (anh 04/11/2026: Big Mistake: Torturing the Hidden Billionaire bị loại oan, phim đang lãi cao): blood smears, cuts, bruises or scratches on a face or body,
a bleeding lip, a beaten-up look → dat = true. A belt, rope, whip, stick or chain is NOT a weapon. Fail blood only for GRAPHIC gore: gaping open wounds, pools / sprays of blood,
severed body parts, a corpse in blood.
For weapons and wounds: fail only when clearly visible; if unsure, those two items pass — never fail them "to be safe".
Sexual rules stay strict only for real sexual content (lingerie, nudity, intimate embrace with exposed skin, clearly sexual pose); normal fashion passes.
The synopsis only helps you understand the poster — judge the IMAGE. vi_pham = the violated items (empty when dat = true). ly_do = one short sentence in Vietnamese.
Title: """

def _tom_tat(url):
    if not url: return ""
    try:
        h = urllib.request.urlopen(urllib.request.Request(url, headers={"user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36"}), timeout=20).read().decode("utf-8", "ignore")
        m = re.search(r'<meta[^>]+(?:property|name)="(?:og:description|description)"[^>]+content="([^"]*)"', h)
        return (m.group(1) if m else "").replace("&#x27;", "'").replace("&quot;", '"').replace("&amp;", "&")[:800]
    except Exception: return ""

# MỘT PHIM SOÁT MỘT LẦN THEO POSTER (anh 18/11/2026, sổ luật san_xuat_theo_cho): 24 giờ tới 23:40 18/11 "etp soát 18+" 827 lượt cho 224 phim — mỗi dòng phim mới
# của cùng phim soát lại poster đã soát. Sổ ethopex_soat_18 đã có kết quả cho phim mà poster không đổi (khoá "anh" ghi kèm; bản ghi cũ chưa có "anh" = poster đang có)
# → trả kết quả cũ, 0₫. --lai (hoặc lai=True) mới soát lại.
def da_soat(v, anh):
    """hàm thuần: bản ghi sổ ethopex_soat_18 của phim + poster hiện tại → True khi dùng lại được kết quả cũ"""
    return isinstance(v, dict) and isinstance(v.get("ok"), bool) and (not v.get("anh") or v.get("anh") == anh)

def soat(content_id, ghi=True, lai=False):
    """→ (dat True/False | None, chi_vnd, ly_do)"""
    db = os.environ["DATABASE_URL"]
    r = _q(f"select coalesce(ten, '') || '|' || coalesce(anh, '') || '|' || coalesce(url, '') from etp.thu_vien_phim where content_id = {int(content_id)}", db)
    ten, anh, url = (r.split("|", 2) + ["", "", ""])[:3]
    if not anh: return None, 0, "không có poster trong kho thư viện (etp.thu_vien_phim)"
    anh = anh if anh.startswith("http") else f"https://acdn.dofez.com/{anh.lstrip('/')}"
    if not lai:
        try: v = json.loads(_q(f"select coalesce((select gia_tri->'{int(content_id)}' from xv_khoa_ngoai where ten = 'ethopex_soat_18'), 'null')::text", db) or "null")
        except ValueError: v = None
        if da_soat(v, anh): return v["ok"], 0, f"{str(v.get('ghi') or '')[:240]} (đã soát {v.get('luc') or 'trước'} — không soát lại)"
    chu = f"{ten}\nSynopsis: {_tom_tat(url)}"
    a, chi, model, loi = AI.goi([{"type": "image_url", "image_url": {"url": anh}}, {"type": "text", "text": LUAT + chu}], max_tokens=300, timeout=120,
        kiem=lambda a: None if isinstance(a.get("dat"), bool) else "trả lời lạ",
        cong_cu=("ket_qua", {"type": "object", "required": ["dat", "vi_pham", "ly_do"], "properties": {
            "dat": {"type": "boolean"}, "vi_pham": {"type": "array", "items": {"type": "string"}}, "ly_do": {"type": "string"}}}))   # donk → ckey: ai_chu.py
    if not a: return None, round(chi), loi
    ly = f"AI soát poster ({model.split('/')[-1]}): {str(a.get('ly_do') or '')[:160]}" + (f" — {', '.join(a.get('vi_pham') or [])}" if not a["dat"] else "")
    if ghi:
        subprocess.run(["python3", K18, "--soat", str(int(content_id)), "ok" if a["dat"] else "cam", ly], capture_output=True, text=True, timeout=60)
        a_sql = anh.replace("'", "''")   # nhớ poster đã soát (da_soat) — chỉ thêm khoá "anh" vào bản ghi vừa ghi, không đụng khoá khác
        _q(f"update xv_khoa_ngoai set gia_tri = jsonb_set(gia_tri, '{{{int(content_id)},anh}}', to_jsonb('{a_sql}'::text)) where ten = 'ethopex_soat_18' and gia_tri ? '{int(content_id)}'", db)
    return a["dat"], round(chi), ly

if __name__ == "__main__":
    if "--tu-kiem" in sys.argv:
        assert da_soat({"ok": True, "ghi": "x"}, "a") and da_soat({"ok": False, "anh": "a"}, "a") and not da_soat({"ok": True, "anh": "b"}, "a") and not da_soat(None, "a") and not da_soat({"ghi": "chưa"}, "a"), "soát một lần theo poster"
        print("✓ soat_18_ai.py tự kiểm (một phim soát một lần theo poster)"); sys.exit(0)
    ids = [int(x) for x in sys.argv[1:] if x.isdigit()]; tong = 0
    for i in ids:
        d, c, ly = soat(i, ghi="--ghi" in sys.argv, lai="--lai" in sys.argv); tong += c; print(f"{i}: {d} · {c}₫ · {ly}")
    print(f"tổng {tong}₫")
