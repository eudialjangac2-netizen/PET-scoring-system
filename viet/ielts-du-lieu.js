/*
 * Đọc tab "IELTS" của Google Sheet (5 mock test trong một sheet) và dựng mô hình phiếu IELTS.
 *   IeltsData.fetchTab(linkOrId) -> Promise<rows>      (đọc qua gviz CSV, sheet cần mở quyền xem bằng liên kết)
 *   IeltsData.parse(rows)        -> { mocks: {1:[rec,...], 2:[...]}, cols }   (tìm cột theo TÊN tiêu đề, không theo vị trí)
 *   IeltsData.model(parsed, mockNo, rec) -> mô hình m cho PhieuIelts.page1/page2
 * Bảng đối chiếu cột: xem viet/HUONG-DAN-IELTS.md
 */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(root.PhieuIelts || (typeof require === 'function' ? require('./phieu-ielts.js') : null)); else root.IeltsData = f(root.PhieuIelts); })(typeof self !== 'undefined' ? self : this, function (PI) {
  var SK = ['listening', 'reading', 'writing', 'speaking'];
  var MONTH = { 1: 'October 2026', 2: 'December 2026', 3: 'January 2027', 4: 'April 2027', 5: 'May 2027' };
  function parseCSV(t) {
    var rows = [], row = [], cur = '', q = false, i = 0; t = String(t).replace(/^﻿/, '');
    for (; i < t.length; i++) { var c = t[i];
      if (q) { if (c === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"') q = true; else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
      else cur += c; }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); } return rows;
  }
  function sheetId(s) { var m = /\/d\/([\w-]+)/.exec(s || ''); return m ? m[1] : String(s || '').trim(); }
  function fetchTab(link, tab) {
    var url = 'https://docs.google.com/spreadsheets/d/' + sheetId(link) + '/gviz/tq?tqx=out:csv&sheet=' + encodeURIComponent(tab || 'IELTS');
    return fetch(url).then(function (r) { if (!r.ok) throw new Error('Không mở được sheet (HTTP ' + r.status + '). Kiểm tra link và tên tab "IELTS".'); return r.text(); })
      .then(function (t) { if (/^\s*</.test(t)) throw new Error('Sheet chưa mở quyền xem. Chia sẻ: "Bất kỳ ai có đường liên kết đều xem được".'); return parseCSV(t); });
  }
  var norm = function (s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase(); };
  function num(v) { var s = String(v == null ? '' : v).trim().replace(',', '.'); if (s === '' || isNaN(+s)) return null; return +s; }
  var txt = function (v) { return String(v == null ? '' : v).replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').trim(); };

  // tìm dòng tiêu đề (dòng có "Mã HS"), rồi tìm cột theo tên
  function parse(rows) {
    var hi = -1; for (var i = 0; i < Math.min(rows.length, 6); i++) if (rows[i].some(function (c) { return /(^|\s)mã hs$/i.test(norm(c)); })) { hi = i; break; }
    if (hi < 0) throw new Error('Không thấy cột "Mã HS" trong tab IELTS. Kiểm tra đúng tên tab và dòng tiêu đề.');
    var H = rows[hi].map(norm);
    var find = function (re, from) { for (var j = from || 0; j < H.length; j++) if (re.test(H[j])) return j; return -1; };
    var need = {}, miss = [];
    var req = function (key, re, from) { var j = find(re, from); if (j < 0) miss.push(key); need[key] = j; return j; };
    req('mock', /mock test$/); req('id', /(^|\s)mã hs$/); req('name', /(^|\s)họ tên$/); req('cls', /(^|\s)lớp$/); req('target', /nhóm mục tiêu$/);
    var o = need.target + 1; need.off = [o, o + 1, o + 2, o + 3, o + 4];            // L R W S Overall (chính thức)
    req('ls', /listening statistics$/); req('rs', /reading statistics$/);
    var w = req('wcrit', /tự tính ta$/); need.wcritCols = [w, w + 1, w + 2, w + 3];
    var s = req('sp', /giáo viên chấm fc$/); need.spCols = [s, s + 1, s + 2, s + 3];
    var f1 = req('spf', /feedback fc$/); need.spfCols = [f1, f1 + 1, f1 + 2, f1 + 3];
    req('cm', /nhận xét tổng thể$/); var p1 = req('pr1', /^ưu tiên 1$/); need.pr = [p1, p1 + 1, p1 + 2];
    need.fb = {}; SK.forEach(function (k) { var K = k.charAt(0).toUpperCase() + k.slice(1); need.fb[k] = ['strengths', 'weaknesses', 'action plan'].map(function (x) { var j = find(new RegExp('^' + k + ' - ' + x + '$')); if (j < 0) miss.push(K + ' - ' + x); return j; }); });
    if (miss.length) throw new Error('Thiếu cột trong tab IELTS: ' + miss.join(', ') + '. Giữ nguyên tên cột như file mẫu.');
    var mocks = {}, g = function (r, j) { return j < 0 ? '' : r[j]; };
    rows.slice(hi + 1).forEach(function (r) {
      var id = txt(g(r, need.id)).toUpperCase(), mk = /(\d+)/.exec(g(r, need.mock)); if (!id || !mk) return;
      var N = +mk[1], b = need.off.map(function (j) { return num(g(r, j)); });
      var rec = { mock: N, id: id, name: txt(g(r, need.name)), cls: txt(g(r, need.cls)), target: num(g(r, need.target)),
        bands: { listening: b[0], reading: b[1], writing: b[2], speaking: b[3] }, overall: b[4],
        wc: need.wcritCols.map(function (j) { return num(g(r, j)); }), sc: need.spCols.map(function (j) { return num(g(r, j)); }),
        spFb: need.spfCols.map(function (j) { return txt(g(r, j)); }), ls: txt(g(r, need.ls)), rs: txt(g(r, need.rs)),
        comment: txt(g(r, need.cm)), priorities: need.pr.map(function (j) { return txt(g(r, j)); }),
        feedback: {} };
      SK.forEach(function (k) { var a = need.fb[k].map(function (j) { return txt(g(r, j)); }); rec.feedback[k] = { s: a[0], w: a[1], a: a[2] }; });
      (mocks[N] = mocks[N] || []).push(rec);
    });
    return { mocks: mocks, cols: need };
  }
  var hasBands = function (r) { return SK.every(function (k) { return r.bands[k] != null; }); };
  // trạng thái dữ liệu của một học sinh: danh sách điểm còn thiếu
  function missing(r) { return SK.filter(function (k) { return r.bands[k] == null; }); }
  function model(parsed, mockNo, rec) {
    var prev = [], n; for (n = 1; n < mockNo; n++) { var p = (parsed.mocks[n] || []).filter(function (x) { return x.id === rec.id; })[0]; if (p && hasBands(p)) prev.push(p); }
    var ov = function (r) { return r.overall != null ? r.overall : PI.overallOf(r.bands); };
    var last = prev[prev.length - 1], deltas = {};
    if (last) SK.forEach(function (k) { deltas[k] = rec.bands[k] != null ? rec.bands[k] - last.bands[k] : null; });
    var m = { student: { name: rec.name, id: rec.id, cls: rec.cls }, exam: 'MOCK TEST ' + mockNo, monthYear: MONTH[mockNo] || '', mockNo: mockNo, date: '', mockLabel: 'Mock ' + mockNo,
      bands: rec.bands, deltas: last ? deltas : {}, criteria: { writing: { TA: rec.wc[0], CC: rec.wc[1], LR: rec.wc[2], GRA: rec.wc[3] }, speaking: { FC: rec.sc[0], LR: rec.sc[1], GRA: rec.sc[2], P: rec.sc[3] } },
      target: rec.target, history: prev.map(function (p) { return { label: 'Mock ' + p.mock, overall: ov(p), bands: p.bands }; }),
      stats: { listening: PI.parseStats(rec.ls), reading: PI.parseStats(rec.rs) }, comment: rec.comment, priorities: rec.priorities, feedback: rec.feedback };
    m.overall = ov(rec); m.overallDelta = last ? m.overall - ov(last) : null; return m;
  }
  return { parseCSV: parseCSV, fetchTab: fetchTab, sheetId: sheetId, parse: parse, model: model, missing: missing, hasBands: hasBands, MONTH: MONTH };
});
