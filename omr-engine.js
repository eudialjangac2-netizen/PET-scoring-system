/* omr-engine.js — nhận dạng phiếu trả lời B1 PET (Ruby School)
 * Dùng chung cho app (trình duyệt) và bài test (node).
 * Đầu vào: ảnh RGBA {data,width,height} + omr-template.json
 * Đầu ra: mặt phiếu, mã học sinh, đáp án từng câu, ảnh phiếu đã nắn (gray).
 */
(function (root) {
  'use strict';
  const S = 10;                 // px / mm trong ảnh đã nắn
  const PW = 210 * S, PH = 297 * S;

  // Ngưỡng (chỉnh tại đây khi hiệu chỉnh bằng bài thật)
  const TH = {
    ink: 170,          // pixel tối hơn giá trị này = có mực
    marked: 0.28,      // độ phủ >= ngưỡng này = ô có đánh dấu
    fullCov: 0.50,     // tô chuẩn: độ phủ tổng
    fullSector: 0.30,  // tô chuẩn: 7/8 cung tròn đều phải có mực
    codeMarked: 0.40,  // ô mã học sinh
    writeInk: 0.004    // ô viết: tỉ lệ mực tối thiểu để coi là có chữ
  };

  function findFiducials(cv, gray) {
    const scale = 1600 / Math.max(gray.rows, gray.cols);
    const g = new cv.Mat(), th = new cv.Mat();
    cv.resize(gray, g, new cv.Size(0, 0), scale, scale, cv.INTER_AREA);
    cv.GaussianBlur(g, g, new cv.Size(5, 5), 0);
    cv.adaptiveThreshold(g, th, 255, cv.ADAPTIVE_THRESH_MEAN_C, cv.THRESH_BINARY_INV, 51, 15);
    const contours = new cv.MatVector(), hier = new cv.Mat();
    cv.findContours(th, contours, hier, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
    const W = g.cols, H = g.rows, d = g.data;
    const mean = (x0, y0, x1, y1, ex) => {
      let s = 0, n = 0;
      x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(W, x1); y1 = Math.min(H, y1);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        if (ex && x >= ex[0] && x < ex[2] && y >= ex[1] && y < ex[3]) continue;
        s += d[y * W + x]; n++;
      }
      return n ? s / n : 255;
    };
    const cands = [];
    for (let i = 0; i < contours.size(); i++) {
      const c = contours.get(i);
      const a = cv.contourArea(c);
      if (a < 150 || a > 5000) { c.delete(); continue; }
      const r = cv.boundingRect(c);
      const ar = r.width / r.height;
      const hull = new cv.Mat(); cv.convexHull(c, hull);
      const solid = a / Math.max(cv.contourArea(hull), 1); hull.delete();
      if (ar < 0.7 || ar > 1.4 || solid < 0.9 || a / (r.width * r.height) < 0.75) { c.delete(); continue; }
      const inner = mean(r.x + r.width / 4 | 0, r.y + r.height / 4 | 0, r.x + 3 * r.width / 4 | 0, r.y + 3 * r.height / 4 | 0);
      const pad = Math.max(r.width, r.height) / 2 | 0;
      const ring = mean(r.x - pad, r.y - pad, r.x + r.width + pad, r.y + r.height + pad, [r.x, r.y, r.x + r.width, r.y + r.height]);
      if (inner <= 110 && ring >= 150) {
        const m = cv.moments(c);
        cands.push([m.m10 / m.m00, m.m01 / m.m00, a]);
      }
      c.delete();
    }
    contours.delete(); hier.delete(); g.delete(); th.delete();
    cands.sort((p, q) => q[2] - p[2]); cands.length = Math.min(cands.length, 24);
    const target = 184 / 271, dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
    let best = null, bestScore = 0;
    const n = cands.length;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) for (let l = k + 1; l < n; l++) {
      const quad = [cands[i], cands[j], cands[k], cands[l]];
      const areas = quad.map(q => q[2]);
      if (Math.max(...areas) / Math.min(...areas) > 2.2) continue;
      const s = quad.map(q => q[0] + q[1]), df = quad.map(q => q[1] - q[0]);
      const tl = quad[s.indexOf(Math.min(...s))], br = quad[s.indexOf(Math.max(...s))];
      const tr = quad[df.indexOf(Math.min(...df))], bl = quad[df.indexOf(Math.max(...df))];
      if (new Set([tl, tr, bl, br]).size < 4) continue;
      const wid = (dist(tr, tl) + dist(br, bl)) / 2, hei = (dist(bl, tl) + dist(br, tr)) / 2;
      if (Math.abs(wid / hei - target) > 0.12) continue;
      if (wid * hei > bestScore) { bestScore = wid * hei; best = [tl, tr, bl, br].map(p => [p[0] / scale, p[1] / scale]); }
    }
    return best;
  }

  function warpAndNormalize(cv, gray, fid, tpl) {
    const dst = tpl.reading.fiducials.map(p => [p[0] * S, p[1] * S]);
    const src = cv.matFromArray(4, 1, cv.CV_32FC2, fid.flat());
    const dm = cv.matFromArray(4, 1, cv.CV_32FC2, dst.flat());
    const M = cv.getPerspectiveTransform(src, dm);
    const w = new cv.Mat();
    cv.warpPerspective(gray, w, M, new cv.Size(PW, PH), cv.INTER_LINEAR, cv.BORDER_REPLICATE);
    src.delete(); dm.delete(); M.delete();
    // chuẩn hoá ánh sáng: nền = max-filter + blur (làm ở 1/4 kích thước cho nhanh)
    const sm = new cv.Mat(), bg = new cv.Mat();
    cv.resize(w, sm, new cv.Size(PW / 4 | 0, PH / 4 | 0), 0, 0, cv.INTER_AREA);
    const k = cv.Mat.ones(35, 35, cv.CV_8U);
    cv.dilate(sm, sm, k); k.delete();
    cv.GaussianBlur(sm, sm, new cv.Size(0, 0), 10);
    cv.resize(sm, bg, new cv.Size(PW, PH), 0, 0, cv.INTER_LINEAR);
    const a = w.data, b = bg.data, out = new Uint8Array(PW * PH);
    for (let i = 0; i < out.length; i++) out[i] = Math.min(255, a[i] / Math.max(b[i], 1) * 240);
    sm.delete(); bg.delete(); w.delete();
    return out;
  }

  function makeRing(cv) {
    const r = Math.round(2.3 * S), pad = 6, sz = 2 * (r + pad) + 1;
    const t = new cv.Mat(sz, sz, cv.CV_8U, new cv.Scalar(255));
    cv.circle(t, new cv.Point(sz >> 1, sz >> 1), r, new cv.Scalar(0), 3);
    return t;
  }

  // Dời cả nhóm ô (một hàng) cho khớp vòng tròn in sẵn — bù phiếu cong/lệch
  function snap(cv, img, ring, pts, mx = 3.5, my = 3.0) {
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const x0 = Math.round((Math.min(...xs) - mx - 4) * S), x1 = Math.round((Math.max(...xs) + mx + 4) * S);
    const y0 = Math.round((Math.min(...ys) - my - 4) * S), y1 = Math.round((Math.max(...ys) + my + 4) * S);
    const reg = img.roi(new cv.Rect(x0, y0, x1 - x0, y1 - y0));
    const m = new cv.Mat();
    cv.matchTemplate(reg, ring, m, cv.TM_CCOEFF_NORMED);
    const h = ring.rows >> 1, mw = m.cols, md = m.data32F;
    let best = [-1e9, 0, 0];
    for (let dy = Math.round(-my * S); dy <= my * S; dy += 2)
      for (let dx = Math.round(-mx * S); dx <= mx * S; dx += 2) {
        let s = 0;
        for (const [x, y] of pts) {
          const cx = Math.round(x * S) + dx - x0 - h, cy = Math.round(y * S) + dy - y0 - h;
          s += md[cy * mw + cx];
        }
        if (s > best[0]) best = [s, dx, dy];
      }
    reg.delete(); m.delete();
    return [best[1] / S, best[2] / S];
  }

  // Đặc trưng của 1 ô: độ phủ mực + độ phủ 8 cung (để biết tô kín hay tick/X)
  function bubbleFeat(px, x, y) {
    const cx = x * S, cy = y * S, r1 = 1.7 * S, r2 = 1.9 * S, rin = 0.5 * S;
    let ink = 0, n = 0; const sI = new Array(8).fill(0), sN = new Array(8).fill(0);
    for (let yy = Math.floor(cy - r2); yy <= cy + r2; yy++)
      for (let xx = Math.floor(cx - r2); xx <= cx + r2; xx++) {
        const dx = xx - cx, dy = yy - cy, d = Math.hypot(dx, dy);
        const dark = px[yy * PW + xx] < TH.ink;
        if (d < r1) { n++; if (dark) ink++; }
        if (d < r2 && d > rin) {
          const k = Math.min(7, Math.floor((Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI) * 8));
          sN[k]++; if (dark) sI[k]++;
        }
      }
    const sec = sI.map((v, i) => v / Math.max(sN[i], 1)).sort((a, b) => a - b);
    return { cov: ink / n, sec2: sec[1] };
  }

  function regionMean(px, x, y, r) {
    let s = 0, n = 0;
    for (let yy = Math.round((y - r) * S); yy <= (y + r) * S; yy++)
      for (let xx = Math.round((x - r) * S); xx <= (x + r) * S; xx++) { s += px[yy * PW + xx]; n++; }
    return s / n;
  }

  function writeInk(px, b) {
    // bỏ viền 1mm để không đếm khung; vạch chia ô in màu nhạt nên dưới ngưỡng 150
    let ink = 0, n = 0;
    for (let yy = Math.round((b.y + 1) * S); yy < (b.y + b.h - 1) * S; yy++)
      for (let xx = Math.round((b.x + 1) * S); xx < (b.x + b.w - 1) * S; xx++) { n++; if (px[yy * PW + xx] < 150) ink++; }
    return ink / n;
  }

  function process(cv, rgba, tpl) {
    const src = cv.matFromImageData ? cv.matFromImageData(rgba)
      : (() => { const m = new cv.Mat(rgba.height, rgba.width, cv.CV_8UC4); m.data.set(rgba.data); return m; })();
    const gray0 = new cv.Mat(); cv.cvtColor(src, gray0, cv.COLOR_RGBA2GRAY); src.delete();
    // thử lần lượt 4 hướng xoay (ảnh chụp ngang / ngược đầu)
    const rots = [null, cv.ROTATE_90_CLOCKWISE, cv.ROTATE_180, cv.ROTATE_90_COUNTERCLOCKWISE];
    let px = null, page = null, sawCorners = false;
    for (const rot of rots) {
      let g = gray0;
      if (rot !== null) { g = new cv.Mat(); cv.rotate(gray0, g, rot); }
      const fid = findFiducials(cv, g);
      if (fid) {
        sawCorners = true;
        const p = warpAndNormalize(cv, g, fid, tpl);
        const ids = tpl.reading.page_id.slots.map(([x, y]) => regionMean(p, x, y, 2));
        if (Math.abs(ids[0] - ids[1]) >= 40) { px = p; page = ids[0] < ids[1] ? 'reading' : 'listening'; }
      }
      if (g !== gray0) g.delete();
      if (px) break;
    }
    gray0.delete();
    if (!px) return { ok: false, error: sawCorners
      ? 'Không nhận ra mặt phiếu (Reading/Listening). Kiểm tra phiếu có đúng mẫu không.'
      : 'Không thấy đủ 4 ô vuông đen ở góc phiếu. Chụp lại, để lộ cả 4 góc.' };
    const img = new cv.Mat(PH, PW, cv.CV_8U); img.data.set(px);
    const ring = makeRing(cv);
    const T = tpl[page];

    // mã học sinh
    let code = '', codeOk = true; const codeCols = [];
    for (const col of T.student_code) {
      const [dx, dy] = snap(cv, img, ring, col, 3, 2);
      const f = col.map(([x, y]) => bubbleFeat(px, x + dx, y + dy).cov);
      const order = f.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
      const okCol = order[0][0] >= TH.codeMarked && order[1][0] < TH.marked;
      codeOk = codeOk && okCol; code += okCol ? order[0][1] : '?';
      codeCols.push({ x: col[0][0] + dx, y0: col[0][1] + dy, y1: col[9][1] + dy });
    }

    const mcq = {}, write = {};
    for (const q of T.questions) {
      if (q.type === 'write') {
        write[q.q] = { box: q.box, ink: writeInk(px, q.box), blank: writeInk(px, q.box) < TH.writeInk };
        continue;
      }
      const pts = q.options.map(o => [o.x, o.y]);
      const [dx, dy] = snap(cv, img, ring, pts);
      const opts = q.options.map(o => ({ label: o.label, x: o.x + dx, y: o.y + dy, ...bubbleFeat(px, o.x + dx, o.y + dy) }));
      const marked = opts.filter(o => o.cov >= TH.marked);
      let status, answer = '';
      if (marked.length === 0) status = 'blank';
      else if (marked.length > 1) { status = 'multi'; answer = marked.map(o => o.label).join(''); }
      else {
        answer = marked[0].label;
        status = (marked[0].cov >= TH.fullCov && marked[0].sec2 >= TH.fullSector) ? 'ok' : 'nonstd';
      }
      mcq[q.q] = { answer, status, part: q.part, row: { x0: opts[0].x - 4, x1: opts[opts.length - 1].x + 4, y: opts[0].y },
        opts: opts.map(o => ({ label: o.label, cov: +o.cov.toFixed(2), sec2: +o.sec2.toFixed(2) })) };
    }
    img.delete(); ring.delete();
    return { ok: true, page, code, codeOk, codeCols, mcq, write, px, width: PW, height: PH, S };
  }

  const OMR = { process, TH, S };
  if (typeof module !== 'undefined' && module.exports) module.exports = OMR; else root.OMR = OMR;
})(typeof self !== 'undefined' ? self : this);
