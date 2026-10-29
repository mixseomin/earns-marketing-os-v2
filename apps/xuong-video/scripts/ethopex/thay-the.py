#!/usr/bin/env python3
"""CAMP THAY THẾ (anh 29/10/2026): "Các phim chỉ còn 1 camp duy nhất và có xu hướng bị đóng lại thì phải ưu tiên lên camp mới thay thế luôn"
+ "nếu camp trước bị âm vì lý do gì đó thì camp mới phải rút kinh nghiệm".

Mỗi nhịp ethopex (cty worker, SAU khi luat-ethopex.py --json đã ghi etp.xet_luat):
  1. Phim chỉ còn MỘT camp đang chạy (không tính ★ ROAS là camp duy nhất) mà camp đó nằm trong danh sách tắt hoặc gần chạm luật tắt
     (L3 / L4 / T2 / OFF / D24: đạt hoặc thiếu đúng một điều kiện) → mở một dòng etp.thay_the (mỗi phim một dòng mở).
  2. CHẨN ĐOÁN camp cũ (bai_hoc): ROI = (thu / lượt hiện) ÷ (chi / lượt hiện) → so với camp lãi 14 ngày qua:
       chi / lượt hiện cao  → 'hook': QC đắt, cảnh mở / ảnh bìa không hút → creative mới KHÁC DẠNG, đoạn xa đoạn cũ;
       thu / lượt hiện thấp → 'giu' : người xem vào nhưng không ở lại → creative mới là đoạn SÂU HƠN (gần cao trào / cuối tập);
       cùng sổ bài học (bai-hoc.py) + creative đã lỗ ở phim này thì không dùng lại.
  3. LÊN THEO BỘ (anh 29/10/2026 "các định dạng kiểu CC, CT,... đều $0 thì sao ko lên theo bộ đi"): mỗi DẠNG creative (CC · CT · KT · PD · LM · TN)
     một camp $1 — creative khác cùng phim, chọn theo hướng rút kinh nghiệm (CTA đạt, chưa bị Meta từ chối, chưa có camp chạy, không trùng ≥ 50%
     đoạn cũ / đoạn đã lỗ) → chấm sạch thì lên trên khuôn camp cũ (nhan-ban.py --creative, cùng bộ); chưa chấm → xếp chấm, nhịp sau thử lại;
     phim chưa có CC sạch → xếp hàng cắt góc mới (ethopex_can_goc_moi, cờ thay — sua-cta.py iMac cắt cảnh cuối, nhịp sau máy này lên).
  4. Camp thay đã chạy (có chi) → dòng 'chay' (trang etp thôi vẽ dòng mờ).
Chạy (box3, đã nạp .env.production):  python3 thay-the.py [--that] [--toi-da 15]     (không --that = chạy khô, chỉ in sẽ làm gì; --toi-da = trần camp mới mỗi lượt)"""
import datetime as dt, importlib.util, json, os, subprocess, sys

D = os.path.dirname(os.path.abspath(__file__))
q = lambda s: subprocess.run(["psql", os.environ["DATABASE_URL"], "-tAc", s], capture_output=True, text=True).stdout.strip()
def qj(s): return json.loads(q(f"select coalesce(json_agg(t), '[]') from ({s}) t") or "[]")
THAT = "--that" in sys.argv
# mỗi camp mới chờ Ethopex đồng bộ ~1 phút → trần mỗi nhịp để nhịp ethopex (32 phút) không bị giữ; phim còn thiếu lên ở nhịp sau
TOI_DA = int(next((sys.argv[i + 1] for i, x in enumerate(sys.argv[:-1]) if x == "--toi-da"), 15)); DA_LEN = [0]
TAT_MA = ("l3", "l4", "t2", "off", "d24")   # luật tắt hẳn camp (cùng mã etp.xet_luat)
HOOK_GAP, GIU_GAP = 1.25, 0.8               # chi/lượt hiện ≥ 1.25× camp lãi → hook yếu · thu/lượt hiện ≤ 0.8× → không giữ chân
vn = lambda: (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=7)).strftime("%H:%M %d/%m/%Y")
s_ = lambda t: str(t or "").replace("'", "''")

