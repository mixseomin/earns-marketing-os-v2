#!/usr/bin/env python
# 🔁🎞 FACE-SWAP CLIP (ghép mặt TỪNG KHUNG của video) — sửa mặt trôi trong clip đã render MÀ KHÔNG cần regen (VideoExpress
# có thể trôi lại khi sinh video mới). Xác định, CPU, $0. Giữ nguyên tiếng + fps + độ dài. Chỉ thay vùng mặt — không sửa
# nội dung sai (tóc màu khác, sai beat): shot đó phải regen keyframe.
#
# stdin JSON: {"src": "<url|path mặt nguồn>", "which": "lon"|"tatca", "clips": [{"tgt": "<mp4 vào>", "out": "<mp4 ra>"}], "fps": 0, "muot": 0.6}
#   fps 0 = giữ fps gốc. khung không thấy mặt → giữ nguyên khung gốc.
#   muot (0..0.9): LÀM MƯỢT THEO THỜI GIAN — bám mặt qua các khung, EMA 5 điểm mốc mặt để vị trí/ghép không giật.
#     smoothed = muot·(mốc khung trước) + (1-muot)·(mốc khung này). 0 = tắt (mốc thô). Khử rung mà không bóng ma
#     (mỗi khung vẫn render nét, chỉ căn vào mốc đã mượt). Mất bám (không thấy mặt / nhảy xa) thì tự khởi động lại.
# SHOT NHIỀU NGƯỜI: thay "src"/"which" bằng "srcs": [{"src": "<url>", "x": 0.22}, …] — mỗi mặt phát hiện được gán nguồn có x
#   (0=trái … 1=phải) GẦN NHẤT theo tâm ngang khung, để Hạ ra Hạ, Vivian ra Vivian đúng vị trí.
# stdout JSON: {"src_ok": bool, "ket": [{"tgt","out","khung": N, "ghep": M, "loi"?}]}
import sys, os, json, tempfile, subprocess, glob, urllib.request
import numpy as np, cv2

MODELS = os.environ.get('XV_FACE_SWAP_MODELS', '/opt/xv-face-swap/models')
SWAP_ONNX = os.path.join(MODELS, 'inswapper_128.onnx')


def doc(u):
    if os.path.exists(u):
        b = open(u, 'rb').read()
    else:
        b = urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'xv-face-swap'}), timeout=60).read()
    return cv2.imdecode(np.frombuffer(b, np.uint8), cv2.IMREAD_COLOR)


def fps_cua(mp4):
    try:
        r = subprocess.run(['ffprobe', '-v', '0', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate',
                            '-of', 'default=nk=1:nw=1', mp4], capture_output=True, text=True)
        n, d = r.stdout.strip().split('/')
        return float(n) / float(d)
    except Exception:
        return 24.0


def main():
    vao = json.load(sys.stdin)
    from insightface.app import FaceAnalysis
    from insightface.model_zoo import get_model
    app = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])
    app.prepare(ctx_id=-1, det_size=(640, 640))
    swapper = get_model(SWAP_ONNX, providers=['CPUExecutionProvider'])

    def lay_src(u):
        im = doc(u); fs = app.get(im)
        return max(fs, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1])) if fs else None

    nhieu = isinstance(vao.get('srcs'), list) and len(vao['srcs']) > 0
    if nhieu:
        srcs = [{'x': float(s['x']), 'face': lay_src(s['src'])} for s in vao['srcs']]
        if any(s['face'] is None for s in srcs):
            print(json.dumps({'src_ok': False, 'ket': [], 'loi': 'thiếu mặt nguồn ở srcs'})); return
        src = None; which = 'tatca'
    else:
        src = lay_src(vao['src'])
        if src is None:
            print(json.dumps({'src_ok': False, 'ket': [], 'loi': 'không thấy mặt nguồn'})); return
        which = vao.get('which', 'lon')

    def nguon_cho(face, w):
        cx = float((face.bbox[0] + face.bbox[2]) / 2) / w
        return min(srcs, key=lambda s: abs(s['x'] - cx))['face']
    ket = []
    for it in vao['clips']:
        tg = it['tgt']; out = it['out']
        try:
            fps = vao.get('fps') or fps_cua(tg)
            d = tempfile.mkdtemp(prefix='vxswap-')
            ind = os.path.join(d, 'in'); outd = os.path.join(d, 'out'); os.makedirs(ind); os.makedirs(outd)
            subprocess.run(['ffmpeg', '-v', 'error', '-i', tg, os.path.join(ind, 'f%05d.png')], check=True)
            frames = sorted(glob.glob(os.path.join(ind, '*.png')))
            ghep = 0
            muot = float(vao.get('muot', 0.6)); muot = max(0.0, min(0.9, muot))
            tracks = []  # [{'c': (cx,cy), 'kps': np.ndarray(5,2)}] — bám mặt + mốc đã làm mượt, giữa các khung của MỘT clip
            for fp in frames:
                img = cv2.imread(fp); faces = app.get(img); res = img
                if faces:
                    w = img.shape[1]
                    nguong_bam = 0.12 * w  # tâm mặt nhảy xa hơn thì coi là mặt khác → khởi động lại track
                    chon = faces if which == 'tatca' else [max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))]
                    moi = []
                    for f in chon:
                        cx = float((f.bbox[0] + f.bbox[2]) / 2); cy = float((f.bbox[1] + f.bbox[3]) / 2)
                        tr = min(tracks, key=lambda t: (t['c'][0] - cx) ** 2 + (t['c'][1] - cy) ** 2, default=None)
                        if muot > 0 and tr is not None and ((tr['c'][0] - cx) ** 2 + (tr['c'][1] - cy) ** 2) ** 0.5 < nguong_bam:
                            ks = muot * tr['kps'] + (1 - muot) * f.kps   # EMA mốc → căn ổn định
                            f.kps = ks
                        else:
                            ks = f.kps
                        moi.append({'c': (cx, cy), 'kps': ks})
                        s = nguon_cho(f, w) if nhieu else src
                        res = swapper.get(res, f, s, paste_back=True)
                    tracks = moi
                    ghep += 1
                else:
                    tracks = []  # mất mặt → ngắt bám, khung sau khởi động lại
                cv2.imwrite(os.path.join(outd, os.path.basename(fp)), res)
            os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
            # ghép lại + bê NGUYÊN tiếng gốc (map 1:v mới, 0:a? gốc) — nếu clip gốc có tiếng
            co_tieng = subprocess.run(['ffprobe', '-v', '0', '-select_streams', 'a', '-show_entries', 'stream=index',
                                       '-of', 'csv=p=0', tg], capture_output=True, text=True).stdout.strip() != ''
            cmd = ['ffmpeg', '-v', 'error', '-y', '-framerate', str(fps), '-i', os.path.join(outd, 'f%05d.png')]
            if co_tieng:
                cmd += ['-i', tg, '-map', '0:v:0', '-map', '1:a:0', '-c:a', 'aac', '-shortest']
            cmd += ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', out]
            subprocess.run(cmd, check=True)
            ket.append({'tgt': tg, 'out': out, 'khung': len(frames), 'ghep': ghep})
        except Exception as e:
            ket.append({'tgt': tg, 'out': out, 'khung': 0, 'ghep': 0, 'loi': str(e)})
    print(json.dumps({'src_ok': True, 'ket': ket}))


if __name__ == '__main__':
    main()
