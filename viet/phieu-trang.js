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
  var THEME = {
    KET: { a: '#019EA5', d: '#0B6F74', soft: '#E4F5F5', skill: {
      reading: { bg: '#DDF2F2', ink: '#0E7378' }, listening: { bg: '#E0EAFA', ink: '#3660AE' }, writing: { bg: '#E0F4E5', ink: '#2F7F4C' }, speaking: { bg: '#FDF0D5', ink: '#9A6A12' } } },
    PET: { a: '#EB6383', d: '#9E1B32', soft: '#FDEBEF', skill: {
      reading: { bg: '#FBDFE6', ink: '#A3203F' }, listening: { bg: '#FDE9D8', ink: '#B4581B' }, writing: { bg: '#EDE2F8', ink: '#6B3FA0' }, speaking: { bg: '#FBF1D2', ink: '#8F6A0B' } } },
    FCE: { a: '#99CB38', d: '#4F7A12', soft: '#F0F8DE', skill: {
      reading: { bg: '#E8F4CC', ink: '#557A16' }, uoe: { bg: '#FBF4C6', ink: '#8A6D0B' }, listening: { bg: '#D9F1E5', ink: '#1F7A55' }, writing: { bg: '#DCEBF8', ink: '#2B62A0' }, speaking: { bg: '#FCE5D8', ink: '#B4501F' } } }
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
    if (v == null) return '<span class="pt-d n">mới</span>';
    if (v > 0) return '<span class="pt-d u">&#9650; ' + v + (unit || '') + '</span>';
    if (v < 0) return '<span class="pt-d dn">&#9660; ' + Math.abs(v) + (unit || '') + '</span>';
    return '<span class="pt-d n">= 0</span>';
  }
  function styleVars(m) { var t = THEME[m.level]; return '--a:' + t.a + ';--d:' + t.d + ';--soft:' + t.soft; }
  function head(m, title) {
    return '<div class="pt-head"><div><small>RUBY SCHOOL · CAMBRIDGE ' + esc(m.level) + '</small><h1>' + esc(title) + '</h1></div><div class="pt-ex">' + esc(m.exam) + '<span>Ngày chấm ' + esc(m.date) + '</span></div></div>'
      + '<div class="pt-who"><div><span>Họ và tên</span><b>' + esc(m.student.name) + '</b></div><div><span>Mã học sinh</span><b>' + esc(m.student.id) + '</b></div><div><span>Lớp</span><b>' + esc(m.student.cls) + '</b></div></div>';
  }
  function foot(m, n) { return '<div class="pt-foot"><span>Điểm Scale theo bảng Cambridge English Scale của ' + esc(m.level) + '. Grade A/B/C tính từ Scale. Trang ' + n + '/4</span><span>Ruby School</span></div>'; }

  // ---- Biểu đồ 5 Mock (SVG): từng kỹ năng + đường Overall + vạch Grade
  function chart(m) {
    var W = 470, H = 214, L = 34, R = 44, T = 14, B = 26, T0 = THEME[m.level], n = m.history.length;
    var vals = []; m.history.forEach(function (h) { m.skills.forEach(function (s) { vals.push(h.s[s.id]); }); vals.push(h.overall); });
    var g = GRADES[m.level].map(function (x) { return x[0]; });
    var lo = Math.floor((Math.min.apply(null, vals) - 4) / 5) * 5, hi = Math.ceil((Math.max.apply(null, vals) + 4) / 5) * 5;
    var X = function (i) { return L + i * (W - L - R) / (n - 1); }, Y = function (v) { return T + (hi - v) * (H - T - B) / (hi - lo); };
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">';
    for (var v = lo; v <= hi; v += 10) s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="#EDF0F4"/><text x="' + (L - 6) + '" y="' + (Y(v) + 3) + '" text-anchor="end" font-size="9" fill="#9aa3b1">' + v + '</text>';
    GRADES[m.level].forEach(function (x) { if (x[0] > lo && x[0] < hi) s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(x[0]) + '" y2="' + Y(x[0]) + '" stroke="' + T0.d + '" stroke-opacity=".35" stroke-dasharray="4 3"/><text x="' + (W - R + 4) + '" y="' + (Y(x[0]) + 3) + '" font-size="9" fill="' + T0.d + '">Grade ' + x[1] + '</text>'; });
    m.history.forEach(function (h, i) { s += '<text x="' + X(i) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="9.5" fill="#5B6576">' + esc(h.label) + '</text>'; });
    m.skills.forEach(function (sk) {
      var ink = T0.skill[sk.id].ink, pts = m.history.map(function (h, i) { return X(i) + ',' + Y(h.s[sk.id]); });
      s += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + ink + '" stroke-opacity=".75" stroke-width="1.6"/>';
      m.history.forEach(function (h, i) { s += '<circle cx="' + X(i) + '" cy="' + Y(h.s[sk.id]) + '" r="2.4" fill="#fff" stroke="' + ink + '" stroke-width="1.4"/>'; });
    });
    var op = m.history.map(function (h, i) { return X(i) + ',' + Y(h.overall); });
    s += '<polyline points="' + op.join(' ') + '" fill="none" stroke="' + T0.d + '" stroke-width="3" stroke-linejoin="round"/>';
    m.history.forEach(function (h, i) { s += '<circle cx="' + X(i) + '" cy="' + Y(h.overall) + '" r="4" fill="' + T0.d + '"/>'; if (i === n - 1 || i === 0) s += '<text x="' + (X(i) + (i === n - 1 ? 2 : 0)) + '" y="' + (Y(h.overall) - 8) + '" text-anchor="' + (i === n - 1 ? 'end' : 'middle') + '" font-size="10.5" font-weight="700" fill="' + T0.d + '">' + h.overall + '</text>'; });
    return s + '</svg>';
  }

  function skillCard(m, sk) {
    var t = THEME[m.level].skill[sk.id];
    var rows = sk.parts.map(function (p) {
      var f = p.n ? p.v / p.n : 0;
      return '<div class="pt-pr"><span>' + esc(p.name) + '</span><div class="pt-bar"><i style="width:' + Math.max(f * 100, 3) + '%;background:' + t.ink + '"></i></div><b>' + p.v + '/' + p.n + '</b>' + delta(p.d) + '</div>';
    }).join('');
    var g = gradeOf(m.level, sk.scale);
    return '<div class="pt-sk" style="background:' + t.bg + ';--ink:' + t.ink + '"><h2>' + esc(sk.name) + '</h2><div class="pt-gr">' + (g ? 'Grade ' + g : 'Chưa đạt C') + '</div>'
      + '<div class="pt-sc"><b>' + sk.scale + '</b><span>Scale</span>' + delta(sk.d) + '</div><div class="pt-raw">' + sk.raw + ' / ' + sk.max + ' điểm</div>' + rows + '</div>';
  }

  function overview(m) {
    var T0 = THEME[m.level], o = m.overall, gb = gradeBadge(m.level, o.scale), nx = nextGrade(m.level, o.scale);
    var legend = m.skills.map(function (sk) { return '<span><i style="background:' + T0.skill[sk.id].ink + '"></i>' + esc(sk.name) + '</span>'; }).join('') + '<span class="ov"><i style="background:' + T0.d + '"></i>Overall</span>';
    return '<div class="pt-page" style="' + styleVars(m) + '">' + head(m, 'Performance Overview') + '<div class="pt-main">'
      + '<div class="pt-r1"><div class="pt-ov"><small>OVERALL</small><div class="pt-ovn"><b>' + o.scale + '</b><span>Scale</span></div><div class="pt-ovg">' + gb + '</div>' + delta(o.d, ' so với Mock trước')
      + '<div class="pt-ovt">' + (nx ? 'Còn ' + (nx[0] - o.scale) + ' điểm Scale để lên Grade ' + nx[1] + '.' : 'Đã đạt mức Grade cao nhất.') + '</div></div>'
      + '<div class="pt-ch"><h3>Tiến bộ qua ' + m.history.length + ' Mock <span>điểm Scale</span></h3>' + chart(m) + '<div class="pt-lg">' + legend + '</div></div></div>'
      + '<div class="pt-skills">' + m.skills.map(function (s) { return skillCard(m, s); }).join('') + '</div>'
      + '<div class="pt-r3"><div class="pt-cm"><h3>Nhận xét tổng thể của giáo viên</h3><p>' + esc(m.comment) + '</p></div>'
      + '<div class="pt-pr3"><h3>3 ưu tiên tiếp theo</h3><ol>' + m.priorities.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol></div></div>'
      + '</div>' + foot(m, 1) + '</div>';
  }

  // ---- Trang 2: Learning Diagnosis (không lặp lại bảng điểm Part)
  function diagnosis(m) {
    var T0 = THEME[m.level], D = m.diagnosis;
    var gap = m.skills.map(function (sk) {
      var nx = nextGrade(m.level, sk.scale), t = T0.skill[sk.id], need = nx ? nx[0] - sk.scale : 0;
      return '<tr><td><i style="background:' + t.ink + '"></i>' + esc(sk.name) + '</td><td><b>' + sk.scale + '</b></td><td>' + gradeBadge(m.level, sk.scale) + '</td><td>' + (nx ? '<span class="pt-need" style="background:' + t.bg + ';color:' + t.ink + '">+' + need + '</span> lên Grade ' + nx[1] : 'Đã đạt cao nhất') + '</td></tr>';
    }).join('');
    var causes = D.causes.map(function (c) {
      var t = T0.skill[c.skill] || { bg: T0.soft, ink: T0.d };
      return '<div class="pt-ca" style="background:' + t.bg + '"><h4 style="color:' + t.ink + '">' + esc(c.title) + '</h4><p>' + esc(c.body) + '</p><div class="fx"><b>Cách sửa:</b> ' + esc(c.fix) + '</div></div>';
    }).join('');
    var wr = D.writingGroups.map(function (g) { return '<div class="pt-wg"><span class="dot" style="background:' + g.mau + '"></span><b>' + g.n + '</b> lỗi ' + esc(g.ten) + '<small>' + esc(g.note) + '</small></div>'; }).join('');
    var wrong = D.wrong.map(function (w) {
      var t = T0.skill[w.skill];
      return '<div class="pt-wq"><h5 style="color:' + t.ink + '">' + esc(w.name) + '</h5>' + w.items.map(function (x) { return '<span class="chip" style="background:' + t.bg + '">' + esc(x) + '</span>'; }).join('') + '</div>';
    }).join('');
    return '<div class="pt-page" style="' + styleVars(m) + '">' + head(m, 'Learning Diagnosis') + '<div class="pt-main">'
      + '<div class="pt-sec"><h3>Khoảng cách tới Grade tiếp theo</h3><table class="pt-gap"><tr><th>Kỹ năng</th><th>Scale</th><th>Mức hiện tại</th><th>Cần thêm</th></tr>' + gap + '</table></div>'
      + '<div class="pt-sec"><h3>Vì sao em đang mất điểm</h3><div class="pt-cas">' + causes + '</div></div>'
      + '<div class="pt-two"><div class="pt-sec"><h3>Lỗi Writing lặp lại</h3>' + wr + '</div><div class="pt-sec"><h3>Thói quen làm bài</h3><ul class="pt-hb">' + D.habits.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div></div>'
      + '<div class="pt-sec"><h3>Câu cần xem lại <small>(số câu: đáp án em chọn, đáp án đúng)</small></h3><div class="pt-wrs">' + wrong + '</div></div>'
      + '</div>' + foot(m, 2) + '</div>';
  }
  return { THEME: THEME, GRADES: GRADES, gradeOf: gradeOf, overview: overview, diagnosis: diagnosis };
});
