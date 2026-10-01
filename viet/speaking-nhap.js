/* Nhap ket qua Speaking cho tung hoc sinh: band tung tieu chi, ma chan doan, part yeu nhat.
 * Dung ngan hang viet/speaking-bank.js va logic viet/speaking-chan-doan.js.
 * Goi: SpeakingEntry.mount({ root, level, students, data, onSave(key, value|null) })
 * Du lieu 1 hoc sinh: { bands:{GV,DM,P,IC,GA}, evidence:['P-I • effortful',...], weakPart:'P3'|'' , at }
 */
(function () {
  'use strict';
  var CRIT = {
    GV: 'Grammar & Vocabulary', DM: 'Discourse Management', P: 'Pronunciation', IC: 'Interactive Communication', GA: 'Global Achievement'
  };
  var ORDER = { KET: ['GV', 'P', 'IC', 'GA'], PET: ['GV', 'DM', 'P', 'IC', 'GA'], FCE: ['GV', 'DM', 'P', 'IC', 'GA'] };
  var SUB = {
    'G-S': 'Simple control', 'G-C': 'Complex evidence', 'G-R': 'Recurring error', 'V-R': 'Range', 'V-A': 'Appropriacy', 'Complex evidence': 'Complex evidence', 'Lexical evidence': 'Lexical evidence',
    'DM-E': 'Extent', 'DM-D/R': 'Develop. / relevance', 'DM-C': 'Cohesion', 'DM-H': 'Hesitation',
    'P-I': 'Intelligibility', 'P-W': 'Word stress', 'P-S/IN': 'Sentence stress & intonation', 'P-SND': 'Individual sounds',
    'I': 'Initiate', 'R': 'Respond', 'A': 'Add', 'D': 'Develop', 'Q': 'Invite / ask', 'N': 'Negotiate', 'L': 'Link', 'F': 'Follow-up',
    'Support': 'Support', 'Independence': 'Independence', 'Exchange quality': 'Exchange quality', 'Interaction quality': 'Interaction quality',
    'GA-WH': 'Whole-test handling', 'GA-L': 'Length of utterance', 'GA-H': 'Hesitation', 'GA-ED': 'Extended discourse', 'Whole-test handling': 'Whole-test handling', 'Extended communication': 'Extended communication'
  };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // Gom cac khoa trong ngan hang theo tieu chi, roi theo ma con (giu thu tu trong ngan hang)
  function layout(level) {
    var B = (window.SPEAKING_BANK || {})[level] || {}, out = {}, D = window.SpeakingDiagnosis;
    Object.keys(B).forEach(function (k) {
      var c = D.crit(k); if (c === 'WP') return;
      var code = k.split(' • ')[0];
      out[c] = out[c] || {}; (out[c][code] = out[c][code] || []).push(k);
    });
    return out;
  }
  function weakParts(level) {
    var B = (window.SPEAKING_BANK || {})[level] || {};
    return Object.keys(B).filter(function (k) { return /^Weak part/.test(k); }).map(function (k) { return k.split(' • ')[1]; });
  }

  function mount(o) {
    var root = o.root, level = o.level, L = layout(level), WP = weakParts(level), crits = ORDER[level] || ORDER.PET, cur = null;
    function done(s) { var d = o.data[s.key]; return d && d.bands && crits.every(function (c) { return d.bands[c]; }); }
    function table() {
      var rows = o.students.map(function (s, i) {
        var d = o.data[s.key];
        return '<tr class="' + (d ? '' : 'missing') + '"><td class="num">' + (i + 1) + '</td><td>' + esc(s.code) + '</td><td>' + esc(s.name) + '</td><td>' + (d ? (done(s) ? (d.scan ? 'Đã quét' : 'Đã nhập') + (d.flags && d.flags.length ? ' - xem lại' : '') : 'Thiếu band') : 'Chưa có') + '</td>'
          + '<td><button class="btn small" data-sp="' + esc(s.key) + '">' + (d ? 'Sửa' : 'Nhập') + '</button>' + (d ? ' <button class="btn small" data-spdel="' + esc(s.key) + '">Xoá</button>' : '') + '</td></tr>';
      }).join('');
      return '<div class="tablewrap"><table><thead><tr><th>STT</th><th>Mã</th><th>Họ tên</th><th>Speaking</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    }
    function bandSel(c, v) {
      return '<select data-band="' + c + '"><option value="">Band</option>' + [1, 2, 3, 4, 5].map(function (n) { return '<option value="' + n + '"' + (String(v) === String(n) ? ' selected' : '') + '>Band ' + n + '</option>'; }).join('') + '</select>';
    }
    function form(stu) {
      var d = o.data[stu.key] || { bands: {}, evidence: [], weakPart: '' }, ev = d.evidence || [];
      var secs = crits.map(function (c) {
        var subs = L[c] || {};
        var sels = Object.keys(subs).map(function (code) {
          var cur = subs[code].filter(function (k) { return ev.indexOf(k) >= 0; })[0] || '';
          return '<label class="sp-sub"><span>' + esc(code) + ' - ' + esc(SUB[code] || code) + '</span><select data-code="' + esc(code) + '"><option value="">Not observed</option>'
            + subs[code].map(function (k) { return '<option value="' + esc(k) + '"' + (k === cur ? ' selected' : '') + '>' + esc(k.split(' • ')[1] || k) + '</option>'; }).join('') + '</select></label>';
        }).join('');
        return '<fieldset class="sp-crit"><legend>' + esc(CRIT[c]) + '</legend><div class="sp-band">' + bandSel(c, d.bands[c]) + '</div><div class="sp-subs">' + sels + '</div></fieldset>';
      }).join('');
      var wp = '<label class="sp-sub"><span>Notably weak part</span><select id="spWeak"><option value="">none</option>' + WP.map(function (p) { return '<option value="' + p + '"' + (p === d.weakPart ? ' selected' : '') + '>' + p.replace(/^P/, 'Part ') + '</option>'; }).join('') + '</select></label>';
      return '<div class="card sp-form"><h3>' + esc(stu.name) + ' <small>' + esc(stu.code) + '</small></h3>' + secs + '<fieldset class="sp-crit"><legend>Notably weak part</legend>' + wp + '</fieldset>'
        + '<div class="sp-prev" id="spPrev"></div><div class="row" style="margin-top:12px"><button class="btn primary" id="spSave">Lưu</button><button class="btn ghost" id="spCancel">Đóng</button></div><div id="spMsg"></div></div>';
    }
    function collect() {
      var bands = {}, ev = [];
      root.querySelectorAll('[data-band]').forEach(function (s) { if (s.value) bands[s.dataset.band] = +s.value; });
      root.querySelectorAll('[data-code]').forEach(function (s) { if (s.value) ev.push(s.value); });
      return { bands: bands, evidence: ev, weakPart: root.querySelector('#spWeak').value };
    }
    function preview() {
      var v = collect(), box = root.querySelector('#spPrev'), r = window.SpeakingDiagnosis.pick(level, v);
      if (!r || (!r.areas.length && !r.strength)) { box.innerHTML = '<p class="hint">Chọn mã chẩn đoán để xem nhận xét sẽ hiện trên phiếu.</p>'; return; }
      box.innerHTML = '<div class="notice info"><b>Xem trước nhận xét trên phiếu</b>' + (r.strength ? '<p><u>Điểm mạnh</u>: ' + esc(r.strength) + '</p>' : '')
        + (r.areas.length ? '<p><u>' + esc(r.title) + '</u></p><ul>' + r.areas.map(function (a) { return '<li>' + esc(a.text) + (a.part ? ' <i>Thể hiện rõ nhất ở ' + esc(a.part) + '.</i>' : '') + '</li>'; }).join('') + '</ul>' : '')
        + (r.next ? '<p><u>Cách sửa</u>: ' + esc(r.next) + '</p>' : '') + '</div>';
    }
    function draw() {
      root.innerHTML = table() + '<div id="spFormBox"></div>';
      root.querySelectorAll('[data-sp]').forEach(function (b) { b.onclick = function () { open(b.dataset.sp); }; });
      root.querySelectorAll('[data-spdel]').forEach(function (b) { b.onclick = function () {
        var s = o.students.filter(function (x) { return x.key === b.dataset.spdel; })[0];
        if (s && confirm('Xoá kết quả Speaking của ' + s.name + '?')) { o.onSave(s.key, null); cur = null; draw(); }
      }; });
      if (cur) open(cur.key, true);
    }
    function open(key, keep) {
      var stu = o.students.filter(function (x) { return x.key === key; })[0]; if (!stu) return; cur = stu;
      var box = root.querySelector('#spFormBox'); box.innerHTML = form(stu);
      box.querySelectorAll('select').forEach(function (s) { s.onchange = preview; }); preview();
      box.querySelector('#spCancel').onclick = function () { cur = null; box.innerHTML = ''; };
      box.querySelector('#spSave').onclick = function () {
        var v = collect(), miss = crits.filter(function (c) { return !v.bands[c]; });
        if (miss.length && !confirm('Còn thiếu band: ' + miss.join(', ') + '. Vẫn lưu (phiếu sẽ chưa hiện nhận xét đầy đủ)?')) return;
        v.at = Date.now(); o.onSave(stu.key, v); cur = null; draw();
        root.querySelector('#spFormBox').innerHTML = '<div class="notice info">Đã lưu Speaking cho <b>' + esc(stu.name) + '</b>.</div>';
      };
      if (!keep) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    draw();
  }
  window.SpeakingEntry = { mount: mount, layout: layout };
})();
