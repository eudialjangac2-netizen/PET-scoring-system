/* cham-bai.js — app chấm phiếu Cambridge KET / PET / FCE (Ruby School) */
(function () {
  'use strict';
  const APP_VERSION = '02/10/2026 — thêm Speaking (KET · PET · FCE), chế độ Mock / Bài hàng ngày, lý do câu điền sai';
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const PAPERS = ['reading', 'listening'];
  const PAPER_SHORT = { reading: 'R', listening: 'L' };

  let TPL, LV, NX = null, FILLR = null, CFG = {}, TESTS = [], KEY = null, cvReady = false;
  let MODE = 'mock';   // 'mock' = Mock test (có phiếu báo điểm, tab Kết quả) · 'daily' = bài hàng ngày (điểm thô, tab Hằng ngày)
  let S = null, curWrite = null;
  const QMAP = {};   // QMAP[level][paper][q] = { page, part, type }

  // ---------- lưu trữ ----------
  const idb = (() => {
    let dbp;
    const db = () => dbp || (dbp = new Promise((res, rej) => {
      const r = indexedDB.open('cham-pet', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    }));
    const tx = async (mode, fn) => { const d = await db(); return new Promise((res, rej) => {
      const t = d.transaction('kv', mode); const q = fn(t.objectStore('kv'));
      t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); }); };
    return { get: k => tx('readonly', s => s.get(k)), set: (k, v) => tx('readwrite', s => s.put(v, k)), del: k => tx('readwrite', s => s.delete(k)) };
  })();
  const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  let saveTimer;
  const save = (dirty = true) => {
    if (!S || S.view) return;   // chế độ xem của quản lý: không ghi gì vào máy
    if (dirty) S.dirty = true;
    const snap = S;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => idb.set(snap.id, snap).catch(() => alert('Không lưu được kết quả trên máy (bộ nhớ trình duyệt đầy?).')), 300);
    if (dirty) scheduleSync();
  };


  // ---------- cấu hình cấp độ ----------
  const lvl = () => LV[S.level];
  const pagesOf = level => PAPERS.flatMap(p => LV[level].giay[p] || []);
  const pageShort = pk => { const m = pk.match(/-(reading|listening)(?:-(\d))?$/); return PAPER_SHORT[m[1]] + (m[2] || ''); };
  const pageName = pk => { const t = TPL.pages[pk]; return t.title + (/-\d$/.test(pk) ? ` (trang ${pk.slice(-1)})` : ''); };
  function buildQmap() {
    for (const level of Object.keys(LV)) {
      QMAP[level] = { reading: {}, listening: {} };
      for (const paper of PAPERS) for (const pk of LV[level].giay[paper] || [])
        for (const q of TPL.pages[pk].questions) QMAP[level][paper][q.q] = { page: pk, part: q.part, type: q.type };
    }
  }
  const secQs = (level, sec) => Object.entries(QMAP[level][sec.giay]).filter(([, v]) => sec.parts.includes(v.part)).map(([q]) => +q).sort((a, b) => a - b);
  const weightOf = (sec, part) => (sec.trongSo || {})[part] || 1;
  const isPartial = (sec, part) => (sec.diemTungPhan || []).includes(part);
  const secOfQ = (level, paper, q) => LV[level].phan.find(s => s.giay === paper && s.parts.includes(QMAP[level][paper][q]?.part));
  function partsOf(level, sec) {
    const cnt = {};
    for (const q of secQs(level, sec)) { const p = QMAP[level][sec.giay][q].part; cnt[p] = (cnt[p] || 0) + weightOf(sec, p); }
    return sec.parts.map(p => [p, cnt[p] || 0]);
  }
  const secMax = (level, sec) => partsOf(level, sec).reduce((a, [, n]) => a + n, 0);

  // ---------- khởi động ----------
  async function boot() {
    [TPL, LV, TESTS] = await Promise.all(['omr-template.json', 'cap-do.json', 'de-thi/manifest.json']
      .map(f => fetch(f).then(r => { if (!r.ok) throw new Error(f); return r.json(); })));
    delete LV._ghi_chu;
    buildQmap();
    NX = await fetch('nhan-xet-mau.json').then(r => r.ok ? r.json() : null).catch(() => null);
    FILLR = await fetch('ly-do-cau-dien.json').then(r => r.ok ? r.json() : null).catch(() => null);   // lời khuyên theo lý do câu điền sai
    CFG = await fetch('cau-hinh.json').then(r => r.ok ? r.json() : {}).catch(() => ({}));
    CFG.on = /^https:\/\/script\.google\.com\//.test(CFG.sheetUrl || '');
    $('#sheetBox').hidden = !CFG.on; $('#cloudBox').hidden = !(CFG.on && CFG.dongBoPhien !== false); $('#fileBox').open = !CFG.on;
    $('#tCode').value = lsGet('omr-tcode', '');
    bindSpeakingJson();
    $('#tCodeEye').onclick = () => {   // hiện / ẩn mã giáo viên
      const show = $('#tCode').type === 'password'; $('#tCode').type = show ? 'text' : 'password';
      $('#tCodeEye').classList.toggle('on', show); $('#tCodeEye').setAttribute('aria-pressed', show);
      $('#tCodeEye').setAttribute('aria-label', show ? 'Ẩn mã giáo viên' : 'Hiện mã giáo viên');
    };
    $('#btnSync').onclick = () => fetchRosters(true);
    $('#selClass').onchange = fillTests; $('#mixOn').onchange = setMix;
    const last = lsGet('omr-last', {});
    MODE = lsGet('omr-mode', 'mock') === 'daily' ? 'daily' : 'mock';
    fillClasses(last.cls); if (last.test) $('#selTest').value = last.test;
    document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => setMode(b.dataset.mode));
    setMode(MODE);
    if (CFG.on && $('#tCode').value) fetchRosters(false);
    else if (CFG.on) $('#syncInfo').textContent = 'Nhập mã giáo viên rồi bấm "Cập nhật danh sách lớp".';
    document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
    $('#fileRoster').onchange = e => loadRoster(e.target.files[0]).finally(() => e.target.value = '');
    $('#btnStart').onclick = start;
    $('#fileCam').onchange = e => { handleFiles([...e.target.files]); e.target.value = ''; };
    $('#fileMany').onchange = e => { handleFiles([...e.target.files]); e.target.value = ''; };
    $('#btnXlsx').onclick = async () => {
      if (!(await exportXlsx())) return;
      if ($('#xPhieu').checked) setTimeout(exportPhieu, 600);   // cách 0,6 giây để trình duyệt nhận 2 lần tải
    };
    $('#btnPhieu').onclick = exportPhieu;
    document.querySelectorAll('#rvTabs button').forEach(b => b.onclick = () => setRvTab(b.dataset.t));
    $('#rvStu').onchange = e => { rv.stu = e.target.value; rv.page = ''; renderRvAll(); };
    $('#rvPage').onchange = e => { rv.page = e.target.value; renderRvAll(); };
    $('#rvReset').onclick = rvReset; $('#btnCsv').onclick = exportCsv;
    $('#btnClear').onclick = clearSession;
    $('#btnMergeOut').onclick = exportData;
    $('#btnSessions').onclick = listCloud; $('#viewExit').onclick = closeView;
    $('#lkStu').onchange = e => { lk.stu = e.target.value; renderLook(); };
    $('#lkPrev').onclick = () => { const o = [...$('#lkStu').options], i = o.findIndex(x => x.value === lk.stu); if (i > 0) { lk.stu = o[i - 1].value; renderLook(); window.scrollTo(0, 0); } };
    $('#lkNext').onclick = () => { const o = [...$('#lkStu').options], i = o.findIndex(x => x.value === lk.stu); if (i < o.length - 1) { lk.stu = o[i + 1].value; renderLook(); window.scrollTo(0, 0); } };
    $('#fileMerge').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) importData(f); };
    $('#btnScan').onclick = startScanner; $('#scanStop').onclick = stopScanner;
    document.addEventListener('visibilitychange', () => { if (document.hidden && cam.running) stopScanner(); });
    $('#reportClose').onclick = () => $('#reportModal').hidden = true;
    $('#appVersion').textContent = 'Phiên bản app: ' + APP_VERSION;
    go('setup');
    waitCv();
  }
  function waitCv() {
    const t = setInterval(() => { if (window.cv && window.cv.Mat) { clearInterval(t); cvReady = true; $('#loading').hidden = true; } }, 200);
    setTimeout(() => { if (!cvReady) $('#loadingMsg').textContent = 'Bộ nhận dạng tải chậm — kiểm tra kết nối mạng.'; $('#loading').hidden = true; }, 20000);
  }
  function go(v) {
    if (v !== 'setup' && !S) v = 'setup';
    document.querySelectorAll('section.view').forEach(s => s.classList.toggle('on', s.id === 'v-' + v));
    document.querySelectorAll('[data-go]').forEach(b => b.setAttribute('aria-current', b.dataset.go === v));
    $('#dock').hidden = v !== 'scan';
    ({ scan: renderScan, review: renderReview, write: renderWrite, writing: renderWriting, speaking: renderSpeaking, online: renderOnline, export: renderExport, look: renderLook })[v]?.();
    window.scrollTo(0, 0);
  }

  // ---------- danh sách lớp Cambridge ----------
  // lớp Cambridge = BATCH · TEACHER; mỗi học sinh: mã đầy đủ (C260125MC), khoá 6 số (260125), lớp văn hoá (CLASS)
  const rosters = () => { const r = lsGet('omr-rosters', {}); return Object.fromEntries(Object.entries(r).filter(([, v]) => v && v.level && Array.isArray(v.students))); };
  const rosterSrc = () => lsGet('omr-roster-src', {});
  const keyOf = code => String(code).replace(/\D/g, '').slice(0, 6);
  const mkStu = (code, name, vh) => ({ code, key: keyOf(code), name: String(name || '').trim(), vh: String(vh || '').trim() });
  function fillClasses(sel) {
    const r = rosters(), ids = Object.keys(r).sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }));
    $('#selClass').innerHTML = ids.length ? ids.map(c => `<option value="${esc(c)}">${esc(c)} — ${r[c].level} (${r[c].students.length} HS)</option>`).join('')
      : '<option value="">Chưa có danh sách lớp</option>';
    if (sel && r[sel]) $('#selClass').value = sel;
    $('#rosterList').innerHTML = ids.map((c, i) => `<div><span><b>${esc(c)}</b> · ${r[c].level} · ${r[c].students.length} HS</span>
      <button class="btn small danger" data-delcls="${i}">Xoá</button></div>`).join('');
    $('#rosterList').querySelectorAll('[data-delcls]').forEach(b => b.onclick = () => deleteRoster(ids[+b.dataset.delcls]));
    fillTests();
  }
  const isDaily = () => !!S && S.mode === 'daily';
  const sheetTab = () => (isDaily() ? 'Hằng ngày ' : 'Kết quả ') + S.level;
  const MODE_HINT = { mock: 'Mock test: tính điểm theo thang Cambridge, có phiếu báo điểm cho phụ huynh, chọn đợt Mock (1–5); lưu vào tab "Kết quả" của Google Sheet, tự đánh dấu là Mock để theo dõi tiến bộ.',
    daily: 'Bài hàng ngày: chấm nhanh trong lớp, chỉ có điểm thô và % đúng; không có Grade, Overall hay phiếu báo điểm; lưu vào tab "Hằng ngày" riêng (không lẫn vào tiến bộ Mock). Speaking và Writing có thể có hoặc không.' };
  function setMode(m) {
    MODE = m === 'daily' ? 'daily' : 'mock'; lsSet('omr-mode', MODE);
    document.querySelectorAll('[data-mode]').forEach(b => { const on = b.dataset.mode === MODE; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    $('#modeHint').textContent = MODE_HINT[MODE]; $('#dailyLabelBox').hidden = MODE !== 'daily'; $('#dotBox').hidden = MODE !== 'mock';
    fillTests();
  }
  function fillTests() {
    const c = rosters()[$('#selClass').value], lv = c?.level;
    const list = TESTS.filter(t => !lv || t.level === lv);   // mọi đề đúng cấp độ; loại buổi (Mock / Hằng ngày) do giáo viên chọn ở bước 1
    $('#selTest').innerHTML = list.length ? list.map(t => `<option value="${esc(t.id)}">${esc(t.title)}</option>`).join('')
      : `<option value="">Chưa có đề ${lv || ''}</option>`;
    const last = lsGet('omr-last', {}); if (last.test && list.some(t => t.id === last.test)) $('#selTest').value = last.test;
    $('#selTestL').innerHTML = $('#selTest').innerHTML;   // ô "đề cho Listening" dùng chung danh sách
    $('#selDot').value = String(lsGet('omr-dot', {})[$('#selClass').value] || 1);   // nhớ đợt Mock lần trước của lớp này
    if (last.testL && list.some(t => t.id === last.testL)) $('#selTestL').value = last.testL;
  }
  function setMix() {   // bật/tắt chọn hai đề khác nhau cho Reading và Listening
    const on = $('#mixOn').checked; $('#mixSel').hidden = !on;
    $('#lblTest').innerHTML = on ? 'Đề dùng cho <b>Reading</b> <span class="hint" style="font-weight:400">(FCE: Reading và Use of English)</span>'
      : 'Đề thi <span class="hint" style="font-weight:400">(chỉ hiện đề đúng cấp độ của lớp)</span>';
  }
  function deleteRoster(c) {
    const all = rosters();
    if (!confirm(`Xoá danh sách "${c}" (${all[c].students.length} học sinh) khỏi máy này?\nKết quả chấm đã lưu vẫn được giữ; nạp lại danh sách là xem tiếp được.`)) return;
    delete all[c]; lsSet('omr-rosters', all);
    const src = rosterSrc(); delete src[c]; lsSet('omr-roster-src', src);
    fillClasses($('#selClass').value);
  }
  function checkDup(c, list) {
    const dup = list.map(s => s.key).filter((k, i, a) => a.indexOf(k) !== i);
    if (dup.length) alert(`Lớp ${c}: trùng mã ${[...new Set(dup)].join(', ')} (6 chữ số) — kiểm tra lại danh sách.`);
  }
  async function loadRoster(file) {
    if (!file) return;
    let rows = [];
    if (/\.csv$/i.test(file.name)) {
      const txt = (await file.text()).replace(/^\uFEFF/, '');
      rows = txt.split(/\r?\n/).map(l => l.split(/[,;\t]/).map(s => s.trim().replace(/^"|"$/g, '')));
    } else {
      const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await file.arrayBuffer());
      wb.worksheets[0].eachRow(r => rows.push(r.values.slice(1).map(v => String(v?.text ?? v?.result ?? v ?? '').trim())));
    }
    const head = (rows[0] || []).map(h => h.toUpperCase().replace(/\s+/g, ' ').trim());
    const col = n => head.indexOf(n);
    const out = {};
    if (col('STUDENT ID') >= 0) {           // bảng tổng như Google Sheet
      for (const r of rows.slice(1)) {
        const code = (r[col('STUDENT ID')] || '').toUpperCase().replace(/\s/g, '');
        if (!/\d{6}/.test(code)) continue;
        const level = (r[col('LEVEL')] || '').toUpperCase().trim(), cls = `${(r[col('BATCH')] || '').trim()} · ${(r[col('TEACHER')] || '').trim()}`;
        if (!LV[level]) continue;
        (out[cls] = out[cls] || { level, students: [] }).students.push(mkStu(code, r[col('FULL NAME')], r[col('CLASS')]));
      }
    } else {                                 // file 1 lớp: cột A mã, cột B họ tên, cột C lớp
      const list = rows.map(r => [(r[0] || '').toUpperCase().replace(/\s/g, ''), r[1], r[2]]).filter(r => /\d{6}/.test(r[0])).map(r => mkStu(...r));
      if (list.length) {
        const c = (prompt('Tên lớp Cambridge của danh sách này (vd: PET-2627 · MS. PHI):', file.name.replace(/\.[^.]+$/, '')) || '').trim();
        const level = (prompt('Cấp độ của lớp (KET, PET hoặc FCE):', 'PET') || '').toUpperCase().trim();
        if (c && LV[level]) out[c] = { level, students: list };
      }
    }
    if (!Object.keys(out).length) { alert('Không đọc được danh sách. Cần các cột STUDENT ID, FULL NAME, CLASS, LEVEL, BATCH, TEACHER (hoặc cột A mã, cột B họ tên).'); return; }
    const all = rosters(), src = rosterSrc();
    for (const [c, v] of Object.entries(out)) { checkDup(c, v.students); all[c] = v; src[c] = 'file'; }
    lsSet('omr-rosters', all); lsSet('omr-roster-src', src);
    fillClasses(Object.keys(out)[0]);
    alert(`Đã nạp: ${Object.entries(out).map(([c, v]) => `${c} (${v.students.length})`).join(', ')}.`);
  }

  // ---------- Google Sheet ----------
  const hhmm = (d = new Date()) => d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  async function fetchRosters(loud) {
    const code = $('#tCode').value.trim();
    if (!code) { $('#syncInfo').textContent = 'Nhập mã giáo viên trước.'; return; }
    $('#syncInfo').textContent = 'Đang lấy danh sách lớp…'; $('#btnSync').disabled = true;
    try {
      const r = await fetch(`${CFG.sheetUrl}?action=classes&code=${encodeURIComponent(code)}`).then(x => x.json());
      if (!r.ok) { $('#syncInfo').textContent = r.error || 'Google Sheet từ chối yêu cầu.'; if (loud) alert(r.error); return; }
      lsSet('omr-tcode', code); lsSet('omr-teacher', { name: r.teacher, admin: r.admin });
      const all = rosters(), src = rosterSrc();
      for (const c of Object.keys(all)) if (src[c] !== 'file') { delete all[c]; delete src[c]; }
      for (const [c, v] of Object.entries(r.classes)) {
        if (!LV[v.level]) continue;
        all[c] = { level: v.level, students: v.students.map(s => mkStu(s.code, s.name, s.vh)) }; src[c] = 'sheet'; checkDup(c, all[c].students);
      }
      lsSet('omr-rosters', all); lsSet('omr-roster-src', src); lsSet('omr-roster-at', new Date().toISOString());
      fillClasses($('#selClass').value || lsGet('omr-last', {}).cls);
      const ids = Object.keys(r.classes);
      $('#syncInfo').textContent = `✓ ${r.teacher}${r.admin ? ' (quản lý)' : ''} · cập nhật lúc ${hhmm()}: ` +
        (ids.length ? ids.map(c => `${c} (${r.classes[c].students.length})`).join(', ') : 'chưa có lớp nào.');
    } catch (e) {
      const at = lsGet('omr-roster-at', null);
      $('#syncInfo').textContent = 'Không kết nối được Google Sheet.' + (at ? ' Đang dùng danh sách đã lưu trên máy.' : '');
      if (loud) alert('Không kết nối được Google Sheet. Kiểm tra mạng, hoặc dùng mục "Dự phòng" để tải danh sách từ file.');
    } finally { $('#btnSync').disabled = false; }
  }

  let syncTimer, syncing = false;
  function scheduleSync() {
    if (!CFG.on || !lsGet('omr-tcode', '')) return;
    clearTimeout(syncTimer); syncTimer = setTimeout(() => pushResults(false), 6000);
  }
  function sheetRows() {
    const L = lvl(), header = ['Loại', ...(isDaily() ? [] : ['Đợt Mock']), 'Đề', 'Lớp Cambridge', 'Mã HS', 'Họ tên', 'Lớp'];
    for (const sec of L.phan) header.push(`${sec.ten} /${secMax(S.level, sec)}`, ...(isDaily() ? [`${sec.ten} %`] : [`${sec.ten} thang`, `${sec.ten} CEFR`]),
      ...partsOf(S.level, sec).map(([p, n]) => `${sec.viet} Part ${p} (/${n})`));
    header.push(...(hasWriting() ? WR_COLS : []), ...(hasSpeaking() ? spColsOf() : []), 'Số câu tô không chuẩn', 'Ghi chú', ...CM_COLS, ...PAPERS.map(p => `Chi tiết ${p === 'reading' ? 'Reading' : 'Listening'}`), ...detCols());   // cột chi tiết Writing / Speaking đặt CUỐI: mọi tab có cùng thứ tự
    const rows = results().filter(r => r.any).map(r => {
      const o = { 'Khoá': `${S.test}|${S.cls}|${r.s.code}${isDaily() ? '|' + S.label : ''}`, 'Loại': isDaily() ? 'Hằng ngày' + (S.label ? ' · ' + S.label : '') : 'Mock', ...(isDaily() ? {} : { 'Đợt Mock': S.dot }), 'Đề': S.testTitle, 'Lớp Cambridge': S.cls, 'Mã HS': r.s.code, 'Họ tên': r.s.name, 'Lớp': r.s.vh };
      for (const sec of L.phan) {
        const g = r.secs[sec.id], ok = g && !g.incomplete;
        o[`${sec.ten} /${secMax(S.level, sec)}`] = ok ? g.raw : (g ? 'thiếu trang' : '');
        if (isDaily()) o[`${sec.ten} %`] = ok ? pctTxt(g.raw, g.max) : ''; else { o[`${sec.ten} thang`] = ok ? scaleText(g.scale) : ''; o[`${sec.ten} CEFR`] = ok ? g.cefr : ''; }
        partsOf(S.level, sec).forEach(([p, n]) => o[`${sec.viet} Part ${p} (/${n})`] = ok ? g.parts[p] : '');
      }
      for (const p of PAPERS) o[`Chi tiết ${p === 'reading' ? 'Reading' : 'Listening'}`] = r.items[p].filter(Boolean).map(i => `${i.q}${i.type === 'write' ? '' : (i.chosen || '-')}${i.marks === i.maxMarks ? '✓' : i.marks > 0 ? '½' : '✗'}`).join(' ');
      if (hasWriting()) WR_COLS.forEach((c, k) => { o[c] = wrVals(r)[k]; });
      if (hasSpeaking()) spColsOf().forEach((c, k) => { o[c] = spVals(r)[k]; });
      { const dc = detCols(), dv = detVals(r); dc.forEach((c, k) => { o[c] = dv[k]; }); }
      o['Số câu tô không chuẩn'] = r.nonstd; o['Ghi chú'] = note(r); cmtVals(r).forEach((v, k) => { o[CM_COLS[k]] = v; });
      return o;
    });
    return { header, rows };
  }
  // ---------- lịch sử các đợt Mock (đọc từ Google Sheet) → ▲▼ so với đợt trước và biểu đồ tiến bộ ----------
  // Thứ tự đợt: trường "dot" trong de-thi/manifest.json; nếu không có thì lấy số cuối của id đề (pet-test2 → 2).
  let HIST = {}, histP = null, HIST_ERR = '';
  const dotOf = t => { if (!t) return null; if (t.dot != null && t.dot !== '' && Number.isFinite(+t.dot)) return +t.dot; const m = String(t.id).match(/(\d+)$/); return m ? +m[1] : null; };
  const sheetScale = v => { const m = String(v ?? '').trim().match(/^~?(\d+)$/); return m ? +m[1] : null; };   // "143", 143, "~143" → 143; "-", "Dưới 120", "thiếu trang" → null
  const histCols = () => [...lvl().phan.map(s => [s.id, `${s.ten} thang`]), ['writing', 'Writing thang'], ['speaking', 'Speaking thang']];
  function loadHistory() {
    HIST = {}; HIST_ERR = '';
    const code = lsGet('omr-tcode', '');
    if (!S || isDaily() || !CFG.on || !code || !S.dot) return (histP = Promise.resolve());
    const lv = S.level, byId = Object.fromEntries(TESTS.map(t => [t.id, t]));
    return (histP = fetch(CFG.sheetUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'history', code, level: lv, codes: students().map(x => x.code) }) }).then(x => x.json()).then(r => {
      if (!r.ok) throw new Error(r.error || 'Google Sheet từ chối');
      const H = r.header, iK = H.indexOf('Khoá'), iC = H.indexOf('Mã HS'), iD = H.indexOf('Đợt Mock'), cols = histCols().map(([id, name]) => [id, H.indexOf(name)]), out = {};
      for (const row of r.rows) {
        const [tid, cls] = String(row[iK]).split('|');
        if (tid === S.test && cls === S.cls) continue;   // chính phiên đang chấm
        // đợt Mock: cột "Đợt Mock"; dòng cũ chưa có cột này thì lấy theo số cuối của mã đề (pet-test1 → 1)
        const d = iD >= 0 && Number.isFinite(+row[iD]) && row[iD] !== '' ? +row[iD] : dotOf(byId[tid]);
        if (d == null) continue;
        const code6 = String(row[iC]).toUpperCase().replace(/\s/g, ''), sc = {};
        cols.forEach(([id, i]) => { sc[id] = i < 0 ? null : sheetScale(row[i]); });
        const arr = (out[code6] ||= []), k = arr.findIndex(x => x.dot === d);
        if (k >= 0) arr[k] = { id: tid, dot: d, s: sc }; else arr.push({ id: tid, dot: d, s: sc });
      }
      Object.values(out).forEach(a => a.sort((x, y) => x.dot - y.dot));
      HIST = out;
    }).catch(e => { HIST = {}; HIST_ERR = String(e.message || e); }));
  }
  const avgOf = (map, ids) => { const v = ids.map(k => map[k]).filter(x => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; };
  const idsOf = map => Object.keys(map).filter(k => map[k] != null).sort().join('+');
  // đợt Mock trước của học sinh: { prev, hist } — Overall chỉ so được khi hai đợt có cùng bộ kỹ năng có điểm
  function histFor(code, skills) {
    const cur = S.dot, list = (HIST[String(code).toUpperCase()] || []).filter(h => cur != null && h.dot < cur);
    if (!list.length) return null;
    const now = {}; skills.forEach(k => { now[k.id] = k.scale; }); const set = idsOf(now);
    const hist = list.map(h => ({ label: 'Mock ' + h.dot, s: h.s, overall: idsOf(h.s) === set ? avgOf(h.s, Object.keys(h.s)) : null }));
    return { prev: list[list.length - 1], hist, comparable: idsOf(list[list.length - 1].s) === set };
  }
  async function pushResults(loud, only) {
    if (!CFG.on || syncing || !S) return;
    const code = lsGet('omr-tcode', '');
    if (!code) { if (loud) alert('Chưa có mã giáo viên. Nhập ở bước 1 để sao lưu lên Google Sheet.'); return; }
    if (cloudOn() && !S.view) await pullSession(!loud).catch(() => {});   // lấy phần máy khác đã sao lưu trước, tránh ghi đè mất kỹ năng
    let { header, rows } = sheetRows();
    if (only) rows = rows.filter(r => only.includes(r['Mã HS']));
    if (!rows.length) { if (loud) alert('Chưa có phiếu nào để sao lưu.'); return; }
    syncing = true; renderSync('Đang sao lưu…');
    try {
      const r = await fetch(CFG.sheetUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'results', code, sheet: sheetTab(), header, rows }) }).then(x => x.json());
      if (!r.ok) throw new Error(r.error || 'Google Sheet từ chối');
      S.dirty = false; S.syncedAt = new Date().toISOString(); S.syncError = ''; save(false);
      if (cloudOn()) await pushSession(loud);
    } catch (e) {
      S.syncError = String(e.message || e);
      if (loud) alert('Chưa sao lưu được: ' + S.syncError + '\nKết quả vẫn lưu trên máy; app sẽ thử lại khi có thay đổi.');
    } finally { syncing = false; renderSync(); }
  }
  function renderSync(msg) {
    const el = $('#syncStatus'); if (!el) return;
    if (!CFG.on || !S) { el.hidden = true; return; }
    el.hidden = false;
    if (S.view && !msg) { el.hidden = false; el.innerHTML = `<span>Chế độ xem của quản lý: chỉ đọc. Nhận xét bạn sửa được lưu lên Google Sheet khi bấm "Lưu & cập nhật phiếu"${S.cloudErr ? ' (' + esc(S.cloudErr) + ')' : ''}.</span>`; return; }
    const txt = msg || (!lsGet('omr-tcode', '') ? 'Chưa nhập mã giáo viên — kết quả chỉ lưu trên máy này.'
      : !S.dirty && S.syncedAt ? `☁️ Đã sao lưu lên Google Sheet (tab "${sheetTab()}") lúc ${hhmm(new Date(S.syncedAt))}.`
      : S.syncedAt ? `Có thay đổi chưa sao lưu (lần trước: ${hhmm(new Date(S.syncedAt))}).` : 'Chưa sao lưu lên Google Sheet.');
    const warn = !msg && lsGet('omr-tcode', '') && (S.dirty || !S.syncedAt) ? '<br><b>Kết quả chỉ được cập nhật lên Google Sheet khi sao lưu.</b> Hãy bấm "Sao lưu ngay" trước khi đổi máy hoặc để quản lý xem.' : '';
    const cl = !msg && cloudOn() ? `<br><small>${S.cloudErr ? '⚠️ ' + esc(S.cloudErr) : S.cloudAt ? '☁️ Dữ liệu phiên (phiếu, Speaking, Writing) sao lưu lúc ' + hhmm(new Date(S.cloudAt)) + '.' : 'Dữ liệu phiên chưa sao lưu.'}</small>` : '';
    el.innerHTML = `<span>${esc(txt)}${warn}${cl}</span>${msg ? '' : '<button class="btn small" id="btnPush">Sao lưu ngay</button>'}`;
    const b = $('#btnPush'); if (b) b.onclick = () => pushResults(true);
  }


  // ---------- Dữ liệu phiên trên Google Sheet (tab "_Phiên"): đổi thiết bị và quản lý xem lại ----------
  // Chỉ thêm / ghi đè mục có giờ lưu mới hơn, không bao giờ xoá: xoá trên máy này không ảnh hưởng Google Sheet.
  // Ảnh phiếu và nhận xét tự động không đồng bộ. Nhận xét / ưu tiên đã sửa tay thì đồng bộ (mục "cm").
  // xoá một mục trên máy này: ghi nhớ giờ xoá để bản cũ trên Google Sheet không bị trả về máy (Google Sheet vẫn giữ nguyên, quét / nhập lại sẽ ghi đè)
  function tomb(key, part) { (S.cloudDel ||= {})[key + '|' + part] = Date.now(); if (S.cloud) delete S.cloud[key + '|' + part]; }
  const cloudOn = () => CFG.on && CFG.dongBoPhien !== false && !!lsGet('omr-tcode', '');
  const sheetPost = body => fetch(CFG.sheetUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) }).then(x => x.json());
  const CLOUD_OLD = 'Apps Script chưa cập nhật bản mới (thao tác putSession). Kết quả vẫn lưu bình thường; dùng "Xuất / Nhập dữ liệu" để chuyển giữa các máy.';
  function cloudData(key, part) {   // dữ liệu một mục, đúng dạng gửi lên Sheet
    if (part.startsWith('sheet:')) { const sh = (S.sheets[key] || {})[part.slice(6)]; if (!sh) return null; const c = { ...sh }; delete c.head; delete c.geo; delete c.pgk; delete c.fromCloud;   // bỏ ảnh (ảnh chỉ ở máy đã quét): chỉ giữ kết quả đọc
      for (const f of ['mcq', 'write']) if (c[f]) { c[f] = {}; for (const [q, v] of Object.entries(sh[f])) { const o = { ...v }; delete o.img; c[f][q] = o; } }
      return c; }
    if (part === 'writing') return (S.writing || {})[key] || null;
    if (part === 'speaking') return (S.speaking || {})[key] || null;
    if (part === 'online') return (S.online || {})[key] || null;
    if (part === 'cm') return (S.cmAt || {})[key] ? { comment: S.comments[key], priorities: (S.priorities || {})[key], pick: (S.pick || {})[key] } : null;
    return null;
  }
  function cloudItems() {   // mọi mục hiện có trên máy, kèm giờ lưu; mục đổi nội dung kể từ lần trước thì giờ lưu = bây giờ
    const cache = (S.cloud ||= {}), out = [];
    const keys = new Set([...Object.keys(S.sheets || {}), ...Object.keys(S.writing || {}), ...Object.keys(S.speaking || {}), ...Object.keys(S.online || {}), ...Object.keys(S.cmAt || {})]);
    const add = (key, part, nat, fixed) => {
      const data = cloudData(key, part); if (data == null) return;
      const k = key + '|' + part, j = JSON.stringify(data), c = cache[k];
      let at; if (fixed) at = nat; else if (!c) at = nat || 1; else if (c.j === j) at = c.at; else at = Date.now();
      if (!c || c.j !== j || c.at !== at) cache[k] = { j, at, sent: false };
      out.push({ k, key, part, at, json: j, sent: cache[k].sent });
    };
    for (const key of keys) {
      for (const pk of Object.keys(S.sheets[key] || {})) add(key, 'sheet:' + pk, +S.sheets[key][pk].at || 1);
      add(key, 'writing', +((S.writing || {})[key] || {}).at || 1); add(key, 'speaking', +((S.speaking || {})[key] || {}).at || 1);
      add(key, 'online', 1, true); add(key, 'cm', +(S.cmAt || {})[key] || 0, true);
    }
    return out;
  }
  function cloudMeta() {
    const ids = String(S.test).split('+');
    return { id: S.id, mode: S.mode, label: S.label, dot: S.dot, test: S.test, tid: ids[0], tidL: ids[1] || ids[0], testTitle: S.testTitle, mixed: !!S.mixed, level: S.level, cls: S.cls, writeDone: S.writeDone || {} };
  }
  async function pushSession(loud, onlyParts) {
    if (!cloudOn() || !S) return;
    try {
      const items = cloudItems().filter(i => !i.sent && (!onlyParts || onlyParts.includes(i.part)));
      if (!items.length) { S.cloudErr = ''; return; }
      const wire = items.map(i => ({ key: i.key, part: i.part, at: i.at, json: i.json }));
      if (!S.view) wire.push({ key: '', part: 'meta', at: Date.now(), json: JSON.stringify(cloudMeta()) });
      const r = await sheetPost({ action: 'putSession', code: lsGet('omr-tcode', ''), session: { id: S.id, cls: S.cls, level: S.level }, items: wire });
      if (!r.ok) throw new Error(/hợp lệ/.test(r.error || '') ? CLOUD_OLD : (r.error || 'Google Sheet từ chối'));
      const skip = new Set(r.skipped || []);
      items.forEach(i => { if (!skip.has(i.key + '|' + i.part) && S.cloud[i.k]) S.cloud[i.k].sent = true; });
      S.cloudAt = new Date().toISOString(); S.cloudErr = skip.size ? `${skip.size} mục quá dài nên chưa sao lưu được.` : '';
      save(false);
    } catch (e) {
      S.cloudErr = String(e.message || e);
      if (loud) alert('Chưa sao lưu được dữ liệu phiên: ' + S.cloudErr);
    } finally { renderSync(); }
  }
  let pulledAt = 0;
  async function pullSession(quiet) {
    if (!cloudOn() || !S) return 0;
    if (quiet && Date.now() - pulledAt < 15000) return 0;
    pulledAt = Date.now();
    let n = 0;
    try {
      const r = await sheetPost({ action: 'getSession', code: lsGet('omr-tcode', ''), id: S.id, cls: S.cls });
      if (!r.ok) throw new Error(/hợp lệ/.test(r.error || '') ? CLOUD_OLD : (r.error || 'Google Sheet từ chối'));
      const local = {}; if (!S.view) cloudItems().forEach(i => { local[i.k] = i; });
      for (const it of r.items) {
        if (it.part === 'meta') { try { Object.assign(S.writeDone, JSON.parse(it.json).writeDone || {}); } catch {} continue; }
        if (!it.key || !stuByKey(it.key)) continue;
        const k = it.key + '|' + it.part, l = local[k], td = (S.cloudDel || {})[k];
        if (td && it.at <= td) continue;   // đã xoá trên máy này sau lần lưu đó
        if (l && !(it.at > l.at)) continue;
        let d; try { d = JSON.parse(it.json); } catch { continue; }
        if (it.part.startsWith('sheet:')) {
          const pk = it.part.slice(6), old = (S.sheets[it.key] ||= {})[pk];
          if (old && +old.at === +d.at) {   // cùng một lần quét: giữ ảnh đang có trên máy này (mục đồng bộ không kèm ảnh)
            for (const f of ['head', 'geo', 'pgk']) if (old[f]) d[f] = old[f];
            for (const f of ['mcq', 'write']) for (const q of Object.keys(d[f] || {})) if (old[f] && old[f][q] && old[f][q].img) d[f][q].img = old[f][q].img;
          } else if (old && old.pgk) idb.del(old.pgk).catch(() => {});
          if (!d.pgk) d.fromCloud = true;   // phiếu lấy từ Google Sheet: không có ảnh
          S.sheets[it.key][pk] = d;
        }
        else if (it.part === 'writing') S.writing[it.key] = d;
        else if (it.part === 'speaking') S.speaking[it.key] = d;
        else if (it.part === 'online') (S.online ||= {})[it.key] = d;
        else if (it.part === 'cm') { S.comments[it.key] = d.comment; (S.priorities ||= {})[it.key] = d.priorities; if (d.pick) (S.pick ||= {})[it.key] = d.pick; (S.cmAt ||= {})[it.key] = it.at; }
        else continue;
        (S.cloud ||= {})[k] = { j: JSON.stringify(cloudData(it.key, it.part)), at: it.at, sent: true }; n++;
      }
      S.cloudErr = '';
      if (n) { save(); renderRoster(); renderUnknown(); updateBadges(); }
    } catch (e) { S.cloudErr = String(e.message || e); if (!quiet) alert('Chưa lấy được dữ liệu từ Google Sheet: ' + S.cloudErr); }
    renderSync();
    return n;
  }
  // nhận xét / ưu tiên / kỹ năng đưa vào phiếu vừa được sửa → ghi giờ sửa; quản lý (chế độ xem) thì lưu thẳng lên Sheet
  const viewDirty = new Set(); let viewTimer;
  function touchCm(key) {
    (S.cmAt ||= {})[key] = Date.now();
    if (!S.view) return;
    viewDirty.add(key); clearTimeout(viewTimer);
    viewTimer = setTimeout(async () => {
      const keys = [...viewDirty]; viewDirty.clear();
      await pushSession(true, ['cm']);
      await pushResults(false, keys.map(k => (stuByKey(k) || {}).code).filter(Boolean));
    }, 600);
  }

  // ---------- danh sách phiên trên Sheet + chế độ xem của quản lý ----------
  const isAdmin = () => !!lsGet('omr-teacher', {}).admin;
  async function listCloud() {
    const box = $('#sessList'); box.innerHTML = '<p class="hint">Đang lấy danh sách…</p>';
    try {
      const r = await sheetPost({ action: 'listSessions', code: lsGet('omr-tcode', '') });
      if (!r.ok) throw new Error(/hợp lệ/.test(r.error || '') ? CLOUD_OLD : (r.error || 'Google Sheet từ chối'));
      const list = r.sessions.map(s => { let m = {}; try { m = JSON.parse(s.json); } catch {} return { ...s, m }; }).filter(s => s.m.level);
      box.innerHTML = list.length ? list.map((s, i) => `<div class="card"><div><b>${esc(s.m.testTitle || s.id)}</b> · ${s.m.mode === 'daily' ? 'Hằng ngày' + (s.m.label ? ' (' + esc(s.m.label) + ')' : '') : 'Mock ' + esc(s.m.dot)} · ${esc(s.cls)}</div>
          <div class="hint" style="margin:4px 0 8px">${s.students} học sinh · giáo viên ${esc(s.who)} · cập nhật ${new Date(s.at).toLocaleString('vi-VN')}</div>
          <div class="row">${isAdmin() ? `<button class="btn small primary" data-sv="${i}">Xem bài (chỉ đọc)</button>` : ''}<button class="btn small" data-su="${i}">Chọn để chấm tiếp</button></div></div>`).join('')
        : '<p class="hint">Chưa có phiên nào được sao lưu lên Google Sheet.</p>';
      box.querySelectorAll('[data-sv]').forEach(b => b.onclick = () => openView(list[+b.dataset.sv]));
      box.querySelectorAll('[data-su]').forEach(b => b.onclick = () => useSession(list[+b.dataset.su]));
    } catch (e) { box.innerHTML = `<div class="notice err">${esc(e.message || e)}</div>`; }
  }
  function useSession(s) {   // điền sẵn lớp / đề / đợt ở bước 1 để chấm tiếp trên máy này
    const m = s.m;
    if (!rosters()[s.cls]) { alert('Máy này chưa có danh sách lớp ' + s.cls + '. Bấm "Cập nhật danh sách lớp" rồi thử lại.'); return; }
    setMode(m.mode === 'daily' ? 'daily' : 'mock');
    $('#selClass').value = s.cls; fillTests();
    $('#selTest').value = m.tid || String(m.test).split('+')[0];
    const mixed = !!m.mixed; $('#mixOn').checked = mixed; setMix(); if (mixed) $('#selTestL').value = m.tidL;
    if (m.dot) $('#selDot').value = m.dot; if (m.label) $('#dayLabel').value = m.label;
    $('#btnStart').scrollIntoView({ behavior: 'smooth', block: 'center' });
    alert('Đã chọn sẵn lớp và đề của phiên này. Bấm "Bắt đầu chấm"; dữ liệu trên Google Sheet được lấy về khi bạn sao lưu hoặc xuất kết quả.');
  }
  async function openView(s) {
    const m = s.m, R = rosters()[s.cls];
    if (!R) { alert('Máy này chưa có danh sách lớp ' + s.cls + '. Bấm "Cập nhật danh sách lớp" rồi thử lại.'); return; }
    const ids = String(m.test).split('+'), t = TESTS.find(x => x.id === ids[0]), tL = TESTS.find(x => x.id === (ids[1] || ids[0]));
    if (!t || !tL || !LV[m.level]) { alert('Đề của phiên này không có trong kho đề của app.'); return; }
    const loadKey = tt => fetch('de-thi/' + tt.file).then(r => r.json());
    const KR = await loadKey(t), KL = ids[1] ? await loadKey(tL) : KR;
    KEY = ids[1] ? { ...KR, listening: KL.listening } : KR;
    S = { id: s.id, mode: m.mode || 'mock', label: m.label || '', dot: m.dot, test: m.test, testTitle: m.testTitle, mixed: !!m.mixed, level: m.level, cls: s.cls,
      sheets: {}, unknown: [], writeDone: m.writeDone || {}, comments: {}, priorities: {}, writing: {}, speaking: {}, online: {}, view: true, grader: s.who };
    document.documentElement.style.setProperty('--ruby', LV[S.level].mau);
    document.body.classList.add('view-mode');
    $('#ctx').textContent = `XEM · ${S.testTitle}${isDaily() ? ' · Hằng ngày' : ` · Mock ${S.dot}`} · ${S.cls}`;
    $('#viewWho').textContent = `Giáo viên chấm: ${s.who}`;
    pulledAt = 0; const n = await pullSession(false);
    loadHistory(); lk.stu = '';
    if (!n) alert('Phiên này chưa có dữ liệu học sinh trên Google Sheet.');
    go('look');
  }
  function closeView() {
    S = null; document.body.classList.remove('view-mode'); $('#ctx').textContent = ''; go('setup');
  }
  // ---------- "Xem bài": lướt từng học sinh như giáo viên đã chấm (không có ảnh phiếu) ----------
  const lk = { stu: '' };
  function renderLook() {
    const rs = results().filter(r => r.any), L = lvl();
    if (!rs.length) { $('#lkBody').innerHTML = '<div class="empty">Chưa có học sinh nào có bài.</div>'; $('#lkStu').innerHTML = ''; return; }
    if (!rs.some(r => r.s.key === lk.stu)) lk.stu = rs[0].s.key;
    $('#lkStu').innerHTML = rs.map(r => `<option value="${r.s.key}">${esc(r.s.name)} (${esc(r.s.code)})</option>`).join(''); $('#lkStu').value = lk.stu;
    const i = rs.findIndex(r => r.s.key === lk.stu), r = rs[i];
    $('#lkPrev').disabled = i <= 0; $('#lkNext').disabled = i >= rs.length - 1;
    let h = `<h3 style="margin:8px 0">${esc(r.s.name)} <small class="hint">${esc(r.s.code)} · ${esc(r.s.vh)}</small></h3>`;
    for (const sec of L.phan) {
      const g = r.secs[sec.id], p = sec.giay;
      h += `<div class="card"><b>${esc(sec.ten)}</b> ${g ? (g.incomplete ? '<span class="hint">chưa đủ trang</span>' : `<b>${g.raw}/${g.max}</b> · ${isDaily() ? pctTxt(g.raw, g.max) : 'thang ' + esc(scaleText(g.scale)) + ' · ' + esc(g.cefr)}`) : '<span class="hint">chưa có bài</span>'}`;
      if (g && !g.incomplete) {
        h += '<div class="lkgrid">' + secQs(S.level, sec).map(q => {
          const it = r.items[p].find(x => x && x.q === q); if (!it) return '';
          const sh = (S.sheets[r.s.key] || {})[QMAP[S.level][p][q].page], ed = sh && sh.over && sh.over[q];
          const cls = it.flag ? 'warn' : it.ok ? 'ok' : 'bad', ans = it.type === 'write' ? it.shown : (it.chosen || '—') + (it.ok ? '' : '→' + (it.key || (KEY[p] || {})[q] || '?'));
          return `<span class="lk ${cls}${ed ? ' edit' : ''}" title="${ed ? 'Giáo viên đã sửa' : ''}">${q}<small>${esc(ans)}</small></span>`;
        }).join('') + '</div><p class="hint" style="margin:6px 0 0">Xanh: đúng · Đỏ: sai (học sinh chọn → đáp án) · Vàng: chưa duyệt · Viền xanh dương: giáo viên đã sửa</p>';
      }
      h += '</div>';
    }
    const w = writingOf(r.s);
    if (w) h += `<div class="card"><b>Writing</b> ${w.total.raw}/${w.total.raw_max} · thang ${esc(wrScaleText(w))}` + (w.parts || []).map(pt => `<details style="margin-top:8px"><summary><b>Part ${pt.part}</b> · ${pt.raw}/${pt.raw_max} · ${pt.word_count || '?'} từ — ${esc(pt.short_comment || pt.general_feedback || '')}</summary>
      <div class="hint" style="margin:6px 0">${(pt.criteria || []).map(c => `${esc(c.id)}: ${c.band}/${c.max}`).join(' · ')}</div><div style="white-space:pre-wrap;font-size:14px">${esc(pt.text || '')}</div></details>`).join('') + '</div>';
    const sp = (S.speaking || {})[r.s.key];
    if (sp) { const v = spVals(r); h += `<div class="card"><b>Speaking</b> ${v[0] === '' ? '' : v[0] + '/' + v[1] + ' · ' + (isDaily() ? '' : 'thang ') + esc(String(v[2]))}<div class="hint" style="margin-top:6px">${Object.entries(sp.bands || {}).map(([c, b]) => `${esc(c)}: ${b}`).join(' · ')}${sp.weakPart ? ' · Part yếu: ' + esc([].concat(sp.weakPart).join(', ')) : ''}</div></div>`; }
    if (!isDaily()) h += '<div class="row" style="margin-top:12px"><button class="btn primary" id="lkRp">Xem phiếu báo điểm và sửa nhận xét</button></div>';
    $('#lkBody').innerHTML = h;
    const rp = $('#lkRp'); if (rp) rp.onclick = () => studentReport(r.s.key);
  }

  // ---------- phiên chấm ----------
  async function start() {
    const cls = $('#selClass').value, tid = $('#selTest').value, R = rosters()[cls];
    if (!R) { alert('Hãy chọn lớp (cập nhật danh sách lớp trước).'); return; }
    const t = TESTS.find(x => x.id === tid);
    if (!t) { alert(`Chưa có đề ${R.level} nào trong kho đề.`); return; }
    // Reading lấy từ đề tid, Listening có thể lấy từ đề khác (tidL). Phiếu giấy dùng chung, chỉ đáp án được ghép.
    const tidL = $('#mixOn').checked ? $('#selTestL').value : tid, tL = TESTS.find(x => x.id === tidL), mixed = tidL !== tid;
    if (!tL) { alert('Hãy chọn đề cho Listening.'); return; }
    const loadKey = tt => fetch('de-thi/' + tt.file).then(r => r.json());
    const KR = await loadKey(t), KL = mixed ? await loadKey(tL) : KR;
    for (const [tt, kk] of [[t, KR], [tL, KL]]) if ((kk.level || tt.level) !== R.level) { alert(`Đề ${tt.title} là đề ${kk.level || tt.level}, lớp này học ${R.level}.`); return; }
    KEY = mixed ? { ...KR, listening: KL.listening } : KR;
    const sid = mixed ? `${tid}+${tidL}` : tid, title = mixed ? `${t.title} (R) + ${tL.title} (L)` : t.title;
    lsSet('omr-last', { test: tid, testL: mixed ? tidL : '', cls });
    const label = MODE === 'daily' ? ($('#dayLabel').value.trim() || new Date().toLocaleDateString('vi-VN')) : '', dot = MODE === 'mock' ? +$('#selDot').value : null;
    const id = MODE === 'daily' ? `d2:${sid}:${cls}:${label}` : `s2:${sid}:${cls}`;   // phiên Mock giữ nguyên khoá cũ
    const found = await idb.get(id);
    if (found && dot && found.dot && found.dot !== dot && !confirm(`Phiên này đang được lưu là Mock ${found.dot}. Đổi thành Mock ${dot}?`)) return;
    if (dot) lsSet('omr-dot', { ...lsGet('omr-dot', {}), [cls]: dot });
    S = found || { id, mode: MODE, label, dot, test: sid, testTitle: title, mixed, level: R.level, cls, sheets: {}, unknown: [], writeDone: {}, comments: {}, priorities: {}, writing: {}, speaking: {}, online: {} };
    S.comments = S.comments || {}; S.writing = S.writing || {}; S.speaking = S.speaking || {}; S.mode = S.mode || 'mock'; S.label = S.label || ''; S.dot = dot;
    document.documentElement.style.setProperty('--ruby', LV[S.level].mau);
    $('#ctx').textContent = `${S.testTitle}${isDaily() ? ' · Hằng ngày' + (S.label ? ` (${S.label})` : '') : ` · Mock ${S.dot}`} · ${cls}`;
    loadHistory();
    go('scan');
    pulledAt = 0; pullSession(true);   // phiên đã có trên Google Sheet (chấm ở máy khác) thì lấy về
  }
  const students = () => rosters()[S.cls]?.students || [];
  const stuByKey = k => students().find(s => s.key === k);

  // ---------- xử lý ảnh ----------
  async function handleFiles(files) {
    if (!cvReady) { alert('Bộ nhận dạng chưa tải xong, đợi vài giây rồi thử lại.'); return; }
    for (const f of files) {
      const run = document.createElement('div'); run.className = 'q-run'; run.textContent = `Đang đọc ${f.name}…`;
      $('#queue').prepend(run);
      await new Promise(r => setTimeout(r, 30));
      let msg;
      try { msg = await processFile(f); }
      catch (e) { console.error(e); msg = { cls: 'q-err', html: `${esc(f.name)}: lỗi khi đọc ảnh (${esc(e.message || e)}).` }; }
      run.remove(); addQueueLine(msg);
    }
    renderRoster(); renderUnknown(); updateBadges(); save();
  }
  async function processFile(f) {
    const bmp = await createImageBitmap(f);
    const sc = Math.min(1, 2600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); bmp.close?.();
    const res = OMR.process(window.cv, c.getContext('2d').getImageData(0, 0, c.width, c.height), TPL);
    if (!res.ok) return { cls: 'q-err', html: `${esc(f.name)}: ${esc(res.error)}` };
    return record(res, false);
  }
  // Mã tô thiếu / mờ ở 1–2 cột (vd 26?159): nếu CHỈ MỘT học sinh trong lớp khớp các chữ số còn lại thì dùng học sinh đó và báo "kiểm tra lại"
  function guessByCode(res) {
    const c = String(res.code || ''), q = (c.match(/\?/g) || []).length;
    if (res.codeOk || c.length !== 6 || q < 1 || q > 2 || q === 6) return null;
    const re = new RegExp('^' + c.replace(/\?/g, '\\d') + '$'), hit = students().filter(s => re.test(s.key));
    return hit.length === 1 ? hit[0] : null;
  }
  // ghi kết quả một phiếu; auto = đang quét tự động (không hỏi, bỏ qua phiếu trùng)
  function record(res, auto) {
    if (res.level !== S.level)
      return { cls: 'q-err', html: `Đây là phiếu <b>${esc(res.level)}</b> (${esc(pageName(res.page))}), lớp đang chấm là <b>${esc(S.level)}</b> — không ghi.`,
        short: `Phiếu ${res.level} — lớp đang chấm ${S.level}` };
    if (TPL.pages[res.page].skill === 'speaking') return recordSpeaking(res, auto);
    const sheet = buildSheet(res);
    const guess = res.codeOk ? null : guessByCode(res);
    const stu = res.codeOk ? stuByKey(res.code) : guess;
    if (guess) { const m = assign(guess.key, res.page, sheet, auto); if (m && m.ok !== false) { m.cls = 'q-flag'; m.html += ` <i>(mã tô chưa rõ "${esc(res.code)}", khớp duy nhất với học sinh này, kiểm tra lại)</i>`; } return m; }
    if (!stu) {
      const id = Date.now() + Math.random();
      S.unknown.push({ id, page: res.page, code: res.code, sheet });
      const why = res.codeOk ? `mã ${res.code} không có trong lớp ${S.cls}` : `mã tô chưa rõ (${res.code})`;
      return { cls: 'q-err', html: `${esc(pageName(res.page))}: ${esc(why)} — chọn học sinh ở mục bên dưới.`, ref: { unknown: id }, short: `${pageShort(res.page)}: ${why}` };
    }
    return assign(stu.key, res.page, sheet, auto);
  }
  // phiếu chấm Speaking: đọc band + mã chẩn đoán + part yếu (viet/speaking-quet.js), lưu vào S.speaking
  function recordSpeaking(res, auto) {
    const stu = res.codeOk ? stuByKey(res.code) : null;
    if (!stu) {
      const why = res.codeOk ? `mã ${res.code} không có trong lớp ${S.cls}` : `mã tô chưa rõ (${res.code})`;
      return { cls: 'q-err', html: `Phiếu Speaking: ${esc(why)}. Chụp lại hoặc nhập tay ở bước 6.`, short: `Speaking: ${why}` };
    }
    S.speaking = S.speaking || {};
    if (S.speaking[stu.key] && auto) return { cls: 'q-err', dup: true, html: `Đã có Speaking của ${esc(stu.name)} — bỏ qua.`, short: `Đã có Speaking của ${stu.name} — bỏ qua` };
    if (S.speaking[stu.key] && !confirm(`Đã có kết quả Speaking của ${stu.name}. Thay bằng phiếu mới?`)) return { cls: 'q-err', html: `Giữ kết quả Speaking cũ của ${esc(stu.name)}.` };
    const d = window.SpeakingScan.fromResult(S.level, res, TPL);
    const need = Object.keys(window.SpeakingScore.WEIGHT[S.level]).filter(c => !d.bands[c]);
    S.speaking[stu.key] = { bands: d.bands, evidence: d.evidence, weakPart: d.weakPart, rows: d.rows || {}, at: Date.now(), scan: true, flags: d.flags.map(f => f.text) };
    const bad = d.flags.map(f => f.text);
    const note = need.length || bad.length ? ` · cần xem lại ở bước 6: ${[...need.map(c => 'thiếu band ' + c), ...bad.filter(t => !/^Band/.test(t))].join(', ')}` : ' · đọc tốt';
    return { cls: need.length || bad.length ? 'q-flag' : 'q-ok', ok: true, short: `✓ ${stu.name} — Speaking${note}`, html: `<b>${esc(stu.name)}</b> (${stu.code}) — Speaking${esc(note)}` };
  }
  function addQueueLine(msg) {
    const line = document.createElement('div'); line.className = msg.cls;
    line.innerHTML = `<span>${msg.html}</span>`;
    if (msg.ref) {
      const b = document.createElement('button'); b.className = 'btn small danger'; b.textContent = 'Xoá';
      b.onclick = () => { if (removeRef(msg.ref)) { line.className = 'q-del'; line.innerHTML = `<span>Đã xoá: ${msg.html}</span>`; } };
      line.appendChild(b);
    }
    $('#queue').prepend(line);
  }
  function crop(res, x0, y0, x1, y1, k = 0.5) {   // toạ độ mm → ảnh JPEG
    const S_ = res.S, W = res.width;
    const X0 = Math.max(0, Math.round(x0 * S_)), Y0 = Math.max(0, Math.round(y0 * S_));
    const w = Math.round((x1 - x0) * S_), h = Math.round((y1 - y0) * S_);
    const cw = Math.round(w * k), ch = Math.round(h * k);
    const c = document.createElement('canvas'); c.width = cw; c.height = ch;
    const ctx = c.getContext('2d'), im = ctx.createImageData(cw, ch);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const v = res.px[(Y0 + Math.floor(y / k)) * W + X0 + Math.floor(x / k)], i = (y * cw + x) * 4;
      im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255;
    }
    ctx.putImageData(im, 0, 0);
    return c.toDataURL('image/jpeg', 0.72);
  }


  function pageJpeg(res) {   // ảnh xám cả trang A4 (đã nắn) thu còn 5 px/mm
    const W = res.width, H = res.height, c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d'), im = ctx.createImageData(W, H), d = im.data, px = res.px;
    for (let i = 0, j = 0; i < px.length; i++, j += 4) { d[j] = d[j + 1] = d[j + 2] = px[i]; d[j + 3] = 255; }
    ctx.putImageData(im, 0, 0);
    const s = document.createElement('canvas'); s.width = Math.round(W * 0.5); s.height = Math.round(H * 0.5);
    const sx = s.getContext('2d'); sx.imageSmoothingQuality = 'high'; sx.drawImage(c, 0, 0, s.width, s.height);
    return s.toDataURL('image/jpeg', 0.62);
  }
  // <<annot
  // Vẽ phiếu đã chấm: xanh lá = tô đúng · đỏ = tô sai · vòng xanh lá = đáp án đúng (khi sai/bỏ trống) · vàng = tô chưa chuẩn · xanh dương = ô câu viết
  const ANN = { ok: [30, 170, 90], bad: [225, 50, 45], warn: [245, 190, 20], write: [60, 150, 240], edit: [40, 90, 220] };
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  function drawAnnotated(img, sh, p, head) {
    const K = img.width / 210, bh = Math.round(K * 15.5), W = img.width, H = img.height + bh;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.drawImage(img, 0, bh);
    const R = (sh.geo.rb || 2.3) * K * 1.12, lw = Math.max(2, K * 0.4);
    const dot = (x, y, col, ring) => {
      g.beginPath(); g.arc(x, y + bh, R, 0, Math.PI * 2);
      if (ring) { g.lineWidth = lw; g.strokeStyle = rgba(col, 0.95); g.stroke(); }
      else { g.fillStyle = rgba(col, 0.55); g.fill(); g.lineWidth = lw * 0.6; g.strokeStyle = rgba(col, 1); g.stroke(); }
    };
    let got = 0, max = 0;
    const qs = Object.keys(sh.geo.m).concat(Object.keys(sh.geo.w)).map(Number).sort((a, b) => a - b);
    for (const q of qs) {
      const it = gradeQ(p, q, sh); got += it.marks; max += it.maxMarks;
      if (it.type === 'write') {
        const b = sh.geo.w[q], w = sh.write[q], x = b[0] * K, y = b[1] * K + bh, bw = b[2] * K, bhh = b[3] * K;
        const col = it.ok ? ANN.ok : it.marks > 0 ? ANN.warn : ANN.bad;
        g.fillStyle = rgba(ANN.write, 0.30); g.fillRect(x, y, bw, bhh);
        g.lineWidth = lw * 1.3; g.strokeStyle = rgba(col, 1); g.strokeRect(x, y, bw, bhh);
        const t = w.blank ? 'bỏ trống' : (it.ok ? '✓' : it.marks > 0 ? `${it.marks}/${it.maxMarks}` : '✗');
        g.font = `700 ${Math.round(K * 2.9)}px "Be Vietnam Pro", Arial, sans-serif`; g.textBaseline = 'middle'; g.textAlign = 'right';
        const tw = g.measureText(t).width + K * 2.4;
        g.fillStyle = rgba(col, 1); g.fillRect(x + bw - tw, y - K * 3.4, tw, K * 3.4);
        g.fillStyle = '#fff'; g.fillText(t, x + bw - K * 1.2, y - K * 1.7);
        continue;
      }
      const m = sh.mcq[q], o = sh.over[q], key = (KEY[p] || {})[q], opts = sh.geo.m[q], at = L => { const e = opts.find(v => v[0] === L); return e ? [e[1] * K, e[2] * K] : null; };
      const flag = isFlag(m), acc = o && o.accept;
      if (acc || (!flag && m.status === 'ok')) {
        const L = acc || m.answer, ps = at(L); if (ps) dot(ps[0], ps[1], L === key ? ANN.ok : ANN.bad, false);
      } else if (flag) {
        for (const L of String(m.answer)) { const ps = at(L); if (ps) dot(ps[0], ps[1], ANN.warn, false); }
      }
      if (typeof key === 'string' && it.chosen !== key) { const ps = at(key); if (ps) dot(ps[0], ps[1], ANN.ok, true); }
      if (o && o.manual && o.accept) { const ps = at(o.accept); if (ps) { g.beginPath(); g.arc(ps[0], ps[1] + bh, R * 1.45, 0, Math.PI * 2); g.lineWidth = lw * 1.2; g.strokeStyle = rgba(ANN.edit, 1); g.stroke(); } }
    }
    // dải thông tin phía trên
    g.fillStyle = '#F4F6FA'; g.fillRect(0, 0, W, bh); g.fillStyle = '#D5DAE3'; g.fillRect(0, bh - 2, W, 2);
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillStyle = '#1B2437'; g.font = `700 ${Math.round(K * 4.2)}px "Be Vietnam Pro", Arial, sans-serif`;
    g.fillText(head.title, K * 6, K * 5.6);
    g.font = `400 ${Math.round(K * 3.1)}px "Be Vietnam Pro", Arial, sans-serif`; g.fillStyle = '#4A5468';
    g.fillText(head.sub + `  ·  ${got}/${max} điểm`, K * 6, K * 10);
    const leg = [['ok', 'tô đúng'], ['bad', 'tô sai'], ['ring', 'đáp án đúng'], ['warn', 'tô chưa chuẩn / mờ'], ['write', 'câu viết'], ['edit', 'GV đã sửa']];
    let lx = K * 6; const ly = K * 13.8;
    g.font = `400 ${Math.round(K * 2.7)}px "Be Vietnam Pro", Arial, sans-serif`;
    for (const [k, t] of leg) {
      g.beginPath(); g.arc(lx + K * 1.3, ly - K * 0.9, K * 1.2, 0, Math.PI * 2);
      if (k === 'ring') { g.lineWidth = lw; g.strokeStyle = rgba(ANN.ok, 1); g.stroke(); }
      else if (k === 'edit') { g.lineWidth = lw; g.strokeStyle = rgba(ANN.edit, 1); g.stroke(); }
      else if (k === 'write') { g.fillStyle = rgba(ANN.write, 0.5); g.fillRect(lx, ly - K * 2.1, K * 2.8, K * 2.4); }
      else { g.fillStyle = rgba(ANN[k], 0.7); g.fill(); }
      g.fillStyle = '#4A5468'; g.fillText(t, lx + K * 3.6, ly); lx += K * 3.6 + g.measureText(t).width + K * 3.2;
    }
    return c;
  }
  // annot>>
  const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  async function exportPhieu() {
    const rs = results().filter(r => Object.keys(S.sheets[r.s.key] || {}).length);
    if (!rs.length) { alert('Chưa có phiếu nào được quét trong đợt này.'); return false; }
    busy('Đang tạo file phiếu làm bài…');
    let pdf = null, n = 0, skip = 0;
    try {
      await loadScript(LIBS[1]);
      for (const r of rs) for (const p of PAPERS) for (const pk of (LV[S.level].giay[p] || [])) {
        const sh = S.sheets[r.s.key]?.[pk]; if (!sh) continue;
        const data = sh.pgk && sh.geo ? await idb.get(sh.pgk).catch(() => null) : null;
        if (!data) { skip++; continue; }
        const c = drawAnnotated(await loadImg(data), sh, p, { title: `${r.s.name}  (${r.s.code})  ·  ${S.cls}`, sub: `${S.testTitle}  ·  ${pageName(pk)}` });
        const h = 210 * c.height / c.width;
        if (!pdf) pdf = new window.jspdf.jsPDF({ unit: 'mm', format: [210, h], orientation: 'p' }); else pdf.addPage([210, h], 'p');
        pdf.addImage(c.toDataURL('image/jpeg', 0.85), 'JPEG', 0, 0, 210, h);
        n++; $('#loadingMsg').textContent = `Đang tạo file phiếu làm bài… ${n}`;
        await new Promise(res => setTimeout(res, 0));
      }
    } catch (e) { console.error(e); busy(''); alert('Không tạo được file phiếu làm bài: ' + (e.message || e)); return false; }
    busy('');
    if (!pdf) { alert('Các phiếu trong đợt này được quét trước khi app có tính năng lưu ảnh phiếu, nên chưa xuất được phiếu làm bài. Quét lại phiếu (xoá phiếu cũ trước) để có ảnh.'); return false; }
    download(pdf.output('blob'), fname('pdf').replace('ket-qua_', 'phieu-lam-bai_'));
    if (skip) setTimeout(() => alert(`Đã xuất ${n} phiếu. ${skip} phiếu quét trước bản cập nhật không có ảnh nên không có trong file.`), 400);
    return true;
  }

  function buildSheet(res) {
    const sh = { page: res.page, at: Date.now(), mcq: {}, write: {}, over: {}, head: crop(res, 15, 36, 195, 106, 0.35) };
    // ảnh cả trang (đã nắn thẳng) + toạ độ từng ô: dùng để xuất "phiếu làm bài đã tô màu" cho giáo viên kiểm tra
    try {
      const T0 = TPL.pages[res.page], vv = ((TPL.variants || {})[res.page] || []).find(v => (v.layout || '') === res.layout), TT = vv || T0;
      sh.geo = { rb: TT.bubble_radius_mm || TT.ring_mm || TPL.bubble_radius_mm || 2.3, m: {}, w: {} };
      for (const [q, m] of Object.entries(res.mcq)) sh.geo.m[q] = (m.opts || []).map(o => [o.label, o.x, o.y]);
      for (const [q, w] of Object.entries(res.write)) sh.geo.w[q] = [w.box.x, w.box.y, w.box.w, w.box.h].map(v => +v.toFixed(1));
      sh.pgk = `pg:${S.id}:${sh.at}:${Math.random().toString(36).slice(2, 7)}`;
      idb.set(sh.pgk, pageJpeg(res)).catch(() => {});
    } catch (e) { console.error(e); delete sh.pgk; }
    for (const [q, m] of Object.entries(res.mcq)) {
      sh.mcq[q] = { answer: m.answer, status: m.status };
      if (m.status === 'nonstd' || m.status === 'multi' || m.status === 'faint')
        sh.mcq[q].img = crop(res, m.row.x0 - 9, m.row.y - 5.5, m.row.x1 + 2, m.row.y + 5.5, 0.6);
    }
    for (const [q, w] of Object.entries(res.write)) {
      const b = w.box;
      sh.write[q] = { blank: w.blank, verdict: null, img: crop(res, b.x - 1, b.y - 1, b.x + b.w + 1, b.y + b.h + 1, 0.5) };
    }
    return sh;
  }
  function assign(key, page, sheet, auto) {
    const stu = stuByKey(key);
    S.sheets[key] = S.sheets[key] || {};
    const old = S.sheets[key][page], restored = !!old && old.fromCloud && !old.pgk;   // bản lấy từ Google Sheet (không ảnh): quét lại thì thay luôn
    if (old && auto && !restored)
      return { cls: 'q-err', dup: true, html: `Đã có phiếu ${esc(pageName(page))} của ${esc(stu.name)} — bỏ qua. Muốn quét lại thì xoá phiếu cũ trước.`,
        short: `Đã có ${pageShort(page)} của ${stu.name} — bỏ qua` };
    if (old && !restored && !confirm(`Đã có phiếu ${pageName(page)} của ${stu.name}. Thay bằng phiếu mới?`))
      return { cls: 'q-err', html: `Giữ phiếu ${esc(pageName(page))} cũ của ${esc(stu.name)}.` };
    if (S.sheets[key][page]?.pgk) idb.del(S.sheets[key][page].pgk).catch(() => {});
    S.sheets[key][page] = sheet;
    const paper = TPL.pages[page].skill;
    Object.keys(S.writeDone).filter(k => k.startsWith(paper + '-') && QMAP[S.level][paper][k.split('-')[1]]?.page === page).forEach(k => delete S.writeDone[k]);
    const nf = flagCount(sheet);
    return { cls: nf ? 'q-flag' : 'q-ok', ref: { key, page, at: sheet.at }, ok: true,
      short: `✓ ${stu.name} — ${pageName(page)}${nf ? ` · ${nf} câu cần duyệt` : ''}`,
      html: `<b>${esc(stu.name)}</b> (${stu.code}) — ${esc(pageName(page))}${nf ? ` · ${nf} câu cần duyệt` : ' · đọc tốt'}` };
  }
  function removeRef(ref) {
    if (ref.unknown) {
      const n = S.unknown.length; S.unknown = S.unknown.filter(u => u.id !== ref.unknown);
      if (S.unknown.length === n) { alert('Phiếu này đã được gán cho học sinh hoặc đã xoá.'); return false; }
    } else {
      const st = S.sheets[ref.key], stu = stuByKey(ref.key);
      if (!st?.[ref.page] || st[ref.page].at !== ref.at) { alert('Phiếu này đã được thay bằng phiếu khác hoặc đã xoá.'); return false; }
      if (!confirm(`Xoá phiếu ${pageName(ref.page)} của ${stu ? stu.name : ref.key}?`)) return false;
      if (st[ref.page].pgk) idb.del(st[ref.page].pgk).catch(() => {});
      delete st[ref.page]; if (!Object.keys(st).length) delete S.sheets[ref.key];
      tomb(ref.key, 'sheet:' + ref.page);
    }
    renderScan(); save(); return true;
  }
  const isFlag = m => m.status === 'nonstd' || m.status === 'multi' || m.status === 'faint';
  const flagCount = sh => Object.values(sh.mcq).filter(isFlag).length;
  const pendingFlags = sh => Object.entries(sh.mcq).filter(([q, m]) => isFlag(m) && !sh.over[q]).length;

  // ---------- quét tự động bằng camera ----------
  const cam = { running: false, busy: false, stream: null, last: null, stable: 0, locked: null, clear: 0, lastSig: '', count: 0, audio: null };
  const PREVIEW = 720, STABLE_FRAMES = 3, STILL = 0.012, MOVED = 0.10, MIN_AREA = 0.22;

  async function startScanner() {
    if (!cvReady) { alert('Bộ nhận dạng chưa tải xong, đợi vài giây rồi thử lại.'); return; }
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      alert('Trình duyệt này không mở được camera trong app. Hãy mở link bằng Safari (iPhone) hoặc Chrome (Android), không mở trong Zalo/Messenger. Tạm thời có thể dùng nút "Chụp từng ảnh".');
      return;
    }
    $('#scanner').hidden = false; setStatus('Đang mở camera…');
    try {
      cam.stream = await navigator.mediaDevices.getUserMedia({ audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 3840 }, height: { ideal: 2160 } } });
    } catch (e) {
      $('#scanner').hidden = true;
      alert(e.name === 'NotAllowedError'
        ? 'App chưa được phép dùng camera. Vào cài đặt trình duyệt, cho phép camera cho trang này rồi thử lại.'
        : 'Không mở được camera (' + e.name + '). Có thể dùng nút "Chụp từng ảnh" thay thế.');
      return;
    }
    const track = cam.stream.getVideoTracks()[0];
    try { await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }); } catch {}
    const v = $('#camVideo'); v.srcObject = cam.stream;
    try { await v.play(); } catch {}
    try { cam.audio = cam.audio || new (window.AudioContext || window.webkitAudioContext)(); cam.audio.resume?.(); } catch {}
    Object.assign(cam, { running: true, busy: false, last: null, stable: 0, locked: null, clear: 0, lastSig: '', count: 0 });
    $('#scanCount').textContent = 'Chưa quét phiếu nào'; $('#scanLast').textContent = '';
    setStatus('Đưa phiếu vào khung hình');
    tick();
  }

  function stopScanner() {
    cam.running = false;
    cam.stream?.getTracks().forEach(t => t.stop()); cam.stream = null;
    $('#camVideo').srcObject = null; $('#scanner').hidden = true;
    renderScan(); save();
  }

  function setStatus(t, kind = '') { const el = $('#scanStatus'); el.textContent = t; el.className = 'scan-status ' + kind; }

  function beep() {
    try { navigator.vibrate?.(90); } catch {}
    try { const a = cam.audio; if (!a) return; const o = a.createOscillator(), g = a.createGain();
      o.frequency.value = 1046; g.gain.value = 0.15; o.connect(g); g.connect(a.destination);
      o.start(); o.stop(a.currentTime + 0.12); } catch {}
  }

  function drawOverlay(corners, color, scale) {
    const cv = $('#camOverlay'), v = $('#camVideo'), dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    if (!corners) return;
    const vw = v.videoWidth, vh = v.videoHeight, k = Math.min(W / vw, H / vh), ox = (W - vw * k) / 2, oy = (H - vh * k) / 2;
    const P = corners.map(([x, y]) => [ox + x / scale * k, oy + y / scale * k]);
    const [tl, tr, bl, br] = P;
    ctx.lineWidth = 4; ctx.strokeStyle = color; ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(...tl); ctx.lineTo(...tr); ctx.lineTo(...br); ctx.lineTo(...bl); ctx.closePath(); ctx.stroke();
    P.forEach(p => { ctx.beginPath(); ctx.arc(p[0], p[1], 9, 0, Math.PI * 2); ctx.fill(); });
  }

  const moved = (a, b, diag) => a && b ? Math.max(...a.map((p, i) => Math.hypot(p[0] - b[i][0], p[1] - b[i][1]))) / diag : 1;

  function tick() {
    if (!cam.running) return;
    const next = () => cam.running && setTimeout(tick, 120);
    const v = $('#camVideo');
    if (cam.busy || !v.videoWidth) { next(); return; }
    const scale = PREVIEW / Math.max(v.videoWidth, v.videoHeight);
    const c = tick.c || (tick.c = document.createElement('canvas'));
    c.width = Math.round(v.videoWidth * scale); c.height = Math.round(v.videoHeight * scale);
    const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(v, 0, 0, c.width, c.height);
    let det = null;
    try { det = OMR.detect(window.cv, ctx.getImageData(0, 0, c.width, c.height)); } catch (e) { console.error(e); }
    const diag = Math.hypot(c.width, c.height);

    if (!det) {
      cam.stable = 0; cam.last = null; drawOverlay(null);
      if (cam.locked && ++cam.clear >= 2) cam.locked = null;
      if (!cam.locked) setStatus('Đưa phiếu vào khung — thấy đủ 4 ô vuông đen');
      next(); return;
    }
    cam.clear = 0;
    if (cam.locked) {
      if (moved(det.corners, cam.locked, diag) > MOVED) cam.locked = null;   // đã đổi phiếu mà không rời khung
      else { drawOverlay(det.corners, '#9aa3b1', scale); setStatus('Lật sang phiếu tiếp theo'); next(); return; }
    }
    if (det.areaFrac < MIN_AREA) {
      cam.stable = 0; cam.last = det.corners; drawOverlay(det.corners, '#E0A100', scale);
      setStatus('Đưa máy lại gần phiếu hơn', 'warn'); next(); return;
    }
    cam.stable = moved(det.corners, cam.last, diag) < STILL ? cam.stable + 1 : 0;
    cam.last = det.corners;
    drawOverlay(det.corners, '#E0A100', scale);
    if (cam.stable < STABLE_FRAMES) { setStatus('Giữ yên máy…', 'warn'); next(); return; }

    // chụp khung hình đầy đủ và chấm
    cam.busy = true; setStatus('Đang chấm…');
    setTimeout(() => {
      try { capture(det, scale); } catch (e) { console.error(e); setStatus('Lỗi khi chấm — thử lại', 'bad'); }
      cam.busy = false; cam.stable = 0; next();
    }, 20);
  }

  function capture(det, scale) {
    const v = $('#camVideo');
    const k = Math.min(1, 2600 / Math.max(v.videoWidth, v.videoHeight));
    const c = document.createElement('canvas'); c.width = Math.round(v.videoWidth * k); c.height = Math.round(v.videoHeight * k);
    const ctx = c.getContext('2d'); ctx.drawImage(v, 0, 0, c.width, c.height);
    const res = OMR.process(window.cv, ctx.getImageData(0, 0, c.width, c.height), TPL);
    if (!res.ok) { setStatus(res.error, res.qualityFail ? 'warn' : 'bad'); return; }
    const sig = res.page + ':' + res.code;
    if (sig === cam.lastSig) { cam.locked = det.corners; setStatus('Phiếu này vừa quét — lật sang phiếu tiếp theo'); return; }
    const msg = record(res, true);
    cam.lastSig = sig; cam.locked = det.corners;
    if (!msg.dup) addQueueLine(msg);
    if (msg.ok) {
      cam.count++; beep(); drawOverlay(det.corners, '#1E7F4F', scale);
      setStatus(msg.short, 'good');
      $('#scanCount').textContent = `Đã quét ${cam.count} phiếu`;
    } else setStatus(msg.short || 'Không ghi được phiếu này', msg.dup ? 'warn' : 'bad');
    if (msg.ok) $('#scanLast').textContent = 'Vừa quét: ' + msg.short.replace('✓ ', '');
    renderRoster(); renderUnknown(); updateBadges(); save();
  }


  // ---------- màn chụp ----------
  function renderScan() { renderRoster(); renderUnknown(); updateBadges(); }
  function renderRoster() {
    const list = students(), pages = pagesOf(S.level);
    $('#roster').innerHTML = list.length ? list.map(s => {
      const sh = S.sheets[s.key] || {};
      const chip = pk => { const x = sh[pk]; if (!x) return `<span>${pageShort(pk)}</span>`;
        const nf = pendingFlags(x);
        return `<button class="${nf ? 's-flag' : 's-done'}" data-del="${s.key}|${pk}" title="Xoá phiếu ${esc(pageName(pk))}">
          ${pageShort(pk)}${nf ? ' · ' + nf : ' ✓'}<i aria-hidden="true">✕</i></button>`; };
      return `<div class="stu"><div class="nm">${esc(s.name)}</div><div class="cd">${esc(s.code)} · ${esc(s.vh)}</div>
        <div class="halves" style="grid-template-columns:repeat(${pages.length},1fr)">${pages.map(chip).join('')}</div></div>`;
    }).join('') : '<div class="empty">Lớp này chưa có học sinh.</div>';
    $('#roster').querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      const [key, page] = b.dataset.del.split('|'); removeRef({ key, page, at: S.sheets[key][page].at });
    });
  }
  function renderUnknown() {
    const box = $('#unknownBox');
    if (!S.unknown.length) { box.innerHTML = ''; return; }
    const opts = students().map(s => `<option value="${s.key}">${esc(s.code)} · ${esc(s.name)}</option>`).join('');
    box.innerHTML = `<div class="notice err">Có ${S.unknown.length} phiếu chưa xác định được học sinh. Xem tên viết tay trên ảnh rồi chọn học sinh.</div>` +
      S.unknown.map(u => `<div class="card"><div class="meta"><span><b>${esc(pageName(u.page))}</b> · mã đọc được: ${esc(u.code)}</span></div>
        <img src="${u.sheet.head}" alt="Phần đầu phiếu">
        <div class="acts"><select data-u="${u.id}"><option value="">Chọn học sinh…</option>${opts}</select>
        <button class="btn small" data-udel="${u.id}">Bỏ phiếu này</button></div></div>`).join('');
    box.querySelectorAll('select[data-u]').forEach(sel => sel.onchange = () => {
      if (!sel.value) return;
      const u = S.unknown.find(x => String(x.id) === sel.dataset.u);
      const r = assign(sel.value, u.page, u.sheet);
      if (r.ok) S.unknown = S.unknown.filter(x => x !== u);
      renderScan(); save();
    });
    box.querySelectorAll('[data-udel]').forEach(b => b.onclick = () => { S.unknown = S.unknown.filter(x => String(x.id) !== b.dataset.udel); renderScan(); save(); });
  }
  function updateBadges() {
    let nf = 0; for (const st of Object.values(S.sheets)) for (const sh of Object.values(st)) nf += pendingFlags(sh);
    $('#bReview').hidden = !nf; $('#bReview').textContent = nf;
    const nw = writeQs().filter(k => !S.writeDone[k] && writeItems(k).length).length;
    $('#bWrite').hidden = !nw; $('#bWrite').textContent = nw;
  }

  // ---------- duyệt ----------
  // ---- Xem lại cả phiếu: ảnh phiếu đã tô màu, chạm vào ô để sửa đáp án trước khi chốt ----
  const rv = { tab: 'flag', stu: '', page: '', geo: null, canvas: null };
  async function renderRvAll() {
    const stus = students().filter(s => Object.keys(S.sheets[s.key] || {}).length);
    const selS = $('#rvStu'), selP = $('#rvPage'), box = $('#rvBox'), info = $('#rvInfo');
    if (!stus.length) { box.innerHTML = '<div class="empty">Chưa có phiếu nào được quét.</div>'; selS.innerHTML = selP.innerHTML = ''; return; }
    if (!stus.some(s => s.key === rv.stu)) rv.stu = stus[0].key;
    selS.innerHTML = stus.map(s => `<option value="${s.key}">${esc(s.name)} (${esc(s.code)})${Object.keys(S.sheets[s.key]).some(pk => Object.values(S.sheets[s.key][pk].over || {}).some(o => o.manual)) ? ' ✎' : ''}</option>`).join('');
    selS.value = rv.stu;
    const pks = pagesOf(S.level).filter(pk => S.sheets[rv.stu]?.[pk] && TPL.pages[pk].skill !== 'speaking');
    if (!pks.includes(rv.page)) rv.page = pks[0] || '';
    selP.innerHTML = pks.map(pk => `<option value="${pk}">${esc(pageName(pk))}</option>`).join(''); selP.value = rv.page;
    const sh = S.sheets[rv.stu]?.[rv.page];
    if (!sh) { box.innerHTML = '<div class="empty">Học sinh này chưa có phiếu Reading / Listening.</div>'; return; }
    const data = sh.pgk && sh.geo ? await idb.get(sh.pgk).catch(() => null) : null;
    if (!data) { box.innerHTML = sh.fromCloud ? '<div class="empty">Phiếu này lấy từ Google Sheet (quét ở máy khác) nên không có ảnh trên máy này. Muốn xem ảnh, quét lại phiếu trên máy này, phiếu mới sẽ thay phiếu cũ.</div>' : '<div class="empty">Phiếu này được quét trước khi app lưu ảnh nên không xem lại được cả phiếu. Xoá phiếu rồi quét lại để xem; các câu tô không chuẩn vẫn duyệt được ở tab bên cạnh.</div>'; rv.geo = null; return; }
    const stu = stuByKey(rv.stu), p = TPL.pages[rv.page].skill;
    const c = drawAnnotated(await loadImg(data), sh, p, { title: `${stu.name}  (${stu.code})  ·  ${S.cls}`, sub: `${S.testTitle}  ·  ${pageName(rv.page)}` });
    c.style.cssText = 'width:100%;height:auto;display:block;border:1px solid var(--line);border-radius:8px;touch-action:manipulation';
    c.onclick = ev => rvTap(ev, c, sh, p);
    box.innerHTML = ''; box.appendChild(c); rv.canvas = c; rv.geo = { sh, p, K: c.width / 210, bh: Math.round((c.width / 210) * 15.5) };
    const edits = Object.values(sh.over || {}).filter(o => o.manual).length;
    info.textContent = edits ? `Đã sửa ${edits} câu trên phiếu này.` : '';
  }
  function rvTap(ev, c, sh, p) {
    const r = c.getBoundingClientRect(), k = c.width / r.width, g = rv.geo;
    const x = (ev.clientX - r.left) * k / g.K, y = ((ev.clientY - r.top) * k - g.bh) / g.K;
    let best = null;
    for (const [q, opts] of Object.entries(sh.geo.m)) for (const [L, ox, oy] of opts) {
      const d = Math.hypot(ox - x, oy - y); if (d <= Math.max(3, sh.geo.rb * 1.7) && (!best || d < best.d)) best = { q, L, d };
    }
    if (!best) return;
    const { q, L } = best, o = sh.over[q], m = sh.mcq[q], key = KEY[p][q];
    const was = o ? o.accept : (m.status === 'ok' ? m.answer : '');
    if (!o && was === L) { $('#rvInfo').textContent = `Câu ${q}: app đã đọc là ${L} rồi, không cần sửa.`; return; }
    if (o && o.manual && o.accept === L) delete sh.over[q];            // chạm lại ô đã sửa = trả về cách đọc của app
    else sh.over[q] = { accept: L, manual: true };
    const now = gradeQ(p, +q, sh);
    $('#rvInfo').textContent = !sh.over[q] ? `Câu ${q}: đã trả về cách đọc của app (${now.chosen || 'bỏ trống'}).`
      : `Câu ${q}: đổi ${was || 'bỏ trống'} → ${L} (đáp án ${key}) → ${L === key ? 'đúng' : 'sai'}. Chạm lại ô ${L} để hoàn tác.`;
    save(); updateBadges();
    const keep = $('#rvInfo').textContent; renderRvAll().then(() => { $('#rvInfo').textContent = keep; });
  }
  function rvReset() {
    const sh = S.sheets[rv.stu]?.[rv.page]; if (!sh) return;
    const n = Object.values(sh.over).filter(o => o.manual).length;
    if (!n || !confirm(`Bỏ ${n} chỗ giáo viên đã sửa trên phiếu này và trả về cách đọc của app?`)) return;
    for (const [q, o] of Object.entries(sh.over)) if (o.manual) delete sh.over[q];
    save(); updateBadges(); renderRvAll();
  }
  function setRvTab(t) {
    rv.tab = t;
    document.querySelectorAll('#rvTabs button').forEach(b => b.classList.toggle('primary', b.dataset.t === t));
    renderReview();
  }
  function renderReview() {
    $('#rvAll').hidden = rv.tab !== 'all'; $('#reviewList').hidden = rv.tab === 'all'; $('#rvHint').hidden = rv.tab === 'all';
    if (rv.tab === 'all') { renderRvAll(); return; }
    const items = [];
    for (const s of students()) for (const pk of pagesOf(S.level)) {
      const sh = S.sheets[s.key]?.[pk]; if (!sh) continue;
      const paper = TPL.pages[pk].skill;
      for (const [q, m] of Object.entries(sh.mcq)) if (isFlag(m)) items.push({ s, pk, paper, q, m, sh });
    }
    if (!items.length) { $('#reviewList').innerHTML = '<div class="empty">Không có câu nào cần duyệt.</div>'; return; }
    items.sort((a, b) => !!a.sh.over[a.q] - !!b.sh.over[b.q]);
    $('#reviewList').innerHTML = items.map((it, i) => {
      const o = it.sh.over[it.q], k = KEY[it.paper][it.q];
      const why = it.m.status === 'multi' ? `Tô ${it.m.answer.length} ô (${it.m.answer.split('').join(', ')})` : it.m.status === 'faint' ? `Có nét tô rất mờ ở ô ${it.m.answer} — app chưa chắc học sinh đã chọn` : `Tô không chuẩn ở ô ${it.m.answer}`;
      const state = !o ? '<span class="pill flag">Chưa duyệt — đang tính sai</span>'
        : o.accept ? `<span class="pill ${o.accept === k ? 'ok' : 'bad'}">Đã chấp nhận ${o.accept} → ${o.accept === k ? 'đúng' : 'sai'}</span>`
        : '<span class="pill bad">Giữ sai</span>';
      const acc = it.m.answer.split('').map(l => `<button class="btn small" data-i="${i}" data-a="${l}">Chấp nhận ${l}</button>`).join('');
      return `<div class="card ${o ? 'done' : ''}"><div class="meta"><span><b>${esc(it.s.name)}</b> · ${PAPER_SHORT[it.paper] === 'R' ? 'Reading' : 'Listening'} câu ${it.q} · đáp án ${k}</span>
        <span class="why">${why}</span></div>${it.m.img ? `<img src="${it.m.img}" alt="Ảnh câu ${it.q}">` : '<div class="hint">Ảnh chỉ có ở máy đã quét phiếu.</div>'}
        <div class="acts">${state}<button class="btn small" data-i="${i}" data-a="">${it.m.status === 'faint' ? 'Coi là bỏ trống (sai)' : 'Giữ sai'}</button>${acc}</div></div>`;
    }).join('');
    $('#reviewList').querySelectorAll('[data-i]').forEach(b => b.onclick = () => {
      const it = items[+b.dataset.i]; it.sh.over[it.q] = { accept: b.dataset.a || null };
      save(); updateBadges(); renderReview();
    });
  }

  // ---------- câu viết (chấm theo cột) ----------
  function writeQs() {
    const out = [];
    for (const p of PAPERS) for (const [q, v] of Object.entries(KEY[p] || {})) if (Array.isArray(v)) out.push(`${p}-${q}`);
    return out.sort((a, b) => a.split('-')[0].localeCompare(b.split('-')[0]) || a.split('-')[1] - b.split('-')[1]);
  }
  function writeItems(k) {
    const [p, q] = k.split('-'), pk = QMAP[S.level][p][q]?.page;
    return students().filter(s => S.sheets[s.key]?.[pk]?.write[q]).map(s => ({ s, w: S.sheets[s.key][pk].write[q] }));
  }
  // lý do câu điền sai (giáo viên duyệt; mặc định: ô trống → "Bỏ trống")
  const WRITE_REASONS = ['Sai chính tả', 'Sai dạng từ', 'Sai thông tin', 'Thiếu từ', 'Thừa từ', 'Sai số / giờ', 'Bỏ trống', 'Chữ khó đọc, cần xem lại'];
  const effReason = w => w.reason || (w.blank ? 'Bỏ trống' : '');
  const partialQ = (p, q) => { const sec = secOfQ(S.level, p, q); return sec && isPartial(sec, QMAP[S.level][p][q].part); };
  // điểm của một câu viết: câu thường = đúng/sai; câu chấm từng phần (FCE Part 4) = 0/1/2
  function writeMarks(p, q, w) {
    const sec = secOfQ(S.level, p, q), part = QMAP[S.level][p][q].part, full = weightOf(sec, part);
    if (isPartial(sec, part)) return typeof w.verdict === 'number' ? w.verdict : (w.blank ? 0 : full);
    return (w.verdict ?? !w.blank) ? full : 0;
  }
  function renderWrite() {
    const qs = writeQs();
    if (!qs.length) { $('#wChips').innerHTML = ''; $('#wBody').innerHTML = '<div class="empty">Đề này không có câu viết.</div>'; return; }
    if (!curWrite || !qs.includes(curWrite)) curWrite = qs.find(k => !S.writeDone[k] && writeItems(k).length) || qs[0];
    $('#wChips').innerHTML = qs.map(k => { const [p, q] = k.split('-');
      return `<button data-k="${k}" class="${k === curWrite ? 'cur' : ''} ${S.writeDone[k] ? 'fin' : ''}">${PAPER_SHORT[p]}${q}</button>`; }).join('');
    $('#wChips').querySelectorAll('button').forEach(b => b.onclick = () => { curWrite = b.dataset.k; renderWrite(); });
    const [p, q] = curWrite.split('-'), items = writeItems(curWrite), part = partialQ(p, q);
    if (!items.length) { $('#wBody').innerHTML = `<div class="empty">Chưa có phiếu chứa câu này.</div>`; return; }
    const label = (w) => { const m = writeMarks(p, q, w); return part ? `${m} điểm` : (m ? 'Đúng' : 'Sai'); };
    const cls = (w) => { const m = writeMarks(p, q, w); return part ? (m === 2 ? '' : m === 1 ? 'mid' : 'no') : (m ? '' : 'no'); };
    $('#wBody').innerHTML = `<div class="keyline">${p === 'reading' ? 'Reading' : 'Listening'} câu ${q} — đáp án: <b>${KEY[p][q].map(esc).join(' / ')}</b>
        ${part ? '<br><small>Câu chấm 0 / 1 / 2 điểm — chạm để đổi: 2 → 1 → 0</small>' : ''}</div>
      <div class="wgrid">${items.map((it, i) => { const wrong = writeMarks(p, q, it.w) < weightOf(secOfQ(S.level, p, q), QMAP[S.level][p][q].part);
        return `<div class="wcell ${cls(it.w)}"><button type="button" class="wtog" data-i="${i}">
        <div class="who"><span>${esc(it.s.name)}</span><span>${label(it.w)}${it.w.blank ? ' · bỏ trống' : ''}</span></div>
        ${it.w.img ? `<img src="${it.w.img}" alt="Câu trả lời của ${esc(it.s.name)}">` : '<span class="hint">Ảnh chỉ có ở máy đã quét phiếu.</span>'}</button>
        ${wrong ? `<select class="wreason" data-i="${i}" aria-label="Lý do sai"><option value="">Lý do: điền chưa đúng</option>${WRITE_REASONS.map(r => `<option${effReason(it.w) === r ? ' selected' : ''}>${r}</option>`).join('')}</select>` : ''}</div>`; }).join('')}</div>
      <div class="row" style="margin-top:14px"><button class="btn primary" id="wDone">${S.writeDone[curWrite] ? 'Đã xong ✓ — sang câu tiếp' : 'Xong câu này'}</button></div>`;
    $('#wBody').querySelectorAll('.wtog').forEach(b => b.onclick = () => {
      const w = items[+b.dataset.i].w, m = writeMarks(p, q, w);
      w.verdict = part ? (m === 2 ? 1 : m === 1 ? 0 : 2) : !m;
      save(); renderWrite();
    });
    $('#wBody').querySelectorAll('.wreason').forEach(sel => sel.onchange = () => { items[+sel.dataset.i].w.reason = sel.value; save(); });
    $('#wDone').onclick = () => {
      S.writeDone[curWrite] = true; save(); updateBadges();
      const next = qs.find(k => !S.writeDone[k] && writeItems(k).length); if (next) curWrite = next; renderWrite();
    };
  }

  // ---------- chấm điểm ----------
  function toScale(sec, raw) {
    if (sec.bang) return sec.bang[Math.max(0, Math.min(Math.round(raw), sec.bang.length - 1))];
    const a = [...sec.moc].sort((x, y) => y[0] - x[0]);
    if (raw >= a[0][0]) return a[0][1];
    for (let i = 0; i < a.length - 1; i++) if (raw <= a[i][0] && raw >= a[i + 1][0])
      return Math.round(a[i + 1][1] + (raw - a[i + 1][0]) * (a[i][1] - a[i + 1][1]) / (a[i][0] - a[i + 1][0]));
    return null;
  }
  const cefrOf = sc => { const L = lvl(); if (sc == null) return L.duoiThang; for (const [m, l] of L.cefr) if (sc >= m) return l; return L.duoiThang; };
  const scaleText = sc => sc == null ? 'Dưới 120' : sc;
  // chấm một câu của một phiếu
  function gradeQ(p, q, sh) {
    const info = QMAP[S.level][p][q], sec = secOfQ(S.level, p, q), w8 = weightOf(sec, info.part), k = KEY[p][q];
    if (info.type === 'write') {
      const w = sh.write[q], marks = writeMarks(p, q, w);
      return { q, part: info.part, type: 'write', shown: w.blank ? '' : `${marks}/${w8}`, chosen: '', marks, maxMarks: w8, ok: marks === w8, flag: false, bad: false, reason: marks < w8 ? effReason(w) : '' };
    }
    const m = sh.mcq[q], o = sh.over[q], bad = isFlag(m);
    const chosen = o ? (o.accept || '') : (m.status === 'ok' ? m.answer : '');
    const ok = chosen === k;
    return { q, part: info.part, type: 'mcq', shown: bad && !o?.accept ? m.answer + '*' : chosen, chosen, marks: ok ? w8 : 0, maxMarks: w8, ok, flag: bad && !o, bad };
  }
  // một câu từ bài làm trên máy: điểm lấy từ cột POINTS của sheet (nền tảng đã chấm), không chấm lại
  function onlineItem(p, q, rec) {
    const row = rec.items.find(x => x[0] === q); if (!row) return null;
    const info = QMAP[S.level][p][q], sec = secOfQ(S.level, p, q), w8 = weightOf(sec, info.part);
    const given = row[2], earned = Math.max(0, Math.min(row[4], w8)), wr = info.type === 'write';
    return { q, part: info.part, type: wr ? 'write' : 'mcq', shown: wr ? (given === '' ? '' : `${earned}/${w8}`) : given, chosen: wr ? '' : given, given, key: row[3], marks: earned, maxMarks: w8, ok: earned >= w8, flag: false, bad: false };
  }
  function results() {
    const L = lvl();
    return students().map((s, i) => {
      const st = S.sheets[s.key] || {}, r = { stt: i + 1, s, secs: {}, items: { reading: [], listening: [] }, nonstd: 0, any: !!Object.keys(st).length };
      for (const p of PAPERS) {
        const qs = Object.keys(QMAP[S.level][p]).map(Number).sort((a, b) => a - b);
        for (const q of qs) { const sh = st[QMAP[S.level][p][q].page]; r.items[p].push(sh ? gradeQ(p, q, sh) : null); }
      }
      const on = (S.online || {})[s.key];
      if (on) {
        r.any = true; r.violations = on.violations || 0;
        for (const p of PAPERS) if (on[p]) r.items[p] = Object.keys(QMAP[S.level][p]).map(Number).sort((a, b) => a - b).map(q => onlineItem(p, q, on[p]));
      }
      for (const sec of L.phan) {
        const qs = secQs(S.level, sec), its = qs.map(q => r.items[sec.giay].find(x => x && x.q === q) || null);
        if (its.every(x => !x)) { r.secs[sec.id] = null; continue; }
        if (its.some(x => !x)) {
          const miss = [...new Set(qs.filter((q, j) => !its[j]).map(q => QMAP[S.level][sec.giay][q].page))];
          r.secs[sec.id] = { incomplete: true, missing: miss }; continue;
        }
        const parts = Object.fromEntries(sec.parts.map(p => [p, 0])); let raw = 0;
        for (const it of its) { raw += it.marks; parts[it.part] += it.marks; }
        const scale = toScale(sec, raw);
        r.secs[sec.id] = { raw, max: secMax(S.level, sec), scale, cefr: cefrOf(scale), parts, items: its };
      }
      r.nonstd = PAPERS.flatMap(p => r.items[p]).filter(x => x && x.bad).length;
      if (!r.any && (writingOf(s) || spokenOk(s))) r.any = true;   // chỉ có Writing hoặc Speaking (nhập JSON / nhập tay) vẫn là có dữ liệu
      return r;
    });
  }


  // ---------- Writing (JSON từ skill chấm Writing; kiểm tra bằng viet/kiem-tra-json.js) ----------
  const WR_COLS = ['Writing điểm thô', 'Writing tối đa', 'Writing thang'];
  const writingOf = s => (S.writing || {})[s.key]?.data || null;
  const hasWriting = () => Object.keys(S.writing || {}).length > 0;
  const SP_COLS = ['Speaking điểm thô', 'Speaking tối đa', 'Speaking thang'];
  const spColsOf = () => isDaily() ? ['Speaking điểm thô', 'Speaking tối đa', 'Speaking %'] : SP_COLS;   // bài hàng ngày: % thay cho thang
  const hasSpeaking = () => Object.keys(S.speaking || {}).length > 0;
  function spVals(r) { const d = (S.speaking || {})[r.s.key], t = d ? window.SpeakingScore.total(S.level, d.bands) : null;
    if (t == null) return ['', '', ''];
    const mx = window.SpeakingScore.MAX[S.level];
    return [t, mx, isDaily() ? pctTxt(t, mx) : (window.SpeakingScore.scale(S.level, t) ?? '')]; }
  function spCells(r) { const v = spVals(r); return v[0] === '' ? '<td>—</td><td>—</td>' : `<td class="num">${v[0]}/${v[1]}</td><td class="num">${v[2]}</td>`; }
  const wrScaleText = d => d.total.cambridge_scale == null ? '—' : d.total.cambridge_scale + (d.total.is_estimate ? ' (ước lượng)' : '');
  function wrVals(r) { const d = writingOf(r.s); return d ? [d.total.raw, d.total.raw_max, d.total.cambridge_scale ?? ''] : ['', '', '']; }
  function wrCells(r) { const d = writingOf(r.s); return d ? `<td class="num">${d.total.raw}/${d.total.raw_max}</td><td class="num">${esc(wrScaleText(d))}</td>` : '<td>—</td><td>—</td>'; }

  let wrChecker = null, wrPending = null;
  function wrLoadChecker() {
    if (wrChecker) return wrChecker;
    wrChecker = fetch('viet/schema-writing.json').then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(s => window.WritingJsonCheck.taoBoKiemTra(s, window.Ajv2020));
    wrChecker.catch(() => { wrChecker = null; });
    return wrChecker;
  }
  const wrNorm = x => String(x ?? '').trim().toLowerCase();
  function wrFindStudent(id) {
    const a = wrNorm(id); if (!a) return null;
    const k = keyOf(id);
    return students().find(s => wrNorm(s.code) === a || (k.length === 6 && s.key === k)) || null;
  }
  const wrBox = (cls, html) => `<div class="notice ${cls}">${html}</div>`;
  function wrStore(stu, data) {
    if (S.writing[stu.key] && !confirm(`${stu.name} đã có bài Writing. Ghi đè bằng file mới?`)) return false;
    S.writing[stu.key] = { data, at: Date.now() }; save(); return true;
  }
  // xử lý một JSON: trả về { html, ok, pending }
  async function wrProcess(text, label, allowPick) {
    let chk; try { chk = await wrLoadChecker(); }
    catch (e) { return { ok: false, html: wrBox('err', `Không tải được viet/schema-writing.json (${esc(e.message)}). Mở app qua địa chỉ web, không mở trực tiếp file từ máy.`) }; }
    const r = chk.kiemTra(text), pre = label ? `<b>${esc(label)}</b>: ` : '';
    if (!r.ok) return { ok: false, html: wrBox('err', pre + 'JSON chưa đúng form:<ul>' + r.loi.map(m => `<li>${esc(m)}</li>`).join('') + '</ul>') };
    const d = r.data;
    if (d.level !== S.level) return { ok: false, html: wrBox('err', `${pre}JSON là bài ${esc(d.level)}, nhưng lớp này chấm ${esc(S.level)}.`) };
    const warn = r.canhBao.length ? '<br>Cảnh báo số liệu: ' + r.canhBao.map(esc).join(' ') : '';
    // mã đề trong JSON (nếu có) chỉ để tham khảo: đề Writing / Speaking không nằm trong de-thi nên không cần khớp với đề đang chấm
    const stu = wrFindStudent(d.student && d.student.id);
    if (!stu) {
      if (!allowPick) return { ok: false, html: wrBox('warn', `${pre}không tìm thấy học sinh có mã "${esc(d.student.id)}" trong lớp. Hãy dán riêng file này để chọn học sinh.`) };
      wrPending = { data: d, warn };
      return { ok: false, pending: true, html: wrBox('warn', `Không tìm thấy học sinh có mã "<b>${esc(d.student.id)}</b>" (${esc(d.student.name || '')}) trong lớp này. Chọn học sinh để ghép:`
        + `<div class="row" style="margin-top:8px"><select id="wrPick">${students().map(s => `<option value="${esc(s.key)}">${esc(s.code)} - ${esc(s.name)}</option>`).join('')}</select>`
        + `<button class="btn small primary" id="wrPickOk">Ghép và lưu</button></div>`) };
    }
    if (!wrStore(stu, d)) return { ok: false, html: wrBox('warn', pre + 'Không ghi đè.') };
    return { ok: true, html: wrBox('info', `${pre}đã lưu cho <b>${esc(stu.name)}</b> (${esc(stu.code)}): ${d.total.raw}/${d.total.raw_max}, thang ${esc(wrScaleText(d))}.${warn}`) };
  }
  async function wrRun(items, allowPick) {
    const out = []; let okAny = false;
    for (const it of items) { const r = await wrProcess(it.text, it.label, allowPick); out.push(r.html); okAny = okAny || r.ok; if (r.pending) break; }
    $('#wrMsg').innerHTML = out.join('');
    const b = $('#wrPickOk');
    if (b) b.onclick = () => {
      const stu = stuByKey($('#wrPick').value);
      if (stu && wrPending && wrStore(stu, wrPending.data)) {
        $('#wrMsg').innerHTML = wrBox('info', `Đã lưu cho <b>${esc(stu.name)}</b> (${esc(stu.code)}).${wrPending.warn}`); wrPending = null; $('#wrText').value = ''; renderWritingTable();
      }
    };
    if (okAny) { $('#wrText').value = ''; renderWritingTable(); }
  }
  function renderWritingTable() {
    const rows = students().map((s, i) => { const d = writingOf(s);
      return `<tr class="${d ? '' : 'missing'}"><td class="num">${i + 1}</td><td>${esc(s.code)}</td><td>${esc(s.name)}</td>
        <td>${d ? `${esc(d.level)} · ${d.parts.length} Part` : 'Chưa có'}</td><td class="num">${d ? d.total.raw + '/' + d.total.raw_max : '—'}</td>
        <td class="num">${d ? esc(wrScaleText(d)) : '—'}</td><td>${d ? `<button class="btn small" data-wdel="${esc(s.key)}">Xoá</button>` : ''}</td></tr>`; });
    $('#wrTable').innerHTML = '<thead><tr><th>STT</th><th>Mã</th><th>Họ tên</th><th>Bài Writing</th><th>Điểm thô</th><th>Thang</th><th></th></tr></thead><tbody>' + rows.join('') + '</tbody>';
    $('#wrTable').querySelectorAll('[data-wdel]').forEach(b => b.onclick = () => {
      const s = stuByKey(b.dataset.wdel); if (s && confirm(`Xoá bài Writing của ${s.name}?`)) { delete S.writing[s.key]; tomb(s.key, 'writing'); save(); renderWritingTable(); }
    });
  }
  function renderWriting() {
    S.writing = S.writing || {}; wrPending = null; $('#wrMsg').innerHTML = '';
    wrLoadChecker().catch(() => {});
    $('#wrSave').onclick = () => wrRun([{ text: $('#wrText').value, label: '' }], true);
    $('#wrClear').onclick = () => { $('#wrText').value = ''; $('#wrMsg').innerHTML = ''; wrPending = null; };
    $('#wrFile').onchange = async function () {
      const files = [...this.files]; this.value = ''; if (!files.length) return;
      const items = []; for (const f of files) items.push({ text: await f.text(), label: f.name });
      if (items.length === 1) $('#wrText').value = items[0].text;
      wrRun(items, items.length === 1);
    };
    renderWritingTable();
  }

  // ---------- Speaking (band, mã chẩn đoán, part yếu nhất; viet/speaking-nhap.js) ----------
  function renderSpeaking() {
    S.speaking = S.speaking || {};
    const root = $('#spBox');
    window.SpeakingEntry.mount({ root, level: S.level, students: students(), data: S.speaking,
      onSave: (key, v) => { if (v) S.speaking[key] = v; else { delete S.speaking[key]; tomb(key, 'speaking'); } save(); } });
    // nút Nhập / Sửa mở phiếu tick trên màn hình (cách cũ bằng danh sách chọn vẫn dùng được trong phiếu: "Nhập bằng danh sách chọn")
    if (!root.__tick) {
      root.__tick = true;
      root.addEventListener('click', e => {
        const b = e.target.closest('[data-sp]'); if (!b || root.__old) return;
        e.stopPropagation(); e.preventDefault(); openSpeakingSheet(b.dataset.sp);
      }, true);
    }
  }

  // ---------- Speaking: phiếu tick trên màn hình (giống phiếu chấm in, chạm để tick; kết quả giống hệt khi quét phiếu) ----------
  const SP_CRIT = { GV: 'Grammar & Vocabulary', DM: 'Discourse Management', P: 'Pronunciation', IC: 'Interactive Communication', GA: 'Global Achievement' };
  function spInjectCss() {
    if (document.getElementById('spkCss')) return;
    const st = document.createElement('style'); st.id = 'spkCss';
    st.textContent = `.spk{position:fixed;inset:0;z-index:70;background:#F4F6FA;overflow:auto;-webkit-overflow-scrolling:touch}
.spk-top{position:sticky;top:0;z-index:2;background:#9E1B32;color:#fff;padding:12px 16px;display:flex;align-items:center;gap:10px}
.spk-top b{font-size:16px}.spk-top small{opacity:.85}.spk-top .x{margin-left:auto;background:rgba(255,255,255,.18);color:#fff;border:0;border-radius:8px;padding:8px 12px;font:inherit;font-weight:600}
.spk-body{max-width:760px;margin:0 auto;padding:12px 12px 130px}
.spk-sec{background:#fff;border:1px solid #D5DAE3;border-radius:12px;padding:0 12px 10px;margin:0 0 12px}
.spk-sec legend{float:left;width:calc(100% + 24px);margin:0 -12px 8px;padding:9px 12px;background:#E3E6EC;border-radius:11px 11px 0 0;font-weight:700;font-size:14px;letter-spacing:.2px;text-transform:uppercase}
.spk-sec legend i{font-style:normal;font-weight:600;opacity:.7;text-transform:none;margin-left:6px}
.spk-row{clear:both;padding:8px 0;border-top:1px solid #EEF0F4}.spk-row:first-of-type{border-top:0}
.spk-lab{display:block;font-size:13px;font-weight:700;margin-bottom:6px}.spk-lab em{font-style:normal;font-weight:500;color:#6B7487;margin-left:6px;font-size:12px}
.spk-opts{display:flex;flex-wrap:wrap;gap:8px}
.spk-o{display:inline-flex;align-items:center;gap:8px;min-height:42px;padding:6px 12px 6px 8px;border:1.5px solid #C7CDD8;border-radius:22px;background:#fff;font:inherit;font-size:14px;color:#1B2437;cursor:pointer}
.spk-o i{flex:none;width:22px;height:22px;border-radius:50%;border:2px solid #4A5468;background:#fff}
.spk-o[aria-pressed=true]{border-color:#9E1B32;background:#FBEFF1;font-weight:600}.spk-o[aria-pressed=true] i{background:#9E1B32;border-color:#9E1B32;box-shadow:inset 0 0 0 3px #fff}
.spk-band .spk-o{padding:6px 14px 6px 8px;font-weight:700}
.spk-foot{position:fixed;left:0;right:0;bottom:0;background:#fff;border-top:1px solid #D5DAE3;padding:10px 14px calc(10px + env(safe-area-inset-bottom));z-index:3}
.spk-sum{max-width:760px;margin:0 auto 8px;font-size:13px;color:#4A5468}.spk-sum b{color:#1B2437}.spk-sum .miss{color:#B42318;font-weight:700}
.spk-acts{max-width:760px;margin:0 auto;display:flex;gap:8px;flex-wrap:wrap}.spk-acts .btn.primary{flex:1;min-width:140px}
.spk-old{max-width:760px;margin:6px auto 0;font-size:12.5px;text-align:center}.spk-old a{color:#6B7487;text-decoration:underline;cursor:pointer}`;
    document.head.appendChild(st);
  }
  function spLayout() {
    const T = TPL.pages[S.level + '-speaking'], secs = []; let cur = null, weak = null;
    for (const q of T.questions) {
      if (/^BAND-/.test(q.code)) { cur = { crit: q.code.slice(5), band: q, rows: [] }; secs.push(cur); }
      else if (q.code === 'Notably weak part') weak = q;
      else if (cur) cur.rows.push(q);
    }
    return { T, secs, weak };
  }
  function openSpeakingSheet(key) {
    const stu = stuByKey(key); if (!stu) return;
    spInjectCss();
    const { secs, weak } = spLayout(), B = (window.SPEAKING_BANK || {})[S.level] || {}, W = window.SpeakingScore.WEIGHT[S.level], MAX = window.SpeakingScore.MAX[S.level];
    const old = (S.speaking || {})[key], tick = {};
    const set = (q, l) => { (tick[q] = tick[q] || new Set()).add(l); };
    if (old) {   // điền sẵn từ kết quả đã có (quét phiếu hoặc nhập trước đó)
      secs.forEach(sec => {
        if (old.bands && old.bands[sec.crit]) set(sec.band.q, String(old.bands[sec.crit]));
        sec.rows.forEach(q => {
          const saved = old.rows && old.rows[q.code];
          if (saved) saved.forEach(l => set(q.q, l));
          else if (!old.rows && old.evidence) q.options.forEach(o => { const k = window.SpeakingScan.match(B, q.code, o.label); if (k && old.evidence.includes(k)) set(q.q, o.label); });
        });
      });
      if (old.weakPart && weak) set(weak.q, old.weakPart);
    }
    const ov = document.createElement('div'); ov.className = 'spk'; ov.setAttribute('role', 'dialog');
    const optBtn = (q, o, multi) => `<button type="button" class="spk-o" data-q="${q.q}" data-l="${esc(o.label)}" data-m="${multi ? 1 : 0}" aria-pressed="false"><i></i>${esc(o.label)}</button>`;
    ov.innerHTML = `<div class="spk-top"><b>${esc(stu.name)}</b><small>${esc(stu.code)} · Speaking ${S.level}</small><button class="x" data-x>Đóng</button></div><div class="spk-body">
      <p class="hint" style="margin:2px 2px 10px">Chạm vào ô để tick, giống phiếu chấm in. Mỗi tiêu chí chọn <b>một band</b>. Dòng có dấu ✱ được tick nhiều ô. Chạm lần nữa để bỏ tick.</p>
      ${secs.map(sec => `<fieldset class="spk-sec"><legend>${esc(SP_CRIT[sec.crit] || sec.crit)}<i>band × ${W[sec.crit] || 1}</i></legend>
        <div class="spk-row spk-band"><span class="spk-lab">BAND</span><div class="spk-opts">${sec.band.options.map(o => optBtn(sec.band, o, false)).join('')}</div></div>
        ${sec.rows.map(q => `<div class="spk-row"><span class="spk-lab">${esc(q.row || q.code)}${q.multi ? '<em>✱ tick nhiều ô</em>' : ''}</span><div class="spk-opts">${q.options.map(o => optBtn(q, o, q.multi)).join('')}</div></div>`).join('')}
      </fieldset>`).join('')}
      ${weak ? `<fieldset class="spk-sec"><legend>Notably weak part</legend><div class="spk-row"><div class="spk-opts">${weak.options.map(o => optBtn(weak, o, true)).join('')}</div></div></fieldset>` : ''}
      </div><div class="spk-foot"><div class="spk-sum" id="spkSum"></div><div class="spk-acts"><button class="btn primary" data-save>Lưu Speaking</button><button class="btn" data-clear>Xoá hết tick</button><button class="btn ghost" data-x>Huỷ</button></div>
      <div class="spk-old"><a data-old>Nhập bằng danh sách chọn (cách cũ)</a></div></div>`;
    document.body.appendChild(ov); document.body.style.overflow = 'hidden';
    const bandsNow = () => { const b = {}; secs.forEach(sec => { const s = tick[sec.band.q]; if (s && s.size === 1) b[sec.crit] = +[...s][0]; }); return b; };
    const paint = () => {
      ov.querySelectorAll('.spk-o').forEach(b => b.setAttribute('aria-pressed', tick[b.dataset.q] && tick[b.dataset.q].has(b.dataset.l) ? 'true' : 'false'));
      const b = bandsNow(), miss = Object.keys(W).filter(c => !b[c]), tot = miss.length ? null : window.SpeakingScore.total(S.level, b);
      $('#spkSum').innerHTML = Object.keys(W).map(c => `${c} <b>${b[c] || '–'}</b>`).join(' · ') + (miss.length ? ` · <span class="miss">còn thiếu band ${miss.join(', ')}</span>` : ` · điểm <b>${tot}/${MAX}</b>`);
    };
    const close = () => { ov.remove(); document.body.style.overflow = ''; };
    ov.addEventListener('click', e => {
      const o = e.target.closest('.spk-o');
      if (o) {
        const q = o.dataset.q, l = o.dataset.l, multi = o.dataset.m === '1', s = tick[q] = tick[q] || new Set();
        if (s.has(l)) s.delete(l);
        else {
          if (!multi) s.clear();
          if (multi && /^(none)$/i.test(l)) s.clear();                       // "none" loại trừ các Part
          if (multi && /^P\d$/.test(l)) s.delete('none');
          s.add(l);
        }
        paint(); return;
      }
      if (e.target.closest('[data-x]')) { close(); return; }
      if (e.target.closest('[data-clear]')) { if (confirm('Xoá hết tick của phiếu này?')) { Object.keys(tick).forEach(k => delete tick[k]); paint(); } return; }
      if (e.target.closest('[data-old]')) { close(); const root = $('#spBox'), btn = root.querySelector(`[data-sp="${key}"]`); if (btn) { root.__old = true; btn.click(); root.__old = false; } return; }
      if (e.target.closest('[data-save]')) {
        const res = { page: S.level + '-speaking', mcq: {} };
        TPL.pages[res.page].questions.forEach(q => { res.mcq[q.q] = { opts: q.options.map(op => ({ label: op.label, cov: tick[q.q] && tick[q.q].has(op.label) ? 1 : 0 })) }; });
        const d = window.SpeakingScan.fromResult(S.level, res, TPL), miss = Object.keys(W).filter(c => !d.bands[c]);
        if (!Object.keys(d.bands).length && !d.evidence.length && !d.weakPart) { alert('Chưa tick gì. Hãy tick ít nhất band của các tiêu chí.'); return; }
        if (miss.length && !confirm(`Còn thiếu band: ${miss.join(', ')}. Vẫn lưu (chưa tính được điểm Speaking)?`)) return;
        S.speaking = S.speaking || {};
        S.speaking[key] = { bands: d.bands, evidence: d.evidence, weakPart: d.weakPart, rows: d.rows || {}, at: Date.now(), scan: false, tick: true, flags: d.flags.map(f => f.text) };
        save(); close(); renderSpeaking();
        const note = document.createElement('div'); note.className = 'notice info'; note.innerHTML = `Đã lưu Speaking cho <b>${esc(stu.name)}</b>.`;
        $('#spBox').prepend(note); setTimeout(() => note.remove(), 4000);
      }
    });
    paint(); ov.scrollTop = 0;
  }

  // ---------- Speaking: nhập bằng JSON (cùng cách với Writing); quét phiếu hoặc nhập tay vẫn dùng được ----------
  // Một JSON = một học sinh. Cũng nhận mảng [ {...}, {...} ] hoặc { "students": [ ... ] }. Quy tắc: viet/HOP-DONG-JSON-SPEAKING.md
  function spJsonCheck(d) {
    const errs = [], warns = [], bank = (window.SPEAKING_BANK || {})[S.level] || {}, W = (window.SpeakingScore || {}).WEIGHT?.[S.level] || {};
    if (!d || typeof d !== 'object' || Array.isArray(d)) return { errs: ['mỗi mục phải là một đối tượng JSON { ... }'] };
    if (d.level && String(d.level).toUpperCase() !== S.level) errs.push(`JSON này là cấp độ ${esc(d.level)}, lớp đang chấm là ${S.level}`);
    const sid = typeof d.student === 'object' && d.student ? d.student.id : d.student;
    const stu = wrFindStudent(sid);
    if (!sid) errs.push('thiếu mã học sinh (student.id)'); else if (!stu) errs.push(`mã học sinh "${esc(sid)}" không có trong lớp ${esc(S.cls)}`);
    const bands = {}, b = d.bands || {};
    for (const c of Object.keys(W)) { const v = Number(b[c]); if (!Number.isInteger(v) || v < 1 || v > 5) errs.push(`band ${c} phải là số nguyên từ 1 đến 5 (đang là ${esc(b[c] ?? 'trống')})`); else bands[c] = v; }
    Object.keys(b).filter(c => !(c in W)).forEach(c => warns.push(`band "${esc(c)}" không thuộc ${S.level}, bỏ qua`));
    const ev = [], evIn = Array.isArray(d.evidence) ? d.evidence : (d.evidence == null ? [] : null);
    if (evIn === null) errs.push('evidence phải là danh sách (mảng) các mã chẩn đoán');
    else evIn.forEach(k => { const key = String(k).replace(/\s*[•·]\s*/, ' • ').trim(); if (bank[key] && !/^Weak part/.test(key)) { if (!ev.includes(key)) ev.push(key); } else warns.push(`mã chẩn đoán "${esc(k)}" không có trong bộ nhận xét ${S.level}, bỏ qua`); });
    const parts = Object.keys(bank).filter(k => /^Weak part/.test(k)).map(k => k.split(' • ')[1]);
    let wp = d.weak_part == null ? '' : String(d.weak_part).trim().toUpperCase();
    if (/^(NONE|-|)$/.test(wp)) wp = ''; else if (!parts.includes(wp)) { warns.push(`weak_part "${esc(d.weak_part)}" không hợp lệ (${parts.join(', ')}), bỏ qua`); wp = ''; }
    let rows = {};
    if (d.rows != null) {   // tuỳ chọn: { "G-R": ["articles"], "IC": ["I initiate", "R respond"] } (khoá = mã dòng trên phiếu, giá trị = các nhãn đã tô)
      if (typeof d.rows !== 'object' || Array.isArray(d.rows)) warns.push('rows phải là đối tượng { "mã dòng": ["nhãn", …] }, bỏ qua');
      else Object.entries(d.rows).forEach(([k, v]) => { const a = Array.isArray(v) ? v : (v == null || v === '' ? [] : [v]); rows[k] = a.map(x => String(x).trim()).filter(Boolean); });
    }
    return { errs, warns, stu, value: { bands, evidence: ev, weakPart: wp, rows, at: Date.now(), json: true, flags: [] } };
  }
  function spJsonRun(text, label) {
    let data; try { data = JSON.parse(String(text).replace(/^\uFEFF/, '')); } catch (e) { return { html: wrBox('err', `${label ? esc(label) + ': ' : ''}không đọc được JSON (${esc(e.message)}). Kiểm tra dấu ngoặc, dấu phẩy và dấu nháy kép.`), ok: 0 }; }
    const list = Array.isArray(data) ? data : Array.isArray(data?.students) ? data.students : [data];
    const out = []; let ok = 0;
    list.forEach((d, i) => {
      const tag = list.length > 1 ? `Mục ${i + 1}: ` : '', r = spJsonCheck(d);
      if (r.errs.length) { out.push(wrBox('err', `${label ? esc(label) + ' · ' : ''}${tag}<b>chưa lưu</b>: ${r.errs.join('; ')}.`)); return; }
      if ((S.speaking || {})[r.stu.key] && !confirm(`${r.stu.name} đã có kết quả Speaking. Ghi đè bằng JSON này?`)) { out.push(wrBox('info', `${tag}Giữ kết quả Speaking cũ của ${esc(r.stu.name)}.`)); return; }
      (S.speaking ||= {})[r.stu.key] = r.value; ok++;
      const tot = window.SpeakingScore.total(S.level, r.value.bands), sc = window.SpeakingScore.scale(S.level, tot);
      out.push(wrBox(r.warns.length ? 'warn' : 'info', `${tag}Đã lưu Speaking cho <b>${esc(r.stu.name)}</b> (${esc(r.stu.code)}): ${tot}/${window.SpeakingScore.MAX[S.level]}${sc != null ? `, thang ${sc}` : ''}.${r.warns.length ? '<br>Lưu ý: ' + r.warns.join('; ') + '.' : ''}`));
    });
    if (ok) { save(); renderSpeaking(); updateBadges(); }
    return { html: out.join(''), ok };
  }
  function bindSpeakingJson() {
    const msg = h => { $('#spJsMsg').innerHTML = h; };
    $('#spJsSave').onclick = () => { const t = $('#spJsText').value.trim(); if (!t) { msg(wrBox('warn', 'Chưa có nội dung. Dán JSON vào khung hoặc tải file lên.')); return; } const r = spJsonRun(t, ''); msg(r.html); if (r.ok) $('#spJsText').value = ''; };
    $('#spJsClear').onclick = () => { $('#spJsText').value = ''; msg(''); };
    $('#spJsFile').onchange = async e => {
      const fs = [...e.target.files]; e.target.value = ''; let html = '', n = 0;
      for (const f of fs) { const r = spJsonRun(await f.text(), fs.length > 1 ? f.name : ''); html += r.html; n += r.ok; }
      msg(html + (fs.length > 1 ? wrBox('info', `Đã xử lý ${fs.length} file, lưu được ${n} học sinh.`) : ''));
    };
  }

  // ---------- bài làm trên máy (FCE) ----------
  async function onlineFromFiles(files) {
    let raw = null, res = [];
    for (const f of files) {
      if (/\.csv$/i.test(f.name)) { const t = await f.text(); raw = window.OnlineImport.parseCSV(t); continue; }
      const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await f.arrayBuffer());
      const tab = n => { const ws = wb.worksheets.find(w => w.name.trim().toLowerCase() === n); if (!ws) return null; const rows = []; ws.eachRow(r => rows.push(r.values.slice(1).map(v => String(v?.text ?? v?.result ?? v ?? '').trim()))); return rows; };
      raw = tab('raw answers') || raw; res = tab('fce results') || res;
    }
    if (!raw) throw new Error('Không thấy tab "Raw Answers" trong file.');
    return { raw, res };
  }
  function applyOnline(sheets) {
    const recs = window.OnlineImport.build(sheets), stu = students(), miss = new Set(); let n = 0;
    S.online = S.online || {};
    for (const r of recs) {
      const k6 = keyOf(r.id), s = stu.find(x => x.code.toUpperCase() === r.id || (k6.length === 6 && x.key === k6));
      if (!s) { miss.add(`${r.id} (${r.name})`); continue; }
      const o = S.online[s.key] = S.online[s.key] || {};
      o[r.skill] = { testId: r.testId, ts: r.ts, items: r.items };
      o.violations = Math.max(o.violations || 0, r.violations || 0); n++;
    }
    save(); return { n, miss: [...miss] };
  }
  function renderOnline() {
    const box = $('#onBox'); S.online = S.online || {};
    if (S.level !== 'FCE') { box.innerHTML = `<div class="empty">Bước này chỉ dùng cho FCE làm trên máy. Lớp hiện tại là ${esc(S.level)}.</div>`; return; }
    box.innerHTML = `<div class="row"><input id="onUrl" style="flex:1;min-width:240px" placeholder="Dán link Google Sheet kết quả" value="${esc(lsGet('omr-online-url', ''))}">
        <button class="btn primary" id="onFetch">Lấy từ Google Sheet</button></div>
      <div class="row" style="margin-top:8px"><label class="btn">Hoặc chọn file .xlsx / .csv<input type="file" id="onFile" accept=".xlsx,.csv" hidden multiple></label></div>
      <div id="onMsg" class="notice info" hidden></div><div id="onTbl"></div>`;
    const msg = (t, bad) => { const m = $('#onMsg'); m.hidden = !t; m.className = 'notice ' + (bad ? 'warn' : 'info'); m.textContent = t || ''; };
    const done = sheets => {
      const { n, miss } = applyOnline(sheets);
      msg(`Đã nhập ${n} bài làm.` + (miss.length ? ` Không khớp học sinh trong lớp: ${miss.join(', ')}.` : ''), miss.length && !n);
      table();
    };
    $('#onFetch').onclick = async () => {
      const u = $('#onUrl').value.trim(); if (!u) return msg('Hãy dán link Google Sheet.', true);
      lsSet('omr-online-url', u); msg('Đang lấy dữ liệu...');
      try { done(await window.OnlineImport.fetchSheet(u)); }
      catch (e) { msg('Không đọc được Google Sheet (' + e.message + '). Kiểm tra sheet đã mở quyền "Anyone with the link can view", hoặc tải file .xlsx về rồi chọn file.', true); }
    };
    $('#onFile').onchange = async e => { try { msg('Đang đọc file...'); done(await onlineFromFiles([...e.target.files])); } catch (err) { msg(err.message, true); } e.target.value = ''; };
    function table() {
      const row = s => {
        const o = S.online[s.key] || {}, c = p => o[p] ? `${esc(o[p].testId)}<br><small>nộp ${esc(o[p].ts)}</small>` : '—';
        return `<tr><td>${esc(s.code)}</td><td>${esc(s.name)}</td><td>${c('reading')}</td><td>${c('listening')}</td><td class="num">${o.violations || ''}</td>
          <td>${o.reading || o.listening ? `<button class="btn sm" data-del="${esc(s.key)}">Xoá</button>` : ''}</td></tr>`;
      };
      $('#onTbl').innerHTML = `<div class="tablewrap"><table style="margin-top:12px"><thead><tr><th>Mã</th><th>Họ tên</th><th>Reading + UoE</th><th>Listening</th><th>Vi phạm</th><th></th></tr></thead><tbody>${students().map(row).join('')}</tbody></table></div>`;
      $('#onTbl').querySelectorAll('[data-del]').forEach(b => b.onclick = () => { delete S.online[b.dataset.del]; save(); table(); });
    }
    table();
  }

  // ---------- kết quả & xuất file ----------
  function warnings() {
    const w = [];
    let nf = 0; for (const st of Object.values(S.sheets)) for (const sh of Object.values(st)) nf += pendingFlags(sh);
    if (nf) w.push(`${nf} câu tô không chuẩn chưa duyệt (đang tính sai).`);
    const nw = writeQs().filter(k => !S.writeDone[k] && writeItems(k).length);
    if (nw.length) w.push(`Câu viết chưa xác nhận: ${nw.map(k => PAPER_SHORT[k.split('-')[0]] + k.split('-')[1]).join(', ')} (đang dùng mặc định).`);
    const vio = results().filter(r => r.violations > 0).length;
    if (vio) w.push(`${vio} học sinh có ghi vi phạm khi làm bài trên máy (xem bước 7).`);
    if (S.unknown.length) w.push(`${S.unknown.length} phiếu chưa xác định học sinh — chưa tính vào kết quả.`);
    const inc = results().filter(r => Object.values(r.secs).some(g => g && g.incomplete)).length;
    if (inc) w.push(`${inc} học sinh còn thiếu trang phiếu (phần điểm liên quan để trống).`);
    return w;
  }
  const secCell = g => !g ? '—' : g.incomplete ? 'thiếu trang' : null;
  const pctTxt = (a, b) => b ? Math.round(100 * a / b) + '%' : '';
  function renderExport() {
    renderSync();
    if (S && !S.view) pullSession(true).then(n => { if (n) renderExport(); });   // lấy phần máy khác đã sao lưu (nếu có) trước khi xem / xuất
    const w = warnings(), L = lvl(), daily = isDaily(), sp = hasSpeaking();
    $('#exportWarn').innerHTML = (w.length ? `<div class="notice warn">${w.map(esc).join('<br>')}</div>` : '')
      + (HIST_ERR && !daily ? `<div class="notice info">Chưa đọc được điểm các đợt Mock trước (${esc(HIST_ERR)}). Phiếu báo điểm hiện như đợt đầu, chưa có mũi tên tăng giảm.</div>` : '');
    const hint = $('#rpHint'); hint.dataset.def = hint.dataset.def || hint.innerHTML;   // câu hướng dẫn mặc định (Mock)
    hint.innerHTML = daily ? 'Bài hàng ngày chỉ có điểm thô và %, <b>không có phiếu báo điểm</b>. Muốn xuất phiếu, quay lại bước 1 và chọn <b>Mock test</b>.' : hint.dataset.def;   // bài hàng ngày: không có phiếu báo điểm
    const rs = results();
    $('#resTable').innerHTML = `<thead><tr><th>STT</th><th>Mã</th><th>Họ tên</th><th>Lớp</th>${L.phan.map(s => daily
      ? `<th>${s.ten} /${secMax(S.level, s)}</th><th>%</th>` : `<th>${s.ten} /${secMax(S.level, s)}</th><th>Thang</th><th>CEFR</th>`).join('')}${hasWriting() ? '<th>Writing</th><th>Writing thang</th>' : ''}${sp ? (daily ? '<th>Speaking</th><th>%</th>' : '<th>Speaking</th><th>Speaking thang</th>') : ''}<th>Tô không chuẩn</th></tr></thead><tbody>` +
      rs.map(r => `<tr class="${r.any ? '' : 'missing'}"><td class="num">${r.stt}</td><td>${esc(r.s.code)}</td>
        <td class="nm-cell"><div class="nm-in"><span>${esc(r.s.name)}</span>${canReport(r) ? `<button class="btn small" data-rp="${r.s.key}">Phiếu</button>` : (!daily && r.any ? '<small class="hint">chưa có kỹ năng nào đủ trang để tính điểm</small>' : '')}</div></td>
        <td>${esc(r.s.vh)}</td>${L.phan.map(s => { const g = r.secs[s.id], t = secCell(g);
          if (t) return `<td colspan="${daily ? 2 : 3}">${t}</td>`;
          return daily ? `<td class="num">${g.raw}</td><td class="num">${pctTxt(g.raw, g.max)}</td>` : `<td class="num">${g.raw}</td><td class="num">${scaleText(g.scale)}</td><td>${g.cefr}</td>`; }).join('')}
        ${hasWriting() ? wrCells(r) : ''}${sp ? spCells(r) : ''}<td class="num">${r.nonstd || ''}</td></tr>`).join('') + '</tbody>';
    $('#resCards').innerHTML = rs.map(r => {   // điện thoại: mỗi học sinh một thẻ (bảng quá rộng để xem điểm)
      const row = [];
      for (const sec of L.phan) { const g = r.secs[sec.id], t = secCell(g); row.push([sec.ten, t || (daily ? `${g.raw}/${g.max} · ${pctTxt(g.raw, g.max)}` : `${g.raw}/${g.max} · ${scaleText(g.scale)} · ${g.cefr}`)]); }
      const fmt = v => v[0] === '' ? '—' : `${v[0]}/${v[1]}${v[2] === '' ? '' : ' · ' + v[2]}`;
      if (hasWriting()) row.push(['Writing', fmt(wrVals(r))]);
      if (sp) row.push(['Speaking', fmt(spVals(r))]);
      if (r.nonstd) row.push(['Tô không chuẩn', r.nonstd + ' câu']);
      return `<div class="rcard${r.any ? '' : ' missing'}"><div class="rc-h"><div><div class="rc-n">${esc(r.s.name)}</div><small>${esc(r.s.code)} · ${esc(r.s.vh)}</small></div>${canReport(r) ? `<button class="btn small" data-rp="${r.s.key}">Phiếu</button>` : ''}</div>
        ${r.any ? `<dl>${row.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : '<p class="hint" style="margin:8px 0 0">Chưa có bài</p>'}</div>`;
    }).join('');
    document.querySelectorAll('#resTable [data-rp], #resCards [data-rp]').forEach(b => b.onclick = () => studentReport(b.dataset.rp));
  }
  function note(r) {
    const n = [];
    for (const p of PAPERS) { const pk = LV[S.level].giay[p] || [], miss = pk.filter(x => !(S.sheets[r.s.key] || {})[x]);
      if (miss.length === pk.length) n.push(`Chưa có bài ${p === 'reading' ? 'Reading' : 'Listening'}`);
      else if (miss.length) n.push('Thiếu ' + miss.map(pageName).join(', ')); }
    const fl = PAPERS.flatMap(p => r.items[p].filter(i => i && i.flag).map(i => PAPER_SHORT[p] + i.q));
    if (fl.length) n.push('Chưa duyệt: ' + fl.join(', '));
    return n.join('; ');
  }
  const slug = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const fname = ext => `ket-qua_${slug(S.testTitle)}_${slug(S.cls)}_${new Date().toISOString().slice(0, 10)}.${ext}`;
  function download(blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  // ---------- gộp dữ liệu giữa các thiết bị ----------
  // Dữ liệu chấm nằm trong trình duyệt của từng máy. Máy A xuất file dữ liệu, máy B nhập vào: phiếu Reading/Listening, Speaking, Writing,
  // nhận xét của từng học sinh được ghép lại. Cùng một mục có ở cả hai máy thì lấy bản mới hơn (theo giờ lưu). Ảnh phiếu không kèm theo.
  function exportData() {
    if (!S) { alert('Hãy mở phiên chấm trước.'); return; }
    const copy = JSON.parse(JSON.stringify(S));
    for (const st of Object.values(copy.sheets || {})) for (const sh of Object.values(st)) delete sh.pgk;
    delete copy.dirty; delete copy.syncedAt; delete copy.syncError;
    const pack = { app: 'cham-pet', v: 1, id: S.id, test: S.testTitle, cls: S.cls, exportedAt: new Date().toISOString(), S: copy };
    const n = Object.keys(S.sheets).length, w = Object.keys(S.writing || {}).length, sp = Object.keys(S.speaking || {}).length;
    download(new Blob([JSON.stringify(pack)], { type: 'application/json' }), `du-lieu_${(S.test + '_' + S.cls).replace(/[^\w.-]+/g, '-')}_${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`);
    $('#mergeMsg').innerHTML = `<div class="notice info">Đã tải file dữ liệu: ${n} học sinh có phiếu Reading/Listening, ${sp} có Speaking, ${w} có Writing. Chuyển file sang máy kia (Zalo, Drive, email) rồi bấm "Nhập dữ liệu từ máy khác".</div>`;
  }
  function mergeData(pack) {
    if (!pack || pack.app !== 'cham-pet' || !pack.S) throw new Error('Đây không phải file dữ liệu xuất từ app chấm bài.');
    const inc = pack.S;
    if (inc.id !== S.id) throw new Error(`File này thuộc phiên "${pack.test} · ${pack.cls}", còn máy này đang mở "${S.testTitle} · ${S.cls}". Hãy mở đúng đề và lớp ở bước 1 rồi nhập lại.`);
    const st = { add: 0, upd: 0, keep: 0, skip: 0 }, ts = o => (o && +o.at) || 0;
    const take = (loc, inn, onNew) => {
      if (!loc) { st.add++; onNew && onNew(); return inn; }
      if (ts(inn) > ts(loc)) { st.upd++; onNew && onNew(loc); return inn; }
      st.keep++; return loc;
    };
    const inRoster = k => !!stuByKey(k);
    for (const [key, pages] of Object.entries(inc.sheets || {})) {
      if (!inRoster(key)) { st.skip++; continue; }
      const dst = (S.sheets[key] ||= {});
      for (const [pk, sh] of Object.entries(pages)) dst[pk] = take(dst[pk], sh, old => { if (old && old.pgk) idb.del(old.pgk).catch(() => {}); });
    }
    for (const f of ['writing', 'speaking']) {
      S[f] = S[f] || {};
      for (const [key, v] of Object.entries(inc[f] || {})) { if (!inRoster(key)) { st.skip++; continue; } S[f][key] = take(S[f][key], v); }
    }
    for (const f of ['comments', 'priorities', 'pick', 'online']) {
      S[f] = S[f] || {};
      for (const [key, v] of Object.entries(inc[f] || {})) if (inRoster(key) && S[f][key] === undefined) S[f][key] = v;
    }
    for (const k of Object.keys(inc.writeDone || {})) if (inc.writeDone[k]) S.writeDone[k] = true;
    const have = new Set((S.unknown || []).map(u => String(u.id)));
    for (const u of inc.unknown || []) if (!have.has(String(u.id))) S.unknown.push(u);
    return st;
  }
  async function importData(file) {
    const box = $('#mergeMsg');
    try {
      if (!S) throw new Error('Hãy mở phiên chấm (bước 1) đúng đề và lớp trước khi nhập.');
      const st = mergeData(JSON.parse(await file.text()));
      save(); renderRoster(); renderUnknown(); updateBadges(); renderExport();
      box.innerHTML = `<div class="notice info">Đã gộp: thêm mới ${st.add}, cập nhật bản mới hơn ${st.upd}, giữ nguyên bản trên máy này ${st.keep}${st.skip ? `, bỏ qua ${st.skip} mục của học sinh không có trong lớp` : ''}. Phiếu quét ở máy kia chưa có ảnh nên không xem lại cả phiếu ở máy này được; kết quả và phiếu báo điểm vẫn đầy đủ.</div>`;
    } catch (e) { box.innerHTML = `<div class="notice err">${esc(e.message || e)}</div>`; }
  }
  function confirmWarn() { const w = warnings(); return !w.length || confirm('Lưu ý:\n' + w.join('\n') + '\n\nVẫn tiếp tục?'); }

  // tiêu đề cột chung cho Excel / CSV
  // Nhận xét đầy đủ cho từng học sinh: tổng thể, ưu tiên tiếp theo, Speaking, Writing. Dùng cho Excel, CSV và Google Sheet ở CẢ HAI chế độ.
  // ====== Chi tiết từng tiêu chí của Speaking và Writing (dùng cho Excel, CSV, Google Sheet) ======
  const SPK_NAME = { GV: 'Grammar & Vocabulary', DM: 'Discourse Management', P: 'Pronunciation', IC: 'Interactive Communication', GA: 'Global Achievement' };
  const WR_CRIT = { content: 'Content', communicative_achievement: 'Communicative Achievement', organisation: 'Organisation', language: 'Language' };
  const WR_GROUP_TO_CRIT = { content: 'content', style: 'communicative_achievement', organisation: 'organisation', grammar: 'language', vocabulary: 'language' };
  const nrm = x => String(x || '').toLowerCase().replace(/[^a-z0-9+]/g, '');
  // Các tiêu chí lớn của phiếu Speaking, theo đúng thứ tự và các dòng trên phiếu in (lấy từ omr-template.json)
  function spCrits() {
    const T = TPL?.pages?.[`${S.level}-speaking`]; if (!T) return [];
    const qb = Object.fromEntries(T.questions.map(q => [q.q, q]));
    return T.blocks.map(b => {
      const qs = b.qs.map(n => qb[n]).filter(Boolean), band = qs.find(q => /^BAND-/.test(q.code));
      return band ? { crit: band.code.slice(5), rows: qs.filter(q => !/^BAND-/.test(q.code) && q.code !== 'Notably weak part'), weak: qs.some(q => q.code === 'Notably weak part') } : null;
    }).filter(Boolean);
  }
  // Nhãn đã tô ở một dòng: từ phiếu quét (rows) nếu có; nếu không (nhập tay hoặc JSON) thì suy từ mã chẩn đoán (evidence)
  function spRowLabels(d, q) {
    if (d.rows && d.rows[q.code] !== undefined) return d.rows[q.code];
    const ev = d.evidence || [], ALIAS = { supportindependence: 'support' }, want = nrm(q.code), want2 = ALIAS[want] || want;
    const mine = ev.map(k => String(k).split(' • ')).filter(([c]) => [want, want2].includes(nrm(c)) || [want, want2].includes(ALIAS[nrm(c)] || nrm(c)));
    if (q.code === 'IC') {   // IC: các chức năng giám khảo đã thấy (I, R, A, D, Q, N, L, F)
      const seen = ev.map(k => String(k).split(' • ')).filter(([c, st]) => /^[IRADQNLF]$/.test(c) && /observed/.test(st || '')).map(([c]) => c);
      return q.options.map(o => o.label).filter(l => seen.includes(l.split(' ')[0]));
    }
    return mine.map(([, st]) => st).filter(Boolean);
  }
  function spDetail(d, c) {   // nội dung một ô "Speaking · tiêu chí": Band + từng dòng nhỏ
    const w = window.SpeakingScore.WEIGHT[S.level][c.crit], has = (d.evidence || []).length || Object.keys(d.rows || {}).length, lines = [`Band ${d.bands?.[c.crit] ?? '—'}${w > 1 ? ` (×${w})` : ''}`];
    let n = 0;
    if (has) c.rows.forEach(q => { const l = spRowLabels(d, q); if (l.length) { n++; lines.push(`${String(q.row || q.code).replace(/\s*[*✱]\s*$/, '')}: ${l.join(', ')}`); } });   // chỉ liệt kê các dòng ĐÃ TÔ
    if (c.weak && d.weakPart) { n++; lines.push(`Notably weak part: ${d.weakPart.replace(/^P/, 'Part ')}`); }
    if (!n) lines.push('(chưa ghi nhận dòng chi tiết nào)');
    return lines.join('\n');
  }
  const spCritList = () => spCrits().filter(c => window.SpeakingScore?.WEIGHT?.[S.level]?.[c.crit]);
  function wrCritIds() {   // tiêu chí Writing có trong các bài đã nhập của lớp (theo thứ tự chuẩn)
    const seen = new Set(); students().forEach(s => (writingOf(s)?.parts || []).forEach(p => (p.criteria || []).forEach(c => seen.add(c.id))));
    return Object.keys(WR_CRIT).filter(id => seen.has(id));
  }
  const wrPartNos = () => { const n = new Set(); students().forEach(s => (writingOf(s)?.parts || []).forEach(p => n.add(p.part))); return [...n].sort((a, b) => a - b); };
  function wrDetail(d, id) {   // nội dung một ô "Writing · tiêu chí": mỗi Part một khối (band, nhận xét, để lên band, lỗi thuộc tiêu chí)
    return (d.parts || []).map(p => {
      const c = (p.criteria || []).find(x => x.id === id); if (!c) return '';
      const L = [`Part ${p.part}: Band ${c.band}/${c.max}`];
      if (c.comment) L.push(`Nhận xét: ${c.comment}`);
      if (c.to_move_up) L.push(`Để lên band: ${c.to_move_up}`);
      const errs = (p.errors || []).filter(e => (WR_GROUP_TO_CRIT[e.group] || 'language') === id);
      if (errs.length) L.push(`Lỗi (${errs.length}${p.errors_omitted ? `, còn ${p.errors_omitted} lỗi chưa liệt kê` : ''}):` + errs.slice(0, 12).map(e => `\n  • [${e.group}] ${e.original} → ${e.corrected}${e.explanation ? ` (${e.explanation})` : ''}${e.impeding ? ' · ảnh hưởng hiểu' : ''}`).join('') + (errs.length > 12 ? `\n  • … và ${errs.length - 12} lỗi khác` : ''));
      return L.join('\n');
    }).filter(Boolean).join('\n\n');
  }
  // Danh sách cột chi tiết, đặt sau điểm Writing và Speaking
  function detCols() {
    const out = [];
    if (hasWriting()) { wrPartNos().forEach(pn => wrCritIds().forEach(id => out.push(`Writing Part ${pn} · ${WR_CRIT[id]} (band)`))); wrCritIds().forEach(id => out.push(`Writing · ${WR_CRIT[id]} (chi tiết)`)); }
    if (hasSpeaking()) { spCritList().forEach(c => out.push(`Speaking · ${c.crit} (band)`)); spCritList().forEach(c => out.push(`Speaking · ${SPK_NAME[c.crit] || c.crit} (chi tiết)`)); }
    return out;
  }
  function detVals(r) {
    const out = [], wr = writingOf(r.s), sp = (S.speaking || {})[r.s.key];
    if (hasWriting()) {
      wrPartNos().forEach(pn => wrCritIds().forEach(id => { const c = wr?.parts?.find(p => p.part === pn)?.criteria?.find(x => x.id === id); out.push(c ? c.band : ''); }));
      wrCritIds().forEach(id => out.push(wr ? wrDetail(wr, id) : ''));
    }
    if (hasSpeaking()) {
      const ok = sp && spokenOk(r.s);
      spCritList().forEach(c => out.push(sp?.bands?.[c.crit] ?? ''));
      spCritList().forEach(c => out.push(sp ? spDetail(sp, c) : ''));
    }
    return out;
  }
  const DET_TEXT = n => /\(chi tiết\)$/.test(n);   // cột chữ dài: cho rộng và xuống dòng
  const CM_COLS = ['Nhận xét', 'Ưu tiên tiếp theo', 'Nhận xét Speaking', 'Nhận xét Writing'];
  const paperPre = p => p === 'listening' ? 'L' : 'R';
  function dailyComment(r) {   // bài hàng ngày: không dùng thang Cambridge, chỉ điểm thô, Part mạnh/yếu và câu cần xem lại
    const out = [];
    for (const sec of lvl().phan) {
      const g = r.secs[sec.id]; if (!g || g.incomplete) continue;
      const pts = partsOf(S.level, sec).filter(([, n]) => n).map(([p, n]) => ({ p, n, v: g.parts[p], f: g.parts[p] / n }));
      const strong = pts.filter(x => x.f >= 0.8).map(x => `Part ${x.p}`), weak = pts.filter(x => x.f < 0.6).sort((a, b) => a.f - b.f).slice(0, 2).map(x => `Part ${x.p} (${x.v}/${x.n})`);
      out.push(`${sec.ten}: ${g.raw}/${g.max} (${pctTxt(g.raw, g.max)}).` + (strong.length ? ` Làm tốt ${joinList(strong)}.` : '') + (weak.length ? ` Cần ôn ${joinList(weak)}.` : ''));
    }
    const bad = PAPERS.flatMap(p => (r.items[p] || []).filter(i => i && !i.ok && !i.bad).map(i => paperPre(p) + i.q));
    if (bad.length) out.push(`Các câu cần xem lại: ${bad.slice(0, 10).join(', ')}${bad.length > 10 ? ` và ${bad.length - 10} câu khác` : ''}.`);
    if (r.nonstd) out.push(`${r.nonstd} câu tô chưa đúng cách nên bị tính sai.`);
    return out.join(' ');
  }
  function dailyPriorities(r) {   // 3 phần yếu nhất kèm lời khuyên có sẵn của từng Part
    const c = [];
    for (const sec of lvl().phan) {
      const g = r.secs[sec.id]; if (!g || g.incomplete) continue;
      for (const [p, n] of partsOf(S.level, sec)) { const f = n ? g.parts[p] / n : 1; if (f < 0.6) c.push({ f, t: `${sec.ten} Part ${p}: ${cap1(NX?.loiKhuyen?.[S.level]?.[sec.id]?.[p] || 'xem lại các câu sai và đối chiếu đáp án')}` }); }
    }
    return c.sort((a, b) => a.f - b.f).slice(0, 3).map(x => x.t.replace(/\.?$/, '.'));
  }
  function speakingText(r) {
    const sp = (S.speaking || {})[r.s.key]; if (!sp || !window.SpeakingDiagnosis || !spokenOk(r.s)) return '';
    let d = null; try { d = window.SpeakingDiagnosis.pick(S.level, sp); } catch (e) { return ''; }
    if (!d) return '';
    const bits = [];
    if (d.strength) bits.push('Điểm mạnh: ' + d.strength);
    if (d.areas && d.areas.length) bits.push('Cần cải thiện: ' + d.areas.map(a => a.text + (a.part ? ` (rõ nhất ở ${a.part})` : '')).join(' '));
    if (d.next) bits.push('Cách sửa: ' + d.next);
    return bits.join('\n');
  }
  function writingText(r) {
    const d = writingOf(r.s); if (!d) return '';
    const steps = (d.overall_next_steps || []).filter(Boolean);
    if (steps.length) return steps.map(x => '• ' + x).join('\n');
    return (d.parts || []).map(p => p.short_comment ? `Part ${p.part}: ${p.short_comment}` : '').filter(Boolean).join('\n');
  }
  function cmtVals(r) {
    if (!r.any) return ['', '', '', ''];
    const daily = isDaily(), pr = daily ? dailyPriorities(r) : S_prior(r);
    return [daily ? dailyComment(r) : S_comment(r), pr.map((x, i) => `${i + 1}. ${x}`).join('\n'), speakingText(r), writingText(r)];
  }
  function exportHeader() {
    const L = lvl(), qCols = p => Object.keys(QMAP[S.level][p]).map(Number).sort((a, b) => a - b).map(q => PAPER_SHORT[p] + q);
    const secCols = sec => [`${sec.ten} /${secMax(S.level, sec)}`, ...(isDaily() ? [`${sec.ten} %`] : [`${sec.ten} thang`, `${sec.ten} CEFR`]), ...partsOf(S.level, sec).map(([p, n]) => `${sec.viet} Part ${p} (/${n})`)];
    return { qCols, cols: ['STT', 'Mã HS', 'Họ tên', 'Lớp', ...qCols('reading'), ...qCols('listening'), ...L.phan.flatMap(secCols), ...(hasWriting() ? WR_COLS : []), ...(hasSpeaking() ? spColsOf() : []), 'Số câu tô không chuẩn', 'Ghi chú', ...CM_COLS, ...detCols()] };
  }
  function secVals(r) {
    return [...lvl().phan.flatMap(sec => { const g = r.secs[sec.id], ok = g && !g.incomplete, t = !g ? '' : g.incomplete ? 'thiếu trang' : '';
      return [ok ? g.raw : t, ...(isDaily() ? [ok ? pctTxt(g.raw, g.max) : ''] : [ok ? scaleText(g.scale) : '', ok ? g.cefr : '']), ...partsOf(S.level, sec).map(([p]) => ok ? g.parts[p] : '')]; }),
      ...(hasWriting() ? wrVals(r) : []), ...(hasSpeaking() ? spVals(r) : [])];
  }
  async function exportXlsx() {
    if (!confirmWarn()) return false;
    const rs = results(), wb = new ExcelJS.Workbook(), { qCols, cols } = exportHeader();
    const fill = c => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: c } });
    const GREEN = 'FFE3F3EA', RED = 'FFFBE7E5', YEL = 'FFFFE9A8', AMB = 'FFFFF3CC', HEAD = 'FF' + lvl().mau.replace('#', '');
    const nQ = qCols('reading').length + qCols('listening').length;
    const build = (name, cellOf) => {
      const ws = wb.addWorksheet(name); ws.addRow(cols);
      const hr = ws.getRow(1); hr.font = { bold: true, color: { argb: 'FFFFFFFF' } }; hr.fill = fill(HEAD);
      ws.views = [{ state: 'frozen', xSplit: 4, ySplit: 1 }]; ws.getColumn(3).width = 26;
      if (name === 'Đáp án đã chọn') {
        const kr = ws.addRow(['', 'Đáp án', '', '', ...PAPERS.flatMap(p => Object.keys(QMAP[S.level][p]).map(Number).sort((a, b) => a - b).map(q => [].concat(KEY[p][q]).join('/')))]);
        kr.font = { bold: true }; kr.fill = fill('FFE6EDFC');
      }
      for (const r of rs) {
        const its = [...r.items.reading, ...r.items.listening];
        const row = ws.addRow([r.stt, r.s.code, r.s.name, r.s.vh, ...its.map(it => it ? cellOf(it) : ''), ...secVals(r), r.nonstd, note(r) || '', ...cmtVals(r), ...detVals(r)]);
        its.forEach((it, j) => { if (!it) return; const c = row.getCell(5 + j);
          c.fill = fill(it.flag ? YEL : it.ok ? GREEN : it.marks > 0 ? AMB : RED); c.alignment = { horizontal: 'center' }; });
        if (!r.any) row.font = { color: { argb: 'FF9AA3B1' } };
      }
      for (let j = 0; j < nQ; j++) ws.getColumn(5 + j).width = 5;
      cols.forEach((cn, k) => { if (DET_TEXT(cn)) { const col = ws.getColumn(k + 1); col.width = 62; col.alignment = { wrapText: true, vertical: 'top' }; } else if (/\(band\)$/.test(cn)) ws.getColumn(k + 1).width = 11; });
      CM_COLS.forEach((cn, k) => { const col = ws.getColumn(cols.indexOf(cn) + 1); col.width = k === 1 ? 46 : 60; col.alignment = { wrapText: true, vertical: 'top' }; });   // nhận xét: cột rộng, tự xuống dòng
    };
    build('Tổng hợp', it => it.marks);
    build('Đáp án đã chọn', it => it.shown);
    const st = wb.addWorksheet('Thống kê theo câu');
    st.addRow(['Bài', 'Câu', 'Part', 'Phần điểm', 'Đáp án', 'Số bài', 'Số đúng', '% đúng', 'Phương án sai chọn nhiều nhất', 'Số câu tô không chuẩn']);
    st.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; st.getRow(1).fill = fill(HEAD);
    for (const p of PAPERS) {
      const qs = Object.keys(QMAP[S.level][p]).map(Number).sort((a, b) => a - b);
      qs.forEach((q, j) => {
        const its = rs.map(r => r.items[p][j]).filter(Boolean), right = its.filter(i => i.ok).length, cnt = {};
        its.filter(i => !i.ok && i.type === 'mcq' && i.chosen).forEach(i => cnt[i.chosen] = (cnt[i.chosen] || 0) + 1);
        const top = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0], pct = its.length ? right / its.length : null;
        const row = st.addRow([p === 'reading' ? 'Reading' : 'Listening', q, QMAP[S.level][p][q].part, secOfQ(S.level, p, q)?.ten || '', [].concat(KEY[p][q]).join(' / '),
          its.length, right, pct, top ? `${top[0]} (${top[1]} HS)` : '', its.filter(i => i.bad).length || '']);
        row.getCell(8).numFmt = '0%';
        if (pct != null) row.getCell(8).fill = fill(pct < 0.5 ? RED : pct < 0.75 ? AMB : GREEN);
      });
    }
    st.columns.forEach((c, i) => c.width = [11, 6, 6, 16, 22, 8, 8, 8, 28, 20][i]);
    const buf = await wb.xlsx.writeBuffer();
    download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fname('xlsx'));
    return true;
  }
  function exportCsv() {
    if (!confirmWarn()) return;
    const rs = results(), { cols } = exportHeader(), q = s => `"${String(s).replace(/"/g, '""')}"`;
    const lines = [cols];
    for (const r of rs) lines.push([r.stt, r.s.code, r.s.name, r.s.vh, ...[...r.items.reading, ...r.items.listening].map(it => it ? it.marks : ''),
      ...secVals(r), r.nonstd, note(r), ...cmtVals(r), ...detVals(r)]);
    download(new Blob(['\uFEFF' + lines.map(l => l.map(q).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), fname('csv'));
  }

  // ---------- kỹ năng đưa vào phiếu kết quả ----------
  const spokenOk = s => { const sp = (S.speaking || {})[s.key]; return !!(sp && window.SpeakingScore && window.SpeakingScore.total(S.level, sp.bands) != null); };
  const allSkillIds = () => [...lvl().phan.map(x => x.id), 'writing', 'speaking'];
  const skillName = id => id === 'writing' ? 'Writing' : id === 'speaking' ? 'Speaking' : lvl().phan.find(x => x.id === id)?.ten || id;
  function scoredIds(r) {   // kỹ năng ĐÃ CÓ ĐIỂM của học sinh này
    const out = lvl().phan.filter(sec => { const g = r.secs[sec.id]; return g && !g.incomplete; }).map(x => x.id);
    if (writingOf(r.s)) out.push('writing');
    if (spokenOk(r.s)) out.push('speaking');
    return out;
  }
  const canReport = r => !isDaily() && scoredIds(r).length > 0;   // phiếu xuất được khi có điểm ít nhất 1 kỹ năng
  function pickOf(r) {   // kỹ năng đang được chọn (mặc định: tất cả; kỹ năng chưa có điểm hiện ô "chưa có bài")
    const all = allSkillIds(), sc = scoredIds(r), saved = (S.pick || {})[r.s.key];
    const sel = saved && saved.length ? saved.filter(id => all.includes(id)) : all;
    return sel.some(id => sc.includes(id)) ? sel : all;
  }
  const papersOf = sel => PAPERS.filter(p => lvl().phan.some(sec => sec.giay === p && sel.has(sec.id)));

  // ---------- nhận xét gợi ý ----------
  const fillT = (t, o) => String(t || '').replace(/\{(\w+)\}/g, (_, k) => o[k] ?? '');
  const joinList = a => a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' và ' + a[a.length - 1];
  const RANK = ['Dưới', 'A1', 'A2', 'B1', 'B2', 'C1'];
  const rank = c => RANK.indexOf(c.startsWith('Dưới') ? 'Dưới' : c);
  function suggestComment(r, sel) {   // sel: tập kỹ năng đưa vào phiếu (không truyền = tất cả)
    if (!NX) return '';
    const L = lvl(), out = [], strong = [], weak = [], lv = {}, below = [];
    const target = NX.mucTieu?.[S.level];
    for (const sec of L.phan) {
      const g = r.secs[sec.id]; if (!g || g.incomplete || (sel && !sel.has(sec.id))) continue;
      const band = g.cefr.startsWith('Dưới') ? 'Dưới' : g.cefr;
      (lv[band] = lv[band] || []).push(sec.ten);
      if (target && rank(g.cefr) < rank(target)) below.push(sec.ten);
      for (const [pt, n] of partsOf(S.level, sec)) {
        const v = g.parts[pt], f = n ? v / n : 1, o = { skill: sec.ten, part: pt, score: `${v}/${n}` };
        if (f >= NX.nguong.manh) strong.push({ f, t: fillT(NX.muc, o) });
        else if (f < NX.nguong.yeu) weak.push(fillT(NX.mucCaiThien, { ...o, advice: NX.loiKhuyen?.[S.level]?.[sec.id]?.[pt] || '' }).replace(/, $/, ''));
      }
    }
    for (const l of ['C1', 'B2', 'B1', 'A2', 'A1', 'Dưới']) if (lv[l]) out.push(fillT(NX.moDau[l], { skills: lv[l].join(NX.noiKyNang || ' và '), level: L.duoiThang.replace('Dưới ', '') }));
    if (below.length && NX.chuaDat) out.push(fillT(NX.chuaDat, { target, skills: joinList(below) }));
    const best = strong.sort((a, b) => b.f - a.f).slice(0, NX.toiDaDiemManh || 3).map(x => x.t);
    if (best.length) out.push(fillT(NX.diemManh, { list: joinList(best) }));
    out.push(weak.length ? fillT(NX.canCaiThien, { list: weak.join('; ') }) : NX.khongYeu);
    const items = (sel ? papersOf(sel) : PAPERS).flatMap(p => r.items[p]).filter(Boolean);
    if (items.some(i => i.bad)) out.push(NX.toBai);
    if (items.some(i => !i.bad && i.marks === 0 && (i.type === 'write' ? i.shown === '' : !i.chosen))) out.push(NX.boTrong);
    return out.filter(Boolean).join(' ').replace(/^./, c => c.toUpperCase());
  }
  const S_comment = (r, sel) => { if (isDaily()) return ''; const c = S.comments?.[r.s.key]; return c === undefined ? suggestComment(r, sel) : c; };   // bài hàng ngày: không có nhận xét tổng thể

  // ---------- phiếu 4 trang cho phụ huynh (viet/phieu-trang.js + viet/writing-report.js) ----------
  const LIMIT_CM = 700, LIMIT_PR = 140;   // số ký tự tối đa: nhận xét tổng thể, mỗi ý ưu tiên
  const GROUP_VI = { grammar: ['Grammar errors', '#FAD9D3'], vocabulary: ['Vocabulary errors', '#E6DCF5'], content: ['Content issues', '#FCEEB0'], organisation: ['Organisation issues', '#CFEEFB'], style: ['Style issues', '#F8D9E4'] };
  const CRIT_VI = { content: 'Nội dung', communicative_achievement: 'Giao tiếp', organisation: 'Bố cục', language: 'Ngôn ngữ' };
  const clip = (t, n) => {
    t = String(t || '').replace(/\s+/g, ' ').trim(); if (t.length <= n) return t;
    const c = t.slice(0, n - 1), k = c.lastIndexOf(' ');
    return c.slice(0, k > n * 0.6 ? k : n - 1).replace(/[,;:\s]+$/, '') + '…';
  };
  const cap1 = t => String(t || '').replace(/^./, c => c.toUpperCase());
  function suggestPriorities(r, sel) {
    const L = lvl(), cand = [];
    for (const sec of L.phan) {
      const g = r.secs[sec.id]; if (!g || g.incomplete || (sel && !sel.has(sec.id))) continue;
      for (const [pt, n] of partsOf(S.level, sec)) {
        const v = g.parts[pt], f = n ? v / n : 1; if (f >= 1) continue;
        const adv = NX?.loiKhuyen?.[S.level]?.[sec.id]?.[pt] || 'luyện lại dạng câu này và xem lại các câu sai';
        cand.push({ f, skill: sec.id, text: `${sec.ten} Part ${pt}: ${adv}.` });
      }
    }
    const wr = !sel || sel.has('writing') ? writingOf(r.s) : null;
    if (wr) {
      const p = wr.parts.slice().sort((a, b) => a.raw / a.raw_max - b.raw / b.raw_max)[0];
      const tip = (p.issues && p.issues[0]) || (p.criteria.filter(c => c.to_move_up).sort((a, b) => a.band / a.max - b.band / b.max)[0] || {}).to_move_up;
      if (tip) cand.push({ f: p.raw / p.raw_max, skill: 'writing', text: `Writing Part ${p.part}: ${tip}` });
    }
    cand.sort((a, b) => a.f - b.f);
    const out = [], seen = new Set();
    for (const c of cand) { if (out.length >= 3) break; if (!seen.has(c.skill)) { seen.add(c.skill); out.push(c); } }
    for (const c of cand) { if (out.length >= 3) break; if (!out.includes(c)) out.push(c); }
    return out.map(c => clip(cap1(c.text), LIMIT_PR));
  }
  const S_prior = (r, sel) => { const p = S.priorities?.[r.s.key]; return p === undefined ? suggestPriorities(r, sel) : p; };

  function reportModel(r) {
    const L = lvl(), T = window.PhieuTrang.THEME[S.level], sel = new Set(pickOf(r)), wr = sel.has('writing') ? writingOf(r.s) : null, wrAny = writingOf(r.s);
    const dates = Object.values(S.sheets[r.s.key] || {}).map(x => x.at);
    const day = dates.length ? new Date(Math.max(...dates)).toLocaleDateString('vi-VN') : '';
    let skills = [];
    for (const sec of L.phan) {
      const g = r.secs[sec.id];
      if (!g || g.incomplete) { skills.push({ id: sec.id, name: sec.ten, empty: true, scale: null, emptyNote: g ? 'Answer sheet missing' : 'No score yet', emptyVi: g ? 'Thiếu trang phiếu' : 'Chưa có bài' }); continue; }
      skills.push({ id: sec.id, name: sec.ten, raw: g.raw, max: g.max, scale: g.scale, d: null,
        parts: partsOf(S.level, sec).map(([pt, n]) => ({ name: 'Part ' + pt, v: g.parts[pt], n, d: null })) });
    }
    if (wr) skills.push({ id: 'writing', name: 'Writing', raw: wr.total.raw, max: wr.total.raw_max, scale: wr.total.cambridge_scale ?? null, est: !!wr.total.is_estimate, d: null,
      parts: wr.parts.map(p => ({ name: 'Part ' + p.part, v: p.raw, n: p.raw_max, d: null })) });
    else skills.push({ id: 'writing', name: 'Writing', empty: true, scale: null, emptyNote: 'No score yet', emptyVi: 'Chưa có bài Writing' });
    const spk = (S.speaking || {})[r.s.key] || null, SC = window.SpeakingScore, spRaw = spk ? SC.total(S.level, spk.bands) : null;
    if (spRaw != null) {
      const SPN = { GV: 'Grammar & Vocab', DM: 'Discourse', P: 'Pronunciation', IC: 'Interaction', GA: 'Global' };
      skills.push({ id: 'speaking', name: 'Speaking', raw: spRaw, max: SC.MAX[S.level], scale: SC.scale(S.level, spRaw), d: null,
        parts: Object.keys(SC.WEIGHT[S.level]).map(c => ({ name: SPN[c], v: spk.bands[c], n: 5, d: null })) });
    } else skills.push({ id: 'speaking', name: 'Speaking', empty: true, scale: null, emptyNote: spk ? 'Incomplete bands' : 'Not graded yet', emptyVi: spk ? 'Chưa đủ band các tiêu chí' : 'Chưa có điểm Speaking' });
    skills = skills.filter(k => sel.has(k.id));   // chỉ các kỹ năng được chọn đưa vào phiếu
    const sc = skills.filter(s => s.scale != null).map(s => s.scale);
    const ov = sc.length ? Math.round(sc.reduce((a, b) => a + b, 0) / sc.length) : null;
    const s1 = {}; skills.forEach(s => { s1[s.id] = s.scale; });
    // chẩn đoán: lấy từ dữ liệu có sẵn, không bịa
    // Reading / Use of English / Listening: MỖI KỸ NĂNG MỘT Ô (Part yếu nhất). Dòng "Yêu cầu Part" và danh sách câu (R5, L9…) là của Elaine
    // (viet/yeu-cau-part.js); em thêm lý do giáo viên chọn ở câu điền (ly-do-cau-dien.json).
    const causes = [];
    const cand = [];
    const skillCause = (sec, g, pt, v, n) => {
      const items = g.items.filter(i => i.part === pt && !i.ok), RS = FILLR?.dien || {};
      const adv = NX?.loiKhuyen?.[S.level]?.[sec.id]?.[pt];
      const yc = window.YEU_CAU_PART?.[S.level]?.[sec.id]?.[pt];
      const pre = sec.id === 'listening' ? 'L' : 'R';
      const nums = items.map(i => i.q);
      const numTxt = nums.length ? ` Các câu cần xem lại: ${nums.slice(0, 3).map(q => pre + q).join(', ')}${nums.length > 3 ? ` và ${nums.length - 3} câu khác` : ''}.` : '';
      const wr = items.filter(i => i.type === 'write'), cnt = {};
      const rs0 = i => i.reason || (i.shown === '' ? 'Bỏ trống' : '');
      wr.forEach(i => { const rs = rs0(i); if (rs) cnt[rs] = (cnt[rs] || 0) + 1; });
      const topR = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
      const detail = wr.filter(i => rs0(i)).map(i => `${pre}${i.q}: ${(RS[rs0(i)]?.why) || rs0(i).toLowerCase()}`);
      const allFill = wr.length === items.length && topR && RS[topR[0]];
      return { skill: sec.id, req: yc ? `Yêu cầu Part ${pt}: ${yc}` : '',
        title: allFill ? `Câu điền: ${RS[topR[0]].why}` : `Mất điểm ở ${sec.ten} Part ${pt}`,
        body: `Em được ${v}/${n} điểm ở Part này.${numTxt}` + (detail.length ? ` Lý do: ${detail.slice(0, 4).join('; ')}.` : ''),
        fix: cap1((allFill && RS[topR[0]].fix) || adv || 'xem lại các câu sai và đối chiếu đáp án').replace(/\.?$/, '.') };
    };
    for (const sec of L.phan) {
      const g = r.secs[sec.id]; if (!g || g.incomplete || !sel.has(sec.id)) continue;
      let worst = null;
      for (const [pt, n] of partsOf(S.level, sec)) {
        const v = g.parts[pt]; if (!n || v >= n) continue;
        if (!worst || v / n < worst.f) worst = { pt, v, n, f: v / n };
      }
      if (worst) cand.push({ f: worst.f, c: skillCause(sec, g, worst.pt, worst.v, worst.n) });
    }
    // mỗi kỹ năng còn mất điểm đã có 1 thẻ (Part yếu nhất của kỹ năng đó): giữ đủ, theo thứ tự kỹ năng
    cand.forEach(x => causes.push(x.c));
    if (wr) {
      const crit = wr.parts.flatMap(p => p.criteria.map(c => ({ c, p }))).sort((a, b) => a.c.band / a.c.max - b.c.band / b.c.max)[0];
      if (crit && crit.c.band < crit.c.max) causes.push({ skill: 'writing', title: `Writing: cần cải thiện ${CRIT_VI[crit.c.id] || crit.c.id}`, body: clip(crit.c.comment, 160), fix: clip(crit.c.to_move_up || crit.c.key_takeaway, 120) });
    }
    const papersSel = papersOf(sel), nonstd = papersSel.flatMap(p => r.items[p]).filter(x => x && x.bad).length;
    if (nonstd) causes.push({ title: 'Tô đáp án chưa đúng cách', body: `${nonstd} câu bị tô chưa đúng cách (tick, dấu X, tô không kín hoặc tô 2 ô) nên bị tính sai.`, fix: 'Tô kín một ô tròn cho mỗi câu.' });
    if (!causes.length) causes.push({ title: 'Kết quả rất tốt', body: 'Em không mất điểm đáng kể ở các phần đã chấm.', fix: 'Tiếp tục luyện tập đều đặn mỗi tuần.' });
    const gc = {}; (wr ? wr.parts : []).forEach(p => (p.errors || []).forEach(e => { gc[e.group] = (gc[e.group] || 0) + 1; }));
    const writingGroups = Object.keys(gc).length ? Object.entries(gc).sort((a, b) => b[1] - a[1]).map(([g, n]) => ({ ten: (GROUP_VI[g] || [g])[0], n, mau: (GROUP_VI[g] || [0, '#E3E7ED'])[1], note: '' }))
      : [{ ten: wr ? 'No errors listed' : (wrAny ? 'Not included' : 'No Writing result yet'), n: '', mau: '#E3E7ED', note: wr ? 'Không có lỗi được liệt kê' : (wrAny ? 'Không đưa vào phiếu này' : 'Chưa có bài Writing') }];
    const habits = [];
    for (const p of papersSel) {
      const blanks = r.items[p].filter(i => i && !i.bad && i.marks === 0 && (i.type === 'write' ? i.shown === '' : !i.chosen)).map(i => (p === 'listening' ? 'L' : 'R') + i.q);
      if (blanks.length) habits.push(`Có ${blanks.length} câu ${cap1(p)} bỏ trống (${blanks.slice(0, 6).join(', ')}${blanks.length > 6 ? ', ...' : ''}).`);
    }
    const badQ = papersSel.flatMap(p => r.items[p].filter(i => i && i.bad).map(i => (p === 'listening' ? 'L' : 'R') + i.q));
    if (badQ.length) habits.push(`Có ${badQ.length} câu tô chưa đúng cách (${badQ.slice(0, 6).join(', ')}${badQ.length > 6 ? ', ...' : ''}). Hãy tô kín một ô tròn.`); else habits.push('Tô đáp án rõ ràng, không có câu tô sai cách.');
    const wrong = [];
    for (const sec of L.phan) {
      const g = r.secs[sec.id]; if (!g || g.incomplete || !sel.has(sec.id)) continue;
      const nums = g.items.filter(i => !i.ok).map(i => 'Q' + i.q);   // chỉ ghi số câu sai: luôn gọn, không tràn trang
      wrong.push({ skill: sec.id, name: sec.ten, count: nums.length, items: nums.length ? [nums.join(', ')] : ['No wrong answers'] });
    }
    const hp = isDaily() ? null : histFor(r.s.code, skills);   // đợt Mock trước (nếu có) → mũi tên ▲▼ và biểu đồ tiến bộ
    if (hp) skills.forEach(k => { k.d = k.scale != null && hp.prev.s[k.id] != null ? k.scale - hp.prev.s[k.id] : null; });
    const od = hp && hp.comparable && ov != null ? ov - avgOf(hp.prev.s, Object.keys(hp.prev.s)) : null;
    const m = {
      first: !hp, level: S.level, exam: S.testTitle, date: day, mockNo: isDaily() ? '' : (S.dot || (hp ? hp.hist.length + 1 : 1)), monthYear: new Date(dates.length ? Math.max(...dates) : Date.now()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      student: { name: r.s.name, id: r.s.code, cls: r.s.vh },
      skills, overall: { scale: ov, d: od, partial: sc.length < skills.length || sel.size < allSkillIds().length },
      history: [...(hp ? hp.hist : []), { label: 'Mock ' + (S.dot || (hp ? hp.hist.length + 1 : 1)), s: s1, overall: ov }],
      comment: clip(S_comment(r, sel), LIMIT_CM), priorities: S_prior(r, sel).map(x => clip(x, LIMIT_PR)),
      diagnosis: { causes: causes.slice(0, 6), writingGroups, habits, wrong },
      speaking: sel.has('speaking') ? spk : null
    };
    return m;
  }
  function reportPages(r) {
    const PT = window.PhieuTrang, WR = window.WritingReport, L = lvl();
    if (!PT || !WR) return [reportHTML(r)];   // dự phòng: phiếu 1 trang cũ nếu thiếu file viet/phieu-trang.js
    const m = reportModel(r), wr = pickOf(r).includes('writing') ? writingOf(r.s) : null, T = PT.THEME[S.level];
    // Trang Writing trước (số trang mỗi Part tùy độ dài lỗi và bài mẫu), rồi mới biết tổng số trang
    const wpages = []; let pg = 3;
    for (let i = 0; wr && i < wr.parts.length; i++) {
      const ps = WR.partPages(wr, i, { mau: T.a, dark: T.d, soft: T.soft, tenCapDo: L.ten.toUpperCase(), trang: pg });
      wpages.push(...ps); pg += ps.length;
    }
    m.totalPages = 2 + wpages.length;
    return [PT.overview(m), PT.diagnosis(m), ...wpages].map(h => h.replace(/__TOTAL__/g, m.totalPages));
  }
  const ensureFonts = async () => {
    try { await Promise.all(['400', '500', '600', '700'].map(w => document.fonts.load(`${w} 13px "Be Vietnam Pro"`, 'Tiếng Việt ắằẳẵặ ưừ ơờ'))); await document.fonts.ready; } catch {}
  };
  async function renderReportCanvases(r) {
    const stage = $('#reportStage'), out = [];
    await ensureFonts();
    for (const html of reportPages(r)) {
      stage.innerHTML = html;
      const el = stage.firstElementChild;
      if (window.WritingReport && el.classList.contains('wr-page')) window.WritingReport.fit(el);
      out.push(await window.html2canvas(el, { scale: 2, backgroundColor: '#ffffff', logging: false }));
    }
    return out;
  }

  // ---------- phiếu kết quả cá nhân ----------
  const LIBS = ['https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
                'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'];
  // Tải thư viện: kiểm tra thư viện thật sự có mặt (không chỉ thẻ <script>), tải lỗi thì thử nguồn dự phòng, không tải trùng
  const LIB_ALT = { [LIBS[0]]: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
                    [LIBS[1]]: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js' };
  const libOk = src => /jspdf/.test(src) ? !!(window.jspdf && window.jspdf.jsPDF) : !!window.html2canvas;
  const libBusy = {};
  const addScript = src => new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => { s.remove(); rej(new Error('load ' + src)); };
    document.head.appendChild(s);
  });
  const loadScript = src => {
    if (libOk(src)) return Promise.resolve();
    if (!libBusy[src]) libBusy[src] = (async () => {
      for (const u of [src, LIB_ALT[src]]) {
        try { await addScript(u); if (libOk(src)) return; } catch (e) { console.error(e); }
      }
      throw new Error('Không tải được thư viện tạo phiếu — kiểm tra kết nối mạng rồi thử lại.');
    })().finally(() => { delete libBusy[src]; });
    return libBusy[src];
  };
  const ensureLibs = () => Promise.all(LIBS.map(loadScript));
  const barColor = f => f >= 0.75 ? '#1E7F4F' : f >= 0.5 ? '#E0A100' : '#B42318';
  function reportHTML(r) {
    const L = lvl(), mau = L.mau;
    const dates = Object.values(S.sheets[r.s.key] || {}).map(x => x.at);
    const day = dates.length ? new Date(Math.max(...dates)).toLocaleDateString('vi-VN') : '';
    const card = sec => {
      const g = r.secs[sec.id];
      if (!g || g.incomplete) return `<div class="rp-skill"><h2>${sec.ten}</h2><div class="rp-none">${g ? 'Thiếu trang phiếu' : 'Chưa có bài'}</div></div>`;
      const parts = partsOf(S.level, sec).map(([pt, n]) => { const v = g.parts[pt], f = n ? v / n : 0;
        return `<div class="rp-part"><span>Part ${pt}</span><div class="rp-bar"><i style="width:${Math.max(f * 100, 2)}%;background:${barColor(f)}"></i></div><b>${v}/${n}</b></div>`; }).join('');
      return `<div class="rp-skill"><h2>${sec.ten}<em style="background:${mau}1f;color:${mau}">${g.cefr}</em></h2>
        <div class="rp-big"><div><b>${g.raw}</b><span> / ${g.max} điểm</span></div><div><b>${scaleText(g.scale)}</b><span> thang Cambridge</span></div></div>${parts}</div>`;
    };
    const wrong = sec => {
      const g = r.secs[sec.id]; if (!g || g.incomplete) return '';
      const bad = g.items.filter(i => !i.ok); let last = null, out = '';
      if (!bad.length) return `<div><h3>${sec.ten}</h3><ul><li>Không sai câu nào 🎉</li></ul></div>`;
      for (const i of bad) {
        if (i.part !== last) { out += `<li class="pt">PART ${i.part}</li>`; last = i.part; }
        const key = i.key ?? [].concat(KEY[sec.giay][i.q]).join(' / ');
        const what = i.type === 'write' ? (i.shown === '' ? 'bỏ trống' : i.marks > 0 ? `được ${i.marks}/${i.maxMarks} điểm` : 'chưa đúng')
          : i.bad && !i.chosen ? `tô ô ${esc(i.shown.replace('*', ''))} chưa đúng cách` : i.chosen ? `em chọn ${i.chosen}` : 'bỏ trống';
        out += `<li><b>${i.q}.</b> ${what} → đáp án <b>${esc(key)}</b></li>`;
      }
      return `<div><h3>${sec.ten} — câu cần xem lại</h3><ul>${out}</ul></div>`;
    };
    const habit = PAPERS.flatMap(p => r.items[p].filter(i => i && i.bad).map(i => PAPER_SHORT[p] + i.q));
    const n = L.phan.length, cm = S_comment(r);
    return `<div class="rp">
      <div class="rp-band" style="background:${mau}"><small>RUBY SCHOOL · CAMBRIDGE ${esc(L.ten.toUpperCase())}</small><h1>Phiếu kết quả ${L.phan.map(s => s.ten).join(' · ')}</h1></div>
      <div class="rp-main">
        <div class="rp-info"><div><span>Họ và tên</span><b>${esc(r.s.name)}</b></div><div><span>Mã học sinh</span><b>${esc(r.s.code)}</b></div>
          <div><span>Lớp</span><b>${esc(r.s.vh)}</b></div><div><span>Lớp Cambridge</span><b>${esc(S.cls)}</b></div><div><span>Đề</span><b>${esc(S.testTitle)}</b></div><div><span>Ngày chấm</span><b>${day}</b></div></div>
        <div class="rp-scores" style="grid-template-columns:repeat(${n},1fr)">${L.phan.map(card).join('')}</div>
        ${habit.length ? `<div class="rp-habit"><b>Lưu ý cách tô bài:</b> ${habit.length} câu tô chưa đúng cách (tick, dấu X, tô không kín hoặc tô 2 ô): ${habit.join(', ')}. Những câu này bị tính sai. Lần sau em hãy <b>tô kín một ô tròn</b> cho mỗi câu nhé.</div>` : ''}
        <div class="rp-wrong" style="grid-template-columns:repeat(${n},1fr)">${L.phan.map(wrong).join('')}</div>
        ${cm ? `<div class="rp-note"><b>Nhận xét của giáo viên</b><p>${esc(cm)}</p></div>` : '<div class="rp-note"><b>Nhận xét của giáo viên</b><div></div><div></div></div>'}
      </div>
      <div class="rp-foot"><span>Điểm quy đổi theo bảng Cambridge English Scale của ${esc(L.ten)}; mỗi phần là điểm từng kỹ năng.</span><span>Ruby School</span></div>
    </div>`;
  }
  async function renderReportCanvas(r) {
    const stage = $('#reportStage'); stage.innerHTML = reportHTML(r);
    try { await document.fonts?.ready; } catch {}
    return window.html2canvas(stage.firstElementChild, { scale: 2, backgroundColor: '#ffffff', logging: false });
  }
  function addPage(pdf, canvas, first) {
    if (!first) pdf.addPage();
    const W = 210, H = 297, ratio = canvas.height / canvas.width;
    let w = W, h = W * ratio; if (h > H) { h = H; w = H / ratio; }
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', (W - w) / 2, 0, w, h);
  }
  function busy(msg) { $('#loading').hidden = !msg; if (msg) $('#loadingMsg').textContent = msg; }
  const lines = t => t.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 3);
  function updateCounts() {
    const c = $('#reportComment').value.length, el = $('#reportCmCount');
    el.textContent = `${c}/${LIMIT_CM}`; el.style.color = c > LIMIT_CM ? '#B42318' : '';
    const over = lines($('#reportPriorities').value).filter(x => x.length > LIMIT_PR).length, pe = $('#reportPrCount');
    pe.textContent = over ? `${over} ý vượt ${LIMIT_PR} ký tự, phiếu sẽ cắt bớt` : `tối đa 3 ý, mỗi ý ${LIMIT_PR} ký tự`; pe.style.color = over ? '#B42318' : '';
  }
  async function studentReport(key, again) {
    if (isDaily()) return;   // bài hàng ngày không có phiếu báo điểm
    if (!again && !confirmWarn()) return;
    const r = results().find(x => x.s.key === key); if (!r) return;
    if (!canReport(r)) { alert('Học sinh này chưa có điểm kỹ năng nào để xuất phiếu.'); return; }
    if (histP) await histP;   // lịch sử các đợt Mock trước
    const sel = new Set(pickOf(r)), scored = scoredIds(r), wide = window.matchMedia('(min-width: 900px)').matches;
    const keepOpen = $('#reportModal').hidden ? null : { pick: $('#mtPick').open, cm: $('#mtCm').open };
    $('#mtPick').open = keepOpen ? keepOpen.pick : wide; $('#mtCm').open = keepOpen ? keepOpen.cm : wide;
    $('#mtPickN').textContent = `${sel.size}/${allSkillIds().length}`;
    $('#reportComment').value = S_comment(r, sel);
    $('#reportPriorities').value = S_prior(r, sel).join('\n');
    // khung chọn kỹ năng đưa vào phiếu
    const box = $('#reportPick'), ids = allSkillIds();
    box.innerHTML = '<b>Kỹ năng đưa vào phiếu</b><label class="pk pk-all"><input type="checkbox" id="pkAll"> Tất cả</label>'
      + ids.map(id => `<label class="pk${scored.includes(id) ? '' : ' pk-none'}"><input type="checkbox" data-sk="${id}"${sel.has(id) ? ' checked' : ''}> ${esc(skillName(id))}${scored.includes(id) ? '' : ' <small>chưa có điểm</small>'}</label>`).join('')
      + '<button type="button" class="btn small" id="pkScored">Chỉ kỹ năng có điểm</button><p class="hint" id="pkHint"></p>';
    const boxes = [...box.querySelectorAll('[data-sk]')], pkAll = $('#pkAll');
    const syncAll = () => { pkAll.checked = boxes.every(x => x.checked); };
    syncAll();
    const applyPick = ids2 => {   // đổi kỹ năng: nhận xét/ưu tiên chưa sửa tay thì tự gợi ý lại theo lựa chọn mới
      if (!ids2.some(id => scored.includes(id))) { $('#pkHint').textContent = 'Phiếu cần có ít nhất 1 kỹ năng đã có điểm.'; boxes.forEach(x => { x.checked = sel.has(x.dataset.sk); }); syncAll(); return; }
      const oldAutoC = suggestComment(r, sel).trim(), oldAutoP = suggestPriorities(r, sel).join('\n'), nsel = new Set(ids2);
      const cm = $('#reportComment').value.trim(), pr = lines($('#reportPriorities').value);
      (S.pick ||= {})[key] = ids2;
      S.comments[key] = cm === oldAutoC ? suggestComment(r, nsel) : cm;
      (S.priorities ||= {})[key] = pr.join('\n') === oldAutoP ? suggestPriorities(r, nsel) : pr;
      touchCm(key);
      save(); studentReport(key, true);
    };
    boxes.forEach(x => { x.onchange = () => { syncAll(); applyPick(boxes.filter(b => b.checked).map(b => b.dataset.sk)); }; });
    pkAll.onchange = () => { boxes.forEach(x => { x.checked = pkAll.checked; }); if (!pkAll.checked) { boxes.forEach(x => { x.checked = scored.includes(x.dataset.sk); }); syncAll(); } applyPick(boxes.filter(b => b.checked).map(b => b.dataset.sk)); };
    $('#pkScored').onclick = () => applyPick(scored);
    $('#reportComment').oninput = $('#reportPriorities').oninput = updateCounts; updateCounts();
    $('#reportSuggest').onclick = () => { $('#reportComment').value = suggestComment(r, sel); $('#reportPriorities').value = suggestPriorities(r, sel).join('\n'); updateCounts(); };
    $('#reportUpdate').onclick = () => { S.comments[key] = $('#reportComment').value.trim(); (S.priorities ||= {})[key] = lines($('#reportPriorities').value); touchCm(key); save(); studentReport(key, true); };
    busy('Đang tạo phiếu kết quả…');
    try {
      await ensureLibs();
      const canvases = await renderReportCanvases(r);
      const base = `phieu-ket-qua_${r.s.code}_${slug(r.s.name)}`;
      const jpgs = await Promise.all(canvases.map(c => new Promise(res => c.toBlob(res, 'image/jpeg', 0.9))));
      const files = jpgs.map((b, i) => new File([b], `${base}_trang${i + 1}.jpg`, { type: 'image/jpeg' }));
      $('#reportTitle').textContent = `${r.s.name} (${r.s.code})`;
      const box = $('#reportImgs'); box.innerHTML = '';
      jpgs.forEach((b, i) => { const im = document.createElement('img'); im.alt = `Trang ${i + 1}`; im.src = URL.createObjectURL(b); box.appendChild(im); });
      $('#reportJpg').onclick = () => jpgs.forEach((b, i) => setTimeout(() => download(b, files[i].name), i * 400));
      const makePdf = () => { const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' }); canvases.forEach((c, i) => addPage(pdf, c, i === 0)); return pdf.output('blob'); };
      $('#reportPdf').onclick = () => download(makePdf(), base + '.pdf');
      // Gửi qua Zalo / ứng dụng khác (Web Share): PDF dựng sẵn ở nền để bấm là gửi ngay, không mất thao tác chạm của người dùng
      let pdfFile = null;
      const hint = $('#shareHint'), shareBtn = $('#reportShare'), imgBtn = $('#reportShareImg');
      const hasShare = !!navigator.share, canF = fs => !!(navigator.canShare && fs && navigator.canShare({ files: fs }));
      shareBtn.hidden = true; imgBtn.hidden = true; hint.textContent = hasShare ? 'Đang chuẩn bị tệp để gửi…' : '';
      const doShare = async fs => {
        hint.textContent = '';
        try { await navigator.share({ files: fs, title: `Phiếu kết quả — ${r.s.name}` }); }
        catch (e) {
          if (e && e.name === 'AbortError') return;   // người dùng đóng bảng chia sẻ
          hint.textContent = `Không gửi được từ trình duyệt (${e && e.name ? e.name : 'lỗi'}). Bấm "Tải PDF" rồi gửi tệp trong Zalo.`;
        }
      };
      setTimeout(() => {
        try { pdfFile = new File([makePdf()], base + '.pdf', { type: 'application/pdf' }); } catch (e) { pdfFile = null; }
        const okPdf = hasShare && canF(pdfFile ? [pdfFile] : null), okImg = hasShare && canF(files);
        shareBtn.hidden = !okPdf; imgBtn.hidden = !okImg;
        shareBtn.onclick = () => doShare([pdfFile]); imgBtn.onclick = () => doShare(files);
        hint.textContent = okPdf || okImg ? '' : 'Trình duyệt này không chia sẻ tệp trực tiếp. Bấm "Tải PDF" rồi gửi tệp trong Zalo (máy tính: kéo tệp vào cửa sổ chat).';
      }, 60);
      $('#reportModal').hidden = false;
    } catch (e) { alert(e.message || e); }
    finally { busy(''); $('#reportStage').innerHTML = ''; }
  }
  async function clearSession() {
    if (!confirm(`Xoá toàn bộ phiếu đã chụp của ${S.testTitle} – ${S.cls}? Không thể hoàn tác.`)) return;
    const oldTomb = { ...(S.cloudDel || {}) }; if (cloudOn()) cloudItems().forEach(i => { oldTomb[i.k] = Date.now(); });
    await idb.del(S.id);
    for (const st of Object.values(S.sheets || {})) for (const sh of Object.values(st)) if (sh.pgk) idb.del(sh.pgk).catch(() => {});
    S = { id: S.id, mode: S.mode, label: S.label, dot: S.dot, mixed: S.mixed, test: S.test, testTitle: S.testTitle, level: S.level, cls: S.cls, sheets: {}, unknown: [], writeDone: {}, comments: {}, priorities: {}, writing: {}, speaking: {}, online: {}, cloudDel: oldTomb };
    go('scan');
  }

  window.__PET = { get S() { return S; }, results, reportModel, pickOf, scoredIds, guessByCode, spJsonCheck };
  boot().catch(e => { $('#loading').hidden = true; alert('Không tải được cấu hình app: ' + e.message); });
})();
