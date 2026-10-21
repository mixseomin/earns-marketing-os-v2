# GHI CÔNG ĐỒ CỘNG ĐỒNG (CC-BY bắt buộc ghi tên tác giả): đọc packs/*.json của MPFB (cai-mpfb.sh đã cài) → GHI-CONG-DO.md trong repo — mọi asset CC-BY
# kèm tác giả + nguồn; CC0 không bắt buộc nhưng liệt kê luôn cho đủ. Chạy lại sau khi thêm gói:  python3 scripts/bo-set/ghi-cong-do.py <thư mục data MPFB>
import json, os, sys, glob
dd = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/Library/Application Support/Blender/5.0/extensions/.user/user_default/mpfb/data')
dong = {}
for f in sorted(glob.glob(os.path.join(dd, 'packs', '*.json'))):
    for ten, v in json.load(open(f)).items():
        if isinstance(v, dict) and v.get('license'): dong[ten] = (v['license'], v.get('author', ''), v.get('source', ''), os.path.basename(f)[:-5])
ra = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'GHI-CONG-DO.md')
with open(ra, 'w') as o:
    o.write('# Ghi công tài sản 3D cộng đồng (MakeHuman)\n\nTài sản MakeHuman Community dùng trong khung 3D của xưởng video (cài bằng `cai-mpfb.sh`). '
            'CC-BY: phải ghi tên tác giả khi phát hành. Tệp sinh tự động bằng `ghi-cong-do.py`.\n\n| Tài sản | Giấy phép | Tác giả | Nguồn | Gói |\n|---|---|---|---|---|\n')
    for ten, (lic, tg, ng, goi) in sorted(dong.items(), key=lambda x: (x[1][0] != 'CC-BY', x[0])):
        o.write(f'| {ten} | {lic} | {tg} | {ng} | {goi} |\n')
print(ra, len(dong), 'tài sản,', sum(1 for x in dong.values() if x[0] == 'CC-BY'), 'CC-BY')
