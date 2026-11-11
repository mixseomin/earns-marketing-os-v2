#!/usr/bin/env python3
"""PHÂN LOẠI CREATIVE CỦA ĐỘI THEO SỔ DẠNG (anh 11/11/2026: "Các creative của đội đang chưa phân loại được kiểu gì để tối ưu. Hãy bố trí để có máy thực hiện việc này";
12/11/2026 "Chạy luôn đi. Xong thì làm cơ chế tự chấm với creative mới của team").
Creative đội vào kho qua nap-creative-ngoai.py mang nhãn tạm dang = 'team'; Worker etp-cham chấm xong có 20 khung, độ dài, chữ trên màn, lời đọc, tóm tắt (etp.cham.lop).
Máy này đưa 6 khung + các số đó + định nghĩa 15 dạng (mo_ta trong apps/web/src/lib/etp-dang.json, đọc qua so_dang.py) cho AI qua ai_chu.py (donk → ckey) → một dạng.
  · tin cậy ≥ TIN_AP → ghi etp.creative.dang (trang / bộ lọc / widget Theo loại creative đọc cột này) — chỉ thay nhãn 'team', không đụng dạng nhà
  · "khác" hoặc tin cậy thấp → giữ 'team', lý do + mô tả kiểu lạ nằm ở etp.phan_loai (gom đề xuất dạng mới)
Kết quả mọi lượt: etp.phan_loai (tạo ở đây; mau_thu = lượt đo độ đúng trên creative nhà, không ghi đè gì).

  python3 apps/etp/phan_loai_cr.py --do 60          ĐO ĐỘ ĐÚNG: 60 creative nhà đã biết dạng (chia đều theo dạng), máy không thấy nhãn → % đúng + bảng nhầm
  python3 apps/etp/phan_loai_cr.py --team [--toi-da 500]   phân loại creative đội còn nhãn 'team' đã chấm (dong-bo.py gọi mỗi lượt, --toi-da 30)
  python3 apps/etp/phan_loai_cr.py --cr 90452 [--xem]      một creative (--xem: không ghi)"""
import collections, concurrent.futures as cf, json, os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ai_chu as AI, so_dang as DG

TIN_AP = 0.6        # tin cậy tối thiểu để ghi dạng vào etp.creative
SONG_SONG = 6       # lượt AI chạy song song (mỗi lượt một creative)
SO_KHUNG = 6        # khung đưa AI (chia đều trong 20 khung đã chấm)
KHAC = "khác"

def q(s):
    r = subprocess.run(["psql", os.environ["DATABASE_URL"], "-qtA", "-v", "ON_ERROR_STOP=1", "-f", "-"], input=s, capture_output=True, text=True)
    if r.returncode: raise RuntimeError(r.stderr.strip()[-300:])
    return r.stdout.strip()
def qj(s): return json.loads(q(f"select coalesce(json_agg(x), '[]') from ({s}) x") or "[]")
BANG = """create table if not exists etp.phan_loai (creative_id int not null, luc timestamptz not null default now(), dang text, tin_cay numeric, ly_do text, dau_hieu jsonb,
  mo_hinh text, vnd numeric not null default 0, ap boolean not null default false, mau_thu boolean not null default false, dang_that text, primary key (creative_id, mau_thu));"""

DS = [x for x in DG.DS if x.get("mo_ta")]
LUAT = ("You classify short-drama Facebook video ad creatives into ONE format from this list (Vietnamese names, use the exact name):\n"
        + "\n".join(f"- {x['dang']}: {x['mo_ta']}" for x in DS)
        + f"\n- {KHAC}: none of the above fits (describe the format in dau_hieu.kieu_la).\n"
        "Decide from: duration, whether the frames change or stay one still image, on-screen text style (subtitles of dialogue vs narration vs one quote vs title), "
        "voice (original dialogue vs first-person narrator vs short 'watch for free' line), numbered moments, fake comments, chat bubbles, poster art. "
        "tin_cay = your confidence 0–1. ly_do in Vietnamese, one sentence naming the signs you used.")
