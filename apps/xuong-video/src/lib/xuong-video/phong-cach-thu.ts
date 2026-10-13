// Các HƯỚNG PHONG CÁCH HÌNH để thử cho một phim (scripts/thu-phong-cach.mts sinh keyframe thử; nhan-ban-phim-thu.mts dựng phim thử
// theo một hướng để bấm sinh video trong studio). Câu phong cách nối vào prompt ảnh + video như kinh_thanh.phong_cach.
const KHONG_CHU = 'vertical 9:16 frame. Clean frames with no text, letters, numbers or logos anywhere.';
/** null = giữ phong cách hiện tại của phim (đối chứng). */
export const HUONG_THU: { key: string; ten: string; phong_cach: string | null }[] = [
  { key: 'hien_tai', ten: 'Sáp màu hiện tại', phong_cach: null },
  { key: 'sach_tranh_sap', ten: 'Sách tranh sáp màu (viền đậm, màu kín, nền ít chi tiết)', phong_cach:
    `Children's picture-book illustration drawn in wax crayon: every character has a bold dark crayon outline and is colored in solid, saturated crayon with no white paper showing inside the shapes; backgrounds are fully colored in rich saturated crayon (deep blue sky, deep green hills, warm earth), simple and uncluttered with only a few large shapes so the characters pop; crayon texture and paper grain visible only as surface texture, never as messy scribbles; consistent, appealing character design with big expressive eyes; warm, high-contrast, eye-catching colors that read clearly on a small phone screen; ${KHONG_CHU}` },
  { key: 'cat_giay', ten: 'Cắt giấy dán (paper cut-out)', phong_cach:
    `Handmade paper cut-out collage look: characters and scenery built from layered cut and torn colored construction paper with visible paper fibers and slightly uneven scissor edges, soft drop shadows between paper layers giving gentle depth, bold flat saturated colors, simple readable shapes, big expressive eyes, cozy storybook feel that reads clearly on a small phone screen; ${KHONG_CHU}` },
];
