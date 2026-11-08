#!/usr/bin/env python3
"""ẢNH DẠNG PO: API ẢNH AI VẼ BỐ CỤC MỚI VỚI NGƯỜI THẬT + TÊN PHIM THEO POSTER GỐC (anh 08/11/2026):
  "kinh quá. Ko dùng cách này đc" (AI chạy trên iMac — chậm 8–19 phút / ảnh, PosterCraft ép vẽ chữ rác, ghép người trông như dán) →
  "thà mày dùng API ảnh AI sinh post còn ngon hơn. Dùng idea từ git rồi gửi cho nó bố cục mới để nó sinh cho chuẩn. Sau đó ghép tên phim theo format poster gốc vào là đc"
  + "Người ko giống thì vi phạm" → người phải đúng diễn viên.
Mỗi phim × bố cục:
  1. iMac — ẢNH THAM CHIẾU NGƯỜI THẬT: poster chính thức (62% trên, đã xoá chữ / huy hiệu bằng máy đọc chữ của anh-tinh.py) + 2 khung phim có người rõ đã xoá phụ đề
  2. box3 — anh-po-ai.mts: đẩy tham chiếu lên R2 → cổng ảnh (ckey nano-banana-pro, ~110₫) vẽ poster MỚI theo bố cục (ý từ PosterCraft / PosterVerse) + giọng thể loại,
     đúng người trong tham chiếu, KHÔNG chữ, chừa 24% đáy
  3. iMac — TÊN PHIM theo format poster gốc: chữ tên tách từ chính poster (ten-poster.png) đặt ở đáy, căn giữa, rộng ~86% như poster gốc; tagline dưới
Chạy (iMac): ~/.venvs/poster-mau/bin/python ve-po-ai.py <content_id> [<content_id> …] [--bo chan_dung,tang_lop,…]
  → ~/.cache/ethopex/anh-tinh/<id>/po-ai/<bố cục>.jpg (+ <bố cục>-tho.jpg ảnh AI chưa ghép tên) + bảng ~/.cache/ethopex/anh-tinh/po-ai-bang.jpg"""
import importlib.util, json, os, subprocess, sys
from PIL import Image, ImageDraw, ImageFont

D = os.path.dirname(os.path.abspath(__file__)); C = os.path.expanduser("~/.cache/ethopex/anh-tinh"); B = "root@167.233.241.16"
_s = importlib.util.spec_from_file_location("bo_cuc", os.path.join(D, "bo-cuc-po.py")); BC = importlib.util.module_from_spec(_s); _s.loader.exec_module(BC)
GIONG = {"ty_phu": "billionaire luxury romance, gold and black, glamorous", "mafia": "dark mafia crime drama, red and black, smoky night",
         "tinh_cam": "romantic drama, warm soft light", "me_con": "heartwarming family drama, warm sunlight", "vo_danh": "underdog action drama, intense rim light, sparks",
         "he_thong": "action fantasy, glowing holographic system UI", "fantasy": "epic fantasy, magical light rays, mystical fog", "soi": "werewolf romance fantasy, full moon, misty forest",
         "co_trang": "ancient chinese palace drama, red and gold", "hoi_han": "emotional regret drama, rain, cold blue tones"}
# bố cục theo thể loại (3 mỗi phim) — tên khớp BO_CUC trong anh-po-ai.mts
BO_LOAI = {"ty_phu": ["chan_dung", "tang_lop", "doi_dau"], "mafia": ["chan_dung", "doi_dau", "hai_lop"], "tinh_cam": ["doi_dau", "tang_lop", "hai_lop"],
           "me_con": ["tang_lop", "chan_dung", "hai_lop"], "vo_danh": ["hanh_dong", "chan_dung", "tang_lop"], "he_thong": ["hanh_dong", "hai_lop", "chan_dung"],
           "fantasy": ["hai_lop", "hanh_dong", "chan_dung"], "soi": ["hai_lop", "doi_dau", "chan_dung"], "co_trang": ["tang_lop", "chan_dung", "doi_dau"]}
