/*
 * Phiếu IELTS 2 trang cho phụ huynh (BẢN XEM TRƯỚC, chưa gắn vào app).
 *   PhieuIelts.page1(m) -> HTML trang 1: Performance Overview (Overall band, biểu đồ, 4 kỹ năng, nhận xét, 3 ưu tiên)
 *   PhieuIelts.page2(m) -> HTML trang 2: điểm thành phần Writing, Speaking + ô feedback cho từng kỹ năng
 * Band do bên thứ ba chấm sẵn, giáo viên nhập; Overall = trung bình 4 kỹ năng làm tròn 0.5 theo quy tắc IELTS.
 * Dùng chung CSS với các phiếu khác (viet/phieu-trang.css) và viet/phieu-ielts.css. A4 = 794 x 1123 px.
 */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else root.PhieuIelts = f(); })(typeof self !== 'undefined' ? self : this, function () {
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var SKILL = {
    listening: { bg: '#FCEBDC', ink: '#D08A52', en: 'Listening', vi: 'Nghe hiểu' }, reading: { bg: '#E6EEFB', ink: '#5B84C4', en: 'Reading', vi: 'Đọc hiểu' },
    writing: { bg: '#EDE7F8', ink: '#8A74BC', en: 'Writing', vi: 'Viết' }, speaking: { bg: '#FBF2D2', ink: '#C9A23A', en: 'Speaking', vi: 'Nói' } };
  var ORDER = ['listening', 'reading', 'writing', 'speaking'];
  var THEME = { a: '#3E63B8', d: '#243F85', soft: '#E9EFFB' };
  // tiêu chí thành phần (band 0-9, bước 0.5)
  var CRIT = {
    writing: [['TA', 'Task Achievement / Response', 'Trả lời đúng và đủ yêu cầu đề'], ['CC', 'Coherence & Cohesion', 'Mạch lạc, liên kết ý'], ['LR', 'Lexical Resource', 'Từ vựng'], ['GRA', 'Grammatical Range & Accuracy', 'Ngữ pháp']],
    speaking: [['FC', 'Fluency & Coherence', 'Trôi chảy, mạch lạc'], ['LR', 'Lexical Resource', 'Từ vựng'], ['GRA', 'Grammatical Range & Accuracy', 'Ngữ pháp'], ['P', 'Pronunciation', 'Phát âm']] };
  var ttl = function (en, vi) { return '<span class="tt">' + esc(en) + '<small class="vi">' + esc(vi) + '</small></span>'; };
  var fmt = function (v) { return v == null ? '-' : Number(v).toFixed(1); };
  // Overall IELTS: trung bình 4 kỹ năng, .25 làm tròn lên .5, .75 làm tròn lên số nguyên kế tiếp
  function overallOf(b) { var v = ORDER.map(function (k) { return b[k]; }); if (v.some(function (x) { return x == null; })) return null; var a = v.reduce(function (s, x) { return s + x; }, 0) / 4; return Math.floor(a * 2 + 0.5) / 2; }
  // CEFR gần đúng theo bảng đối chiếu chung của Cambridge/IELTS
  function cefr(b) { if (b == null) return ''; return b >= 8.5 ? 'C2' : b >= 7 ? 'C1' : b >= 5.5 ? 'B2' : b >= 4 ? 'B1' : 'A2'; }
  function head(m, title) {
    return '<div class="pt-head"><div><small>RUBY SCHOOL · IELTS</small><h1>' + ttl(title[0], title[1]) + '</h1></div><div class="pt-ex">' + esc(m.exam) + '<span>Graded ' + esc(m.date) + '</span></div></div>'
      + '<div class="pt-who"><div><span>Student</span><b>' + esc(m.student.name) + '</b></div><div><span>Student ID</span><b>' + esc(m.student.id) + '</b></div><div><span>Class</span><b>' + esc(m.student.cls) + '</b></div></div>';
  }
  function foot(n) { return '<div class="pt-foot"><span>Band scores come from the IELTS test provider. Overall = average of 4 skills, rounded to 0.5. CEFR is approximate. Page ' + n + '/2</span><span style="white-space:nowrap">Ruby School</span></div>'; }
  function delta(v) {
    if (v == null) return '';
    if (v > 0) return '<span class="pt-d u">&#9650; ' + fmt(v) + '</span>'; if (v < 0) return '<span class="pt-d dn">&#9660; ' + fmt(Math.abs(v)) + '</span>'; return '<span class="pt-d n">= 0</span>';
  }
  // biểu đồ: cột band từng kỹ năng (trục 4 - 9), đường Overall, đường mục tiêu; bên phải Overall qua các Mock
  function chart(m) {
    var lo = 4, hi = 9, W = 318, H = 300, T = 16, B = 46, L = 28, Y = function (v) { return T + (hi - v) / (hi - lo) * (H - T - B); }, s = '';
    for (var v = lo; v <= hi; v += 1) s += '<line x1="' + L + '" x2="' + (W - 4) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="#EDF0F4"/><text x="' + (L - 5) + '" y="' + (Y(v) + 3) + '" font-size="9" fill="#7a8494" text-anchor="end">' + v + '</text>';
    var bw = 38, gap = (W - L - 8 - bw * 4) / 4;
    ORDER.forEach(function (k, i) {
      var t = SKILL[k], x = L + 6 + gap / 2 + i * (bw + gap), b = m.bands[k], y = Y(Math.max(b, lo));
      s += '<rect x="' + x + '" y="' + y + '" width="' + bw + '" height="' + (Y(lo) - y) + '" rx="5" fill="' + t.bg + '" stroke="' + t.ink + '"/>'
        + '<text x="' + (x + bw / 2) + '" y="' + (Y(lo) + 13) + '" font-size="9.5" fill="#3a4457" text-anchor="middle">' + t.en + '</text><text x="' + (x + bw / 2) + '" y="' + (Y(lo) + 27) + '" font-size="12" font-weight="700" fill="#172033" text-anchor="middle">' + fmt(b) + '</text>';
    });
    s += '<line x1="' + L + '" x2="' + (W - 4) + '" y1="' + Y(m.overall) + '" y2="' + Y(m.overall) + '" stroke="' + THEME.d + '" stroke-width="2"/><text x="' + (W - 6) + '" y="' + (Y(m.overall) - 4) + '" font-size="9.5" font-weight="700" fill="' + THEME.d + '" text-anchor="end">Overall ' + fmt(m.overall) + '</text>';
    if (m.target) s += '<line x1="' + L + '" x2="' + (W - 4) + '" y1="' + Y(m.target) + '" y2="' + Y(m.target) + '" stroke="#9aa3b1" stroke-dasharray="3 3"/><text x="' + (L + 3) + '" y="' + (Y(m.target) - 3) + '" font-size="9" fill="#7a8494">Target ' + fmt(m.target) + '</text>';
    var left = '<svg viewBox="0 0 ' + W + ' ' + H + '">' + s + '</svg>';
    // phải: Overall qua các Mock
    var pts = (m.history || []).concat([{ label: m.mockLabel, overall: m.overall }]), W2 = 250, r = '';
    for (var v2 = lo; v2 <= hi; v2 += 1) r += '<line x1="30" x2="' + (W2 - 6) + '" y1="' + Y(v2) + '" y2="' + Y(v2) + '" stroke="#EDF0F4"/>';
    var n = pts.length, X = function (i) { return n === 1 ? (W2 + 24) / 2 : 44 + i * ((W2 - 64) / (n - 1)); }, path = '';
    pts.forEach(function (p, i) { path += (i ? 'L' : 'M') + X(i) + ' ' + Y(p.overall) + ' '; });
    if (m.target) r += '<line x1="30" x2="' + (W2 - 6) + '" y1="' + Y(m.target) + '" y2="' + Y(m.target) + '" stroke="#9aa3b1" stroke-dasharray="3 3"/><text x="32" y="' + (Y(m.target) - 3) + '" font-size="9" fill="#7a8494">Target ' + fmt(m.target) + '</text>';
    r += '<path d="' + path + '" fill="none" stroke="' + THEME.d + '" stroke-width="2"/>';
    pts.forEach(function (p, i) { var last = i === n - 1; r += '<circle cx="' + X(i) + '" cy="' + Y(p.overall) + '" r="' + (last ? 5 : 4) + '" fill="' + (last ? THEME.a : '#fff') + '" stroke="' + THEME.d + '" stroke-width="2"/><text x="' + X(i) + '" y="' + (Y(p.overall) - 9) + '" font-size="11" font-weight="700" fill="' + THEME.d + '" text-anchor="middle">' + fmt(p.overall) + '</text><text x="' + X(i) + '" y="' + (Y(lo) + 13) + '" font-size="9.5" fill="#3a4457" text-anchor="middle">' + esc(p.label) + '</text>'; });
    return '<div class="pt-cc" style="display:grid;grid-template-columns:318fr 250fr;gap:6px"><div><div class="pt-ct">This mock: band by skill</div>' + left + '</div><div><div class="pt-ct">Overall across mocks</div><svg viewBox="0 0 ' + W2 + ' ' + H + '">' + r + '</svg></div></div>';
  }
  function skillCard(m, k) {
    var t = SKILL[k], b = m.bands[k], d = m.deltas && m.deltas[k], raw = m.raw && m.raw[k];
    return '<div class="pt-sk" style="background:' + t.bg + ';--ink:' + t.ink + '"><h2>' + esc(t.en) + '</h2><div style="font-size:10.5px;color:' + t.ink + '">' + esc(t.vi) + '</div>'
      + '<span class="pt-gr">&asymp; CEFR ' + cefr(b) + '</span><div class="pt-sc"><b>' + fmt(b) + '</b><span>Band</span>' + (d != null ? delta(d) : '') + '</div>'
      + (raw ? '<div class="pt-raw">' + esc(raw) + '</div>' : '<div class="pt-raw">&nbsp;</div>') + '</div>';
  }
  // bảng band từng kỹ năng qua các Mock (chỉ hiện khi có Mock trước)
  function trend(m) {
    var H = m.history || []; if (!H.length || !H[H.length - 1].bands) return '';
    var prev = H[H.length - 1], rows = ORDER.map(function (k) {
      var t = SKILL[k], a = prev.bands[k], b = m.bands[k], d = a != null && b != null ? b - a : null;
      return '<tr><td><i style="background:' + t.ink + '"></i>' + esc(t.en) + '</td><td>' + fmt(a) + '</td><td><b>' + fmt(b) + '</b></td><td>' + (d == null ? '' : delta(d)) + '</td><td class="q">' + (b != null && m.target ? (b >= m.target ? 'Target reached' : fmt(m.target - b) + ' to target') : '') + '</td></tr>';
    }).join('');
    return '<div class="pt-sec"><h3>' + ttl('Progress by Skill', 'Tiến bộ từng kỹ năng so với mock trước') + '</h3><table class="pt-gap"><tr><th>Skill</th><th>' + esc(prev.label) + '</th><th>' + esc(m.mockLabel) + '</th><th>Change</th><th>Target ' + fmt(m.target) + '</th></tr>' + rows + '</table></div>';
  }
  function page1(m) {
    var cmt = m.comment || '', nx = m.target && m.overall < m.target ? fmt(m.target - m.overall) + ' band to reach the target ' + fmt(m.target) + '.' : (m.target ? 'Target reached.' : '');
    return '<div class="pt-page" style="--a:' + THEME.a + ';--d:' + THEME.d + ';--soft:' + THEME.soft + '">' + head(m, ['Performance Overview', 'Tổng quan kết quả']) + '<div class="pt-main">'
      + '<div class="pt-r1" style="grid-template-columns:190px 1fr"><div class="pt-ov" style="background:' + THEME.soft + ';border-color:' + THEME.d + '"><small style="color:' + THEME.d + '">OVERALL</small><div class="pt-ovn"><b style="color:' + THEME.d + '">' + fmt(m.overall) + '</b><span>Band</span></div><div class="pt-ovg" style="color:' + THEME.d + '">&asymp; CEFR ' + cefr(m.overall) + '</div>' + delta(m.overallDelta) + '<div class="pt-ovt">' + esc(nx) + '</div></div>'
      + '<div class="pt-ch"><h3>' + ttl('Skills & Progress', 'Kỹ năng và tiến bộ') + '<span>IELTS Band</span></h3>' + chart(m) + '</div></div>'
      + '<div class="pt-skills">' + ORDER.map(function (k) { return skillCard(m, k); }).join('') + '</div>' + trend(m)
      + '<div class="pt-r3"><div class="pt-cm"><h3>' + ttl("Teacher's Overall Comment", 'Nhận xét tổng thể của giáo viên') + '</h3><p style="font-size:' + (cmt.length > 520 ? '12px;line-height:1.55' : '13px;line-height:1.7') + '">' + esc(cmt) + '</p></div>'
      + '<div class="pt-pr3"><h3>' + ttl('Top 3 Priorities', '3 ưu tiên tiếp theo') + '</h3><ol>' + (m.priorities || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol></div></div>'
      + '</div>' + foot(1) + '</div>';
  }
  // ô feedback: giáo viên ghi điểm mạnh, điểm yếu, action plan cho từng bạn
  function fb(k, f) {
    f = f || {}; var rows = [['Strengths', 'Điểm mạnh', '#2A7A47', f.s], ['Weaknesses', 'Điểm yếu', '#B4501F', f.w], ['Action plan', 'Kế hoạch hành động', '#243F85', f.a]];
    return '<div class="pi-fb">' + rows.map(function (r) { return '<div class="pi-fr"><b style="color:' + r[2] + '">' + r[0] + ' <small>' + r[1] + '</small></b>' + (r[3] ? '<p>' + esc(r[3]) + '</p>' : '<p class="pi-blank"></p>') + '</div>'; }).join('') + '</div>';
  }
  function critBlock(m, k) {
    var t = SKILL[k], sc = (m.criteria || {})[k] || {};
    return '<div class="pi-crit">' + CRIT[k].map(function (c) {
      var v = sc[c[0]]; return '<div class="pi-cr"><span>' + esc(c[1]) + '<small>' + esc(c[2]) + '</small></span><div class="pt-bar" style="background:#fff"><i style="width:' + (v == null ? 0 : v / 9 * 100) + '%;background:' + t.ink + '"></i></div><b>' + fmt(v) + '</b></div>';
    }).join('') + '</div>';
  }
  function card(m, k) {
    var t = SKILL[k], b = m.bands[k], raw = m.raw && m.raw[k];
    return '<div class="pi-card" style="background:' + t.bg + ';--ink:' + t.ink + '"><div class="pi-h"><h2 style="color:' + t.ink + '">' + esc(t.en) + ' <small>' + esc(t.vi) + '</small></h2><div class="pi-band"><b>' + fmt(b) + '</b><span>Band</span></div></div>'
      + (CRIT[k] ? critBlock(m, k) : '<div class="pi-raw">' + (raw ? esc(raw) : '&nbsp;') + '</div>') + '<div class="pi-ft">' + ttl("Teacher's Feedback", 'Nhận xét của giáo viên') + '</div>' + fb(k, (m.feedback || {})[k]) + '</div>';
  }
  function page2(m) {
    return '<div class="pt-page" style="--a:' + THEME.a + ';--d:' + THEME.d + ';--soft:' + THEME.soft + '">' + head(m, ['Skill Breakdown & Feedback', 'Điểm thành phần và nhận xét từng kỹ năng']) + '<div class="pt-main">'
      + '<div class="pi-grid">' + ['writing', 'speaking', 'listening', 'reading'].map(function (k) { return card(m, k); }).join('') + '</div></div>' + foot(2) + '</div>';
  }
  return { THEME: THEME, SKILL: SKILL, CRIT: CRIT, overallOf: overallOf, cefr: cefr, page1: page1, page2: page2 };
});
