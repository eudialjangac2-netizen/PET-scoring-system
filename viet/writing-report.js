/*
 * Phiếu Writing cho phụ huynh, tạo HTML từ JSON Writing (viet/schema-writing.json).
 *   WritingReport.summary(data, mau)                -> khối tóm tắt Writing cho trang 1 của phiếu
 *   WritingReport.partPage(data, partIndex, opt)    -> trang A4 chi tiết một Part (dùng cho trang 3, 4)
 * CSS: viet/writing-report.css. Chạy được ở trình duyệt và Node.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WritingReport = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var GROUP = {
    content: { ten: 'Nội dung', mau: '#FCEEB0' }, style: { ten: 'Văn phong', mau: '#F8D9E4' },
    organisation: { ten: 'Bố cục', mau: '#CFEEFB' }, grammar: { ten: 'Ngữ pháp', mau: '#FAD9D3' }, vocabulary: { ten: 'Từ vựng', mau: '#E6DCF5' }
  };
  var CRIT = {
    content: ['Nội dung', 'Content'], communicative_achievement: ['Giao tiếp', 'Communicative Achievement'],
    organisation: ['Bố cục', 'Organisation'], language: ['Ngôn ngữ', 'Language']
  };
  var GENRE = { short_message: 'Tin nhắn ngắn', email: 'Email', letter_email: 'Thư / Email', essay: 'Bài luận', article: 'Bài báo', story: 'Truyện', review: 'Bài đánh giá', other: 'Bài viết' };

  function dots(band, max, mau) {
    var h = '<span class="wr-dots">';
    for (var i = 1; i <= max; i++) h += '<i' + (i <= band ? ' style="background:' + mau + '"' : '') + '></i>';
    return h + '</span>';
  }
  function critName(id) { return (CRIT[id] || [id, id]); }
  function shortOf(p) {
    if (p.short_comment) return p.short_comment;
    var g = String(p.general_feedback || ''), m = g.match(/^[\s\S]{40,170}?[.!?](\s|$)/);
    return m ? m[0].trim() : g.slice(0, 160);
  }
  function tint(mau) { return mau + '1f'; }

  // Tô lỗi trong bài gốc theo errors[].original (lần xuất hiện đầu tiên, không chồng nhau)
  function highlight(text, errors) {
    var ranges = [];
    (errors || []).forEach(function (e) {
      if (!e.original) return;
      var i = text.indexOf(e.original); if (i < 0) i = text.toLowerCase().indexOf(String(e.original).toLowerCase());
      if (i < 0) return;
      var end = i + e.original.length;
      if (ranges.some(function (r) { return i < r.e && end > r.s; })) return;
      ranges.push({ s: i, e: end, g: e.group, imp: !!e.impeding });
    });
    ranges.sort(function (a, b) { return a.s - b.s; });
    var out = '', pos = 0;
    ranges.forEach(function (r) {
      out += esc(text.slice(pos, r.s));
      out += '<mark class="' + (r.imp ? 'imp' : '') + '" style="background:' + (GROUP[r.g] || GROUP.grammar).mau + '">' + esc(text.slice(r.s, r.e)) + '</mark>';
      pos = r.e;
    });
    return out + esc(text.slice(pos));
  }

  // Khối tóm tắt cho trang 1: điểm từng tiêu chí trên thang 5 cho từng Part + nhận xét ngắn
  function summary(d, mau) {
    var parts = d.parts || [], t = d.total || {};
    var ids = []; parts.forEach(function (p) { (p.criteria || []).forEach(function (c) { if (ids.indexOf(c.id) < 0) ids.push(c.id); }); });
    var scale = t.cambridge_scale != null ? t.cambridge_scale + (t.is_estimate ? ' (ước lượng)' : '') : '';
    var h = '<div class="wr-sum"><h2>Writing<em style="background:' + tint(mau) + ';color:' + mau + '">' + esc(t.raw) + ' / ' + esc(t.raw_max) + ' điểm' + (scale ? ' · thang ' + esc(scale) : '') + '</em></h2>';
    h += '<table><tr><th></th>' + parts.map(function (p) { return '<th>Part ' + esc(p.part) + ' · ' + esc(GENRE[p.genre] || 'Bài viết') + '</th>'; }).join('') + '</tr>';
    ids.forEach(function (id) {
      h += '<tr><td class="c"><b>' + esc(critName(id)[0]) + '</b></td>' + parts.map(function (p) {
        var c = (p.criteria || []).filter(function (x) { return x.id === id; })[0];
        return '<td>' + (c ? dots(c.band, c.max, mau) + '<b>' + esc(c.band) + '/' + esc(c.max) + '</b>' : '—') + '</td>';
      }).join('') + '</tr>';
    });
    h += '</table><div class="cm">' + parts.map(function (p) { return '<div><b>Part ' + esc(p.part) + ':</b> ' + esc(shortOf(p)) + '</div>'; }).join('') + '</div></div>';
    return h;
  }

  // Trang A4 chi tiết một Part
  function partPage(d, idx, opt) {
    opt = opt || {}; var mau = opt.mau || '#019EA5', p = d.parts[idx], s = d.student || {};
    var used = {}; (p.errors || []).forEach(function (e) { used[e.group] = 1; });
    var errs = (p.errors || []).slice().sort(function (a, b) { return (b.impeding ? 1 : 0) - (a.impeding ? 1 : 0); });
    var maxE = opt.maxErrors || 8, more = errs.length - maxE; errs = errs.slice(0, maxE);
    var impKind = p.improved && p.improved.kind === 'advanced_suggestions' ? 'Gợi ý nâng cao' : 'Bài viết tham khảo';
    var h = '<div class="wr-page">';
    h += '<div class="wr-head" style="background:' + mau + '"><div><small>RUBY SCHOOL · CAMBRIDGE ' + esc(opt.tenCapDo || d.level) + ' · WRITING</small><h1>Part ' + esc(p.part) + ' · ' + esc(GENRE[p.genre] || 'Bài viết') + '</h1></div>'
      + '<div class="tot"><b>' + esc(p.raw) + '/' + esc(p.raw_max) + '</b><span>điểm Part này</span></div></div>';
    h += '<div class="wr-who"><span>Học sinh: <b>' + esc(s.name) + '</b></span><span>Mã: <b>' + esc(s.id) + '</b></span><span>Lớp: <b>' + esc(s.class) + '</b></span></div>';
    h += '<div class="wr-body">';
    if (p.task) h += '<div class="wr-sec"><h3>Đề bài</h3><div class="wr-task">' + esc(p.task) + '</div></div>';
    h += '<div class="wr-sec"><h3>Bài làm của em <span>' + (p.word_count ? esc(p.word_count) + ' từ' : '') + (p.original_note ? ' · ' + esc(p.original_note) : '') + '</span></h3>'
      + '<div class="wr-text">' + highlight(p.text || '', p.errors) + '</div>'
      + '<div class="wr-leg">' + Object.keys(used).map(function (g) { return '<span style="background:' + (GROUP[g] || GROUP.grammar).mau + '">' + esc((GROUP[g] || GROUP.grammar).ten) + '</span>'; }).join('')
      + '<span style="color:#5B6576">Chữ in đậm: lỗi làm người đọc khó hiểu</span></div></div>';
    h += '<div class="wr-sec"><h3>Điểm và nhận xét từng tiêu chí <span>thang 5</span></h3><table class="wr-crit">' + (p.criteria || []).map(function (c) {
      var nm = critName(c.id);
      return '<tr><td class="n">' + esc(nm[0]) + '<small>' + esc(nm[1]) + '</small><div style="margin-top:3px">' + dots(c.band, c.max, mau) + esc(c.band) + '/' + esc(c.max) + '</div></td><td>' + esc(c.comment)
        + (c.to_move_up ? '<div class="up"><b>Để lên band cao hơn:</b> ' + esc(c.to_move_up) + '</div>' : '')
        + (c.key_takeaway ? '<div class="kt"><b>Ghi nhớ:</b> ' + esc(c.key_takeaway) + '</div>' : '') + '</td></tr>';
    }).join('') + '</table></div>';
    if (errs.length) h += '<div class="wr-sec"><h3>Lỗi cần sửa</h3><ul class="wr-err">' + errs.map(function (e) {
      var g = GROUP[e.group] || GROUP.grammar;
      return '<li><span class="g" style="background:' + g.mau + '">' + esc(g.ten) + '</span><span class="o">' + esc(e.original) + '</span> nên là <span class="k">' + esc(e.corrected) + '</span>. ' + esc(e.explanation) + '</li>';
    }).join('') + (more > 0 ? '<li style="color:#5B6576">Và ' + more + ' lỗi nhỏ khác (xem bản chấm chi tiết của giáo viên).</li>' : '') + '</ul></div>';
    if (p.improved && p.improved.text) h += '<div class="wr-sec"><h3>' + impKind + ' <span>' + (p.improved.word_count ? esc(p.improved.word_count) + ' từ' : '') + '</span></h3><div class="wr-imp" style="border-color:' + mau + ';background:' + tint(mau) + '">' + esc(p.improved.text) + '</div></div>';
    h += '<div class="wr-sec wr-fb"><h3>Nhận xét chung và việc nên làm</h3>' + (p.general_feedback ? '<p>' + esc(p.general_feedback) + '</p>' : '')
      + ((p.next_steps || []).length ? '<ul>' + p.next_steps.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') + '</div>';
    h += '</div><div class="wr-foot"><span>Điểm mỗi tiêu chí thang 0-5 theo rubric Cambridge. Trang ' + (opt.trang || '') + '</span><span>Ruby School</span></div></div>';
    return h;
  }
  return { summary: summary, partPage: partPage, highlight: highlight };
});