def _nap(ten, tep):
    s = importlib.util.spec_from_file_location(ten, os.path.join(D, tep)); m = importlib.util.module_from_spec(s); s.loader.exec_module(m); return m

SAP = set()
def can_thay():
    """phim chỉ còn 1 camp chạy + camp đó sắp tắt → [{content_id, camp_id, ly}]"""
    ds = qj("""select c.content_id, c.camp_id from etp.camp c where c.trang_thai = 'ACTIVE' and coalesce(c.content_id, 0) > 0 and c.ten not like '★%'
               and c.content_id in (select content_id from etp.camp where trang_thai = 'ACTIVE' group by 1 having count(*) = 1)""")
    xet = {int(r["camp_id"]): r["xet"] for r in qj(f"select camp_id, xet from etp.xet_luat where camp_id in ({','.join(str(int(x['camp_id'])) for x in ds) or 0})")}
    ra = []
    for x in ds:
        dinh = [e for e in xet.get(int(x["camp_id"]), []) if e.get("ma") in TAT_MA and (e.get("vao") or e.get("ket") in ("dat", "gan"))]
        if dinh: ra.append({**x, "ly": " · ".join(f"{e['ten'].split(' · ')[0]} {'sắp tắt' if e.get('vao') or e.get('ket') == 'dat' else 'gần chạm'}" for e in dinh)})
    return ra

def chan_doan(camp, content):
    """vì sao camp cũ lỗ → {ly_do, huong, so}"""
    a = (qj(f"""select coalesce(sum(n.chi), 0) chi, coalesce(sum(n.thu), 0) thu, coalesce((select sum(hien) from etp.so_pheu p where p.camp_id = {int(camp)}), 0) hien
                from etp.so_ngay n where n.camp_id = {int(camp)}""") or [{}])[0]
    ref = (qj("""with s as (select camp_id, sum(chi) chi, sum(thu) thu from etp.so_ngay where ngay >= current_date - 14 group by 1 having sum(chi) >= 5 and sum(thu) > sum(chi)),
                 h as (select camp_id, sum(hien) hien from etp.so_pheu where ngay >= current_date - 14 group by 1)
                 select sum(s.chi) chi, sum(s.thu) thu, sum(h.hien) hien from s join h using (camp_id) where h.hien > 0""") or [{}])[0]
    chi, thu, hien = float(a.get("chi") or 0), float(a.get("thu") or 0), float(a.get("hien") or 0)
    so = {"chi": round(chi, 2), "thu": round(thu, 2), "roi": round((thu - chi) / chi * 100) if chi else None, "hien": int(hien)}
    try:
        bh = [b for b in json.loads(q("select gia_tri::text from xv_khoa_ngoai where ten='ethopex_bai_hoc'") or "[]") if int(b.get("content_id") or 0) == int(content)]
    except Exception: bh = []
    so_bh = sorted({n for b in bh for n in b.get("nguyen_nhan") or []})[:4]
    if hien <= 0 or not ref.get("hien"):
        return {"ly_do": "chưa đủ số phễu để tách lý do — đổi sang đoạn khác hẳn đoạn cũ", "huong": "khac", "so": so, "bai_hoc_phim": so_bh}
    cph, tph = chi / hien, thu / hien
    rc, rt = cph / (float(ref["chi"]) / float(ref["hien"])), tph / (float(ref["thu"]) / float(ref["hien"]))
    so.update(chi_1000_hien=round(cph * 1000, 2), thu_1000_hien=round(tph * 1000, 2), gap_chi=round(rc, 2), gap_thu=round(rt, 2))
    if rc >= HOOK_GAP and rc >= 1 / max(rt, 1e-9):
        return {"ly_do": f"QC đắt: ${cph * 1000:.2f} / 1.000 lượt hiện, gấp {rc:.1f}× camp lãi — cảnh mở / ảnh bìa không hút", "huong": "hook", "so": so, "bai_hoc_phim": so_bh}
    if rt <= GIU_GAP:
        return {"ly_do": f"thu ${tph * 1000:.2f} / 1.000 lượt hiện, chỉ {rt:.0%} camp lãi — người xem vào nhưng không ở lại", "huong": "giu", "so": so, "bai_hoc_phim": so_bh}
    return {"ly_do": f"chi / lượt hiện ({rc:.1f}×) và thu / lượt hiện ({rt:.0%}) đều sát camp lãi — lỗ do dao động, đổi đoạn khác", "huong": "khac", "so": so, "bai_hoc_phim": so_bh}

