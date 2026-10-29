#!/usr/bin/env python
# 🔁 FACE-SWAP (ghép mặt hình học) — giữ danh tính diễn viên AI qua mọi shot, thứ mô hình SINH ẢNH không làm được
# (đo 28/10/2026: ckey vẽ cả ảnh HAY chỉ vẽ lại vùng mặt đều ra người khác, 17-47%). InsightFace buffalo_l (dò + nhúng
# ArcFace) + inswapper_128.onnx: lấy ĐÚNG mặt anchor ghép hình học vào mặt đích, giữ nguyên tóc/áo/khung/ánh sáng. CPU, $0.
#
# stdin JSON: {"src": "<url|path mặt nguồn (anchor)>", "items": [{"tgt": "<path ảnh đích>", "out": "<path ghi ra>"}], "which": "lon"}
#   which: "lon" = ghép mặt TO nhất trong khung (mặc định, hợp CU/medium 1 người) | "tatca" = mọi mặt
# stdout JSON: {"src_ok": bool, "ket": [{"tgt","out","so_mat": N, "ghep": M, "loi"?}]}
import sys, os, json, urllib.request
import numpy as np, cv2

MODELS = os.environ.get('XV_FACE_SWAP_MODELS', '/opt/xv-face-swap/models')
SWAP_ONNX = os.path.join(MODELS, 'inswapper_128.onnx')


def doc(u):
    if os.path.exists(u):
        b = open(u, 'rb').read()
    else:
        b = urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'xv-face-swap'}), timeout=60).read()
    return cv2.imdecode(np.frombuffer(b, np.uint8), cv2.IMREAD_COLOR)


def main():
    vao = json.load(sys.stdin)
    from insightface.app import FaceAnalysis
    from insightface.model_zoo import get_model
    app = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])
    app.prepare(ctx_id=-1, det_size=(640, 640))
    swapper = get_model(SWAP_ONNX, providers=['CPUExecutionProvider'])

    src_img = doc(vao['src'])
    src_faces = app.get(src_img)
    if not src_faces:
        print(json.dumps({'src_ok': False, 'ket': [], 'loi': 'không thấy mặt trong ảnh nguồn'}))
        return
    src = max(src_faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
    which = vao.get('which', 'lon')
    ket = []
    for it in vao['items']:
        try:
            img = doc(it['tgt'])
            faces = app.get(img)
            if not faces:
                ket.append({'tgt': it['tgt'], 'out': it['out'], 'so_mat': 0, 'ghep': 0, 'loi': 'không thấy mặt đích'})
                continue
            chon = faces if which == 'tatca' else [max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))]
            res = img
            for f in chon:
                res = swapper.get(res, f, src, paste_back=True)
            os.makedirs(os.path.dirname(it['out']) or '.', exist_ok=True)
            cv2.imwrite(it['out'], res)
            ket.append({'tgt': it['tgt'], 'out': it['out'], 'so_mat': len(faces), 'ghep': len(chon)})
        except Exception as e:
            ket.append({'tgt': it['tgt'], 'out': it['out'], 'so_mat': 0, 'ghep': 0, 'loi': str(e)})
    print(json.dumps({'src_ok': True, 'ket': ket}))


if __name__ == '__main__':
    main()
