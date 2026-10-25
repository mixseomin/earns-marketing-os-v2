import json, sys
DICH = [
 ("https://ratesbyroom.com/hotel-scam-check/", "Free checklist (5 red flags before you pay) + real hotel rates:"),
 ("https://ratesbyroom.com/scam-quiz/", "Think you'd spot it every time? Take the 10-message scam-or-real quiz:"),
 ("https://ratesbyroom.com/check-message/", "Got a message like this? Paste it into the free checker:"),
]
def dich(slug):
    a = 7
    for c in slug: a = (a * 31 + ord(c)) % 1000003
    return DICH[a % 3]
G = lambda i, loai, ten: {"sp": 179, "id": i, "loai": loai, "ten": ten}
V = []  # (goc, slug, goi, kenh, gui, tieu_de, dong, ket, ly_do, title, body, truy, nhom)
def v(goc, slug, goi, kenh, gui, dong, ket, ly_do, title, body, truy, nhom, tieu_de=None):
    V.append(dict(goc=goc, slug=slug, goi=goi, kenh=kenh, gui=gui, tieu_de=tieu_de, dong=dong, ket=ket, ly_do=ly_do, title=title, body=body, truy=truy, nhom=nhom))
d = lambda t, co=None: ({"t": t, "co": co} if co else {"t": t})

v(G(40717,"ai_phan_doi","Hỗ trợ kém và chính sách OTA cứng nhắc"), "goc-40717-priority-support-fee", "Fake priority support fee", "WhatsApp", "BookStay Support Team",
  [d("Hi, we saw your post about not getting help with your booking."), d("A senior agent can fix it today for a $25 priority fee", 1), d("Send it by gift card or Zelle to this number", 2), d("Reply within 30 minutes or the case closes.", 3)], "scam",
  ["Real support never charges to help", "Gift cards and Zelle can't be traced", "Fake timer to rush you"],
  "Booking support ignored you for days, then this WhatsApp shows up. Real?",
  "Scam. Scammers watch for angry posts about booking apps and message you pretending to be support. No real help desk charges a \"priority fee\", and none wants gift cards or Zelle. Keep the conversation inside the app and ask for a written case number.",
  "frustrated woman phone call", "Giả CSKH")
v(G(40730,"ai_tinh_huong","Đi sự kiện, concert, lễ hội"), "goc-40730-festival-surcharge", "Event weekend surcharge", "SMS", "Riverside Inn",
  [d("Due to festival demand your room for Sat 12 Jul is no longer guaranteed."), d("Pay a $90 event surcharge to keep it", 1), d("rvsd-inn-pay.co/keep", 2), d("Unpaid rooms are resold at midnight.", 3)], "scam",
  ["Surprise surcharge after you booked", "Link isn't the hotel or your app", "Midnight deadline pressure"],
  "Concert weekend, hotel booked months ago, and now a $90 'event surcharge'?",
  "Scam. Big concert and festival weekends are when these texts spike, because everyone's nervous about losing a room. The price you booked is the price. If you're worried, open the app you booked with and check the reservation there.",
  "music festival crowd night", "Dọa hủy / gấp")
v(G(40710,"ai_cach_giai","Đặt phòng qua thẻ tín dụng / cổng ngân hàng để lấy credit và điểm thưởng"), "goc-40710-card-travel-credit", "Fake card travel credit", "SMS", "Card Rewards Travel",
  [d("Your $300 annual hotel credit expires tonight."), d("Claim it now and book any stay here:", 1), d("cardrewards-travel.help/claim", 2), d("Enter your card number and CVV to verify.", 3)], "scam",
  ["Banks don't text you claim links", "Lookalike rewards domain", "Never type your CVV from a text"],
  "Your card's $300 hotel credit 'expires tonight'? Read this text before you tap",
  "Scam. Card travel credits are real, but you use them through your card's own app or the website you type in yourself. A text with a claim link and a CVV box is a card thief, not your bank.",
  "credit card smartphone hands", "Thẻ / điểm thưởng")
