# Chấm phiếu Cambridge - Ruby School

App chấm phiếu trắc nghiệm KET, PET, FCE bằng cách chụp ảnh phiếu (OMR), quy đổi điểm theo Cambridge English Scale và gửi kết quả lên Google Sheet. Đang mở rộng thêm phần chấm Writing.

Mở app: `index.html` (tự chuyển sang `cham-bai.html`).

## Phân công

| Phần việc | Người phụ trách | File / thư mục |
|---|---|---|
| Chấm phiếu OMR, Reading, Listening | (điền tên) | `omr-engine.js`, `omr-template.json`, `de-thi/`, `cap-do.json`, `cau-hinh.json` |
| Chấm Writing KET-PET-FCE, xuất JSON, mẫu báo cáo | Elaine | `viet/` |
| Giao diện chung, nhận xét mẫu | Báo nhau trước khi sửa | `cham-bai.html`, `cham-bai.css`, `cham-bai.js`, `nhan-xet-mau.json` |

## Quy ước làm việc

1. Không sửa trực tiếp nhánh `main`. Mỗi người làm trên nhánh riêng (ví dụ `viet-writing`, `omr-...`), xong thì mở Pull Request.
2. Trước mỗi buổi làm: lấy bản mới nhất từ GitHub (pull).
3. Không sửa file của người kia khi chưa báo. Riêng `cham-bai.js` (file lớn, dễ xung đột) chỉ một người sửa tại một thời điểm.
4. Không đưa mật khẩu, API key, mã giáo viên vào repo.
5. Phần Writing và phần OMR nói chuyện với nhau qua file JSON, định dạng ghi trong `viet/HOP-DONG-JSON.md`. Muốn đổi định dạng thì báo người kia trước và tăng `schema_version`.

## Đang làm dở / việc tiếp theo

- (Điền khi cần bàn giao)
