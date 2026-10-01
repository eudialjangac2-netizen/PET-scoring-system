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
  // Màu kỹ năng dùng chung mọi cấp độ (để phụ huynh nhận ra ngay); Overall lấy màu chủ đạo của cấp độ
  var SKILL = {
    reading: { bg: '#E6EEFB', ink: '#5B84C4' }, listening: { bg: '#FCEBDC', ink: '#D08A52' }, writing: { bg: '#EDE7F8', ink: '#8A74BC' },
    speaking: { bg: '#FBF2D2', ink: '#C9A23A' }, uoe: { bg: '#DDF0F1', ink: '#3F93A0' } };
  var VI = { reading: 'Đọc hiểu', listening: 'Nghe hiểu', writing: 'Viết', speaking: 'Nói', uoe: 'Ngữ pháp và từ vựng' };
  var THEME = {
    KET: { a: '#019EA5', d: '#0B6F74', soft: '#E6F5F5', skill: SKILL },
    PET: { a: '#B4455C', d: '#8A2A40', soft: '#FAEFF1', skill: SKILL },
    FCE: { a: '#8DBF36', d: '#4F7A12', soft: '#F1F8E0', skill: SKILL }
  };
  var ttl = function (en, vi) { return '<span class="tt">' + esc(en) + '<small class="vi">' + esc(vi) + '</small></span>'; };
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
    return '<div class="pt-head"><div><small>RUBY SCHOOL · CAMBRIDGE ' + esc(m.level) + '</small><h1>' + ttl(title[0], title[1]) + '</h1></div><div class="pt-ex">' + esc(m.exam) + '<span>Graded ' + esc(m.date) + '</span></div></div>'
      + '<div class="pt-who"><div><span>Student</span><b>' + esc(m.student.name) + '</b></div><div><span>Student ID</span><b>' + esc(m.student.id) + '</b></div><div><span>Class</span><b>' + esc(m.student.cls) + '</b></div></div>';
  }
  function foot(m, n) { return '<div class="pt-foot"><span>Scores use the Cambridge English Scale for ' + esc(m.level) + '. Grade A/B/C is based on Scale. Page ' + n + '/' + (m.totalPages || 4) + '</span><span>Ruby School</span></div>'; }

  // ---- Biểu đồ kết hợp: cột = điểm từng kỹ năng của Mock hiện tại, đường ngang Overall; bên phải đường Overall qua các Mock
  function ranges(m) {
    var vals = []; if (m.overall.scale != null) vals.push(m.overall.scale);
    m.skills.forEach(function (s) { if (s.scale != null) vals.push(s.scale); }); m.history.forEach(function (h) { if (h.overall != null) vals.push(h.overall); });
    var nx = m.overall.scale != null ? nextGrade(m.level, m.overall.scale) : null; if (nx) vals.push(nx[0]);
    if (!vals.length) GRADES[m.level].forEach(function (x) { vals.push(x[0]); });
    var lo = Math.floor((Math.min.apply(null, vals) - 6) / 10) * 10, hi = Math.ceil((Math.max.apply(null, vals) + 6) / 10) * 10;
    return { lo: lo, hi: hi };
  }
  function gridLines(m, L, Rx, Y, lo, hi, labelX, skip) {
    var s = '';
    for (var v = lo; v <= hi; v += 10) s += '<line x1="' + L + '" x2="' + Rx + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="#EDF0F4"/>';
    GRADES[m.level].forEach(function (x) { if (x[0] > lo && x[0] < hi) s += '<line x1="' + L + '" x2="' + Rx + '" y1="' + Y(x[0]) + '" y2="' + Y(x[0]) + '" stroke="#9aa3b1" stroke-opacity=".55" stroke-dasharray="3 3"/>' + (skip != null && Math.abs(x[0] - skip) <= 4 ? '' : '<text x="' + (labelX + 4) + '" y="' + (Y(x[0]) + 3) + '" text-anchor="start" font-size="8.5" fill="#7a8494">Grade ' + x[1] + '</text>'); });
    return s;
  }
  // Một biểu đồ, một trục điểm: bên trái cột điểm từng kỹ năng của Mock này + đường ngang Overall;
  // bên phải đường Overall qua các Mock (mỗi chấm ghi tên Mock và điểm). Đường Grade chạy xuyên cả hai bên.
  function combinedChart(m) {
    var W = 500, H = 232, L = 28, BX = 246, DX = 256, PL = 272, PR = 452, T = 30, B = 50, r = ranges(m), lo = r.lo, hi = r.hi, n = m.skills.length, T0 = THEME[m.level], OVC = T0.d;
    var Y = function (v) { return T + (hi - v) * (H - T - B) / (hi - lo); }, cw = (BX - L) / n, bw = Math.min(36, cw * .56);
    var halo = ' paint-order="stroke" stroke="#fff" stroke-width="3" stroke-linejoin="round"';
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">';
    s += '<text x="' + L + '" y="12" font-size="10.5" font-weight="600" fill="#5B6576">This mock: score by skill</text><text x="' + PL + '" y="12" font-size="10.5" font-weight="600" fill="#5B6576">Overall across mocks</text>';
    for (var v = lo; v <= hi; v += 10) s += '<text x="' + (L - 5) + '" y="' + (Y(v) + 3) + '" text-anchor="end" font-size="9" fill="#9aa3b1">' + v + '</text>';
    s += gridLines(m, L, W - 40, Y, lo, hi, W - 40, null);
    s += '<line x1="' + DX + '" x2="' + DX + '" y1="' + (T - 6) + '" y2="' + Y(lo) + '" stroke="#E3E7ED"/>';
    m.skills.forEach(function (sk, i) {
      var cx = L + cw * i + cw / 2, ink = T0.skill[sk.id].ink, y = sk.scale == null ? Y(lo) : Y(sk.scale);
      if (sk.scale != null) s += '<path d="M' + (cx - bw / 2) + ',' + Y(lo) + ' V' + (y + 4) + ' a4,4 0 0 1 4,-4 h' + (bw - 8) + ' a4,4 0 0 1 4,4 V' + Y(lo) + ' Z" fill="' + ink + '" fill-opacity=".38" stroke="' + ink + '" stroke-width="1.3" stroke-opacity=".9"/>';
      var words = sk.name.replace(/^Use of /, 'Use of|').split('|');
      words.forEach(function (w, k) { s += '<text x="' + cx + '" y="' + (Y(lo) + 13 + k * 10) + '" text-anchor="middle" font-size="9.5" fill="#3a4457">' + esc(w) + '</text>'; });
      s += '<text x="' + cx + '" y="' + (Y(lo) + 14 + words.length * 10 + 2) + '" text-anchor="middle" font-size="12" font-weight="700" fill="#172033">' + (sk.scale == null ? 'n/a' : sk.scale) + '</text>';
    });
    if (m.overall.scale != null) {
      var yo = Y(m.overall.scale);
      s += '<line x1="' + L + '" x2="' + BX + '" y1="' + yo + '" y2="' + yo + '" stroke="' + OVC + '" stroke-width="2.4"/><text x="' + BX + '" y="' + (yo - 5) + '" text-anchor="end" font-size="9.5" font-weight="700" fill="' + OVC + '"' + halo + '>Overall ' + m.overall.scale + '</text>';
    }
    var hist = m.history.filter(function (h) { return h.overall != null; }), k = Math.max(hist.length, 2);
    var X = function (i) { return hist.length === 1 ? (PL + PR) / 2 : PL + 10 + i * (PR - PL - 20) / (k - 1); };
    if (hist.length > 1) s += '<polyline points="' + hist.map(function (h, i) { return X(i) + ',' + Y(h.overall); }).join(' ') + '" fill="none" stroke="' + OVC + '" stroke-width="2.4" stroke-linejoin="round"/>';
    hist.forEach(function (h, i) {
      var cur = i === hist.length - 1, x = X(i), y = Y(h.overall), up = y - 10 > T + 10;
      s += '<circle cx="' + x + '" cy="' + y + '" r="' + (cur ? 5.2 : 3.8) + '" fill="' + (cur ? OVC : '#fff') + '" stroke="' + OVC + '" stroke-width="2"/>';
      s += '<text x="' + x + '" y="' + (y - (up ? 20 : -16)) + '" text-anchor="middle" font-size="8.5" fill="#5B6576"' + halo + '>' + esc(h.label) + '</text>';
      s += '<text x="' + x + '" y="' + (y - (up ? 9 : -27)) + '" text-anchor="middle" font-size="11" font-weight="700" fill="' + OVC + '"' + halo + '>' + h.overall + '</text>';
    });
    if (hist.length <= 1) s += '<text x="' + ((PL + PR) / 2) + '" y="' + (Y(lo) - 10) + '" text-anchor="middle" font-size="9" fill="#7a8494">Baseline: the line starts from Mock 2</text>';
    return s + '</svg>';
  }
  function trendNote(m) {
    var h = m.history.filter(function (x) { return x.overall != null; });
    if (h.length < 2) return '<div class="pt-sum">This is your Baseline. Every later mock will be compared with it.<small class="vi">Đây là mốc xuất phát. Các Mock sau sẽ được so với mốc này.</small></div>';
    var d = h[h.length - 1].overall - h[0].overall, a = Math.abs(d), pt = a === 1 ? 'point' : 'points';
    var en = d > 0 ? 'Overall rose ' + a + ' Scale ' + pt + ' across ' + h.length + ' mocks.' : d < 0 ? 'Overall is ' + a + ' Scale ' + pt + ' lower than Mock 1.' : 'Overall is the same as Mock 1.';
    var vi = d > 0 ? 'Overall tăng ' + a + ' điểm Scale sau ' + h.length + ' Mock.' : d < 0 ? 'Overall thấp hơn Mock 1 là ' + a + ' điểm Scale.' : 'Overall bằng Mock 1.';
    return '<div class="pt-sum">' + en + '<small class="vi">' + vi + '</small></div>';
  }

  function skillCard(m, sk) {
    var t = THEME[m.level].skill[sk.id];
    if (sk.empty || sk.raw == null) {
      return '<div class="pt-sk" style="background:' + t.bg + ';--ink:' + t.ink + '"><h2>' + ttl(sk.name, VI[sk.id]) + '</h2><div class="pt-none">' + esc(sk.emptyNote || 'No score yet') + '<small class="vi">' + esc(sk.emptyVi || 'Chưa có điểm') + '</small></div></div>';
    }
    var rows = sk.parts.map(function (p) {
      var f = p.n ? p.v / p.n : 0;
      return '<div class="pt-pr"><span>' + esc(p.name) + '</span><div class="pt-bar"><i style="width:' + Math.max(f * 100, 3) + '%;background:' + t.ink + ';opacity:.6"></i></div><b>' + p.v + '/' + p.n + '</b>' + delta(m.first ? null : p.d) + '</div>';
    }).join('');
    var g = sk.scale == null ? '' : gradeOf(m.level, sk.scale);
    var gtxt = sk.scale == null ? 'No Scale yet' : (g ? 'Grade ' + g : 'Below Grade C');
    return '<div class="pt-sk" style="background:' + t.bg + ';--ink:' + t.ink + '"><h2>' + ttl(sk.name, VI[sk.id]) + '</h2><div class="pt-gr">' + gtxt + '</div>'
      + '<div class="pt-sc"><b>' + (sk.scale == null ? '&mdash;' : (sk.est ? '~' : '') + sk.scale) + '</b><span>Scale</span>' + delta(m.first ? null : sk.d) + '</div><div class="pt-raw">' + sk.raw + ' / ' + sk.max + ' marks</div>' + rows + '</div>';
  }

  function spkOf(m) { return (m.speaking && window.SpeakingDiagnosis) ? (m._spk || (m._spk = window.SpeakingDiagnosis.pick(m.level, m.speaking))) : null; }

  function overview(m) {
    var o = m.overall, has = o.scale != null, nx = has ? nextGrade(m.level, o.scale) : null, g = has ? gradeOf(m.level, o.scale) : '';
    var pl = function (n) { return n + (n === 1 ? ' Scale point' : ' Scale points'); };
    var cmt = m.comment + (spkOf(m) && spkOf(m).strength ? ' Điểm mạnh ở Speaking: ' + spkOf(m).strength.replace(/^Em /, 'em ') : '');
    var ovt = !has ? 'Scores will appear once all skills are graded.' : m.first
      ? 'First mock: this is your starting point.' + (nx ? ' Target for Mock 2: reach Grade ' + nx[1] + ' (' + nx[0] + '), ' + pl(nx[0] - o.scale) + ' away.' : '')
      : (nx ? pl(nx[0] - o.scale) + ' to reach Grade ' + nx[1] + '.' : 'Top grade reached.');
    return '<div class="pt-page" style="' + styleVars(m) + '">' + head(m, ['Performance Overview', 'Tổng quan kết quả']) + '<div class="pt-main">'
      + '<div class="pt-r1"><div class="pt-ov"><small>OVERALL</small><div class="pt-ovn"><b>' + (has ? o.scale : '&mdash;') + '</b><span>Scale</span></div><div class="pt-ovg">' + (!has ? 'Waiting for scores' : (g ? 'Grade ' + g : 'Below Grade C')) + '</div>'
      + (m.first ? '<span class="pt-d n">' + (o.partial ? 'Provisional' : 'Baseline') + '</span>' : delta(o.d, ' vs previous mock'))
      + '<div class="pt-ovt">' + esc(ovt) + '</div></div>'
      + '<div class="pt-ch"><h3>' + ttl('Skills & Progress', 'Kỹ năng và tiến bộ') + '<span>Cambridge English Scale</span></h3><div class="pt-cc">' + combinedChart(m) + '</div>' + trendNote(m) + '</div></div>'
      + '<div class="pt-skills">' + m.skills.map(function (s) { return skillCard(m, s); }).join('') + '</div>'
      + '<div class="pt-r3"><div class="pt-cm"><h3>' + ttl('Teacher\'s Overall Comment', 'Nhận xét tổng thể của giáo viên') + '</h3><p' + (cmt.length > 330 ? ' style="font-size:' + (cmt.length > 440 ? '11px;line-height:1.45' : '11.5px;line-height:1.5') + '"' : '') + '>' + esc(cmt) + '</p></div>'
      + '<div class="pt-pr3"><h3>' + ttl('Top 3 Priorities', '3 ưu tiên tiếp theo') + '</h3><ol>' + m.priorities.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol></div></div>'
      + '</div>' + foot(m, 1) + '</div>';
  }

  // ---- Trang 2: Learning Diagnosis (không lặp lại bảng điểm Part)
  function diagnosis(m) {
    var T0 = THEME[m.level], D = m.diagnosis;
    var gap = m.skills.map(function (sk) {
      var t = T0.skill[sk.id];
      if (sk.empty || sk.scale == null) return '<tr><td><i style="background:' + t.ink + '"></i>' + esc(sk.name) + '</td><td><b>-</b></td><td colspan="2" style="color:#6B7280">Not graded yet</td></tr>';
      var nx = nextGrade(m.level, sk.scale), need = nx ? nx[0] - sk.scale : 0;
      return '<tr><td><i style="background:' + t.ink + '"></i>' + esc(sk.name) + '</td><td><b>' + sk.scale + '</b></td><td>' + gradeBadge(m.level, sk.scale) + '</td><td>' + (nx ? '<span class="pt-need" style="background:' + t.bg + ';color:' + t.ink + '">+' + need + '</span> to Grade ' + nx[1] : 'Top grade reached') + '</td></tr>';
    }).join('');
    var SD = spkOf(m);
    var allCauses = D.causes.filter(function (c) { return !(SD && c.skill === 'speaking'); });
    if (SD && SD.areas.length) allCauses.push({ skill: 'speaking', title: SD.title, body: SD.areas.map(function (x, i) { return x.text + (i === 0 && x.part ? ' Thể hiện rõ nhất ở ' + x.part + '.' : ''); }).join(' '), fix: SD.next });
    var causes = allCauses.map(function (c) {
      var t = T0.skill[c.skill] || { bg: T0.soft, ink: T0.d };
      return '<div class="pt-ca" style="background:' + t.bg + '"><h4 style="color:' + t.ink + '">' + esc(c.title) + '</h4><p>' + esc(c.body) + '</p><div class="fx"><b>How to fix:</b> ' + esc(c.fix) + '</div></div>';
    }).join('');
    var wr = D.writingGroups.map(function (g) { return '<div class="pt-wg"><span class="dot" style="background:' + g.mau + '"></span><b>' + g.n + '</b> ' + esc(g.ten) + '<small>' + esc(g.note) + '</small></div>'; }).join('');
    var wrong = D.wrong.map(function (w) {
      var t = T0.skill[w.skill];
      return '<div class="pt-wq"><h5 style="color:' + t.ink + '">' + esc(w.name) + '</h5>' + w.items.map(function (x) { return '<span class="chip" style="background:' + t.bg + '">' + esc(x) + '</span>'; }).join('') + '</div>';
    }).join('');
    return '<div class="pt-page" style="' + styleVars(m) + '">' + head(m, ['Results Analysis & Improvement Plan', 'Phân tích kết quả và hướng cải thiện - Tổng quan ' + m.skills.length + ' kỹ năng']) + '<div class="pt-main' + (allCauses.length >= 5 ? ' pt-tight' : '') + '">'
      + '<div class="pt-sec"><h3>' + ttl('Path to the Next Grade', 'Lộ trình lên Grade tiếp theo') + '</h3><table class="pt-gap"><tr><th>Skill</th><th>Scale</th><th>Current level</th><th>Needed</th></tr>' + gap + '</table></div>'
      + '<div class="pt-sec"><h3>' + ttl('Why Points Are Being Lost', 'Vì sao em đang mất điểm') + '</h3><div class="pt-cas">' + causes + '</div></div>'
      + '<div class="pt-two"><div class="pt-sec"><h3>' + ttl('Repeated Writing Errors', 'Lỗi Writing lặp lại') + '</h3>' + wr + '</div><div class="pt-sec"><h3>' + ttl('Test-taking Habits', 'Thói quen làm bài') + '</h3><ul class="pt-hb">' + D.habits.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div></div>'
      + '<div class="pt-sec"><h3>' + ttl('Questions to Review', 'Câu cần xem lại (câu: em chọn, đáp án đúng)') + '</h3><div class="pt-wrs">' + wrong + '</div></div>'
      + '</div>' + foot(m, 2) + '</div>';
  }
  return { THEME: THEME, GRADES: GRADES, gradeOf: gradeOf, nextGrade: nextGrade, overview: overview, diagnosis: diagnosis };
});
