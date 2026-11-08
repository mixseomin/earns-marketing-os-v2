#!/usr/bin/env python3
"""ẢNH DẠNG PO: AI DỰNG THIẾT KẾ, NGƯỜI LÀ DIỄN VIÊN THẬT — $0, chạy trên iMac (anh 08/11/2026: chọn hướng B "AI chạy trên máy nhà";
"Người ko giống thì vi phạm rồi. Phải tách người thật hoặc sinh người thật cắt từ phim ra mà ghép vào").
Cách làm (mỗi phim, mỗi bố cục):
  1. NGƯỜI THẬT: diễn viên tách nền (rembg, CPU) từ poster chính thức của phim (ảnh studio, nét) — thiếu thì từ khung phim đã xoá phụ đề (bo-cuc-po.mo)
  2. ĐẶT NGƯỜI lên khung 768×1344 theo bố cục (giữa · lệch trái · cặp đôi) → mặt nạ: TRẮNG = AI vẽ (mọi thứ trừ người), ĐEN = giữ (người)
  3. AI VẼ PHẦN CÒN LẠI: PosterCraft (FLUX, bản nén GGUF Q4) qua stable-diffusion.cpp (GPU Metal của M4) — nền, ánh sáng, không khí, CHỮ TÊN PHIM theo thể loại
  4. DÁN LẠI NGƯỜI THẬT lên trên ảnh AI (mép mềm) → mặt người giữ nguyên từng điểm ảnh, không bao giờ là người do AI vẽ
Mô hình: ~/models/postercraft (tai.sh) · công cụ: ~/tools/stable-diffusion.cpp/build/bin/sd-cli
Chạy: ~/.venvs/poster-mau/bin/python ve-po-ai.py <content_id> [--kieu giua|trai|doi] [--buoc 20]
  → ~/.cache/ethopex/anh-tinh/<id>/po-ai/<kiểu>.png"""
import importlib.util, os, subprocess, sys, time
from PIL import Image, ImageFilter

D = os.path.dirname(os.path.abspath(__file__)); C = os.path.expanduser("~/.cache/ethopex/anh-tinh")
M = os.path.expanduser("~/models/postercraft"); SD = os.path.expanduser("~/tools/sd-bin/sd-cli")   # bản dựng sẵn chính thức cho Mac arm64 (release master-1060-0b3b98d của leejet/stable-diffusion.cpp)
W, H = 768, 1344   # 9:16 gần đúng, bội số 64 cho FLUX; ảnh ra phóng lên 1080×1920 ở bước dựng video
_s = importlib.util.spec_from_file_location("bo_cuc", os.path.join(D, "bo-cuc-po.py")); BC = importlib.util.module_from_spec(_s); _s.loader.exec_module(BC)

# giọng thiết kế theo thể loại (chữ tên phim do AI vẽ theo đúng giọng này)
GIONG = {
    "ty_phu": "luxury billionaire romance drama poster, gold and black palette, elegant serif gold title lettering, chandelier bokeh, glamorous cinematic lighting",
    "mafia": "dark mafia crime drama poster, deep shadows, red and black, sharp serif title, smoke and city night",
    "tinh_cam": "romantic drama poster, soft warm light, pastel sky, flowing script title lettering, petals and glow",
    "me_con": "heartwarming family drama poster, warm sunlight, soft colors, friendly rounded title lettering",
    "vo_danh": "intense underdog action drama poster, dramatic rim light, sparks and dust, bold condensed metallic title",
    "he_thong": "action fantasy system drama poster, glowing blue holographic UI elements, bold futuristic title",
    "fantasy": "epic fantasy drama poster, magical light rays, mystical fog, ornate engraved title lettering",
    "soi": "werewolf romance fantasy poster, full moon, misty dark forest, silver ornate title lettering",
    "co_trang": "ancient chinese palace drama poster, red lanterns, silk and gold, brush calligraphy style title",
    "hoi_han": "emotional regret drama poster, rain, cold blue tones, thin elegant serif title",
}
GIONG_MAC = "cinematic short drama movie poster, dramatic lighting, bold stylish title lettering"