SCHEMA = {"type": "object", "required": ["dang", "tin_cay", "ly_do", "dau_hieu"], "properties": {
    "dang": {"type": "string", "enum": [x["dang"] for x in DS] + [KHAC]}, "tin_cay": {"type": "number"}, "ly_do": {"type": "string"},
    "dau_hieu": {"type": "object", "properties": {"long_tieng_ke": {"type": "boolean"}, "anh_dung_yen": {"type": "boolean"}, "co_chu_free": {"type": "boolean"},
                                                   "mo_dau": {"type": "string"}, "kieu_la": {"type": "string"}}}}}

def du_lieu(where, gioi_han=None, xep=""):
    return qj(f"""select c.creative_id, c.dang, h.lop->'anh'->>'giay' giay, h.lop->'anh'->'khung_url' khung, h.lop->'chu'->>'noi_dung' chu, h.lop->'chu'->'cta' cta,
                    h.lop->'giong'->>'noi_dung' giong, h.lop->'noi_dung'->>'tom_tat' tom_tat
                  from etp.creative c join etp.cham h using (creative_id) where jsonb_array_length(coalesce(h.lop->'anh'->'khung_url', '[]')) >= {SO_KHUNG} and {where}
                  {xep} {f'limit {int(gioi_han)}' if gioi_han else ''}""")

def mot(x):
    k = x.get("khung") or []; idx = sorted({round(i * (len(k) - 1) / (SO_KHUNG - 1)) for i in range(SO_KHUNG)})
    noi = [{"type": "image_url", "image_url": {"url": k[i]}} for i in idx]
    noi.append({"type": "text", "text": LUAT + f"\n\nDuration: {float(x.get('giay') or 0):.0f} s · {len(k)} frames sampled evenly, {len(idx)} shown above in order.\n"
                f"On-screen text: {(x.get('chu') or '(none)')[:700]}\nCTA buttons: {json.dumps(x.get('cta') or [], ensure_ascii=False)}\n"
                f"Voice / dialogue: {(x.get('giong') or '(none)')[:700]}\nVisual summary (Vietnamese): {(x.get('tom_tat') or '(none)')[:500]}"})
    a, vnd, mo, loi = AI.goi(noi, max_tokens=300, cong_cu=("ghi_dang", SCHEMA), kiem=lambda a: None if a.get("dang") in SCHEMA["properties"]["dang"]["enum"] else f"dạng lạ {a.get('dang')}", timeout=120)
    return {"creative_id": x["creative_id"], "that": x.get("dang"), "a": a, "vnd": vnd, "mo": mo, "loi": loi}

def chay(ds):
    with cf.ThreadPoolExecutor(SONG_SONG) as ex: return list(ex.map(mot, ds))

def ghi(kq, mau_thu):
    rows = [{"creative_id": r["creative_id"], "dang": (r["a"] or {}).get("dang"), "tin_cay": (r["a"] or {}).get("tin_cay"), "ly_do": (r["a"] or {}).get("ly_do") or r["loi"],
             "dau_hieu": (r["a"] or {}).get("dau_hieu"), "mo_hinh": r["mo"], "vnd": round(r["vnd"], 3), "mau_thu": mau_thu, "dang_that": r["that"] if mau_thu else None,
             "ap": (not mau_thu) and bool(r["a"]) and r["a"]["dang"] != KHAC and float(r["a"].get("tin_cay") or 0) >= TIN_AP} for r in kq]
    j = json.dumps(rows, ensure_ascii=False)
    q(BANG + f"""insert into etp.phan_loai (creative_id, dang, tin_cay, ly_do, dau_hieu, mo_hinh, vnd, ap, mau_thu, dang_that)
      select creative_id, dang, tin_cay, ly_do, dau_hieu, mo_hinh, vnd, ap, mau_thu, dang_that from jsonb_to_recordset($J${j}$J$::jsonb)
        as x(creative_id int, dang text, tin_cay numeric, ly_do text, dau_hieu jsonb, mo_hinh text, vnd numeric, ap boolean, mau_thu boolean, dang_that text)
      on conflict (creative_id, mau_thu) do update set luc = now(), dang = excluded.dang, tin_cay = excluded.tin_cay, ly_do = excluded.ly_do, dau_hieu = excluded.dau_hieu,
        mo_hinh = excluded.mo_hinh, vnd = excluded.vnd, ap = excluded.ap, dang_that = excluded.dang_that;""")
    if not mau_thu:   # chỉ thay nhãn tạm 'team' — dạng nhà (studio dựng, biết chắc) không bao giờ bị máy đè
        q(f"""update etp.creative c set dang = p.dang, cap_nhat = now() from etp.phan_loai p
              where p.creative_id = c.creative_id and not p.mau_thu and p.ap and c.dang = 'team' and c.creative_id in ({','.join(str(r['creative_id']) for r in rows) or 'null'})""")
    return rows

