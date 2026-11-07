#!/usr/bin/env python3
"""CHỮ QC CHO KIỂU CREATIVE TĨNH MỚI (anh 08/11/2026: "xem còn kiểu nào hay và ấn tượng giống ảnh tĩnh"): chạy trên box3 (khoá ckey), mô hình rẻ nhất tuyến.
stdin: {"ten": tên phim, "lang": "en"|"es", "mo_ta": mô tả trang phim, "thoai": [câu phụ đề đọc từ tập miễn phí]}
stdout: {"tom_tat": [3 bản] chữ QC tóm tắt 3–4 câu có mốc xoay chuyển (kiểu Dramawave chạy 46 ngày), "cau_soc": [≤ 3] câu thoại nguyên văn gắt nhất,
         "ly_do": …, "vnd": chi phí}. Câu sốc phải lấy nguyên văn trong "thoai" — máy kiểm, không có thì trả rỗng."""
import json, os, sys, urllib.request
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "etp"))
import nhom_goc as NG

LUAT = """You write Facebook ad copy for the short drama "{t}" (language: {lang}).
Story description: {mo_ta}
Subtitle lines seen in the first free episodes (verbatim, may contain OCR noise):
{thoai}
1. tom_tat: THREE different primary texts, each 3–4 short sentences in {lang}, telling the setup from a different angle and ending on an unresolved twist
   (e.g. "Seven years later…", "He had no idea she was…") so the reader must watch to know what happens. No hashtags, no emojis, no sexual content, no violence words like kill/rape/blood.
2. cau_soc: THREE different lines copied EXACTLY from the subtitle lines above (verbatim, fix only OCR typos) — the most shocking / humiliating / dramatic lines that make a
   viewer stop scrolling. Prefer insults, betrayals, hidden-identity reveals. Must be safe for Facebook ads (no sexual words, no slurs)."""

def viet(j):
    _, khoa = NG._spy(); chi, loi = 0.0, ""
    for model in NG._tuyen()[:3]:
        try:
            body = {"model": model, "max_tokens": 1400, "messages": [{"role": "user", "content": LUAT.format(t=j["ten"], lang=j.get("lang", "en"), mo_ta=j.get("mo_ta") or "(none)",
                    thoai="\n".join(f"- {x}" for x in (j.get("thoai") or [])[:150]))}],
                    "tools": [{"type": "function", "function": {"name": "ghi", "parameters": {"type": "object", "required": ["tom_tat", "cau_soc", "ly_do"],
                              "properties": {"tom_tat": {"type": "array", "items": {"type": "string"}}, "cau_soc": {"type": "array", "items": {"type": "string"}}, "ly_do": {"type": "string"}}}}}],
                    "tool_choice": {"type": "function", "function": {"name": "ghi"}}}
            r = json.load(urllib.request.urlopen(urllib.request.Request("https://api.xah.io/v1/chat/completions", data=json.dumps(body).encode(),
                headers={"Authorization": f"Bearer {khoa}", "content-type": "application/json"}), timeout=180))
            chi += float(((r.get("usage") or {}).get("x_ckey") or {}).get("cost") or 0)
            a = json.loads(r["choices"][0]["message"]["tool_calls"][0]["function"]["arguments"])
            ds = lambda v: [str(x).strip() for x in (v if isinstance(v, list) else [v]) if str(x or "").strip()]
            tu = lambda x: set(x.lower().split())
            # câu không nằm trong phụ đề = bịa → bỏ
            cs = [c.strip('"“”') for c in ds(a.get("cau_soc")) if any(len(tu(c.strip('"“”')) & tu(t)) >= 0.7 * len(tu(c.strip('"“”'))) for t in j.get("thoai") or [])]
            return {"tom_tat": ds(a.get("tom_tat"))[:3], "cau_soc": list(dict.fromkeys(cs))[:3], "ly_do": str(a.get("ly_do"))[:300], "vnd": round(chi), "mo_hinh": model}
        except Exception as e: loi = f"{model}: {str(e)[:150]}"
    return {"tom_tat": [], "cau_soc": [], "ly_do": loi, "vnd": round(chi)}

if __name__ == "__main__":
    print(json.dumps(viet(json.load(sys.stdin)), ensure_ascii=False))
