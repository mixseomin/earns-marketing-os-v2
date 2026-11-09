// SINH TỰ ĐỘNG bởi scripts/sync-reddit-subs.mjs — đừng sửa tay, chạy lại script.
// Nguồn: about.json + link_flair_v2.json + trang soạn bài của chính sub (2026-08-13).
// submissionType: 'self' = sub CHỈ nhận bài chữ (link/ảnh/poll đăng không được) · 'link' · 'any'.

export type RedditSub = {
  members: number; submissionType: 'self' | 'link' | 'any';
  allowImages: boolean; allowPolls: boolean; allowGalleries: boolean;
  flairRequired: boolean; /** sub có cho người đăng tự chọn flair không (r/army: mod gắn) */ flairPickable: boolean;
  flairs: string[]; note: string;
};

export const REDDIT_SUBS: Record<string, RedditSub> = {
  'MilitaryFinance': {"members":67175,"submissionType":"self","allowImages":false,"allowPolls":false,"allowGalleries":false,"flairRequired":false,"flairPickable":true,"flairs":["Question","PSA","Success Story","Meta/Mod Post","Army","Air Force","Navy","USMC","Coast Guard","National Guard","Reserves"],"note":"No Blog spam, credit card referrals links, or self-promotion. New posts that don't follow this will be removed."},
  'MilitaryFAQ': {"members":71217,"submissionType":"self","allowImages":false,"allowPolls":false,"allowGalleries":false,"flairRequired":true,"flairPickable":true,"flairs":["I don't know what flair to use","Enlisting","Joining w/Med issue","Officer Accessions","ASVAB/PiCAT","Which Branch?","Should I Join?","Joining w/ELS","BCT/BMT/Boot camp","AIT/Tech School/A School","MOS/AFSC/Rate Specific","SOF","Reserve\\Guard","In Service College","Branch-Specific","Post/Base/Billet-Specific","Clearance","Officer","Fitness Prep","PS","Post-ETS/EAS","Service Benefits","In Service Medical","Service Schools/Courses/Classes","🌍Non-US"],"note":"Use the search function before posting a question. Your query may have already been answered."},
  'AirForce': {"members":293087,"submissionType":"any","allowImages":true,"allowPolls":true,"allowGalleries":true,"flairRequired":true,"flairPickable":true,"flairs":["Question","Article","Discussion","Video","Meme","POSITIVITY!","Image/Photo","Rant","Satire","🐈 PIZZA CAT 🐈"],"note":"STOP!!! READ THE RULES BEFORE POSTING"},
  'army': {"members":368710,"submissionType":"any","allowImages":true,"allowPolls":false,"allowGalleries":true,"flairRequired":false,"flairPickable":false,"flairs":[],"note":"Read the rules. Thank you. If your post is a n00b question, a frequently asked question, is in regards joining the Army, or is a question better suited for a Recruiter or Drill Sergeant, use the correct thread from the s"},
  'Veterans': {"members":178031,"submissionType":"any","allowImages":true,"allowPolls":false,"allowGalleries":true,"flairRequired":true,"flairPickable":true,"flairs":["Question/Advice","Article/News","Discussion","GI Bill/Education","VR&amp;E - Voc Rehab Veteran Readiness","Employment","VA Home Loan Question"],"note":"We use Crowd Control to screen Posts and Comments from users new to this subreddit. If you make a post and get a prompt it was removed - Do Not make a 2nd Post or Delete your post - instead send the Moderators a ModMail "},
  'personalfinance': {"members":21801969,"submissionType":"self","allowImages":false,"allowPolls":false,"allowGalleries":false,"flairRequired":false,"flairPickable":true,"flairs":["Auto","Budgeting","Credit","Debt","Employment","Housing","Insurance","Investing","Planning","Retirement","Saving","Taxes","Other"],"note":"**Before submitting a post to /r/personalfinance:** [Check the PF Wiki](http://www.reddit.com/r/personalfinance/wiki/index) for helpful guides, especially our [\"How to handle $\"](http://www.reddit.com/r/personalfinance/w"},
};

/** 'r/AirForce' hay 'https://reddit.com/r/AirForce' → khoá trong REDDIT_SUBS. */
export const subOf = (place: string) => {
  const m = place.match(/r\/([A-Za-z0-9_]+)/);
  return m?.[1] ? REDDIT_SUBS[m[1]] ?? null : null;
};
export const subName = (place: string) => place.match(/r\/([A-Za-z0-9_]+)/)?.[1] ?? '';
