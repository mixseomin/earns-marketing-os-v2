#!/usr/bin/env python3
"""CHỜ ANH DUYỆT TRƯỚC KHI LÊN ETHOPEX (anh 27/11/2026: "sau này creative khi duyệt thì ko gửi lên etho. Phải show ra tao duyệt xong mới bắt đầu gửi lên đó!").
len-creative.py là đường DUY NHẤT gọi bulk-jobs → cổng đặt ở đó, mọi người gọi (dòng phim, thư viện, sửa CTA, dựng lại logo…) cùng đi qua:
  bản MỚI        → vẫn đẩy kho (R2) để có link xem, ghi etp.cho_len 'cho', KHÔNG tạo creative · len.json: ok False, cho_anh True
  'cho'          → chờ tiếp, không đẩy lại
  'duyet'        → nhận ('dang_len', một máy một lần) + kiểu chữ anh chọn (cột kieu: kien mặc định / dol — chu-qc.py tạo đúng chữ đó) → đi tiếp bulk-jobs; xong → 'da_len' + creative_id + ket (dòng len.json)
  'da_len'       → trả lại đúng dòng len.json cũ (không tạo lần hai)
  'bo'           → anh bỏ
Anh xem + Duyệt / Bỏ ở etp2 › Camp › Chờ lên (repo etp2 › src/lib/actions/etp-cho-len.ts).
Dùng: python3 cho_len.py len      — chạy len-creative cho mọi bản đã duyệt mà chưa ai nhận (máy dòng phim gọi mỗi phút, dong_phim.cho_len_chay)
      python3 cho_len.py ds       — liệt kê hàng chờ
      python3 cho_len.py --tu-kiem
tra-repo-ok: mã dán keo nội bộ (bảng etp.cho_len, migration 0485)."""
import hashlib, json, os, subprocess, sys, time
D = os.path.dirname(os.path.abspath(__file__)); C = os.path.expanduser("~/.cache/ethopex")
sys.path.insert(0, D)
DAU = "⏸ CHỜ ANH DUYỆT"   # người gọi dò chuỗi này (dong_phim, thu-vien-len, anh-tinh) → đứng chờ, không coi là lỗi / không sinh lại
LY = "CHỜ ANH DUYỆT TRƯỚC KHI LÊN (etp2 › Camp › Chờ lên)"
KET_TREO = "2 hours"      # 'dang_len' quá ngần này (máy chết giữa lượt) → về 'duyet'
LOI_NGHI = "6 hours"      # lên lỗi → thử lại sau ngần này

def _sql(q):
    import soat_doan as SD
    return SD.sql(q)
def s(v): return "null" if v is None else "$S$" + str(v).replace("$S$", "") + "$S$"
def j(v): return "$J$" + json.dumps(v, ensure_ascii=False).replace("$J$", "") + "$J$::jsonb"

def khoa(x):
    if x.get("khoa_cho"): return x["khoa_cho"]
    if x.get("tv"): return f"tv{int(x['tv'])}"
    f = x["file"]
    if f.startswith("box3:") or not os.path.exists(f): return "p:" + f
    h = hashlib.md5()
    with open(f, "rb") as t:
        for b in iter(lambda: t.read(1 << 20), b""): h.update(b)
    return "m:" + h.hexdigest()

def _muc(x): return {k: v for k, v in x.items() if not k.startswith("_") and k not in ("ten_tep", "loi", "creative_id", "mau")}

def dong_cho(x, ma, ly=LY, cho=True):
    return {"camp_cu": x.get("camp"), "content_id": x.get("content_id"), "creative_id": None, "lang": x.get("lang"), "lo": x.get("lo", ma), "ten": x.get("ten"),
            "ok": False, "cho_anh": cho, "loi": ly, "mau": x.get("mau"), "tv": x.get("tv")}

