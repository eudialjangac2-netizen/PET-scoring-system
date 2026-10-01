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
  var GLOS = [
    ['recurring word stress errors', 'lỗi trọng âm từ lặp lại'], ['discourse markers', 'từ nối diễn ngôn'], ['functional linking', 'cách nối ý theo chức năng'], ['natural linking language', 'ngôn ngữ nối ý tự nhiên'], ['short correction bank', 'sổ ghi ngắn các cụm đã sửa'], ['short thought groups', 'cụm ý ngắn'], ['short sentences', 'câu ngắn'], ['short sentence', 'câu ngắn'],
    ['timed collaborative cycles', 'các chu trình hợp tác có giới hạn thời gian'], ['repair/recovery frames', 'mẫu câu xử lý khi bí ý hoặc chưa hiểu nhau'], ['controlled speaking', 'bài nói có kiểm soát'], ['recurring language problem', 'vấn đề ngôn ngữ lặp lại'], ['planning frame', 'khung lên ý'], ['long turn', 'lượt nói dài'], ['key content words', 'từ khóa nội dung'], ['key information', 'thông tin chính'], ['key details', 'chi tiết chính'], ['high-impact sounds', 'âm ảnh hưởng nhiều nhất'], ['general idea', 'ý chung'], ['general discussion', 'thảo luận chung'], ['full phrases', 'cụm từ đầy đủ'], ['topic vocabulary', 'từ vựng theo chủ đề'], ['developed idea', 'ý đã phát triển'], ['move on', 'chuyển ý'], ['3-step', '3 bước'],
    ['language', 'ngôn ngữ'], ['recurring', 'lặp lại'], ['pattern', 'mẫu lỗi'], ['criterion', 'tiêu chí'], ['development', 'phần phát triển ý'], ['planning', 'lên ý'], ['phrases', 'cụm từ'], ['phrase', 'cụm từ'], ['cycles', 'chu trình'], ['cycle', 'chu trình'], ['result', 'kết quả'], ['outcome', 'kết quả'], ['question', 'câu hỏi'], ['reconstruct', 'dựng lại'], ['feature', 'đặc điểm'], ['pronunciation', 'phát âm'], ['mark', 'đánh dấu'], ['suggestions', 'gợi ý'], ['developed', 'đã phát triển'], ['repair', 'sửa lỗi giao tiếp'], ['recovery', 'xử lý khi bí ý'], ['step', 'bước'], ['close', 'kết ý'], ['problem', 'vấn đề'], ['topic', 'chủ đề'], ['general', 'chung'], ['prompting', 'gợi ý từ giám khảo'], ['speaking', 'bài nói'],
    ['partner-linking frames', 'mẫu câu nối ý với bạn'], ['opening frames', 'mẫu câu mở lời'], ['repair frames', 'mẫu câu xử lý khi chưa hiểu nhau'], ['recovery phrases', 'cụm từ xử lý khi bí ý'], ['sentence frames', 'khung câu'], ['speaking frames', 'khung câu nói'], ['development frame', 'khung phát triển ý'], ['question frames', 'mẫu câu hỏi'], ['frames', 'mẫu câu'], ['frame', 'khung câu'],
    ['stress/intonation', 'trọng âm và ngữ điệu'], ['subject-verb agreement', 'hòa hợp chủ vị'], ['sentence stress', 'trọng âm câu'], ['word-stress', 'trọng âm từ'], ['word stress', 'trọng âm từ'], ['intonation', 'ngữ điệu'], ['prosody', 'nhịp điệu và ngữ điệu'], ['prominence', 'độ nhấn'], ['stress', 'trọng âm'],
    ['intelligibility', 'độ dễ hiểu'], ['listener effort', 'sự nỗ lực của người nghe'], ['individual sounds', 'từng âm riêng lẻ'], ['sound patterns', 'mẫu âm'], ['sound pattern', 'mẫu âm'], ['sounds', 'âm'], ['accent', 'giọng nói'], ['rhythm', 'nhịp điệu'], ['clarity', 'độ rõ'], ['delivery', 'cách trình bày'],
    ['thought groups', 'cụm ý'], ['chunking', 'chia cụm'], ['topic chunks', 'cụm từ theo chủ đề'], ['chunks', 'cụm từ'], ['collocational', 'cụm từ kết hợp'], ['collocations', 'cụm từ kết hợp'], ['collocation', 'cụm từ kết hợp'], ['correction bank', 'sổ ghi các cụm đã sửa'], ['paraphrase alternatives', 'cách diễn đạt lại'], ['paraphrase', 'diễn đạt lại'], ['reusable', 'dùng lại được'], ['alternatives', 'cách nói khác'],
    ['complex forms', 'cấu trúc phức tạp'], ['complex grammar', 'ngữ pháp phức tạp'], ['simple grammar', 'ngữ pháp đơn giản'], ['simple forms', 'cấu trúc đơn giản'], ['simple', 'đơn giản'], ['grammatical', 'ngữ pháp'], ['grammar', 'ngữ pháp'], ['vocabulary', 'từ vựng'], ['lexical range', 'vốn từ'], ['lexical', 'từ vựng'], ['word choice', 'cách chọn từ'], ['topic-specific', 'đặc thù chủ đề'], ['generic', 'chung chung'], ['inaccuracies', 'chỗ chưa chính xác'], ['inaccurate', 'không chính xác'], ['inappropriate', 'chưa phù hợp'], ['awkward', 'thiếu tự nhiên'], ['accuracy', 'độ chính xác'], ['precision', 'độ chính xác'], ['appropriacy', 'tính phù hợp'], ['naturalness', 'độ tự nhiên'], ['complexity', 'độ phức tạp'], ['range', 'mức độ đa dạng'], ['control', 'kiểm soát'], ['controlled', 'có kiểm soát'],
    ['relative clause', 'mệnh đề quan hệ'], ['conditional', 'câu điều kiện'], ['subordination', 'câu phức'], ['tense contrast', 'sự tương phản về thì'], ['tense', 'thì'], ['articles', 'mạo từ'], ['prepositions', 'giới từ'], ['verb-s', 'động từ thêm -s'], ['verb', 'động từ'], ['negatives', 'câu phủ định'], ['questions', 'câu hỏi'], ['timeline', 'mốc thời gian'], ['present/past simple', 'hiện tại đơn/quá khứ đơn'], ['forms', 'dạng'],
    ['extended discourse', 'bài nói dài'], ['extended responses', 'câu trả lời dài'], ['extended', 'mở rộng'], ['discourse', 'bài nói'], ['hesitation', 'sự ngập ngừng'], ['planning pauses', 'quãng ngừng để lên ý'], ['fluency', 'độ trôi chảy'], ['cohesive devices', 'phương tiện liên kết'], ['cohesion', 'sự liên kết'], ['coherence', 'sự mạch lạc'], ['coherent', 'mạch lạc'], ['over-linking', 'nối ý quá mức'], ['linking', 'nối ý'], ['linker', 'từ nối'], ['markers', 'từ đánh dấu'], ['sequencing', 'sắp xếp thứ tự'], ['sequence', 'trình tự'], ['organisation', 'cách tổ chức ý'], ['exemplification', 'đưa ví dụ'],
    ['interaction cycle', 'chu trình tương tác'], ['interaction', 'tương tác'], ['collaborative exchange', 'cuộc trao đổi hợp tác'], ['collaborative discussion', 'cuộc thảo luận hợp tác'], ['collaborative', 'hợp tác'], ['discussion', 'phần thảo luận'], ['exchange', 'phần trao đổi'], ['examiner', 'giám khảo'], ['partner', 'bạn cùng thi'], ['turn-taking', 'luân phiên lượt nói'], ['turns', 'lượt nói'], ['turn', 'lượt nói'], ['contribution', 'đóng góp'], ['initiative', 'sự chủ động'], ['initiating', 'mở ý'], ['initiate', 'mở ý'], ['invite', 'mời'], ['acknowledge', 'ghi nhận'], ['negotiation', 'thương lượng'], ['negotiate', 'thương lượng'], ['explore', 'khám phá'], ['options', 'lựa chọn'], ['option', 'lựa chọn'], ['choices', 'lựa chọn'], ['mechanically', 'một cách máy móc'], ['independence', 'sự độc lập'], ['sustain', 'duy trì'], ['react', 'phản hồi'], ['respond', 'đáp lại'], ['develop', 'phát triển'], ['compare', 'so sánh'], ['evaluate', 'đánh giá'], ['evaluation', 'đánh giá'], ['comparison', 'sự so sánh'], ['decide', 'quyết định'], ['speculate', 'phỏng đoán'], ['speculation', 'phỏng đoán'], ['stance', 'lập trường'], ['opinion', 'quan điểm'], ['contrast', 'tương phản'], ['link', 'nối ý'], ['add', 'bổ sung'], ['ask', 'hỏi lại'],
    ['new information', 'thông tin mới'], ['detail/example', 'chi tiết/ví dụ'], ['reason/detail', 'lý do/chi tiết'], ['example/experience', 'ví dụ/trải nghiệm'], ['details', 'chi tiết'], ['detail', 'chi tiết'], ['example', 'ví dụ'], ['reason', 'lý do'], ['answers', 'câu trả lời'], ['answer', 'câu trả lời'], ['responses', 'câu trả lời'], ['response', 'câu trả lời'], ['ideas', 'ý tưởng'], ['idea', 'ý tưởng'], ['points', 'ý'], ['point', 'ý'], ['main', 'chính'], ['content', 'nội dung'], ['meaning', 'ý nghĩa'], ['message', 'thông điệp'], ['information', 'thông tin'], ['stretches', 'đoạn nói'], ['performance', 'phần thể hiện'], ['overall', 'tổng thể'], ['consistency', 'sự nhất quán'], ['quality', 'chất lượng'], ['impact', 'tác động'], ['relevance', 'sự phù hợp'], ['flexibility', 'sự linh hoạt'], ['function', 'chức năng'], ['functions', 'chức năng'], ['structure', 'cấu trúc'], ['errors', 'lỗi'], ['target', 'mục tiêu'], ['format', 'dạng bài'], ['automatic', 'tự động'], ['timed', 'có giới hạn thời gian'], ['concise', 'ngắn gọn'], ['rehearsed', 'học thuộc'], ['restricted', 'bị hạn chế'], ['limitations', 'hạn chế'], ['reliance', 'sự phụ thuộc'], ['linguistic resources', 'vốn ngôn ngữ'], ['demand', 'yêu cầu'], ['focus', 'tập trung'], ['communication', 'giao tiếp'], ['overview', 'tổng quan'], ['address', 'giải quyết'], ['wider implication', 'hệ quả rộng hơn'], ['implication', 'hệ quả'], ['background', 'bối cảnh'], ['interpretation', 'cách diễn giải'], ['conclusion', 'kết luận'], ['experience', 'trải nghiệm'], ['breakdown', 'chỗ đứt gãy'], ['utterances', 'câu nói'], ['follow-up', 'câu hỏi nối tiếp'], ['mini-dialogues', 'đoạn hội thoại ngắn'], ['mini-exchange', 'phần trao đổi ngắn'], ['mini-speech', 'bài nói ngắn'], ['likes/dislikes', 'sở thích/điều không thích'], ['everyday topics', 'chủ đề đời thường'], ['familiar topics', 'chủ đề quen thuộc'],
    ['isolated words/phrases', 'từ hoặc cụm từ rời rạc'], ['monologues', 'bài độc thoại'], ['flow', 'mạch nói'], ['support', 'hỗ trợ'], ['tasks', 'các phần thi'], ['task', 'phần thi'], ['word', 'từ'], ['words', 'từ'], ['sentence', 'câu'], ['key', 'chính'], ['and', 'và'], ['but', 'nhưng']
  ].filter(function (g) { return !/^(and|but|key|word|words|sentence|long|short|add|ask|main)$/.test(g[0]) || true; });
  GLOS.sort(function (a, b) { return b[0].length - a[0].length; });
  // Giu nguyen tieng Anh: cau mau hoc sinh phai noi, tu noi "although, if, when, who/which", cau trong ngoac kep
  var KEEP = /(“[^”]*”|"[^"]*"|although, if, when, who\/which|(?:What|Do you|Do|How|We could|Sorry|Maybe|That’s|I see|Building|Why|Example)[^\/.?…:;]{0,50}(?:…|\?)(?:,)?)/;
  var RES = GLOS.map(function (g) { return [new RegExp('(^|[^\\p{L}\\-])(' + g[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(?![\\p{L}\\-])', 'giu'), g[1]]; });
  function vi(t) {
    return t.split(KEEP).map(function (seg, i) {
      if (i % 2) return seg;
      RES.forEach(function (r) { seg = seg.replace(r[0], function (m, pre, w) { return pre + (w.charAt(0) !== w.charAt(0).toLowerCase() ? r[1].charAt(0).toUpperCase() + r[1].slice(1) : r[1]); }); });
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
  return { pick: pick, tier: tier, crit: crit, vi: vi };
});
