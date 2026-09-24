/* cham-bai.js — app chấm phiếu PET (Ruby School) */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const PAGES = { reading: { n: 32, short: 'R', name: 'Reading' }, listening: { n: 25, short: 'L', name: 'Listening' } };

  let TPL, SCALE, TESTS = [], KEY = null, cvReady = false;
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
  let saveTimer;
  const save = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => idb.set(S.id, S).catch(() => alert('Không lưu được kết quả trên máy (bộ nhớ trình duyệt đầy?).')), 300); };

  // ---------- khởi động ----------
  async function boot() {
    [TPL, SCALE, TESTS] = await Promise.all(['omr-template.json', 'thang-diem.json', 'de-thi/manifest.json']
      .map(f => fetch(f).then(r => { if (!r.ok) throw new Error(f); return r.json(); })));
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
    $('#btnClear').onclick = clearSession;
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
      const line = document.createElement('div'); line.className = 'q-run'; line.textContent = `Đang đọc ${f.name}…`;
      $('#queue').prepend(line);
      await new Promise(r => setTimeout(r, 30));
      try {
        const msg = await processFile(f); line.className = msg.cls;
        line.innerHTML = `<span>${msg.html}</span>`;
        if (msg.ref) {
          const b = document.createElement('button'); b.className = 'btn small danger'; b.textContent = 'Xoá';
          b.onclick = () => { if (removeRef(msg.ref)) { line.className = 'q-del'; line.innerHTML = `<span>Đã xoá: ${msg.html}</span>`; } };
          line.appendChild(b);
        }
      }
      catch (e) { console.error(e); line.className = 'q-err'; line.textContent = `${f.name}: lỗi khi đọc ảnh (${e.message || e}).`; }
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
    const sheet = buildSheet(res);
    const stu = res.codeOk ? stuByKey(res.code) : null;
    if (!stu) {
      const id = Date.now() + Math.random();
      S.unknown.push({ id, page: res.page, code: res.code, sheet });
      const why = res.codeOk ? `mã ${res.code} không có trong lớp ${S.cls}` : `mã tô chưa rõ (${res.code})`;
      return { cls: 'q-err', html: `${PAGES[res.page].name}: ${esc(why)} — chọn học sinh ở mục bên dưới.`, ref: { unknown: id } };
    }
    return assign(stu.key, res.page, sheet);
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

  function assign(key, page, sheet) {
    const stu = stuByKey(key);
    S.sheets[key] = S.sheets[key] || {};
    if (S.sheets[key][page] && !confirm(`Đã có phiếu ${PAGES[page].name} của ${stu.name}. Thay bằng phiếu mới?`))
      return { cls: 'q-err', html: `Giữ phiếu ${PAGES[page].name} cũ của ${esc(stu.name)}.` };
    S.sheets[key][page] = sheet;
    Object.keys(S.writeDone).filter(k => k.startsWith(page)).forEach(k => delete S.writeDone[k]);
    const nf = flagCount(sheet);
    return { cls: nf ? 'q-flag' : 'q-ok', ref: { key, page, at: sheet.at },
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
  function gradePage(p, sh) {
    const K = KEY[p], items = [];
    let raw = 0, nonstd = 0;
    for (let n = 1; n <= PAGES[p].n; n++) {
      const q = String(n), k = K[q];
      if (Array.isArray(k)) {
        const w = sh.write[q], ok = verdict(w);
        items.push({ q, type: 'write', shown: w.blank ? '' : (ok ? '✓' : '✗'), ok, flag: false });
        raw += ok;
      } else {
        const m = sh.mcq[q], o = sh.over[q], bad = m.status === 'nonstd' || m.status === 'multi';
        if (bad) nonstd++;
        const chosen = o ? (o.accept || '') : (m.status === 'ok' ? m.answer : '');
        const ok = chosen === k;
        items.push({ q, type: 'mcq', shown: bad && !o?.accept ? m.answer + '*' : chosen, chosen, ok, flag: bad && !o, bad });
        raw += ok;
      }
    }
    const scale = toScale(raw, SCALE[p]);
    return { items, raw, scale, cefr: cefr(scale), nonstd };
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
    const w = warnings();
    $('#exportWarn').innerHTML = w.length ? `<div class="notice warn">${w.map(esc).join('<br>')}</div>` : '';
    const rs = results();
    $('#resTable').innerHTML = `<thead><tr><th>STT</th><th>Mã</th><th>Họ tên</th><th>Reading /32</th><th>Thang</th><th>CEFR</th>
      <th>Listening /25</th><th>Thang</th><th>CEFR</th><th>Tô không chuẩn</th></tr></thead><tbody>` +
      rs.map(r => { const R = r.reading, L = r.listening, miss = !R && !L;
        const c = (g, n) => g ? `<td class="num">${g.raw}</td><td class="num">${scaleText(g.scale)}</td><td>${g.cefr}</td>` : '<td>—</td><td>—</td><td>—</td>';
        return `<tr class="${miss ? 'missing' : ''}"><td class="num">${r.stt}</td><td>${r.s.code}</td><td>${esc(r.s.name)}</td>${c(R)}${c(L)}
          <td class="num">${(R?.nonstd || 0) + (L?.nonstd || 0) || ''}</td></tr>`; }).join('') + '</tbody>';
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
    const header = ['STT', 'Mã HS', 'Họ tên', ...qCols('reading'), 'Reading /32', 'Reading thang', 'Reading CEFR',
      ...qCols('listening'), 'Listening /25', 'Listening thang', 'Listening CEFR', 'Số câu tô không chuẩn', 'Ghi chú'];
    const styleHead = ws => { const r = ws.getRow(1); r.font = { bold: true, color: { argb: 'FFFFFFFF' } }; r.fill = fill(HEAD);
      ws.views = [{ state: 'frozen', xSplit: 3, ySplit: 1 }]; ws.getColumn(3).width = 26; ws.getColumn(2).width = 10; };

    const build = (name, cellOf) => {
      const ws = wb.addWorksheet(name); ws.addRow(header); styleHead(ws);
      if (name === 'Đáp án đã chọn') {
        const kr = ws.addRow(['', 'Đáp án', '',
          ...qCols('reading').map((_, i) => [].concat(KEY.reading[i + 1]).join('/')), '', '', '',
          ...qCols('listening').map((_, i) => [].concat(KEY.listening[i + 1]).join('/')), '', '', '', '', '']);
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
        }
        vals.push((r.reading?.nonstd || 0) + (r.listening?.nonstd || 0), note(r) || '');
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
    const lines = [['STT', 'Mã HS', 'Họ tên', ...cols('reading'), 'Reading /32', 'Reading thang', 'Reading CEFR',
      ...cols('listening'), 'Listening /25', 'Listening thang', 'Listening CEFR', 'Số câu tô không chuẩn', 'Ghi chú']];
    for (const r of rs) {
      const v = [r.stt, r.s.code, r.s.name];
      for (const p of ['reading', 'listening']) { const g = r[p];
        for (let i = 0; i < PAGES[p].n; i++) v.push(g ? (g.items[i].ok ? 1 : 0) : '');
        v.push(g ? g.raw : '', g ? scaleText(g.scale) : '', g ? g.cefr : ''); }
      v.push((r.reading?.nonstd || 0) + (r.listening?.nonstd || 0), note(r));
      lines.push(v);
    }
    download(new Blob(['\uFEFF' + lines.map(l => l.map(q).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), fname('csv'));
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
