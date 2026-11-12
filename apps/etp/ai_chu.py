#!/usr/bin/env python3
"""MỘT ĐƯỜNG GỌI AI CHỮ / NHÌN ẢNH cho mọi việc Ethopex (anh 11/11/2026: "mới có thêm nguồn API AI từ donk. Hãy tích hợp nó vào đầu chuỗi của mọi thao tác liên quan").
Trước đây 6 tệp mỗi tệp chép tay một vòng ckey riêng → thêm cổng phải sửa 6 chỗ. Giờ mọi chỗ gọi `goi()`; chuỗi cổng nằm ở đây:

  1. donk  (api.shopdonk.com, khuôn Anthropic Messages — gói Claude trả trước, vault #693; khoá DONK_KEY trong /root/.secrets/spy.env hoặc env DONK_KEY / DONK_API_KEY)
           ảnh gửi base64 (đo 11/11/2026: ảnh dạng link → 502, base64 → đọc đúng); tool_use cho kết quả có khuôn
  2. ckey  (api.xah.io, khuôn OpenAI — tuyến sống /var/lib/spy/ckey-tuyen.json do spy đo 6 giờ / lần), 3 tuyến đầu

Người gọi đưa nội dung theo khuôn OpenAI như cũ (chuỗi, hoặc danh sách phần {"type": "text"} / {"type": "image_url"}), kèm cong_cu=(tên, schema JSON)
khi cần kết quả có khuôn. `kiem(ket)` trả chuỗi lỗi → thử cổng sau (vd nhóm lạ, câu trả lời lạ). Trả (ket, vnd, mo_hinh, loi):
ket = dict (có cong_cu) / str (không) / None khi mọi cổng hỏng; vnd = tiền ước cộng dồn mọi lượt thử; mo_hinh = 'donk:<model>' hoặc '<tuyến ckey>'.

  python3 apps/etp/ai_chu.py --thu      gọi thử một câu qua từng cổng (vài ₫), in cổng nào sống"""
import base64, json, os, subprocess, sys, urllib.error, urllib.request

# donk: tên model của shop + giá niêm yết ₫ / 1 triệu token (cùng bảng DONK_DONG ở apps/xuong-video/src/lib/xuong-video/claude.ts — số ƯỚC, để đo gói)
DONK_URL = "https://api.shopdonk.com/v1/messages"
DONK = {"haiku": [("claude-haiku-4-5", 105)], "sonnet": [("claude-sonnet-5", 235), ("claude-haiku-4-5", 105)]}
CKEY_URL = "https://api.xah.io/v1/chat/completions"
UA = {"user-agent": "mos2-etp"}

def _env_spy(ten):
    v = os.environ.get(ten)
    if v: return v
    try: return subprocess.run(["bash", "-c", f". /root/.secrets/spy.env 2>/dev/null; echo \"${ten}\""], capture_output=True, text=True, timeout=10).stdout.strip()
    except Exception: return ""
def khoa_donk_ds():
    """DONK GỐI ĐẦU (anh 12/11/2026): khoá cách bằng dấu phẩy, gói cũ TRƯỚC — khoá trước hết gói / lỗi thì lượt đi tiếp khoá sau. AI_BO_DONK=1: bỏ donk."""
    if os.environ.get("AI_BO_DONK"): return []
    return [k.strip() for k in (os.environ.get("DONK_API_KEY") or _env_spy("DONK_KEY")).split(",") if k.strip()]
def khoa_donk(): return (khoa_donk_ds() or [""])[0]
def khoa_ckey(): return _env_spy("CKEY_KEY")
def tuyen_ckey(uu="haiku"):
    try: j = json.load(open("/var/lib/spy/ckey-tuyen.json"))["dong"]
    except Exception: return ["nghiaphan0633/claude-haiku-5.5"]
    thu = ("sonnet", "haiku") if uu == "sonnet" else ("haiku", "sonnet")
    return [m.replace("ckey:", "") for k in thu for m in (j.get(k) or [])]

# ---------- đổi khuôn OpenAI → Anthropic (donk) ----------
_ANH = {}
def _anh_b64(u):
    """link / data URI → (media_type, base64); tải một lần mỗi tiến trình"""
    if u in _ANH: return _ANH[u]
    if u.startswith("data:"):
        dau, du = u.split(",", 1); mt = dau[5:].split(";")[0] or "image/jpeg"; r = (mt, du)
    else:
        b = urllib.request.urlopen(urllib.request.Request(u, headers={"user-agent": "Mozilla/5.0"}), timeout=30).read()
        mt = "image/png" if b[:4] == b"\x89PNG" else "image/webp" if b[8:12] == b"WEBP" else "image/gif" if b[:3] == b"GIF" else "image/jpeg"
        r = (mt, base64.b64encode(b).decode())
    _ANH[u] = r; return r
def _sang_anthropic(noi):
    if isinstance(noi, str): return noi
    ra = []
    for p in noi:
        if p.get("type") == "text": ra.append({"type": "text", "text": p["text"]})
        elif p.get("type") == "image_url":
            mt, du = _anh_b64(p["image_url"]["url"]); ra.append({"type": "image", "source": {"type": "base64", "media_type": mt, "data": du}})
    return ra

