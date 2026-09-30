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
| 2026-09-30 | `viet-phieu-writing` (chưa merge) | Thiết kế phiếu 4 trang cho phụ huynh, bản v4 (font Be Vietnam Pro gắn sẵn trong `viet/fonts/`, phụ đề tiếng Việt dưới tiêu đề tiếng Anh, Overall theo màu cấp độ, màu kỹ năng dùng chung mọi cấp độ, tiêu đề tiếng Anh, biểu đồ kết hợp cột + đường Overall, bảng màu pastel riêng từng kỹ năng, mẫu KET Mock 1 chưa có lịch sử). JSON Writing thêm `severity` ở từng lỗi để chỉnh độ đậm nhạt. CHƯA gắn vào app: trang 1 Performance Overview, trang 2 Learning Diagnosis, trang 3-4 Writing Part 1 và Part 2. Thêm bảng màu pastel theo cấp độ, Grade A/B/C, biểu đồ 5 Mock. JSON Writing thêm 3 trường tùy chọn `strengths`, `issues`, `checklist`. | `viet/phieu-trang.js`, `viet/phieu-trang.css`, `viet/phieu-mau-v2.html`, `viet/writing-report.js`, `viet/writing-report.css`, `viet/schema-writing.json`, `viet/mau-*-day-du.json` |
| 2026-09 | PR `viet-gan-buoc4` (đã merge) | Thêm bước 5 "Writing" vào app: dán hoặc tải JSON, kiểm tra, ghép theo học sinh, hiện trong bảng Kết quả và xuất CSV/Excel. | `cham-bai.html`, `cham-bai.js`, `cham-bai.css` (CHUNG) |
| 2026-09 | PR #2 `viet-kiem-tra-json` (đã merge) | Trang kiểm tra JSON Writing (báo lỗi tiếng Việt). | `viet/kiem-tra-json.*`, `viet/ajv2020.bundle.js` |
| 2026-09 | PR #1 `viet-writing` (đã merge) | Hợp đồng JSON Writing v1.0 cho KET/PET/FCE, bảng quy đổi KET. | `viet/schema-writing.json`, `viet/HOP-DONG-JSON.md` |

## Đang làm

- Duyệt thiết kế phiếu 4 trang (Elaine đang xem bản mẫu `viet/phieu-mau-v2.html`).

## Kế hoạch

1. Gắn phiếu 4 trang vào app (`reportHTML`, `studentReport`, `classReport`, `addPage` trong `cham-bai.js`): ra 4 trang mỗi học sinh. Học sinh chưa có Writing thì bỏ trang 3-4.
2. Tách Use of English thành kỹ năng riêng cho FCE (chạm `cap-do.json` và phần tính điểm Reading của bạn code).
3. Speaking: phiếu chấm Speaking làm cùng kiểu Reading/Listening (Elaine đang làm phiếu). App nhận điểm 4 tiêu chí, mỗi tiêu chí 0-5.
4. Lưu lịch sử điểm theo học sinh qua 5 Mock để vẽ biểu đồ và tính tăng/giảm so với Mock trước (cần thống nhất chỗ lưu, xem "Cần thống nhất").
5. Skill/prompt cho giáo viên: AI hỏi giáo viên cần JSON, bản Word hay cả hai.
6. Đồng bộ Google Sheet có cột Writing (cần bạn code viết Apps Script).

## Cần thống nhất giữa hai người

- Chỗ lưu lịch sử 5 Mock của mỗi học sinh (mã học sinh làm khóa).
- Grade A/B/C: đang dùng mốc Cambridge English Scale chung cho từng kỹ năng và Overall: KET A 140, B 133, C 120; PET A 160, B 153, C 140; FCE A 180, B 173, C 160. Cần Elaine xác nhận.
- Nhận xét tổng thể và 3 ưu tiên: app gợi ý, giáo viên sửa, giới hạn 700 ký tự và 3 ý (mỗi ý khoảng 140 ký tự).

## Thay đổi file CHUNG đang chờ (cần bạn code xác nhận)

- Chưa có. Bước gắn phiếu vào app (mục 1) sẽ sửa `cham-bai.js`, `cham-bai.html`, `cham-bai.css`.
