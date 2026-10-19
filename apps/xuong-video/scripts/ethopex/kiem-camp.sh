#!/usr/bin/env bash
# KIỂM LẠI camp Ethopex ĐÃ LÊN bằng cổng ngôn ngữ (kiem-ngon-ngu.py): nội dung · chữ QC creative · nhắm ngôn ngữ · trang đích.
# Chỉ ĐỌC, không sửa camp. Cách gọi (br đã `br use 557`, trang app.ethopex.dev đang mở):
#   kiem-camp.sh <lang> <camp_id> [camp_id…]       vd: kiem-camp.sh en 65110 65112
set -u
BR=~/bin/br; D=$(dirname "$0"); LANG_=$1; shift; LOI=0
for ID in "$@"; do
  $BR eval "window.__k=null;(async()=>{const h={Authorization:'Bearer '+localStorage.getItem('access_token')};const j=await (await fetch('https://api.ethopex.dev/api/v1/campaigns/$ID',{headers:h})).json();const g=j.ad_groups[0],a=g.ads[0],sp=JSON.parse(g.source_payload||'{}');const c=await (await fetch('https://api.ethopex.dev/api/v1/creatives/'+a.creative_id,{headers:h})).json();const s=JSON.parse((c.creative||c).asset_spec||'{}');window.__k=JSON.stringify({ten:j.campaign.name,content_id:a.content_id,locales:(sp.targeting||{}).locales||[],final_url:a.final_url,texts:[...(s.primaryTexts||[]),...(s.headlines||[]),...(s.descriptions||[])]})})();1" >/dev/null
  K=null; for _ in 1 2 3 4 5 6 7 8 9 10; do sleep 2; K=$($BR eval 'window.__k' | tail -1); [ "$K" != null ] && break; done
  [ "$K" = null ] && { echo "#$ID → KHÔNG ĐỌC ĐƯỢC camp (API chưa trả) — chưa kết luận"; LOI=1; continue; }
  CID=$(echo "$K" | python3 -c 'import json,sys;d=json.loads(sys.stdin.read());d=json.loads(d) if isinstance(d,str) else d;print(d["content_id"])')
  CL=$(ssh root@167.233.241.16 ". /root/.secrets/spy.env; psql \"\$DATABASE_URL\" -tAc 'select locale from ethopex_content where id=$CID'")
  KQ=$(echo "$K" | python3 -c 'import json,sys;d=json.loads(sys.stdin.read());d=json.loads(d) if isinstance(d,str) else d;d.update(lang=sys.argv[1],content_locale=sys.argv[2]);print(json.dumps(d))' "$LANG_" "$CL" | python3 "$D/kiem-ngon-ngu.py") || LOI=1
  echo "#$ID [$LANG_] $(echo "$K" | python3 -c 'import json,sys;d=json.loads(sys.stdin.read());d=json.loads(d) if isinstance(d,str) else d;print(d["ten"], "· locales", d["locales"])') → $KQ"
done
exit $LOI
