#!/usr/bin/env python3
"""CHỌN PHIM MỚI ĐỂ CHUẨN BỊ CREATIVE (anh 23/10/2026: "phân tích để chọn ra 200 phim để chuẩn bị creatives… 200 phim là phim MỚI để theo plan hôm trước").
Cách chọn MỚI (anh 02/11/2026, xem khối CHẤM ĐIỂM): lọc nguồn ReelShort / NetShort · EN trước ES · thể loại thắng · loại sói, DramaBox, phim đội đã lên;
số QC app gốc chỉ là điểm phụ. Cách cũ (lô 19/10–02/11): phim mà CHÍNH APP GỐC đang chạy nhiều QC nhất (spy.on.tc view ethopex_uu_tien: số QC, QC đang chạy, số Page) = cầu thật đã được
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
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "etp")); import ethopex_api as EA   # cổng chung: chỉ tài khoản nhà (anh 28/10/2026)
api = lambda p: json.load(urllib.request.urlopen(urllib.request.Request("https://api.ethopex.dev" + p, headers={"authorization": "Bearer " + T, "user-agent": "mos2-chon-phim"}), timeout=90))
api = lambda p, b=None: EA.api(p, b)   # mọi lệnh Ethopex qua cổng chung apps/etp/ethopex_api.py: danh sách đủ mọi trang + chỉ camp tài khoản nhà, lệnh ghi vào camp ngoài bị chặn (anh 28/10/2026)

# 1. phim đã dùng: có camp Ethopex (mọi trạng thái) + đã dựng studio + phim cấm
# đọc KHO etp (dong-bo 10 phút: mọi camp nhà, mọi trạng thái, kèm content_id) thay ~900 lượt gọi chi tiết camp qua API (anh 02/11/2026: chạy định kỳ cho cột Test)
CAMPS = [{"name": t} for t in q("select ten from etp.camp").splitlines()]
da = {int(x) for x in q("select distinct content_id from etp.camp where content_id > 0").split() if x.isdigit()}
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

# PHIM ĐỘI ĐÃ LÊN (anh 02/11/2026 "ko lên camp trùng với các thành viên trong đội"): mọi phim có camp của người trong đội (etp.camp_ngoai, mọi trạng thái) — không test lại
da |= {int(x) for x in q("select distinct content_id from etp.camp_ngoai where content_id > 0").split() if x.isdigit()}
da_ten |= {chuan(re.split(r" (?:EN|ES) - ", re.sub(r"^(\d+:\s*)?(TEST\s+)?\d\S*\s+", "", t))[0])[:24] for t in q("select ten from etp.camp_ngoai").splitlines()}

# 2. CHẤM ĐIỂM (anh 02/11/2026 "sửa phương pháp chọn phim" — đo 357 phim cả đội test 19/10–30/10, phim thắng = lãi ≥ $20):
#   nguồn: ReelShort 14,5% · NetShort 3,2% · DramaBox 2,1% · tiếng: EN 5,8% · ES 3,3% · nhóm diễn viên: Âu-Mỹ 12,9% · Trung / hoạt hình 0% (cổng lên camp đã chặn)
#   thể loại: vô danh lật ngược 15% · hối hận 13% · fantasy 11% · mafia 9% · tỷ phú 7% · mẹ con 4% · sói 3% · tình cảm 3%
#   danh sách cũ xếp theo số QC app gốc (65% DramaBox) → 147 phim test, 2 thắng (1%), −$683. Số QC app gốc giờ chỉ là điểm phụ trong nhóm đã lọc.
NGUON = {"reelshort": 100, "netshort": 35}   # DramaBox / dramaboxdb: loại
TIENG = {"en": 20, "es": 0}
THE_LOAI = [   # (mã, điểm, mẫu tên) — đoán thể loại từ tên phim (phim chưa test chưa có etp.phim.the_loai)
    ("vo_danh", 45, r"nobody|homeless|beggar|\bbum\b|\bpoor\b|underdog|janitor|loser|nobod|unwanted|outcast|vagabund|mendig|\bnadie\b|pobre|desprecia"),
    ("hoi_han", 35, r"regret|too late|remorse|grovel|beg(s|ging)? (for|me)|arrepent|demasiado tarde|se arrepient"),
    ("fantasy", 25, r"dragon|goddess|\bgods?\b|immortal|magic|sorcer|sword|realm|deity|divine|celestial|dios|diosa|inmortal|mag[ií]a"),
    ("mafia", 15, r"mafia|\bdon\b|mob boss|cartel|capo"),
    ("ty_phu", 15, r"billionaire|heir|\bceo\b|tycoon|millionaire|magnate|multimillon|millonari|heredero|magnate"),
    ("me_con", -25, r"single mom|runaway mom|mommy|twins|triplets|quintuplet|madre soltera|gemelos|trillizos"),
    ("tinh_cam", -15, r"\bmarry|marriage|bride|contract (wife|marriage)|divorce|ex-wife|ex-husband|esposa|boda|divorcio|matrimonio"),
]
SOI = re.compile(r"alpha|\bluna\b|wolf|lycan|\bmat(e|es|ed)\b|\blobo|\balfa\b", re.I)   # sói 3% → loại (cả "Wolf God", "Female Mates")
def cham(x):
    if x["nguon"] not in NGUON or x["locale"] not in TIENG or SOI.search(x["ten"] or ""): return None
    tl = [(m, d) for m, d, mau in THE_LOAI if re.search(mau, x["ten"] or "", re.I)]
    spy = min(20, int(x.get("so_qc_dang") or 0) + 2 * int(x.get("so_page") or 0))
    x["diem"] = NGUON[x["nguon"]] + TIENG[x["locale"]] + sum(d for _, d in tl) + spy; x["nhom"] = tl[0][0] if tl else "khac"
    x["vi_sao"] = " · ".join([x["nguon"], x["locale"]] + [m for m, _ in tl] + ([f"app gốc {x.get('so_qc_dang')} QC đang chạy · {x.get('so_page')} Page"] if spy else []))
    return x
# 3. ứng viên = phim app gốc đang chạy QC (spy) + kho Ethopex ReelShort / NetShort mới nhất; gộp trùng tên + tiếng
uu = [dict(zip(["id", "locale", "ten", "nguon", "url", "so_qc", "so_qc_dang", "so_page"], r.split("\t"))) for r in
      qs("select id, locale, ten, nguon, url, so_qc, so_qc_dang, so_page from ethopex_uu_tien where locale in ('en','es')").splitlines() if r]
kho = [dict(zip(["id", "locale", "ten", "nguon", "url"], (r.split("\t") + [""] * 5)[:5])) for r in
       qs("select id, locale, ten, nguon, url from ethopex_content where locale in ('en','es') and nguon in ('reelshort','netshort') order by tao desc limit 8000").splitlines() if r]
def loai(x): return int(x["id"]) in da or x["id"] in cam or bool(TU_18.search(x["ten"] or "")) or chuan(x["ten"])[:24] in da_ten
chinh, _thay = [], set()
for x in uu + kho:   # spy trước: cùng phim thì giữ bản có số QC app gốc
    k = (chuan(x["ten"]), x["locale"])
    if loai(x) or k in _thay or not cham(x): continue
    _thay.add(k); chinh.append(x)
chinh.sort(key=lambda x: -x["diem"])
# CÓ THỂ TEST (anh 02/11/2026 "phim nào có thể test thì đánh dấu vào"): --co-the-test = chấm xong ghi TOÀN BỘ phim qua lọc (điểm cao trước) vào
# xv_khoa_ngoai['ethopex_co_the_test'] cho tab Phim etp.on.tc, KHÔNG đụng hàng chờ ethopex_200_phim. dong-bo.py chạy mỗi 6 giờ / khi thư viện có phim mới.
if "--co-the-test" in sys.argv:
    # phim đã bị quy trình phim mới LOẠI (poster / soát 18+ / cắt / cổng — phim-moi.py, sổ ethopex_phim_moi_tt) thì không còn là "có thể test"
    tt = json.loads(q("select coalesce(gia_tri, '{}'::jsonb)::text from xv_khoa_ngoai where ten='ethopex_phim_moi_tt'") or "{}")
    chinh = [x for x in chinh if not str((tt.get(str(x["id"])) or {}).get("tt", "")).endswith("_loai")]
    v = json.dumps({"luc": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(), "ds": [{k: x.get(k) for k in ("id", "locale", "ten", "nguon", "url", "diem", "nhom", "vi_sao")} for x in chinh]},
                   ensure_ascii=False).replace("'", "''")
    r = subprocess.run(["psql", os.environ["DATABASE_URL"], "-qtA", "-v", "ON_ERROR_STOP=1", "-f", "-"], capture_output=True, text=True,   # ~7.000 phim: qua stdin, không qua tham số
                       input=f"insert into xv_khoa_ngoai (ten, gia_tri) values ('ethopex_co_the_test', '{v}'::jsonb) on conflict (ten) do update set gia_tri = excluded.gia_tri")
    if r.returncode: raise SystemExit(r.stderr[-300:])
    print(json.dumps({"co_the_test": len(chinh)})); sys.exit(0)
# XEN KẼ THỂ LOẠI (lần chạy đầu 02/11/2026: 25/40 phim đầu là phim rồng fantasy — "dragon" trùng mẫu): mỗi vòng lấy một phim điểm cao nhất của từng thể loại,
# thứ tự vòng theo tỷ lệ thắng đo được (vô danh → hối hận → fantasy → mafia → tỷ phú → khác); trong một thể loại vẫn theo điểm
import collections as _co
_theo = _co.OrderedDict((m, [x for x in chinh if x["nhom"] == m]) for m in ["vo_danh", "hoi_han", "fantasy", "mafia", "ty_phu", "khac"])
ds = []
while len(ds) < SO and any(_theo.values()):
    for m, l in _theo.items():
        if l and len(ds) < SO: ds.append(l.pop(0))
ds += [x for x in chinh if x["nhom"] in ("tinh_cam", "me_con")][:SO - len(ds)]   # tình cảm 3% · mẹ con 4%: chỉ lấp chỗ trống, không chia suất
bu = []
if "--them" in sys.argv:   # BỔ SUNG (phim-moi.py them, anh 23/10/2026 "cần cái thay thế dự phòng"): giữ nguyên danh sách + thứ tự cũ, chỉ nối phim mới vào cuối tới đủ SO
    cu = json.loads(q("select coalesce(gia_tri, '[]'::jsonb)::text from xv_khoa_ngoai where ten='ethopex_200_phim'") or "[]"); co = {str(x["id"]) for x in cu}
    ds = cu + [x for x in ds if str(x["id"]) not in co][:max(0, SO - len(cu))]
v = json.dumps([{k: x.get(k) for k in ("id", "locale", "ten", "nguon", "url", "vi_sao")} for x in ds], ensure_ascii=False).replace("'", "''")
q(f"insert into xv_khoa_ngoai (ten, gia_tri) values ('ethopex_200_phim', '{v}'::jsonb) on conflict (ten) do update set gia_tri = excluded.gia_tri")
if "--json" in sys.argv: print(json.dumps(ds, ensure_ascii=False)); sys.exit(0)
print(f"đã dùng {len(da)} phim (nhà + đội) · ứng viên spy {len(uu)} + kho {len(kho)} → qua lọc {len(chinh)} phim → lấy {len(ds)}")
import collections
print("theo tiếng:", dict(collections.Counter(x["locale"] for x in ds)), "· theo nguồn:", dict(collections.Counter(x["nguon"] for x in ds)))
for n, x in enumerate(ds[:40], 1): print(f"{n:3}. [{x['locale']}] {x['ten'][:55]:55} {x['nguon']:9} {x['vi_sao']}")
