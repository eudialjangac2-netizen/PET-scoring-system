/* Trang tạo phiếu IELTS: đọc tab "IELTS" từ Google Sheet, chọn Mock + lớp, xem và tải PDF (2 trang/học sinh). */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var P, cur = null, sel = null, KEY = 'ielts-link';
  var store = { get: function (k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  var msg = function (t, c) { var m = $('#msg'); m.textContent = t || ''; m.className = 'msg ' + (c || ''); };
  var busy = function (t) { $('#busy').hidden = !t; if (t) $('#busyMsg').textContent = t; };
  var slug = function (s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, ''); };
  var mockNo = function () { return +$('#mock').value; };

  function load() {
    var link = $('#link').value.trim(); if (!link) { msg('Dán link Google Sheet trước.', 'err'); return; }
    store.set(KEY, link); msg('Đang đọc sheet…'); busy('Đang đọc Google Sheet…');
    window.IeltsData.fetchTab(link, 'IELTS').then(function (rows) { P = window.IeltsData.parse(rows); fill(); msg('Đã tải dữ liệu.', 'ok'); })
      .catch(function (e) { msg(e.message || String(e), 'err'); }).then(function () { busy(''); });
  }
  function fill() {
    var ms = Object.keys(P.mocks).map(Number).sort(function (a, b) { return a - b; }), D = window.IeltsData, keep = $('#mock').value;
    $('#mock').innerHTML = ms.map(function (n) { var full = P.mocks[n].filter(function (r) { return D.hasBands(r); }).length; return '<option value="' + n + '">Mock Test ' + n + ' (' + full + '/' + P.mocks[n].length + ' đủ điểm)</option>'; }).join('');
    var firstFull = ms.filter(function (n) { return P.mocks[n].some(D.hasBands); }).pop(); $('#mock').value = keep && ms.indexOf(+keep) >= 0 ? keep : (firstFull || ms[0]);
    $('#sec2').hidden = false; classes(); table();
  }
  function classes() {
    var set = {}; (P.mocks[mockNo()] || []).forEach(function (r) { set[r.cls] = 1; }); var keep = $('#cls').value;
    var list = Object.keys(set).sort(function (a, b) { return a.localeCompare(b, 'vi', { numeric: true }); });
    $('#cls').innerHTML = '<option value="">Tất cả lớp</option>' + list.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join(''); if (list.indexOf(keep) >= 0) $('#cls').value = keep;
  }
  function list() { var c = $('#cls').value; return (P.mocks[mockNo()] || []).filter(function (r) { return !c || r.cls === c; }); }
  function empties(r) { var n = (r.comment ? 0 : 1) + r.priorities.filter(function (x) { return !x; }).length; Object.keys(r.feedback).forEach(function (k) { ['s', 'w', 'a'].forEach(function (x) { if (!r.feedback[k][x]) n++; }); }); return n; }
  function status(r) {
    var D = window.IeltsData, ms = D.missing(r); if (ms.length) return ['e', 'Thiếu điểm ' + ms.join(', ')];
    var e = empties(r); return e ? ['w', 'Thiếu ' + e + '/16 ô nhận xét'] : ['ok', 'Đủ điểm và nhận xét'];
  }
  function table() {
    var rs = list(), f = function (v) { return v == null ? '' : Number(v).toFixed(1); }, ok = 0;
    $('#tb').innerHTML = '<tr><th class="n">STT</th><th>Mã HS</th><th>Họ tên</th><th>Lớp</th><th class="n">L</th><th class="n">R</th><th class="n">W</th><th class="n">S</th><th class="n">Overall</th><th>Trạng thái</th><th></th></tr>'
      + rs.map(function (r, i) { var s = status(r), o = window.IeltsData.hasBands(r) ? window.IeltsData.model(P, mockNo(), r).overall : null; if (s[0] === 'ok') ok++;
        return '<tr data-i="' + i + '"' + (sel === r.id ? ' class="sel"' : '') + '><td class="n">' + (i + 1) + '</td><td>' + esc(r.id) + '</td><td>' + esc(r.name) + '</td><td>' + esc(r.cls) + '</td><td class="n">' + f(r.bands.listening) + '</td><td class="n">' + f(r.bands.reading) + '</td><td class="n">' + f(r.bands.writing) + '</td><td class="n">' + f(r.bands.speaking) + '</td><td class="n"><b>' + f(o) + '</b></td><td><span class="tag ' + s[0] + '">' + esc(s[1]) + '</span></td><td><button data-v="' + i + '">Xem</button></td></tr>'; }).join('');
    $('#sum').textContent = rs.length + ' học sinh. ' + ok + ' phiếu đủ điểm và nhận xét. Ô nhận xét còn trống vẫn tạo phiếu, ô đó để trống.';
    $('#pdfAll').disabled = !rs.some(function (r) { return window.IeltsData.hasBands(r); });
  }
  function pagesOf(r) { var m = window.IeltsData.model(P, mockNo(), r); return [window.PhieuIelts.page1(m), window.PhieuIelts.page2(m)]; }
  function view(i) {
    var r = list()[i]; if (!r) return; sel = r.id; $('#sec3').hidden = false; $('#who').textContent = '- ' + r.name;
    if (!window.IeltsData.hasBands(r)) { $('#pv').innerHTML = '<p class="hint">Chưa đủ điểm 4 kỹ năng, chưa tạo được phiếu.</p>'; $('#pdfOne').disabled = true; table(); return; }
    $('#pdfOne').disabled = false; var w = Math.min(1, ($('#pv').clientWidth - 8) / 794);
    $('#pv').innerHTML = pagesOf(r).map(function (h) { return '<div class="pvp" style="zoom:' + w + '">' + h + '</div>'; }).join('');
    $('#pv').querySelectorAll('.pt-page').forEach(function (el) { window.PhieuTrang.fit(el); });
    table(); $('#sec3').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  var fonts = function () { try { return Promise.all(['400', '500', '600', '700'].map(function (w) { return document.fonts.load(w + ' 13px "Be Vietnam Pro"', 'Tiếng Việt ắằẳẵặ ưừ ơờ'); })).then(function () { return document.fonts.ready; }); } catch (e) { return Promise.resolve(); } };
  function addPage(pdf, c, first) { if (!first) pdf.addPage(); var W = 210, H = 297, ratio = c.height / c.width, w = W, h = W * ratio; if (h > H) { h = H; w = H / ratio; } pdf.addImage(c.toDataURL('image/jpeg', 0.9), 'JPEG', (W - w) / 2, 0, w, h); }
  function canvases(r) {
    var st = $('#stage'), out = Promise.resolve([]);
    pagesOf(r).forEach(function (h) { out = out.then(function (arr) { st.innerHTML = h; var el = st.firstElementChild; window.PhieuTrang.fit(el); return window.html2canvas(el, { scale: 2, backgroundColor: '#ffffff', logging: false }).then(function (c) { arr.push(c); return arr; }); }); });
    return out;
  }
  function savePdf(pdf, name) { var a = document.createElement('a'); a.href = URL.createObjectURL(pdf.output('blob')); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000); }
  function makePdf(rs, name) {
    if (!window.html2canvas || !window.jspdf) { alert('Chưa tải được thư viện tạo PDF. Kiểm tra mạng rồi thử lại.'); return; }
    var pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' }), first = true, i = 0;
    fonts().then(function next() {
      if (i >= rs.length) { $('#stage').innerHTML = ''; busy(''); savePdf(pdf, name); return; }
      busy('Đang tạo phiếu ' + (i + 1) + '/' + rs.length + ': ' + rs[i].name);
      return new Promise(function (res) { setTimeout(res, 30); }).then(function () { return canvases(rs[i]); }).then(function (cs) { cs.forEach(function (c) { addPage(pdf, c, first); first = false; }); i++; return next(); });
    }).catch(function (e) { busy(''); alert('Lỗi tạo PDF: ' + (e.message || e)); });
  }
  var okRows = function (rs) { return rs.filter(window.IeltsData.hasBands); };
  $('#load').onclick = $('#reload').onclick = load;
  $('#mock').onchange = function () { classes(); table(); };
  $('#cls').onchange = table;
  $('#tb').onclick = function (e) { var b = e.target.closest('button[data-v]'); if (b) view(+b.dataset.v); };
  $('#pdfAll').onclick = function () { var rs = okRows(list()); if (rs.length) makePdf(rs, 'phieu-ielts_mock' + mockNo() + ($('#cls').value ? '_' + slug($('#cls').value) : '') + '.pdf'); };
  $('#pdfOne').onclick = function () { var r = list().filter(function (x) { return x.id === sel; })[0]; if (r) makePdf([r], 'phieu-ielts_mock' + mockNo() + '_' + r.id + '_' + slug(r.name) + '.pdf'); };
  $('#link').value = store.get(KEY);
})();
