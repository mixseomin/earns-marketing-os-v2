// Khuôn KẾ HOẠCH cho việc làm tại chỗ (comment / tương tác).
//
// Vì sao phải có khuôn thay vì để viết văn xuôi: dòng "tìm bài thế nào" viết tự do thì lần nào
// cũng có chỗ nhét chủ đề vào ("bài X có người đang hỏi về Y") — mà giờ lên lịch thì chưa ai biết
// trong nhóm có bài gì, viết ra là bịa và runner đi tìm một cuộc trò chuyện không tồn tại. Đã cấm
// trong prompt vẫn lọt, kể cả khi người viết là mình. Nên chặn bằng cấu trúc:
//
//   TÌM BÀI  = CODE sinh, chọn từ danh sách bộ lọc CƠ HỌC dưới đây (tuổi bài · độ đông · còn chỗ
//              nói hay không). Không có ô trống nào để điền chủ đề.
//   NÓI HƯỚNG = thứ MÌNH có sẵn (địa hạt mình chắc tay) — chỗ này mới là khác nhau giữa các card.
//   RANH GIỚI = cái không được làm ở nhóm đó.
//
// Chủ đề của lượt comment do bước CHẠY quyết định (pick-thread.ts đọc bài thật rồi mới chọn).

/** Bộ lọc cơ học — mô tả DẤU HIỆU của một bài đáng vào, không mô tả nội dung bài. */
export const PLAN_FILTERS = {
  fresh: 'bài đăng trong ngày (bài cũ thì comment vào không ai đọc)',
  freshFast: 'bài đăng trong vài giờ — nhóm chạy nhanh, quá nửa ngày là trôi',
  room: 'phần bình luận còn thưa, chen vào còn người đọc',
  unanswered: 'đang có câu hỏi mà các trả lời hiện tại chỉ đoán chừng, chưa ai đưa số/dẫn nguồn',
  mine: 'câu hỏi rơi vào đúng địa hạt ở dòng dưới — không thì bỏ lượt, đừng comment lấy lệ',
} as const;
export type PlanFilterKey = keyof typeof PLAN_FILTERS;

/** Bộ lọc mặc định theo vai (habitat-role): nhóm chạy nhanh cần bài mới hơn. */
export const DEFAULT_FILTERS: PlanFilterKey[] = ['fresh', 'room', 'unanswered', 'mine'];
export const FAST_FEED_FILTERS: PlanFilterKey[] = ['freshFast', 'room', 'unanswered', 'mine'];

const NOTE = '(Giờ này chưa ai biết trong nhóm đang có bài gì — đến giờ vào đọc, chọn bài rồi mới viết.)';

/** Dựng thân card kế hoạch. `domain` = mình có sẵn thông tin/kinh nghiệm gì đáng giá. */
export function buildPlanBody(opts: {
  filters?: PlanFilterKey[];
  domain: string;
  edges: string;
  /** Việc tương tác (like) — dòng tìm bài khác: ưu tiên bài ÍT tương tác. */
  engage?: boolean;
}): string {
  if (opts.engage) {
    return [
      'TÌM BÀI: bài đăng trong 24h và ĐANG ít tương tác (≤30) — bài đã đông thì tên mình chìm trong danh sách, thả cũng như không',
      `NÓI HƯỚNG: ${opts.domain}`,
      `RANH GIỚI: ${opts.edges}`,
      NOTE,
    ].join('\n');
  }
  const keys = opts.filters?.length ? opts.filters : DEFAULT_FILTERS;
  return [
    `TÌM BÀI: ${keys.map((k) => PLAN_FILTERS[k]).join(' · ')}`,
    `NÓI HƯỚNG: ${opts.domain}`,
    `RANH GIỚI: ${opts.edges}`,
    NOTE,
  ].join('\n');
}
