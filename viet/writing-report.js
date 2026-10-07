/*
 * Phiếu Writing cho phụ huynh, tạo HTML từ JSON Writing (viet/schema-writing.json).
 *   WritingReport.summary(data, mau)                -> khối tóm tắt Writing cho trang 1 của phiếu
 *   WritingReport.partPages(data, partIndex, opt)  -> mảng trang A4 chi tiết của một Part (KET thường 1 trang, PET/FCE 2 trang trở lên)
 *   WritingReport.partPage(...)                     -> bản cũ, trả về trang đầu
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
      // Mỗi từ một thẻ mark: html2canvas vẽ sai khi một thẻ mark dài bị xuống dòng giữa chừng
      var mcls = r.sev === 'high' ? 'imp' : r.sev === 'low' ? 'low' : '', mbg = (GROUP[r.g] || GROUP.grammar).mau;
      out += text.slice(r.s, r.e).split(/(\s+)/).filter(function (w) { return w !== ''; }).map(function (w) {
        return '<mark class="' + mcls + '" style="background:' + mbg + '">' + esc(w) + '</mark>';
      }).join('');
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

  // ---------- Trang chi tiết một Part ----------
  // partPages(d, idx, opt) -> mảng HTML các trang A4 của Part đó.
  //   KET: cố gắng gọn trong 1 trang (đủ lỗi + bài mẫu); nếu không vừa thì tách A/B như PET, FCE.
  //   PET, FCE: trang A (đề, bài làm tô lỗi, điểm từng tiêu chí, điểm mạnh/vấn đề),
  //             trang B (đủ lỗi cần sửa, bài mẫu improved, nhận xét chi tiết, checklist, việc cần làm tiếp);
  //             nhiều lỗi thì trang B tự tràn sang trang tiếp.
  // opt.trang = số trang bắt đầu của Part này; chân trang ghi "Page n/__TOTAL__" để nơi gọi thay tổng số trang.
  var IMP_TITLE = {
    improved_version: ['Improved Version', 'Bài viết đã sửa'], advanced_suggestions: ['Advanced Suggestions', 'Gợi ý nâng cao'],
    improved_sample: ['Model Answer', 'Bài mẫu tham khảo']
  };
  function ctx(d, idx, opt) {
    opt = opt || {}; var mau = opt.mau || '#019EA5', p = d.parts[idx], cr = p.criteria || [];
    var rk = function (e) { return (e.severity || (e.impeding ? 'high' : 'medium')) === 'high' ? 2 : (e.severity === 'low' ? 0 : 1); };
    var st = (p.strengths && p.strengths.length) ? p.strengths : cr.filter(function (c) { return c.band >= c.max - 1 && c.comment; }).map(function (c) { return c.comment; });
    var is = (p.issues && p.issues.length) ? p.issues : cr.filter(function (c) { return c.band < c.max - 1 && c.to_move_up; }).map(function (c) { return c.to_move_up; });
    var hasCk = !!(p.checklist && p.checklist.length);
    var used = {}; (p.errors || []).forEach(function (e) { used[e.group] = 1; });
    return { d: d, p: p, s: d.student || {}, cr: cr, mau: mau, dark: opt.dark || mau, soft: opt.soft || (mau + '1f'), opt: opt, rk: rk, st: st, is: is,
      ck: hasCk ? p.checklist : (p.next_steps || []), next: hasCk ? (p.next_steps || []) : [], used: used,
      errs: (p.errors || []).slice().sort(function (a, b) { return rk(b) - rk(a); }) };
  }
  function secTask(c) { return c.p.task ? '<div class="wr-sec"><h3><span class="tt">Task<small class="vi">Đề bài</small></span></h3><div class="wr-task">' + esc(c.p.task) + '</div></div>' : ''; }
  function secText(c) {
    var p = c.p;
    return '<div class="wr-sec"><h3><div>Student\'s Response<small class="vi">Bài làm của em</small></div> <span>' + (p.word_count ? esc(p.word_count) + ' words' : '') + '</span></h3>'
      + '<div class="wr-text">' + highlight(p.text || '', p.errors) + '</div>'
      + '<div class="wr-leg">' + Object.keys(c.used).map(function (g) { return '<span style="background:' + (GROUP[g] || GROUP.grammar).mau + '">' + esc((GROUP[g] || GROUP.grammar).ten) + '</span>'; }).join('')
      + '<span style="color:#5B6576">Bold = errors that make the text hard to understand; faded = minor</span></div></div>';
  }
  function secRubric(c, full) {
    return '<div class="wr-sec"><h3><div>Rubric Scores<small class="vi">Điểm theo từng tiêu chí</small></div> <span>0-5 per criterion</span></h3><table class="wr-crit">' + c.cr.map(function (x) {
      var nm = critName(x.id);
      return '<tr><td class="n">' + esc(nm[1]) + '<small>' + esc(nm[0]) + '</small><div style="margin-top:3px">' + dots(x.band, x.max, c.mau) + esc(x.band) + '/' + esc(x.max) + '</div></td><td>' + esc(x.comment)
        + (x.to_move_up ? '<div class="up"><b style="color:' + c.mau + '">To move up:</b> ' + esc(x.to_move_up) + '</div>' : '')
        + (full && x.key_takeaway ? '<div class="kt"><b style="color:' + c.mau + '">Key takeaway:</b> ' + esc(x.key_takeaway) + '</div>' : '') + '</td></tr>';
    }).join('') + '</table></div>';
  }
  function secTwo(c) {
    var li = function (a) { return a.slice(0, 4).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join(''); };
    return '<div class="wr-two"><div class="wr-si good"><h3>Strengths<small class="vi">Điểm mạnh</small></h3><ul>' + li(c.st) + '</ul></div><div class="wr-si issue"><h3>Issues to Fix<small class="vi">Vấn đề cần khắc phục</small></h3><ul>' + li(c.is) + '</ul></div></div>';
  }
  function errBlocks(c) {
    var b = c.errs.map(function (e, i) {
      var g = GROUP[e.group] || GROUP.grammar, r = c.rk(e);
      return { k: 'err', i: i, h: '<li><span class="g" style="background:' + g.mau + '">' + esc(g.ten) + '</span><span class="o' + (r === 2 ? ' hi' : r === 0 ? ' lo' : '') + '">' + esc(e.original) + '</span> &rarr; <span class="k">' + esc(e.corrected == null ? '(rewrite this part)' : e.corrected) + '</span>. ' + esc(e.explanation) + '</li>' };
    });
    if (c.p.errors_omitted > 0) b.push({ k: 'err', i: b.length, h: '<li style="color:#5B6576">Plus ' + esc(c.p.errors_omitted) + ' very minor errors not listed (spelling, punctuation).</li>' });
    return b;
  }
  function secImproved(c) {
    var im = c.p.improved; if (!im || !im.text) return '';
    var t = IMP_TITLE[im.kind] || IMP_TITLE.improved_version;
    return '<div class="wr-sec"><h3><div>' + t[0] + '<small class="vi">' + t[1] + '</small></div> <span>' + (im.word_count ? esc(im.word_count) + ' words' : '') + '</span></h3><div class="wr-imp" style="border-color:' + c.mau + ';background:' + c.soft + '">' + esc(im.text) + '</div></div>';
  }
  function secFeedback(c) {
    var g = c.p.general_feedback; if (!g) return '';
    return '<div class="wr-sec"><h3><span class="tt">Teacher\'s Feedback<small class="vi">Nhận xét chi tiết của cô</small></span></h3><div class="wr-fb"><p>' + esc(g).replace(/\n+/g, '</p><p>') + '</p></div></div>';
  }
  function secCheck(c) {
    return c.ck.length ? '<div class="wr-sec"><h3><div>Self-check Checklist<small class="vi">Tự kiểm tra trước khi nộp bài lần sau</small></div></h3><ul class="wr-ck">' + c.ck.slice(0, 6).map(function (x) { return '<li><i style="border-color:' + c.dark + '"></i>' + esc(x) + '</li>'; }).join('') + '</ul></div>' : '';
  }
  function secNext(c) {
    return c.next.length ? '<div class="wr-sec"><h3><span class="tt">Next Steps<small class="vi">Việc cần làm tiếp</small></span></h3><div class="wr-fb"><ul>' + c.next.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div></div>' : '';
  }
  function bodyOf(blocks) {
    var out = '', i = 0;
    while (i < blocks.length) {
      if (blocks[i].k === 'err') {
        var j = i, lis = '', first = blocks[i].i;
        while (j < blocks.length && blocks[j].k === 'err') { lis += blocks[j].h; j++; }
        out += '<div class="wr-sec"><h3><span class="tt">Corrections' + (first > 0 ? ' (continued)' : '') + '<small class="vi">Lỗi cần sửa</small></span></h3><ul class="wr-err">' + lis + '</ul></div>'; i = j;
      } else { out += blocks[i].h; i++; }
    }
    return out;
  }
  function pageHTML(c, body, n, cls) {
    var p = c.p, s = c.s, o = c.opt;
    var h = '<div class="wr-page' + (cls ? ' ' + cls : '') + '" style="border-top:8px solid ' + c.mau + '">';
    h += '<div class="wr-head soft" style="background:' + c.soft + '"><div><small style="color:' + c.dark + '">RUBY SCHOOL · CAMBRIDGE ' + esc(o.tenCapDo || c.d.level) + '</small><h1>Writing Analysis &amp; Improvement · Part ' + esc(p.part) + ' ' + esc(GENRE_EN[p.genre] || 'Writing') + '<small class="vi">Phân tích kết quả và hướng cải thiện Writing - ' + esc(GENRE[p.genre] || 'Bài viết') + '</small></h1></div>'
      + '<div class="tot" style="color:' + c.dark + '"><b>' + esc(p.raw) + '/' + esc(p.raw_max) + '</b><span>marks for this Part</span></div></div>';
    h += '<div class="wr-who"><span>Student: <b>' + esc(s.name) + '</b></span><span>ID: <b>' + esc(s.id) + '</b></span><span>Class: <b>' + esc(s.class) + '</b></span></div>';
    h += '<div class="wr-body">' + body + '</div><div class="wr-foot"><span>Each criterion is scored 0-5 using the Cambridge rubric. Page ' + n + '/__TOTAL__</span><span>Ruby School</span></div></div>';
    return h;
  }
  // Đo xem nội dung có tràn trang không (chỉ chạy ở trình duyệt)
  var host = null;
  function overflows(html) {
    if (typeof document === 'undefined') return false;
    if (!host || !host.isConnected) { host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-10000px;top:0;visibility:hidden;pointer-events:none'; document.body.appendChild(host); }
    host.innerHTML = html;
    var b = host.querySelector('.wr-body'), r = b.scrollHeight > b.clientHeight + 1;
    host.innerHTML = ''; return r;
  }
  function partPages(d, idx, opt) {
    var c = ctx(d, idx, opt), n0 = (opt && opt.trang) || 1;
    var eb = errBlocks(c), tail = [secImproved(c), secFeedback(c), secCheck(c), secNext(c)].filter(Boolean).map(function (h) { return { k: 'sec', h: h }; });
    // KET: thử gọn trong 1 trang
    if (d.level === 'KET' && !(opt && opt.split)) {
      var one = [{ k: 'sec', h: secTask(c) }, { k: 'sec', h: secText(c) }, { k: 'sec', h: secRubric(c, false) }, { k: 'sec', h: secTwo(c) }].concat(eb, tail.filter(function (x) { return x.h.indexOf('Teacher') < 0 && x.h.indexOf('Next Steps') < 0; }));
      var tryOne = [bodyOf(one)].map(function (b) { return [pageHTML(c, b, n0, ''), pageHTML(c, b, n0, 'c1')]; })[0];
      if (!overflows(tryOne[0])) return [tryOne[0]];
      if (!overflows(tryOne[1])) return [tryOne[1]];
    }
    // Tách trang A / B...
    var aBody = secTask(c) + secText(c) + secRubric(c, true) + secTwo(c), pages = [], aN = n0;
    var aCls = overflows(pageHTML(c, aBody, aN, '')) ? 'c1' : '';
    pages.push(pageHTML(c, aBody, aN, aCls));
    var blocks = eb.concat(tail), cur = [], n = n0 + 1;
    blocks.forEach(function (b) {
      var test = cur.concat([b]);
      if (cur.length && overflows(pageHTML(c, bodyOf(test), n, ''))) { pages.push(pageHTML(c, bodyOf(cur), n, '')); n++; cur = [b]; }
      else cur = test;
    });
    if (cur.length) pages.push(pageHTML(c, bodyOf(cur), n, ''));
    return pages;
  }
  // Giữ tương thích bản cũ: trả về trang đầu của Part
  function partPage(d, idx, opt) { return partPages(d, idx, opt)[0].replace(/__TOTAL__/g, (opt && opt.total) || 4); }
  // Thu gọn nếu vẫn tràn 1 trang: chữ nhỏ hơn, rồi thu nhỏ tối đa 15%. Gọi sau khi gắn trang vào DOM.
  function fit(pageEl) {
    var body = pageEl.querySelector('.wr-body'); if (!body) return 0;
    var over = function () { return body.scrollHeight > body.clientHeight + 1; };
    if (over()) pageEl.classList.add('c1');
    if (over()) {
      var r = Math.max(0.85, body.clientHeight / body.scrollHeight);
      body.style.overflow = 'visible'; body.style.transformOrigin = 'top left'; body.style.transform = 'scale(' + r + ')'; body.style.width = (100 / r) + '%'; return r;
    }
    return 1;
  }
  return { summary: summary, partPage: partPage, partPages: partPages, highlight: highlight, fit: fit };
});