def loc(lo, ma):
    """→ (lo_di: bản đi tiếp tới bulk-jobs, moi: bản mới cần đẩy kho rồi ghi 'cho', ra: dòng len.json của bản không đi tiếp)"""
    for x in lo: x["_khoa"] = khoa(x)
    ks = ",".join(s(x["_khoa"]) for x in lo)
    _sql(f"update etp.cho_len set trang_thai = 'duyet', cap_nhat = now(), loi = 'lượt lên trước bị cắt giữa chừng' where trang_thai = 'dang_len' and cap_nhat < now() - interval '{KET_TREO}' and khoa in ({ks})")
    r = {}
    for l in (_sql(f"select row_to_json(t) from (select c.id, c.khoa, c.trang_thai, c.creative_id, c.ket, c.video, c.loi, coalesce(p.kieu, c.kieu) kieu, p.chu phieu_chu, p.link phieu_link, c.cap_nhat < now() - interval '{LOI_NGHI}' cu from etp.cho_len c left join etp.phieu_len p on p.id = c.phieu_id where c.khoa in ({ks})) t") or "").splitlines():
        if l.strip(): v = json.loads(l); r[v["khoa"]] = v
    di, moi, ra = [], [], []
    for x in lo:
        v = r.get(x["_khoa"])
        if not v: moi.append(x); continue
        tt = v["trang_thai"]
        if tt == "da_len" and v.get("ket"): ra.append(v["ket"]); continue
        if tt == "bo": ra.append(dong_cho(x, ma, f"anh bỏ ở etp2 › Chờ lên (#{v['id']})", False)); continue
        if tt == "duyet" and (not v.get("loi") or v.get("cu")):
            n = _sql(f"update etp.cho_len set trang_thai = 'dang_len', cap_nhat = now() where id = {v['id']} and trang_thai = 'duyet' returning id")
            if n.strip():
                x["_cho_len"] = v["id"]
                x["kieu"] = v.get("kieu") or "kien"   # kiểu chữ anh chọn lúc duyệt (etp2 Chờ lên, mặc định Kiên) → chu-qc.py tạo đúng chữ đó
                if v.get("phieu_chu"): x["chu_phieu"], x["link_phieu"] = v["phieu_chu"], v.get("phieu_link")   # PHIẾU LÊN CAMP: đúng bộ chữ + link anh chọn lúc gửi phiếu
                if not x["file"].startswith("box3:") and not os.path.exists(x["file"]):   # tệp gốc đã dọn → kéo bản đã đẩy kho (đúng tệp anh xem)
                    os.makedirs(os.path.join(C, "cho-len"), exist_ok=True); f = os.path.join(C, "cho-len", f"cl{v['id']}.mp4")
                    subprocess.run(["curl", "-sSfL", "-o", f, v["video"]], check=True); x["file"] = f
                di.append(x); continue
        if tt == "duyet": ra.append(dong_cho(x, ma, f"anh đã duyệt (#{v['id']}) nhưng lên lỗi, thử lại sau {LOI_NGHI}: {v.get('loi')}", False)); continue
        ra.append(dong_cho(x, ma, f"{LY} #{v['id']}" + (" — đang lên" if tt == "dang_len" else "")))
    if ra: print(f"{DAU}: {sum(1 for o in ra if o.get('cho_anh'))} bản chờ anh duyệt ở etp2 › Camp › Chờ lên", flush=True)
    return di, moi, ra

# GẮN THẺ VÀO PHIẾU (0489): thẻ thứ i của phiếu nhận mức roas_ds[i]; phiếu đủ thẻ (= số mức) thì thẻ dư không gắn. Dùng ở ghi_cho (CC2) và dung-mau.py (AD).
SQL_GAN_PHIEU = ("update etp.cho_len c set phieu_id = p.id, phieu_roas = (coalesce(p.roas_ds, array[p.roas]))[1 + (select count(*) from etp.cho_len x where x.phieu_id = p.id and x.trang_thai <> 'bo')] "
                 "from etp.phieu_len p where p.id = {p} and {dk} and c.phieu_id is null "
                 "and (select count(*) from etp.cho_len x where x.phieu_id = p.id and x.trang_thai <> 'bo') < coalesce(array_length(p.roas_ds, 1), 1)")
