#!/usr/bin/env bash
# Dựng MỘT camp Facebook trên Ethopex theo khuôn chuẩn (kb #261 mục 4) tới sát nút Publish — KHÔNG bấm Publish.
#   Campaign: ETP_440 · $1/ngày (mặc định form) · Ad Set: Pixel_AFC_02 + whitelist 39 nước + ngôn ngữ · Ad: Page Andrew Rebecca Akumiah + creative
# Cách gọi (br đã `br use 557`, iMac):
#   dung-camp.sh "<tên camp>" <creative_id> <en|es>
# Publish (chỉ khi anh cho trong lượt đó) là một lệnh RIÊNG để khớp rule allow:
#   ~/bin/br post click '{"selector":"[data-pb=pub]","sensitive":"(?!x)x"}'
set -u
BR=~/bin/br
TEN=$1; CR=$2; LANG_=${3:-en}
NGU=English; [ "$LANG_" = es ] && NGU="Spanish (All)"   # ES phủ cả Spain lẫn Mỹ Latinh (mã 1002)
C='United States, Canada, United Kingdom, Australia, New Zealand, Germany, France, Netherlands, Switzerland, Austria, Belgium, Denmark, Norway, Sweden, Singapore, Spain, Italy, Poland, Japan, South Korea, Finland, Ireland, Portugal, Czech Republic, Hungary, Romania, Croatia, Slovakia, Slovenia, Estonia, Lithuania, Latvia, Cyprus, Malta, Taiwan, Hong Kong, United Arab Emirates, Saudi Arabia, Qatar'

bam() { $BR eval "(()=>{const e=$1;if(!e)return 'THIEU';e.click();return 'ok'})()" | tail -1; }

# nháp cũ trong localStorage sẽ bị nạp lại vào form → xoá nháp trước khi mở wizard
$BR goto https://app.ethopex.dev/campaign/list-campaign --here >/dev/null 2>&1; sleep 2
$BR eval 'Object.keys(localStorage).filter(k=>/draft/i.test(k)).forEach(k=>localStorage.removeItem(k));"ok"' >/dev/null
bam '[...document.querySelectorAll("button,a")].find(x=>x.innerText?.trim()=="Add campaign")'; sleep 2
bam '[...document.querySelectorAll("[role=dialog] *")].filter(x=>x.innerText?.trim().startsWith("Facebook Ads")).pop()'; sleep 4
$BR eval 'location.href' | tail -1

# Campaign
$BR fill 'input[name=name]' "$TEN" >/dev/null
bam '[...document.querySelectorAll("main button,[role=combobox]")].find(x=>/Select Facebook ad account/.test(x.innerText))'; sleep 2
bam '[...document.querySelectorAll("[role=option]")].find(x=>/ETP_440/.test(x.textContent))'; sleep 1

# Ad Set
bam '[...document.querySelectorAll("main *")].find(x=>x.children.length<3&&x.innerText?.trim()=="New Sales Ad Set")'; sleep 2
$BR fill 'input[name=adSetName]' "$TEN · whitelist 39 $LANG_" >/dev/null
bam '[...document.querySelectorAll("main button,[role=combobox]")].find(x=>/Select a dataset/.test(x.innerText))'; sleep 2
bam '[...document.querySelectorAll("[role=option]")].find(x=>/Pixel_AFC_02/.test(x.textContent))'; sleep 1
bam '[...document.querySelectorAll("main button")].filter(e=>/Paste list/.test(e.innerText))[0]'; sleep 1
$BR fill '[role=dialog] textarea' "$C" >/dev/null
bam '[...document.querySelectorAll("[role=dialog] button")].find(b=>b.innerText.trim()=="Apply")'; sleep 1
bam '[...document.querySelectorAll("main button")].filter(e=>/Paste list/.test(e.innerText))[2]'; sleep 1
$BR fill '[role=dialog] textarea' "$NGU" >/dev/null
bam '[...document.querySelectorAll("[role=dialog] button")].find(b=>b.innerText.trim()=="Apply")'; sleep 1
$BR fill 'input[name=adSetName]' "$TEN · whitelist 39 $LANG_" >/dev/null
$BR eval 'const t=document.querySelector("main").innerText;"ADSET | "+(t.match(/Pixel \(Dataset\)[\s\S]{0,50}/)||["?"])[0]+" || "+(t.match(/Locations \(include countries\)[\s\S]{0,50}/)||["?"])[0]+" || "+(t.match(/Languages[\s\S]{0,30}/)||["?"])[0]' | tail -1

