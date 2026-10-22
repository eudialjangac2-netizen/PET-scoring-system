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

  // ---------- đăng nhập và phân quyền theo lớp ----------
  var CFG = {}, Q = { quanLy: [], giaoVien: {} }, ME = null, BM = {}, BN = 0;   // BM: mã HS -> batch IELTS (từ danh sách lớp của Apps Script), BN: số batch IELTS     // ME = { name, all, groups[] }
  var lsGet = function (k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  var lsSet = function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  var plain = function (s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/\b(mr|ms|mrs|thay|co)\b\.?/g, ' ').replace(/[^a-z0-9.]+/g, ' ').trim(); };
  var same = function (name, alias) { var a = plain(alias), n = plain(name); if (!a || !n) return false; if (a === n) return true; var nt = n.split(' '); return a.split(' ').every(function (t) { return nt.indexOf(t) >= 0; }); };
  var any = function (name, list) { return (list || []).some(function (a) { return same(name, a); }); };
  function permission(name, admin) {
    if (admin || any(name, Q.quanLy)) return { name: name, all: true, groups: [] };
    var g = Object.keys(Q.giaoVien).filter(function (k) { return any(name, Q.giaoVien[k]); }).map(Number);
    return { name: name, all: false, groups: g };
  }
  // Lớp IELTS = batch (vd IELTS7.0-2627), lấy từ danh sách lớp Apps Script trả về lúc đăng nhập (tên lớp dạng "BATCH · TEACHER").
  // Giáo viên chỉ nhận về lớp của mình, quản lý nhận tất cả. Chưa có batch IELTS nào trong danh sách thì quay về cách cũ (lớp văn hoá + ielts-quyen.json).
  var NOBATCH = '(Chưa có batch IELTS)';
  function readBatches(classes) {
    BM = {}; var seen = {}; BN = 0;
    Object.keys(classes || {}).forEach(function (name) {
      var c = classes[name] || {}, b = String(name).split(' · ')[0].trim();
      if (!/IELTS/i.test(String(c.level || '')) && !/^IELTS/i.test(b)) return;
      if (!seen[b]) { seen[b] = 1; BN++; }
      (c.students || []).forEach(function (st) { var id = String(st.code || '').toUpperCase().replace(/\s/g, ''); if (id) BM[id] = b; });
    });
  }
  var byBatch = function () { return BN > 0; };
  var grp = function (r) { return byBatch() ? (BM[r.id] || NOBATCH) : r.cls; };
  var allowed = function (r) { if (!ME) return false; if (ME.all) return true; return byBatch() ? !!BM[r.id] : ME.groups.indexOf(r.target) >= 0; };
  function signIn(code) {
    if (!code) { $('#who0').className = 'msg err'; $('#who0').textContent = 'Nhập mã giáo viên.'; return Promise.resolve(); }
    if (!CFG.sheetUrl) { $('#who0').className = 'msg err'; $('#who0').textContent = 'Chưa cấu hình kết nối đăng nhập (cau-hinh.json).'; return Promise.resolve(); }
    $('#who0').className = 'msg'; $('#who0').textContent = 'Đang kiểm tra mã…';
    return fetch(CFG.sheetUrl + '?action=classes&code=' + encodeURIComponent(code)).then(function (x) { return x.json(); }).then(function (r) {
      if (!r.ok) { $('#who0').className = 'msg err'; $('#who0').textContent = r.error || 'Mã giáo viên không đúng.'; return; }
      lsSet('omr-tcode', code); lsSet('omr-teacher', { name: r.teacher, admin: r.admin }); readBatches(r.classes);
      enter(r.teacher, r.admin);
    }).catch(function () { $('#who0').className = 'msg err'; $('#who0').textContent = 'Không kết nối được máy chủ đăng nhập. Kiểm tra mạng rồi thử lại.'; });
  }
  function enter(name, admin) {
    ME = permission(name, admin);
    if (!ME.all && !ME.groups.length && !byBatch()) { ME = null; $('#who0').className = 'msg err'; $('#who0').textContent = 'Tài khoản "' + name + '" chưa được gán lớp IELTS nào. Nhờ quản lý thêm vào file ielts-quyen.json.'; $('#sec1').hidden = true; return; }
    $('#who0').className = 'msg ok'; $('#who0').textContent = 'Xin chào ' + name + ' · ' + (ME.all ? 'quản lý, xem tất cả các lớp' : (byBatch() ? 'giáo viên ' + BN + ' lớp IELTS' : 'giáo viên nhóm IELTS ' + ME.groups.map(function (g) { return g.toFixed(1); }).join(', ')));
    $('#sec1').hidden = false; $('#sec1').querySelector('.row').hidden = !ME.all && !!CFG.ieltsSheet; $('#sec1').querySelector('.hint').hidden = !ME.all && !!CFG.ieltsSheet;
    if (!ME.all && CFG.ieltsSheet) $('#link').value = CFG.ieltsSheet; else if (!$('#link').value && CFG.ieltsSheet) $('#link').value = CFG.ieltsSheet;
    if ($('#link').value) load();
  }
  function logout() { ME = null; P = null; ['#sec1', '#sec2', '#sec3'].forEach(function (x) { $(x).hidden = true; }); }

  function load() {
    if (!ME) { msg('Đăng nhập trước.', 'err'); return; } var link = $('#link').value.trim(); if (!link) { msg('Dán link Google Sheet trước.', 'err'); return; }
    store.set(KEY, link); msg('Đang đọc sheet…'); busy('Đang đọc Google Sheet…');
    window.IeltsData.fetchTab(link, 'IELTS').then(function (rows) { P = window.IeltsData.parse(rows); Object.keys(P.mocks).forEach(function (k) { P.mocks[k] = P.mocks[k].filter(allowed); }); if (!Object.keys(P.mocks).some(function (k) { return P.mocks[k].length; })) throw new Error('Không có học sinh nào thuộc lớp của thầy cô trong sheet.'); fill(); msg('Đã tải dữ liệu.', 'ok'); })
      .catch(function (e) { msg(e.message || String(e), 'err'); }).then(function () { busy(''); });
  }
  function fill() {
    var ms = Object.keys(P.mocks).map(Number).sort(function (a, b) { return a - b; }), D = window.IeltsData, keep = $('#mock').value;
    $('#mock').innerHTML = ms.map(function (n) { var full = P.mocks[n].filter(function (r) { return D.hasBands(r); }).length; return '<option value="' + n + '">Mock Test ' + n + ' (' + full + '/' + P.mocks[n].length + ' đủ điểm)</option>'; }).join('');
    var firstFull = ms.filter(function (n) { return P.mocks[n].some(D.hasBands); }).pop(); $('#mock').value = keep && ms.indexOf(+keep) >= 0 ? keep : (firstFull || ms[0]);
    $('#sec2').hidden = false; classes(); table();
  }
  function classes() {
    var set = {}; (P.mocks[mockNo()] || []).forEach(function (r) { set[grp(r)] = 1; }); var keep = $('#cls').value;
    var list = Object.keys(set).sort(function (a, b) { return a === NOBATCH ? 1 : b === NOBATCH ? -1 : a.localeCompare(b, 'vi', { numeric: true }); });   // "(Chưa có batch IELTS)" xếp cuối
    $('#cls').innerHTML = '<option value="">Tất cả lớp</option>' + list.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join(''); if (list.indexOf(keep) >= 0) $('#cls').value = keep;
  }
  function list() { var c = $('#cls').value; return (P.mocks[mockNo()] || []).filter(function (r) { return !c || grp(r) === c; }); }
  function empties(r) { var n = (r.comment ? 0 : 1) + r.priorities.filter(function (x) { return !x; }).length; Object.keys(r.feedback).forEach(function (k) { ['s', 'w', 'a'].forEach(function (x) { if (!r.feedback[k][x]) n++; }); }); return n; }
  function status(r) {
    var D = window.IeltsData, ms = D.missing(r); if (ms.length) return ['e', 'Thiếu điểm ' + ms.join(', ')];
    var e = empties(r); return e ? ['w', 'Thiếu ' + e + '/16 ô nhận xét'] : ['ok', 'Đủ điểm và nhận xét'];
  }
  function table() {
    var rs = list(), f = function (v) { return v == null ? '' : Number(v).toFixed(1); }, ok = 0;
    $('#tb').innerHTML = '<tr><th class="n">STT</th><th>Mã HS</th><th>Họ tên</th><th>Lớp IELTS</th><th>Lớp chính khoá</th><th class="n">L</th><th class="n">R</th><th class="n">W</th><th class="n">S</th><th class="n">Overall</th><th>Trạng thái</th><th></th></tr>'
      + rs.map(function (r, i) { var s = status(r), o = window.IeltsData.hasBands(r) ? window.IeltsData.model(P, mockNo(), r).overall : null; if (s[0] === 'ok') ok++;
        return '<tr data-i="' + i + '"' + (sel === r.id ? ' class="sel"' : '') + '><td class="n">' + (i + 1) + '</td><td>' + esc(r.id) + '</td><td>' + esc(r.name) + '</td><td>' + esc(grp(r)) + '</td><td>' + esc(r.cls) + '</td><td class="n">' + f(r.bands.listening) + '</td><td class="n">' + f(r.bands.reading) + '</td><td class="n">' + f(r.bands.writing) + '</td><td class="n">' + f(r.bands.speaking) + '</td><td class="n"><b>' + f(o) + '</b></td><td><span class="tag ' + s[0] + '">' + esc(s[1]) + '</span></td><td><button data-v="' + i + '">Xem</button></td></tr>'; }).join('');
    $('#sum').textContent = rs.length + ' học sinh. ' + ok + ' phiếu đủ điểm và nhận xét. Ô nhận xét còn trống vẫn tạo phiếu, ô đó để trống.';
    $('#pdfAll').disabled = !rs.some(function (r) { return window.IeltsData.hasBands(r); });
  }
  function pagesOf(r) { var m = window.IeltsData.model(P, mockNo(), r); return [window.PhieuIelts.page1(m), window.PhieuIelts.page2(m)]; }
  function view(i) {
    var r = list()[i]; if (!r) return; sel = r.id; $('#sec3').hidden = false; $('#who').textContent = '- ' + r.name;
    if (!window.IeltsData.hasBands(r)) { $('#pv').innerHTML = '<p class="hint">Chưa đủ điểm 4 kỹ năng, chưa tạo được phiếu.</p>'; $('#pdfOne').disabled = true; table(); return; }
    $('#pdfOne').disabled = false; var w = Math.min(1, ($('#pv').clientWidth - 8) / 794);
    $('#pv').innerHTML = pagesOf(r).map(function (h) { return '<div class="pvp" style="zoom:' + w + '">' + h + '</div>'; }).join('');
    Array.prototype.forEach.call($('#pv').querySelectorAll('.pvp'), function (e) { window.PhieuIelts.fitCards(e); });
    $('#pv').querySelectorAll('.pt-page').forEach(function (el) { window.PhieuTrang.fit(el); });
    table(); $('#sec3').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  var fonts = function () { try { return Promise.all(['400', '500', '600', '700'].map(function (w) { return document.fonts.load(w + ' 13px "Be Vietnam Pro"', 'Tiếng Việt ắằẳẵặ ưừ ơờ'); })).then(function () { return document.fonts.ready; }); } catch (e) { return Promise.resolve(); } };
  function addPage(pdf, c, first) { if (!first) pdf.addPage(); var W = 210, H = 297, ratio = c.height / c.width, w = W, h = W * ratio; if (h > H) { h = H; w = H / ratio; } pdf.addImage(c.toDataURL('image/jpeg', 0.9), 'JPEG', (W - w) / 2, 0, w, h); }
  function canvases(r) {
    var st = $('#stage'), out = Promise.resolve([]);
    pagesOf(r).forEach(function (h) { out = out.then(function (arr) { st.innerHTML = h; var el = st.firstElementChild; window.PhieuTrang.fit(el); window.PhieuIelts.fitCards(el); return window.html2canvas(el, { scale: 2, backgroundColor: '#ffffff', logging: false }).then(function (c) { arr.push(c); return arr; }); }); });
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
  $('#login').onclick = function () { logout(); signIn($('#code').value.trim()); };
  $('#code').onkeydown = function (e) { if (e.key === 'Enter') $('#login').click(); };
  $('#link').value = store.get(KEY);
  Promise.all([fetch('cau-hinh.json').then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }), fetch('ielts-quyen.json').then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; })]).then(function (a) {
    CFG = a[0] || {}; Q = { quanLy: (a[1] || {}).quanLy || [], giaoVien: (a[1] || {}).giaoVien || {} };
    var t = lsGet('omr-teacher'), c = lsGet('omr-tcode'); if (c) $('#code').value = c;
    if (t && t.name && c) signIn(c);   // đăng nhập lại ngầm để lấy danh sách batch IELTS mới nhất
  });
})();
