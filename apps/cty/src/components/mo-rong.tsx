'use client';
// DANH SÁCH ĐẦU VIỆC thu gọn / mở tại chỗ (góp ý #1362 "3 việc máy khi bấm vào thì mở ra luôn (toggle), có option xem chi tiết danh sách riêng"):
// `dau` luôn hiện, `them` hiện khi bấm "▸ N việc máy"; "chi tiết ↗" mở ngăn việc máy (lịch · lần cuối · kết quả · nhật ký). Các dòng là cùng
// một lưới .cty-dn-viec nên mở ra vẫn thẳng cột với dòng đầu.
import { useState, type ReactNode } from 'react';
import Link from 'next/link';

export function MoRong({ dau, them, so, chiTiet, ghiChu }: { dau: ReactNode; them: ReactNode; so: number; chiTiet: string; ghiChu?: ReactNode }) {
  const [mo, setMo] = useState(false);
  return (
    <>
      <ul className="cty-dn-viec">{dau}{mo && them}</ul>
      <div className="cty-mo-rong">
        {so > 0 && <button type="button" className="cty-mo-rong-nut" aria-expanded={mo} onClick={() => setMo((x) => !x)}>{mo ? '▾ thu gọn' : `▸ thêm ${so} việc máy`}</button>}
        <Link href={chiTiet} title="Danh sách đầy đủ: lịch · lần chạy cuối · kết quả · nhật ký">chi tiết ↗</Link>{ghiChu}
      </div>
    </>
  );
}