# Ad
$BR eval '(()=>{const e=[...document.querySelectorAll("div,span,button")].filter(x=>x.innerText?.trim()=="New Sales Ad");e[0].setAttribute("data-pb","adlv");return e.length})()' >/dev/null
$BR post click '{"selector":"[data-pb=adlv]"}' >/dev/null 2>&1; sleep 2
$BR fill 'input[name=adName]' "$TEN" >/dev/null
bam '[...document.querySelectorAll("main button,[role=combobox]")].find(x=>/Select a FB Page/.test(x.innerText))'; sleep 2
bam '[...document.querySelectorAll("[role=option]")].find(x=>/Andrew Rebecca/.test(x.textContent))'; sleep 1
bam '[...document.querySelectorAll("main button,[role=combobox]")].find(x=>/Select a creative/.test(x.innerText))'; sleep 3
bam "[...document.querySelectorAll('[role=option]')].find(x=>/$CR/.test(x.textContent))"; sleep 2
$BR eval 'const t=document.querySelector("main").innerText;"AD | "+(t.match(/Facebook Page[\s\S]{0,60}/)||["?"])[0]+" || "+(t.match(/Set up creative[\s\S]{0,120}/)||["?"])[0]' | tail -1

# kiểm payload sẽ gửi (View create payload) — in gọn
bam '[...document.querySelectorAll("button")].find(x=>/View create payload/.test(x.innerText))' >/dev/null; sleep 2
$BR eval '(()=>{const p=JSON.parse(document.querySelector("[role=dialog] pre").textContent);const g=p.campaign.ad_groups[0],s=g.source_payload,a=g.ads[0];[...document.querySelectorAll("[role=dialog] button")].find(x=>x.innerText.trim()=="Close")?.click();return "PAYLOAD "+JSON.stringify({ten:p.name,tk:p.ad_account_id,page:a.facebook_page_id,cr:a.creative_id,content:a.content_id,ngan_sach:p.campaign.source_payload.daily_budget,pixel:s.promoted_object.pixel_id,su_kien:s.promoted_object.custom_event_type,nuoc:s.targeting.geo_locations.countries.length,ngon_ngu:s.targeting.locales,adset:s.name,lich:g.type_run})})()' | tail -1

# CỔNG NGÔN NGỮ (kiem-ngon-ngu.py): phim · creative · nhắm ngôn ngữ phải cùng một tiếng — lệch thì KHÔNG đánh dấu Publish
$BR eval '(()=>{document.querySelectorAll("[data-pb=pub]").forEach(x=>x.removeAttribute("data-pb"));window.__k=null;const pre=document.querySelector("[role=dialog] pre");return 1})()' >/dev/null
bam '[...document.querySelectorAll("button")].find(x=>/View create payload/.test(x.innerText))' >/dev/null; sleep 2
$BR eval '(()=>{const p=JSON.parse(document.querySelector("[role=dialog] pre").textContent);[...document.querySelectorAll("[role=dialog] button")].find(x=>x.innerText.trim()=="Close")?.click();const g=p.campaign.ad_groups[0],a=g.ads[0];fetch("https://api.ethopex.dev/api/v1/creatives/"+a.creative_id,{headers:{Authorization:"Bearer "+localStorage.getItem("access_token")}}).then(r=>r.json()).then(c=>{const s=JSON.parse((c.creative||c).asset_spec||"{}");window.__k=JSON.stringify({content_id:a.content_id,locales:g.source_payload.targeting.locales||[],texts:[...(s.primaryTexts||[]),...(s.headlines||[]),...(s.descriptions||[])]})});return 1})()' >/dev/null; K=null; for _ in 1 2 3 4 5 6 7 8 9 10; do sleep 2; K=$($BR eval 'window.__k' | tail -1); [ "$K" != null ] && break; done
[ "$K" = null ] && { echo "PUB CHAN — không đọc được creative để kiểm ngôn ngữ"; exit 2; }
CID=$(echo "$K" | python3 -c 'import json,sys;d=json.loads(sys.stdin.read());d=json.loads(d) if isinstance(d,str) else d;print(d["content_id"])')
CL=$(ssh root@167.233.241.16 ". /root/.secrets/spy.env; psql \"\$DATABASE_URL\" -tAc 'select locale from ethopex_content where id=$CID'")
if echo "$K" | python3 -c 'import json,sys;d=json.loads(sys.stdin.read());d=json.loads(d) if isinstance(d,str) else d;d.update(lang=sys.argv[1],content_locale=sys.argv[2]);print(json.dumps(d))' "$LANG_" "$CL" | python3 "$(dirname "$0")/kiem-ngon-ngu.py"; then
  # đánh dấu nút Publish cho lệnh bấm riêng
  $BR eval '(()=>{const b=[...document.querySelectorAll("button")].filter(b=>b.innerText.trim()=="Publish"&&b.offsetParent!==null);if(!b.length)return "PUB none";b[b.length-1].setAttribute("data-pb","pub");return "PUB ok disabled="+b[b.length-1].disabled})()' | tail -1
else
  echo "PUB CHAN — cổng ngôn ngữ không đạt, KHÔNG Publish"; exit 2
fi
