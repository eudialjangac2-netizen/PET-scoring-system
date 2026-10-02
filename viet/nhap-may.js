/* Nhập bài làm FCE trên máy (Google Sheet "FCE RUBY MOCK TESTS RESULTS") thay cho quét phiếu giấy.
   Đọc 2 tab: "Raw Answers" (từng câu) và "FCE Results" (tổng từng học sinh, có cột VI PHẠM).
   Lưu ý: TIMESTAMP trong sheet là giờ NỘP BÀI (mọi câu của một lần nộp cùng một giờ), không phải giờ làm từng câu. */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else root.OnlineImport = f(); })(typeof window !== 'undefined' ? window : this, function () {
  function parseCSV(t) {
    var rows = [], row = [], cur = '', q = false, i = 0;
    t = String(t).replace(/^﻿/, '');
    for (; i < t.length; i++) {
      var c = t[i];
      if (q) { if (c === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
      else cur += c;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows;
  }
  function sheetId(s) { var m = /\/d\/([\w-]+)/.exec(s || ''); return m ? m[1] : String(s || '').trim(); }
  function fetchTab(id, tab) {
    var url = 'https://docs.google.com/spreadsheets/d/' + id + '/gviz/tq?tqx=out:csv&sheet=' + encodeURIComponent(tab);
    return fetch(url).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(function (t) { if (/^\s*</.test(t)) throw new Error('Sheet chưa mở quyền xem'); return parseCSV(t); });
  }
  function fetchSheet(urlOrId) {
    var id = sheetId(urlOrId);
    return Promise.all([fetchTab(id, 'Raw Answers'), fetchTab(id, 'FCE Results')]).then(function (a) { return { raw: a[0], res: a[1] }; });
  }
  function tsMs(s) { // dd/mm/yyyy hh:mm:ss
    var m = /(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{2}):?(\d{2})?/.exec(s || '');
    return m ? new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +(m[6] || 0)).getTime() : 0;
  }
  function objs(rows) {
    if (!rows || !rows.length) return [];
    var head = rows[0].map(function (h) { return String(h).toUpperCase().replace(/\s+/g, ' ').trim(); });
    return rows.slice(1).filter(function (r) { return r.some(function (x) { return String(x).trim() !== ''; }); })
      .map(function (r) { var o = {}; head.forEach(function (h, i) { o[h] = r[i] == null ? '' : String(r[i]).trim(); }); return o; });
  }
  // -> [{id, name, cls, skill, testId, ts, tsMs, violations, items:[[q, part, given, correct, earned]]}]  (mỗi học sinh + kỹ năng: lần nộp mới nhất)
  function build(sheets) {
    var vio = {}, recs = {};
    objs(sheets.res).forEach(function (r) {
      var k = (r['STUDENT ID'] || '').toUpperCase() + '|' + r['TEST ID'];
      vio[k] = Math.max(vio[k] || 0, parseInt(r['VI PHẠM'], 10) || 0);
    });
    objs(sheets.raw).forEach(function (r) {
      var id = (r['STUDENT ID'] || '').toUpperCase().replace(/\s/g, ''), skill = (r['SKILL'] || '').toLowerCase();
      if (!id || (skill !== 'reading' && skill !== 'listening')) return;
      var key = id + '|' + skill + '|' + r['TEST ID'] + '|' + r['TIMESTAMP'];
      var rec = recs[key] = recs[key] || { id: id, name: r['HỌ VÀ TÊN'], cls: r['LỚP'], skill: skill, testId: r['TEST ID'], ts: r['TIMESTAMP'], tsMs: tsMs(r['TIMESTAMP']), violations: vio[id + '|' + r['TEST ID']] || 0, items: [] };
      var m = /^(\d+(?:\.\d+)?)/.exec(r['POINTS'] || '');
      rec.items.push([parseInt(r['QUESTION'], 10), parseInt(r['PART'], 10), r['GIVEN ANSWER'] || '', r['CORRECT ANSWER'] || '', m ? parseFloat(m[1]) : 0]);
    });
    var latest = {};
    Object.keys(recs).forEach(function (k) { var r = recs[k], g = r.id + '|' + r.skill; if (!latest[g] || r.tsMs > latest[g].tsMs) latest[g] = r; });
    return Object.keys(latest).map(function (k) { return latest[k]; });
  }
  return { parseCSV: parseCSV, sheetId: sheetId, fetchSheet: fetchSheet, build: build, tsMs: tsMs };
});