PHIEU_DANG = {"canh cuoi logo": "CC2", "cảnh cuối logo": "CC2", "ảnh động": "AD", "anh dong": "AD",
              "cảnh cuối": "CC", "canh cuoi": "CC", "kể chuyện": "KT", "ke chuyen": "KT", "ảnh tĩnh": "AT", "anh tinh": "AT",
              "ảnh tĩnh tóm tắt": "ATT", "anh tinh tom tat": "ATT", "poster động": "PO", "poster dong": "PO",
              "câu thoại sốc": "CTS", "cau thoai soc": "CTS", "tập nguyên": "LT", "tap nguyen": "LT"}   # dạng ghi ở etp.cho_len → mã dạng của phiếu (etp.phieu_len.dang)

def ghi_cho(moi, anh, ma, dang):
    """bản mới đã đẩy kho → ghi 'cho' kèm link xem; trả dòng len.json"""
    ra, phieu = [], {}
    # PHIẾU LÊN CAMP (etp2, 0488): bản của phim có phiếu đang dựng cùng dạng (CC2 qua dòng phim; AD dung-mau.py tự gắn theo tuy_chon.phieu) → mang phieu_id,
    # anh duyệt ở Chờ lên là lên camp đúng phiếu. Tra một lần cho cả lô để mọi bản của lô cùng vào một phiếu.
    for cid, dg in {(int(x["content_id"]), x.get("dang") or dang) for x in moi}:
        dp = PHIEU_DANG.get(dg)
        if not dp: continue
        pid = (_sql(f"select id from etp.phieu_len where content_id = {cid} and dang = {s(dp)} and trang_thai = 'dung' and tao > now() - interval '2 days' order by tao desc limit 1") or "").strip()
        if pid.isdigit(): phieu[(cid, dg)] = int(pid)
    for x in moi:
        a = anh.get(x["ten_tep"][:-4]) or []
        if len(a) < 4 or not str(a[2]).startswith("http"): ra.append(dong_cho(x, ma, "đẩy kho không ra link xem — chưa vào hàng chờ duyệt", False)); continue
        id_ = _sql(f"""insert into etp.cho_len (khoa, content_id, lang, dang, ten, ma, mau, video, anh, giay, muc, ghi)
            values ({s(x['_khoa'])}, {int(x['content_id'])}, {s(x.get('lang'))}, {s(x.get('dang') or dang)}, {s(x.get('ten'))}, {s(ma)}, {s(x.get('mau'))},
                    {s(a[2])}, {s(a[3])}, {float(a[1] or 0)}, {j(_muc(x))}, {s(os.environ.get('ETP_GHI_DUYET') or x.get('goi_y') or x.get('ghi') or '')})
            on conflict (khoa) do update set cap_nhat = now() returning id""").strip()
        pid = phieu.get((int(x["content_id"]), x.get("dang") or dang))
        if pid and id_.isdigit(): _sql(SQL_GAN_PHIEU.format(p=pid, dk=f"c.id = {int(id_)}"))
        ra.append(dong_cho(x, ma, f"{LY} #{id_}"))
    for pid in set(phieu.values()):
        _sql(f"update etp.phieu_len set trang_thai = 'cho_duyet', cap_nhat = now() where id = {pid} and trang_thai = 'dung' and exists (select 1 from etp.cho_len where phieu_id = {pid})")
        # phiếu nhiều mức ROAS mà lô ra ít bản hơn số mức → kêu to trên phiếu (mức nào chưa có creative), không lặng lẽ lên thiếu camp
        thieu = (_sql(f"""select array_to_string(p.roas_ds[(select count(*) from etp.cho_len x where x.phieu_id = p.id and x.trang_thai <> 'bo') + 1 :], ', ') from etp.phieu_len p
                          where p.id = {pid} and array_length(p.roas_ds, 1) > (select count(*) from etp.cho_len x where x.phieu_id = p.id and x.trang_thai <> 'bo')""") or "").strip()
        if thieu: _sql(f"update etp.phieu_len set loi = {s('lô dựng ra ít bản hơn số mức ROAS — chưa có creative cho mức: ' + thieu)}, cap_nhat = now() where id = {pid}"); print(f"⚠ phiếu #{pid} thiếu creative cho mức ROAS {thieu}", file=sys.stderr)
    if ra: print(f"{DAU}: {len(ra)} bản mới vào hàng chờ — chưa gửi Ethopex", flush=True)
    sinh_kien({int(x["content_id"]) for x in moi})
    return ra