def nguoi_that(P):
    """diễn viên thật: tách nền từ poster chính thức (nét nhất); không tách được thì khung phim"""
    po = os.path.join(C, str(P["cid"]), "poster.jpg")
    if os.path.exists(po):
        n = BC.tach(Image.open(po).convert("RGB")); bb = n.getchannel("A").point(lambda v: 255 if v > 128 else 0).getbbox()
        if bb and (bb[2] - bb[0]) * (bb[3] - bb[1]) > 0.08 * n.width * n.height: return n.crop(bb)
    n = BC.cat(P["khung"][0]); bb = n.getchannel("A").getbbox(); return n.crop(bb) if bb else n

def dat(n, kieu):
    """đặt người thật lên khung theo bố cục → (lớp người RGBA W×H, mặt nạ L: 255 = AI vẽ)"""
    cao = {"giua": 0.72, "trai": 0.78, "doi": 0.66}[kieu]; r = H * cao / n.height
    n = n.resize((round(n.width * r), round(n.height * r)), Image.LANCZOS)
    if n.width > W * 0.95: r2 = W * 0.95 / n.width; n = n.resize((round(n.width * r2), round(n.height * r2)), Image.LANCZOS)
    x = {"giua": (W - n.width) // 2, "trai": -n.width // 8, "doi": (W - n.width) // 2}[kieu]
    lop = Image.new("RGBA", (W, H), (0, 0, 0, 0)); lop.paste(n, (x, H - n.height), n)
    giu = lop.getchannel("A").point(lambda v: 255 if v > 40 else 0).filter(ImageFilter.MinFilter(5))   # co mặt nạ giữ 2px: mép người để AI hoà ánh sáng
    return lop, Image.eval(giu, lambda v: 255 - v)

def loi_nhac(P, kieu):
    vi_tri = {"giua": "the main character stands in the center foreground", "trai": "the main character on the left, empty space on the right for the title",
              "doi": "the couple stands together in the foreground"}[kieu]
    return (f'movie poster for the short drama "{P["ten"]}". {GIONG.get(P["loai"], GIONG_MAC)}. {vi_tri}. '
            f'Large title text "{P["ten"]}" at the top. small tagline "{P["tag"]}" near the bottom. professional key art, highly detailed, sharp focus')

def ve(P, kieu, buoc=20, hat=None):
    ra = os.path.join(C, str(P["cid"]), "po-ai"); os.makedirs(ra, exist_ok=True)
    lop, mn = dat(nguoi_that(P), kieu)
    nen = Image.new("RGB", (W, H), P["mau"]["toi"]); nen.paste(lop, (0, 0), lop)   # ảnh đầu vào: người thật trên nền màu tối của phim
    vao, mat, tho = (os.path.join(ra, f"{kieu}-{x}.png") for x in ("vao", "mat", "tho"))
    nen.save(vao); mn.save(mat)
    lenh = [SD, "--diffusion-model", os.path.join(M, "PosterCraft-v1_RL-Q4_K.gguf"), "--vae", os.path.join(M, "ae.safetensors"),
            "--clip_l", os.path.join(M, "clip_l.safetensors"), "--t5xxl", os.path.join(M, "t5xxl-Q4_K_M.gguf"),
            "-p", loi_nhac(P, kieu), "-i", vao, "--mask", mat, "--strength", "1.0", "-W", str(W), "-H", str(H),
            "--steps", str(buoc), "--cfg-scale", "1.0", "--guidance", "3.5", "--sampling-method", "euler", "-s", str(hat if hat is not None else int(P["cid"]) % 10000),
            "-o", tho]
    t0 = time.time(); r = subprocess.run(lenh, capture_output=True, text=True)
    if r.returncode or not os.path.exists(tho): raise RuntimeError(f"sd lỗi ({r.returncode}): {(r.stderr or r.stdout)[-400:]}")
    ai = Image.open(tho).convert("RGB")
    mem = lop.getchannel("A").filter(ImageFilter.GaussianBlur(1.5)); ai.paste(lop.convert("RGB"), (0, 0), mem)   # dán lại người thật: mặt giữ nguyên từng điểm ảnh
    p = os.path.join(ra, f"{kieu}.png"); ai.save(p); return p, time.time() - t0

if __name__ == "__main__":
    a = sys.argv[1:]; kieu = a[a.index("--kieu") + 1] if "--kieu" in a else "giua"; buoc = int(a[a.index("--buoc") + 1]) if "--buoc" in a else 20
    for cid in [x for x in a if x.isdigit()]:
        P = BC.doc_phim(cid); p, giay = ve(P, kieu, buoc); print(f"#{cid} {P['ten']} · {P['loai']} · {kieu}: {p} ({giay:.0f} giây)", flush=True)
