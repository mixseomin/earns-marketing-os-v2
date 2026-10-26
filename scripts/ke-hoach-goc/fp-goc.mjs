// Đề góc cho máy front-porch-only-one (một lần, 26/10/2026)
const GIONG = { C: 'GO', G: 'CO', O: 'QCD', Q: 'O', D: 'O', E: 'FB', F: 'E', B: 'RE', R: 'BP', P: 'RB', I: 'L', L: 'I', M: 'N', N: 'MH', H: 'N', U: 'V', V: 'UY', W: 'V', K: 'X', S: 'Z', A: 'R', T: 'I', Y: 'V' };
const rngHat = (h) => () => { h = (h * 1103515245 + 12345) % 2147483648; return h / 2147483648; };
function saiMot(w, r) { for (;;) { const i = Math.floor(r() * w.length), a = [...w];
  if (r() < 0.4 && i < w.length - 1 && a[i] !== a[i + 1]) [a[i], a[i + 1]] = [a[i + 1], a[i]];
  else { const g = GIONG[a[i]]; if (!g) continue; a[i] = g[Math.floor(r() * g.length)]; }
  const v = a.join(''); if (v !== w) return v; } }
const NOS = { sau: '#1E5A6B', nhan: '#E9B44C', truoc: '#F4EBDC' }, BIB = { sau: '#22384F', nhan: '#D9B562', truoc: '#EAF0F5' }, FALL = { sau: '#7A3B1E', nhan: '#E8A33D', truoc: '#F6EBD9' };
const GUM = 'https://frontporchpuzzles.gumroad.com/l/fcioei', P = (s) => `https://pickjot.com/printables/${s}/`;
const G = (sp, id, loai, ten) => ({ sp, id, loai, ten });
const L = [
 [G(1438,39421,'ai_mong_muon','Giai đoạn sớm: muốn hoạt động trí não làm chậm tiến triển sa sút'),'MEMORIES','Memories','senior couple doing puzzle at kitchen table',NOS,'large-print-word-search',
  'Early memory changes at home? Try this 7-second word check together',
  "If someone you love just started having memory slips, a short puzzle you do side by side makes an easy daily habit. It won't fix anything medical. It's just a few minutes of focus and a laugh when one of you spots it first."],
 [G(1435,37255,'ai_cu_hich','Quà thăm hỏi bạn thân sau phẫu thuật'),'DAFFODIL','Get Well Flowers','get well flowers bouquet bedside',NOS,'flowers-word-search',
  'Friend just had surgery? Send them this instead of another card',
  "Recovery days drag. Print a few large print puzzles, tuck them in with a pencil, and they've got something to do between naps and visitors. Big letters, so no squinting from a hospital bed.", true],
 [G(1435,37202,'ai_cach_giai','Đố vui kiểu truyện bí ẩn murder mystery'),'DETECTIVE','Detective','magnifying glass vintage desk',BIB,'large-print-word-search',
  'One real name, 35 suspects. Can you find the true DETECTIVE in 7 seconds?',
  "35 of these are fakes, each off by a single letter. Only one is the real thing. Read the grid like a suspect list and see who slips up. Comment the row you found it in."],
 [G(1435,37227,'ai_phan_doi','Quà tặng không được dùng đến'),'KEEPSAKE','Keepsake','wrapped gift and coffee cup morning',FALL,'large-print-word-search',
  'Tired of gifts that end up in a drawer? Give one they reach for with coffee',
  "Candles and mugs pile up. A puzzle gets picked up again the next morning, and the next. Try the 7-second warm up, then print a free page to see how big the letters really are.", true],
 [G(1435,37225,'ai_phan_doi','Người bán sách trên thị trường bão hòa khó nổi bật'),'STORYTIME','Storytime','stack of old books on shelf',NOS,'large-print-word-search',
  'Every puzzle book looks the same? Ours puts a memory story next to each grid',
  "Most word search books are just grids and an answer key. Ours pairs each puzzle with a short memory prompt, so it turns into a conversation at the table. See a free page before you buy anything.", true],
 [G(1438,39403,'ai_chan_dung','Nhân viên viện dưỡng lão / care home thiếu hoạt động và ngân sách'),'ACTIVITY','Activity Room','senior group activity room table',BIB,'large-print-word-search',
  'Activity director with a $0 budget? Print this free page for the whole group',
  "Free large print word search pages you can copy for every resident, answer key on the last page. Put this 7-second hunt on the TV first to warm the room up, then hand out the paper ones."],
 [G(1438,39420,'ai_tieu_chi','Hoạt động phù hợp với nhu cầu và giai đoạn bệnh của từng người'),'GENTLE','Gentle Puzzle','elderly hands holding pencil paper',NOS,'large-print-word-search',
  'Not every puzzle fits every stage. Is a 7-second hunt the right size?',
  "Big letters, one word to find, and a timer you can ignore. If a full 15x15 grid feels like too much right now, start here and save the printable page for a good day."],
 [G(1438,39443,'ai_cu_hich','Gia đình vừa nghe chẩn đoán sa sút trí tuệ — cần bộ hoạt động khởi đầu ngay'),'TOGETHER','Together','adult daughter with elderly mother at table',NOS,'large-print-word-search',
  'Just got the diagnosis? Start with one small thing you can do together today',
  "There's a lot to sort out after that appointment. A simple puzzle you both sit down with doesn't have to be one of the hard parts. Find the one TOGETHER spelled right, then print a free large print page for later."],
 [G(1435,37232,'ai_noi_dau','Người chán sách đố chữ cũ và không đủ kiên nhẫn đọc sách dài'),'MATINEE','Drive-In Matinee','retro drive-in movie theater',FALL,'drive-in-word-search',
  'Bored of the same old puzzle books? This one takes 7 seconds',
  "No 200-page slog. One word, 36 tiles, 7 seconds on the clock. If you want a little more after that, there's a free drive-in word search waiting, big print and all."],
 [G(1435,37200,'ai_tinh_huong','Giải trí yên tĩnh không màn hình'),'WARBLER','Porch Birds','porch rocking chair evening',NOS,'birds-word-search',
  'Want a quiet evening off screens? Print this and take it to the porch',
  "Find the one WARBLER spelled right, then put the phone down. The free birds word search prints on one page, pencil and coffee not included.", true],
 [G(1438,39426,'ai_mong_muon','Gia đình muốn làm dịu kích động, hung hăng của người bệnh'),'HOLLYHOCK','Calm Garden','garden flowers soft light',NOS,'gardening-word-search',
  'Restless afternoons with Mom? Try a slow, quiet puzzle side by side',
  "Some families find a calm, simple task helps when late afternoon gets tense. No pressure and no need to race the timer. Print the gardening page, sit next to her, and look for the words together."],
 [G(1435,37285,'ai_noi_dau','Người bị táo bón hay thèm ăn'),'CUPCAKES','Cupcakes','cupcakes on kitchen counter',FALL,'baking-word-search',
  'Snack craving at 9 pm? Keep your hands busy for 7 seconds first',
  "Before you open the pantry again, find the one CUPCAKES spelled right. Still hungry? Print the free baking word search and give the craving ten more minutes."],
 [G(1435,37189,'ai_chan_dung','Người cao tuổi trong gia đình cần chăm sóc'),'GRANDMA','Grandma','grandmother and granddaughter smiling',NOS,'large-print-word-search',
  'Caring for an older parent at home? Here is a 7-second break you can share',
  "Caregiving days are long. This one's short. Play it together, see who spots the right GRANDMA first, then print a free large print page for the quiet part of the afternoon.", true],
 [G(1435,37190,'ai_cach_giai','Sách đố tổng hợp crossword và word search trong một cuốn'),'CROSSWORD','Crossword Fans','newspaper crossword coffee pencil',BIB,'large-print-word-search',
  'Crossword fan? Bet you can spot the one real CROSSWORD in 7 seconds',
  "Crossword people tend to catch spelling slips fast. Prove it. If you like this, the free large print word search is a nice change of pace between your Sunday grids."],
 [G(1435,37192,'ai_tinh_huong','Đi đường dài bằng ô tô'),'ROADTRIP','Road Trip','road trip car window highway',FALL,'national-parks-word-search',
  "Long drive ahead? Hand this to whoever's riding shotgun",
  "Find the one ROADTRIP spelled right before the timer runs out. Then print the free national parks word search for the next few hundred miles. Big letters, easy to read in a moving car.", true],
 [G(1435,37197,'ai_noi_dau','Nghiện điện thoại và muốn sống chậm'),'UNPLUG','Unplug','notebook pencil coffee table',NOS,'gardening-word-search',
  'Phone screen time creeping up? Swap 10 minutes for a pencil tonight',
  "Ironic, we know. Find the one UNPLUG spelled right, then print the free gardening word search and leave the phone in the other room for a bit."],
 [G(1435,37199,'ai_tieu_chi','Chữ cỡ lớn, dễ đọc không cần kính'),'SPECTACLE','Large Print','reading glasses on wooden table',BIB,'large-print-word-search',
  'Can you read this without your glasses? Find the one real word in 7 seconds',
  "Our printable puzzles use big, bold letters so you're not hunting for your readers every time. Try this one first, then print a free page and see for yourself."],
 [G(1438,39406,'ai_mong_muon','Muốn người bệnh hết thu mình, kết nối xã hội và vui vẻ'),'JITTERBUG','Jitterbug','elderly man smiling record player',FALL,'rock-and-roll-word-search',
  'Has Dad gone quiet lately? Ask him about 1950s music over this puzzle',
  "Old songs get people talking. Find the one JITTERBUG spelled right together, then print the free rock and roll word search and ask which record he played to death."],
 [G(1438,39419,'ai_phan_doi','Người bệnh từ chối tham gia, không tự bắt đầu được, không làm theo hướng dẫn, dễ kích động'),'PUPPIES','Puppies','senior woman with dog',NOS,'pets-word-search',
  'Mom says no to every activity? Try one that takes 7 seconds and no rules',
  "No instructions to follow, nothing to set up. Just point at the screen and ask which PUPPIES looks right. If she's in, the free pets word search is big print and easy to start."],
 [G(1438,39424,'ai_cu_hich','Nhân viên chăm sóc mới khai trương chương trình hoạt động cho người bệnh trí nhớ'),'TEAMWORK','Teamwork','caregiver with senior group activity',BIB,'large-print-word-search',
  'Starting a memory care activity program? Day 1 can be this simple',
  "Put this 7-second hunt on the screen, let the group call out the answer, then hand out the free large print word search. Answer key's included, so you don't need to prep anything."],
 [G(1438,39401,'ai_chan_dung','Nhân viên tổ chức hoạt động tại khu memory care / viện dưỡng lão'),'HARMONICA','Harmonica','nursing home music activity',NOS,'musical-instruments-word-search',
  'Running activities in memory care? Put this on the big screen at 10 am',
  "One word, 36 tiles, a 7-second countdown the whole room can shout along to. Follow it with the free musical instruments word search, and ask who used to play something."],
 [G(1435,37193,'ai_tinh_huong','Hồi phục bệnh tật và nghỉ ngơi'),'SUNSHINE','Sunshine','cozy bed tea blanket window',FALL,'weather-word-search',
  'Stuck in bed while you recover? Here is an easy 7-second puzzle',
  "Nothing heavy, nothing long. Find the one SUNSHINE spelled right, then print the free weather word search for the next slow afternoon on the couch.", true],
];
const out = L.map(([goc, dich, goi, truy, mau, trang, title, than, gum], k) => {
  const r = rngHat(goc.id + 91), o = Array.from({ length: 36 }, () => saiMot(dich, r)), cho = Math.floor(r() * 36); o[cho] = dich;
  if (o.filter((x) => x === dich).length !== 1) throw new Error(dich);
  const link = P(trang), ten = trang.replace(/-word-search$/, '').replace(/-/g, ' ');
  const description = `${than}\nFree large print ${ten === 'large print' ? '' : ten + ' '}word search to print, with the answer key: ${link}${gum ? `\n100 more puzzles in the Nostalgic Word Search & Memory Book: ${GUM}` : ''}`;
  return { slug: `goc-${goc.id}-${dich.toLowerCase()}`, chu_de: goi, de: { dich, o, cho, goi, mau, truy, moc: (title.match(/^[^?!.]*[?!.]/) ?? [title])[0] }, dang: { title, description, link, book: 'nostalgia', words: [dich], nhom: 'Góc spy', goc } };
});
for (const x of out) { const t = `${x.dang.title}\n${x.dang.description}`; if (/[—–]/.test(t)) throw new Error('gach ' + x.slug); if (x.dang.title.length < 25 || !/[?!]|\d/.test(x.dang.title)) throw new Error('moc ' + x.slug); }
process.stdout.write(JSON.stringify(out));
