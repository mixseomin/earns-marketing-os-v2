# ĐO MỘT ĐOẠN MOCAP trước khi đưa vào bảng MOCAP (mesh/mocap.py): mỗi 0,5 s in cao hông (so lúc đứng), độ cao hai cổ tay so đầu, khoảng cách
# tay–mặt, tốc độ tay — để chọn giây bắt đầu / dừng / dáng đầu–cuối bằng SỐ chứ không đoán theo tên đoạn trong chỉ mục CMU.
# Chạy thuần Python (không cần Blender):  python3 do-mocap.py <thư mục bvh> <mã> [<mã>…]
import math, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'mesh'))
import mocap

if len(sys.argv) < 3: sys.exit('python3 do-mocap.py <thư mục bvh> <mã>…')
mocap.THU_MUC = sys.argv[1]
kc = lambda a, b: math.dist(a, b)
for ma in sys.argv[2:]:
    _, khung, dt = mocap.doc_bvh(ma); san, dung = mocap.moc_hong(ma)
    print(f'== {ma}: {len(khung) * dt:.1f} s')
    truoc = None
    for k in range(0, len(khung), max(1, int(0.5 / dt))):
        p = mocap.vi_tri_khop(ma, k); dau = p['Head']; dai = kc(p['Hips'], dau) or 1
        hong = (p['Hips'][1] - san) / (dung or 1)
        tt, tp = p['LeftHand'], p['RightHand']
        cao = lambda h: (h[1] - dau[1]) / dai          # >0 tay trên đầu, ~0 ngang mặt, −1 ngang hông
        mat = min(kc(tt, dau), kc(tp, dau)) / dai       # < 0,35 = tay sát mặt
        tocdo = (kc(tt, truoc[0]) + kc(tp, truoc[1])) / dai / 0.5 if truoc else 0
        truoc = (tt, tp)
        print(f'{k * dt:5.1f}s hong {hong:4.2f}  tay T {cao(tt):+.2f} P {cao(tp):+.2f}  sat_mat {mat:4.2f}  toc {tocdo:4.2f}')
