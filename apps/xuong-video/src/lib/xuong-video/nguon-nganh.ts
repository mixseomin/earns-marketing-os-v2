// NGUỒN NGÀNH dùng chung cho mọi mô tả ngành (nganh-luat-dung.ts, nganh-ky-thuat-*.ts, dien-anh-them.ts): MỘT chỗ khai tên sách + người viết, MỘT hàm dựng
// mục — trước đây mỗi tệp tự khai lại và lệch nhau (Murch ghi 1995 / 2001 / không năm, Mascelli hai kiểu nháy, Bowen gộp nhầm hai cuốn).
// Chỉ ghi sách / tài liệu có thật; năm = lần in đầu.
import type { NganhKyThuat } from './dien-anh-nganh';

/** Mô tả ngành: ngành gọi là gì · đầu–cuối · làm thế nào · khi nào dùng · khán giả cảm gì · tránh gì · nguồn. */
export const moTaNganh = (ten_nganh: string, dau_cuoi: string, thuc_hien: string, dong_co: string, cam_xuc: string, tranh: string, nguon: string): NganhKyThuat =>
  ({ ten_nganh, dau_cuoi, thuc_hien, dong_co, cam_xuc, tranh, nguon });
/** Một mục của bảng NGANH (khoá '<nhom>.<key>' hoặc 'luat.<key>'). */
export const mucNganh = (...a: Parameters<typeof moTaNganh>): { nganh: NganhKyThuat } => ({ nganh: moTaNganh(...a) });

// ── Dựng phim ──
export const MURCH = 'Walter Murch — In the Blink of an Eye (1995)';
export const REISZ = 'Karel Reisz & Gavin Millar — The Technique of Film Editing';
export const DMYTRYK = 'Edward Dmytryk — On Film Editing (1984)';
export const GRAMMAR_EDIT = 'Roy Thompson & Christopher J. Bowen — Grammar of the Edit';
export const DANCYGER = 'Ken Dancyger — The Technique of Film and Video Editing';
// ── Quay / khung hình ──
export const MASCELLI = 'Joseph V. Mascelli — The Five C’s of Cinematography (1965)';
export const GRAMMAR_SHOT = 'Christopher J. Bowen — Grammar of the Shot';
export const ARIJON = 'Daniel Arijon — Grammar of the Film Language (1976)';
export const KATZ = 'Steven D. Katz — Film Directing Shot by Shot (1991)';
export const MERCADO = 'Gustavo Mercado — The Filmmaker’s Eye (2011)';
export const BORDWELL = 'David Bordwell & Kristin Thompson — Film Art: An Introduction';
export const BLOCK = 'Bruce Block — The Visual Story (2001)';
// ── Ánh sáng / màu ──
export const BROWN_LIGHT = 'Blain Brown — Motion Picture and Video Lighting';
export const BROWN_CINE = 'Blain Brown — Cinematography: Theory and Practice';
export const MALKIEWICZ = 'Kris Malkiewicz — Film Lighting';
export const VAN_HURKMAN = 'Alexis Van Hurkman — Color Correction Handbook';
export const BELLANTONI = 'Patti Bellantoni — If It’s Purple, Someone’s Gonna Die';
export const ASC = 'ASC — American Cinematographer Manual';
// ── Âm thanh / nhạc ──
export const CHION = 'Michel Chion — Audio-Vision: Sound on Screen (1994)';
export const SONNENSCHEIN = 'David Sonnenschein — Sound Design: The Expressive Power of Music, Voice and Sound Effects in Cinema (2001)';
export const HOLMAN = 'Tomlinson Holman — Sound for Film and Television';
export const AMENT = 'Vanessa Theme Ament — The Foley Grail';
export const GORBMAN = 'Claudia Gorbman — Unheard Melodies: Narrative Film Music (1987)';
export const KARLIN = 'Fred Karlin & Rayburn Wright — On the Track: A Guide to Contemporary Film Scoring';
// ── Kịch bản / kể chuyện ──
export const MCKEE = 'Robert McKee — Story (1997)';
export const TRUFFAUT = 'François Truffaut — Hitchcock/Truffaut (1966)';
// ── Diễn / hoạt hình ──
export const HOOKS = 'Ed Hooks — Acting for Animators';
export const ILLUSION = 'Frank Thomas & Ollie Johnston — The Illusion of Life';
// ── Khán giả / tâm lý xem phim ──
export const TAN = 'Ed S. Tan — Emotion and the Structure of Narrative Film (1996)';
export const SMITH = 'Murray Smith — Engaging Characters: Fiction, Emotion, and the Cinema (1995)';
export const STERNBERG = 'Meir Sternberg — Expositional Modes and Temporal Ordering in Fiction (1978), bộ ba tò mò · hồi hộp · bất ngờ';
export const BORDWELL_NARRATION = 'David Bordwell — Narration in the Fiction Film (1985), khán giả đặt giả thuyết';
export const CARROLL_HORROR = 'Noël Carroll — The Philosophy of Horror (1990)';
export const LOEWENSTEIN = 'George Loewenstein — The Psychology of Curiosity (1994), thuyết khoảng trống thông tin';
export const ZILLMANN = 'Dolf Zillmann — lý thuyết chuyển kích thích (excitation transfer), nghiên cứu hồi hộp và giải toả';
export const ARISTOTLE = 'Aristotle — Poetics (catharsis)';
