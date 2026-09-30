# Hợp đồng JSON - kết quả chấm Writing

Đây là định dạng file JSON mà phần chấm Writing xuất ra, để phần app (OMR, giao diện, Google Sheet) đọc vào. Định nghĩa máy đọc được nằm ở `schema-writing.json`. Ví dụ đầy đủ: `mau-ket-part6.json`, `mau-pet-part1.json`, `mau-fce-part1.json`.

Phiên bản hiện tại: `1.0`. Đổi định dạng thì tăng `schema_version` và báo người kia.

## Nguyên tắc

- Một file = một học sinh, một bài test.
- Tên file: `<ID>_<Lớp>_<Tên>_<Test>.json`, dấu `/` của lớp đổi thành `-` (ví dụ `61036TT_6-1_Sunny_Test 01.json`). Quy ước này trùng với tên file báo cáo Word.
- `student.id` trùng cột STUDENT ID của tab DANH SÁCH, `test.id` trùng `id` trong `de-thi/manifest.json`. Đây là hai khóa để app ghép Writing với điểm Reading, Listening.
- Mỗi tiêu chí band 0-5. Nhận xét và Key Takeaway viết bằng tiếng Việt, xưng "cô" và gọi học sinh là "em".

## Nguồn rubric (chuẩn để chấm)

| Cấp độ | Nguồn chuẩn | Ghi vào `rubric_source` |
|---|---|---|
| FCE | Skill `fce-writing-grader` (chuẩn mới nhất) | `fce-writing-grader` |
| PET | Skill `pet-writing-grader` | `pet-writing-grader` |
| KET | Skill `ket-writing-grader` (đã calibration theo 48 bài mẫu Cambridge) | `ket-writing-grader` |

Nếu rubric của một cấp độ đổi cấu trúc (ví dụ thêm tiêu chí), tăng `schema_version` và báo người kia.

## Khác biệt giữa các cấp độ

| | KET (A2 Key) | PET (B1 Preliminary) | FCE (B2 First) |
|---|---|---|---|
| Tiêu chí | 3: `content`, `organisation`, `language` | 4: thêm `communicative_achievement` | 4 như PET |
| Điểm tối đa mỗi Part | 15 | 20 | 20 |
| Loại bài (`genre`) | `short_message`, `email`, `story` | Part 1 `email`; Part 2 `article` hoặc `story` | Part 1 `essay`; Part 2 `article`, `story`, `review`, `letter_email` (đề for Schools không có Letter of Application, Report) |
| Bài mẫu (`improved`) | `improved_sample` (theo prompt) | Improved Version, hoặc Advanced Suggestions nếu band trung bình 4-5 | Improved Version, hoặc Advanced Suggestions nếu band trung bình 4-5 |
| Quy đổi điểm | Chưa có | Bảng /40 sang thang 170, kèm Grade A/B/C, Level A2, Below Scale | Bảng /40 sang thang 190 |

Schema tự kiểm tra: KET không được có `communicative_achievement` và `raw_max` phải là 15; PET, FCE phải đủ 4 tiêu chí và `raw_max` là 20.

## Các trường chính

| Trường | Ý nghĩa |
|---|---|
| `schema_version` | Luôn là `"1.0"` |
| `rubric_source` | Nguồn rubric, xem bảng trên |
| `level` | `KET`, `PET` hoặc `FCE` |
| `student` | `id`, `name`, `class` |
| `test` | `id` (khớp `manifest.json`), `label` (tên bài kiểm tra) |
| `parts[]` | Mỗi Part đã chấm. Chỉ đưa vào các Part được chỉ định chấm. |
| `parts[].part`, `genre` | Số Part và loại bài |
| `parts[].task`, `text`, `word_count` | Đề bài, bài làm cuối cùng của học sinh (không chép các từ đã gạch bỏ), số từ |
| `parts[].original_note` | Ghi chú nếu bài là ảnh chụp chữ viết tay |
| `parts[].criteria[]` | `id`, `band`, `max`, `comment`, `to_move_up`, `key_takeaway` |
| `parts[].errors[]` | `group`, `original`, `corrected`, `explanation`, `impeding`. Theo prompt KET, PET, FCE chỉ liệt kê lỗi Language (`grammar`, `vocabulary`); báo cáo Word của skill FCE dùng đủ 5 nhóm (`content`, `style`, `organisation`, `grammar`, `vocabulary`). |
| `parts[].general_feedback` | Đoạn tổng kết ưu điểm và điểm cần khắc phục |
| `parts[].improved` | `kind` (`improved_version`, `advanced_suggestions`, `improved_sample`), `text`, `word_count` |
| `parts[].raw`, `raw_max`, `avg_band` | Điểm thô của Part, tối đa, band trung bình |
| `total` | `raw`, `raw_max`, `cambridge_scale`, `grade`, `is_estimate`, `avg_band` |
| `report_url` | Link báo cáo Word hoặc Google Docs nếu có |

