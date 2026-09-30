/* cham-bai.js — app chấm phiếu Cambridge KET / PET / FCE (Ruby School) */
(function () {
  'use strict';
  const APP_VERSION = '28/09/2026 — KET · PET · FCE, mã học sinh 6 số, mỗi giáo viên một mã';
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const PAPERS = ['reading', 'listening'];
  const PAPER_SHORT = { reading: 'R', listening: 'L' };

  let TPL, LV, NX = null, CFG = {}, TESTS = [], KEY = null, cvReady = false;
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
    if (!S) return;
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
    CFG = await fetch('cau-hinh.json').then(r => r.ok ? r.json() : {}).catch(() => ({}));
    CFG.on = /^https:\/\/script\.google\.com\//.test(CFG.sheetUrl || '');
    $('#sheetBox').hidden = !CFG.on; $('#fileBox').open = !CFG.on;
    $('#tCode').value = lsGet('omr-tcode', '');
    $('#btnSync').onclick = () => fetchRosters(true);
    $('#selClass').onchange = fillTests;
    const last = lsGet('omr-last', {});
    fillClasses(last.cls); if (last.test) $('#selTest').value = last.test;
    if (CFG.on && $('#tCode').value) fetchRosters(false);
    else if (CFG.on) $('#syncInfo').textContent = 'Nhập mã giáo viên rồi bấm "Cập nhật danh sách lớp".';
    document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
    $('#fileRoster').onchange = e => loadRoster(e.target.files[0]).finally(() => e.target.value = '');
    $('#btnStart').onclick = start;
    $('#fileCam').onchange = e => { handleFiles([...e.target.files]); e.target.value = ''; };
    $('#fileMany').onchange = e => { handleFiles([...e.target.files]); e.target.value = ''; };
    $('#btnXlsx').onclick = exportXlsx; $('#btnCsv').onclick = exportCsv;
    $('#btnClear').onclick = clearSession;
    $('#btnScan').onclick = startScanner; $('#scanStop').onclick = stopScanner;
    document.addEventListener('visibilitychange', () => { if (document.hidden && cam.running) stopScanner(); });
    $('#btnClassReport').onclick = classReport; $('#reportClose').onclick = () => $('#reportModal').hidden = true;
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
    ({ scan: renderScan, review: renderReview, write: renderWrite, writing: renderWriting, export: renderExport })[v]?.();
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
  function fillTests() {
    const c = rosters()[$('#selClass').value], lv = c?.level;
    const list = TESTS.filter(t => !lv || t.level === lv);
    $('#selTest').innerHTML = list.length ? list.map(t => `<option value="${esc(t.id)}">${esc(t.title)}</option>`).join('')
      : `<option value="">Chưa có đề ${lv || ''}</option>`;
    const last = lsGet('omr-last', {}); if (last.test && list.some(t => t.id === last.test)) $('#selTest').value = last.test;
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
    const L = lvl(), header = ['Đề', 'Lớp Cambridge', 'Mã HS', 'Họ tên', 'Lớp'];
    for (const sec of L.phan) header.push(`${sec.ten} /${secMax(S.level, sec)}`, `${sec.ten} thang`, `${sec.ten} CEFR`,
      ...partsOf(S.level, sec).map(([p, n]) => `${sec.viet} Part ${p} (/${n})`));
    header.push('Số câu tô không chuẩn', 'Ghi chú', 'Nhận xét', ...PAPERS.map(p => `Chi tiết ${p === 'reading' ? 'Reading' : 'Listening'}`));
    const rows = results().filter(r => r.any).map(r => {
      const o = { 'Khoá': `${S.test}|${S.cls}|${r.s.code}`, 'Đề': S.testTitle, 'Lớp Cambridge': S.cls, 'Mã HS': r.s.code, 'Họ tên': r.s.name, 'Lớp': r.s.vh };
      for (const sec of L.phan) {
        const g = r.secs[sec.id], ok = g && !g.incomplete;
        o[`${sec.ten} /${secMax(S.level, sec)}`] = ok ? g.raw : (g ? 'thiếu trang' : '');
        o[`${sec.ten} thang`] = ok ? scaleText(g.scale) : ''; o[`${sec.ten} CEFR`] = ok ? g.cefr : '';
        partsOf(S.level, sec).forEach(([p, n]) => o[`${sec.viet} Part ${p} (/${n})`] = ok ? g.parts[p] : '');
      }
      for (const p of PAPERS) o[`Chi tiết ${p === 'reading' ? 'Reading' : 'Listening'}`] = r.items[p].map(i => `${i.q}${i.type === 'write' ? '' : (i.chosen || '-')}${i.marks === i.maxMarks ? '✓' : i.marks > 0 ? '½' : '✗'}`).join(' ');
      o['Số câu tô không chuẩn'] = r.nonstd; o['Ghi chú'] = note(r); o['Nhận xét'] = S_comment(r);
      return o;
    });
    return { header, rows };
  }
  async function pushResults(loud) {
    if (!CFG.on || syncing || !S) return;
    const code = lsGet('omr-tcode', '');
    if (!code) { if (loud) alert('Chưa có mã giáo viên. Nhập ở bước 1 để sao lưu lên Google Sheet.'); return; }
    const { header, rows } = sheetRows();
    if (!rows.length) { if (loud) alert('Chưa có phiếu nào để sao lưu.'); return; }
    syncing = true; renderSync('Đang sao lưu…');
    try {
      const r = await fetch(CFG.sheetUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'results', code, sheet: 'Kết quả ' + S.level, header, rows }) }).then(x => x.json());
      if (!r.ok) throw new Error(r.error || 'Google Sheet từ chối');
      S.dirty = false; S.syncedAt = new Date().toISOString(); S.syncError = ''; save(false);
    } catch (e) {
      S.syncError = String(e.message || e);
      if (loud) alert('Chưa sao lưu được: ' + S.syncError + '\nKết quả vẫn lưu trên máy; app sẽ thử lại khi có thay đổi.');
    } finally { syncing = false; renderSync(); }
  }
  function renderSync(msg) {
    const el = $('#syncStatus'); if (!el) return;
    if (!CFG.on || !S) { el.hidden = true; return; }
    el.hidden = false;
    const txt = msg || (!lsGet('omr-tcode', '') ? 'Chưa nhập mã giáo viên — kết quả chỉ lưu trên máy này.'
      : !S.dirty && S.syncedAt ? `☁️ Đã sao lưu lên Google Sheet (tab "Kết quả ${S.level}") lúc ${hhmm(new Date(S.syncedAt))}.`
      : S.syncedAt ? `Có thay đổi chưa sao lưu (lần trước: ${hhmm(new Date(S.syncedAt))}).` : 'Chưa sao lưu lên Google Sheet.');
    el.innerHTML = `<span>${esc(txt)}</span>${msg ? '' : '<button class="btn small" id="btnPush">Sao lưu ngay</button>'}`;
    const b = $('#btnPush'); if (b) b.onclick = () => pushResults(true);
  }

  // ---------- phiên chấm ----------
  async function start() {
    const cls = $('#selClass').value, tid = $('#selTest').value, R = rosters()[cls];
    if (!R) { alert('Hãy chọn lớp (cập nhật danh sách lớp trước).'); return; }
    const t = TESTS.find(x => x.id === tid);
    if (!t) { alert(`Chưa có đề ${R.level} nào trong kho đề.`); return; }
    KEY = await fetch('de-thi/' + t.file).then(r => r.json());
    if ((KEY.level || t.level) !== R.level) { alert(`Đề ${t.title} là đề ${KEY.level}, lớp này học ${R.level}.`); return; }
    lsSet('omr-last', { test: tid, cls });
    const id = `s2:${tid}:${cls}`;
    S = (await idb.get(id)) || { id, test: tid, testTitle: t.title, level: R.level, cls, sheets: {}, unknown: [], writeDone: {}, comments: {}, priorities: {}, writing: {} };
    S.comments = S.comments || {}; S.writing = S.writing || {};
    document.documentElement.style.setProperty('--ruby', LV[S.level].mau);
    $('#ctx').textContent = `${t.title} · ${cls}`;
    go('scan');
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
  // ghi kết quả một phiếu; auto = đang quét tự động (không hỏi, bỏ qua phiếu trùng)
  function record(res, auto) {
    if (res.level !== S.level)
      return { cls: 'q-err', html: `Đây là phiếu <b>${esc(res.level)}</b> (${esc(pageName(res.page))}), lớp đang chấm là <b>${esc(S.level)}</b> — không ghi.`,
        short: `Phiếu ${res.level} — lớp đang chấm ${S.level}` };
    const sheet = buildSheet(res);
    const stu = res.codeOk ? stuByKey(res.code) : null;
    if (!stu) {
      const id = Date.now() + Math.random();
      S.unknown.push({ id, page: res.page, code: res.code, sheet });
      const why = res.codeOk ? `mã ${res.code} không có trong lớp ${S.cls}` : `mã tô chưa rõ (${res.code})`;
      return { cls: 'q-err', html: `${esc(pageName(res.page))}: ${esc(why)} — chọn học sinh ở mục bên dưới.`, ref: { unknown: id }, short: `${pageShort(res.page)}: ${why}` };
    }
    return assign(stu.key, res.page, sheet, auto);
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


  function buildSheet(res) {
    const sh = { page: res.page, at: Date.now(), mcq: {}, write: {}, over: {}, head: crop(res, 15, 36, 195, 106, 0.35) };
    for (const [q, m] of Object.entries(res.mcq)) {
      sh.mcq[q] = { answer: m.answer, status: m.status };
      if (m.status === 'nonstd' || m.status === 'multi')
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
    if (S.sheets[key][page] && auto)
      return { cls: 'q-err', dup: true, html: `Đã có phiếu ${esc(pageName(page))} của ${esc(stu.name)} — bỏ qua. Muốn quét lại thì xoá phiếu cũ trước.`,
        short: `Đã có ${pageShort(page)} của ${stu.name} — bỏ qua` };
    if (S.sheets[key][page] && !confirm(`Đã có phiếu ${pageName(page)} của ${stu.name}. Thay bằng phiếu mới?`))
      return { cls: 'q-err', html: `Giữ phiếu ${esc(pageName(page))} cũ của ${esc(stu.name)}.` };
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
      delete st[ref.page]; if (!Object.keys(st).length) delete S.sheets[ref.key];
    }
    renderScan(); save(); return true;
  }
  const isFlag = m => m.status === 'nonstd' || m.status === 'multi';
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
  function renderReview() {
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
      const why = it.m.status === 'multi' ? `Tô ${it.m.answer.length} ô (${it.m.answer.split('').join(', ')})` : `Tô không chuẩn ở ô ${it.m.answer}`;
      const state = !o ? '<span class="pill flag">Chưa duyệt — đang tính sai</span>'
        : o.accept ? `<span class="pill ${o.accept === k ? 'ok' : 'bad'}">Đã chấp nhận ${o.accept} → ${o.accept === k ? 'đúng' : 'sai'}</span>`
        : '<span class="pill bad">Giữ sai</span>';
      const acc = it.m.answer.split('').map(l => `<button class="btn small" data-i="${i}" data-a="${l}">Chấp nhận ${l}</button>`).join('');
      return `<div class="card ${o ? 'done' : ''}"><div class="meta"><span><b>${esc(it.s.name)}</b> · ${PAPER_SHORT[it.paper] === 'R' ? 'Reading' : 'Listening'} câu ${it.q} · đáp án ${k}</span>
        <span class="why">${why}</span></div><img src="${it.m.img}" alt="Ảnh câu ${it.q}">
        <div class="acts">${state}<button class="btn small" data-i="${i}" data-a="">Giữ sai</button>${acc}</div></div>`;
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
      <div class="wgrid">${items.map((it, i) => `<button class="wcell ${cls(it.w)}" data-i="${i}">
        <div class="who"><span>${esc(it.s.name)}</span><span>${label(it.w)}${it.w.blank ? ' · bỏ trống' : ''}</span></div>
        <img src="${it.w.img}" alt="Câu trả lời của ${esc(it.s.name)}"></button>`).join('')}</div>
      <div class="row" style="margin-top:14px"><button class="btn primary" id="wDone">${S.writeDone[curWrite] ? 'Đã xong ✓ — sang câu tiếp' : 'Xong câu này'}</button></div>`;
    $('#wBody').querySelectorAll('.wcell').forEach(b => b.onclick = () => {
      const w = items[+b.dataset.i].w, m = writeMarks(p, q, w);
      w.verdict = part ? (m === 2 ? 1 : m === 1 ? 0 : 2) : !m;
      save(); renderWrite();
    });
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
      return { q, part: info.part, type: 'write', shown: w.blank ? '' : `${marks}/${w8}`, chosen: '', marks, maxMarks: w8, ok: marks === w8, flag: false, bad: false };
    }
    const m = sh.mcq[q], o = sh.over[q], bad = isFlag(m);
    const chosen = o ? (o.accept || '') : (m.status === 'ok' ? m.answer : '');
    const ok = chosen === k;
    return { q, part: info.part, type: 'mcq', shown: bad && !o?.accept ? m.answer + '*' : chosen, chosen, marks: ok ? w8 : 0, maxMarks: w8, ok, flag: bad && !o, bad };
  }
  function results() {
    const L = lvl();
    return students().map((s, i) => {
      const st = S.sheets[s.key] || {}, r = { stt: i + 1, s, secs: {}, items: { reading: [], listening: [] }, nonstd: 0, any: !!Object.keys(st).length };
      for (const p of PAPERS) {
        const qs = Object.keys(QMAP[S.level][p]).map(Number).sort((a, b) => a - b);
        for (const q of qs) { const sh = st[QMAP[S.level][p][q].page]; r.items[p].push(sh ? gradeQ(p, q, sh) : null); }
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
      return r;
    });
  }

  // ---------- Writing (JSON từ skill chấm Writing; kiểm tra bằng viet/kiem-tra-json.js) ----------
  const WR_COLS = ['Writing điểm thô', 'Writing tối đa', 'Writing thang'];
  const writingOf = s => (S.writing || {})[s.key]?.data || null;
  const hasWriting = () => Object.keys(S.writing || {}).length > 0;
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
    if (d.test && d.test.id && d.test.id !== S.test && !confirm(`${label || 'JSON'}: test.id là "${d.test.id}" nhưng đề đang chấm là "${S.test}". Vẫn lưu?`))
      return { ok: false, html: wrBox('warn', pre + 'Đã huỷ vì khác mã đề.') };
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
      const s = stuByKey(b.dataset.wdel); if (s && confirm(`Xoá bài Writing của ${s.name}?`)) { delete S.writing[s.key]; save(); renderWritingTable(); }
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

  // ---------- kết quả & xuất file ----------
  function warnings() {
    const w = [];
    let nf = 0; for (const st of Object.values(S.sheets)) for (const sh of Object.values(st)) nf += pendingFlags(sh);
    if (nf) w.push(`${nf} câu tô không chuẩn chưa duyệt (đang tính sai).`);
    const nw = writeQs().filter(k => !S.writeDone[k] && writeItems(k).length);
    if (nw.length) w.push(`Câu viết chưa xác nhận: ${nw.map(k => PAPER_SHORT[k.split('-')[0]] + k.split('-')[1]).join(', ')} (đang dùng mặc định).`);
    if (S.unknown.length) w.push(`${S.unknown.length} phiếu chưa xác định học sinh — chưa tính vào kết quả.`);
    const inc = results().filter(r => Object.values(r.secs).some(g => g && g.incomplete)).length;
    if (inc) w.push(`${inc} học sinh còn thiếu trang phiếu (phần điểm liên quan để trống).`);
    return w;
  }
  const secCell = g => !g ? '—' : g.incomplete ? 'thiếu trang' : null;
  function renderExport() {
    renderSync();
    const w = warnings(), L = lvl();
    $('#exportWarn').innerHTML = w.length ? `<div class="notice warn">${w.map(esc).join('<br>')}</div>` : '';
    const rs = results();
    $('#resTable').innerHTML = `<thead><tr><th>STT</th><th>Mã</th><th>Họ tên</th><th>Lớp</th>${L.phan.map(s =>
      `<th>${s.ten} /${secMax(S.level, s)}</th><th>Thang</th><th>CEFR</th>`).join('')}${hasWriting() ? '<th>Writing</th><th>Writing thang</th>' : ''}<th>Tô không chuẩn</th></tr></thead><tbody>` +
      rs.map(r => `<tr class="${r.any ? '' : 'missing'}"><td class="num">${r.stt}</td><td>${esc(r.s.code)}</td>
        <td class="nm-cell"><div class="nm-in"><span>${esc(r.s.name)}</span>${r.any ? `<button class="btn small" data-rp="${r.s.key}">Phiếu</button>` : ''}</div></td>
        <td>${esc(r.s.vh)}</td>${L.phan.map(s => { const g = r.secs[s.id], t = secCell(g);
          return t ? `<td colspan="3">${t}</td>` : `<td class="num">${g.raw}</td><td class="num">${scaleText(g.scale)}</td><td>${g.cefr}</td>`; }).join('')}
        ${hasWriting() ? wrCells(r) : ''}<td class="num">${r.nonstd || ''}</td></tr>`).join('') + '</tbody>';
    $('#resTable').querySelectorAll('[data-rp]').forEach(b => b.onclick = () => studentReport(b.dataset.rp));
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
  function confirmWarn() { const w = warnings(); return !w.length || confirm('Lưu ý:\n' + w.join('\n') + '\n\nVẫn tiếp tục?'); }

  // tiêu đề cột chung cho Excel / CSV
  function exportHeader() {
    const L = lvl(), qCols = p => Object.keys(QMAP[S.level][p]).map(Number).sort((a, b) => a - b).map(q => PAPER_SHORT[p] + q);
    const secCols = sec => [`${sec.ten} /${secMax(S.level, sec)}`, `${sec.ten} thang`, `${sec.ten} CEFR`, ...partsOf(S.level, sec).map(([p, n]) => `${sec.viet} Part ${p} (/${n})`)];
    return { qCols, cols: ['STT', 'Mã HS', 'Họ tên', 'Lớp', ...qCols('reading'), ...qCols('listening'), ...L.phan.flatMap(secCols), ...(hasWriting() ? WR_COLS : []), 'Số câu tô không chuẩn', 'Ghi chú', 'Nhận xét'] };
  }
  function secVals(r) {
    return [...lvl().phan.flatMap(sec => { const g = r.secs[sec.id], ok = g && !g.incomplete, t = !g ? '' : g.incomplete ? 'thiếu trang' : '';
      return [ok ? g.raw : t, ok ? scaleText(g.scale) : '', ok ? g.cefr : '', ...partsOf(S.level, sec).map(([p]) => ok ? g.parts[p] : '')]; }),
      ...(hasWriting() ? wrVals(r) : [])];
  }
  async function exportXlsx() {
    if (!confirmWarn()) return;
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
        const row = ws.addRow([r.stt, r.s.code, r.s.name, r.s.vh, ...its.map(it => it ? cellOf(it) : ''), ...secVals(r), r.nonstd, note(r) || '', r.any ? S_comment(r) : '']);
        its.forEach((it, j) => { if (!it) return; const c = row.getCell(5 + j);
          c.fill = fill(it.flag ? YEL : it.ok ? GREEN : it.marks > 0 ? AMB : RED); c.alignment = { horizontal: 'center' }; });
        if (!r.any) row.font = { color: { argb: 'FF9AA3B1' } };
      }
      for (let j = 0; j < nQ; j++) ws.getColumn(5 + j).width = 5;
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
  }
  function exportCsv() {
    if (!confirmWarn()) return;
    const rs = results(), { cols } = exportHeader(), q = s => `"${String(s).replace(/"/g, '""')}"`;
    const lines = [cols];
    for (const r of rs) lines.push([r.stt, r.s.code, r.s.name, r.s.vh, ...[...r.items.reading, ...r.items.listening].map(it => it ? it.marks : ''),
      ...secVals(r), r.nonstd, note(r), r.any ? S_comment(r) : '']);
    download(new Blob(['\uFEFF' + lines.map(l => l.map(q).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), fname('csv'));
  }

  // ---------- nhận xét gợi ý ----------
  const fillT = (t, o) => String(t || '').replace(/\{(\w+)\}/g, (_, k) => o[k] ?? '');
  const joinList = a => a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' và ' + a[a.length - 1];
  const RANK = ['Dưới', 'A1', 'A2', 'B1', 'B2', 'C1'];
  const rank = c => RANK.indexOf(c.startsWith('Dưới') ? 'Dưới' : c);
  function suggestComment(r) {
    if (!NX) return '';
    const L = lvl(), out = [], strong = [], weak = [], lv = {}, below = [];
    const target = NX.mucTieu?.[S.level];
    for (const sec of L.phan) {
      const g = r.secs[sec.id]; if (!g || g.incomplete) continue;
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
    const items = PAPERS.flatMap(p => r.items[p]).filter(Boolean);
    if (items.some(i => i.bad)) out.push(NX.toBai);
    if (items.some(i => !i.bad && i.marks === 0 && (i.type === 'write' ? i.shown === '' : !i.chosen))) out.push(NX.boTrong);
    return out.filter(Boolean).join(' ').replace(/^./, c => c.toUpperCase());
  }
  const S_comment = r => { const c = S.comments?.[r.s.key]; return c === undefined ? suggestComment(r) : c; };

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
  function suggestPriorities(r) {
    const L = lvl(), cand = [];
    for (const sec of L.phan) {
      const g = r.secs[sec.id]; if (!g || g.incomplete) continue;
      for (const [pt, n] of partsOf(S.level, sec)) {
        const v = g.parts[pt], f = n ? v / n : 1; if (f >= 1) continue;
        const adv = NX?.loiKhuyen?.[S.level]?.[sec.id]?.[pt] || 'luyện lại dạng câu này và xem lại các câu sai';
        cand.push({ f, skill: sec.id, text: `${sec.ten} Part ${pt}: ${adv}.` });
      }
    }
    const wr = writingOf(r.s);
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
  const S_prior = r => { const p = S.priorities?.[r.s.key]; return p === undefined ? suggestPriorities(r) : p; };

  function reportModel(r) {
    const L = lvl(), T = window.PhieuTrang.THEME[S.level], wr = writingOf(r.s);
    const dates = Object.values(S.sheets[r.s.key] || {}).map(x => x.at);
    const day = dates.length ? new Date(Math.max(...dates)).toLocaleDateString('vi-VN') : '';
    const skills = [];
    for (const sec of L.phan) {
      const g = r.secs[sec.id];
      if (!g || g.incomplete) { skills.push({ id: sec.id, name: sec.ten, empty: true, scale: null, emptyNote: g ? 'Answer sheet missing' : 'No score yet', emptyVi: g ? 'Thiếu trang phiếu' : 'Chưa có bài' }); continue; }
      skills.push({ id: sec.id, name: sec.ten, raw: g.raw, max: g.max, scale: g.scale, d: null,
        parts: partsOf(S.level, sec).map(([pt, n]) => ({ name: 'Part ' + pt, v: g.parts[pt], n, d: null })) });
    }
    if (wr) skills.push({ id: 'writing', name: 'Writing', raw: wr.total.raw, max: wr.total.raw_max, scale: wr.total.cambridge_scale ?? null, est: !!wr.total.is_estimate, d: null,
      parts: wr.parts.map(p => ({ name: 'Part ' + p.part, v: p.raw, n: p.raw_max, d: null })) });
    else skills.push({ id: 'writing', name: 'Writing', empty: true, scale: null, emptyNote: 'No score yet', emptyVi: 'Chưa có bài Writing' });
    skills.push({ id: 'speaking', name: 'Speaking', empty: true, scale: null, emptyNote: 'Not graded yet', emptyVi: 'Chưa có điểm Speaking' });
    const sc = skills.filter(s => s.scale != null).map(s => s.scale);
    const ov = sc.length ? Math.round(sc.reduce((a, b) => a + b, 0) / sc.length) : null;
    const s1 = {}; skills.forEach(s => { s1[s.id] = s.scale; });
    // chẩn đoán: lấy từ dữ liệu có sẵn, không bịa
    const causes = [];
    const cand = [];
    for (const sec of L.phan) {
      const g = r.secs[sec.id]; if (!g || g.incomplete) continue;
      for (const [pt, n] of partsOf(S.level, sec)) {
        const v = g.parts[pt]; if (!n || v >= n) continue;
        const bad = g.items.filter(i => i.part === pt && !i.ok).length;
        const adv = NX?.loiKhuyen?.[S.level]?.[sec.id]?.[pt];
        cand.push({ f: v / n, c: { skill: sec.id, title: `Mất điểm ở ${sec.ten} Part ${pt}`, body: `Em được ${v}/${n} điểm ở Part này, có ${bad} câu cần xem lại.`, fix: cap1(adv || 'xem lại các câu sai và đối chiếu đáp án') + '.' } });
      }
    }
    cand.sort((a, b) => a.f - b.f).slice(0, 2).forEach(x => causes.push(x.c));
    if (wr) {
      const crit = wr.parts.flatMap(p => p.criteria.map(c => ({ c, p }))).sort((a, b) => a.c.band / a.c.max - b.c.band / b.c.max)[0];
      if (crit && crit.c.band < crit.c.max) causes.push({ skill: 'writing', title: `Writing: cần cải thiện ${CRIT_VI[crit.c.id] || crit.c.id}`, body: clip(crit.c.comment, 160), fix: clip(crit.c.to_move_up || crit.c.key_takeaway, 120) });
    }
    if (r.nonstd) causes.push({ title: 'Tô đáp án chưa đúng cách', body: `${r.nonstd} câu bị tô chưa đúng cách (tick, dấu X, tô không kín hoặc tô 2 ô) nên bị tính sai.`, fix: 'Tô kín một ô tròn cho mỗi câu.' });
    if (!causes.length) causes.push({ title: 'Kết quả rất tốt', body: 'Em không mất điểm đáng kể ở các phần đã chấm.', fix: 'Tiếp tục luyện tập đều đặn mỗi tuần.' });
    const gc = {}; (wr ? wr.parts : []).forEach(p => (p.errors || []).forEach(e => { gc[e.group] = (gc[e.group] || 0) + 1; }));
    const writingGroups = Object.keys(gc).length ? Object.entries(gc).sort((a, b) => b[1] - a[1]).map(([g, n]) => ({ ten: (GROUP_VI[g] || [g])[0], n, mau: (GROUP_VI[g] || [0, '#E3E7ED'])[1], note: '' }))
      : [{ ten: wr ? 'No errors listed' : 'No Writing result yet', n: '', mau: '#E3E7ED', note: wr ? 'Không có lỗi được liệt kê' : 'Chưa có bài Writing' }];
    const habits = [];
    for (const p of PAPERS) {
      const nb = r.items[p].filter(i => i && !i.bad && i.marks === 0 && (i.type === 'write' ? i.shown === '' : !i.chosen)).length;
      if (nb) habits.push(`Có ${nb} câu ${cap1(p)} bỏ trống.`);
    }
    if (r.nonstd) habits.push(`Có ${r.nonstd} câu tô chưa đúng cách.`); else habits.push('Tô đáp án rõ ràng, không có câu tô sai cách.');
    const wrong = [];
    for (const sec of L.phan) {
      const g = r.secs[sec.id]; if (!g || g.incomplete) continue;
      const items = g.items.filter(i => !i.ok).map(i => {
        const key = [].concat(KEY[sec.giay][i.q]).join(' / ');
        const what = i.type === 'write' ? (i.shown === '' ? 'blank' : i.marks > 0 ? `${i.marks}/${i.maxMarks}` : 'incorrect') : (i.bad && !i.chosen ? 'mark unclear' : (i.chosen || 'blank'));
        return `Q${i.q}: ${what}, ${key}`;
      });
      const shown = items.slice(0, 18); if (items.length > 18) shown.push(`+${items.length - 18} more`);
      wrong.push({ skill: sec.id, name: sec.ten, items: shown.length ? shown : ['No wrong answers'] });
    }
    const m = {
      first: true, level: S.level, exam: S.testTitle, date: day,
      student: { name: r.s.name, id: r.s.code, cls: r.s.vh },
      skills, overall: { scale: ov, d: null, partial: sc.length < skills.length },
      history: [{ label: 'Mock 1', s: s1, overall: ov }],
      comment: clip(S_comment(r), LIMIT_CM), priorities: S_prior(r).map(x => clip(x, LIMIT_PR)),
      diagnosis: { causes: causes.slice(0, 4), writingGroups, habits, wrong }
    };
    return m;
  }
  function reportPages(r) {
    const PT = window.PhieuTrang, WR = window.WritingReport, L = lvl();
    if (!PT || !WR) return [reportHTML(r)];   // dự phòng: phiếu 1 trang cũ nếu thiếu file viet/phieu-trang.js
    const m = reportModel(r), wr = writingOf(r.s), nW = wr ? wr.parts.length : 0, T = PT.THEME[S.level];
    m.totalPages = 2 + nW;
    const pages = [PT.overview(m), PT.diagnosis(m)];
    for (let i = 0; i < nW; i++) pages.push(WR.partPage(wr, i, { mau: T.a, dark: T.d, soft: T.soft, tenCapDo: L.ten.toUpperCase(), trang: 3 + i, total: m.totalPages }));
    return pages;
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
  const loadScript = src => new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) return res();
    const s = document.createElement('script'); s.src = src; s.onload = res;
    s.onerror = () => rej(new Error('Không tải được thư viện tạo phiếu — kiểm tra kết nối mạng.'));
    document.head.appendChild(s);
  });
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
        const key = [].concat(KEY[sec.giay][i.q]).join(' / ');
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
    if (!again && !confirmWarn()) return;
    const r = results().find(x => x.s.key === key); if (!r) return;
    $('#reportComment').value = S_comment(r);
    $('#reportPriorities').value = S_prior(r).join('\n');
    $('#reportComment').oninput = $('#reportPriorities').oninput = updateCounts; updateCounts();
    $('#reportSuggest').onclick = () => { $('#reportComment').value = suggestComment(r); $('#reportPriorities').value = suggestPriorities(r).join('\n'); updateCounts(); };
    $('#reportUpdate').onclick = () => { S.comments[key] = $('#reportComment').value.trim(); (S.priorities ||= {})[key] = lines($('#reportPriorities').value); save(); studentReport(key, true); };
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
      $('#reportPdf').onclick = () => { const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' }); canvases.forEach((c, i) => addPage(pdf, c, i === 0)); download(pdf.output('blob'), base + '.pdf'); };
      const canShare = !!(navigator.canShare && navigator.canShare({ files }));
      $('#reportShare').hidden = !canShare;
      $('#reportShare').onclick = () => navigator.share({ files, title: `Phiếu kết quả — ${r.s.name}` }).catch(() => {});
      $('#reportModal').hidden = false;
    } catch (e) { alert(e.message || e); }
    finally { busy(''); $('#reportStage').innerHTML = ''; }
  }
  async function classReport() {
    const rs = results().filter(r => r.any);
    if (!rs.length) { alert('Chưa có phiếu nào để tạo phiếu kết quả.'); return; }
    if (!confirmWarn()) return;
    busy('Đang chuẩn bị…');
    try {
      await ensureLibs();
      const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
      let first = true;
      for (let i = 0; i < rs.length; i++) { busy(`Đang tạo phiếu ${i + 1}/${rs.length}…`); for (const cv of await renderReportCanvases(rs[i])) { addPage(pdf, cv, first); first = false; } }
      const name = `phieu-ket-qua_${slug(S.testTitle)}_${slug(S.cls)}.pdf`, blob = pdf.output('blob');
      const file = new File([blob], name, { type: 'application/pdf' });
      busy('');
      if (navigator.canShare && navigator.canShare({ files: [file] }) && confirm(`Đã tạo ${rs.length} phiếu. Bấm OK để gửi qua Zalo / ứng dụng khác, hoặc Huỷ để tải file về máy.`))
        navigator.share({ files: [file], title: name }).catch(() => download(blob, name));
      else download(blob, name);
    } catch (e) { alert(e.message || e); }
    finally { busy(''); $('#reportStage').innerHTML = ''; }
  }

  async function clearSession() {
    if (!confirm(`Xoá toàn bộ phiếu đã chụp của ${S.testTitle} – ${S.cls}? Không thể hoàn tác.`)) return;
    await idb.del(S.id);
    S = { id: S.id, test: S.test, testTitle: S.testTitle, level: S.level, cls: S.cls, sheets: {}, unknown: [], writeDone: {}, comments: {}, priorities: {}, writing: {} };
    go('scan');
  }

  window.__PET = { get S() { return S; }, results };
  boot().catch(e => { $('#loading').hidden = true; alert('Không tải được cấu hình app: ' + e.message); });
})();