v(G(40733,"ai_chan_dung","Khách công tác"), "goc-40733-corporate-invoice", "Corporate invoice overdue", "Email", "Accounts - Meridian Business Hotel",
  [d("Hello, your company's direct bill was declined."), d("Please settle the invoice with your personal card", 1), d("via the secure form: meridian-billing.net/inv2291", 2), d("Otherwise the reservation is released at 6pm.", 3)], "scam",
  ["Billing issues go to your travel desk", "Lookalike billing domain", "Release deadline pressure"],
  "Traveling for work and the hotel says your company card 'declined'. Pay it?",
  "Scam. When a corporate booking has a billing problem, the hotel talks to your company's travel desk, not to you through a payment form. Forward it to your travel team and call the hotel on the number from its official site.",
  "business traveler laptop hotel", "Dọa hủy / gấp", tieu_de="Invoice #INV-2291 overdue")
v(G(40720,"ai_mong_muon","Tích lũy đổi điểm lấy phòng giá rẻ"), "goc-40720-points-broker", "Points broker deal", "WhatsApp", "Elite Points Deals",
  [d("Hi! I can book you 5 nights at a 5-star for 40% of the points price."), d("Just share your loyalty login and PIN", 1), d("and pay $60 upfront via Cash App", 2), d("Limited spots this week only!", 3)], "scam",
  ["Never share your loyalty login", "Upfront Cash App payment", "Fake scarcity"],
  "Someone offers 5 hotel nights for 40% of the points. Deal or scam?",
  "Scam. Anyone who wants your loyalty login can drain every point you've saved, and the $60 is gone too. Points deals are real, but you redeem them yourself inside the hotel's or card's own app.",
  "luxury hotel room bed", "Thẻ / điểm thưởng")
v(G(40760,"ai_cu_hich","Đến nơi khách sạn không giữ phòng / mất đặt phòng"), "goc-40760-real-walked-partner-hotel", "Real overbooking relocation", "Email", "Front Desk - Harbor Lane Hotel",
  [d("Sorry, tonight we can't offer the room you booked."), d("We've moved you to our partner hotel nearby, at no extra cost."), d("The taxi is on us. Your app booking is already updated."), d("Questions? Call the number on your confirmation.")], "real",
  ["Asks for no payment at all", "The change already shows in your app", "Gives a number you already have"],
  "You land and the hotel says your room is gone. Is this email real?",
  "Real. Overbooking happens, and a good hotel fixes it on its own dime. The tell is simple: nothing to pay, the change already shows in your booking app, and the number they give is one you already have. If a message like this asks you to pay the difference, it's a scam.",
  "hotel reception night arrival", "Tin thật", tieu_de="About your arrival tonight (booking 55120)")
v(G(40718,"ai_phan_doi","Giá phòng quá đắt đỏ"), "goc-40718-95-direct-deal", "Too-cheap direct deal", "WhatsApp", "Azure Bay Resort Deals",
  [d("Hi, saw you were looking at Azure Bay for March."), d("It's $280 a night on the big sites. Book direct with me for $95!", 1), d("Pay by bank transfer to my manager's account", 2), d("Only 2 rooms left at this price.", 3)], "scam",
  ["Price is too good to be true", "Pays into a personal account", "Fake scarcity"],
  "Hotel's $280 a night online, but a WhatsApp says $95 direct. Real?",
  "Scam. When prices feel brutal, a deal like this is exactly what you want to hear. That's the hook. Real direct rates are a little cheaper, not 66% off, and a real resort never asks you to pay a manager's personal account.",
  "tropical resort pool", "Chuyển khoản / QR / ví")
v(G(40735,"ai_tinh_huong","Du lịch châu Âu"), "goc-40735-rome-registration-fee", "Fake registration fee", "Email", "Check-in - Casa Rossi Roma",
  [d("Ciao! Italian law requires guest registration before check-in."), d("Upload your passport photo and pay the €45 registration fee", 1), d("at casarossi-checkin.eu/reg", 2), d("No registration, no key code on arrival.", 3)], "scam",
  ["Registration is free, done at the desk", "Lookalike link, not your app", "Threat: no key code"],
  "Rome apartment wants a €45 'registration fee' before you arrive. Pay it?",
  "Scam. In Italy your host does have to register your passport, which is why this one sounds believable. But it's free and handled at check-in or inside the app you booked with. A fee plus a passport photo upload is identity theft with a bill attached.",
  "rome street travel", "Hộ chiếu / giấy tờ")