BO_MAC = ["chan_dung", "tang_lop", "doi_dau"]

def tham_chieu(P, thu):
    """ảnh tham chiếu người thật vào thư mục `thu`: poster gốc (phần trên, đã xoá chữ) + 2 khung phim đã xoá phụ đề"""
    os.makedirs(thu, exist_ok=True)
    for f in os.listdir(thu):   # tham chiếu lượt trước đổi đuôi (không xoá) — ckey chỉ nhận 3 ảnh, tệp thừa đẩy mất ảnh chữ tên
        if f.startswith("ref-"): os.replace(os.path.join(thu, f), os.path.join(thu, "cu-" + f))
    po = os.path.join(C, str(P["cid"]), "poster.jpg")
    if os.path.exists(po):
        im = BC.mo(po); im.crop((0, 0, im.width, int(im.height * 0.62))).save(os.path.join(thu, "ref-1-poster.jpg"), quality=92)
    BC.mo(P["khung"][0]).save(os.path.join(thu, "ref-2-khung.jpg"), quality=92)
    tp = os.path.join(C, str(P["cid"]), "ten-poster.png")   # tham chiếu cuối = CHỮ TÊN của poster gốc (AI chép kiểu chữ) — ckey nhận tối đa 3 ảnh
    if os.path.exists(tp): t = Image.open(tp).convert("RGBA"); n = Image.new("RGB", t.size, (20, 20, 20)); n.paste(t, (0, 0), t); n.save(os.path.join(thu, "ref-9-ten.jpg"), quality=95)

def ve_ai(P, bo, thu, tho):
    """box3: anh-po-ai.mts → ảnh AI không chữ"""
    xa = f"/tmp/po-ai/{os.path.basename(thu)}"
    # tham chiếu cũ trên box3 đổi tên (không xoá) — 08/11: ref-3 lượt trước còn sót, ckey chỉ nhận 3 ảnh → ảnh chữ tên ref-9 bị đẩy ra, AI không vẽ tên
    subprocess.run(["ssh", B, f"mkdir -p {xa} && cd {xa} && for f in ref-*; do [ -e \"$f\" ] && mv -f \"$f\" \"cu-$f\"; done; true"], check=True)
    subprocess.run(["scp", "-q"] + [os.path.join(thu, f) for f in sorted(os.listdir(thu)) if f.startswith("ref-")] + [f"{B}:{xa}/"], check=True)
    lenh = (f"cd /opt/earns-marketing-os-v2 && set -a && . ./.env.production && set +a && NODE_OPTIONS=--conditions=react-server "
            f"./node_modules/.bin/tsx apps/xuong-video/scripts/ethopex/anh-po-ai.mts {'--ten ' + json.dumps(P['ten']) if os.path.exists(os.path.join(thu, 'ref-9-ten.jpg')) else ''} {xa} {bo} {json.dumps(GIONG.get(P['loai'], 'cinematic short drama'))} {xa}/{bo}.jpg")
    r = subprocess.run(["ssh", B, lenh], capture_output=True, text=True, timeout=400)
    dong = (r.stdout.strip().splitlines() or ["{}"])[-1]
    try: kq = json.loads(dong)
    except Exception: kq = {"ok": False}
    if not kq.get("ok"): raise RuntimeError(f"box3: {(r.stderr or r.stdout).strip()[-300:]}")
    subprocess.run(["scp", "-q", f"{B}:{xa}/{bo}.jpg", tho], check=True); return kq

def ten_dung(P, tho):
    """AI đã vẽ tên phim đúng chính tả? — đọc chữ ảnh (máy đọc chữ của anh-tinh.py), ≥ 80% từ của tên có mặt"""
    j = json.loads(subprocess.run([BC.AT.may_doc(), tho], capture_output=True, text=True, timeout=120).stdout.strip() or "{}")
    chu = " ".join(str(x[0]) for x in j.get("khung") or []).lower(); tu = [w for w in "".join(c if c.isalnum() else " " for c in P["ten"].lower()).split() if len(w) > 1]
    return bool(tu) and sum(w in chu for w in tu) / len(tu) >= 0.8

