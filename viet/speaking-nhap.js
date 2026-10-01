/* Nhap ket qua Speaking cho tung hoc sinh: band tung tieu chi, ma chan doan, part yeu nhat.
 * Dung ngan hang viet/speaking-bank.js va logic viet/speaking-chan-doan.js.
 * Goi: SpeakingEntry.mount({ root, level, students, data, onSave(key, value|null) })
 * Du lieu 1 hoc sinh: { bands:{GV,DM,P,IC,GA}, evidence:['P-I • effortful',...], weakPart:'P3'|'' , at }
 */
(function () {
  'use strict';
  var CRIT = {
    GV: 'Grammar & Vocabulary (Ngữ pháp và từ vựng)', DM: 'Discourse Management (Mạch lạc và phát triển ý)', P: 'Pronunciation (Phát âm)',
    IC: 'Interactive Communication (Giao tiếp tương tác)', GA: 'Global Achievement (Đánh giá chung)'
  };
  var ORDER = { KET: ['GV', 'P', 'IC', 'GA'], PET: ['GV', 'DM', 'P', 'IC', 'GA'], FCE: ['GV', 'DM', 'P', 'IC', 'GA'] };
  var SUB = {
    'G-S': 'Ngữ pháp cơ bản', 'G-C': 'Ngữ pháp phức tạp', 'G-R': 'Lỗi ngữ pháp lặp lại', 'V-R': 'Vốn từ', 'V-A': 'Dùng từ chính xác', 'Complex evidence': 'Bằng chứng cấu trúc phức tạp', 'Lexical evidence': 'Bằng chứng từ vựng',
    'DM-E': 'Độ dài, mở rộng câu trả lời', 'DM-D/R': 'Phát triển ý, đúng trọng tâm', 'DM-C': 'Liên kết ý', 'DM-H': 'Do dự',
    'P-I': 'Độ dễ hiểu', 'P-W': 'Trọng âm từ', 'P-S/IN': 'Trọng âm câu, ngữ điệu', 'P-SND': 'Âm riêng lẻ',
    'I': 'Mở ý', 'R': 'Đáp lại ý của bạn', 'A': 'Bổ sung ý', 'D': 'Phát triển ý', 'Q': 'Hỏi bạn', 'N': 'Thương lượng, đi đến quyết định', 'L': 'Nối ý với bạn', 'F': 'Hỏi nối tiếp',
    'Support': 'Mức hỗ trợ cần có', 'Independence': 'Mức độc lập', 'Exchange quality': 'Chất lượng trao đổi', 'Interaction quality': 'Chất lượng tương tác',
    'GA-WH': 'Toàn bài', 'GA-L': 'Độ dài câu nói', 'GA-H': 'Do dự', 'GA-ED': 'Bài nói dài', 'Whole-test handling': 'Xử lý toàn bài', 'Extended communication': 'Giao tiếp kéo dài'
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
        return '<tr class="' + (d ? '' : 'missing') + '"><td class="num">' + (i + 1) + '</td><td>' + esc(s.code) + '</td><td>' + esc(s.name) + '</td><td>' + (d ? (done(s) ? 'Đã nhập' : 'Nhập dở') : 'Chưa có') + '</td>'
          + '<td><button class="btn small" data-sp="' + esc(s.key) + '">' + (d ? 'Sửa' : 'Nhập') + '</button>' + (d ? ' <button class="btn small" data-spdel="' + esc(s.key) + '">Xoá</button>' : '') + '</td></tr>';
      }).join('');
      return '<div class="tablewrap"><table><thead><tr><th>STT</th><th>Mã</th><th>Họ tên</th><th>Speaking</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    }
    function bandSel(c, v) {
      return '<select data-band="' + c + '"><option value="">Chọn band</option>' + [1, 2, 3, 4, 5].map(function (n) { return '<option value="' + n + '"' + (String(v) === String(n) ? ' selected' : '') + '>Band ' + n + '</option>'; }).join('') + '</select>';
    }
    function form(stu) {
      var d = o.data[stu.key] || { bands: {}, evidence: [], weakPart: '' }, ev = d.evidence || [];
      var secs = crits.map(function (c) {
        var subs = L[c] || {};
        var sels = Object.keys(subs).map(function (code) {
          var cur = subs[code].filter(function (k) { return ev.indexOf(k) >= 0; })[0] || '';
          return '<label class="sp-sub"><span>' + esc(code) + ' - ' + esc(SUB[code] || code) + '</span><select data-code="' + esc(code) + '"><option value="">Không ghi nhận</option>'
            + subs[code].map(function (k) { return '<option value="' + esc(k) + '"' + (k === cur ? ' selected' : '') + '>' + esc(k.split(' • ')[1] || k) + '</option>'; }).join('') + '</select></label>';
        }).join('');
        return '<fieldset class="sp-crit"><legend>' + esc(CRIT[c]) + '</legend><div class="sp-band">' + bandSel(c, d.bands[c]) + '</div><div class="sp-subs">' + sels + '</div></fieldset>';
      }).join('');
      var wp = '<label class="sp-sub"><span>Phần thi yếu nhất (Notably weak part)</span><select id="spWeak"><option value="">Không có</option>' + WP.map(function (p) { return '<option value="' + p + '"' + (p === d.weakPart ? ' selected' : '') + '>' + p.replace(/^P/, 'Part ') + '</option>'; }).join('') + '</select></label>';
      return '<div class="card sp-form"><h3>' + esc(stu.name) + ' <small>' + esc(stu.code) + '</small></h3>' + secs + '<fieldset class="sp-crit"><legend>Phần thi yếu nhất</legend>' + wp + '</fieldset>'
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
