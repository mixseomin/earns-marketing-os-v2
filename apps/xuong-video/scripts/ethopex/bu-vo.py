#!/usr/bin/env python3
"""Bù câu đọc hook cho bản thư viện dựng TRƯỚC khi máy ghi câu theo bản (anh 27/11/2026 #1911 "Tại sao ko có HOok").
  bu-vo.py <tv_id> ...      ghi thu_vien.chu_qc.vo + etp.cho_len.muc.vo (chỉ dòng chưa có vo)
Chỉ bù khi dựng lại được ĐÚNG câu đã đọc, 0₫ (không gọi AI): sổ hook_phim của phim có đúng MỘT hook cho ngôn ngữ đó
(hook_phim lấy hook thứ N cho bản thứ N, sổ một hook = bản đã đọc là bản 0) và ghi chú bản có "giọng <kiểu>". Không chứng minh được → bỏ qua, in lý do."""
import importlib.util, json, os, re, sys

D = os.path.dirname(os.path.abspath(__file__))
if not os.path.isdir(os.path.join(D, "..", "..", "..", "..", "..", "etp2")): os.environ.setdefault("ETP2_GOC", os.path.expanduser("~/Me/GitHub/etp2"))   # chạy từ bản sao kỹ sư: đọc sổ mẫu ở repo etp2 chính trên iMac
s_ = importlib.util.spec_from_file_location("anh_tinh", os.path.join(D, "anh-tinh.py")); AT = importlib.util.module_from_spec(s_); s_.loader.exec_module(AT)

def kieu_tu_ghi(ghi):
    m = re.search(r"giọng (\w+)\s*$", ghi or "")
    return m.group(1) if m and m.group(1) in AT.KIEU_GIONG else None
assert kieu_tu_ghi("mẫu:dt_anh_dong_logo · bản 1 · giọng thuong") == "thuong" and kieu_tu_ghi("không có") is None

ids = [int(x) for x in sys.argv[1:] if x.isdigit()]
if not ids: sys.exit(__doc__)
so = json.loads(AT.sql("select gia_tri::text from etp.cau_hinh where khoa = 'hook_phim'") or "{}")
rows = json.loads(AT.sql(f"select coalesce(json_agg(row_to_json(v)), '[]') from (select id, content_id, lang, ten, ghi, chu_qc->'vo' vo from etp.thu_vien where id in ({','.join(map(str, ids))})) v") or "[]")
for r in rows:
    lang = (r["lang"] or "en")[:2].lower(); kieu = kieu_tu_ghi(r["ghi"]); ds = AT._ds_hook(so, r["content_id"], lang)
    if r["vo"]: print(f"tv{r['id']}: đã có câu đọc — giữ nguyên"); continue
    if not kieu: print(f"tv{r['id']}: ghi chú không có 'giọng <kiểu>' — không bù"); continue
    if len([h for h in ds if h]) != 1 or not ds[0]: print(f"tv{r['id']}: sổ hook phim có {len(ds)} hook — không biết bản đã đọc câu nào, không bù"); continue
    hook = ds[0]
    vo = {"cau": AT.cau_doc(lang, 0, kieu, r["ten"], hook.get("cau")), "giong": kieu, "mau": 0, "hook": hook, "bu": "bu-vo.py 27/11/2026"}
    j = "$Q$" + json.dumps(vo, ensure_ascii=False).replace("$Q$", "") + "$Q$::jsonb"
    AT.sql(f"update etp.thu_vien set chu_qc = coalesce(chu_qc, '{{}}'::jsonb) || jsonb_build_object('vo', {j}) where id = {r['id']}")
    AT.sql(f"update etp.cho_len set muc = coalesce(muc, '{{}}'::jsonb) || jsonb_build_object('vo', {j}) where khoa = 'tv{r['id']}' and not (coalesce(muc, '{{}}'::jsonb) ? 'vo')")
    n = AT.sql(f"select string_agg('#' || id, ', ') from etp.cho_len where khoa = 'tv{r['id']}' and muc ? 'vo'")
    print(f"✓ tv{r['id']}: {vo['cau'][:90]} → Chờ lên {n or '(chưa có dòng)'}")
