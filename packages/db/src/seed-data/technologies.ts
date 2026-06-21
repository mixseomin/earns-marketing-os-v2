// Platform technology engines seed data.
// signup_fields = default registration fields required by this engine type.
// Platforms using this technology inherit these fields; platform.signup_fields
// adds overrides (same key = platform wins, new key = appended).

export interface TechSignupField {
  key: string;
  label: string;
  type: 'text' | 'date' | 'select' | 'boolean' | 'phone' | 'email' | 'captcha' | 'info';
  required: boolean;
  notes?: string;
  placeholder?: string;
  options?: string[];
}

export interface TechnologySeed {
  key: string;
  label: string;
  description: string;
  signupFields: TechSignupField[];
  notes?: string;
}

export const TECHNOLOGIES: TechnologySeed[] = [
  {
    key: 'vbulletin',
    label: 'vBulletin',
    description: 'Phần mềm forum PHP phổ biến, thường dùng bởi các cộng đồng lớn (automotive, gaming, astrology).',
    signupFields: [
      { key: 'username', label: 'Username', type: 'text', required: true, notes: 'Thường 3-20 ký tự, không dấu cách. Một số diễn đàn ban username trùng với email.' },
      { key: 'email', label: 'Email', type: 'email', required: true },
      { key: 'password', label: 'Password', type: 'text', required: true, placeholder: 'Min 6-8 ký tự, thường không phức tạp' },
      { key: 'dob', label: 'Date of Birth', type: 'date', required: false, notes: 'Một số vBulletin yêu cầu 18+. Dùng DOB hợp lệ — tránh ngày 1/1 vì dễ detect.' },
      { key: 'captcha', label: 'Captcha', type: 'captcha', required: true, notes: 'Image captcha hoặc question-answer tùy cấu hình. Thường dễ — solve thủ công.' },
      { key: 'security_question', label: 'Security question', type: 'text', required: false, notes: 'Một số instance thêm custom Q&A để chặn bot.' },
    ],
    notes: 'Email verify thường bắt buộc. Một số diễn đàn có cooldown 24-72h trước khi được post. Activation email có thể vào spam.',
  },
  {
    key: 'xenforo',
    label: 'XenForo',
    description: 'Forum engine hiện đại (PHP), phổ biến trong communities tech, gaming, finance. Nhiều tính năng anti-bot tốt hơn vBulletin.',
    signupFields: [
      { key: 'username', label: 'Username', type: 'text', required: true, notes: 'Thường 3-25 ký tự. Có thể không cho dùng số/ký tự đặc biệt tuỳ cấu hình.' },
      { key: 'email', label: 'Email', type: 'email', required: true },
      { key: 'password', label: 'Password', type: 'text', required: true },
      { key: 'dob', label: 'Date of Birth', type: 'date', required: false, notes: 'Không bắt buộc mặc định nhưng nhiều site bật. Dùng tuổi 25-45.' },
      { key: 'captcha', label: 'Captcha', type: 'captcha', required: true, notes: 'reCAPTCHA v2 phổ biến nhất. Một số dùng hCaptcha hoặc custom question.' },
      { key: 'custom_fields', label: 'Custom profile fields', type: 'info', required: false, notes: 'XenForo hỗ trợ admin thêm custom fields bất kỳ — check trang signup thực tế.' },
    ],
    notes: 'XenForo có rate limiting nghiêm — tránh đăng ký quá nhanh từ cùng IP. Email verify bắt buộc. Một số instance dùng StopForumSpam blacklist — cần email sạch.',
  },
  {
    key: 'phpbb',
    label: 'phpBB',
    description: 'Forum engine open-source lâu đời nhất. Vẫn phổ biến ở các community EU, ngôn ngữ non-English.',
    signupFields: [
      { key: 'username', label: 'Username', type: 'text', required: true },
      { key: 'email', label: 'Email', type: 'email', required: true },
      { key: 'password', label: 'Password', type: 'text', required: true },
      { key: 'captcha', label: 'Captcha', type: 'captcha', required: true, notes: 'Varies: image captcha, Q&A, hoặc reCAPTCHA tuỳ extension cài.' },
      { key: 'timezone', label: 'Timezone', type: 'select', required: false, notes: 'phpBB thường hỏi timezone khi setup profile.' },
    ],
    notes: 'Thường có admin approval thay vì tự động — có thể mất 1-3 ngày. Email từ phpBB thường vào spam. Dùng email mới, không dùng throwaway nổi tiếng.',
  },
  {
    key: 'discourse',
    label: 'Discourse',
    description: 'Platform thảo luận hiện đại (Ruby/React). Phổ biến trong tech communities: Hetzner, Tailscale, Rust, nhiều SaaS khác.',
    signupFields: [
      { key: 'username', label: 'Username', type: 'text', required: true, notes: 'Lowercase, không dấu cách, tối thiểu 3 ký tự. Username unique across instance.' },
      { key: 'email', label: 'Email', type: 'email', required: true, notes: 'Cần email thật — Discourse gửi verify link và hay gửi digests.' },
      { key: 'full_name', label: 'Full name', type: 'text', required: false, notes: 'Optional ở nhiều instance, required ở một số.' },
      { key: 'captcha', label: 'Captcha', type: 'captcha', required: false, notes: 'Thường không có captcha nhưng có honeypot + rate limit. Đăng ký quá nhanh sẽ bị shadow-ban.' },
    ],
    notes: 'Trust Level system: TL0 (mới) bị giới hạn nặng — reply only, không được post link, không được DM. Phải đọc bài và like mới lên TL1 (thường 1-2 ngày). Dùng email provider uy tín (Gmail/Outlook), không throwaway.',
  },
  {
    key: 'wordpress',
    label: 'WordPress (core registration)',
    description: 'WordPress CMS core. Đăng ký = WP-core registration, CHUNG cho mọi forum-plugin chạy trên WP → signup luôn scope = wordpress (khỏi nhân bản template theo plugin). Forum/composer = scope theo plugin riêng (bbpress/buddypress/wpforo).',
    signupFields: [
      { key: 'username', label: 'Username', type: 'text', required: true },
      { key: 'email', label: 'Email', type: 'email', required: true },
      { key: 'first_name', label: 'First name', type: 'text', required: false },
      { key: 'last_name', label: 'Last name', type: 'text', required: false },
      { key: 'captcha', label: 'Captcha', type: 'captcha', required: false, notes: 'Tùy plugin — có thể dùng CF Turnstile, reCAPTCHA, hoặc không có.' },
    ],
    notes: 'WordPress registration thường đơn giản nhất. Nhiều site send password qua email (không cho chọn password khi đăng ký).',
  },
  {
    key: 'bbpress',
    label: 'bbPress (WP forum)',
    description: 'Forum plugin nhẹ trên WordPress. Composer/post/member DOM = .bbp-*. Đăng ký qua WP-core (signup dồn về wordpress).',
    signupFields: [
      { key: 'username', label: 'Username', type: 'text', required: true },
      { key: 'email', label: 'Email', type: 'email', required: true },
      { key: 'captcha', label: 'Captcha', type: 'captcha', required: false, notes: 'Tùy plugin anti-spam.' },
    ],
    notes: 'Đăng ký qua WordPress core — chỉ forum/composer selectors là riêng bbPress.',
  },
  {
    key: 'buddypress',
    label: 'BuddyPress (WP community)',
    description: 'Community/social plugin trên WordPress (profiles/activity/groups). DOM = #buddypress / .bp-*. Đăng ký qua WP-core.',
    signupFields: [
      { key: 'username', label: 'Username', type: 'text', required: true },
      { key: 'email', label: 'Email', type: 'email', required: true },
      { key: 'display_name', label: 'Display name', type: 'text', required: false },
      { key: 'captcha', label: 'Captcha', type: 'captcha', required: false },
    ],
    notes: 'BuddyPress mở rộng profile/activity; đăng ký vẫn WP-core.',
  },
  {
    key: 'wpforo',
    label: 'wpForo (WP forum)',
    description: 'Forum plugin full-featured trên WordPress. DOM = .wpforo / #wpforo. Đăng ký qua WP-core.',
    signupFields: [
      { key: 'username', label: 'Username', type: 'text', required: true },
      { key: 'email', label: 'Email', type: 'email', required: true },
      { key: 'captcha', label: 'Captcha', type: 'captcha', required: false },
    ],
    notes: 'Đăng ký qua WordPress core — forum/composer selectors riêng wpForo.',
  },
  {
    key: 'invisionpower',
    label: 'Invision Community (IPS)',
    description: 'Forum/community platform thương mại cạnh tranh với XenForo. Phổ biến ở automotive, sports, finance communities lớn.',
    signupFields: [
      { key: 'username', label: 'Display name', type: 'text', required: true, notes: 'IPS gọi là "display name", có thể khác với login username.' },
      { key: 'email', label: 'Email', type: 'email', required: true },
      { key: 'password', label: 'Password', type: 'text', required: true, notes: 'Yêu cầu strong password ở nhiều instance: uppercase + number + symbol.' },
      { key: 'dob', label: 'Date of Birth', type: 'date', required: false, notes: 'Thường optional nhưng một số gate content theo tuổi.' },
      { key: 'captcha', label: 'Captcha', type: 'captcha', required: true, notes: 'reCAPTCHA v2 hoặc v3. Một số dùng KeyCAPTCHA.' },
      { key: 'security_question', label: 'Security question', type: 'text', required: false },
    ],
    notes: 'IPS có native spam filter tích hợp — email provider uy tín quan trọng. Thường có cooldown posting cho new members.',
  },
  {
    key: 'mybb',
    label: 'MyBB',
    description: 'Forum engine PHP open-source, nhẹ hơn phpBB. Phổ biến ở gaming, warez, niche communities.',
    signupFields: [
      { key: 'username', label: 'Username', type: 'text', required: true },
      { key: 'email', label: 'Email', type: 'email', required: true },
      { key: 'password', label: 'Password', type: 'text', required: true },
      { key: 'captcha', label: 'Captcha', type: 'captcha', required: true, notes: 'Thường image captcha đơn giản hoặc math question.' },
      { key: 'referrer', label: 'Referrer', type: 'text', required: false, notes: 'Một số MyBB instance hỏi "How did you find us?" — điền natural answer.' },
    ],
  },
  {
    key: 'custom',
    label: 'Custom / Unknown',
    description: 'Platform dùng engine tự phát triển hoặc chưa xác định được. Cần check trang signup thực tế.',
    signupFields: [
      { key: 'username', label: 'Username', type: 'text', required: true },
      { key: 'email', label: 'Email', type: 'email', required: true },
      { key: 'password', label: 'Password', type: 'text', required: true },
      { key: 'captcha', label: 'Captcha', type: 'captcha', required: false, notes: 'Kiểm tra trang signup thực tế.' },
    ],
    notes: 'Điền thêm các fields thực tế khi đã xem trang signup.',
  },
];