def ung_vien(content, cr_cu, huong):
    """creative khác cùng phim, xếp theo hướng rút kinh nghiệm; bỏ creative đang có camp chạy / đã lỗ / trùng ≥ 50% đoạn cũ"""
    cu = (qj(f"select dang, tu, den from etp.creative where creative_id = {int(cr_cu or 0)}") or [{}])[0]
    ds = qj(f"""select r.creative_id, r.dang, r.tu, r.den, r.lo from etp.creative r where r.content_id = {int(content)} and r.creative_id <> {int(cr_cu or 0)}
                and r.cta_dat is true and r.tu_choi is null
                and not exists (select 1 from etp.camp c where c.creative_id = r.creative_id and c.trang_thai = 'ACTIVE')
                and not exists (select 1 from etp.camp c join etp.so_ngay n using (camp_id) where c.creative_id = r.creative_id
                                group by c.camp_id having sum(n.chi) >= 2 and sum(n.thu) < 0.8 * sum(n.chi))""")
    def trung(x):
        if None in (x.get("tu"), x.get("den"), cu.get("tu"), cu.get("den")): return False
        t, d, t0, d0 = float(x["tu"]), float(x["den"]), float(cu["tu"]), float(cu["den"])
        return max(0, min(d, d0) - max(t, t0)) >= 0.5 * min(d - t, d0 - t0)
    ds = [x for x in ds if not trung(x)]
    tu0 = float(cu.get("tu") or 0)
    if huong == "hook": ds.sort(key=lambda x: (x.get("dang") != cu.get("dang"), abs(float(x.get("tu") or 0) - tu0)), reverse=True)
    elif huong == "giu": ds.sort(key=lambda x: (float(x.get("tu") or 0) > tu0, float(x.get("tu") or 0)), reverse=True)
    else: ds.sort(key=lambda x: int(x["creative_id"]), reverse=True)
    return ds

def bo_hang_cat(content):
    """dòng thay bị huỷ → gỡ luôn khỏi hàng cắt góc mới nếu do máy thay xếp (cờ thay) — iMac khỏi cắt góc cho phim không còn cần"""
    if THAT: q(f"update xv_khoa_ngoai set gia_tri = gia_tri - '{int(content)}' where ten='ethopex_can_goc_moi' and (gia_tri->'{int(content)}'->>'thay')::boolean is true")

def ghi(id_, **k):
    sets = ", ".join(f"{c} = " + ("null" if v is None else f"'{s_(json.dumps(v, ensure_ascii=False))}'::jsonb" if c in ("bai_hoc", "bo_camp") else str(int(v)) if c in ("creative_id", "camp_moi") else f"'{s_(v)}'") for c, v in k.items())
    if THAT: q(f"update etp.thay_the set {sets}, cap_nhat = now() where id = {int(id_)}")

def xep_cat(camp, content, ten, huong):
    v = json.dumps({"goc": int(camp), "ten": ten, "luc": vn(), "thay": True, "huong": huong}, ensure_ascii=False).replace("'", "''")
    if THAT:
        q("insert into xv_khoa_ngoai (ten, gia_tri) values ('ethopex_can_goc_moi', '{}'::jsonb) on conflict (ten) do nothing")
        q(f"update xv_khoa_ngoai set gia_tri = gia_tri || jsonb_build_object('{int(content)}', '{v}'::jsonb) where ten='ethopex_can_goc_moi' and not gia_tri ? '{int(content)}'")

