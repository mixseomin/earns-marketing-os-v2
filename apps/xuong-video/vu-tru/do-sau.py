#!/usr/bin/env python3
"""ĐỘ SÂU từ ảnh tĩnh — Depth Anything V2 Small (ONNX, chạy cục bộ trên iMac, 0₫): ảnh → ảnh xám cùng cỡ, TRẮNG = GẦN, ĐEN = XA.
Shader (ho-den-anh.html) dùng nó để làm parallax khi lao vào: điểm gần trôi ra mép nhanh hơn điểm xa.
Cài một lần: uv venv ~/.venvs/do-sau && uv pip install --python ~/.venvs/do-sau/bin/python onnxruntime numpy pillow
Mô hình: ~/.cache/do-sau/dav2-small.onnx (huggingface.co/onnx-community/depth-anything-v2-small, onnx/model.onnx, 99MB)
  ~/.venvs/do-sau/bin/python vu-tru/do-sau.py ra/vt-xa.jpg ra/vt-gan.jpg   → ra/vt-xa-sau.png, ra/vt-gan-sau.png
"""
import os, sys
import numpy as np
import onnxruntime as ort
from PIL import Image, ImageFilter

MO_HINH = os.path.expanduser('~/.cache/do-sau/dav2-small.onnx')
CANH = 518  # cạnh ngắn mô hình học (bội 14)
sess = ort.InferenceSession(MO_HINH)

for tep in sys.argv[1:]:
    img = Image.open(tep).convert('RGB')
    w, h = img.size
    s = CANH / min(w, h)
    nw, nh = round(w * s / 14) * 14, round(h * s / 14) * 14
    x = np.asarray(img.resize((nw, nh), Image.BICUBIC), dtype=np.float32) / 255.0
    x = (x - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]
    d = sess.run(None, {'pixel_values': x.transpose(2, 0, 1)[None].astype(np.float32)})[0][0]
    d = (d - np.percentile(d, 1)) / max(np.percentile(d, 99) - np.percentile(d, 1), 1e-6)  # độ chênh tương đối: lớn = gần
    out = Image.fromarray((np.clip(d, 0, 1) * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC).filter(ImageFilter.GaussianBlur(2))
    ra = os.path.splitext(tep)[0] + '-sau.png'
    out.save(ra)
    print(ra)