def sinh_kien(cids):
    """phim vừa vào hàng chờ mà chưa có chữ kiểu Kiên → máy sinh NGAY (anh 27/11/2026: "Mày phải sinh luôn text cho kiểu Kiên lúc review Ảnh") để thẻ duyệt
    hiện ảnh + chữ K cùng lúc. apps/etp/sinh-chu-kien.py tự bỏ qua phim đã có; ~2₫ / phim. Lỗi KHÔNG chặn hàng chờ — in to, thẻ etp2 có nút sinh lại."""
    if not cids: return
    tep = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "etp", "sinh-chu-kien.py")
    try:
        r = subprocess.run(["python3", tep, *map(str, sorted(cids))], capture_output=True, text=True, timeout=600)
        print(r.stdout.strip(), flush=True)
        if r.returncode: print(f"⚠️ {DAU}: SINH CHỮ KIÊN LỖI cho {sorted(cids)} — thẻ Chờ lên sẽ báo thiếu chữ K, bấm 'Sinh chữ Kiên' ở etp2\n{r.stderr.strip()[-400:]}", flush=True)
    except Exception as e: print(f"⚠️ {DAU}: SINH CHỮ KIÊN LỖI ({type(e).__name__}: {str(e)[:200]}) cho {sorted(cids)}", flush=True)

def xong(lo, out, ai_mac="len-creative"):
    """bản đã duyệt vừa lên: 'da_len' + ket · tạo được thì ghi luôn cham_duyet ok (anh đã duyệt trước khi lên, không bắt duyệt lần hai) · thư viện tv<id> gắn creative"""
    for x, o in zip(lo, out):
        if not x.get("_cho_len"): continue
        if o.get("ok") and o.get("creative_id"):
            cr = int(o["creative_id"])
            _sql(f"""update etp.cho_len set trang_thai = 'da_len', creative_id = {cr}, ket = {j(o)}, loi = null, cap_nhat = now() where id = {x['_cho_len']};
                insert into etp.cham_duyet (creative_id, ok, ai, ghi) select {cr}, true, coalesce(duyet_ai, 'anh'), 'duyệt trước khi lên (etp2 › Chờ lên #{x['_cho_len']})' from etp.cho_len where id = {x['_cho_len']}
                  on conflict (creative_id) do nothing;""" + (f" update etp.thu_vien set creative_id = {cr}, trang_thai = 'da_len', cap_nhat = now() where id = {int(x['tv'])} and creative_id is null;" if x.get("tv") else ""))
        else:
            _sql(f"update etp.cho_len set trang_thai = 'duyet', loi = {s(str(o.get('loi') or 'không tạo được creative')[:400])}, cap_nhat = now() where id = {x['_cho_len']}")

def nha(lo, ly):
    """lượt đổ giữa chừng sau khi đã nhận → trả về 'duyet' để lượt sau lên lại"""
    for x in lo:
        if x.get("_cho_len"):
            try: _sql(f"update etp.cho_len set trang_thai = 'duyet', loi = {s(str(ly)[:400])}, cap_nhat = now() where id = {x['_cho_len']} and trang_thai = 'dang_len'")
            except Exception: pass