def ten_camp(x, content, camp_cu):
    import unicodedata
    a = lambda t: unicodedata.normalize("NFKD", t or "").encode("ascii", "ignore").decode().replace("'", "").replace('"', "").strip()
    p = (qj(f"select ten, locale from etp.phim where content_id = {int(content)}") or [{}])[0]
    lang = (p.get("locale") or "en")[:2].upper()
    return f"{x.get('lo') or 'thay'} {a(p.get('ten')) or 'phim ' + str(content)} {lang} - {a(x.get('dang')).lower()} {round(float(x.get('tu') or 0))}-{round(float(x.get('den') or 0))}s (thay {camp_cu})"

def lam(r, NB):
    """một dòng thay → lên mỗi dạng còn thiếu một camp (theo bộ); trả câu báo"""
    content, cu = int(r["content_id"]), int(r["camp_cu"])
    bh = r.get("bai_hoc") or {}
    if not bh.get("huong"): bh = chan_doan(cu, content); ghi(r["id"], bai_hoc=bh)
    bo = list(r.get("bo_camp") or []); co_dang = {b["dang"] for b in bo}
    c0 = (qj(f"select creative_id, bo, ten from etp.camp where camp_id = {cu}") or [{}])[0]
    ds = [x for x in ung_vien(content, c0.get("creative_id"), bh["huong"]) if (x.get("dang") or "?") not in co_dang]
    nhom = {}
    for x in ds: nhom.setdefault(x.get("dang") or "?", []).append(x)   # giữ thứ tự xếp theo hướng trong từng dạng
    len_, cho, bao = [], [], []
    for dang, xs in nhom.items():
        for x in xs:
            if DA_LEN[0] >= TOI_DA: break
            cr = int(x["creative_id"])
            ly = NB.cham_sach(cr) if THAT else None   # chưa chấm → cham_sach tự xếp hàng chấm
            if ly: cho.append((dang, cr, ly)); continue
            ten = ten_camp(x, content, cu)
            if not THAT: len_.append({"dang": dang, "creative": cr, "camp": None}); bao.append(f"{dang} #{cr} {round(float(x.get('tu') or 0))}–{round(float(x.get('den') or 0))}s"); break
            p = subprocess.run(["python3", os.path.join(D, "nhan-ban.py"), str(cu), "--bo", str(c0.get("bo") or "2"), "--creative", str(cr), "--content", str(content), "--ten", ten,
                                "--that", "--lich", "today", "--luat", f"camp thay thế ({dang}) · phim chỉ còn #{cu} sắp tắt · {bh['ly_do']}"[:400],
                                "--ai", "máy thay camp (anh chat 29/10/2026: phim còn 1 camp sắp đóng thì lên camp mới thay luôn, rút kinh nghiệm, lên theo bộ định dạng)"],
                               capture_output=True, text=True, timeout=600)
            try: kq = json.loads((p.stdout.strip().splitlines() or ["{}"])[-1])
            except Exception: kq = {"ok": False, "loi": (p.stderr or p.stdout).strip()[-200:]}
            if kq.get("ok"):
                DA_LEN[0] += 1; len_.append({"dang": dang, "creative": cr, "camp": int(kq["moi"])}); bao.append(f"{dang} #{kq['moi']} (creative #{cr})"); break
            cho.append((dang, cr, kq.get("loi") or "nhan-ban không lên"))
    bo += len_
    can_cat = not any((b["dang"] == "cảnh cuối") for b in bo) and "cảnh cuối" not in nhom
    if can_cat and r["buoc"] != "cat_goc" and not any(int(b.get("camp") or 0) for b in bo):
        xep_cat(cu, content, c0.get("ten") or "", bh["huong"])
    buoc = "len_lich" if any(b.get("camp") for b in bo) else ("cho_cham" if cho else "cat_goc" if can_cat else r["buoc"])
    dau = next((b for b in bo if b.get("camp")), None)
    ghi(r["id"], buoc=buoc, bo_camp=bo, creative_id=(dau or {}).get("creative") or (cho[0][1] if cho else None), camp_moi=(dau or {}).get("camp"),
        ghi=("; ".join(f"{d} #{c}: {str(l)[:80]}" for d, c, l in cho[:4]) or ("chờ cắt góc mới (iMac)" if can_cat else ""))[:300])
    tom = (("lên " + ", ".join(bao)) if bao else "chưa lên dạng nào") + (f" · chờ {len(cho)} creative (chấm / chặn)" if cho else "") + (" · xếp cắt góc mới (CC)" if can_cat else "")
    return f"phim {content} (thay #{cu}): {tom} · {bh['ly_do']}"