v(G(40728,"ai_chan_dung","Người đi Tokyo và Nhật Bản lần đầu hoặc tự túc"), "goc-40728-tokyo-deposit", "Fake tourist deposit", "SMS", "Shinjuku Garden Hotel",
  [d("Welcome to Tokyo! Your check-in tomorrow needs a tourist deposit."), d("Pay ¥15,000 (about $100) by card here", 1), d("sgh-tokyo-guest.jp.net/pay", 2), d("Unpaid guests can't check in after 3pm.", 3)], "scam",
  ["Local hotel tax is paid at the desk", "Odd domain, not the hotel's", "Check-in threat"],
  "First trip to Tokyo and a text asks ¥15,000 before check-in. Scam?",
  "Scam. First-time visitors don't know the local rules, and scammers count on that. Any local tax is settled at the front desk when you check in. If a text wants yen before you've even landed, check your booking in the app instead.",
  "tokyo street night", "Dọa hủy / gấp")
v(G(40773,"ai_noi_dau","Bức xúc với phí ẩn và giá cả không minh bạch"), "goc-40773-protection-fee", "Fake booking protection fee", "SMS", "Reservations Dept",
  [d("Your stay at Lakeside Lodge, 8-10 Dec, is NOT protected."), d("Add the required $39 booking protection fee", 1), d("lakeside-protect.info/add", 2), d("Unprotected bookings may be cancelled without refund.", 3)], "scam",
  ["No 'required' fee after you paid", "Vague sender, odd link", "Cancellation threat"],
  "Already paid in full, now a text says a $39 'protection fee' is required?",
  "Scam. Hidden fees make everyone suspicious of their bill, so a \"required\" fee sounds plausible. Every real fee shows up in your booking total. If it's not there, it's not owed.",
  "woman reading phone kitchen", "Phí ẩn")
v(G(40729,"ai_mong_muon","So sánh, theo dõi và săn giá thấp nhất"), "goc-40729-price-drop-rebook", "Fake price drop alert", "SMS", "HotelPriceAlert",
  [d("Price alert: your Miami hotel just dropped to $119/night (was $214)."), d("Cancel your current booking and rebook here in 10 min", 1), d("hotel-pricedrop.deals/rebook", 2), d("Card details needed to lock the rate.", 3)], "scam",
  ["An alert you never signed up for", "Unknown rebooking site", "10-minute rush"],
  "A price alert says your Miami hotel dropped 45%. Rebook through the link?",
  "Scam. Price tracking is smart, but only from a tool you set up yourself. This one wants you to cancel a real booking and hand your card to a site you've never heard of. Check the price drop on the hotel's own site first.",
  "miami beach hotel", "Giá rẻ giả")
v(G(40771,"ai_cu_hich","Bị từ chối hoàn tiền sau khi hủy phòng"), "goc-40771-refund-claims-desk", "Fake refund claims desk", "Email", "Refund Desk - Global Booking Claims",
  [d("Good news: we reviewed your denied cancellation and approved $412."), d("To release it, log in to your bank through our secure portal", 1), d("claims-refund-center.com/release", 2), d("Unclaimed refunds expire in 48 hours.", 3)], "scam",
  ["Refunds go back to the card you used", "Never log in to a bank via a link", "48-hour pressure"],
  "Hotel denied your refund, then a 'claims desk' says $412 is ready?",
  "Scam. A denied refund is painful, and that's exactly the moment these emails land. Real refunds go back to the card you paid with. Nobody needs your bank login to send you money.",
  "stressed man laptop bills", "Hoàn tiền giả")
v(G(40780,"ai_noi_dau","Lo ngại an toàn khi di chuyển đêm muộn"), "goc-40780-key-box-venmo", "Late arrival key box fee", "SMS", "Night Desk",
  [d("Hi, you arrive after 11pm and our front desk will be closed."), d("To get the key box code, pay a $50 late arrival fee", 1), d("by Venmo to @nightdesk-keys", 2), d("Code sent only after payment.", 3)], "scam",
  ["Late fees are paid at the hotel", "Venmo to a stranger", "The code is held hostage"],
  "Landing at midnight and the 'hotel' wants $50 Venmo for a key code?",
  "Scam. Arriving late and alone already feels risky, and this text plays on that. Call the hotel on the number from its official site before you fly. Ask how late check-in works, and never pay a stranger's Venmo for a door code.",
  "airport night taxi", "Chuyển khoản / QR / ví")
