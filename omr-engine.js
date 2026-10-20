/* omr-engine.js — nhận dạng phiếu trả lời B1 PET (Ruby School)
 * Dùng chung cho app (trình duyệt) và bài test (node).
 * Đầu vào: ảnh RGBA {data,width,height} + omr-template.json
 * Đầu ra: mặt phiếu, mã học sinh, đáp án từng câu, ảnh phiếu đã nắn (gray).
 */
(function (root) {
  'use strict';
  const S = 10;                 // px / mm trong ảnh đã nắn
  const PW = 210 * S, PH = 297 * S;
  let RB = 2.3;                 // bán kính ô tròn (mm) — lấy từ omr-template.json

  // Ngưỡng (chỉnh tại đây khi hiệu chỉnh bằng bài thật)
  const TH = {
    ink: 170,          // pixel tối hơn giá trị này = có mực
    marked: 0.28,      // độ phủ >= ngưỡng này = ô có đánh dấu
    soft: 205,         // ngưỡng mực "nhạt" (bút chì mờ) — chỉ dùng để phát hiện ô tô mờ
    faintCov: 0.10,    // không ô nào đạt 'marked' nhưng có ô phủ >= mức này → báo "tô mờ" cho giáo viên duyệt
    faintSoft: 0.30,   // hoặc độ phủ mực nhạt >= mức này và vượt hẳn các ô còn lại
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
    const r = Math.round(RB * S), pad = 6, sz = 2 * (r + pad) + 1;
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
      if (it.ring) cv.circle(t, P(it.ring[0], it.ring[1]), Math.round(RB * S), new cv.Scalar(80), 3);
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
      if (it.ring) add(it.ring[0] - RB - 0.2, it.ring[1] - RB - 0.2, it.ring[0] + RB + 0.2, it.ring[1] + RB + 0.2);
      if (it.bar) add(it.bar.x, it.bar.y, it.bar.x + it.bar.w, it.bar.y + it.bar.h);
      if (it.box) add(it.box.x, it.box.y, it.box.x + it.box.w, it.box.y + it.box.h);
    }
    return b;
  }

  // Căn một KHỐI bằng phép biến đổi affine ước lượng từ tất cả các vòng tròn in sẵn trong khối (RANSAC cắt tỉa).
  // Dùng cho phiếu Speaking: ô nhỏ, hàng sát nhau, giấy cong → mỗi hàng căn riêng dễ trượt; còn cả khối có hàng chục vòng làm mốc.
  function solve3(A, b) {   // giải hệ 3x3 (khử Gauss) — trả null nếu suy biến
    const M = A.map((r, i) => [...r, b[i]]);
    for (let c = 0; c < 3; c++) {
      let p = c; for (let r = c + 1; r < 3; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-9) return null; [M[c], M[p]] = [M[p], M[c]];
      for (let r = 0; r < 3; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k < 4; k++) M[r][k] -= f * M[c][k]; }
    }
    return [M[0][3] / M[0][0], M[1][3] / M[1][1], M[2][3] / M[2][2]];
  }
  function affineFit(cv, img, ring, pts, range) {
    const identity = { f: (x, y) => [x, y], n: 0, rms: 0, used: 0 };
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), M = range + 4;
    const x0 = Math.max(0, Math.round((Math.min(...xs) - M) * S)), x1 = Math.min(PW, Math.round((Math.max(...xs) + M) * S));
    const y0 = Math.max(0, Math.round((Math.min(...ys) - M) * S)), y1 = Math.min(PH, Math.round((Math.max(...ys) + M) * S));
    const reg = img.roi(new cv.Rect(x0, y0, x1 - x0, y1 - y0)), m = new cv.Mat();
    cv.matchTemplate(reg, ring, m, cv.TM_CCOEFF_NORMED);
    const h = ring.rows >> 1, mw = m.cols, mh = m.rows, md = m.data32F, R = Math.round(range * S);
    const obs = [];
    for (const [x, y] of pts) {
      const cx = Math.round(x * S) - x0 - h, cy = Math.round(y * S) - y0 - h; let best = [-2, 0, 0];
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        const X = cx + dx, Y = cy + dy; if (X < 0 || Y < 0 || X >= mw || Y >= mh) continue;
        const v = md[Y * mw + X]; if (v > best[0]) best = [v, dx, dy];
      }
      obs.push({ x, y, ox: x + best[1] / S, oy: y + best[2] / S, sc: best[0] });
    }
    reg.delete(); m.delete();
    let use = obs.filter(o => o.sc >= 0.32);
    const mean = obs.reduce((a, o) => a + o.sc, 0) / Math.max(1, obs.length);
    if (use.length < 8) return { ...identity, n: obs.length, mean };
    let A = null;
    for (let it = 0; it < 6; it++) {
      const sol = (key) => { const N = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], b = [0, 0, 0];
        for (const o of use) { const v = [o.x, o.y, 1], t = o[key]; for (let i = 0; i < 3; i++) { b[i] += v[i] * t; for (let j = 0; j < 3; j++) N[i][j] += v[i] * v[j]; } }
        return solve3(N, b); };
      const px_ = sol('ox'), py_ = sol('oy'); if (!px_ || !py_) break; A = [px_, py_];
      const res = o => Math.hypot(A[0][0] * o.x + A[0][1] * o.y + A[0][2] - o.ox, A[1][0] * o.x + A[1][1] * o.y + A[1][2] - o.oy);
      const rs = use.map(res).sort((a, b) => a - b), med = rs[rs.length >> 1], lim = Math.max(0.35, 2.5 * med);
      const next = use.filter(o => res(o) <= lim); if (next.length < 8 || next.length === use.length) { use = next.length >= 8 ? next : use; break; } use = next;
    }
    if (!A) return { ...identity, n: obs.length, mean };
    const f = (x, y) => [A[0][0] * x + A[0][1] * y + A[0][2], A[1][0] * x + A[1][1] * y + A[1][2]];
    const rms = Math.sqrt(use.reduce((a, o) => { const [fx, fy] = f(o.x, o.y); return a + (fx - o.ox) ** 2 + (fy - o.oy) ** 2; }, 0) / use.length);
    return { f, n: obs.length, used: use.length, rms, A, mean };
  }

  // Độ khớp của MỘT bản bố cục phiếu với ảnh: lấy mẫu tối đa ~60 vòng tròn in sẵn, mỗi vòng tìm điểm khớp tốt nhất trong ±range mm,
  // trả điểm khớp trung bình (0..1). Dùng để chọn giữa các bản in khác nhau của cùng một loại phiếu (template.variants).
  function layoutFit(cv, img, ring, pts, range) {
    const step = Math.max(1, Math.floor(pts.length / 60)), h = ring.rows >> 1, R = Math.round(range * S);
    let sum = 0, n = 0;
    for (let i = 0; i < pts.length; i += step) {
      const [x, y] = pts[i], cx = Math.round(x * S), cy = Math.round(y * S);
      const rx0 = Math.max(0, cx - h - R), ry0 = Math.max(0, cy - h - R), rx1 = Math.min(PW, cx + h + R + 1), ry1 = Math.min(PH, cy + h + R + 1);
      if (rx1 - rx0 <= ring.cols || ry1 - ry0 <= ring.rows) continue;
      const reg = img.roi(new cv.Rect(rx0, ry0, rx1 - rx0, ry1 - ry0)), m = new cv.Mat();
      cv.matchTemplate(reg, ring, m, cv.TM_CCOEFF_NORMED);
      sum += cv.minMaxLoc(m).maxVal; n++; reg.delete(); m.delete();
    }
    return n ? sum / n : 0;
  }

  // Như snap() nhưng cho phép co giãn dọc theo hàng/cột (phiếu cong làm hàng A–H ngắn lại vài mm)
  function snapScaled(cv, img, ring, pts, mx, my, axis, scr) {
    const sc0 = scr ? scr[0] : 0.9, sc1 = scr ? scr[1] : 1.06;
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), M = Math.max(mx, my) + 5;
    const x0 = Math.max(0, Math.round((Math.min(...xs) - M) * S)), x1 = Math.min(PW, Math.round((Math.max(...xs) + M) * S));
    const y0 = Math.max(0, Math.round((Math.min(...ys) - M) * S)), y1 = Math.min(PH, Math.round((Math.max(...ys) + M) * S));
    const reg = img.roi(new cv.Rect(x0, y0, x1 - x0, y1 - y0)), m = new cv.Mat();
    cv.matchTemplate(reg, ring, m, cv.TM_CCOEFF_NORMED);
    const h = ring.rows >> 1, mw = m.cols, mh = m.rows, md = m.data32F;
    const [px0, py0] = pts[0];
    let best = [-1e9, 0, 0, 1];
    for (let sc = sc0; sc <= sc1 + 1e-9; sc += 0.01)
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
  function bubbleFeat(px, x, y, k1, th) {
    th = th || TH.ink;
    const cx = x * S, cy = y * S, r1 = (k1 || 0.74) * RB * S, r2 = 0.83 * RB * S, rin = 0.22 * RB * S;
    let ink = 0, n = 0; const sI = new Array(8).fill(0), sN = new Array(8).fill(0);
    for (let yy = Math.floor(cy - r2); yy <= cy + r2; yy++)
      for (let xx = Math.floor(cx - r2); xx <= cx + r2; xx++) {
        const dx = xx - cx, dy = yy - cy, d = Math.hypot(dx, dy);
        const dark = px[yy * PW + xx] < th;
        if (d < r1) { n++; if (dark) ink++; }
        if (d < r2 && d > rin) {
          const k = Math.min(7, Math.floor((Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI) * 8));
          sN[k]++; if (dark) sI[k]++;
        }
      }
    const sec = sI.map((v, i) => v / Math.max(sN[i], 1)).sort((a, b) => a - b);
    return { cov: ink / n, sec2: sec[1] };
  }

  // Đo độ phủ có dung sai: thử 9 vị trí lệch ≤ tol mm quanh tâm ô, lấy vị trí phủ nhiều nhất
  // (giấy cong / chụp nghiêng làm hàng dài bị lệch ~1 mm ở đầu xa; ô nhỏ 3 mm nên 1 mm đã đủ làm hụt mực)
  function bubbleFeatTol(px, x, y, tol, th) {
    // đo trong lõi 0.5R (vòng in sẵn nằm ở R nên không lọt vào lõi khi lệch ≤ tol) tại lưới 5×5 vị trí lệch ≤ tol; lấy vị trí phủ nhiều nhất
    let best = null; const st = tol / 2;
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
      const f = bubbleFeat(px, x + i * st, y + j * st, 0.5, th);
      if (!best || f.cov > best.cov) best = f;
    }
    return best;
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
    const ring = (cx, cy, h) => { let v = 0;                   // độ đậm trung bình trên một đường vuông nửa cạnh h
      for (let t = -h; t <= h + 1e-9; t += 0.5) v += dk(cx + t, cy - h) + dk(cx + t, cy + h) + dk(cx - h, cy + t) + dk(cx + h, cy + t);
      return v / (4 * (2 * h / 0.5 + 1)); };
    // khung ô vuông phải đậm, còn vòng ngay bên ngoài (khe giấy trắng giữa các ô) phải sáng
    const edge = (cx, cy) => ring(cx, cy, 2.5) - ring(cx, cy, 3.8);
    let best = null;
    for (let dy = -5; dy <= 5.001; dy += 0.25)
      for (let dx = -5; dx <= 5.001; dx += 0.25) {
        let e = 0; for (const [x, y] of slots) e += edge(x + dx, y + dy);
        e -= 2 * Math.hypot(dx, dy);                             // ưu tiên độ lệch nhỏ khi ngang nhau
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
    RB = tpl.bubble_radius_mm || 2.3;
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
    let T = tpl.pages[page.key], layout = 'v1';
    const variants = (tpl.variants && tpl.variants[page.key]) || [];
    if (variants.length) {   // cùng một loại phiếu nhưng in ở các đợt khác nhau (ô to / ô nhỏ…): chọn bản bố cục khớp ảnh nhất
      const cands = [T, ...variants]; let bestV = null;
      cands.forEach((cand, ci) => {
        RB = cand.bubble_radius_mm || cand.ring_mm || tpl.bubble_radius_mm || 2.3;
        const rg = makeRing(cv), pts = cand.questions.flatMap(q => q.type === 'write' ? [] : q.options.map(o => [o.x, o.y]));
        const fit = layoutFit(cv, img, rg, pts, 2.5); rg.delete();
        if (globalThis.OMR_DEBUG) console.log('layout', page.key, ci === 0 ? 'v1' : 'v' + (ci + 1), fit.toFixed(3));
        if (!bestV || fit > bestV.fit) bestV = { cand, fit, name: ci === 0 ? 'v1' : (cand.layout || 'v' + (ci + 1)) };
      });
      T = bestV.cand; layout = bestV.name;
    }
    RB = T.bubble_radius_mm || T.ring_mm || tpl.bubble_radius_mm || 2.3;     // mỗi loại phiếu có thể có cỡ ô riêng (bubble_radius_mm hoặc ring_mm)
    const ring = makeRing(cv);
    const CODE = T.student_code || tpl.student_code, CODE_BOXES = T.code_boxes || tpl.code_boxes || [];

    // mã học sinh: căn cả khối (hàng ô viết số phía trên làm mốc), rồi tinh chỉnh từng cột
    const codeItems = CODE.flat().map(p => ({ ring: p })).concat(CODE_BOXES.map(b => ({ box: b })));
    const [cdx, cdy, cscore] = blockShift(cv, img, bboxOf(codeItems), codeItems);
    if (globalThis.OMR_DEBUG) console.log('code shift', cdx.toFixed(2), cdy.toFixed(2));
    if (typeof process !== 'undefined' && process.env && process.env.OMR_DEBUG) console.log('code shift', cdx, cdy, cscore);
    let code = '', codeOk = true; const codeCols = [];
    for (const col0 of CODE) {
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
      // phiếu Speaking có hàng ô band cách đều (≈6.6 mm): giới hạn khoảng căn để không trượt sang ô bên cạnh
      const [bdx, bdy] = blockShift(cv, img, bboxOf(items), items, T.shift_range_mm || T.shift_mm || 6);
      if (globalThis.OMR_DEBUG) console.log('block', qs[0].q + '-' + qs[qs.length - 1].q, bdx.toFixed(1), bdy.toFixed(1));
      // phiếu Speaking (affine_rows): ước lượng độ méo của cả khối từ mọi vòng tròn trong khối
      let aff = null;
      if (T.affine_rows) {
        const rp = qs.filter(q => q.type !== 'write').flatMap(q => q.options.map(o => [o.x + bdx, o.y + bdy]));
        if (rp.length >= 8) { aff = affineFit(cv, img, ring, rp, T.affine_range_mm || 2.2); if (globalThis.OMR_DEBUG) console.log('affine', qs[0].q, 'rings', aff.n, 'used', aff.used, 'rms', (aff.rms || 0).toFixed(2)); }
      }
      for (const q of qs) {
        if (q.type === 'write') {
          const b0 = { x: q.box.x + bdx, y: q.box.y + bdy, w: q.box.w, h: q.box.h };
          const b = boxAlign(px, b0);   // bám đúng 4 cạnh khung ô viết
          // ink_skip_top: bỏ qua dải trên của khung (chữ in sẵn như "Examiner note") khi đo mực
          const bi = q.ink_skip_top ? { x: b.x, y: b.y + q.ink_skip_top, w: b.w, h: b.h - q.ink_skip_top } : b;
          const ink = writeInk(px, bi, q.cells);
          write[q.q] = { box: b, ink, blank: ink < TH.writeInk };
          if (globalThis.OMR_DEBUG) console.log('  w', q.q, (b.x - q.box.x).toFixed(1), (b.y - q.box.y).toFixed(1), b.w.toFixed(1), b.h.toFixed(1), ink.toFixed(4));
          continue;
        }
        // phiếu Speaking: hàng cách nhau ~5 mm nên chỉ cho căn lại rất nhỏ (row_snap_mm) và không co giãn (row_scale: false)
        const rsn = T.row_snap_mm != null ? T.row_snap_mm : 2.5;
        const pts = aff && aff.used ? q.options.map(o => aff.f(o.x + bdx, o.y + bdy))
          : snapScaled(cv, img, ring, q.options.map(o => [o.x + bdx, o.y + bdy]), rsn, rsn, 'x', T.row_scale === false ? [1, 1] : null);
        const tol = T.bubble_tol_mm || 0;
        const opts = q.options.map((o, i) => ({ label: o.label, x: pts[i][0], y: pts[i][1], ...(tol ? bubbleFeatTol(px, pts[i][0], pts[i][1], tol) : bubbleFeat(px, pts[i][0], pts[i][1])) }));
        // dung sai đo (bubble_tol_mm) làm nét vòng tròn in sẵn lọt vào vùng đo (~0.2–0.26) nên phiếu Speaking dùng ngưỡng riêng
        const tMark = T.marked_cov != null ? T.marked_cov : TH.marked, tFull = T.full_cov != null ? T.full_cov : TH.fullCov;
        const marked = opts.filter(o => o.cov >= tMark);
        let status, answer = '';
        if (q.mode === 'multi' || q.multi) { status = 'ok'; answer = marked.map(o => o.label).join('|'); }   // dòng chọn nhiều: mọi tổ hợp hợp lệ
        else if (marked.length === 0) {
          status = 'blank';
          // tô mờ: nét chì nhạt hoặc tô dở dang không đủ để tính là "đã tô" → không tự tính sai mà báo giáo viên duyệt
          const soft = opts.map((o, i) => (tol ? bubbleFeatTol(px, pts[i][0], pts[i][1], tol, TH.soft) : bubbleFeat(px, pts[i][0], pts[i][1], undefined, TH.soft)).cov);
          opts.forEach((o, i) => { o.soft = soft[i]; });
          const ord = opts.map((o, i) => i).sort((a, b) => Math.max(opts[b].cov, 0) - Math.max(opts[a].cov, 0));
          const bi = [...opts.keys()].sort((a, b) => soft[b] - soft[a])[0], si = [...soft].sort((a, b) => b - a)[1] || 0;
          const byCov = opts[ord[0]].cov >= TH.faintCov, bySoft = soft[bi] >= TH.faintSoft && soft[bi] - si >= 0.2;
          if (byCov || bySoft) { const w = byCov ? opts[ord[0]] : opts[bi]; status = 'faint'; answer = w.label; }
        }
        else if (marked.length > 1) { status = 'multi'; answer = marked.map(o => o.label).join(''); }
        else {
          answer = marked[0].label;
          status = (marked[0].cov >= tFull && marked[0].sec2 >= TH.fullSector) ? 'ok' : 'nonstd';
        }
        mcq[q.q] = { answer, status, part: q.part, row: { x0: opts[0].x - 4, x1: opts[opts.length - 1].x + 4, y: opts[0].y },
          opts: opts.map(o => ({ label: o.label, cov: +o.cov.toFixed(2), sec2: +o.sec2.toFixed(2), x: +o.x.toFixed(2), y: +o.y.toFixed(2) })) };
      }
    }
    img.delete(); ring.delete();
    return { ok: true, page: page.key, layout, level: T.level, skill: T.skill, typeId: page.typeId, code, codeOk, codeCols, mcq, write, px, width: PW, height: PH, S, quality };
  }

  const OMR = { process, detect, qualityIssue, TH, S };
  if (typeof module !== 'undefined' && module.exports) module.exports = OMR; else root.OMR = OMR;
})(typeof self !== 'undefined' ? self : this);
