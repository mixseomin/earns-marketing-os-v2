// SỔ TÀI LIỆU NGÀNH cho mọi điểm chấm / luật / lỗi chặn (anh 13/11/2026: "các điểm chấm, luật… hãy kèm ref, link… đến càng nhiều tài liệu, kiến thức ngành
// càng tốt"). Mỗi link đã MỞ THỬ được (HTTP 200) ngày 13/11/2026 — trang chặn máy (403: silmanjamespress, britannica, masterclass, hitchcock.zone…) hay 404
// không đưa vào. Thêm link mới: mở thử trước, ghi ngày. Thuần (lưới + máy chủ).
export type TaiLieu = { ten: string; url: string; ghi?: string };
export const TL: Record<string, TaiLieu> = {
  murch_6: { ten: 'Murch — Rule of Six (No Film School)', url: 'https://nofilmschool.com/2016/11/6-rules-good-cutting-according-oscar-winning-editor-walter-murch', ghi: 'cảm xúc 51 · truyện 23 · nhịp 10 · eye trace 7 · mặt phẳng 2D 5 · không gian 3D 4' },
  murch_ut: { ten: "Murch's Rule of Six (UT Austin RTF 318)", url: 'https://wikis.utexas.edu/display/rtf318/Murch%27s+Rule+of+Six' },
  murch_sach: { ten: 'In the Blink of an Eye (Wikipedia)', url: 'https://en.wikipedia.org/wiki/In_the_Blink_of_an_Eye_(book)' },
  murch: { ten: 'Walter Murch (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Walter_Murch' },
  branigan_pov: { ten: 'Branigan — POV structure, glance / object (Ergo, Cumming et al.)', url: 'https://journals.publishing.umich.edu/ergo/article/id/1124' },
  pov_shot: { ten: 'Point of view shot (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Point_of_view_shot' },
  eyeline: { ten: 'Eyeline match (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Eyeline_match' },
  kuleshov: { ten: 'Kuleshov effect (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Kuleshov_effect' },
  shot_reverse: { ten: 'Shot reverse shot (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Shot_reverse_shot' },
  ots: { ten: 'Over the shoulder shot (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Over_the_shoulder_shot' },
  close_up: { ten: 'Close-up (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Close-up' },
  reaction: { ten: 'Reaction shot (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Reaction_shot' },
  truc_180: { ten: '180-degree rule (Wikipedia)', url: 'https://en.wikipedia.org/wiki/180-degree_rule' },
  truc_laf: { ten: 'The 180 Degree Rule, Looking Space and Eyeline Match (Learn About Film)', url: 'https://www.learnaboutfilm.com/?p=1666' },
  lien_mach: { ten: 'Continuity editing (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Continuity_editing' },
  master: { ten: 'Master shot (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Master_shot' },
  thiet_lap: { ten: 'Establishing shot (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Establishing_shot' },
  cutaway: { ten: 'Cutaway (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Cutaway_(filmmaking)' },
  long_take: { ten: 'Long take (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Long_take' },
  asl: { ten: 'Average shot length (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Average_shot_length' },
  bordwell_asl: { ten: 'Bordwell — phỏng vấn Artforum (ASL phim nay 3–5 s; "Intensified Continuity", Film Quarterly 55/3, 2002)', url: 'https://www.artforum.com/features/david-bordwell-2-195241/' },
  toc_noi: { ten: 'Speech tempo (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Speech_tempo' },
  toc_viet: { ten: 'CNRS — tốc độ nói 17 ngôn ngữ (Pellegrino): tiếng Việt ~5,25 âm tiết/giây', url: 'https://news.cnrs.fr/ZwS' },
  chekhov: { ten: "Chekhov's gun (Wikipedia)", url: 'https://en.wikipedia.org/wiki/Chekhov%27s_gun' },
  chekhov_nfs: { ten: "What Is Chekhov's Gun? (No Film School)", url: 'https://nofilmschool.com/what-is-chekhovs-gun' },
  setup_payoff: { ten: 'How to Put Setups and Payoffs in Your Scripts (Final Draft)', url: 'https://www.finaldraft.com/blog/how-to-put-setups-and-payoffs-in-your-scripts' },
  bo_ba: { ten: 'Rule of three (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Rule_of_three_(writing)' },
  hitchcock_bom: { ten: 'Hitchcock & Truffaut — suspense vs surprise, quả bom dưới bàn (No Film School)', url: 'https://nofilmschool.com/alfred-hitchcock-and-francois-truffaut-explain-surprise-vs-suspense' },
  hitchcock_truffaut: { ten: 'Hitchcock/Truffaut (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Hitchcock/Truffaut' },
  trotreu: { ten: 'Dramatic irony (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Irony#Dramatic_irony' },
  chaplin_long: { ten: 'Chaplin — "tragedy in close-up, comedy in long shot" (Quote Investigator)', url: 'https://quoteinvestigator.com/2017/02/05/comedy/' },
  slapstick: { ten: 'Slapstick (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Slapstick' },
  keaton_mubi: { ten: 'Keaton — Steamboat Bill, Jr.: khung rộng, không cắt (MUBI Notebook)', url: 'https://mubi.com/en/notebook/posts/the-action-scene-the-systems-logic-of-steamboat-bill-jr' },
  carroll_keaton: { ten: 'Noël Carroll — Comedy Incarnate: Buster Keaton (PDF)', url: 'https://is.muni.cz/el/phil/jaro2017/FAVz064/um/Carroll_Noel_Comedy_Incarnate_2007.pdf?lang=en' },
  comic_timing: { ten: 'Comic timing (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Comic_timing' },
  ngat_humor: { ten: 'Attardo et al. — tạm dừng trước câu chốt (Humor 2011, kết quả ngược: không thấy quy luật)', url: 'https://www.degruyterbrill.com/document/doi/10.1515/HUMR.2011.015/pdf?lang=en' },
  deadpan: { ten: 'Deadpan (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Deadpan' },
  double_take: { ten: 'Double take (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Double_take' },
  slow_burn: { ten: 'Edgar Kennedy — "Slow Burn" (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Edgar_Kennedy' },
  parody: { ten: 'Parody (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Parody' },
};
/** Danh sách tài liệu theo khoá (bỏ khoá không có trong sổ). */
export const tl = (...k: string[]): TaiLieu[] => k.map((x) => TL[x]).filter((x): x is TaiLieu => !!x);
/** Tài liệu cho một câu lỗi cổng / liền mạch — đoán theo nội dung câu (mỗi câu cổng mang tên luật ở đầu). */
export function tlChoLoi(ly: string): TaiLieu[] {
  if (/người nói|NGƯỜI NÓI|nói mà không|thoại nằm trong toàn cảnh/i.test(ly)) return tl('shot_reverse', 'close_up', 'ots', 'kuleshov');
  if (/hướng máy chủ/.test(ly)) return tl('master', 'lien_mach', 'shot_reverse');
  if (/trục|180/.test(ly)) return tl('truc_180', 'truc_laf');
  if (/TỔNG THỂ/.test(ly)) return tl('master', 'thiet_lap');
  if (/NHÌN|THẤY|chuỗi chú ý|ánh mắt/.test(ly)) return tl('branigan_pov', 'pov_shot', 'eyeline');
  return tl('lien_mach');
}
/** Tài liệu cho sáu tiêu chí Murch. */
export const TL_MURCH: Record<string, TaiLieu[]> = {
  cam_xuc: tl('murch_6', 'close_up', 'reaction'), truyen: tl('murch_6', 'chekhov', 'branigan_pov'), nhip: tl('murch_6', 'asl', 'toc_noi', 'toc_viet'),
  eye_trace: tl('murch_6', 'murch_ut'), hai_chieu: tl('murch_6', 'truc_180'), ba_chieu: tl('murch_6', 'lien_mach'),
};