def main():
    NB = _nap("nb", "nhan-ban.py")
    bao, moi = [], 0
    global SAP; CAN = can_thay(); SAP = {int(x["camp_id"]) for x in CAN}
    # 4. camp thay đã chạy → xong; phim đã có camp khác chạy (ngoài camp cũ) → huỷ
    for r in qj("select id, content_id, camp_cu, buoc, camp_moi, ghi from etp.thay_the where buoc not in ('chay', 'huy')"):
        # xong khi camp thay đầu tiên đã có chi VÀ không còn dạng nào đang chờ chấm (ghi rỗng) — còn chờ thì nhịp sau vẫn thử lên nốt dạng đó
        if r.get("camp_moi") and not (r.get("ghi") or "").strip() and q(f"select 1 from etp.camp c join etp.so_ngay n using (camp_id) where c.camp_id = {int(r['camp_moi'])} and n.chi > 0 limit 1"):
            ghi(r["id"], buoc="chay"); continue
        if r["buoc"] != "len_lich" and q(f"select count(*) from etp.camp where trang_thai = 'ACTIVE' and content_id = {int(r['content_id'])} and camp_id <> {int(r['camp_cu'])}") not in ("", "0"):
            ghi(r["id"], buoc="huy", ghi="phim đã có camp khác đang chạy"); bo_hang_cat(r["content_id"]); continue
        # camp cũ vẫn chạy mà không còn sắp tắt (luật hết 'gần' — vd sửa 29/10/2026: camp lãi bị xếp "L4 gần chạm") và chưa lên camp thay nào → huỷ
        if r["buoc"] != "len_lich" and int(r["camp_cu"]) not in SAP and q(f"select 1 from etp.camp where camp_id = {int(r['camp_cu'])} and trang_thai = 'ACTIVE'"):
            ghi(r["id"], buoc="huy", ghi="camp cũ không còn sắp tắt"); bo_hang_cat(r["content_id"])
    # 1. phim mới cần thay
    for x in CAN:
        if q(f"select 1 from etp.thay_the where content_id = {int(x['content_id'])} and buoc not in ('chay', 'huy')"): continue
        moi += 1
        if THAT: q(f"insert into etp.thay_the (content_id, camp_cu, ghi) values ({int(x['content_id'])}, {int(x['camp_id'])}, '{s_(x['ly'])}') on conflict do nothing")
        else: bao.append(f"[khô] mở dòng thay phim {x['content_id']} (#{x['camp_id']}: {x['ly']})")
    # 2–3. mọi dòng chưa xong: còn dạng chưa lên (theo bộ) / chờ chấm / chờ cắt
    ds = qj("select id, content_id, camp_cu, buoc, bai_hoc, bo_camp from etp.thay_the where buoc in ('chuan_bi', 'cat_goc', 'cho_cham', 'len_lich') order by id")
    if not THAT: ds += [{"id": 0, "content_id": x["content_id"], "camp_cu": x["camp_id"], "buoc": "chuan_bi", "bai_hoc": {}, "bo_camp": []} for x in CAN
                        if not any(int(d["content_id"]) == int(x["content_id"]) for d in ds)]
    for r in ds:
        try: bao.append(lam(r, NB))
        except Exception as e: bao.append(f"phim {r['content_id']}: lỗi {str(e)[:120]}")
    print("\n".join(bao), file=sys.stderr)
    print(json.dumps({"moi": moi, "bao": bao}, ensure_ascii=False))

if __name__ == "__main__":
    main()