def _post(url, body, h, timeout):
    try: return json.load(urllib.request.urlopen(urllib.request.Request(url, data=json.dumps(body).encode(), headers={**UA, "content-type": "application/json", **h}), timeout=timeout))
    except urllib.error.HTTPError as e: raise RuntimeError(f"HTTP {e.code}: {e.read()[:200].decode('utf-8', 'replace')}")

def goi(noi, *, max_tokens=400, cong_cu=None, uu="haiku", kiem=None, timeout=180, so_ckey=3, cong=("donk", "ckey")):
    """cong: cổng được đi, theo thứ tự cố định donk → ckey (vd ("donk",) khi người gọi tự lo ckey)"""
    vnd, loi = 0.0, []
    # 1. donk
    for kd in (khoa_donk_ds() if "donk" in cong else []):
        for model, gia in DONK.get(uu, DONK["haiku"]):
            try:
                body = {"model": model, "max_tokens": max_tokens, "messages": [{"role": "user", "content": _sang_anthropic(noi)}]}
                if cong_cu: body |= {"tools": [{"name": cong_cu[0], "input_schema": cong_cu[1]}], "tool_choice": {"type": "tool", "name": cong_cu[0]}}
                r = _post(DONK_URL, body, {"x-api-key": kd, "anthropic-version": "2023-06-01"}, timeout)
                # donk báo input_tokens của chữ = 1 (đo 11/11/2026, studio cũng gặp) → token vào lấy số lớn hơn giữa cổng báo và ước (3 ký tự / token, ~1.000 / ảnh)
                u = r.get("usage") or {}; uoc = sum(len(p.get("text", "")) // 3 + (1000 if p.get("type") == "image_url" else 0) for p in ([{"text": noi}] if isinstance(noi, str) else noi))
                vnd += (max(int(u.get("input_tokens") or 0), uoc) + int(u.get("output_tokens") or 0)) * gia / 1e6
                if cong_cu: ket = next((b["input"] for b in r.get("content") or [] if b.get("type") == "tool_use"), None)
                else: ket = "".join(b.get("text", "") for b in r.get("content") or [] if b.get("type") == "text").strip() or None
                if ket is None: loi.append(f"donk:{model}: trả rỗng"); continue
                k = kiem(ket) if kiem else None
                if k: loi.append(f"donk:{model}: {k}"); continue
                return ket, vnd, f"donk:{model}", None
            except Exception as e: loi.append(f"donk:{model}: {str(e)[:150]}")
    # 2. ckey
    kc = khoa_ckey() if "ckey" in cong else ""
    for model in (tuyen_ckey(uu)[:so_ckey] if kc else []):
        try:
            body = {"model": model, "max_tokens": max_tokens, "messages": [{"role": "user", "content": noi}]}
            if cong_cu: body |= {"tools": [{"type": "function", "function": {"name": cong_cu[0], "parameters": cong_cu[1]}}], "tool_choice": {"type": "function", "function": {"name": cong_cu[0]}}}
            r = _post(CKEY_URL, body, {"Authorization": f"Bearer {kc}"}, timeout)
            vnd += float(((r.get("usage") or {}).get("x_ckey") or {}).get("cost") or 0)
            m = r["choices"][0]["message"]
            ket = json.loads(m["tool_calls"][0]["function"]["arguments"]) if cong_cu else ((m.get("content") or "").strip() or None)
            if ket is None: loi.append(f"{model}: trả rỗng"); continue
            k = kiem(ket) if kiem else None
            if k: loi.append(f"{model}: {k}"); continue
            return ket, vnd, model, None
        except Exception as e: loi.append(f"{model}: {str(e)[:150]}")
    return None, vnd, None, " · ".join(loi) or "không có cổng AI nào (thiếu khoá donk và ckey)"

# CLI cho tệp không phải Python (viet-ke-chuyen.mts): stdin JSON {noi, max_tokens, cong_cu: [tên, schema], uu, cong} → stdout JSON {ket, vnd, mo_hinh, loi}
if __name__ == "__main__" and "--json" in sys.argv:
    a = json.load(sys.stdin)
    ket, vnd, mo, loi = goi(a["noi"], max_tokens=int(a.get("max_tokens") or 400), cong_cu=tuple(a["cong_cu"]) if a.get("cong_cu") else None, uu=a.get("uu") or "haiku",
                            cong=tuple(a.get("cong") or ("donk", "ckey")), timeout=int(a.get("timeout") or 300))
    print(json.dumps({"ket": ket, "vnd": vnd, "mo_hinh": mo, "loi": loi}, ensure_ascii=False))

if __name__ == "__main__" and "--thu" in sys.argv:
    for uu in ("haiku", "sonnet"):
        print(uu, goi("Trả lời đúng một từ: thủ đô của Pháp?", max_tokens=20, uu=uu))
    print("khuôn", goi("Ghi số 7", max_tokens=60, cong_cu=("ghi", {"type": "object", "required": ["so"], "properties": {"so": {"type": "integer"}}})))
