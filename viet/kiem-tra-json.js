/*
 * Kiểm tra JSON kết quả Writing (KET / PET / FCE) theo viet/schema-writing.json
 *
 * Dùng được ở 2 nơi:
 *   - Trình duyệt: <script src="ajv2020.bundle.js"></script> rồi <script src="kiem-tra-json.js"></script>
 *   - Node (để test): const { taoBoKiemTra } = require('./kiem-tra-json.js')
 *
 * Cách dùng:
 *   const bo = taoBoKiemTra(schema, Ajv2020);
 *   const kq = bo.kiemTra(chuoiJson);
 *   kq.ok        -> true/false (không có lỗi nghiêm trọng)
 *   kq.loi       -> danh sách lỗi (tiếng Việt) làm JSON sai form
 *   kq.canhBao   -> danh sách cảnh báo (JSON đúng form nhưng số liệu có thể sai)
 *   kq.tomTat    -> thông tin ngắn gọn để hiển thị
 *   kq.data      -> đối tượng JSON đã đọc (nếu đọc được)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WritingJsonCheck = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  // Bảng quy đổi KET Writing (điểm thô /30 -> Scale /150), do Elaine cung cấp
  var KET_SCALE = [0, 10, 21, 31, 41, 51, 61, 72, 82, 87, 91, 96, 100, 103, 107, 110,
    113, 117, 120, 123, 125, 128, 130, 133, 135, 138, 140, 143, 145, 148, 150];

  var TEN_TRUONG = {
    schema_version: 'schema_version (phiên bản)',
    student: 'student (học sinh)',
    test: 'test (bài thi)',
    level: 'level (KET/PET/FCE)',
    parts: 'parts (các Part)',
    total: 'total (tổng điểm)',
    rubric_source: 'rubric_source (nguồn rubric)',
    criteria: 'criteria (các tiêu chí)',
    band: 'band',
    max: 'max',
    comment: 'comment (nhận xét)',
    key_takeaway: 'key_takeaway',
    id: 'id',
    raw: 'raw (điểm thô)',
    raw_max: 'raw_max (điểm thô tối đa)',
    text: 'text (bài làm)',
    genre: 'genre (thể loại)',
    part: 'part (số Part)',
    group: 'group (nhóm lỗi)',
    original: 'original (cụm gốc)',
    corrected: 'corrected (cụm sửa)',
    explanation: 'explanation (giải thích)',
    impeding: 'impeding (cản trở nghĩa)',
    kind: 'kind (loại bài mẫu)',
    to_move_up: 'to_move_up'
  };

  function tenTruong(t) { return TEN_TRUONG[t] || t; }

  // "/parts/0/criteria/1/band" -> "parts > Part số 1 > criteria > mục số 2 > band"
  function viTri(instancePath) {
    if (!instancePath) return 'toàn bộ file';
    var out = [];
    instancePath.split('/').slice(1).forEach(function (seg) {
      if (/^\d+$/.test(seg)) out.push('mục số ' + (Number(seg) + 1));
      else out.push(seg);
    });
    return out.join(' > ');
  }

  function dich(e) {
    var vt = viTri(e.instancePath);
    var p = e.params || {};
    switch (e.keyword) {
      case 'required':
        return 'Thiếu trường bắt buộc "' + p.missingProperty + '" (tại ' + vt + ').';
      case 'enum':
        return 'Giá trị không hợp lệ tại ' + vt + '. Chỉ nhận: ' + (p.allowedValues || []).join(', ') + '.';
      case 'const':
        return 'Giá trị tại ' + vt + ' phải bằng ' + JSON.stringify(p.allowedValue) + '.';
      case 'type':
        return 'Sai kiểu dữ liệu tại ' + vt + ' (cần: ' + (Array.isArray(p.type) ? p.type.join(' hoặc ') : p.type) + ').';
      case 'minItems':
        return 'Danh sách tại ' + vt + ' cần ít nhất ' + p.limit + ' mục.';
      case 'maxItems':
        return 'Danh sách tại ' + vt + ' chỉ được tối đa ' + p.limit + ' mục (KET chỉ có 3 tiêu chí, không có communicative_achievement).';
      case 'minimum':
        return 'Giá trị tại ' + vt + ' phải từ ' + p.limit + ' trở lên.';
      case 'maximum':
        return 'Giá trị tại ' + vt + ' không được vượt quá ' + p.limit + '.';
      case 'minLength':
        return 'Chuỗi tại ' + vt + ' không được để trống.';
      case 'additionalProperties':
        return 'Có trường lạ "' + p.additionalProperty + '" tại ' + vt + '.';
      case 'not':
        return 'Có mục không được phép tại ' + vt + ' (ví dụ KET không có communicative_achievement).';
      default:
        return (e.message || 'Sai form') + ' (tại ' + vt + ').';
    }
  }

  function tinhLogic(d) {
    var w = [];
    var tongRaw = 0;
    (d.parts || []).forEach(function (p, i) {
      var ten = 'Part ' + (p.part != null ? p.part : i + 1);
      var tong = 0;
      (p.criteria || []).forEach(function (c) {
        if (typeof c.band === 'number') {
          tong += c.band;
          if (typeof c.max === 'number' && c.band > c.max)
            w.push(ten + ': band "' + c.id + '" (' + c.band + ') lớn hơn max (' + c.max + ').');
        }
      });
      if (typeof p.raw === 'number' && p.raw !== tong)
        w.push(ten + ': raw = ' + p.raw + ' nhưng tổng các band = ' + tong + '.');
      if (typeof p.raw === 'number') tongRaw += p.raw;
      else tongRaw += tong;
      if (typeof p.raw_max === 'number' && typeof p.raw === 'number' && p.raw > p.raw_max)
        w.push(ten + ': raw (' + p.raw + ') lớn hơn raw_max (' + p.raw_max + ').');
      var n = (p.criteria || []).length;
      if (n && typeof p.avg_band === 'number' && Math.abs(p.avg_band - tong / n) > 0.01)
        w.push(ten + ': avg_band = ' + p.avg_band + ' nhưng tính ra ' + (tong / n).toFixed(2) + '.');
    });
    var t = d.total;
    if (t && typeof t.raw === 'number' && t.raw !== tongRaw)
      w.push('total.raw = ' + t.raw + ' nhưng cộng các Part = ' + tongRaw + '.');

    // KET: kiểm tra quy đổi Scale theo bảng
    if (d.level === 'KET' && t && typeof t.cambridge_scale === 'number' && typeof t.raw === 'number') {
      var soPart = (d.parts || []).length;
      var raw30 = soPart === 1 ? t.raw * 2 : t.raw;
      if (raw30 >= 0 && raw30 <= 30 && KET_SCALE[raw30] !== t.cambridge_scale)
        w.push('KET: điểm thô quy đổi ' + raw30 + '/30 phải ra Scale ' + KET_SCALE[raw30] + ', file ghi ' + t.cambridge_scale + '.');
      if (soPart === 1 && t.is_estimate !== true)
        w.push('KET chỉ có 1 Part nên Scale là ước lượng: is_estimate nên là true.');
      if (soPart >= 2 && t.is_estimate === true)
        w.push('KET đủ 2 Part nên is_estimate nên là false.');
    }
    return w;
  }

  function taoBoKiemTra(schema, Ajv2020) {
    var ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false });
    var validate = ajv.compile(schema);

    function kiemTra(chuoi) {
      var kq = { ok: false, loi: [], canhBao: [], tomTat: null, data: null };
      var text = String(chuoi == null ? '' : chuoi).trim();
      if (!text) { kq.loi.push('Chưa có nội dung. Hãy dán JSON vào khung hoặc tải file .json lên.'); return kq; }
      // Bỏ hàng rào ```json ... ``` nếu lỡ copy từ chat
      text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      var d;
      try { d = JSON.parse(text); }
      catch (e) {
        kq.loi.push('Không đọc được JSON: ' + e.message + '. Thường do thiếu dấu phẩy, thiếu ngoặc, hoặc còn sót chữ ngoài JSON.');
        return kq;
      }
      kq.data = d;
      var hopLe = validate(d);
      if (!hopLe) {
        var seen = {};
        (validate.errors || []).forEach(function (e) {
          if (e.keyword === 'if') return; // thông báo phụ của allOf/if-then
          var m = dich(e);
          if (!seen[m]) { seen[m] = 1; kq.loi.push(m); }
        });
      }
      if (hopLe) kq.canhBao = tinhLogic(d);
      kq.ok = kq.loi.length === 0;
      if (d && typeof d === 'object') {
        kq.tomTat = {
          hocSinh: d.student && (d.student.name || d.student.id) ? (d.student.name || '') + (d.student.id ? ' (' + d.student.id + ')' : '') : '',
          lop: d.student && d.student.class ? d.student.class : '',
          baiThi: d.test && d.test.id ? d.test.id : '',
          level: d.level || '',
          soPart: Array.isArray(d.parts) ? d.parts.length : 0,
          raw: d.total && d.total.raw != null ? d.total.raw : null,
          rawMax: d.total && d.total.raw_max != null ? d.total.raw_max : null,
          scale: d.total && d.total.cambridge_scale != null ? d.total.cambridge_scale : null,
          uocLuong: d.total ? d.total.is_estimate === true : false
        };
      }
      return kq;
    }
    return { kiemTra: kiemTra };
  }

  return { taoBoKiemTra: taoBoKiemTra, KET_SCALE: KET_SCALE };
});