def main(a):
    if "--do" in a:
        n = int(a[a.index("--do") + 1]); moi = max(2, n // len(DS))
        ds = qj(f"""select creative_id from (select c.creative_id, row_number() over (partition by c.dang order by random()) r from etp.creative c join etp.cham h using (creative_id)
                    where c.dang in ({','.join("'" + x['dang'] + "'" for x in DS)}) and jsonb_array_length(coalesce(h.lop->'anh'->'khung_url', '[]')) >= {SO_KHUNG}) x where r <= {moi}""")
        ds = du_lieu(f"c.creative_id in ({','.join(str(x['creative_id']) for x in ds)})")[:n]
        kq = chay(ds); ghi(kq, True)
        ok = [r for r in kq if r["a"]]; dung = sum(r["a"]["dang"] == r["that"] for r in ok)
        theo = collections.defaultdict(lambda: [0, 0]); nham = collections.Counter()
        for r in ok:
            theo[r["that"]][1] += 1; theo[r["that"]][0] += r["a"]["dang"] == r["that"]
            if r["a"]["dang"] != r["that"]: nham[(r["that"], r["a"]["dang"])] += 1
        print(f"ĐO ĐỘ ĐÚNG: {dung}/{len(ok)} = {100 * dung // max(1, len(ok))}% · lỗi gọi {len(kq) - len(ok)} · tiền {sum(r['vnd'] for r in kq):.1f}₫ · cổng {collections.Counter((r['mo'] or 'lỗi').split(':')[0] for r in kq)}")
        for d, (t, s) in sorted(theo.items(), key=lambda kv: -kv[1][1]): print(f"  {d:<18} {t}/{s}")
        print("NHẦM:", "; ".join(f"{a} → {b} ×{c}" for (a, b), c in nham.most_common(12)))
        return
    if "--cr" in a:
        kq = chay(du_lieu(f"c.creative_id = {int(a[a.index('--cr') + 1])}"))
        print(json.dumps(kq, ensure_ascii=False, indent=1)[:1500])
        if "--xem" not in a: ghi(kq, False)
        return
    if "--team" in a:
        toi = int(a[a.index("--toi-da") + 1]) if "--toi-da" in a else 30
        q(BANG)
        # creative của camp ĐANG CHẠY trước, mới nhất trước (12/11/2026: lượt đầu lấy bừa 500 / 1.175 → rơi vào camp đã tắt, 369 creative đang chạy vẫn 'team')
        ds = du_lieu("c.dang = 'team' and not exists (select 1 from etp.phan_loai p where p.creative_id = c.creative_id and not p.mau_thu)", toi,
                     "order by exists (select 1 from etp.camp_ngoai k where k.creative_id = c.creative_id and k.trang_thai = 'ACTIVE') desc, c.creative_id desc")
        if not ds: print("phân loại đội: không có creative mới"); return
        rows = ghi(chay(ds), False)
        print(f"phân loại đội: {len(rows)} creative · ghi dạng {sum(r['ap'] for r in rows)} · khác / chưa chắc {sum(not r['ap'] for r in rows)} · {sum(r['vnd'] for r in rows):.1f}₫ · "
              + ", ".join(f"{d} {n}" for d, n in collections.Counter(r['dang'] for r in rows if r['ap']).most_common()))

if __name__ == "__main__": main(sys.argv[1:])
