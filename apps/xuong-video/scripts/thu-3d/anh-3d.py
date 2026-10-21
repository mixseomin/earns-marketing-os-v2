# ẢNH → LƯỚI 3D qua Space Hugging Face miễn phí tencent/Hunyuan3D-2.1 — 0đ, hạn mức ZeroGPU. /generation_all (lưới + texture) đòi 270 s GPU, vượt
# trần tài khoản free (21/10/2026) → mặc định /shape_generation (lưới trắng); màu do hang-khung-long.py chiếu ảnh concept lên. --mau = thử đường có texture.
# Ảnh vào: MỘT nhân vật / món, nền trơn (Space tự tách nền), cắt vuông quanh vật trước khi gửi.
#   <python có gradio_client> anh-3d.py <anh.jpg> <ra.glb> [--seed=1234] [--octree=320]
import sys, shutil, time, json
from PIL import Image
from gradio_client import Client, handle_file
vao, ra = sys.argv[1], sys.argv[2]
opt = {a.lstrip('-').split('=')[0]: (a.split('=') + [''])[1] for a in sys.argv[3:]}
im = Image.open(vao).convert('RGB'); w, h = im.size; nen = im.getpixel((5, 5))
# cắt vuông quanh vật: hộp các điểm khác nền rõ rệt, nới 8%
px = im.load(); xs, ys = [], []
for y in range(0, h, 4):
    for x in range(0, w, 4):
        if sum(abs(a - b) for a, b in zip(px[x, y], nen)) > 60: xs.append(x); ys.append(y)
x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys); c = max(x1 - x0, y1 - y0) * 1.16; cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
o = Image.new('RGB', (int(c), int(c)), nen); o.paste(im.crop((int(cx - c / 2), int(cy - c / 2), int(cx + c / 2), int(cy + c / 2))), (0, 0))
o = o.resize((1024, 1024), Image.LANCZOS); vuong = ra.rsplit('.', 1)[0] + '_vuong.png'; o.save(vuong)
t = time.time(); cl = Client('tencent/Hunyuan3D-2.1', verbose=False, httpx_kwargs={'timeout': 600})
r = cl.predict(image=handle_file(vuong), mv_image_front=None, mv_image_back=None, mv_image_left=None, mv_image_right=None, steps=30, guidance_scale=5.0,
               seed=int(opt.get('seed', 1234)), octree_resolution=int(opt.get('octree', 320)), check_box_rembg=True, num_chunks=8000, randomize_seed=False,
               api_name='/generation_all' if 'mau' in opt else '/shape_generation')
kq = r[1] if 'mau' in opt else r[0]   # generation_all: (lưới trắng, lưới có màu, …) · shape_generation: (lưới, html, thống kê, seed)
f = kq['value'] if isinstance(kq, dict) else kq
shutil.copy(f, ra); print('RA', ra, round(time.time() - t), 's', json.dumps(r[-2])[:300])