v(G(40711,"ai_cach_giai","Chọn thời điểm đặt phòng: đặt sớm hoặc đặt sát ngày"), "goc-40711-real-free-cancel-reminder", "Real free-cancellation reminder", "Email", "Reservations - Cedar Point Inn",
  [d("Hi Daniel, a reminder about your stay on 22 Nov."), d("Free cancellation ends Friday at 6pm."), d("New dates? Use 'Manage booking' in your booking app."), d("Nothing to pay now. You'll pay at the hotel.")], "real",
  ["No link and no payment asked", "Sends you back to the app you used", "Matches the policy you booked"],
  "Booked early to lock the rate? This reminder email: scam or real?",
  "Real. Booking early with free cancellation is a solid move, and a reminder like this is what a real hotel sends. No link to pay, no new fee, and it points you back to the app you booked with.",
  "calendar planning travel", "Tin thật", tieu_de="Reminder: free cancellation ends Friday")
v(G(40722,"ai_phan_doi","Phụ phí và phí ẩn bất ngờ"), "goc-40722-dispute-review-fee", "Pay-to-dispute fees", "SMS", "Ocean Crest Billing",
  [d("Your final bill shows $214 in extra fees: minibar, late checkout, towels."), d("To dispute, pay a $9.99 review fee first", 1), d("oceancrest-folio.com/dispute", 2), d("Disputes close in 24 hours.", 3)], "scam",
  ["Disputes are always free", "Link isn't the hotel's site", "24-hour deadline"],
  "Checked out, then a text lists $214 in extra fees. Pay $9.99 to dispute?",
  "Scam. Surprise fees after checkout make you want to fight back fast, so they charge you to \"dispute\". Ask the hotel for your folio by email and dispute anything wrong with your card issuer. That costs nothing.",
  "hotel bill receipt", "Phí ẩn")
v(G(40734,"ai_chan_dung","Cặp đôi đi nghỉ lãng mạn"), "goc-40734-honeymoon-upgrade", "Honeymoon upgrade deposit", "WhatsApp", "Palm Shore Guest Relations",
  [d("Congratulations on your honeymoon! We'd love to surprise you both."), d("Upgrade to our ocean suite for $149 instead of $480", 1), d("Send a $75 deposit today to hold it", 2), d("via this payment link: palmshore-upgrades.com", 3)], "scam",
  ["Real upgrades are offered at the desk", "Deposit outside your booking", "Unofficial payment link"],
  "Honeymoon in 2 weeks and the resort offers a $149 suite upgrade. Real?",
  "Scam. Scammers know who's on a honeymoon because people post about it. Real upgrades get offered at check-in or inside your booking, and they're added to your bill. A deposit through a random link isn't how resorts sell suites.",
  "couple beach sunset", "Nâng hạng giả")
v(G(40738,"ai_tinh_huong","Đặt phòng để xin visa"), "goc-40738-visa-letter", "Fake visa hotel letter", "Email", "VisaStay Bookings",
  [d("Need a hotel booking for your visa? Letters in 1 hour."), d("Guaranteed approval for Schengen, UK and US", 1), d("Pay $35 in USDT, no real booking needed", 2), d("Letters carry the hotel's stamp.", 3)], "scam",
  ["No one can promise visa approval", "Crypto payment, no refund", "Fake hotel papers can get you refused"],
  "Need a hotel booking for your visa? Is this '1-hour letter' offer real?",
  "Scam. Visa applications ask for proof of where you'll stay, and fake letter sellers know it. A forged booking can get your visa refused. Book a real room with free cancellation and use that confirmation instead.",
  "passport visa documents", "Hộ chiếu / giấy tờ", tieu_de="Embassy-approved hotel letter in 1 hour")
v(G(40753,"ai_mong_muon","Cần giữ phòng chắc chắn"), "goc-40753-real-guaranteed-reservation", "Real guaranteed reservation", "Email", "Reservations - Willow Creek Hotel",
  [d("Thanks, Sam. Your room is held all night."), d("We only charge your card if you don't show up."), d("Cancel free until 3 Dec in your booking app."), d("Nothing to do now. See you on the 5th!")], "real",
  ["Uses the card you already gave", "No link to pay, no deadline", "Policy matches your booking"],
  "Worried your room won't be there? Is this 'guaranteed' email real?",
  "Real. A guaranteed reservation means the hotel holds your room even if you arrive late, using the card you booked with. This email asks for nothing new. If a \"guarantee\" message wants a fresh payment through a link, that's the scam version.",
  "hotel room key card", "Tin thật", tieu_de="Guaranteed reservation #7Q2K91")
