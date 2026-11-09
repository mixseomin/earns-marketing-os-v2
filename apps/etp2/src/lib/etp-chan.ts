// LÝ DO MÁY CHẤM CHẶN — đọc chuỗi etp.cham_cong.chan_boi ("meta.bao_luc 2, afs.cta 4" / "chờ người duyệt (5 điểm: meta.ngon_tu 5)") thành danh sách
// { tên tiêu chí tiếng Việt (etp.tieu_chi — một nguồn với máy chấm), nhóm, điểm }, điểm thấp (nặng) trước (anh 29/10/2026 "trình bày lại cho dễ hiểu").
// MỘT chỗ: bảng soát creative (etp-view) và tab Sản xuất (etp-dong, #1519) cùng gọi.
export type TieuChi = { nhom: string; ma: string; ten: string; mo_ta: string };
export const lyDoChan = (chan: string | null | undefined, tc: TieuChi[]) => {
  const ds = [...(chan ?? '').matchAll(/(meta|afs)\.(\w+)\s+(\d+)/g)].map(([, nhom, ma, d]) => ({ nhom: nhom!, ten: tc.find((t) => t.nhom === nhom && t.ma === ma)?.ten ?? ma!.replace(/_/g, ' '), diem: Number(d) }));
  return { ds: ds.sort((a, b) => a.diem - b.diem), cho: /chờ người duyệt/.test(chan ?? '') };
};
export const chuChan = (chan: string | null | undefined, tc: TieuChi[]) => { const x = lyDoChan(chan, tc); return x.ds.length ? `${x.cho ? 'chờ người duyệt — ' : 'bị chặn: '}${x.ds.map((d) => `${d.ten} ${d.diem}/10 (${d.nhom === 'afs' ? 'AFS' : 'Meta'})`).join(' · ')}` : chan ?? ''; };
