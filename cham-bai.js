/* cham-bai.js — app chấm phiếu PET (Ruby School) */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const APP_VERSION = '25/09/2026 (b) — phiếu kết quả có nhận xét gợi ý';
  const PAGES = { reading: { n: 32, short: 'R', name: 'Reading' }, listening: { n: 25, short: 'L', name: 'Listening' } };

  let TPL, SCALE, CFG = {}, TESTS = [], KEY = null, NX = null, cvReady = false;
  let S = null;            // phiên chấm hiện tại
  let curWrite = null;     // câu viết đang xem, ví dụ 'reading-27'

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
  let saveTimer, S_comment;
  const save = (dirty = true) => {
    if (!S) return;
    if (dirty) S.dirty = true;
    const snap = S;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => idb.set(snap.id, snap).catch(() => alert('Không lưu được kết quả trên máy (bộ nhớ trình duyệt đầy?).')), 300);
    if (dirty) scheduleSync();
  };

  // ---------- khởi động ----------
  async function boot() {
    [TPL, SCALE, TESTS] = await Promise.all(['omr-template.json', 'thang-diem.json', 'de-thi/manifest.json']
      .map(f => fetch(f).then(r => { if (!r.ok) throw new Error(f); return r.json(); })));
    NX = await fetch('nhan-xet-mau.json').then(r => r.ok ? r.json() : null).catch(() => null);
    CFG = await fetch('cau-hinh.json').then(r => r.ok ? r.json() : {}).catch(() => ({}));
    const hasSheet = /^https:\/\/script\.google\.com\//.test(CFG.sheetUrl || '');
    CFG.on = hasSheet;
    $('#sheetBox').hidden = !hasSheet; $('#fileBox').open = !hasSheet;
    $('#tCode').value = lsGet('pet-tcode', '');
    $('#btnSync').onclick = () => fetchRosters(true);
    if (hasSheet && $('#tCode').value) fetchRosters(false);
    else if (hasSheet) $('#syncInfo').textContent = 'Nhập mã giáo viên rồi bấm "Cập nhật danh sách lớp".';
    $('#selTest').innerHTML = TESTS.map(t => `<option value="${esc(t.id)}">${esc(t.title)}</option>`).join('');
    const last = lsGet('pet-last', {});
    if (last.test) $('#selTest').value = last.test;
    fillClasses(last.cls);
    document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
    $('#fileRoster').onchange = e => loadRoster(e.target.files[0]).finally(() => e.target.value = '');
    $('#btnStart').onclick = start;
    $('#fileCam').onchange = e => { handleFiles([...e.target.files]); e.target.value = ''; };
    $('#fileMany').onchange = e => { handleFiles([...e.target.files]); e.target.value = ''; };
    $('#btnXlsx').onclick = exportXlsx; $('#btnCsv').onclick = exportCsv;
    $('#btnClassReport').onclick = classReport; $('#reportClose').onclick = () => $('#reportModal').hidden = true;
    $('#appVersion').textContent = 'Phiên bản app: ' + APP_VERSION;
    $('#btnClear').onclick = clearSession;
    $('#btnScan').onclick = startScanner; $('#scanStop').onclick = stopScanner;
    document.addEventListener('visibilitychange', () => { if (document.hidden && cam.running) stopScanner(); });
    go('setup');
    waitCv();
  }
  function waitCv() {
    const t = setInterval(() => {
      if (window.cv && window.cv.Mat) { clearInterval(t); cvReady = true; $('#loading').hidden = true; }
    }, 200);
    setTimeout(() => { if (!cvReady) $('#loadingMsg').textContent = 'Bộ nhận dạng tải chậm — kiểm tra kết nối mạng. Có thể tiếp tục chọn đề và lớp.'; $('#loading').hidden = true; }, 20000);
  }

  function go(v) {
    if (v !== 'setup' && !S) v = 'setup';
    document.querySelectorAll('section.view').forEach(s => s.classList.toggle('on', s.id === 'v-' + v));
    document.querySelectorAll('[data-go]').forEach(b => b.setAttribute('aria-current', b.dataset.go === v));
    $('#dock').hidden = v !== 'scan';
    ({ scan: renderScan, review: renderReview, write: renderWrite, export: renderExport })[v]?.();
    window.scrollTo(0, 0);
  }

  // ---------- danh sách lớp ----------
  const rosters = () => lsGet('pet-rosters', {});
  function fillClasses(sel) {
    const r = rosters(), ids = Object.keys(r).sort();
    $('#selClass').innerHTML = ids.length ? ids.map(c => `<option value="${c}">Lớp ${c} (${r[c].length} học sinh)</option>`).join('')
      : '<option value="">Chưa có danh sách — tải file bên dưới</option>';
    if (sel && r[sel]) $('#selClass').value = sel;
    $('#rosterList').innerHTML = ids.map(c => `<div><span><b>Lớp ${c}</b> · ${r[c].length} học sinh</span>
      <button class="btn small danger" data-delcls="${c}">Xoá</button></div>`).join('');
    $('#rosterList').querySelectorAll('[data-delcls]').forEach(b => b.onclick = () => deleteRoster(b.dataset.delcls));
  }
  function deleteRoster(c) {
    const all = rosters();
    if (!confirm(`Xoá danh sách lớp ${c} (${all[c].length} học sinh) khỏi máy này?\nKết quả chấm đã lưu của lớp này vẫn được giữ; nạp lại danh sách là xem tiếp được.`)) return;
    delete all[c]; lsSet('pet-rosters', all); fillClasses($('#selClass').value);
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
    const out = {}; let n = 0;
    for (const r of rows) {
      const code = (r[0] || '').toUpperCase().replace(/\s/g, '');
      if (!/^\d{5}/.test(code)) continue;                 // bỏ dòng tiêu đề / dòng trống
      const cls = code.slice(0, 2);
      (out[cls] = out[cls] || []).push({ code, key: code.slice(0, 5), name: r[1] || '' });
      n++;
    }
    if (!n) { alert('Không đọc được mã học sinh nào. File cần cột đầu là Mã (vd 72001ND), cột thứ hai là Họ tên.'); return; }
    const all = rosters();
    for (const [c, list] of Object.entries(out)) {
      const dup = list.map(s => s.key).filter((k, i, a) => a.indexOf(k) !== i);
      if (dup.length) alert(`Lớp ${c}: trùng mã ${[...new Set(dup)].join(', ')} — kiểm tra lại file.`);
      all[c] = list.sort((a, b) => a.key.localeCompare(b.key));
    }
    lsSet('pet-rosters', all);
    fillClasses(Object.keys(out)[0]);
    alert(`Đã cập nhật ${n} học sinh: ${Object.entries(out).map(([c, l]) => `lớp ${c} (${l.length})`).join(', ')}.`);
  }

  // ---------- Google Sheet: danh sách lớp + sao lưu kết quả ----------
  async function fetchRosters(loud) {
    const code = $('#tCode').value.trim();
    if (!code) { $('#syncInfo').textContent = 'Nhập mã giáo viên trước.'; return; }
    $('#syncInfo').textContent = 'Đang lấy danh sách lớp…'; $('#btnSync').disabled = true;
    try {
      const r = await fetch(`${CFG.sheetUrl}?action=classes&code=${encodeURIComponent(code)}`).then(x => x.json());
      if (!r.ok) { $('#syncInfo').textContent = r.error || 'Google Sheet từ chối yêu cầu.'; if (loud) alert(r.error); return; }
      lsSet('pet-tcode', code);
      const all = rosters();
      for (const [c, list] of Object.entries(r.classes))
        all[c] = list.map(s => ({ code: s.code, key: s.code.slice(0, 5), name: s.name })).sort((a, b) => a.key.localeCompare(b.key));
      lsSet('pet-rosters', all); lsSet('pet-roster-at', new Date().toISOString());
      fillClasses($('#selClass').value || lsGet('pet-last', {}).cls);
      const ids = Object.keys(r.classes);
      $('#syncInfo').textContent = ids.length ? `✓ Đã cập nhật lúc ${hhmm()}: ${ids.map(c => `lớp ${c} (${r.classes[c].length})`).join(', ')}.`
        : 'Google Sheet chưa có tab danh sách nào (tên tab dạng "DS 72").';
    } catch (e) {
      const at = lsGet('pet-roster-at', null);
      $('#syncInfo').textContent = 'Không kết nối được Google Sheet.' + (at ? ' Đang dùng danh sách đã lưu trên máy.' : '');
      if (loud) alert('Không kết nối được Google Sheet. Kiểm tra mạng, hoặc dùng mục "Dự phòng" để tải danh sách từ file.');
    } finally { $('#btnSync').disabled = false; }
  }
  const hhmm = (d = new Date()) => d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  let syncTimer, syncing = false;
  function scheduleSync() {
    if (!CFG.on || !lsGet('pet-tcode', '')) return;
    clearTimeout(syncTimer); syncTimer = setTimeout(() => pushResults(false), 6000);
  }
  function sheetRows() {
    const P = partsOf;
    const header = ['Đề', 'Lớp', 'Mã HS', 'Họ tên',
      'Reading /32', 'Reading thang', 'Reading CEFR', ...P('reading').map(([p, n]) => `R Part ${p} (/${n})`),
      'Listening /25', 'Listening thang', 'Listening CEFR', ...P('listening').map(([p, n]) => `L Part ${p} (/${n})`),
      'Số câu tô không chuẩn', 'Ghi chú', 'Nhận xét', 'Chi tiết Reading', 'Chi tiết Listening'];
    const rows = results().filter(r => r.reading || r.listening).map(r => {
      const o = { 'Khoá': `${S.test}|${S.cls}|${r.s.code}`, 'Đề': S.testTitle, 'Lớp': S.cls, 'Mã HS': r.s.code, 'Họ tên': r.s.name };
      for (const p of ['reading', 'listening']) {
        const g = r[p], N = PAGES[p].name, sh = PAGES[p].short;
        o[`${N} /${PAGES[p].n}`] = g ? g.raw : ''; o[`${N} thang`] = g ? scaleText(g.scale) : ''; o[`${N} CEFR`] = g ? g.cefr : '';
        P(p).forEach(([pt, n]) => o[`${sh} Part ${pt} (/${n})`] = g ? g.parts[pt] : '');
        o[`Chi tiết ${N}`] = g ? g.items.map(i => `${i.q}${i.type === 'write' ? '' : (i.chosen || '-')}${i.ok ? '✓' : '✗'}`).join(' ') : '';
      }
      o['Số câu tô không chuẩn'] = (r.reading?.nonstd || 0) + (r.listening?.nonstd || 0);
      o['Ghi chú'] = note(r);
      o['Nhận xét'] = S_comment(r);
      return o;
    });
    return { header, rows };
  }
  async function pushResults(loud) {
    if (!CFG.on || syncing || !S) return;
    const code = lsGet('pet-tcode', '');
    if (!code) { if (loud) alert('Chưa có mã giáo viên. Nhập ở bước 1 để sao lưu lên Google Sheet.'); return; }
    const { header, rows } = sheetRows();
    if (!rows.length) { if (loud) alert('Chưa có phiếu nào để sao lưu.'); return; }
    syncing = true; renderSync('Đang sao lưu…');
    try {
      const r = await fetch(CFG.sheetUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'results', code, header, rows }) }).then(x => x.json());
      if (!r.ok) throw new Error(r.error || 'Google Sheet từ chối');
      S.dirty = false; S.syncedAt = new Date().toISOString(); save(false);
    } catch (e) {
      S.syncError = String(e.message || e);
      if (loud) alert('Chưa sao lưu được: ' + S.syncError + '\nKết quả vẫn lưu trên máy; app sẽ thử lại khi có thay đổi.');
    } finally { syncing = false; renderSync(); }
  }
  function renderSync(msg) {
    const el = $('#syncStatus'); if (!el) return;
    if (!CFG.on || !S) { el.hidden = true; return; }
    el.hidden = false;
    const txt = msg || (!lsGet('pet-tcode', '') ? 'Chưa nhập mã giáo viên — kết quả chỉ lưu trên máy này.'
      : !S.dirty && S.syncedAt ? `☁️ Đã sao lưu lên Google Sheet lúc ${hhmm(new Date(S.syncedAt))}.`
      : S.syncedAt ? `Có thay đổi chưa sao lưu (lần trước: ${hhmm(new Date(S.syncedAt))}).` : 'Chưa sao lưu lên Google Sheet.');
    el.innerHTML = `<span>${esc(txt)}</span>${msg ? '' : '<button class="btn small" id="btnPush">Sao lưu ngay</button>'}`;
    const b = $('#btnPush'); if (b) b.onclick = () => pushResults(true);
  }

  // ---------- phiên chấm ----------
  async function start() {
    const tid = $('#selTest').value, cls = $('#selClass').value;
    if (!cls) { alert('Hãy tải danh sách lớp trước.'); return; }
    const t = TESTS.find(x => x.id === tid);
    KEY = await fetch('de-thi/' + t.file).then(r => r.json());
    lsSet('pet-last', { test: tid, cls });
    const id = `session:${tid}:${cls}`;
    S = (await idb.get(id)) || { id, test: tid, testTitle: t.title, cls, sheets: {}, unknown: [], writeDone: {} };
    $('#ctx').textContent = `${t.title} · Lớp ${cls}`;
    go('scan');
  }
  const students = () => rosters()[S.cls] || [];
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

  // ghi kết quả một phiếu đã đọc; auto = đang quét tự động (không hỏi, bỏ qua phiếu trùng)
  function record(res, auto) {
    const sheet = buildSheet(res);
    const stu = res.codeOk ? stuByKey(res.code) : null;
    if (!stu) {
      const id = Date.now() + Math.random();
      S.unknown.push({ id, page: res.page, code: res.code, sheet });
      const why = res.codeOk ? `mã ${res.code} không có trong lớp ${S.cls}` : `mã tô chưa rõ (${res.code})`;
      return { cls: 'q-err', html: `${PAGES[res.page].name}: ${esc(why)} — chọn học sinh ở mục bên dưới.`, ref: { unknown: id }, short: `${PAGES[res.page].name}: ${why}` };
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
    const sh = { page: res.page, at: Date.now(), mcq: {}, write: {}, over: {},
      head: crop(res, 15, 36, 195, 106, 0.35) };
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
      return { cls: 'q-err', dup: true, html: `Đã có phiếu ${PAGES[page].name} của ${esc(stu.name)} — bỏ qua. Muốn quét lại thì xoá phiếu cũ trước.`,
        short: `Đã có phiếu ${PAGES[page].name} của ${stu.name} — bỏ qua` };
    if (S.sheets[key][page] && !confirm(`Đã có phiếu ${PAGES[page].name} của ${stu.name}. Thay bằng phiếu mới?`))
      return { cls: 'q-err', html: `Giữ phiếu ${PAGES[page].name} cũ của ${esc(stu.name)}.` };
    S.sheets[key][page] = sheet;
    Object.keys(S.writeDone).filter(k => k.startsWith(page)).forEach(k => delete S.writeDone[k]);
    const nf = flagCount(sheet);
    return { cls: nf ? 'q-flag' : 'q-ok', ref: { key, page, at: sheet.at }, ok: true,
      short: `✓ ${stu.name} — ${PAGES[page].name}${nf ? ` · ${nf} câu cần duyệt` : ''}`,
      html: `<b>${esc(stu.name)}</b> (${stu.code}) — ${PAGES[page].name}${nf ? ` · ${nf} câu cần duyệt` : ' · đọc tốt'}` };
  }

  // xoá một phiếu vừa tải (chỉ xoá đúng phiếu đó, không xoá phiếu mới hơn đã thay thế nó)
  function removeRef(ref) {
    if (ref.unknown) {
      const n = S.unknown.length; S.unknown = S.unknown.filter(u => u.id !== ref.unknown);
      if (S.unknown.length === n) { alert('Phiếu này đã được gán cho học sinh hoặc đã xoá.'); return false; }
    } else {
      const st = S.sheets[ref.key], stu = stuByKey(ref.key);
      if (!st?.[ref.page] || st[ref.page].at !== ref.at) { alert('Phiếu này đã được thay bằng phiếu khác hoặc đã xoá.'); return false; }
      if (!confirm(`Xoá phiếu ${PAGES[ref.page].name} của ${stu ? stu.name : ref.key}?`)) return false;
      delete st[ref.page]; if (!Object.keys(st).length) delete S.sheets[ref.key];
    }
    renderScan(); save(); return true;
  }
  const flagCount = sh => Object.values(sh.mcq).filter(m => m.status === 'nonstd' || m.status === 'multi').length;
  const pendingFlags = sh => Object.entries(sh.mcq).filter(([q, m]) => (m.status === 'nonstd' || m.status === 'multi') && !sh.over[q]).length;


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
    const list = students();
    $('#roster').innerHTML = list.length ? list.map(s => {
      const sh = S.sheets[s.key] || {};
      const half = p => { const x = sh[p]; if (!x) return `<span>${PAGES[p].short}</span>`;
        const nf = pendingFlags(x);
        return `<button class="${nf ? 's-flag' : 's-done'}" data-del="${s.key}|${p}" title="Xoá phiếu ${PAGES[p].name}">
          ${PAGES[p].short}${nf ? ' · ' + nf : ' ✓'}<i aria-hidden="true">✕</i></button>`; };
      return `<div class="stu"><div class="nm">${esc(s.name)}</div><div class="cd">${s.code}</div>
        <div class="halves">${half('reading')}${half('listening')}</div></div>`;
    }).join('') : '<div class="empty">Lớp này chưa có học sinh.</div>';
    $('#roster').querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      const [key, page] = b.dataset.del.split('|');
      removeRef({ key, page, at: S.sheets[key][page].at });
    });
  }
  function renderUnknown() {
    const box = $('#unknownBox');
    if (!S.unknown.length) { box.innerHTML = ''; return; }
    const opts = students().map(s => `<option value="${s.key}">${s.key} · ${esc(s.name)}</option>`).join('');
    box.innerHTML = `<div class="notice err">Có ${S.unknown.length} phiếu chưa xác định được học sinh. Xem tên viết tay trên ảnh rồi chọn học sinh.</div>` +
      S.unknown.map(u => `<div class="card"><div class="meta"><span><b>${PAGES[u.page].name}</b> · mã đọc được: ${esc(u.code)}</span></div>
        <img src="${u.sheet.head}" alt="Phần đầu phiếu">
        <div class="acts"><select data-u="${u.id}"><option value="">Chọn học sinh…</option>${opts}</select>
        <button class="btn small" data-udel="${u.id}">Bỏ phiếu này</button></div></div>`).join('');
    box.querySelectorAll('select[data-u]').forEach(sel => sel.onchange = () => {
      if (!sel.value) return;
      const u = S.unknown.find(x => String(x.id) === sel.dataset.u);
      const r = assign(sel.value, u.page, u.sheet);
      if (r.cls !== 'q-err' || !/Giữ phiếu/.test(r.html)) S.unknown = S.unknown.filter(x => x !== u);
      renderScan(); save();
    });
    box.querySelectorAll('[data-udel]').forEach(b => b.onclick = () => {
      S.unknown = S.unknown.filter(x => String(x.id) !== b.dataset.udel); renderScan(); save();
    });
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
    for (const s of students()) for (const p of ['reading', 'listening']) {
      const sh = S.sheets[s.key]?.[p]; if (!sh) continue;
      for (const [q, m] of Object.entries(sh.mcq)) if (m.status === 'nonstd' || m.status === 'multi') items.push({ s, p, q, m, sh });
    }
    if (!items.length) { $('#reviewList').innerHTML = '<div class="empty">Không có câu nào cần duyệt.</div>'; return; }
    items.sort((a, b) => !!a.sh.over[a.q] - !!b.sh.over[b.q]);
    $('#reviewList').innerHTML = items.map((it, i) => {
      const o = it.sh.over[it.q], k = KEY[it.p][it.q];
      const why = it.m.status === 'multi' ? `Tô ${it.m.answer.length} ô (${it.m.answer.split('').join(', ')})` : `Tô không chuẩn ở ô ${it.m.answer}`;
      const state = !o ? '<span class="pill flag">Chưa duyệt — đang tính sai</span>'
        : o.accept ? `<span class="pill ${o.accept === k ? 'ok' : 'bad'}">Đã chấp nhận ${o.accept} → ${o.accept === k ? 'đúng' : 'sai'}</span>`
        : '<span class="pill bad">Giữ sai</span>';
      const acc = it.m.answer.split('').map(l => `<button class="btn small" data-i="${i}" data-a="${l}">Chấp nhận ${l}</button>`).join('');
      return `<div class="card ${o ? 'done' : ''}"><div class="meta"><span><b>${esc(it.s.name)}</b> · ${PAGES[it.p].name} câu ${it.q} · đáp án ${k}</span>
        <span class="why">${why}</span></div><img src="${it.m.img}" alt="Ảnh câu ${it.q}">
        <div class="acts">${state}<button class="btn small" data-i="${i}" data-a="">Giữ sai</button>${acc}</div></div>`;
    }).join('');
    $('#reviewList').querySelectorAll('[data-i]').forEach(b => b.onclick = () => {
      const it = items[+b.dataset.i]; it.sh.over[it.q] = { accept: b.dataset.a || null };
      save(); updateBadges(); renderReview();
    });
  }

  // ---------- câu viết ----------
  function writeQs() {
    const out = [];
    for (const p of ['reading', 'listening']) for (const [q, v] of Object.entries(KEY[p])) if (Array.isArray(v)) out.push(`${p}-${q}`);
    return out;
  }
  function writeItems(k) {
    const [p, q] = k.split('-');
    return students().filter(s => S.sheets[s.key]?.[p]).map(s => ({ s, w: S.sheets[s.key][p].write[q] }));
  }
  const verdict = w => w.verdict ?? !w.blank;
  function renderWrite() {
    const qs = writeQs();
    if (!curWrite || !qs.includes(curWrite)) curWrite = qs.find(k => !S.writeDone[k] && writeItems(k).length) || qs[0];
    $('#wChips').innerHTML = qs.map(k => { const [p, q] = k.split('-');
      return `<button data-k="${k}" class="${k === curWrite ? 'cur' : ''} ${S.writeDone[k] ? 'fin' : ''}">${PAGES[p].short}${q}</button>`; }).join('');
    $('#wChips').querySelectorAll('button').forEach(b => b.onclick = () => { curWrite = b.dataset.k; renderWrite(); });
    const [p, q] = curWrite.split('-'), items = writeItems(curWrite);
    if (!items.length) { $('#wBody').innerHTML = `<div class="empty">Chưa có phiếu ${PAGES[p].name} nào.</div>`; return; }
    $('#wBody').innerHTML = `<div class="keyline">${PAGES[p].name} câu ${q} — đáp án: <b>${KEY[p][q].map(esc).join(' / ')}</b></div>
      <div class="wgrid">${items.map((it, i) => `<button class="wcell ${verdict(it.w) ? '' : 'no'}" data-i="${i}">
        <div class="who"><span>${esc(it.s.name)}</span><span>${verdict(it.w) ? 'Đúng' : 'Sai'}${it.w.blank ? ' · bỏ trống' : ''}</span></div>
        <img src="${it.w.img}" alt="Câu trả lời của ${esc(it.s.name)}"></button>`).join('')}</div>
      <div class="row" style="margin-top:14px"><button class="btn primary" id="wDone">${S.writeDone[curWrite] ? 'Đã xong ✓ — sang câu tiếp' : 'Xong câu này'}</button></div>`;
    $('#wBody').querySelectorAll('.wcell').forEach(b => b.onclick = () => {
      const w = items[+b.dataset.i].w; w.verdict = !verdict(w); save(); renderWrite();
    });
    $('#wDone').onclick = () => {
      S.writeDone[curWrite] = true; save(); updateBadges();
      const next = qs.find(k => !S.writeDone[k] && writeItems(k).length);
      if (next) curWrite = next; renderWrite();
    };
  }

  // ---------- chấm điểm ----------
  const partOfQ = {};
  function partsOf(p) {
    const cnt = {};
    TPL[p].questions.forEach(q => { partOfQ[p + q.q] = q.part; cnt[q.part] = (cnt[q.part] || 0) + 1; });
    return Object.entries(cnt).map(([k, n]) => [+k, n]).sort((a, b) => a[0] - b[0]);
  }
  function gradePage(p, sh) {
    const K = KEY[p], items = [];
    let raw = 0, nonstd = 0;
    const parts = Object.fromEntries(partsOf(p).map(([k]) => [k, 0]));
    for (let n = 1; n <= PAGES[p].n; n++) {
      const q = String(n), k = K[q];
      if (Array.isArray(k)) {
        const w = sh.write[q], ok = verdict(w);
        items.push({ q, type: 'write', shown: w.blank ? '' : (ok ? '✓' : '✗'), ok, flag: false });
        raw += ok; parts[partOfQ[p + q]] += ok;
      } else {
        const m = sh.mcq[q], o = sh.over[q], bad = m.status === 'nonstd' || m.status === 'multi';
        if (bad) nonstd++;
        const chosen = o ? (o.accept || '') : (m.status === 'ok' ? m.answer : '');
        const ok = chosen === k;
        items.push({ q, type: 'mcq', shown: bad && !o?.accept ? m.answer + '*' : chosen, chosen, ok, flag: bad && !o, bad });
        raw += ok; parts[partOfQ[p + q]] += ok;
      }
    }
    const scale = toScale(raw, SCALE[p]);
    return { items, raw, scale, cefr: cefr(scale), nonstd, parts };
  }
  function toScale(raw, anchors) {
    const a = [...anchors].sort((x, y) => y[0] - x[0]);
    if (raw >= a[0][0]) return a[0][1];
    for (let i = 0; i < a.length - 1; i++) if (raw <= a[i][0] && raw >= a[i + 1][0])
      return Math.round(a[i + 1][1] + (raw - a[i + 1][0]) * (a[i][1] - a[i + 1][1]) / (a[i][0] - a[i + 1][0]));
    return null;
  }
  function cefr(sc) { if (sc == null) return 'Dưới A2'; for (const [m, l] of SCALE.cefr) if (sc >= m) return l; return 'Dưới A2'; }
  const scaleText = sc => sc == null ? 'Dưới 120' : sc;

  function results() {
    return students().map((s, i) => {
      const r = { stt: i + 1, s };
      for (const p of ['reading', 'listening']) { const sh = S.sheets[s.key]?.[p]; r[p] = sh ? gradePage(p, sh) : null; }
      return r;
    });
  }

  // ---------- kết quả ----------
  function warnings() {
    const w = [];
    let nf = 0; for (const st of Object.values(S.sheets)) for (const sh of Object.values(st)) nf += pendingFlags(sh);
    if (nf) w.push(`${nf} câu tô không chuẩn chưa duyệt (đang tính sai).`);
    const nw = writeQs().filter(k => !S.writeDone[k] && writeItems(k).length);
    if (nw.length) w.push(`Câu viết chưa xác nhận: ${nw.map(k => PAGES[k.split('-')[0]].short + k.split('-')[1]).join(', ')} (đang dùng mặc định).`);
    if (S.unknown.length) w.push(`${S.unknown.length} phiếu chưa xác định học sinh — chưa tính vào kết quả.`);
    return w;
  }
  function renderExport() {
    renderSync();
    const w = warnings();
    $('#exportWarn').innerHTML = w.length ? `<div class="notice warn">${w.map(esc).join('<br>')}</div>` : '';
    const rs = results();
    $('#resTable').innerHTML = `<thead><tr><th>STT</th><th>Mã</th><th>Họ tên</th><th>Reading /32</th><th>Thang</th><th>CEFR</th>
      <th>Listening /25</th><th>Thang</th><th>CEFR</th><th>Tô không chuẩn</th></tr></thead><tbody>` +
      rs.map(r => { const R = r.reading, L = r.listening, miss = !R && !L;
        const c = (g, n) => g ? `<td class="num">${g.raw}</td><td class="num">${scaleText(g.scale)}</td><td>${g.cefr}</td>` : '<td>—</td><td>—</td><td>—</td>';
        return `<tr class="${miss ? 'missing' : ''}"><td class="num">${r.stt}</td><td>${r.s.code}</td>
          <td class="nm-cell"><div class="nm-in"><span>${esc(r.s.name)}</span>${miss ? '' : `<button class="btn small" data-rp="${r.s.key}">Phiếu</button>`}</div></td>${c(R)}${c(L)}
          <td class="num">${(R?.nonstd || 0) + (L?.nonstd || 0) || ''}</td></tr>`; }).join('') + '</tbody>';
    $('#resTable').querySelectorAll('[data-rp]').forEach(b => b.onclick = () => studentReport(b.dataset.rp));
  }

  function note(r) {
    const n = [];
    if (!r.reading) n.push('Chưa có bài Reading'); if (!r.listening) n.push('Chưa có bài Listening');
    const fl = ['reading', 'listening'].flatMap(p => r[p] ? r[p].items.filter(i => i.flag).map(i => PAGES[p].short + i.q) : []);
    if (fl.length) n.push('Chưa duyệt: ' + fl.join(', '));
    return n.join('; ');
  }
  const fname = ext => `ket-qua_${S.testTitle.replace(/\s+/g, '')}_lop${S.cls}_${new Date().toISOString().slice(0, 10)}.${ext}`;
  function download(blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function confirmWarn() { const w = warnings(); return !w.length || confirm('Lưu ý:\n' + w.join('\n') + '\n\nVẫn xuất file?'); }

  async function exportXlsx() {
    if (!confirmWarn()) return;
    const rs = results(), wb = new ExcelJS.Workbook();
    const fill = c => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: c } });
    const GREEN = 'FFE3F3EA', RED = 'FFFBE7E5', YEL = 'FFFFE9A8', HEAD = 'FF9E1B32';
    const qCols = p => Array.from({ length: PAGES[p].n }, (_, i) => PAGES[p].short + (i + 1));
    const header = ['STT', 'Mã HS', 'Họ tên', ...qCols('reading'), 'Reading /32', 'Reading thang', 'Reading CEFR', ...partsOf('reading').map(([p, n]) => `R Part ${p} (/${n})`),
      ...qCols('listening'), 'Listening /25', 'Listening thang', 'Listening CEFR', ...partsOf('listening').map(([p, n]) => `L Part ${p} (/${n})`), 'Số câu tô không chuẩn', 'Ghi chú', 'Nhận xét'];
    const styleHead = ws => { const r = ws.getRow(1); r.font = { bold: true, color: { argb: 'FFFFFFFF' } }; r.fill = fill(HEAD);
      ws.views = [{ state: 'frozen', xSplit: 3, ySplit: 1 }]; ws.getColumn(3).width = 26; ws.getColumn(2).width = 10; };

    const build = (name, cellOf) => {
      const ws = wb.addWorksheet(name); ws.addRow(header); styleHead(ws);
      if (name === 'Đáp án đã chọn') {
        const kr = ws.addRow(['', 'Đáp án', '',
          ...qCols('reading').map((_, i) => [].concat(KEY.reading[i + 1]).join('/')), '', '', '', ...partsOf('reading').map(() => ''),
          ...qCols('listening').map((_, i) => [].concat(KEY.listening[i + 1]).join('/')), '', '', '', ...partsOf('listening').map(() => ''), '', '', '']);
        kr.font = { bold: true }; kr.fill = fill('FFE6EDFC');
      }
      for (const r of rs) {
        const vals = [r.stt, r.s.code, r.s.name];
        const marks = [];
        for (const p of ['reading', 'listening']) {
          const g = r[p];
          for (let i = 0; i < PAGES[p].n; i++) { const it = g?.items[i]; vals.push(it ? cellOf(it) : ''); marks.push(it); }
          vals.push(g ? g.raw : '', g ? scaleText(g.scale) : '', g ? g.cefr : '');
          marks.push(null, null, null);
          partsOf(p).forEach(([pt]) => { vals.push(g ? g.parts[pt] : ''); marks.push(null); });
        }
        vals.push((r.reading?.nonstd || 0) + (r.listening?.nonstd || 0), note(r) || '', (r.reading || r.listening) ? S_comment(r) : '');
        const row = ws.addRow(vals);
        marks.forEach((it, j) => { if (!it) return; const c = row.getCell(4 + j);
          c.fill = fill(it.flag ? YEL : it.ok ? GREEN : RED); c.alignment = { horizontal: 'center' }; });
        if (!r.reading && !r.listening) row.font = { color: { argb: 'FF9AA3B1' } };
      }
      header.forEach((h, j) => { if (j >= 3 && /^[RL]\d+$/.test(h)) ws.getColumn(j + 1).width = 5; });
      return ws;
    };
    build('Tổng hợp', it => it.ok ? 1 : 0);
    build('Đáp án đã chọn', it => it.shown);

    const st = wb.addWorksheet('Thống kê theo câu');
    st.addRow(['Kỹ năng', 'Câu', 'Part', 'Đáp án', 'Số bài', 'Số đúng', '% đúng', 'Phương án sai chọn nhiều nhất', 'Số câu tô không chuẩn']);
    st.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; st.getRow(1).fill = fill(HEAD);
    for (const p of ['reading', 'listening']) {
      const tplQ = Object.fromEntries(TPL[p].questions.map(q => [String(q.q), q.part]));
      for (let n = 1; n <= PAGES[p].n; n++) {
        const its = rs.map(r => r[p]?.items[n - 1]).filter(Boolean);
        const right = its.filter(i => i.ok).length, cnt = {};
        its.filter(i => !i.ok && i.type === 'mcq' && i.chosen).forEach(i => cnt[i.chosen] = (cnt[i.chosen] || 0) + 1);
        const top = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
        const pct = its.length ? right / its.length : null;
        const row = st.addRow([PAGES[p].name, n, tplQ[n], [].concat(KEY[p][n]).join(' / '), its.length, right, pct,
          top ? `${top[0]} (${top[1]} HS)` : '', its.filter(i => i.bad).length || '']);
        row.getCell(7).numFmt = '0%';
        if (pct != null) row.getCell(7).fill = fill(pct < 0.5 ? RED : pct < 0.75 ? 'FFFFF3CC' : GREEN);
      }
    }
    st.columns.forEach((c, i) => c.width = [11, 6, 6, 16, 8, 8, 8, 28, 20][i]);
    const buf = await wb.xlsx.writeBuffer();
    download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fname('xlsx'));
  }

  function exportCsv() {
    if (!confirmWarn()) return;
    const rs = results(), q = s => `"${String(s).replace(/"/g, '""')}"`;
    const cols = p => Array.from({ length: PAGES[p].n }, (_, i) => PAGES[p].short + (i + 1));
    const lines = [['STT', 'Mã HS', 'Họ tên', ...cols('reading'), 'Reading /32', 'Reading thang', 'Reading CEFR', ...partsOf('reading').map(([p, n]) => `R Part ${p} (/${n})`),
      ...cols('listening'), 'Listening /25', 'Listening thang', 'Listening CEFR', ...partsOf('listening').map(([p, n]) => `L Part ${p} (/${n})`), 'Số câu tô không chuẩn', 'Ghi chú', 'Nhận xét']];
    for (const r of rs) {
      const v = [r.stt, r.s.code, r.s.name];
      for (const p of ['reading', 'listening']) { const g = r[p];
        for (let i = 0; i < PAGES[p].n; i++) v.push(g ? (g.items[i].ok ? 1 : 0) : '');
        v.push(g ? g.raw : '', g ? scaleText(g.scale) : '', g ? g.cefr : '');
        partsOf(p).forEach(([pt]) => v.push(g ? g.parts[pt] : '')); }
      v.push((r.reading?.nonstd || 0) + (r.listening?.nonstd || 0), note(r), (r.reading || r.listening) ? S_comment(r) : '');
      lines.push(v);
    }
    download(new Blob(['\uFEFF' + lines.map(l => l.map(q).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), fname('csv'));
  }



  // ---------- nhận xét gợi ý ----------
  const fill = (t, o) => String(t || '').replace(/\{(\w+)\}/g, (_, k) => o[k] ?? '');
  const joinList = a => a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' và ' + a[a.length - 1];
  function suggestComment(r) {
    if (!NX) return '';
    const out = [], strong = [], weak = [];
    const lv = {};
    for (const p of ['reading', 'listening']) {
      const g = r[p]; if (!g) continue;
      (lv[g.cefr] = lv[g.cefr] || []).push(PAGES[p].name);
      for (const [pt, n] of partsOf(p)) {
        const v = g.parts[pt], f = v / n, o = { skill: PAGES[p].name, part: pt, score: `${v}/${n}` };
        if (f >= NX.nguong.manh) strong.push({ f, t: fill(NX.muc, o) });
        else if (f < NX.nguong.yeu) weak.push(fill(NX.mucCaiThien, { ...o, advice: NX.loiKhuyen?.[p]?.[pt] || '' }).replace(/, $/, ''));
      }
    }
    for (const l of ['B2', 'B1', 'A2', 'Dưới A2']) if (lv[l]) out.push(fill(NX.moDau[l], { skills: lv[l].join(NX.noiKyNang || ' và ') }));
    // chỉ nêu tối đa 3 phần làm tốt nhất cho gọn
    const best = strong.sort((a, b) => b.f - a.f).slice(0, NX.toiDaDiemManh || 3).map(x => x.t);
    if (best.length) out.push(fill(NX.diemManh, { list: joinList(best) }));
    out.push(weak.length ? fill(NX.canCaiThien, { list: weak.join('; ') }) : NX.khongYeu);
    const items = ['reading', 'listening'].flatMap(p => r[p]?.items || []);
    if (items.some(i => i.bad)) out.push(NX.toBai);
    if (items.some(i => !i.ok && !i.bad && (i.type === 'write' ? i.shown === '' : !i.chosen))) out.push(NX.boTrong);
    return out.filter(Boolean).join(' ').replace(/^./, c => c.toUpperCase());
  }
  S_comment = r => { const c = S.comments?.[r.s.key]; return c === undefined ? suggestComment(r) : c; };

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
  const slug = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const barColor = f => f >= 0.75 ? '#1E7F4F' : f >= 0.5 ? '#E0A100' : '#B42318';

  function reportHTML(r) {
    const dates = ['reading', 'listening'].map(p => S.sheets[r.s.key]?.[p]?.at).filter(Boolean);
    const day = new Date(Math.max(...dates)).toLocaleDateString('vi-VN');
    const skill = p => {
      const g = r[p], P = PAGES[p];
      if (!g) return `<div class="rp-skill"><h2>${P.name}</h2><div class="rp-none">Chưa có bài</div></div>`;
      const parts = partsOf(p).map(([pt, n]) => { const v = g.parts[pt], f = v / n;
        return `<div class="rp-part"><span>Part ${pt}</span><div class="rp-bar"><i style="width:${Math.max(f * 100, 2)}%;background:${barColor(f)}"></i></div><b>${v}/${n}</b></div>`; }).join('');
      return `<div class="rp-skill"><h2>${P.name}<em>${g.cefr}</em></h2>
        <div class="rp-big"><div><b>${g.raw}</b><span> / ${P.n} câu đúng</span></div><div><b>${scaleText(g.scale)}</b><span> thang Cambridge</span></div></div>${parts}</div>`;
    };
    const wrong = p => {
      const g = r[p]; if (!g) return '';
      const K = KEY[p]; let last = null, out = '';
      const bad = g.items.filter(i => !i.ok);
      if (!bad.length) return `<div><h3>${PAGES[p].name}</h3><ul><li>Không sai câu nào 🎉</li></ul></div>`;
      for (const i of bad) {
        const pt = partOfQ[p + i.q];
        if (pt !== last) { out += `<li class="pt">PART ${pt}</li>`; last = pt; }
        const key = [].concat(K[i.q]).join(' / ');
        const what = i.type === 'write' ? (i.shown === '' ? 'bỏ trống' : 'chưa đúng')
          : i.bad && !i.chosen ? `tô ô ${esc(i.shown.replace('*', ''))} chưa đúng cách` : i.chosen ? `em chọn ${i.chosen}` : 'bỏ trống';
        out += `<li><b>${i.q}.</b> ${what} → đáp án <b>${esc(key)}</b></li>`;
      }
      return `<div><h3>${PAGES[p].name} — câu cần xem lại</h3><ul>${out}</ul></div>`;
    };
    const habit = ['reading', 'listening'].flatMap(p => r[p] ? r[p].items.filter(i => i.bad).map(i => PAGES[p].short + i.q) : []);
    const tR = S.testTitle;
    return `<div class="rp">
      <div class="rp-band"><small>RUBY SCHOOL · CAMBRIDGE B1 PRELIMINARY FOR SCHOOLS</small><h1>Phiếu kết quả Reading &amp; Listening</h1></div>
      <div class="rp-main">
        <div class="rp-info"><div><span>Họ và tên</span><b>${esc(r.s.name)}</b></div><div><span>Mã học sinh</span><b>${r.s.code}</b></div>
          <div><span>Lớp</span><b>${esc(S.cls)}</b></div><div><span>Đề</span><b>${esc(tR)}</b></div><div><span>Ngày chấm</span><b>${day}</b></div></div>
        <div class="rp-scores">${skill('reading')}${skill('listening')}</div>
        ${habit.length ? `<div class="rp-habit"><b>Lưu ý cách tô bài:</b> ${habit.length} câu tô chưa đúng cách (tick, dấu X, tô không kín hoặc tô 2 ô): ${habit.join(', ')}. Những câu này bị tính sai. Lần sau em hãy <b>tô kín một ô tròn</b> cho mỗi câu nhé.</div>` : ''}
        <div class="rp-wrong">${wrong('reading')}${wrong('listening')}</div>
        ${(() => { const cm = S_comment(r); return cm ? `<div class="rp-note"><b>Nhận xét của giáo viên</b><p>${esc(cm)}</p></div>`
          : '<div class="rp-note"><b>Nhận xét của giáo viên</b><div></div><div></div></div>'; })()}
      </div>
      <div class="rp-foot"><span>Thang điểm quy đổi theo mốc Cambridge English Scale; điểm Reading và Listening là điểm từng kỹ năng.</span><span>Ruby School</span></div>
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

  async function studentReport(key, again) {
    if (!again && !confirmWarn()) return;
    const r = results().find(x => x.s.key === key); if (!r) return;
    $('#reportComment').value = S_comment(r);
    $('#reportSuggest').onclick = () => { $('#reportComment').value = suggestComment(r); };
    $('#reportUpdate').onclick = () => {
      S.comments = S.comments || {}; S.comments[key] = $('#reportComment').value.trim(); save();
      studentReport(key, true);
    };
    await showReport(r);
  }
  async function showReport(r) {
    busy('Đang tạo phiếu kết quả…');
    try {
      await ensureLibs();
      const canvas = await renderReportCanvas(r);
      const base = `phieu-ket-qua_${r.s.code}_${slug(r.s.name)}`;
      const jpg = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.9));
      const file = new File([jpg], base + '.jpg', { type: 'image/jpeg' });
      $('#reportTitle').textContent = `${r.s.name} (${r.s.code})`;
      $('#reportImg').src = URL.createObjectURL(jpg);
      $('#reportJpg').onclick = () => download(jpg, base + '.jpg');
      $('#reportPdf').onclick = () => { const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' }); addPage(pdf, canvas, true); download(pdf.output('blob'), base + '.pdf'); };
      const canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
      $('#reportShare').hidden = !canShare;
      $('#reportShare').onclick = () => navigator.share({ files: [file], title: `Phiếu kết quả — ${r.s.name}` }).catch(() => {});
      $('#reportModal').hidden = false;
    } catch (e) { alert(e.message || e); }
    finally { busy(''); }
  }

  async function classReport() {
    const rs = results().filter(r => r.reading || r.listening);
    if (!rs.length) { alert('Chưa có phiếu nào để tạo phiếu kết quả.'); return; }
    if (!confirmWarn()) return;
    busy('Đang chuẩn bị…');
    try {
      await ensureLibs();
      const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
      for (let i = 0; i < rs.length; i++) {
        busy(`Đang tạo phiếu ${i + 1}/${rs.length}…`);
        addPage(pdf, await renderReportCanvas(rs[i]), i === 0);
      }
      const name = `phieu-ket-qua_${slug(S.testTitle)}_lop${S.cls}.pdf`, blob = pdf.output('blob');
      const file = new File([blob], name, { type: 'application/pdf' });
      busy('');
      if (navigator.canShare && navigator.canShare({ files: [file] }) && confirm(`Đã tạo ${rs.length} phiếu. Bấm OK để gửi qua Zalo / ứng dụng khác, hoặc Huỷ để tải file về máy.`))
        navigator.share({ files: [file], title: name }).catch(() => download(blob, name));
      else download(blob, name);
    } catch (e) { alert(e.message || e); }
    finally { busy(''); $('#reportStage').innerHTML = ''; }
  }

  async function clearSession() {
    if (!confirm(`Xoá toàn bộ phiếu đã chụp của ${S.testTitle} – lớp ${S.cls}? Không thể hoàn tác.`)) return;
    await idb.del(S.id);
    S = { id: S.id, test: S.test, testTitle: S.testTitle, cls: S.cls, sheets: {}, unknown: [], writeDone: {} };
    go('scan');
  }

  // cho bài test tự động
  window.__PET = { get S() { return S; }, gradePage, toScale, results, buildSheet, assign };
  boot().catch(e => { $('#loading').hidden = true; alert('Không tải được cấu hình app: ' + e.message); });
})();
