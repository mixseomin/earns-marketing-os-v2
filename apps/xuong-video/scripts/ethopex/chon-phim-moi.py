#!/usr/bin/env python3
"""CHỌN PHIM MỚI ĐỂ CHUẨN BỊ CREATIVE (anh 23/10/2026: "phân tích để chọn ra 200 phim để chuẩn bị creatives… 200 phim là phim MỚI để theo plan hôm trước").
Cách chọn (theo lô 19/10): phim mà CHÍNH APP GỐC đang chạy nhiều QC nhất (spy.on.tc view ethopex_uu_tien: số QC, QC đang chạy, số Page) = cầu thật đã được
app gốc trả tiền chứng minh. Bỏ: phim đã có camp Ethopex / đã dựng studio, phim cấm (ethopex_phim_cam, sổ bỏ phim), tên gợi dục / 18+ (kiem-phim-18 lớp chữ).
Chỉ EN + ES (anh 19/10/2026). Thiếu 200 thì bù bằng phim CÙNG THỂ LOẠI với phim đang thắng (tỷ phú ẩn thân, kẻ vô danh lật ngược, gia đình hối hận, mẹ đơn thân
+ tỷ phú, Alpha/Luna) trong kho Ethopex nguồn ReelShort/DramaBox/NetShort, mới nhất trước.
Chạy trên box3:  python3 chon-phim-moi.py [so=200] [--json] [--them: giữ danh sách cũ, nối thêm tới đủ so]  → bảng xếp hạng + ghi studio xv_khoa_ngoai['ethopex_200_phim']"""
import json, os, re, subprocess, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor
SO = next((int(a) for a in sys.argv[1:] if a.isdigit()), 200)
q = lambda s: subprocess.run(["psql", os.environ["DATABASE_URL"], "-tAc", s], capture_output=True, text=True).stdout.strip()
SPY = subprocess.run(["bash", "-c", ". /root/.secrets/spy.env; echo $DATABASE_URL"], capture_output=True, text=True).stdout.strip()
qs = lambda s: subprocess.run(["psql", SPY, "-tA", "-F", "\t", "-c", s], capture_output=True, text=True).stdout.strip()
T = q("select gia_tri->>'access_token' from xv_khoa_ngoai where ten='ethopex'")
api = lambda p: json.load(urllib.request.urlopen(urllib.request.Request("https://api.ethopex.dev" + p, headers={"authorization": "Bearer " + T, "user-agent": "mos2-chon-phim"}), timeout=90))

# 1. phim đã dùng: có camp Ethopex (mọi trạng thái) + đã dựng studio + phim cấm
def ct(c):
    try: return api(f"/api/v1/campaigns/{c['id']}")["ad_groups"][0]["ads"][0].get("content_id")
    except Exception: return None
CAMPS = api("/api/v1/campaigns?page_size=500")["data"]
with ThreadPoolExecutor(12) as ex: da = {x for x in ex.map(ct, CAMPS) if x}
chuan = lambda t: re.sub(r"[^a-z0-9]", "", re.sub(r"\(doblado\)|（dubbed）|\(dubbed\)", "", (t or "").lower()))
# phim đã test theo TÊN (cùng phim có thể mang mã content khác giữa lô — vd The Triplets' Final Regret): lõi tên camp sau mã lô, trước " EN - "/" ES - "
da_ten = {chuan(re.split(r" (?:EN|ES) - ", re.sub(r"^(\d+:\s*)?(TEST\s+)?\d\S*\s+", "", c["name"]))[0])[:24] for c in CAMPS}
da_ten |= {chuan(t.split(" · ")[1])[:24] for t in q("select ten from xv_phim where project='ethopex'").splitlines() if " · " in t}   # phim đã dựng studio
da |= {int(x) for x in q("select distinct (kinh_thanh->'ethopex'->>'content_id') from xv_phim where project='ethopex' and kinh_thanh->'ethopex' ? 'content_id'").split() if x.isdigit()}
cam = set(json.loads(q("select coalesce(gia_tri,'{}'::jsonb)::text from xv_khoa_ngoai where ten='ethopex_phim_cam'") or "{}"))
# tên gợi dục / quan hệ cấm kỵ (anh 22/10/2026 cấm phim kiểu SIMP NO MORE; Meta "Adult Sexual Exploitation")
TU_18 = re.compile(r"(\bsex|sexy|naked|nude|lust|seduc|bed ?mate|one night|mistress|stripper|escort|hooker|horny|kinky|erotic|virgin|pregnan|spicy|desire|obsess"
                   r"|plaything|fling|\bbed\b|step-?(uncle|dad|father|brother|son|mom)|nights? with|share his|claimed by|mated to .* and|forbidden|taboo|affair"
                   r"|boyfriend's (dad|father)|bestie's (dad|father)|husband's (brother|boss)|playboy|toy\b|slave|owns? (me|my)|amante|desnud|sexo|seducci|lujuria"
                   r"|noche de pasi|cuerpo|cama|prohibid|padrastro|t[ií]o pol[ií]tico)", re.I)