def chay_len():
    """bản đã duyệt chưa ai nhận (người gọi gốc là lệnh một lần: sửa CTA, dựng lại logo…) → chạy len-creative theo từng dạng"""
    ds = [json.loads(l) for l in (_sql(f"""select row_to_json(t) from (select id, khoa, dang, muc from etp.cho_len where trang_thai = 'duyet'
            and not (coalesce(muc, '{{}}'::jsonb) ? 'cr_cu')   -- creative CŨ (phiếu CU): len-phieu.py tạo bản cùng video, không tải lại
            and (loi is null or cap_nhat < now() - interval '{LOI_NGHI}') order by duyet_luc nulls last, id limit 20) t""") or "").splitlines() if l.strip()]
    nhom = {}
    for v in ds: nhom.setdefault(v["dang"] or "canh cuoi", []).append({**v["muc"], "khoa_cho": v["khoa"]})
    for gi, (dang, lo) in enumerate(nhom.items()):
        ma = "cl" + time.strftime("%d%m%H%M%S") + f"p{os.getpid() % 1000}" + (f"-{gi}" if gi else "")
        os.makedirs(os.path.join(C, "cho-len"), exist_ok=True); lf = os.path.join(C, "cho-len", f"lo-{ma}.json"); json.dump(lo, open(lf, "w"), ensure_ascii=False)
        print(f"lên {len(lo)} bản đã duyệt ({dang}) · lô {ma}", flush=True)
        subprocess.run(["python3", os.path.join(D, "len-creative.py"), lf, ma, dang, "--da-soat"], env={**os.environ, "ETP_KHONG_CAT": "1"})
        lj = os.path.join(C, "ra", ma, "len.json")
        for o in (json.load(open(lj)) if os.path.exists(lj) else []): print(("✓" if o.get("ok") else "✗"), o.get("creative_id"), o.get("ten"), o.get("loi") or "", flush=True)
    if not ds: print("không có bản đã duyệt nào chờ lên")

def tu_kiem():
    a = {"file": "/khong-co", "tv": 12}; assert khoa(a) == "tv12"
    assert khoa({"file": "box3:/x/y.mp4"}) == "p:box3:/x/y.mp4" and khoa({"file": "/x", "khoa_cho": "m:ab"}) == "m:ab"
    d = dong_cho({"content_id": 1, "lang": "en", "ten": "t", "lo": "l"}, "ma"); assert d["ok"] is False and d["cho_anh"] and LY in d["loi"]
    m = _muc({"file": "f", "ten_tep": "x", "_khoa": "k", "loi": "e", "tv": 3}); assert m == {"file": "f", "tv": 3}
    cq = open(os.path.join(D, "chu-qc.py")).read(); assert 'x.get("kieu")' in cq and "def chu_theo_kieu" in cq, "chu-qc.py phải tạo chữ theo kiểu anh chọn ở Chờ lên"
    src = open(os.path.join(D, "len-creative.py")).read()
    for k in ("CL.loc(", "CL.ghi_cho(", "CL.xong("): assert k in src, f"len-creative.py thiếu {k} — cổng chờ anh duyệt bị gỡ"
    assert src.index("CL.loc(") < src.index("bulk-jobs\",json"), "cổng chờ duyệt phải đứng trước bulk-jobs"
    assert "? 'cr_cu'" in open(os.path.abspath(__file__)).read().split("def chay_len")[1].split("def tu_kiem")[0], "chay_len phải bỏ thẻ creative cũ (len-phieu.py lo)"
    print("cho_len tự kiểm: đạt")

if __name__ == "__main__":
    a = sys.argv[1:]
    if a[:1] == ["--tu-kiem"]: tu_kiem()
    elif a[:1] == ["len"]: chay_len()
    elif a[:1] == ["ds"]: print(_sql("select id || ' · ' || trang_thai || ' · ' || coalesce(dang, '') || ' · ' || content_id || ' ' || coalesce(ten, '') || ' · ' || coalesce(video, '') from etp.cho_len order by id desc limit 40"))
    else: sys.exit(__doc__)
