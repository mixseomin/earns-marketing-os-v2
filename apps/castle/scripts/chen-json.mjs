// CHÈN TRƯỜNG VÀO TỆP JSON thụt 1 dấu cách mà KHÔNG dàn lại cả tệp (thuần, trả chuỗi mới) — dùng chung cho các công cụ máy ghi vào du-lieu/*.json
// (do-anh.mjs ghi số đo mặt tiền, sua-theo-dom20.mjs ghi chiều cao khối): thêm dòng ngay sau dòng mở khoá, trường cùng tên (một dòng) thì thay; khoá chưa có thì thêm khối cuối tệp.
export function chenTruong(txt, khoa, truong) {
  const dong = Object.entries(truong).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`), mo = ` ${JSON.stringify(khoa)}: {`;
  const ds = txt.split('\n'), i = ds.findIndex((d) => d === mo || d === mo + '}' || d === mo + '},');
  if (i >= 0) {
    if (ds[i] !== mo) { const het = ds[i].endsWith(','); ds.splice(i, 1, mo, ...dong.slice(0, -1), dong.at(-1).slice(0, -1), het ? ' },' : ' }'); return ds.join('\n'); } // khối rỗng "{}"
    let j = i + 1, sau = 1; for (; j < ds.length && sau; j++) for (const c of ds[j].replace(/"(\\.|[^"\\])*"/g, '')) sau += c === '{' ? 1 : c === '}' ? -1 : 0; // dòng đóng khối = j − 1
    const trong = ds.slice(i + 1, j - 1).filter((d) => !Object.keys(truong).some((k) => d.startsWith(`  ${JSON.stringify(k)}:`)));
    if (trong.length) trong[trong.length - 1] = trong.at(-1).replace(/,$/, ''); else dong[dong.length - 1] = dong.at(-1).slice(0, -1); // dòng CUỐI khối không có phẩy (trường bị thay có thể từng là dòng cuối)
    ds.splice(i + 1, j - 2 - i, ...dong, ...trong); return ds.join('\n');
  }
  const k = ds.lastIndexOf('}'); if (k < 1) throw new Error('tệp không kết bằng "}"');
  if (ds[k - 1].trim() !== '{' && !ds[k - 1].endsWith(',')) ds[k - 1] += ',';
  ds.splice(k, 0, mo, ...dong.slice(0, -1), dong.at(-1).slice(0, -1), ' }'); return ds.join('\n');
}
