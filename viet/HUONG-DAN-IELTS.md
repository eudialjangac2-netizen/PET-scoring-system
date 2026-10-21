# Hướng dẫn nhập điểm và nhận xét phiếu IELTS

Phiếu IELTS đọc dữ liệu từ tab **IELTS** trong file Google Sheet "KẾT QUẢ MOCK TESTS - NH 2026 - 2027". Giáo viên chỉ làm việc trong tab này. Mọi điểm và nhận xét nhập ở đây sẽ lên phiếu.

## 1. Cấu trúc tab IELTS

- Cột A là **MOCK TEST 1 đến 5**. Mỗi mock là một khối 98 dòng, cùng thứ tự lớp và tên. Nhập đúng dòng của mock đang làm.
- Dùng bộ lọc (hàng tiêu đề) để lọc theo cột A và theo Lớp cho dễ nhập.
- Các cột **xám** là công thức, không gõ đè. Cột nhập có màu đầu cột.
- Không đổi tên cột, không chèn hoặc xoá cột. App tìm cột theo tên tiêu đề.

## 2. Ai nhập cột nào

| Khối cột | Người nhập | Nội dung |
|---|---|---|
| Đỏ hồng (điểm chính thức) | Quản lý học vụ | Band Listening, Reading, Writing, Speaking, OVERALL, dán từ tab "IELTS - MOCK TESTS" |
| Xanh dương (đơn vị ngoài) | Quản lý học vụ | Dán từ file coupon-statistics: band và hai cột statistics Listening, Reading |
| Tím (Writing) | Giáo viên chấm Writing | 4 tiêu chí của Task 1 và Task 2 (TA, CC, LR, GRA) |
| Cam (Speaking) | Giáo viên chấm Speaking | 4 tiêu chí và feedback từng tiêu chí |
| Xanh lá (nhận xét) | Giáo viên chủ nhiệm môn | Nhận xét tổng thể, 3 ưu tiên, nhận xét 4 kỹ năng |

## 3. Giới hạn số ký tự (tính cả khoảng trắng)

| Ô nhập | Tối đa | Gợi ý |
|---|---|---|
| Nhận xét tổng thể (trang 1) | 750 (đẹp nhất dưới 520) | 4 đến 6 câu |
| Ưu tiên 1, 2, 3 (trang 1) | 160 mỗi ưu tiên | 1 đến 2 câu ngắn |
| Writing, Speaking, Listening: Strengths, Weaknesses, Action plan (trang 2) | 160 mỗi ô | 1 đến 2 câu |
| Reading: Strengths, Weaknesses, Action plan (trang 2) | 110 mỗi ô | 1 câu |

Mỗi lần xuống dòng chiếm chỗ như khoảng 40 ký tự. Vượt giới hạn, chữ sẽ bị cắt hoặc phiếu bị lệch. Sheet có cảnh báo khi gõ quá dài.

## 4. Cách viết nhận xét

1. **Strengths**: khen thế mạnh trước, nêu cụ thể, có dẫn chứng.
2. **Weaknesses**: nói 1 đến 2 điểm cần cải thiện nhất, nhẹ nhàng.
3. **Action plan**: việc cụ thể em làm được trong 1 đến 2 tuần.
4. Giọng khuyến khích, mang tính xây dựng. Mỗi câu bắt đầu bằng **"Em"**.

Mẫu:
- Strengths: "Em phát âm rõ ràng và dùng từ vựng chủ đề phong phú, đặc biệt ở Part 2."
- Weaknesses: "Em còn dừng giữa câu ở Part 3, nên ý chưa được phát triển trọn vẹn."
- Action plan: "Em luyện nói 1 phút mỗi ngày theo chủ đề, ghi âm và nghe lại để tự sửa."
- Nhận xét tổng thể (khoảng 450 ký tự): "Em đạt Overall 6.5 ở Mock Test này, một kết quả tốt và gần với mục tiêu 7.0. Em làm Reading rất chắc, đặc biệt dạng Matching. Em cần cải thiện Writing, nhất là độ chính xác ngữ pháp trong Task 2. Em hãy viết một bài mỗi tuần và tự soát lỗi theo danh sách để chạm mục tiêu ở lần sau."

Gợi ý nội dung theo kỹ năng: Writing và Speaking nhìn 4 tiêu chí để biết tiêu chí mạnh nhất và yếu nhất. Listening và Reading nhìn bảng "Results by question type" trên phiếu để biết dạng câu làm tốt và dạng câu mất điểm.

## 5. Tạo phiếu trong app

1. Mở trang **ielts.html** (hoặc bấm nút **Phiếu IELTS** ở góc trên trang chấm phiếu). Đăng nhập bằng mã giáo viên như ở trang chấm phiếu. Giáo viên chỉ thấy học sinh của nhóm IELTS mình dạy, quản lý thấy tất cả. Quản lý đổi phân quyền trong file `ielts-quyen.json`.
2. Link Google Sheet đã có sẵn trong `cau-hinh.json` (khóa `ieltsSheet`). Sheet phải chia sẻ "Bất kỳ ai có đường liên kết đều xem được".
3. Chọn **Mock Test** và **Lớp**. Bảng liệt kê từng học sinh với trạng thái: đủ điểm, thiếu điểm, hoặc thiếu bao nhiêu ô nhận xét.
4. Bấm **Xem** để xem phiếu 2 trang của từng bạn.
5. Bấm **Tải PDF bạn này**, hoặc **Tải PDF cả danh sách** để có một file PDF nhiều trang của lớp đang chọn.
6. Sửa nhận xét: sửa trong Google Sheet, rồi bấm **Tải lại từ sheet** và tạo lại phiếu.

Lưu ý: học sinh thiếu điểm của một kỹ năng chưa tạo được phiếu. Ô nhận xét trống vẫn tạo phiếu và ô đó để trống.

## 6. Từ Mock Test 2 trở đi

- Phiếu tự hiện Overall của các mock trước, mức tăng giảm từng kỹ năng, và bảng tiến bộ.
- Mục tiêu của từng bạn lấy từ cột "Nhóm mục tiêu".
- Tháng thi hiện trên phiếu: Mock 1 October 2026, Mock 2 December 2026, Mock 3 January 2027, Mock 4 April 2027, Mock 5 May 2027.
