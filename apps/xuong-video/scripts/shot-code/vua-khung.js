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
})();