v(G(40772,"ai_cu_hich","Khách sạn hết phòng hoặc đóng cửa khi khách tới"), "goc-40772-closed-for-repairs", "Fake closure relocation fee", "WhatsApp", "Grandview Hotel Relocation",
  [d("Grandview Hotel is closed for urgent repairs."), d("You're moved to a sister hotel, $70/night difference", 1), d("Pay it by Wise to our partner account", 2), d("Confirm within 2 hours to keep your room.", 3)], "scam",
  ["The hotel pays when it moves you", "Wise to a 'partner' account", "2-hour rush"],
  "The hotel 'closed for repairs' and wants $70 a night more. Real?",
  "Scam. Hotels do sometimes close or move guests, but when they do, they cover the cost. Nobody pays a \"difference\" to a partner account. Call the hotel on its official number and check your booking in the app.",
  "hotel renovation construction", "Chuyển khoản / QR / ví")
v(G(40802,"ai_noi_dau","Chủ khách sạn chịu chiết khấu OTA cao"), "goc-40802-owner-pay-direct", "Owner asks you to cancel and pay direct", "WhatsApp", "Owner - Villa Solana",
  [d("Hi, I'm the owner. The booking site takes 25% of every stay from me."), d("Cancel on the app and pay me direct, I'll take 20% off", 1), d("Bank transfer only, details below", 2), d("Please keep this between us.", 3)], "scam",
  ["Cancel = you lose the app's protection", "Bank transfer has no buyer protection", "Secrecy is a red flag"],
  "'The booking site takes 25% from me.' Owner asks you to pay direct. Okay?",
  "Scam, or close enough to one. Booking site commissions are real and owners do hate them, so the story sounds fair. But once you cancel and wire money, you've lost every protection the app gave you. Want to book direct next time? Do it from the property's own website.",
  "villa terrace mediterranean", "Chuyển khoản / QR / ví")
v(G(40708,"ai_cach_giai","Đặt qua các OTA quốc tế (Agoda, Expedia, Hotels.com, Trip.com)"), "goc-40708-app-account-locked", "Fake app account lock", "SMS", "Travel Booking Alert",
  [d("Your booking app account is locked due to a payment issue."), d("Verify your card within 1 hour", 1), d("at bookings-verify-help.com", 2), d("or your 3 upcoming stays will be cancelled.", 3)], "scam",
  ["Apps show problems inside the app", "Not the app's real domain", "Mass-cancel threat"],
  "Booked 3 stays on a big booking app and a text says your account is locked?",
  "Scam. Big booking apps are a safe way to book, which is why scammers pretend to be them. A real payment issue shows up in the app itself. Close the text, open the app you installed, and check there.",
  "person using phone app", "Dọa hủy / gấp")
v(G(40713,"ai_mong_muon","Tìm chỗ lưu trú giá rẻ tiết kiệm"), "goc-40713-39-room-gift-card", "Budget room gift card deposit", "WhatsApp", "Downtown Budget Rooms",
  [d("Private room downtown, $39 a night, Wi-Fi and breakfast included."), d("Book outside the app to save the service fee", 1), d("$100 deposit in Apple gift cards", 2), d("Send the card codes and I'll send the address.", 3)], "scam",
  ["Off-app means no protection", "Gift card deposits are always scams", "Address only after you pay"],
  "$39 a night downtown with breakfast? Read this WhatsApp before you pay",
  "Scam. Cheap stays exist, but no real host asks for gift card codes. Once you send them, the money's gone and there's no address. Stick to bookings inside an app, where your payment is protected.",
  "budget hostel room", "Chuyển khoản / QR / ví")

