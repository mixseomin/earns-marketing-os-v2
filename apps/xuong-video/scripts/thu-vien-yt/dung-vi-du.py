#!/usr/bin/env python3
# Dựng src/lib/xuong-video/vi-du-yt.ts từ vi-du.json (kỹ thuật → chapter) + chuong.json (chapter THẬT đọc từ YouTube, doc-chuong.py).
# Chapter không có trong chuong.json → DỪNG, không ghi (không bịa link / mốc giây). den = giây bắt đầu chapter kế (hoặc hết video).
#   python3 apps/xuong-video/scripts/thu-vien-yt/dung-vi-du.py
import json, sys
from pathlib import Path
d = Path(__file__).parent
ch = {v['id']: v for v in json.loads((d / 'chuong.json').read_text())}
map_ = json.loads((d / 'vi-du.json').read_text())
out, loi = {}, []
for k, ds in map_.items():
    if k.startswith('_'): continue
    for vid, ten in ds:
        v = ch.get(vid)
        if not v: loi.append(f'{k}: video {vid} chưa đọc chapter'); continue
        i = next((j for j, c in enumerate(v['chuong']) if c['ten'] == ten), None)
        if i is None: loi.append(f'{k}: video {vid} không có chapter "{ten}"'); continue
        tu = v['chuong'][i]['tu']; den = v['chuong'][i + 1]['tu'] if i + 1 < len(v['chuong']) else v.get('dai')
        out.setdefault(k, []).append({'yt': vid, 'tu': tu, 'den': den, 'chuong': ten, 'video': v['tieu_de'], 'kenh': v['kenh'], 'ngay_doc': v['ngay_doc']})
if loi: print('\n'.join('✗ ' + x for x in loi), file=sys.stderr); sys.exit(1)
ts = d.parents[1] / 'src/lib/xuong-video/vi-du-yt.ts'
ts.write_text('''// SINH TỰ ĐỘNG bởi scripts/thu-vien-yt/dung-vi-du.py — đừng sửa tay (sửa vi-du.json rồi chạy lại).
// Ví dụ video cho thư viện điện ảnh: mỗi kỹ thuật → đoạn đúng chapter của video YouTube (mốc giây đọc từ chapter thật, chuong.json).
export type ViDuYt = { yt: string; tu: number; den: number | null; chuong: string; video: string; kenh: string; ngay_doc: string };
export const VI_DU_YT: Record<string, ViDuYt[]> = ''' + json.dumps(out, ensure_ascii=False, indent=1) + ''';
/** Khoá = '<nhóm>.<key>' của dien-anh.ts hoặc 'luat.<key>' của luat-dung.ts. */
export const viDuCua = (ma: string): ViDuYt[] => VI_DU_YT[ma] ?? [];
export const linkYt = (v: Pick<ViDuYt, 'yt' | 'tu'>) => `https://www.youtube.com/watch?v=${v.yt}&t=${v.tu}s`;
export const nhungYt = (v: Pick<ViDuYt, 'yt' | 'tu' | 'den'>) => `https://www.youtube-nocookie.com/embed/${v.yt}?start=${v.tu}${v.den ? `&end=${v.den}` : ''}&autoplay=1&rel=0`;
export const anhYt = (yt: string) => `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`;
''')
print(f'✓ {sum(len(x) for x in out.values())} ví dụ cho {len(out)} kỹ thuật → {ts.relative_to(d.parents[2])}')
