// CHỮ VỪA KHUNG (05/11/2026): câu trích NGUYÊN VĂN site (luật nguồn) không được cắt bớt → câu dài thì thu cỡ chữ tới khi đáy khối chữ nằm trong khung.
// Dùng chung mọi trang shot-code: vuaKhung(el, day) sau khi gán innerHTML; nhớ cỡ đã tính theo nội dung nên __seek gọi mỗi khung hình vẫn rẻ và hình đứng yên.
(function () {
  const nho = new Map();
  window.vuaKhung = function (el, day, toiThieu = 30) {
    const khoa = el.id + '|' + el.innerHTML; if (!el.dataset.co0) el.dataset.co0 = parseFloat(getComputedStyle(el).fontSize);
    if (nho.has(khoa)) { el.style.fontSize = nho.get(khoa) + 'px'; return; }
    let co = Number(el.dataset.co0); el.style.fontSize = co + 'px';
    while (co > toiThieu && el.getBoundingClientRect().bottom > day) { co -= 2; el.style.fontSize = co + 'px'; }
    nho.set(khoa, co);
  };
  // MẢNH CHỮ (chu-man.mjs › tachCanh): câu dài hiện thành nhiều mảnh nối nhau trong cùng cảnh — chia theo lượng chữ, mờ vào / ra giữa các mảnh
  const bo = (x) => String(x || '').replace(/<[^>]+>/g, '').trim();
  window.manhTai = function (q, t) {
    const ds = q.manh || [q.chu], n = ds.map((m) => bo(m).length || 1), tong = n.reduce((a, b) => a + b, 0); let u = q.tu;
    for (let i = 0; i < ds.length; i++) { const d = ((q.den - q.tu) * n[i]) / tong;
      if (t < u + d || i === ds.length - 1) { const vao = i ? Math.min(1, (t - u) / 0.25) : 1, ra = i < ds.length - 1 ? Math.min(1, (u + d - t) / 0.2) : 1;
        return { chu: ds[i], mo: Math.max(0, Math.min(vao, ra)) }; }
      u += d; }
  };
})();
