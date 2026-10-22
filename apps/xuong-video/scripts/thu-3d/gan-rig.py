# GẮN RIG CHUẨN (Rigify) cho nhân vật / đồ vật sinh từ ảnh — một lệnh, mọi loại (anh 22/10/2026: "hoàn thiện xong phải chuẩn hoá refactor để sau còn
# áp dụng cho mọi nhân vật, đồ vật"). Các khâu tách module trong rig/:
#   luoi.nap_chuan → giai_phau.LOAI[loai] (mốc từ hình khối) → khung_rigify.METARIG[loai] + sinh_rig (Rigify) → gan_da.gan (trọng số qua bản kín)
#   → thu_dang.soat (tờ thử dáng bằng ĐIỀU KHIỂN của rig, như người diễn hoạt dùng)
# Thêm loại = thêm một hàm giải phẫu + một hàm metarig + một bộ dáng thử; không đụng khâu khác.
#   Blender -b --factory-startup -P gan-rig.py -- <mo-hinh.glb> <loai: bon_chan> <thu-muc-ra>   → rig.blend + soat.jpg-ready PNG
import bpy, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'rig'))
import luoi, giai_phau, khung_rigify, gan_da, thu_dang

a = sys.argv[sys.argv.index('--') + 1:]; VAO, LOAI, RA = a[0], a[1], a[2]; os.makedirs(RA, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
M, V, lo, hi = luoi.nap_chuan(VAO)
m = giai_phau.LOAI[LOAI](V, lo, hi)
meta = khung_rigify.METARIG[LOAI](m)
rig = khung_rigify.sinh_rig(meta); rig.name = 'Rig'
# mốc giải phẫu theo rig (thư viện động tác / tờ thử đọc lại: H, chóp đuôi, mõm…)
_js = lambda x: [_js(y) for y in x] if isinstance(x, (list, tuple)) else ({k: _js(v) for k, v in x.items()} if isinstance(x, dict) else (list(x) if hasattr(x, 'to_tuple') else x))
import json; rig['giai_phau'] = json.dumps(_js(m)); rig['loai'] = LOAI
thieu = gan_da.gan(M, rig, m['H'])
print('DA dinh khong trong so:', thieu, '/', len(M.data.vertices), '| xuong DEF:', sum(1 for b in rig.data.bones if b.use_deform))
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(RA, 'rig.blend'))
thu_dang.soat(rig, M, m, LOAI, RA)
print('RA', RA)
