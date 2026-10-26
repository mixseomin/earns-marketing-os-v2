import json,sys
SP='/private/tmp/claude-501/-Users-htuan-Me-GitHub-earns-marketing-os-v2/d7306ccb-dd4b-42a5-9232-e5b5ef00e6e2/scratchpad/byl/'
src={x['iso']:x for x in json.load(open('/Users/htuan/Me/GitHub/earns-marketing-os-v2/apps/xuong-video/mau/may/before-you-land.json'))}
VUNG={'jp':'Châu Á','kr':'Châu Á','th':'Châu Á','vn':'Châu Á','id':'Châu Á','ph':'Châu Á','sg':'Châu Á','tw':'Châu Á','ae':'Trung Đông / Phi','eg':'Trung Đông / Phi','ma':'Trung Đông / Phi','tr':'Trung Đông / Phi','mx':'Mỹ Latinh','pe':'Mỹ Latinh','cr':'Mỹ Latinh','co':'Mỹ Latinh','au':'Châu Đại Dương','nz':'Châu Đại Dương'}
def an(w): return 'an' if w[0].upper() in 'AEIOU' else 'a'
def tp(t): return t.split('(')[0].split(',')[0].strip()
G={
19199:(181,'ai_phan_doi','Gói eSIM du lịch đắt, nhất là khi ở lâu'),
19232:(181,'ai_noi_dau','Điện thoại bị khóa mạng'),
19191:(181,'ai_noi_dau','Phí chuyển vùng quốc tế (roaming) đắt đỏ'),
19203:(181,'ai_chan_dung','Người sống xa xứ (Expat) và chuyển ra nước ngoài'),
19188:(181,'ai_tinh_huong','Du lịch quốc tế nói chung'),
19839:(180,'ai_phan_doi','Lo ngại vé máy bay quá đắt'),
19857:(180,'ai_mong_muon','Nghỉ dưỡng biển và đảo'),
19838:(180,'ai_mong_muon','Tiết kiệm tiền vé máy bay'),
19193:(181,'ai_chan_dung','Du học sinh và người sống xa nhà'),
19189:(181,'ai_tinh_huong','Du lịch Châu Âu'),
19194:(181,'ai_chan_dung','Người dùng dữ liệu mạng lớn khi du lịch'),
19195:(181,'ai_phan_doi','Điện thoại bị khoá nhà mạng không hỗ trợ eSIM'),
19841:(180,'ai_mong_muon','Muốn dùng điểm thưởng, dặm để đổi vé'),
19222:(181,'ai_noi_dau','Khó khăn khi liên lạc với gia đình từ nước ngoài'),
19190:(181,'ai_tinh_huong','Du lịch Châu Á và Đông Nam Á'),
19196:(181,'ai_chan_dung','Người cần giữ số chính để nhận OTP'),
19198:(181,'ai_phan_doi','Eo sê-ri-ca hay nhiễu bị gọi nhầm vì cước roaming'),
19843:(180,'ai_mong_muon','Du lịch khám phá nhiều nơi, chuyến đi dài ngày'),
19865:(180,'ai_noi_dau','Lo chi phí vé máy bay quá cao'),
}
# id: (iso, slug-suffix, pexels query, title, lead sentence)
B={
19199:('pt','portugal-long-stay','Lisbon street tram',"Staying in Portugal for a month? Don't grab the first eSIM you see",
 "Long stays are where travel eSIMs get pricey. A plan sized for a week won't fit a month in Lisbon, so compare plan lengths for Portugal before you pick one."),
19232:('mx','mexico-locked-phone','Mexico City airport',"Landing in Mexico? Check your phone isn't carrier-locked first",
 "A carrier-locked phone won't take a foreign eSIM, and you usually find out at the arrivals hall. Check Settings for \"No SIM restrictions\" or ask your carrier to unlock it before the trip."),
19191:('it','italy-roaming-bill','Rome Colosseum evening',"Landing in Italy? Your home SIM can start roaming before you're off the plane",
 "Roaming kicks in the second your phone grabs an Italian network, often while you're still taxiing at the gate. A few minutes of setup at home keeps that bill at zero."),
19203:('de','germany-moving-abroad','Berlin apartment moving boxes',"Moving to Germany? Here's how to have data the minute you land",
 "When you're moving abroad, the first day is all maps, bank apps and landlord messages. Don't wait until you've got a local contract. A Germany eSIM covers the gap."),
19188:('gb','uk-first-trip','London Heathrow airport',"First trip abroad? Landing in the UK, sort your phone before you fly",
 "Most first-timers find out about roaming from a text after they land. Easier to set it up at home, on your own Wi-Fi, in about two minutes."),
19839:('au','australia-flight-budget','Sydney Opera House harbour',"Spent a lot on flights to Australia? Don't add a roaming bill on top",
 "Long-haul tickets eat most of the budget. Your phone plan shouldn't take the rest. Roaming at home rates adds up fast on a two-week trip down under."),
19857:('gr','greece-islands','Santorini sea view',"Landing in Greece for the islands? Get data sorted before Santorini",
 "Ferry times, beach directions, the taverna someone recommended. Island days run on your phone, and Wi-Fi at the port is hit or miss."),
19838:('es','spain-cheap-flight','Barcelona beach aerial',"Found a cheap flight to Spain? Don't lose the savings to roaming",
 "You hunted for that fare for weeks. One careless day of roaming can quietly wipe out what you saved, so set up data before you leave."),
19193:('kr','south-korea-student','Seoul university campus',"Starting a semester in South Korea? Set up your phone before ICN",
 "New students need maps, KakaoTalk and the dorm address the moment they land. Don't rely on airport Wi-Fi for that first ride into Seoul."),
19189:('fr','france-europe-trip','Paris street cafe',"Landing in France on a Europe trip? Do this before the wheels touch down",
 "Paris is often the first stop on a multi-country trip. Pick an eSIM that covers France and wherever you're heading next, then install it at home."),
19194:('jp','japan-heavy-data','Tokyo Shibuya crossing night',"Landing in Japan with Maps, Translate and video calls all running?",
 "Japan is a heavy data trip. Train apps, live translation, photo uploads. Pick a plan with enough data for how you actually use your phone."),
19195:('tr','turkey-esim-support','Istanbul Galata tower',"Landing in Turkey? Check your phone actually supports eSIM",
 "Not every phone takes an eSIM, and some locked models refuse a foreign one. Look for \"Add eSIM\" under your cellular settings before you book a plan."),
19841:('ae','dubai-points-layover','Dubai airport terminal',"Flying to Dubai on points? Don't let the layover cost you in roaming",
 "Award tickets often come with long connections. Your phone wakes up on the layover and starts roaming, even if you never leave the airport."),
19222:('ph','philippines-family-calls','Manila city skyline',"Landing in the Philippines? Keep video calls home working from day one",
 "Family wants to know you landed. Hotel Wi-Fi drops, airport Wi-Fi asks for a phone number. Your own data line makes the first call easy."),
19190:('th','thailand-asia-loop','Bangkok temple',"Landing in Thailand on a Southeast Asia loop? Start with this",
 "Bangkok is the usual first stop before Vietnam, Cambodia or Bali. Get connected for Thailand first, then check regional plans for the rest of the route."),
19196:('sg','singapore-keep-number','Singapore Marina Bay',"Landing in Singapore? Keep your home number for bank codes",
 "Banks still text one-time codes to your home number. With an eSIM you can keep that line on for texts while all your data goes through the travel plan."),
19198:('is','iceland-surprise-bill','Iceland road waterfall',"Worried about a surprise phone bill after Iceland? Rule it out before you fly",
 "That end-of-trip bill usually comes from data roaming you forgot was on. Turn it off on your home line and let a local eSIM handle the Ring Road."),
19843:('vn','vietnam-long-trip','Ha Long Bay boat',"Landing in Vietnam for a long trip, north to south?",
 "Weeks on the road means buses, sleeper trains and a new town every few days. Pick a plan length that matches the whole route, not just the first week."),
19865:('nz','new-zealand-flight-costs','Queenstown lake mountains',"Flights to New Zealand already stretched the budget?",
 "After that airfare, the last thing you need is a roaming charge on top. Setting up data before you fly is the cheap part of the trip."),
}
# câu móc theo góc hiện trên khung hình (mẫu land › chuMo, 26/10/2026): phần nói đúng góc, bỏ "Landing in X" vì tên nước đã to giữa màn
MOC = {"19199": "Staying a month? Don't grab the first eSIM you see", "19232": "Check your phone isn't carrier-locked first", "19191": "Your home SIM can start roaming before you're off the plane", "19203": "Moving here? Have data the minute you land", "19188": "First trip abroad? Sort your phone before you fly", "19839": "Spent a lot on flights? Don't add a roaming bill on top", "19857": "Get data sorted before Santorini", "19838": "Cheap flight? Don't lose the savings to roaming", "19193": "Starting a semester? Set up your phone before ICN", "19189": "On a Europe trip? Do this before the wheels touch down", "19194": "Maps, Translate and video calls all running?", "19195": "Check your phone actually supports eSIM", "19841": "Flying on points? Don't let the layover cost you in roaming", "19222": "Keep video calls home working from day one", "19190": "On a Southeast Asia loop? Start with this", "19196": "Keep your home number for bank codes", "19198": "Surprise phone bill? Rule it out before you fly", "19843": "A long trip, north to south?", "19865": "Flights already stretched the budget?"}
out=[]
for gid,(iso,suf,q,title,lead) in B.items():
    s=src[iso]; de={'iso':iso,'nuoc':s['nuoc'],'san_bay':s['san_bay'],'link':s['link'],'truy':q,'moc':MOC[str(gid)]}
    n=s['nuoc']; cua=', '.join(f"{tp(a['tp'])} ({a['iata']})" for a in s['san_bay'])
    desc=f"{lead} Main arrival airports: {cua}. 1) Install {an(n)} {n} eSIM at home, on Wi-Fi. 2) Keep it switched off until you land. 3) Turn off data roaming on your home line. Compare eSIM plans for {n}: {s['link']}"
    sp,loai,ten=G[gid]
    out.append({'slug':f'goc-{gid}-{suf}','chu_de':n,'de':de,'dang':{'title':title,'description':desc,'link':s['link'],'nhom':VUNG.get(iso,'Châu Âu'),'goc':{'sp':sp,'id':gid,'loai':loai,'ten':ten}}})
for o in out:
    t=o['dang']['title']+o['dang']['description']
    assert '—' not in t and '–' not in t, o['slug']
    assert 25<=len(o['dang']['title'])<=110, (o['slug'],len(o['dang']['title']))
json.dump(out,open(SP+'nap.json','w'),ensure_ascii=False,indent=1)
print(len(out))
