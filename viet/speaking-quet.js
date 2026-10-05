/* Doc phieu cham Speaking da quet (OMR) thanh du lieu cho phieu bao diem.
 * Dau vao: ket qua OMR.process (res.mcq[q].opts co cov tung o) + mau trang trong omr-template.json
 * Dau ra: { bands:{GV,DM,P,IC,GA}, evidence:[khoa trong speaking-bank.js], weakPart, flags:[...] }
 * Quy tac doc: o co do phu >= TH.marked la da to. Hang 1 lua chon: to 2 o -> bao loi, bo qua hang.
 * Hang co dau * (tick nhieu o): suy ra trang thai theo bang quy tac duoi day.
 */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.SpeakingScan = factory(); })(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var norm = function (s) { return String(s || '').toLowerCase().replace(/[^a-z0-9+]/g, ''); };
  var ALIAS = { 'supportindependence': 'Support' }, LFIX = { 'mixedinconsistent': 'mixed/frequent issues' };
  var toks = function (s) { return String(s || '').toLowerCase().split(/[^a-z0-9+]+/).filter(Boolean); };
  function bankOf(level) { return ((typeof window !== 'undefined' && window.SPEAKING_BANK) || globalThis.SPEAKING_BANK || {})[level] || {}; }
  function keysOf(B, code) {
    var c0 = norm(code), c = norm(ALIAS[c0] || code);
    return Object.keys(B).filter(function (k) { return norm(k.split(' • ')[0]) === c; }).map(function (k) { return { key: k, state: k.split(' • ')[1] || '' }; });
  }
  // chon khoa ngan hang khop nhat voi nhan o tren phieu
  function score(cand, label) {
    var nl = norm(label), tl = toks(label), best = null;
    cand.forEach(function (c) {
      var ns = norm(c.state), sc = 0;
      if (ns === nl) sc = 4; else if (nl.indexOf(ns) === 0 || ns.indexOf(nl) === 0) sc = 3; else if (nl.indexOf(ns) >= 0 || ns.indexOf(nl) >= 0) sc = 2;
      else { var ts = toks(c.state), inter = ts.filter(function (w) { return tl.indexOf(w) >= 0; }).length; if (inter / (ts.length + tl.length - inter) >= 0.5) sc = 1; }
      if (sc && (!best || sc > best[0])) best = [sc, c.key];
    });
    return best;
  }
  function match(B, code, label) {
    var cand = keysOf(B, code), best = score(cand, label);
    if ((!best || best[0] < 4) && LFIX[norm(label)]) { var b2 = score(cand, LFIX[norm(label)]); if (b2 && (!best || b2[0] > best[0])) best = b2; }
    return best ? best[1] : null;
  }
  var WP_ORDER = { PET: ['P2', 'P3', 'P1', 'P4'], KET: ['P2', 'P1'], FCE: ['P3', 'P2', 'P4', 'P1'] };
  var LABEL_ALIAS = { 'articles': 'articles/prepositions', 'prepositions': 'articles/prepositions', 'word order': 'word order/question form', 'question form': 'word order/question form' };

  function fromResult(level, res, tpl) {
    var T = tpl.pages[res.page], B = bankOf(level), TH = { marked: T.marked_cov || (window.OMR && window.OMR.TH && window.OMR.TH.marked) || 0.28 };
    var out = { bands: {}, evidence: [], weakPart: '', flags: [], rows: {} }, ev = {};
    var add = function (k) { if (k && B[k]) ev[k] = 1; };
    T.questions.forEach(function (q) {
      var m = res.mcq[q.q]; if (!m) return;
      var on = q.options.map(function (o, i) { return { label: o.label, cov: (m.opts[i] || {}).cov || 0 }; }).filter(function (o) { return o.cov >= TH.marked; }).map(function (o) { return o.label; });
      var name = q.row || q.code;
      if (!/^BAND-/.test(q.code) && q.code !== 'Notably weak part') out.rows[q.code] = on.slice();   // nhãn ô giám khảo đã tô ở từng dòng (để xuất Excel / Sheet đủ chi tiết)
      if (/^BAND-/.test(q.code)) {
        var c = q.code.slice(5);
        if (on.length === 1) out.bands[c] = +on[0]; else out.flags.push({ code: q.code, text: 'Band ' + c + (on.length ? ': tô nhiều hơn 1 ô' : ': chưa tô') });
        return;
      }
      if (q.code === 'Notably weak part') {   // tô nhiều Part: chọn theo thứ tự ưu tiên đã duyệt (PET P2>P3>P1>P4 · KET P2>P1 · FCE P3>P2>P4>P1)
        var ps = on.filter(function (x) { return /^P\d$/.test(x); }), ord = WP_ORDER[level] || [];
        out.weakPart = ord.filter(function (p) { return ps.indexOf(p) >= 0; })[0] || ps[0] || ''; return;
      }
      if (!q.multi) {
        if (on.length > 1) { out.flags.push({ code: q.code, text: name + ': tô nhiều hơn 1 ô' }); return; }
        if (on.length === 1) add(match(B, q.code, on[0]));
        return;
      }
      // hang tick nhieu o
      if (q.code === 'IC') {
        q.options.forEach(function (o) {
          var L = o.label.split(' ')[0], isOn = on.indexOf(o.label) >= 0, cand = keysOf(B, L);
          var k = cand.filter(function (c) { return isOn ? /observed/.test(c.state) : /weak|absent/.test(c.state); })[0];
          add(k && k.key);
        });
        return;
      }
      if (q.code === 'G-C') { add(on.length ? 'G-C • evidence present' : 'G-C • little/no evidence'); return; }   // PET
      if (q.code === 'G-R') {
        if (!on.length) return;
        var cand = keysOf(B, 'G-R');
        if (cand.length === 1) { add(cand[0].key); return; }                       // PET: recurring pattern
        on.forEach(function (l) {                                                   // KET: theo loai loi; FCE: complex breakdown / recurring error
          var k = match(B, 'G-R', LABEL_ALIAS[l] || l);
          if (!k && /FCE/.test(level)) k = 'G-R • recurring error';
          add(k);
        });
        return;
      }
      if (on.length) { var c2 = keysOf(B, q.code); if (c2.length === 1) add(c2[0].key); }   // Complex evidence, Lexical evidence (FCE)
    });
    out.evidence = Object.keys(ev);
    return out;
  }
  return { fromResult: fromResult, match: match, norm: norm };
});