LINKS = [  # (goc_id, slug, dich, title, body, truy)
 (40773, "link-goc-40773-protection-fee", "https://ratesbyroom.com/hotel-fake-fee-scam/", "Paid in full, then a \"required $39 protection fee\" text? How to check it",
  "Every real fee is in your booking total. Open the app you booked with and compare. If the fee isn't listed there, you don't owe it. Real examples and what to do if you already paid:", "woman checking bill phone"),
 (40729, "link-goc-40729-price-drop-rebook", "https://ratesbyroom.com/cheap-hotel-deal-scam/", "A \"price drop\" text told you to cancel and rebook? Read this first",
  "Never cancel a real booking because a stranger's text says it got cheaper. Check the price on the hotel's own site first. How these fake deal alerts work:", "hotel price comparison laptop"),
 (40733, "link-goc-40733-corporate-invoice", "https://ratesbyroom.com/business-travel-hotel-scam/", "On a work trip and the hotel says your company card \"declined\"?",
  "Corporate billing problems go to your travel desk, never to a payment form in your inbox. Forward the email and call the hotel on its official number. The work-travel scams to know:", "businessman hotel lobby"),
 (40718, "link-goc-40718-95-direct-deal", "https://ratesbyroom.com/cheap-hotel-deal-scam/", "$95 a night when every site says $280? How these WhatsApp deals work",
  "Real direct rates are a bit cheaper, not 66% off. And no resort asks you to pay a manager's personal account. Spot the fake deal before you pay:", "resort beach chairs"),
 (40780, "link-goc-40780-key-box-venmo", "https://ratesbyroom.com/late-night-hotel-check-in-scam/", "Arriving after midnight? The \"pay for the key box code\" text to ignore",
  "Call the hotel before you fly and ask how late check-in works. Late fees get paid at the hotel, never by Venmo to a stranger. A late-night check-in plan that keeps you safe:", "city street night lights"),
 (40738, "link-goc-40738-visa-letter", "https://ratesbyroom.com/hotel-booking-for-visa/", "Need a hotel booking for a visa? Skip the \"1-hour embassy letter\"",
  "Fake booking letters can get a visa refused. Book a real room with free cancellation and use that confirmation. What embassies actually want to see:", "passport travel documents table"),
 (40722, "link-goc-40722-dispute-review-fee", "https://ratesbyroom.com/hotel-fake-fee-scam/", "Surprise fees after checkout? Never pay a \"review fee\" to dispute them",
  "Ask the hotel for your folio by email, then dispute anything wrong with your card issuer. It's free. How to handle extra charges after a stay:", "hotel checkout receipt"),
 (40734, "link-goc-40734-honeymoon-upgrade", "https://ratesbyroom.com/honeymoon-hotel-scam/", "Honeymoon coming up? The \"suite upgrade deposit\" message to watch for",
  "Real upgrades get offered at check-in or inside your booking, and they go on your bill. A deposit through a random link isn't one. Honeymoon booking scams and how to dodge them:", "honeymoon couple resort"),
]

out = []
by = {x["goc"]["id"]: x for x in V}
for x in V:
    de = {"kenh": x["kenh"], "gui": x["gui"], **({"tieu_de": x["tieu_de"]} if x["tieu_de"] else {}), "dong": x["dong"], "ket": x["ket"], "ly_do": x["ly_do"], "goi": x["goi"], "truy": x["truy"]}
    link, moi = dich(x["slug"])
    out.append({"slug": x["slug"], "chu_de": x["goi"], "de": de, "dang": {"title": x["title"], "description": f'{x["body"]} {moi} {link}', "link": link, "nhom": x["nhom"], "goc": x["goc"]}})
for gid, slug, link, title, body, truy in LINKS:
    out.append({"slug": slug, "chu_de": title, "de": {"loai": "bai-link", "link": link, "truy": truy},
                "dang": {"loai": "link", "title": title, "description": f"{body}\n\n{link}", "link": link, "nhom": by[gid]["nhom"], "chuyen": by[gid]["slug"], "goc": by[gid]["goc"]}, "nen_url": None})
# kiểm
import re
ts = [o["dang"]["title"] for o in out]
assert len(set(ts)) == len(ts)
for o in out:
    t, ds = o["dang"]["title"], o["dang"]["description"]
    assert 25 <= len(t) <= 100, (len(t), t)
    assert re.search(r"[?!]|\d", t), t
    assert not re.search("[—–]", t + ds), o["slug"]
    assert o["dang"]["link"] in ds
    for w in ['delve','leverage','utilize','crucial','vital','comprehensive','robust','streamline','moreover','furthermore','seamless']: assert w not in (t+ds).lower(), (w, o["slug"])
print(len(out), file=sys.stderr)
json.dump(out, sys.stdout, ensure_ascii=False)
