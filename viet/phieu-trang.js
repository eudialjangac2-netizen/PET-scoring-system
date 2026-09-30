/*
 * Trang 1 (Performance Overview) và trang 2 (Learning Diagnosis) của phiếu phụ huynh.
 *   PhieuTrang.overview(m)   -> HTML trang 1
 *   PhieuTrang.diagnosis(m)  -> HTML trang 2
 *   PhieuTrang.THEME, PhieuTrang.gradeOf(level, scale)
 * Dữ liệu vào m: xem viet/phieu-mau-v2.html (mô hình mẫu). CSS: viet/phieu-trang.css. A4 = 794 x 1123 px.
 */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else root.PhieuTrang = f(); })(typeof self !== 'undefined' ? self : this, function () {
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  // Màu chủ đạo mỗi cấp độ + bảng pastel riêng từng kỹ năng (bg = nền thẻ, ink = chữ và đường biểu đồ)
  var OV = '#2F3B52'; // màu riêng của Overall (không trùng màu kỹ năng nào), dùng chung mọi cấp độ
  var THEME = {
    KET: { a: '#019EA5', d: '#0B6F74', soft: '#EAF6F6', skill: {
      reading: { bg: '#DDF2F2', ink: '#1A8C91' }, listening: { bg: '#E0EAFA', ink: '#4A74C0' }, writing: { bg: '#E0F4E5', ink: '#4C9A68' }, speaking: { bg: '#FDF0D5', ink: '#C99A2E' } } },
    PET: { a: '#B4455C', d: '#8A2A40', soft: '#FBF2F4', skill: {
      reading: { bg: '#F6E2E6', ink: '#B5566B' }, listening: { bg: '#FBEBDA', ink: '#C9803A' }, writing: { bg: '#EAE5F3', ink: '#7B68A8' }, speaking: { bg: '#E1EEE2', ink: '#5E9468' } } },
    FCE: { a: '#8DBF36', d: '#4F7A12', soft: '#F3F9E6', skill: {
      reading: { bg: '#E8F4CC', ink: '#6E9A2A' }, uoe: { bg: '#FBF4C6', ink: '#C2A21E' }, listening: { bg: '#D9F1E5', ink: '#2F9470' }, writing: { bg: '#DCEBF8', ink: '#4A82BE' }, speaking: { bg: '#FCE5D8', ink: '#D0703A' } } }
  };
  // Mức Grade theo Cambridge English Scale (chung cho từng kỹ năng và Overall)
  var GRADES = { KET: [[140, 'A'], [133, 'B'], [120, 'C']], PET: [[160, 'A'], [153, 'B'], [140, 'C']], FCE: [[180, 'A'], [173, 'B'], [160, 'C']] };
  function gradeOf(level, scale) {
    var g = GRADES[level] || []; for (var i = 0; i < g.length; i++) if (scale >= g[i][0]) return g[i][1]; return '';
  }
  function nextGrade(level, scale) {
    var g = GRADES[level] || [], best = null;
    g.forEach(function (x) { if (x[0] > scale) best = x; });
    return best; // [ngưỡng, chữ] của Grade liền trên, null nếu đã Grade A
  }
  function gradeBadge(level, scale) { var g = gradeOf(level, scale); return g ? 'Grade ' + g : 'Chưa đạt Grade C'; }
  function delta(v, unit) {
    if (v == null) return '';
    if (v > 0) return '<span class="pt-d u">&#9650; ' + v + (unit || '') + '</span>';
    if (v < 0) return '<span class="pt-d dn">&#9660; ' + Math.abs(v) + (unit || '') + '</span>';
    return '<span class="pt-d n">= 0</span>';
  }
  function styleVars(m) { var t = THEME[m.level]; return '--a:' + t.a + ';--d:' + t.d + ';--soft:' + t.soft; }
  function head(m, title) {
    return '<div class="pt-head"><div><small>RUBY SCHOOL · CAMBRIDGE ' + esc(m.level) + '</small><h1>' + esc(title) + '</h1></div><div class="pt-ex">' + esc(m.exam) + '<span>Graded ' + esc(m.date) + '</span></div></div>'
      + '<div class="pt-who"><div><span>Student</span><b>' + esc(m.student.name) + '</b></div><div><span>Student ID</span><b>' + esc(m.student.id) + '</b></div><div><span>Class</span><b>' + esc(m.student.cls) + '</b></div></div>';
  }
  function foot(m, n) { return '<div class="pt-foot"><span>Scores use the Cambridge English Scale for ' + esc(m.level) + '. Grade A/B/C is based on Scale. Page ' + n + '/4</span><span>Ruby School</span></div>'; }

  // ---- Biểu đồ kết hợp: cột = điểm từng kỹ năng của Mock hiện tại, đường ngang Overall; bên phải đường Overall qua các Mock
  function ranges(m) {
    var vals = [m.overall.scale]; m.skills.forEach(function (s) { vals.push(s.scale); }); m.history.forEach(function (h) { vals.push(h.overall); });
    var g = GRADES[m.level].map(function (x) { return x[0]; });
    var nx = nextGrade(m.level, m.overall.scale); if (nx) vals.push(nx[0]);
    var lo = Math.floor((Math.min.apply(null, vals) - 6) / 10) * 10, hi = Math.ceil((Math.max.apply(null, vals) + 6) / 10) * 10;
    return { lo: lo, hi: hi };
  }
  function gridLines(m, L, Rx, Y, lo, hi, labelX, skip) {
    var s = '';
    for (var v = lo; v <= hi; v += 10) s += '<line x1="' + L + '" x2="' + Rx + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="#EDF0F4"/>';
    GRADES[m.level].forEach(function (x) { if (x[0] > lo && x[0] < hi) s += '<line x1="' + L + '" x2="' + Rx + '" y1="' + Y(x[0]) + '" y2="' + Y(x[0]) + '" stroke="#9aa3b1" stroke-opacity=".55" stroke-dasharray="3 3"/>' + (skip != null && Math.abs(x[0] - skip) <= 4 ? '' : '<text x="' + (labelX + 4) + '" y="' + (Y(x[0]) + 3) + '" text-anchor="start" font-size="8.5" fill="#7a8494">Grade ' + x[1] + '</text>'); });
    return s;
  }
  function barChart(m) {
    var W = 318, H = 236, L = 30, R = 44, T = 14, B = 52, r = ranges(m), lo = r.lo, hi = r.hi, n = m.skills.length, T0 = THEME[m.level];
    var Y = function (v) { return T + (hi - v) * (H - T - B) / (hi - lo); }, cw = (W - L - R) / n, bw = Math.min(38, cw * .56);
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">';
    for (var v = lo; v <= hi; v += 10) s += '<text x="' + (L - 5) + '" y="' + (Y(v) + 3) + '" text-anchor="end" font-size="9" fill="#9aa3b1">' + v + '</text>';
    s += gridLines(m, L, W - R, Y, lo, hi, W - R, m.overall.scale);
    m.skills.forEach(function (sk, i) {
      var cx = L + cw * i + cw / 2, y = Y(sk.scale), ink = T0.skill[sk.id].ink;
      s += '<path d="M' + (cx - bw / 2) + ',' + Y(lo) + ' V' + (y + 4) + ' a4,4 0 0 1 4,-4 h' + (bw - 8) + ' a4,4 0 0 1 4,4 V' + Y(lo) + ' Z" fill="' + ink + '"/>';
      var words = sk.name.replace(/^Use of /, 'Use of|').split('|');
      words.forEach(function (w, k) { s += '<text x="' + cx + '" y="' + (Y(lo) + 13 + k * 10) + '" text-anchor="middle" font-size="9.5" fill="#3a4457">' + esc(w) + '</text>'; });
      s += '<text x="' + cx + '" y="' + (Y(lo) + 14 + words.length * 10 + 2) + '" text-anchor="middle" font-size="12" font-weight="700" fill="#172033">' + sk.scale + '</text>';
    });
    var yo = Y(m.overall.scale);
    s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yo + '" y2="' + yo + '" stroke="' + OV + '" stroke-width="2.4"/><text x="' + (W - R + 4) + '" y="' + (yo + 3) + '" font-size="9.5" font-weight="700" fill="' + OV + '">Overall</text>';
    return s + '</svg>';
  }
  function lineChart(m) {
    var W = 196, H = 236, L = 14, R = 40, T = 14, B = 52, r = ranges(m), lo = r.lo, hi = r.hi, n = Math.max(m.history.length, 2);
    var Y = function (v) { return T + (hi - v) * (H - T - B) / (hi - lo); }, X = function (i) { return m.history.length === 1 ? (L + (W - L - R) / 2) : L + i * (W - L - R) / (n - 1); };
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">' + gridLines(m, L, W - R, Y, lo, hi, W - R);
    var pts = m.history.map(function (h, i) { return X(i) + ',' + Y(h.overall); });
    if (m.history.length > 1) s += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + OV + '" stroke-width="2.4" stroke-linejoin="round"/>';
    m.history.forEach(function (h, i) {
      var cur = i === m.history.length - 1;
      s += '<circle cx="' + X(i) + '" cy="' + Y(h.overall) + '" r="' + (cur ? 5 : 3.6) + '" fill="' + (cur ? OV : '#fff') + '" stroke="' + OV + '" stroke-width="2"/>';
      s += '<text x="' + (X(i) + (cur ? 6 : 0)) + '" y="' + (Y(h.overall) - 9) + '" text-anchor="' + (cur ? 'end' : 'middle') + '" font-size="10" font-weight="700" fill="' + OV + '">' + h.overall + '</text>';
      s += '<text x="' + X(i) + '" y="' + (Y(lo) + 13) + '" text-anchor="middle" font-size="9.5" fill="#3a4457">' + esc(h.label.replace('Mock ', '')) + '</text>';
    });
    s += '<text x="' + ((L + W - R) / 2) + '" y="' + (Y(lo) + 27) + '" text-anchor="middle" font-size="9" fill="#7a8494">Mock test</text>';
    if (m.history.length === 1) s += '<text x="' + ((L + W - R) / 2) + '" y="' + (Y(lo) - 34) + '" text-anchor="middle" font-size="9" fill="#7a8494">Progress line starts</text><text x="' + ((L + W - R) / 2) + '" y="' + (Y(lo) - 23) + '" text-anchor="middle" font-size="9" fill="#7a8494">from Mock 2</text>';
    return s + '</svg>';
  }

  function skillCard(m, sk) {
    var t = THEME[m.level].skill[sk.id];
    var rows = sk.parts.map(function (p) {
      var f = p.n ? p.v / p.n : 0;
      return '<div class="pt-pr"><span>' + esc(p.name) + '</span><div class="pt-bar"><i style="width:' + Math.max(f * 100, 3) + '%;background:' + t.ink + '"></i></div><b>' + p.v + '/' + p.n + '</b>' + delta(m.first ? null : p.d) + '</div>';
    }).join('');
    var g = gradeOf(m.level, sk.scale);
    return '<div class="pt-sk" style="background:' + t.bg + ';--ink:' + t.ink + '"><h2>' + esc(sk.name) + '</h2><div class="pt-gr">' + (g ? 'Grade ' + g : 'Below Grade C') + '</div>'
      + '<div class="pt-sc"><b>' + sk.scale + '</b><span>Scale</span>' + delta(m.first ? null : sk.d) + '</div><div class="pt-raw">' + sk.raw + ' / ' + sk.max + ' marks</div>' + rows + '</div>';
  }

  function overview(m) {
    var o = m.overall, nx = nextGrade(m.level, o.scale), g = gradeOf(m.level, o.scale);
    var weakest = m.skills.slice().sort(function (a, b) { return a.scale - b.scale; })[0];
    var pl = function (n) { return n + (n === 1 ? ' Scale point' : ' Scale points'); };
    var ovt = m.first
      ? 'First mock: this is your starting point.' + (nx ? ' Target for Mock 2: reach Grade ' + nx[1] + ' (' + nx[0] + '), ' + pl(nx[0] - o.scale) + ' away.' : '')
      : (nx ? pl(nx[0] - o.scale) + ' to reach Grade ' + nx[1] + '.' : 'Top grade reached.');
    return '<div class="pt-page" style="' + styleVars(m) + '">' + head(m, 'Performance Overview') + '<div class="pt-main">'
      + '<div class="pt-r1"><div class="pt-ov"><small>OVERALL</small><div class="pt-ovn"><b>' + o.scale + '</b><span>Scale</span></div><div class="pt-ovg">' + (g ? 'Grade ' + g : 'Below Grade C') + '</div>'
      + (m.first ? '<span class="pt-d n">Baseline</span>' : delta(o.d, ' vs previous mock'))
      + '<div class="pt-ovt">' + esc(ovt) + '</div></div>'
      + '<div class="pt-ch"><h3>Skills &amp; Progress <span>Cambridge English Scale</span></h3><div class="pt-cc"><div><div class="pt-ct">This mock: score by skill</div>' + barChart(m) + '</div><div><div class="pt-ct">Overall across mocks</div>' + lineChart(m) + '</div></div></div></div>'
      + '<div class="pt-skills">' + m.skills.map(function (s) { return skillCard(m, s); }).join('') + '</div>'
      + '<div class="pt-r3"><div class="pt-cm"><h3>Teacher\'s Overall Comment</h3><p>' + esc(m.comment) + '</p></div>'
      + '<div class="pt-pr3"><h3>Top 3 Priorities</h3><ol>' + m.priorities.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol></div></div>'
      + '</div>' + foot(m, 1) + '</div>';
  }

  // ---- Trang 2: Learning Diagnosis (không lặp lại bảng điểm Part)
  function diagnosis(m) {
    var T0 = THEME[m.level], D = m.diagnosis;
    var gap = m.skills.map(function (sk) {
      var nx = nextGrade(m.level, sk.scale), t = T0.skill[sk.id], need = nx ? nx[0] - sk.scale : 0;
      return '<tr><td><i style="background:' + t.ink + '"></i>' + esc(sk.name) + '</td><td><b>' + sk.scale + '</b></td><td>' + gradeBadge(m.level, sk.scale) + '</td><td>' + (nx ? '<span class="pt-need" style="background:' + t.bg + ';color:' + t.ink + '">+' + need + '</span> to Grade ' + nx[1] : 'Top grade reached') + '</td></tr>';
    }).join('');
    var causes = D.causes.map(function (c) {
      var t = T0.skill[c.skill] || { bg: T0.soft, ink: T0.d };
      return '<div class="pt-ca" style="background:' + t.bg + '"><h4 style="color:' + t.ink + '">' + esc(c.title) + '</h4><p>' + esc(c.body) + '</p><div class="fx"><b>How to fix:</b> ' + esc(c.fix) + '</div></div>';
    }).join('');
    var wr = D.writingGroups.map(function (g) { return '<div class="pt-wg"><span class="dot" style="background:' + g.mau + '"></span><b>' + g.n + '</b> ' + esc(g.ten) + '<small>' + esc(g.note) + '</small></div>'; }).join('');
    var wrong = D.wrong.map(function (w) {
      var t = T0.skill[w.skill];
      return '<div class="pt-wq"><h5 style="color:' + t.ink + '">' + esc(w.name) + '</h5>' + w.items.map(function (x) { return '<span class="chip" style="background:' + t.bg + '">' + esc(x) + '</span>'; }).join('') + '</div>';
    }).join('');
    return '<div class="pt-page" style="' + styleVars(m) + '">' + head(m, 'Learning Diagnosis') + '<div class="pt-main">'
      + '<div class="pt-sec"><h3>Path to the Next Grade</h3><table class="pt-gap"><tr><th>Skill</th><th>Scale</th><th>Current level</th><th>Needed</th></tr>' + gap + '</table></div>'
      + '<div class="pt-sec"><h3>Why Points Are Being Lost</h3><div class="pt-cas">' + causes + '</div></div>'
      + '<div class="pt-two"><div class="pt-sec"><h3>Repeated Writing Errors</h3>' + wr + '</div><div class="pt-sec"><h3>Test-taking Habits</h3><ul class="pt-hb">' + D.habits.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div></div>'
      + '<div class="pt-sec"><h3>Questions to Review <small>(question: your answer, correct answer)</small></h3><div class="pt-wrs">' + wrong + '</div></div>'
      + '</div>' + foot(m, 2) + '</div>';
  }
  return { THEME: THEME, OV: OV, GRADES: GRADES, gradeOf: gradeOf, nextGrade: nextGrade, overview: overview, diagnosis: diagnosis };
});