## Điểm số

- Chấm đủ Part 1 và Part 2 (FCE, PET): `total.raw` là tổng /40, tra bảng quy đổi của skill tương ứng để lấy `cambridge_scale` (FCE tối đa 190, PET tối đa 170). PET có thêm `grade` (Grade A, B, C, Level A2, Below Scale) và `is_estimate` là `false`.
- Chỉ chấm một Part: theo cách của skill PET, có thể nhân đôi điểm thô để ước lượng full test. Khi đó `is_estimate` là `true` và báo cáo phải ghi rõ đây là ước lượng. Nếu không muốn ước lượng, để `cambridge_scale` là `null`.
- KET: mỗi Part /15. Chấm đủ Part 6 và Part 7 thì `total.raw` là tổng /30 (`raw_max` là 30) và tra bảng KET Writing Scale (tối đa 150, xem bảng trong skill `ket-writing-grader`), `is_estimate` là `false`. Chỉ chấm một Part thì nhân đôi để ước lượng, `is_estimate` là `true`. `grade` để `null` vì chưa có quy tắc Grade/CEFR cho KET Writing.

## Điều cần thống nhất giữa hai người (chưa chốt)

1. Bài mẫu KET band 0-1 để hoàn thiện calibration (bảng quy đổi Scale đã có).
2. (Đã làm, xem mục cuối) Cách app đọc JSON Writing. Lưu ý: bước 4 "Câu viết" của app là chấm các ô điền đáp án Reading/Listening, KHÔNG phải bài Writing, nên Writing có bước riêng. Ý ban đầu: Elaine đã chọn hai cách, cần người code app (`cham-bai.*`) thực hiện: (a) một khung để dán JSON vào, app kiểm tra ngay JSON có đúng form (`schema-writing.json`) không và báo lỗi cụ thể; (b) hoặc tải file .json lên, kiểm tra cùng cách. Cả hai cách dùng chung một hàm kiểm tra. Cần thống nhất trước khi sửa `cham-bai.js`.

## Công cụ kiểm tra JSON (đã làm xong)

- `viet/kiem-tra-json.html`: trang có khung dán JSON, nút tải file .json lên và 3 nút xem thử mẫu. Báo lỗi đúng form bằng tiếng Việt, và cảnh báo khi số liệu không khớp (raw khác tổng band, sai quy đổi KET Scale).
- `viet/kiem-tra-json.js`: hàm kiểm tra dùng chung, để gắn vào bước 4 "Câu viết" của app: `WritingJsonCheck.taoBoKiemTra(schema, Ajv2020).kiemTra(chuoiJson)` trả về `{ ok, loi, canhBao, tomTat, data }`.
- `viet/ajv2020.bundle.js`: thư viện Ajv (JSON Schema 2020-12) đóng gói sẵn, không cần internet.
- Mở trang qua địa chỉ web của app (ví dụ `/viet/kiem-tra-json.html`), không mở trực tiếp file từ máy vì trang cần đọc `schema-writing.json`.

## Bước 5 "Writing" trong app (đã gắn)

- Nav có thêm bước 5 "Writing"; "Kết quả" thành bước 6.
- Dán JSON hoặc tải file .json lên (nhiều file cùng lúc được). App kiểm tra bằng `kiem-tra-json.js`, chặn JSON sai form hoặc sai cấp độ (JSON KET vào lớp PET), cảnh báo nếu `test.id` khác đề đang chấm.
- Ghép học sinh theo `student.id`: khớp mã đầy đủ (ví dụ `C260125MC`) hoặc 6 số đầu (`260125`). Không khớp thì hiện danh sách lớp để chọn tay.
- Lưu trong `S.writing[key]` (cùng nơi lưu phiên chấm trên máy, IndexedDB).
- Bảng Kết quả, file CSV và Excel có thêm cột Writing (điểm thô, tối đa, thang) khi lớp có ít nhất một bài Writing.
- Chưa làm: đưa Writing vào phiếu kết quả PDF từng học sinh và vào bản sao lưu Google Sheet (cần chốt cột với Apps Script).
