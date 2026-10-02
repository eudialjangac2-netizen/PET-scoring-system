# Nhật ký dự án và kế hoạch

File này cho cả hai người code xem nhanh: đã làm gì, đã đổi file nào, sắp làm gì, và ai đang giữ phần nào. Mỗi lần merge một nhánh, người merge thêm một dòng vào mục "Đã làm" và cập nhật mục "Kế hoạch".

Quy tắc: file nào thuộc người nào thì chỉ người đó sửa. Muốn sửa file chung (đánh dấu CHUNG) thì báo người kia trước khi merge.

## Ai giữ phần nào

| Phần | Người giữ | File |
|---|---|---|
| OMR, Reading, Listening, chấm bài, app | Bạn code (OMR) | `cham-bai.*`, `omr-*.js`, `de-thi/`, `cap-do.json` |
| Writing: hợp đồng JSON, kiểm tra JSON, thiết kế phiếu | Elaine (code cùng Claude) | thư mục `viet/` |
| File CHUNG (cần báo nhau) | cả hai | `cham-bai.js`, `cham-bai.html`, `cham-bai.css`, `README.md` |

## Đã làm (mới nhất ở trên)

| Ngày | Nhánh / PR | Nội dung | File thay đổi |
|---|---|---|---|
| 2026-10-02 | `viet-yeu-cau-part` (chồng lên PR #9) | Thẻ Reading/Listening trang 2 có dòng "Yêu cầu Part x" (bảng 1 câu cho từng Part của KET/PET/FCE, sửa chữ ở `viet/yeu-cau-part.js`) và liệt kê tối đa 3 số câu cần xem lại. Test-taking Habits ghi số câu bỏ trống và tô chưa đúng cách (R22, L8...). Speaking KET: thêm nhận xét cho ô "keeps exchange going" và nhận xét dự phòng cho band 1. Sửa nhỏ `cham-bai.js` (hàm chẩn đoán) và `cham-bai.html` (nạp script). | `viet/yeu-cau-part.js`, `viet/speaking-*.js`, `viet/phieu-trang.*`, `cham-bai.js`, `cham-bai.html` (CHUNG) |
| 2026-10-02 | `viet-yeu-cau-part` | Bước mới 7 "Bài làm máy" (Kết quả thành bước 8): app đọc bài FCE làm trên máy từ Google Sheet "FCE RUBY MOCK TESTS RESULTS" (tab Raw Answers + FCE Results; hoặc tải file .xlsx lên nếu sheet chưa mở chia sẻ). Điểm lấy từ cột POINTS của sheet, giữ bài mới nhất của mỗi học sinh/kỹ năng, ghép học sinh theo mã (STUDENT ID = mã lớp hoặc 6 số cuối). TIMESTAMP chỉ là giờ nộp bài nên chưa có thời gian từng Part. Số lần vi phạm chỉ hiện ở phần cảnh báo cho giáo viên. Thêm đề `fce_practice_test05`, `fce_practice_test06` vào `de-thi/` (đáp án lấy từ repo ruby-fce-mock-tests, nguồn fce-ebook). Sửa `results()` trong `cham-bai.js` (Uyên cần xem). | `viet/nhap-may.js`, `de-thi/fce_practice_test05-06.json` + `manifest.json`, `cham-bai.js`, `cham-bai.html` (CHUNG) |
| 2026-10-02 | `viet-speaking-the-3-phan` | Thẻ Speaking trang 2 theo bản mẫu của Uyên: dòng mô tả tiêu chí, Điểm mạnh, Cần cải thiện, How to fix (Strength không còn nằm ở Teacher's Overall Comment trang 1). Đã chạy thử trong app: ảnh phiếu chấm Speaking PET giả lập tải lên bước quét, ra đúng band và mã chẩn đoán, bước 6 hiện "Đã quét". | `viet/phieu-trang.js`, `viet/phieu-trang.css` |
| 2026-10-01 | PR #8 `viet-speaking-diem-yeu` (đã merge) | Speaking trọn bộ: (1) thẻ Speaking trong "Why Points Are Being Lost" chọn điểm yếu theo 3 tầng của Elaine, nhận xét tiếng Việt từ ngân hàng `speaking-bank.js`; (2) bước 6 "Speaking" nhập tay band, mã chẩn đoán, part yếu (nhãn tiếng Anh như phiếu giấy); (3) quét phiếu chấm Speaking PET/KET/FCE như Reading/Listening (loại trang 8/9/10, mã học sinh 6 cột riêng từng trang), ô thiếu hoặc tô trùng gắn cờ xem lại; (4) bảng quy đổi điểm thô -> Scale (KET 0-45, PET 0-30, FCE 0-60), Speaking vào Overall và cột Excel/CSV. Đã test trên ảnh giả lập từ PDF thật. | `viet/speaking-*.js`, `viet/speaking-nhap.css`, `viet/phieu-trang.*`, `cham-bai.*` (CHUNG), `omr-engine.js`, `omr-template.json` (của Uyên) |
| 2026-10-01 | `viet-bieu-do-chung-truc` | Trang 1: gộp hai biểu đồ thành một khung dùng chung trục điểm (theo đề xuất của Uyên, Elaine duyệt). Cột điểm từng kỹ năng bên trái, đường Overall qua các Mock bên phải, mỗi chấm ghi tên Mock và điểm; thêm câu tóm tắt song ngữ dưới biểu đồ. Không đụng file chung. | `viet/phieu-trang.js`, `viet/phieu-trang.css` |
| 2026-10-01 | `viet-phieu-writing-2-trang` (chờ merge) | Bước 4: phiếu Writing đầy đủ hơn. Bỏ giới hạn 6 lỗi, thêm bài mẫu `improved`, nhận xét chi tiết, Key takeaway. KET gọn 1 trang mỗi Part; PET và FCE 2 trang mỗi Part (A: bài làm và điểm tiêu chí, B: lỗi, bài mẫu, nhận xét, checklist), nhiều lỗi thì tự tràn sang trang kế. Tổng số trang phiếu tính tự động. Skill mới `ruby-writing-json` (trong tài khoản Elaine, không nằm trong repo) hỏi JSON/Word/cả hai, mặc định JSON. Sửa `cham-bai.js` ở hàm `reportPages` (khoảng 12 dòng). | `viet/writing-report.js`, `viet/HOP-DONG-JSON.md`, `viet/mau-pet-day-du.json`, `viet/mau-fce-day-du.json`, `viet/phieu-mau-v2.html`, `cham-bai.js` (CHUNG, chỉ `reportPages`) |
| 2026-10-01 | PR #4 `viet-gan-phieu` (đã merge) | Bước 1: gắn phiếu 4 trang vào app. Mỗi học sinh ra 2 trang (Performance Overview, Results Analysis) + 1 trang cho mỗi Part Writing; chưa có Writing thì chỉ 2 trang. Xem trước nhiều trang, tải JPG từng trang, PDF nhiều trang, phiếu cả lớp. Ô nhận xét (tối đa 700 ký tự) và 3 ưu tiên (mỗi ý 140 ký tự) do app gợi ý, giáo viên sửa. Speaking và Use of English tạm hiện "Not graded yet"; chưa có lịch sử Mock nên chưa có mũi tên tăng/giảm; Overall ghi "Provisional" khi thiếu kỹ năng. Đã thử với dữ liệu giả KET, PET, FCE. | `cham-bai.js`, `cham-bai.html`, `cham-bai.css` (CHUNG), `viet/phieu-trang.*`, `viet/writing-report.*`, `viet/phieu-font.css`, `viet/fonts/` |
| 2026-09-30 | `viet-phieu-writing` (đã gộp vào PR #4) | Thiết kế phiếu 4 trang cho phụ huynh, bản v4 (font Be Vietnam Pro gắn sẵn trong `viet/fonts/`, phụ đề tiếng Việt dưới tiêu đề tiếng Anh, Overall theo màu cấp độ, màu kỹ năng dùng chung mọi cấp độ, tiêu đề tiếng Anh, biểu đồ kết hợp cột + đường Overall, bảng màu pastel riêng từng kỹ năng, mẫu KET Mock 1 chưa có lịch sử). JSON Writing thêm `severity` ở từng lỗi để chỉnh độ đậm nhạt. CHƯA gắn vào app: trang 1 Performance Overview, trang 2 Learning Diagnosis, trang 3-4 Writing Part 1 và Part 2. Thêm bảng màu pastel theo cấp độ, Grade A/B/C, biểu đồ 5 Mock. JSON Writing thêm 3 trường tùy chọn `strengths`, `issues`, `checklist`. | `viet/phieu-trang.js`, `viet/phieu-trang.css`, `viet/phieu-mau-v2.html`, `viet/writing-report.js`, `viet/writing-report.css`, `viet/schema-writing.json`, `viet/mau-*-day-du.json` |
| 2026-09 | PR `viet-gan-buoc4` (đã merge) | Thêm bước 5 "Writing" vào app: dán hoặc tải JSON, kiểm tra, ghép theo học sinh, hiện trong bảng Kết quả và xuất CSV/Excel. | `cham-bai.html`, `cham-bai.js`, `cham-bai.css` (CHUNG) |
| 2026-09 | PR #2 `viet-kiem-tra-json` (đã merge) | Trang kiểm tra JSON Writing (báo lỗi tiếng Việt). | `viet/kiem-tra-json.*`, `viet/ajv2020.bundle.js` |
| 2026-09 | PR #1 `viet-writing` (đã merge) | Hợp đồng JSON Writing v1.0 cho KET/PET/FCE, bảng quy đổi KET. | `viet/schema-writing.json`, `viet/HOP-DONG-JSON.md` |

## Đang làm

- Elaine: đã xong phiếu Speaking, dòng "Yêu cầu Part", bước 7 "Bài làm máy" (FCE) và trang 2 đủ các kỹ năng (PR #9, #10 đã merge). Tiếp theo: chạy thử bằng dữ liệu thật trên bản chính thức, sau đó làm tách Use of English.
- Uyên: ghi vào mục "Uyên cập nhật" bên dưới. Đã test quét phiếu Speaking, đang làm lưu lịch sử Mock và đồng bộ Google Sheet.

## Kế hoạch

1. (XONG, PR #4) Gắn phiếu 4 trang vào app.
2. (XONG, PR #8, #9) Speaking: nhập tay, quét phiếu chấm, bảng quy đổi, thẻ chẩn đoán, thẻ trang 2 theo mẫu của Uyên.
   (XONG, PR #10) Dòng "Yêu cầu Part", số câu trong Habits, bước 7 "Bài làm máy" cho FCE trên máy, mỗi kỹ năng 1 thẻ ở trang 2.
3. Elaine: kiểm tra bản chính thức bằng dữ liệu FCE thật (Raw Answers, Writing, Speaking), rồi tách Use of English thành kỹ năng riêng cho FCE (chạm `cap-do.json` và phần tính điểm Reading của Uyên, cần báo Uyên trước), làm sau khi xong phiếu Speaking.
4. Uyên: lưu lịch sử điểm theo học sinh qua 5 Mock để vẽ biểu đồ và tính tăng/giảm so với Mock trước (mã học sinh làm khóa).
5. Uyên: đồng bộ Google Sheet có cột Writing và Speaking (Apps Script).
6. (XONG) Skill `ruby-writing-json` cho giáo viên: hỏi JSON, Word hoặc cả hai.

## Cần thống nhất giữa hai người

- Chỗ lưu lịch sử 5 Mock của mỗi học sinh (mã học sinh làm khóa): Uyên làm, ghi lại quyết định ở đây khi chốt.
- Grade A/B/C: đang dùng mốc Cambridge English Scale chung cho từng kỹ năng và Overall: KET A 140, B 133, C 120; PET A 160, B 153, C 140; FCE A 180, B 173, C 160. Elaine đã xác nhận (02/10/2026).
- Nhận xét tổng thể và 3 ưu tiên: app gợi ý, giáo viên sửa, giới hạn 700 ký tự và 3 ý (mỗi ý khoảng 140 ký tự).

## Thay đổi file CHUNG đã merge (Uyên cần kéo main mới về)

- PR #4 đã sửa `cham-bai.js` (thêm `reportModel`, `reportPages`, `renderReportCanvases`, viết lại `studentReport`/`classReport`; thêm `S.priorities`; giữ `reportHTML` cũ làm phương án dự phòng), `cham-bai.html` (modal nhiều trang, ô 3 ưu tiên, nạp font/CSS/JS trong `viet/`), `cham-bai.css` (vài dòng). Uyên cần `git pull` (hoặc tải main mới) trước khi sửa tiếp các file này.

- PR #8 đã sửa `omr-engine.js` (bán kính ô tô theo `ring_mm`, `shift_mm` và `marked_cov` riêng từng trang, dòng nhiều ô tô mượn độ lệch từ dòng đơn gần nhất; mặc định giữ nguyên nên Reading/Listening không đổi), `omr-template.json` (thêm 3 page Speaking, page_id types 8/9/10), `cham-bai.js` (`recordSpeaking`, `S.speaking`, cột Speaking, quy đổi điểm), `cham-bai.html` (bước 6 Speaking). Uyên cần `git pull` main trước khi sửa tiếp.

- PR #10 đã sửa `cham-bai.js` (hàm `results()` đọc thêm `S.online` cho bài FCE làm trên máy, `onlineFromFiles`/`applyOnline`/`renderOnline`, bước `online` trong `go()`; hàm chẩn đoán trang 2 chọn 1 Part yếu nhất mỗi kỹ năng và giới hạn số câu trong Questions to Review), `cham-bai.html` (bước 7 "Bài làm máy", Kết quả thành bước 8, nạp `viet/nhap-may.js` và `viet/yeu-cau-part.js`), `de-thi/` (thêm `fce_practice_test05.json`, `fce_practice_test06.json`, sửa `manifest.json`). Uyên cần `git pull` main trước khi sửa tiếp.

Uyên cập nhật (Uyên tự ghi, mới nhất ở trên)
Ngày	Đang làm / đã làm	File đụng tới	Cần Elaine biết gì
02/10/2026	Nhánh uyen-mock-daily-lich-su (chưa merge). (1) Chọn Mock hoặc Bài hàng ngày ở bước 1 (nhãn loai trong manifest.json, tab Sheet riêng "Hằng ngày PET/KET/FCE", bài hàng ngày chỉ có điểm thô và %, không có phiếu báo điểm). (2) Lý do câu điền sai: 8 lựa chọn trong bước Câu viết, lời khuyên ở ly-do-cau-dien.json. (3) Lịch sử Mock: mũi tên ▲▼ và biểu đồ tiến bộ (xem mục "Cần thống nhất"). (4) Chọn hai đề khác nhau cho Reading và Listening ở bước 1 (ghép đáp án, không cần file đề mới). (5) Engine và template: Speaking căn theo cả khối, đọc đúng 72/72 dòng trên 3 ảnh điện thoại thật (PET, KET, FCE); Reading/Listening có thêm bố cục phiếu ô nhỏ mới, tự nhận giữa ô to cũ và ô nhỏ mới. (6) Trang 2: mỗi kỹ năng một thẻ "Why Points Are Being Lost", giữ req và danh sách câu của Elaine, thêm lý do câu điền.	cham-bai.js, cham-bai.html, cham-bai.css (CHUNG), omr-engine.js, omr-template.json, ly-do-cau-dien.json (mới), viet/speaking-quet.js (file của Elaine), cap-do.json (tuỳ chọn), Apps Script (không nằm trong repo)	(a) Em sửa viet/speaking-quet.js của Elaine: chỉ thêm WP_ORDER, khi tô nhiều Part ở "Notably weak part" thì lấy theo thứ tự Uyên đã chốt (PET P2, P3, P1, P4; KET P2, P1; FCE P3, P2, P4, P1) thay vì Part đầu tiên. Elaine xem và đồng ý thì merge. (b) reportModel giờ có first: false, d từng kỹ năng, overall.d và history khi có Mock trước; renderer của Elaine dùng được sẵn, không cần sửa. (c) omr-template.json thêm variants (bố cục phiếu R/L mới) và affine_rows cho 3 trang Speaking; các trường ring_mm, shift_mm, marked_cov của Elaine vẫn được dùng. (d) cap-do.json: nếu Uyên merge bản PET dùng bảng chính thức thì Elaine kéo main mới trước khi tách Use of English (đã dự kiến chạm file này).
