# TỜ ĐỘNG TÁC: mỗi động tác trong thư viện (rig/dong_tac.py) chụp N khoảnh khắc, máy nhìn ngang — soát dáng đi / chạy / nhảy / ngã. 0đ.
#   Blender -b <rig.blend từ gan-rig.py> -P thu-dong-tac.py -- <loai> <thu-muc-ra> [--khung=6] [--chi=di,chay]
import bpy, sys, os, json
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'rig'))
import dong_tac, thu_dang

a = sys.argv[sys.argv.index('--') + 1:]; LOAI, RA = a[0], a[1]; os.makedirs(RA, exist_ok=True)
N = int(next((x.split('=')[1] for x in a if x.startswith('--khung=')), '6'))
CHI = next((x.split('=')[1].split(',') for x in a if x.startswith('--chi=')), list(dong_tac.DONG_TAC[LOAI]))
rig = bpy.data.objects['Rig']; m = json.loads(rig['giai_phau'])
sc = thu_dang.san_khau(m['H'], thu_dang.rong_cua(m) * 0.75, ben=True); sc.cycles.samples = 16
sc.render.resolution_x = sc.render.resolution_y = 320
for ten in CHI:
    for k in range(N):
        dong_tac.dat(rig, LOAI, ten, m['H'], k / N); bpy.context.view_layer.update()
        sc.render.filepath = os.path.join(RA, f'dt.{ten}.{k}.png'); bpy.ops.render.render(write_still=True)
print('RA', RA, CHI)
