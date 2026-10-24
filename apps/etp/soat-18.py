#!/usr/bin/env python3
"""SOÁT 18+ TỰ ĐỘNG — BỘ LỌC TRƯỚC (etp.on.tc bước 5c, anh 24/10/2026 "B5 đi" — cách (c): miễn phí, chạy trên iMac).
Mỗi phim trong lô: lấy 8 khung / đoạn cắt + poster → NudeNet (khoả thân) + đo mảng đỏ đậm (nghi máu) → xếp loại:
  cam  : lộ khoả thân rõ (vú / bộ phận sinh dục / mông trần) ở ≥ 1 khung điểm ≥ 0,6 → ghi luôn kiem-phim-18 --soat cam (máy, kèm lý do)
  xem  : gợi dục (cởi trần nam, ngực che, bụng…) hoặc mảng đỏ đậm > 2,5% khung → Claude / người xem trước, kèm lý do
  qua  : máy không thấy gì — VẪN CẦN người lướt (máy không nhận diện được súng / dao / máu ít)
Ghi etp.soat_may (điểm từng phim) + in danh sách theo thứ tự rủi ro; tờ soát ghép lại thành <lô>/soat-xem.jpg (phim 'xem' trước).
Chạy (iMac): ~/.cache/ethopex/venv-18/bin/python apps/etp/soat-18.py <thư mục lô>"""
import glob, json, os, subprocess, sys
from collections import defaultdict
B = "root@167.233.241.16"; ENV = "cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a"
N = os.path.expanduser("~/.cache/ethopex/nguon")
LO = {"FEMALE_BREAST_EXPOSED", "FEMALE_GENITALIA_EXPOSED", "MALE_GENITALIA_EXPOSED", "BUTTOCKS_EXPOSED", "ANUS_EXPOSED"}
GOI = {"MALE_BREAST_EXPOSED", "FEMALE_BREAST_COVERED", "BELLY_EXPOSED", "BUTTOCKS_COVERED", "FEMALE_GENITALIA_COVERED", "ARMPITS_EXPOSED"}
DO_NGUONG = 0.025

def sql(cau):
    r = subprocess.run(["ssh", B, f'{ENV}; psql "$DATABASE_URL" -qtA -v ON_ERROR_STOP=1 -f -'], input=cau, capture_output=True, text=True, timeout=120)
    if r.returncode: raise RuntimeError(r.stderr[-300:])
    return r.stdout.strip()

def do_do(f):
    """tỉ lệ điểm ảnh đỏ đậm kiểu máu (R cao, G B thấp) — mẫu thô"""
    from PIL import Image
    im = Image.open(f).convert("RGB").resize((180, 320)); px = im.getdata()
    return sum(1 for r, g, b in px if r > 120 and r > 2.2 * g and r > 2.2 * b) / len(px)

def main(lo_dir):
    from nudenet import NudeDetector
    det = NudeDetector()
    lo = json.load(open(os.path.join(lo_dir, "lo.json")))
    theo = defaultdict(list)
    for x in lo:
        if x.get("file") and not x.get("loi") and os.path.exists(x["file"]): theo[str(x["content_id"])].append(x["file"])
    tmp = os.path.join(lo_dir, "_khung18"); os.makedirs(tmp, exist_ok=True); kq = {}
    for cid, fs in theo.items():
        anh = []
        for f in fs:
            d = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], capture_output=True, text=True).stdout.strip() or 60)
            b = os.path.join(tmp, f"{cid}-{os.path.basename(f)[:-4]}-%02d.jpg")
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", f, "-vf", f"fps=8/{d},scale=540:-2", "-frames:v", "8", b], check=False)
            anh += sorted(glob.glob(b.replace("%02d", "*")))
        p = os.path.join(N, cid, "poster.jpg")
        if os.path.exists(p): anh.append(p)
        lo_, goi, do = [], [], 0.0
        for a in anh:
            for d_ in det.detect(a):
                if d_["class"] in LO and d_["score"] >= 0.6: lo_.append(f"{d_['class'].lower()} {d_['score']:.2f}")
                elif d_["class"] in GOI and d_["score"] >= 0.5: goi.append(d_["class"].lower())
            try: do = max(do, do_do(a))
            except Exception: pass
        ket = "cam" if lo_ else ("xem" if (len(goi) >= 3 or do > DO_NGUONG) else "qua")
        ly = "; ".join(filter(None, [("khoả thân: " + ", ".join(lo_[:3])) if lo_ else "", (f"gợi dục {len(goi)} khung ({', '.join(sorted(set(goi))[:3])})") if goi else "", (f"mảng đỏ đậm {do * 100:.1f}%") if do > DO_NGUONG else ""]))
        kq[cid] = {"ket": ket, "ly": ly or "máy không thấy gì (vẫn cần người lướt: súng / dao / máu ít)", "khung": len(anh), "goi": len(goi), "do": round(do, 4)}
        print(f"{cid}: {ket} · {kq[cid]['ly']}", flush=True)
    if kq:
        j = json.dumps([{"content_id": int(k), **v} for k, v in kq.items()], ensure_ascii=False).replace("$J$", "")
        sql(f"""create table if not exists etp.soat_may (content_id int primary key, ket text, ly text, khung int, goi int, do numeric, luc timestamptz not null default now());
               insert into etp.soat_may (content_id, ket, ly, khung, goi, do) select content_id, ket, ly, khung, goi, do from jsonb_to_recordset($J${j}$J$::jsonb) as x(content_id int, ket text, ly text, khung int, goi int, do numeric)
               on conflict (content_id) do update set ket = excluded.ket, ly = excluded.ly, khung = excluded.khung, goi = excluded.goi, do = excluded.do, luc = now()""")
        cam = [k for k, v in kq.items() if v["ket"] == "cam"]
        for k in cam:   # tự loại khoả thân rõ — cùng sổ soát 18+ với Claude
            sql(f"select 1"); subprocess.run(["ssh", B, f"{ENV}; cd apps/xuong-video/scripts/ethopex && python3 kiem-phim-18.py --soat {k} cam 'máy soát 18+ (NudeNet): {kq[k]['ly'][:120]}'"], capture_output=True, timeout=120)
    # tờ soát xếp theo rủi ro: xem → qua (cam đã tự loại)
    thu_tu = sorted([k for k in kq if kq[k]["ket"] != "cam"], key=lambda k: (kq[k]["ket"] != "xem", -kq[k]["goi"], -kq[k]["do"]))
    json.dump({"kq": kq, "thu_tu": thu_tu}, open(os.path.join(lo_dir, "soat-may.json"), "w"), ensure_ascii=False, indent=1)
    print(f"TỔNG: {sum(1 for v in kq.values() if v['ket'] == 'cam')} tự loại · {sum(1 for v in kq.values() if v['ket'] == 'xem')} cần xem trước · {sum(1 for v in kq.values() if v['ket'] == 'qua')} máy không thấy gì · thứ tự soát: {lo_dir}/soat-may.json")

if __name__ == "__main__": main(sys.argv[1])