# 2. ứng viên chính: app gốc đang chạy QC (spy)
uu = [dict(zip(["id", "locale", "ten", "nguon", "url", "so_qc", "so_qc_dang", "so_page"], r.split("\t"))) for r in
      qs("select id, locale, ten, nguon, url, so_qc, so_qc_dang, so_page from ethopex_uu_tien where locale in ('en','es')").splitlines() if r]
def loai(x): return int(x["id"]) in da or x["id"] in cam or bool(TU_18.search(x["ten"] or "")) or chuan(x["ten"])[:24] in da_ten
chinh, _thay = [], set()
for x in uu:   # gộp trùng: cùng tên + tiếng (spy ghép một phim vào nhiều mã content)
    k = (chuan(x["ten"]), x["locale"])
    if loai(x) or k in _thay: continue
    _thay.add(k); chinh.append(x)
diem = lambda x: int(x["so_qc_dang"] or 0) * 3 + int(x["so_page"] or 0) * 5 + int(x["so_qc"] or 0)
for x in chinh: x["diem"] = diem(x); x["vi_sao"] = f"app gốc: {x['so_qc_dang']} QC đang chạy · {x['so_page']} Page · {x['so_qc']} QC tổng"
chinh.sort(key=lambda x: -x["diem"])

# 3. bù: cùng thể loại phim đang thắng, kho Ethopex nguồn có tập miễn phí, mới nhất trước
THANG = {"tỷ phú ẩn thân": r"billionaire|heir|ceo|tycoon|millionaire|multimillon|millonari|heredero|magnate",
         "vô danh lật ngược": r"nobody|homeless|beggar|bum|poor|underdog|vagabund|mendig|pobre|nadie|loser|janitor",
         "gia đình hối hận": r"regret|too late|brother|sister|family|father|daddy|arrepent|hermano|demasiado tarde|familia",
         "mẹ đơn thân": r"single mom|runaway|mommy|twins|triplets|madre soltera|gemelos|mam[aá]",
         "Alpha/Luna": r"alpha|luna|werewolf|lycan|mate|lobo|alfa"}
can = SO - len(chinh); bu = []
if can > 0:
    co = {x["id"] for x in chinh}
    for r in qs("select id, locale, ten, nguon, url from ethopex_content where locale in ('en','es') and nguon in ('reelshort','dramabox','netshort') order by tao desc limit 6000").splitlines():
        i, loc, ten, ng, url = (r.split("\t") + [""] * 5)[:5]
        if i in co or loai({"id": i, "ten": ten}) or (chuan(ten), loc) in _thay: continue
        tl = [k for k, m in THANG.items() if re.search(m, ten or "", re.I)]
        if not tl: continue
        _thay.add((chuan(ten), loc)); bu.append({"id": i, "locale": loc, "ten": ten, "nguon": ng, "url": url, "diem": len(tl), "vi_sao": "cùng thể loại phim đang thắng: " + ", ".join(tl)})
        if len(bu) >= can * 3: break
    bu.sort(key=lambda x: -x["diem"]); bu = bu[:can]
ds = (chinh + bu)[:SO]
if "--them" in sys.argv:   # BỔ SUNG (phim-moi.py them, anh 23/10/2026 "cần cái thay thế dự phòng"): giữ nguyên danh sách + thứ tự cũ, chỉ nối phim mới vào cuối tới đủ SO
    cu = json.loads(q("select coalesce(gia_tri, '[]'::jsonb)::text from xv_khoa_ngoai where ten='ethopex_200_phim'") or "[]"); co = {str(x["id"]) for x in cu}
    ds = cu + [x for x in ds if str(x["id"]) not in co][:max(0, SO - len(cu))]
v = json.dumps([{k: x.get(k) for k in ("id", "locale", "ten", "nguon", "url", "vi_sao")} for x in ds], ensure_ascii=False).replace("'", "''")
q(f"insert into xv_khoa_ngoai (ten, gia_tri) values ('ethopex_200_phim', '{v}'::jsonb) on conflict (ten) do update set gia_tri = excluded.gia_tri")
if "--json" in sys.argv: print(json.dumps(ds, ensure_ascii=False)); sys.exit(0)
print(f"đã dùng {len(da)} phim · spy {len(uu)} → còn {len(chinh)} phim mới có QC app gốc · bù {len(bu)} cùng thể loại → {len(ds)} phim")
import collections
print("theo tiếng:", dict(collections.Counter(x["locale"] for x in ds)), "· theo nguồn:", dict(collections.Counter(x["nguon"] for x in ds)))
for n, x in enumerate(ds[:40], 1): print(f"{n:3}. [{x['locale']}] {x['ten'][:55]:55} {x['nguon']:9} {x['vi_sao']}")
