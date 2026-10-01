/* Chon Strength / Area to Improve / Next Step cho Speaking (trang 2 phieu).
 * Dau vao: sp = { bands:{GV,DM,P,IC,GA}, evidence:['P-I • effortful', ...], weakPart:'P3' }
 * Quy tac (Elaine):
 *  Tang 1: G/V hoac P duoi band 3 -> Area to Improve lay tu tieu chi do truoc.
 *  Tang 2: trong tieu chi do, lay bang chung nang nhat theo thu tu noi bo.
 *  Tang 3: ca hai tu band 3 tro len -> chon theo bang 4 muc uu tien.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.SpeakingDiagnosis = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function crit(k) {
    if (/^Weak part/.test(k)) return 'WP';
    if (/^(G-|V-|Complex|Lexical)/.test(k)) return 'GV';
    if (/^DM-/.test(k)) return 'DM';
    if (/^P-/.test(k)) return 'P';
    if (/^GA-|^Whole-test|^Extended/.test(k)) return 'GA';
    return 'IC';
  }
  // Bang 4 muc uu tien (Uyen): 1 = giao tiep do vo, 4 = tinh chinh
  var T1 = /P-I • (effortful|listener effort)|G-S • (priority|developing\/priority)|GA-H • blocks|DM-H • disrupts|Support • frequent|Independence • (frequent|needs)/;
  var T2 = /GA-L • isolated|DM-E • (mostly short|short)|Exchange quality • mostly|Interaction quality • (mostly reactive|separate)|Extended communication • difficult|GA-ED • difficult|Whole-test handling • inconsistent|GA-WH • (inconsistent|uneven)/;
  var T3 = /V-R • (limited|repetitive)|V-A • (frequent|mixed\/frequent)|G-R|G-C • (little|limited)|DM-C • (basic|weak)|DM-D\/R • limited|P-S\/IN • limited|^(I|R|D|Q|N|L|A|F) • (absent|weak)|Q • weak/;
  function tier(k) { return T1.test(k) ? 1 : T2.test(k) ? 2 : T3.test(k) ? 3 : 4; }
  // Tang 2: thu tu bang chung noi bo trong G/V va P
  var ORD = {
    GV: [/G-S • (priority|developing\/priority)/, /V-A • (frequent|mixed\/frequent)/, /V-R • (limited|repetitive)/, /G-R/, /G-C • (little|limited)/, /G-S • developing/, /V-A • mixed/],
    P: [/P-I • (effortful|listener effort)/, /P-SND • recurring/, /P-W • (frequent|recurring|some\/frequent)/, /P-S\/IN • limited/, /P-I • mostly/, /P-SND • occasional/, /P-W • some/, /P-S\/IN • some/]
  };
  function rank(c, k) { var o = ORD[c]; for (var i = 0; i < o.length; i++) if (o[i].test(k)) return i; return 99; }

  // Thuat ngu Anh -> Viet (cau mau trong ngoac kep nhu "How about...?" giu nguyen tieng Anh)
  var GLOS = [['stress/intonation', 'trọng âm và ngữ điệu'], ['subject-verb agreement', 'hòa hợp chủ vị'], ['sentence stress', 'trọng âm câu'], ['word stress', 'trọng âm từ'], ['intonation', 'ngữ điệu'],
    ['intelligibility', 'độ dễ hiểu'], ['listener effort', 'sự nỗ lực của người nghe'], ['individual sounds', 'từng âm riêng lẻ'], ['sound patterns', 'mẫu âm'], ['sound pattern', 'mẫu âm'], ['accent', 'giọng nói'], ['rhythm', 'nhịp điệu'],
    ['thought groups', 'cụm ý'], ['chunking', 'chia cụm'], ['topic chunks', 'cụm từ theo chủ đề'], ['chunks', 'cụm từ'], ['collocations', 'cụm từ kết hợp'], ['collocation', 'cụm từ kết hợp'], ['correction bank', 'sổ ghi các cụm đã sửa'],
    ['complex forms', 'cấu trúc phức tạp'], ['complex grammar', 'ngữ pháp phức tạp'], ['simple grammar', 'ngữ pháp đơn giản'], ['lexical range', 'vốn từ'], ['word choice', 'cách chọn từ'], ['extended discourse', 'bài nói dài'], ['extended responses', 'câu trả lời dài'],
    ['hesitation', 'sự ngập ngừng'], ['interaction', 'tương tác'], ['collaborative exchange', 'cuộc trao đổi hợp tác'], ['collaborative discussion', 'cuộc thảo luận hợp tác'], ['tasks', 'các phần thi'], ['task', 'phần thi'], ['discussion', 'phần thảo luận'], ['exchange', 'phần trao đổi'], ['examiner', 'giám khảo'], ['partner', 'bạn cùng thi'], ['turns', 'lượt nói'], ['turn', 'lượt nói'],
    ['isolated words/phrases', 'từ hoặc cụm từ rời rạc'], ['sentence frames', 'khung câu'], ['monologues', 'bài độc thoại'], ['flow', 'mạch nói'], ['support', 'hỗ trợ'], ['message', 'thông điệp'], ['response', 'câu trả lời']];
  function vi(t) {
    return t.split(/(".*?"|“.*?”)/).map(function (seg, i) {
      if (i % 2) return seg;
      GLOS.forEach(function (g) { seg = seg.replace(new RegExp('\\b' + g[0].replace(/[\/\-]/g, '\\$&') + '\\b(?![-\\w])', 'gi'), g[1]); });
      return seg;
    }).join('');
  }
  var TITLES = [[/^G-S/, 'Ngữ pháp cơ bản chưa ổn định'], [/^(G-C|Complex)/, 'Ngữ pháp phức tạp còn hạn chế'], [/^G-R/, 'Lỗi ngữ pháp lặp lại'], [/^V-R/, 'Vốn từ còn hạn chế'], [/^(V-A|Lexical)/, 'Chọn từ chưa chính xác'],
    [/^DM-E/, 'Câu trả lời còn ngắn'], [/^DM-D\/R/, 'Ý chưa được phát triển'], [/^DM-C/, 'Liên kết ý còn đơn giản'], [/^DM-H/, 'Ngập ngừng làm đứt mạch nói'],
    [/^P-I/, 'Phát âm chưa rõ'], [/^P-W/, 'Trọng âm từ chưa chính xác'], [/^P-S\/IN/, 'Trọng âm câu và ngữ điệu còn hạn chế'], [/^P-SND/, 'Lỗi phát âm lặp lại'],
    [/^GA-L/, 'Câu nói còn quá ngắn'], [/^GA-H/, 'Ngập ngừng nhiều'], [/^(GA-|Whole-test|Extended)/, 'Chưa ổn định giữa các phần thi']];
  function titleOf(code) {
    for (var i = 0; i < TITLES.length; i++) if (TITLES[i][0].test(code)) return TITLES[i][1];
    return 'Tương tác chưa chủ động';
  }

  function pick(level, sp) {
    var B = ((typeof window !== 'undefined' && window.SPEAKING_BANK) || globalThis.SPEAKING_BANK || {})[level] || {};
    if (!sp || !sp.evidence) return null;
    var items = sp.evidence.filter(function (k) { return B[k]; }).map(function (k) { return { k: k, c: crit(k), a: B[k][1], s: B[k][0], n: B[k][2], t: tier(k) }; });
    var weak = items.filter(function (x) { return x.a && x.c !== 'WP'; });
    var b = sp.bands || {}, areas = [];
    var gv = b.GV, p = b.P, gate = [];
    if (gv != null && gv < 3) gate.push('GV');
    if (p != null && p < 3) gate.push('P');
    var tierBranch = 3;
    if (gate.length) {
      tierBranch = 1;
      var top = function (c) { return weak.filter(function (x) { return x.c === c; }).sort(function (x, y) { return rank(c, x.k) - rank(c, y.k); }); };
      var bandOf = function (c) { return c === 'GV' ? gv : p; };
      gate.sort(function (x, y) {
        if (bandOf(x) !== bandOf(y)) return bandOf(x) - bandOf(y);
        var tx = top(x)[0] ? top(x)[0].t : 9, ty = top(y)[0] ? top(y)[0].t : 9;
        if (tx !== ty) return tx - ty;
        return x === 'GV' ? -1 : 1; // hoa: G/V truoc
      });
      gate.forEach(function (c) { top(c).forEach(function (x) { areas.push(x); }); });
      areas = areas.slice(0, 2);
    }
    if (areas.length < 2) {
      var rest = weak.filter(function (x) { return areas.indexOf(x) < 0; });
      rest.sort(function (x, y) {
        if (x.t !== y.t) return x.t - y.t;
        var bx = b[x.c] == null ? 9 : b[x.c], by = b[y.c] == null ? 9 : b[y.c];
        return bx - by;
      });
      rest.forEach(function (x) {
        if (areas.length < 2 && !(areas.length === 1 && areas[0].c === x.c && rest.some(function (y) { return y.c !== x.c && areas.indexOf(y) < 0; }))) areas.push(x);
      });
    }
    // Strength: bang chung manh nhat (khong co Area), uu tien tieu chi band cao
    var str = items.filter(function (x) { return x.s && !x.a && x.c !== 'WP'; })
      .sort(function (x, y) { return (b[y.c] == null ? 0 : b[y.c]) - (b[x.c] == null ? 0 : b[x.c]); })[0]
      || items.filter(function (x) { return x.s && x.c !== 'WP'; }).sort(function (x, y) { return (b[y.c] == null ? 0 : b[y.c]) - (b[x.c] == null ? 0 : b[x.c]); })[0];
    var vs = function (x) { return x ? vi(x) : x; };
    var out = { rule: tierBranch, title: areas[0] ? 'Speaking: ' + titleOf(areas[0].k).replace(/^./, function (c) { return c.toLowerCase(); }) : '', gate: gate, strength: str ? vs(str.s) : '', areas: areas.map(function (x) { return { code: x.k, text: vs(x.a), tier: x.t }; }), next: vs(areas[0] ? areas[0].n : (str ? str.n : '')) };
    if (sp.weakPart && out.areas[0]) out.areas[0].part = sp.weakPart.replace(/^P/, 'Part ');
    return out;
  }
  return { pick: pick, tier: tier, crit: crit };
});
