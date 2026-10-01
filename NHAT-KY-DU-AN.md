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
| 2026-10-01 | `viet-bieu-do-chung-truc` | Trang 1: gộp hai biểu đồ thành một khung dùng chung trục điểm (theo đề xuất của Uyên, Elaine duyệt). Cột điểm từng kỹ năng bên trái, đường Overall qua các Mock bên phải, mỗi chấm ghi tên Mock và điểm; thêm câu tóm tắt song ngữ dưới biểu đồ. Không đụng file chung. | `viet/phieu-trang.js`, `viet/phieu-trang.css` |
| 2026-10-01 | `viet-phieu-writing-2-trang` (chờ merge) | Bước 4: phiếu Writing đầy đủ hơn. Bỏ giới hạn 6 lỗi, thêm bài mẫu `improved`, nhận xét chi tiết, Key takeaway. KET gọn 1 trang mỗi Part; PET và FCE 2 trang mỗi Part (A: bài làm và điểm tiêu chí, B: lỗi, bài mẫu, nhận xét, checklist), nhiều lỗi thì tự tràn sang trang kế. Tổng số trang phiếu tính tự động. Skill mới `ruby-writing-json` (trong tài khoản Elaine, không nằm trong repo) hỏi JSON/Word/cả hai, mặc định JSON. Sửa `cham-bai.js` ở hàm `reportPages` (khoảng 12 dòng). | `viet/writing-report.js`, `viet/HOP-DONG-JSON.md`, `viet/mau-pet-day-du.json`, `viet/mau-fce-day-du.json`, `viet/phieu-mau-v2.html`, `cham-bai.js` (CHUNG, chỉ `reportPages`) |
| 2026-10-01 | PR #4 `viet-gan-phieu` (đã merge) | Bước 1: gắn phiếu 4 trang vào app. Mỗi học sinh ra 2 trang (Performance Overview, Results Analysis) + 1 trang cho mỗi Part Writing; chưa có Writing thì chỉ 2 trang. Xem trước nhiều trang, tải JPG từng trang, PDF nhiều trang, phiếu cả lớp. Ô nhận xét (tối đa 700 ký tự) và 3 ưu tiên (mỗi ý 140 ký tự) do app gợi ý, giáo viên sửa. Speaking và Use of English tạm hiện "Not graded yet"; chưa có lịch sử Mock nên chưa có mũi tên tăng/giảm; Overall ghi "Provisional" khi thiếu kỹ năng. Đã thử với dữ liệu giả KET, PET, FCE. | `cham-bai.js`, `cham-bai.html`, `cham-bai.css` (CHUNG), `viet/phieu-trang.*`, `viet/writing-report.*`, `viet/phieu-font.css`, `viet/fonts/` |
| 2026-09-30 | `viet-phieu-writing` (đã gộp vào PR #4) | Thiết kế phiếu 4 trang cho phụ huynh, bản v4 (font Be Vietnam Pro gắn sẵn trong `viet/fonts/`, phụ đề tiếng Việt dưới tiêu đề tiếng Anh, Overall theo màu cấp độ, màu kỹ năng dùng chung mọi cấp độ, tiêu đề tiếng Anh, biểu đồ kết hợp cột + đường Overall, bảng màu pastel riêng từng kỹ năng, mẫu KET Mock 1 chưa có lịch sử). JSON Writing thêm `severity` ở từng lỗi để chỉnh độ đậm nhạt. CHƯA gắn vào app: trang 1 Performance Overview, trang 2 Learning Diagnosis, trang 3-4 Writing Part 1 và Part 2. Thêm bảng màu pastel theo cấp độ, Grade A/B/C, biểu đồ 5 Mock. JSON Writing thêm 3 trường tùy chọn `strengths`, `issues`, `checklist`. | `viet/phieu-trang.js`, `viet/phieu-trang.css`, `viet/phieu-mau-v2.html`, `viet/writing-report.js`, `viet/writing-report.css`, `viet/schema-writing.json`, `viet/mau-*-day-du.json` |
| 2026-09 | PR `viet-gan-buoc4` (đã merge) | Thêm bước 5 "Writing" vào app: dán hoặc tải JSON, kiểm tra, ghép theo học sinh, hiện trong bảng Kết quả và xuất CSV/Excel. | `cham-bai.html`, `cham-bai.js`, `cham-bai.css` (CHUNG) |
| 2026-09 | PR #2 `viet-kiem-tra-json` (đã merge) | Trang kiểm tra JSON Writing (báo lỗi tiếng Việt). | `viet/kiem-tra-json.*`, `viet/ajv2020.bundle.js` |
| 2026-09 | PR #1 `viet-writing` (đã merge) | Hợp đồng JSON Writing v1.0 cho KET/PET/FCE, bảng quy đổi KET. | `viet/schema-writing.json`, `viet/HOP-DONG-JSON.md` |

## Đang làm

- Elaine: chuẩn bị bước 2 (Speaking, tách Use of English), chờ phiếu chấm Speaking và thống nhất với Uyên.
- Uyên: ghi vào mục "Uyên cập nhật" bên dưới.

## Kế hoạch

1. (XONG, đã merge PR #4) Gắn phiếu 4 trang vào app.
2. Tách Use of English thành kỹ năng riêng cho FCE (chạm `cap-do.json` và phần tính điểm Reading của bạn code).
3. Speaking: phiếu chấm Speaking làm cùng kiểu Reading/Listening (Elaine đang làm phiếu). App nhận điểm 4 tiêu chí, mỗi tiêu chí 0-5.
4. Lưu lịch sử điểm theo học sinh qua 5 Mock để vẽ biểu đồ và tính tăng/giảm so với Mock trước (cần thống nhất chỗ lưu, xem "Cần thống nhất").
5. Skill/prompt cho giáo viên: AI hỏi giáo viên cần JSON, bản Word hay cả hai.
6. Đồng bộ Google Sheet có cột Writing (cần bạn code viết Apps Script).

## Cần thống nhất giữa hai người

- Chỗ lưu lịch sử 5 Mock của mỗi học sinh (mã học sinh làm khóa).
- Grade A/B/C: đang dùng mốc Cambridge English Scale chung cho từng kỹ năng và Overall: KET A 140, B 133, C 120; PET A 160, B 153, C 140; FCE A 180, B 173, C 160. Cần Elaine xác nhận.
- Nhận xét tổng thể và 3 ưu tiên: app gợi ý, giáo viên sửa, giới hạn 700 ký tự và 3 ý (mỗi ý khoảng 140 ký tự).

## Thay đổi file CHUNG đã merge (Uyên cần kéo main mới về)

- PR #4 đã sửa `cham-bai.js` (thêm `reportModel`, `reportPages`, `renderReportCanvases`, viết lại `studentReport`/`classReport`; thêm `S.priorities`; giữ `reportHTML` cũ làm phương án dự phòng), `cham-bai.html` (modal nhiều trang, ô 3 ưu tiên, nạp font/CSS/JS trong `viet/`), `cham-bai.css` (vài dòng). Uyên cần `git pull` (hoặc tải main mới) trước khi sửa tiếp các file này.

## Uyên cập nhật (Uyên tự ghi, mới nhất ở trên)

| Ngày | Đang làm / đã làm | File đụng tới | Cần Elaine biết gì |
|---|---|---|---|
| | | | |

## 01/10/2026 - Speaking: diem can cai thien tren trang 2 (ban xem truoc, nhanh viet-speaking-diem-yeu)
- Speaking thanh 1 the trong luoi "Why Points Are Being Lost" (tieu de tieng Viet, noi dung toi da 2 diem + How to fix = Next Step), cung khung voi cac ky nang khac. Strength dua vao Teacher's Overall Comment o trang 1. Thuat ngu Anh duoc dich sang tieng Viet (bang GLOS trong speaking-chan-doan.js).
- Chon theo 3 tang cua Elaine: G/V hoac P duoi band 3 -> lay tieu chi do truoc (hoa: G/V truoc); bang chung nang nhat theo thu tu noi bo; ca hai tu band 3 -> bang 4 muc uu tien cua Uyen.
- "Weak part" hien thanh "The hien ro nhat o Part x" trong Area to Improve.
- File moi: viet/speaking-bank.js (ngan hang nhan xet KET/PET/FCE), viet/speaking-chan-doan.js (logic chon). Du lieu vao: m.speaking = {bands, evidence, weakPart} (dang la du lieu gia trong phieu-mau-v2.html).
- Chua noi voi cham-bai.js: can Uyen dua ma chan doan Speaking tu phieu diem chi tiet vao reportModel.
