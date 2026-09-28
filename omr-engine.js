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
    writeInk: 0.008,   // ô viết: tỉ lệ nét chữ tối thiểu (trong lõi các ô chữ) để coi là có chữ
    minSharp: 120,     // độ nét tối thiểu (phương sai Laplacian ở 3 px/mm)
    minBright: 80,     // độ sáng trung bình tối thiểu của phiếu
    maxGlare: 0.04,    // tỉ lệ vùng bị lóa tối đa
    minDir: 0.58       // cân bằng độ nét ngang/dọc (thấp = mờ do rung tay)
  };

  function qualityIssue(q) {
    if (!q) return null;
    if (q.bright < TH.minBright) return 'Ảnh quá tối — bật thêm đèn hoặc ra chỗ sáng hơn.';
    if (q.glare > TH.maxGlare) return 'Phiếu bị lóa đèn — nghiêng máy một chút để tránh chỗ phản chiếu.';
    if (q.sharp < TH.minSharp || q.dir < TH.minDir) return 'Ảnh bị mờ — giữ yên máy và chờ camera lấy nét.';
    return null;
  }

  // Dò nhanh 4 góc trên khung hình camera (ảnh nhỏ) — dùng cho chế độ quét tự động
  function detect(cv, rgba) {
    const src = new cv.Mat(rgba.height, rgba.width, cv.CV_8UC4); src.data.set(rgba.data);
    const gray = new cv.Mat(); cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY); src.delete();
    const work = Math.max(gray.rows, gray.cols);
    let fid = findFiducials(cv, gray, work), rotated = false;
    if (!fid) {   // phiếu nằm ngang trong khung hình
      const r = new cv.Mat(); cv.rotate(gray, r, cv.ROTATE_90_CLOCKWISE);
      const f2 = findFiducials(cv, r, work); r.delete();
      if (f2) { rotated = true; const H = gray.rows; fid = f2.map(([x, y]) => [y, H - 1 - x]); }
    }
    gray.delete();
    if (!fid) return null;
    const [tl, tr, bl, br] = fid;
    const area = Math.abs((tr[0] - tl[0]) * (bl[1] - tl[1]) - (bl[0] - tl[0]) * (tr[1] - tl[1]));
    return { corners: fid, areaFrac: area / (rgba.width * rgba.height), rotated };
  }

  function findFiducials(cv, gray, work = 1600) {
    const scale = work / Math.max(gray.rows, gray.cols), k = work / 1600;
    const blk = (Math.round(51 * k) | 1), amin = 150 * k * k, amax = 5000 * k * k;
    const g = new cv.Mat(), th = new cv.Mat();
    cv.resize(gray, g, new cv.Size(0, 0), scale, scale, cv.INTER_AREA);
    cv.GaussianBlur(g, g, new cv.Size(5, 5), 0);
    cv.adaptiveThreshold(g, th, 255, cv.ADAPTIVE_THRESH_MEAN_C, cv.THRESH_BINARY_INV, blk, 15);
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
      if (a < amin || a > amax) { c.delete(); continue; }
      const r = cv.boundingRect(c);
      const ar = r.width / r.height;
      const hull = new cv.Mat(); cv.convexHull(c, hull);
      const solid = a / Math.max(cv.contourArea(hull), 1); hull.delete();
      if (ar < 0.5 || ar > 2.0 || solid < 0.9 || a / (r.width * r.height) < 0.65) { c.delete(); continue; }
      const inner = mean(r.x + r.width / 4 | 0, r.y + r.height / 4 | 0, r.x + 3 * r.width / 4 | 0, r.y + 3 * r.height / 4 | 0);
      const pad = Math.max(r.width, r.height) / 2 | 0;
      const ring = mean(r.x - pad, r.y - pad, r.x + r.width + pad, r.y + r.height + pad, [r.x, r.y, r.x + r.width, r.y + r.height]);
      if (inner <= 110 && ring >= 130) {
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
      if (Math.max(...areas) / Math.min(...areas) > 4) continue;
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
    const dst = tpl.fiducials.map(p => [p[0] * S, p[1] * S]);
    const src = cv.matFromArray(4, 1, cv.CV_32FC2, fid.flat());
    const dm = cv.matFromArray(4, 1, cv.CV_32FC2, dst.flat());
    const M = cv.getPerspectiveTransform(src, dm);
    const w = new cv.Mat();
    cv.warpPerspective(gray, w, M, new cv.Size(PW, PH), cv.INTER_LINEAR, cv.BORDER_REPLICATE);
    src.delete(); dm.delete(); M.delete();
    // chất lượng ảnh: độ nét (đo ở 3 px/mm để không phụ thuộc độ phân giải), độ sáng, lóa
    const q = new cv.Mat(), lap = new cv.Mat(), mu = new cv.Mat(), sd = new cv.Mat();
    cv.resize(w, q, new cv.Size(630, 891), 0, 0, cv.INTER_AREA);
    cv.Laplacian(q, lap, cv.CV_32F, 1);
    cv.meanStdDev(lap, mu, sd);
    const sharp = sd.data64F[0] ** 2;
    // mờ do rung tay: cạnh theo một hướng yếu hẳn so với hướng kia
    // đo cạnh theo 4 hướng (ngang, dọc, 2 đường chéo); chênh lệch lớn = rung tay
    const vars = [[0,0,0,-1,0,1,0,0,0],[0,-1,0,0,0,0,0,1,0],[-1,0,0,0,0,0,0,0,1],[0,0,-1,0,0,0,1,0,0]].map((kv, i) => {
      const k = cv.matFromArray(3, 3, cv.CV_32F, kv), g = new cv.Mat();
      cv.filter2D(q, g, cv.CV_32F, k); cv.meanStdDev(g, mu, sd);
      const v = sd.data64F[0] ** 2 / (i < 2 ? 1 : 2); k.delete(); g.delete(); return v; });
    const dir = Math.min(...vars) / Math.max(...vars, 1);
    let sum = 0, glare = 0; const qd = q.data;
    for (let i = 0; i < qd.length; i++) { sum += qd[i]; if (qd[i] >= 250) glare++; }
    const quality = { sharp: Math.round(sharp), dir: +dir.toFixed(2), bright: Math.round(sum / qd.length), glare: +(glare / qd.length).toFixed(3) };
    q.delete(); lap.delete(); mu.delete(); sd.delete();
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
    return { px: out, quality };
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


  // ---------- căn chỉnh theo từng khối (bù phiếu cong, nằm không phẳng) ----------
  // Vẽ "ảnh mẫu" của cả khối (thanh tiêu đề Part + vòng tròn + ô viết) rồi dò vị trí thật trong ±range mm.
  // Thanh tiêu đề / hàng ô viết mã phá thế lặp tuần hoàn giữa các hàng nên không bị trượt sang hàng bên cạnh.
  function blockShift(cv, img, bbox, items, range = 6) {
    const pad = 2.5, x0 = Math.round((bbox.x0 - pad) * S), y0 = Math.round((bbox.y0 - pad) * S);
    const w = Math.round((bbox.x1 - bbox.x0 + 2 * pad) * S), h = Math.round((bbox.y1 - bbox.y0 + 2 * pad) * S);
    const t = new cv.Mat(h, w, cv.CV_8U, new cv.Scalar(255));
    const P = (x, y) => new cv.Point(Math.round(x * S) - x0, Math.round(y * S) - y0);
    for (const it of items) {
      if (it.ring) cv.circle(t, P(it.ring[0], it.ring[1]), Math.round(2.3 * S), new cv.Scalar(80), 3);
      if (it.bar) { cv.rectangle(t, P(it.bar.x, it.bar.y), P(it.bar.x + it.bar.w, it.bar.y + it.bar.h), new cv.Scalar(215), -1);
                    cv.rectangle(t, P(it.bar.x, it.bar.y), P(it.bar.x + 1.2, it.bar.y + it.bar.h), new cv.Scalar(70), -1); }
      if (it.box) {
        cv.rectangle(t, P(it.box.x, it.box.y), P(it.box.x + it.box.w, it.box.y + it.box.h), new cv.Scalar(80), 3);
        for (let i = 1; i < (it.cells || 0); i++) {   // vạch chia ô (in nhạt) — giúp không trượt ngang
          const x = it.box.x + i * it.box.w / it.cells;
          cv.line(t, P(x, it.box.y + 2.2), P(x, it.box.y + it.box.h), new cv.Scalar(170), 2);
        }
      }
    }
    const R = Math.round(range * S);
    const rx0 = Math.max(0, x0 - R), ry0 = Math.max(0, y0 - R), rx1 = Math.min(PW, x0 + w + R), ry1 = Math.min(PH, y0 + h + R);
    const reg = img.roi(new cv.Rect(rx0, ry0, rx1 - rx0, ry1 - ry0)), m = new cv.Mat();
    cv.matchTemplate(reg, t, m, cv.TM_CCOEFF_NORMED);
    const mm = cv.minMaxLoc(m);
    const out = [(mm.maxLoc.x + rx0 - x0) / S, (mm.maxLoc.y + ry0 - y0) / S, mm.maxVal];
    reg.delete(); m.delete(); t.delete();
    return out;
  }
  function bboxOf(items) {
    const b = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
    const add = (x0, y0, x1, y1) => { b.x0 = Math.min(b.x0, x0); b.y0 = Math.min(b.y0, y0); b.x1 = Math.max(b.x1, x1); b.y1 = Math.max(b.y1, y1); };
    for (const it of items) {
      if (it.ring) add(it.ring[0] - 2.5, it.ring[1] - 2.5, it.ring[0] + 2.5, it.ring[1] + 2.5);
      if (it.bar) add(it.bar.x, it.bar.y, it.bar.x + it.bar.w, it.bar.y + it.bar.h);
      if (it.box) add(it.box.x, it.box.y, it.box.x + it.box.w, it.box.y + it.box.h);
    }
    return b;
  }

  // Như snap() nhưng cho phép co giãn dọc theo hàng/cột (phiếu cong làm hàng A–H ngắn lại vài mm)
  function snapScaled(cv, img, ring, pts, mx, my, axis) {
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), M = Math.max(mx, my) + 5;
    const x0 = Math.max(0, Math.round((Math.min(...xs) - M) * S)), x1 = Math.min(PW, Math.round((Math.max(...xs) + M) * S));
    const y0 = Math.max(0, Math.round((Math.min(...ys) - M) * S)), y1 = Math.min(PH, Math.round((Math.max(...ys) + M) * S));
    const reg = img.roi(new cv.Rect(x0, y0, x1 - x0, y1 - y0)), m = new cv.Mat();
    cv.matchTemplate(reg, ring, m, cv.TM_CCOEFF_NORMED);
    const h = ring.rows >> 1, mw = m.cols, mh = m.rows, md = m.data32F;
    const [px0, py0] = pts[0];
    let best = [-1e9, 0, 0, 1];
    for (let sc = 0.9; sc <= 1.06; sc += 0.01)
      for (let dy = Math.round(-my * S); dy <= my * S; dy += 2)
        for (let dx = Math.round(-mx * S); dx <= mx * S; dx += 2) {
          let v = 0;
          for (const [x, y] of pts) {
            const X = axis === 'x' ? px0 + (x - px0) * sc : x, Y = axis === 'y' ? py0 + (y - py0) * sc : y;
            const cx = Math.round(X * S) + dx - x0 - h, cy = Math.round(Y * S) + dy - y0 - h;
            if (cx >= 0 && cy >= 0 && cx < mw && cy < mh) v += md[cy * mw + cx];
          }
          if (v > best[0]) best = [v, dx, dy, sc];
        }
    reg.delete(); m.delete();
    const [, dx, dy, sc] = best;
    return pts.map(([x, y]) => [(axis === 'x' ? px0 + (x - px0) * sc : x) + dx / S, (axis === 'y' ? py0 + (y - py0) * sc : y) + dy / S]);
  }

  // Tìm đúng 4 cạnh khung ô viết (cạnh khung in đậm hơn vạch chia ô) — bù lệch và co giãn
  function boxAlign(px, b) {
    const dark = (x, y) => { const i = Math.round(y * S) * PW + Math.round(x * S); return i >= 0 && i < px.length ? 255 - px[i] : 0; };
    const H = y => { let v = 0; for (let x = b.x + 6; x < b.x + b.w - 6; x += 0.5) v += dark(x, y); return v; };
    // 1) cạnh trên + cạnh dưới: chọn CẶP đường ngang cách nhau đúng chiều cao ô (±1.2 mm)
    const hs = {}; for (let y = b.y - 4; y <= b.y + b.h + 4.01; y += 0.1) hs[y.toFixed(1)] = H(y);
    let best = [-1, b.y, b.y + b.h];
    for (let t = b.y - 3; t <= b.y + 3.001; t += 0.1)
      for (let d = b.h - 1.2; d <= b.h + 1.201; d += 0.1) {
        const v = (hs[t.toFixed(1)] || 0) + (hs[(t + d).toFixed(1)] || 0);
        if (v > best[0]) best = [v, t, t + d];
      }
    const top = best[1], bot = best[2];
    // 2) cạnh trái/phải: xét dải 2 mm sát cạnh trên — vạch chia ô không chạm tới dải này, chỉ khung ô chạm
    const V = x => { let v = 0; for (let y = top + 0.3; y < top + 2.0; y += 0.1) v += dark(x, y);
                     for (let y = top + 2; y < bot - 0.5; y += 0.4) v += 0.3 * dark(x, y); return v; };
    const scan = (a, z) => { let bv = -1, bp = a; for (let x = a; x <= z + 1e-9; x += 0.1) { const v = V(x); if (v > bv) { bv = v; bp = x; } } return bp; };
    const left = scan(b.x - 7, b.x + 7);
    const right = scan(left + b.w - 4, left + b.w + 3);
    return { x: left, y: top, w: right - left, h: bot - top };
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

  // Dãy 4 ô loại phiếu ở mép trên: ô đen = 1, ô trắng = 0 (ô đầu là bit cao nhất)
  function readPageId(cv, px, tpl) {
    // Dò vị trí dãy 4 ô trong ±5 mm: tại vị trí đúng, mỗi ô phải có khung vuông rõ
    // và bên trong phải hoặc đen hẳn hoặc trắng hẳn.
    const slots = tpl.page_id.slots;
    const dk = (x, y) => 255 - px[Math.round(y * S) * PW + Math.round(x * S)];
    const edge = (cx, cy) => { let v = 0;                      // độ đậm trên đường viền ô vuông 5 mm
      for (let t = -2.5; t <= 2.5; t += 0.5) v += dk(cx + t, cy - 2.5) + dk(cx + t, cy + 2.5) + dk(cx - 2.5, cy + t) + dk(cx + 2.5, cy + t);
      return v / 44; };
    let best = null;
    for (let dy = -5; dy <= 5.001; dy += 0.25)
      for (let dx = -5; dx <= 5.001; dx += 0.25) {
        let e = 0; for (const [x, y] of slots) e += edge(x + dx, y + dy);
        if (!best || e > best[0]) best = [e, dx, dy];
      }
    const [, dx, dy] = best;
    const means = slots.map(([x, y]) => regionMean(px, x + dx, y + dy, 1.5));
    if (globalThis.OMR_DEBUG) console.log('pageid', dx.toFixed(1), dy.toFixed(1), means.map(m => m.toFixed(0)).join(' '));
    if (means.some(m => m > 110 && m < 175)) return null;          // ô lưng chừng → không chắc
    const v = means.reduce((a, m) => a * 2 + (m <= 110 ? 1 : 0), 0);
    const key = tpl.page_id.types[v];
    return key && tpl.pages[key] ? { key, typeId: v } : null;
  }

  function writeInk(px, b, cells) {
    const n0 = cells || 1, cw = b.w / n0;
    let ink = 0, n = 0;
    for (let c = 0; c < n0; c++) {
      const xa = b.x + c * cw + (cells ? 1.0 : 1.3), xb = b.x + (c + 1) * cw - (cells ? 1.0 : 1.3);
      for (let yy = Math.round((b.y + 1.3) * S); yy < (b.y + b.h - 1.3) * S; yy++)
        for (let xx = Math.round(xa * S); xx < xb * S; xx++) { n++; if (px[yy * PW + xx] < 120) ink++; }
    }
    return n ? ink / n : 0;
  }

  function process(cv, rgba, tpl) {
    const src = cv.matFromImageData ? cv.matFromImageData(rgba)
      : (() => { const m = new cv.Mat(rgba.height, rgba.width, cv.CV_8UC4); m.data.set(rgba.data); return m; })();
    const gray0 = new cv.Mat(); cv.cvtColor(src, gray0, cv.COLOR_RGBA2GRAY); src.delete();
    // thử lần lượt 4 hướng xoay (ảnh chụp ngang / ngược đầu)
    const rots = [null, cv.ROTATE_90_CLOCKWISE, cv.ROTATE_180, cv.ROTATE_90_COUNTERCLOCKWISE];
    let px = null, page = null, sawCorners = false, quality = null;
    for (const rot of rots) {
      let g = gray0;
      if (rot !== null) { g = new cv.Mat(); cv.rotate(gray0, g, rot); }
      const fid = findFiducials(cv, g);
      if (fid) {
        sawCorners = true;
        const wn = warpAndNormalize(cv, g, fid, tpl), p = wn.px; quality = wn.quality;
        const id = readPageId(cv, p, tpl);
        if (id) { px = p; page = id; }
      }
      if (g !== gray0) g.delete();
      if (px) break;
    }
    gray0.delete();
    if (!px) return { ok: false, error: sawCorners
      ? 'Không nhận ra loại phiếu (dãy 4 ô nhỏ phía trên bị che, bẩn hoặc phiếu không đúng mẫu).'
      : 'Không thấy đủ 4 ô vuông đen ở góc phiếu. Chụp lại: để lộ cả 4 góc, đủ sáng, giữ yên máy.' };
    const qIssue = qualityIssue(quality);
    if (qIssue) return { ok: false, quality, qualityFail: true, error: qIssue };
    const img = new cv.Mat(PH, PW, cv.CV_8U); img.data.set(px);
    const ring = makeRing(cv);
    const T = tpl.pages[page.key];

    // mã học sinh: căn cả khối (hàng ô viết số phía trên làm mốc), rồi tinh chỉnh từng cột
    const codeItems = tpl.student_code.flat().map(p => ({ ring: p })).concat((tpl.code_boxes || []).map(b => ({ box: b })));
    const [cdx, cdy, cscore] = blockShift(cv, img, bboxOf(codeItems), codeItems);
    if (globalThis.OMR_DEBUG) console.log('code shift', cdx.toFixed(2), cdy.toFixed(2));
    if (typeof process !== 'undefined' && process.env && process.env.OMR_DEBUG) console.log('code shift', cdx, cdy, cscore);
    let code = '', codeOk = true; const codeCols = [];
    for (const col0 of tpl.student_code) {
      const col = snapScaled(cv, img, ring, col0.map(([x, y]) => [x + cdx, y + cdy]), 1.2, 1.2, 'y');
      const dx = 0, dy = 0;
      const f = col.map(([x, y]) => bubbleFeat(px, x + dx, y + dy).cov);
      if (globalThis.OMR_DEBUG) console.log('  col', dx.toFixed(2), dy.toFixed(2), f.map(v => v.toFixed(2)).join(' '));
      const order = f.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
      // ô tô rõ nhất phải đủ đậm và đậm hơn hẳn ô thứ hai (chịu được vết tẩy mờ, bóng đổ)
      const okCol = order[0][0] >= TH.codeMarked && order[1][0] < Math.max(TH.marked, order[0][0] * 0.5);
      codeOk = codeOk && okCol; code += okCol ? order[0][1] : '?';
      codeCols.push({ x: col[0][0] + dx, y0: col[0][1] + dy, y1: col[9][1] + dy });
    }

    const mcq = {}, write = {};
    const qByNum = Object.fromEntries(T.questions.map(q => [q.q, q]));
    // khối trải ngang cả trang được căn riêng nửa trái / nửa phải (phiếu cong thường lệch khác nhau hai bên)
    const MID = 105, subBlocks = [];
    for (const blk of (T.blocks || [{ qs: T.questions.map(q => q.q) }])) {
      const qs = blk.qs.map(n => qByNum[n]).filter(Boolean);
      const left = q => (q.type === 'write' ? q.box.x + q.box.w / 2 : q.options[0].x) < MID;
      const wide = q => q.type === 'write' && q.box.w > 120;
      const L = qs.filter(q => left(q) || wide(q)), Rr = qs.filter(q => !left(q) && !wide(q));
      if (!L.length || !Rr.length || !blk.header) { subBlocks.push({ header: blk.header, qs }); continue; }
      const h = blk.header;
      subBlocks.push({ header: { x: h.x, y: h.y, w: MID - h.x, h: h.h }, qs: L });
      subBlocks.push({ header: { x: MID, y: h.y, w: h.x + h.w - MID, h: h.h }, qs: Rr });
    }
    for (const blk of subBlocks) {
      const qs = blk.qs;
      const items = (blk.header ? [{ bar: blk.header }] : [])
        .concat(qs.flatMap(q => q.type === 'write' ? [{ box: q.box, cells: q.cells }] : q.options.map(o => ({ ring: [o.x, o.y] }))));
      const [bdx, bdy] = blockShift(cv, img, bboxOf(items), items);
      if (globalThis.OMR_DEBUG) console.log('block', qs[0].q + '-' + qs[qs.length - 1].q, bdx.toFixed(1), bdy.toFixed(1));
      for (const q of qs) {
        if (q.type === 'write') {
          const b0 = { x: q.box.x + bdx, y: q.box.y + bdy, w: q.box.w, h: q.box.h };
          const b = boxAlign(px, b0);   // bám đúng 4 cạnh khung ô viết
          const ink = writeInk(px, b, q.cells);
          write[q.q] = { box: b, ink, blank: ink < TH.writeInk };
          if (globalThis.OMR_DEBUG) console.log('  w', q.q, (b.x - q.box.x).toFixed(1), (b.y - q.box.y).toFixed(1), b.w.toFixed(1), b.h.toFixed(1), ink.toFixed(4));
          continue;
        }
        const pts = snapScaled(cv, img, ring, q.options.map(o => [o.x + bdx, o.y + bdy]), 2.5, 2.5, 'x');
        const opts = q.options.map((o, i) => ({ label: o.label, x: pts[i][0], y: pts[i][1], ...bubbleFeat(px, pts[i][0], pts[i][1]) }));
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
    }
    img.delete(); ring.delete();
    return { ok: true, page: page.key, level: T.level, skill: T.skill, typeId: page.typeId, code, codeOk, codeCols, mcq, write, px, width: PW, height: PH, S, quality };
  }

  const OMR = { process, detect, qualityIssue, TH, S };
  if (typeof module !== 'undefined' && module.exports) module.exports = OMR; else root.OMR = OMR;
})(typeof self !== 'undefined' ? self : this);