def ghep_ten(P, tho, ra):
    """TÊN PHIM theo format poster gốc: AI đã vẽ đúng chính tả theo kiểu chữ poster → giữ, chỉ thêm tagline; sai → dán chữ tên tách từ poster (ten-poster.png) ở đáy"""
    im = Image.open(tho).convert("RGB").resize((1080, 1920), Image.LANCZOS)
    if ten_dung(P, tho): im.save(ra, quality=92); return "AI vẽ đúng kiểu chữ poster"   # giữ nguyên ảnh AI — không dán thêm tagline (08/11: tagline đè chân chữ tên)
    toi = Image.new("L", (1, 256)); toi.putdata([0 if i < 175 else min(170, (i - 175) * 3) for i in range(256)])   # đáy tối dần cho chữ nổi
    im = Image.composite(Image.new("RGB", im.size, P["mau"]["toi"]), im, toi.resize(im.size))
    y = BC.tieu_de(im, P, 75, 1460, 930, 290, chu_hoa=True); BC.tagline(im, P, min(y + 26, 1830), P["mau"]["sang"])
    im.save(ra, quality=92); return "dán chữ tách từ poster (AI viết sai)"

def lam(cid, bo_ds=None):
    P = BC.doc_phim(cid); ra_dir = os.path.join(C, str(cid), "po-ai"); os.makedirs(ra_dir, exist_ok=True)
    thu = os.path.join(ra_dir, f"vao-{cid}"); tham_chieu(P, thu); kq = []
    for bo in bo_ds or BO_LOAI.get(P["loai"], BO_MAC):
        tho, ra = os.path.join(ra_dir, f"{bo}-tho.jpg"), os.path.join(ra_dir, f"{bo}.jpg")
        try:
            k = ve_ai(P, bo, thu, tho); cach = ghep_ten(P, tho, ra); kq.append((bo, ra, k.get("vnd", 0)))
            print(f"#{cid} {bo}: {ra} · {k.get('vnd')}₫ · {k.get('model')} · {k.get('giay')} giây · tên: {cach}", flush=True)
        except Exception as e: print(f"#{cid} {bo}: LỖI {e}", flush=True)
    return P, kq

def bang(ds, ra):
    o = 360, 640; f = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Unicode.ttf", 24)
    im = Image.new("RGB", (o[0] * 4 + 50, (o[1] + 60) * len(ds) + 20), "#111"); d = ImageDraw.Draw(im)
    for r, (P, kq) in enumerate(ds):
        y = 20 + r * (o[1] + 60); d.text((20, y), f"#{P['cid']} {P['ten']} · {BC.TEN_LOAI.get(P['loai'], P['loai'])}", font=f, fill="#ddd")
        po = os.path.join(C, str(P["cid"]), "poster.jpg")
        if os.path.exists(po): im.paste(Image.open(po).convert("RGB").resize(o), (20, y + 34)); d.text((24, y + 38), "poster gốc", font=f, fill="#ff0")
        for c, (bo, p, _) in enumerate(kq[:3]):
            im.paste(Image.open(p).convert("RGB").resize(o), (20 + (c + 1) * (o[0] + 10), y + 34)); d.text((24 + (c + 1) * (o[0] + 10), y + 38), bo, font=f, fill="#fff")
    im.save(ra, quality=88)

if __name__ == "__main__":
    a = sys.argv[1:]; bo_ds = a[a.index("--bo") + 1].split(",") if "--bo" in a else None
    gia_tri = {a[i + 1] for i, x in enumerate(a[:-1]) if x.startswith("--")}
    ds = [lam(cid, bo_ds) for cid in a if cid.isdigit() and cid not in gia_tri]
    tong = sum(v for _, kq in ds for *_, v in kq); print(f"tổng tiền: {tong}₫ · {sum(len(kq) for _, kq in ds)} ảnh")
    if ds: p = os.path.join(C, "po-ai-bang.jpg"); bang(ds, p); print("bảng:", p)
