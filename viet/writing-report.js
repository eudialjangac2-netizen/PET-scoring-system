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
  var GENRE_EN = { short_message: 'Short Message', email: 'Email', letter_email: 'Letter / Email', essay: 'Essay', article: 'Article', story: 'Story', review: 'Review', other: 'Writing' };
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
      ranges.push({ s: i, e: end, g: e.group, sev: e.severity || (e.impeding ? 'high' : 'medium') });
    });
    ranges.sort(function (a, b) { return a.s - b.s; });
    var out = '', pos = 0;
    ranges.forEach(function (r) {
      out += esc(text.slice(pos, r.s));
      out += '<mark class="' + (r.sev === 'high' ? 'imp' : r.sev === 'low' ? 'low' : '') + '" style="background:' + (GROUP[r.g] || GROUP.grammar).mau + '">' + esc(text.slice(r.s, r.e)) + '</mark>';
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

  // Trang A4 chi tiết một Part: bài gốc, rubric, strength/issue, lỗi cần sửa, checklist
  function partPage(d, idx, opt) {
    opt = opt || {}; var mau = opt.mau || '#019EA5', dark = opt.dark || mau, soft = opt.soft || (mau + '1f'), p = d.parts[idx], s = d.student || {};
    var used = {}; (p.errors || []).forEach(function (e) { used[e.group] = 1; });
    var rk = function (e) { return (e.severity || (e.impeding ? 'high' : 'medium')) === 'high' ? 2 : (e.severity === 'low' ? 0 : 1); };
    var errs = (p.errors || []).slice().sort(function (a, b) { return rk(b) - rk(a); });
    var maxE = opt.maxErrors || 6, more = Math.max(errs.length - maxE, 0) + (p.errors_omitted || 0); errs = errs.slice(0, maxE);
    var cr = p.criteria || [];
    var st = (p.strengths && p.strengths.length) ? p.strengths : cr.filter(function (c) { return c.band >= c.max - 1 && c.comment; }).map(function (c) { return c.comment; });
    var is = (p.issues && p.issues.length) ? p.issues : cr.filter(function (c) { return c.band < c.max - 1 && c.to_move_up; }).map(function (c) { return c.to_move_up; });
    var ck = (p.checklist && p.checklist.length) ? p.checklist : (p.next_steps || []);
    var li = function (a) { return a.slice(0, 4).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join(''); };
    var h = '<div class="wr-page" style="border-top:8px solid ' + mau + '">';
    h += '<div class="wr-head soft" style="background:' + soft + '"><div><small style="color:' + dark + '">RUBY SCHOOL · CAMBRIDGE ' + esc(opt.tenCapDo || d.level) + '</small><h1>Writing Analysis &amp; Improvement · Part ' + esc(p.part) + ' ' + esc(GENRE_EN[p.genre] || 'Writing') + '<small class="vi">Phân tích kết quả và hướng cải thiện Writing - ' + esc(GENRE[p.genre] || 'Bài viết') + '</small></h1></div>'
      + '<div class="tot" style="color:' + dark + '"><b>' + esc(p.raw) + '/' + esc(p.raw_max) + '</b><span>marks for this Part</span></div></div>';
    h += '<div class="wr-who"><span>Student: <b>' + esc(s.name) + '</b></span><span>ID: <b>' + esc(s.id) + '</b></span><span>Class: <b>' + esc(s.class) + '</b></span></div>';
    h += '<div class="wr-body">';
    if (p.task) h += '<div class="wr-sec"><h3><span class="tt">Task<small class="vi">Đề bài</small></span></h3><div class="wr-task">' + esc(p.task) + '</div></div>';
    h += '<div class="wr-sec"><h3><div>Student\'s Response<small class="vi">Bài làm của em</small></div> <span>' + (p.word_count ? esc(p.word_count) + ' words' : '') + '</span></h3>'
      + '<div class="wr-text">' + highlight(p.text || '', p.errors) + '</div>'
      + '<div class="wr-leg">' + Object.keys(used).map(function (g) { return '<span style="background:' + (GROUP[g] || GROUP.grammar).mau + '">' + esc((GROUP[g] || GROUP.grammar).ten) + '</span>'; }).join('')
      + '<span style="color:#5B6576">Bold = errors that make the text hard to understand; faded = minor</span></div></div>';
    h += '<div class="wr-sec"><h3><div>Rubric Scores<small class="vi">Điểm theo từng tiêu chí</small></div> <span>0-5 per criterion</span></h3><table class="wr-crit">' + cr.map(function (c) {
      var nm = critName(c.id);
      return '<tr><td class="n">' + esc(nm[1]) + '<small>' + esc(nm[0]) + '</small><div style="margin-top:3px">' + dots(c.band, c.max, mau) + esc(c.band) + '/' + esc(c.max) + '</div></td><td>' + esc(c.comment)
        + (c.to_move_up ? '<div class="up"><b>To move up:</b> ' + esc(c.to_move_up) + '</div>' : '') + '</td></tr>';
    }).join('') + '</table></div>';
    h += '<div class="wr-two"><div class="wr-si good"><h3>Strengths<small class="vi">Điểm mạnh</small></h3><ul>' + li(st) + '</ul></div><div class="wr-si issue"><h3>Issues to Fix<small class="vi">Vấn đề cần khắc phục</small></h3><ul>' + li(is) + '</ul></div></div>';
    if (errs.length) h += '<div class="wr-sec"><h3><span class="tt">Corrections<small class="vi">Lỗi cần sửa ngay</small></span></h3><ul class="wr-err">' + errs.map(function (e) {
      var g = GROUP[e.group] || GROUP.grammar;
      return '<li><span class="g" style="background:' + g.mau + '">' + esc(g.ten) + '</span><span class="o' + (rk(e) === 2 ? ' hi' : rk(e) === 0 ? ' lo' : '') + '">' + esc(e.original) + '</span> &rarr; <span class="k">' + esc(e.corrected) + '</span>. ' + esc(e.explanation) + '</li>';
    }).join('') + (more > 0 ? '<li style="color:#5B6576">and ' + more + ' more minor errors (see the teacher\'s marked copy).</li>' : '') + '</ul></div>';
    if (ck.length) h += '<div class="wr-sec"><h3><div>Self-check Checklist<small class="vi">Tự kiểm tra trước khi nộp bài lần sau</small></div></h3><ul class="wr-ck">' + ck.slice(0, 5).map(function (x) { return '<li><i style="border-color:' + dark + '"></i>' + esc(x) + '</li>'; }).join('') + '</ul></div>';
    h += '</div><div class="wr-foot"><span>Each criterion is scored 0-5 using the Cambridge rubric. Page ' + (opt.trang || '') + '/' + (opt.total || 4) + '</span><span>Ruby School</span></div></div>';
    return h;
  }
  // Thu gọn dần cho vừa 1 trang A4: (1) chữ nhỏ hơn, (2) bớt lỗi/checklist, (3) thu nhỏ nội dung. Gọi sau khi gắn trang vào DOM.
  function fit(pageEl) {
    var body = pageEl.querySelector('.wr-body'); if (!body) return 0;
    var over = function () { return body.scrollHeight > body.clientHeight + 1; };
    var scale = function () {
      var r = Math.max(0.8, body.clientHeight / body.scrollHeight);
      body.style.overflow = 'visible'; body.style.transformOrigin = 'top left'; body.style.transform = 'scale(' + r + ')'; body.style.width = (100 / r) + '%'; return r;
    };
    if (over()) pageEl.classList.add('c1');
    if (over() && body.clientHeight / body.scrollHeight >= 0.9) return scale();
    if (over()) pageEl.classList.add('c2');
    if (over()) return scale();
    return 1;
  }
  return { summary: summary, partPage: partPage, highlight: highlight, fit: fit };
});
