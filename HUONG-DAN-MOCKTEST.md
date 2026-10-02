# Hướng dẫn Mock test trên app chấm phiếu

Cập nhật 03/10/2026. Áp dụng cho bản trong PR #12 (nhánh `uyen-mock-daily-lich-su`).

> **Nguyên tắc:** một đề **không** mang nhãn "mock" hay "hằng ngày". Giáo viên chọn **loại buổi chấm** và **đợt Mock** ở bước 1 cho từng lần chấm. Cùng một đề có thể là Mock của lớp này và bài luyện của lớp khác.

---

## 1. Mock test và Bài hàng ngày khác nhau thế nào

Giáo viên chọn ở **bước 1 (Đề & lớp)**, mục **Loại buổi chấm**.

| | **Mock test** | **Bài hàng ngày** |
|---|---|---|
| Dùng khi | Thi thử chính thức, cần báo cáo cho phụ huynh | Luyện tập, kiểm tra nhanh trong lớp |
| Điểm | Thang Cambridge, Grade, CEFR, Overall | Điểm thô và % đúng |
| Phiếu báo điểm | Có | **Không có** |
| Mũi tên ▲▼ so với đợt trước | Có | Không |
| Tab Google Sheet | **Kết quả PET / KET / FCE** | **Hằng ngày PET / KET / FCE** |
| Speaking, Writing | Có thể nhập, đưa vào Overall | Có hoặc không đều được |
| Danh sách đề hiện | **Mọi đề** đúng cấp độ của lớp | **Mọi đề** đúng cấp độ của lớp |
| Chọn thêm ở bước 1 | **Đợt Mock 1 đến 5** | Tên buổi (tuỳ chọn) |

Hai chế độ **lưu tách nhau hoàn toàn**. Chấm Hằng ngày không đụng vào dữ liệu Mock.

---

## 2. Thêm một đề mới (Mock hoặc luyện tập đều dùng chung cách này)

**Không cần khai báo đề là Mock hay hằng ngày.** Chỉ cần đưa đề vào danh sách.

### Bước 1. File đáp án
Đặt file đáp án vào thư mục **`de-thi/`**, ví dụ `de-thi/pet-test11.json` (cùng cấu trúc với `pet-test1.json`).

### Bước 2. Thêm một khối vào `de-thi/manifest.json`
Nhớ **dấu phẩy** giữa các khối:

```json
{
  "id": "pet-test11",
  "level": "PET",
  "title": "PET Test 11",
  "file": "pet-test11.json"
}
```

| Trường | Ý nghĩa | Lưu ý |
|---|---|---|
| `id` | Mã đề, duy nhất | Không còn mang ý nghĩa thứ tự đợt |
| `level` | `KET`, `PET` hoặc `FCE` | Viết hoa. Đề chỉ hiện cho lớp đúng cấp |
| `title` | Tên hiển thị | Xuất hiện trên phiếu và Google Sheet |
| `file` | Tên file đáp án | Trùng **từng chữ** với tên file (phân biệt hoa thường) |

Các trường cũ `loai` và `dot` (nếu còn trong file) **không còn tác dụng**, để nguyên cũng không sao.

### Sau khi thêm
Mở `địa-chỉ-app/de-thi/manifest.json` trên trình duyệt. Thấy dòng đề mới nghĩa là web đã cập nhật. Nếu app vẫn không hiện đề, xem mục 8.

### Ví dụ 4 lớp, mỗi lớp một đề Mock khác nhau
Đề 11 đến 14; lớp 7/1 làm đề 11, 7/2 làm đề 12, 7/3 làm đề 13, 8/4 làm đề 14.

| Lớp | Cách chọn ở bước 1 khi chấm đợt Mock |
|---|---|
| 7/1 | Mock test, **Đợt Mock 1**, lớp 7/1, đề 11 |
| 7/2 | Mock test, **Đợt Mock 1**, lớp 7/2, đề 12 |
| 7/3 | Mock test, **Đợt Mock 1**, lớp 7/3, đề 13 |
| 8/4 | Mock test, **Đợt Mock 1**, lớp 8/4, đề 14 |

Khi lớp 7/2 làm đề 11 như **bài luyện**, giáo viên chọn **Bài hàng ngày**, lớp 7/2, đề 11. Kết quả vào tab "Hằng ngày PET", không đụng đến lịch sử Mock.

---

## 3. Quy trình chấm một đợt Mock

1. **Đề & lớp:** nhập mã giáo viên (bấm biểu tượng con mắt để xem mã), cập nhật danh sách lớp, chọn **Mock test**, chọn **Đợt Mock (1 đến 5)**, chọn lớp và đề, bấm *Bắt đầu chấm*. App nhớ đợt Mock lần trước của từng lớp.
2. **Chụp phiếu:** Reading, Listening, Speaking theo thứ tự nào cũng được. Loại phiếu và mã học sinh được nhận tự động.
3. **Duyệt:** xem các câu tô không chuẩn.
4. **Câu viết:** chấm câu điền. Ô nào đổi sang "sai" thì chọn **lý do** (sai chính tả, sai dạng từ…).
5. **Writing:** dán hoặc tải JSON do skill chấm Writing xuất ra.
6. **Speaking:** nhập hoặc quét phiếu Speaking (band từng tiêu chí).
7. **Bài làm máy** (FCE, nếu có): lấy bài làm trên máy từ Google Sheet hoặc file.
8. **Kết quả:** xem bảng, tải Excel hoặc CSV, bấm **Phiếu** ở từng dòng để xuất phiếu báo điểm.

Kết quả tự đồng bộ lên Google Sheet (tab **Kết quả**) sau mỗi lần chấm.

---

## 4. Lưu kết quả qua các đợt Mock

- Mỗi cặp **đề + lớp** là một phiên lưu riêng trên máy và trên Sheet.
- Mỗi học sinh một dòng cho mỗi đề, khoá là `đề | lớp | mã học sinh`.
- Mỗi dòng Mock trên Sheet tự có cột **Loại = Mock** và **Đợt Mock = số đã chọn** ở bước 1. Giáo viên không phải phân loại gì thêm.
- **Không dùng lại cùng một đề cho hai đợt Mock của cùng một lớp.** Đợt sau sẽ ghi đè đợt trước.
- Mở lại một phiên đã lưu và chọn **đợt khác**, app hỏi xác nhận *"Phiên này đang được lưu là Mock 3. Đổi thành Mock 4?"*.
- Bài Hằng ngày có khoá riêng kèm **tên buổi** (để trống thì app dùng ngày hôm nay). Muốn tách hai buổi cùng đề trong một ngày thì đặt tên buổi khác nhau.

---

## 5. Mũi tên tăng giảm điểm so với đợt Mock trước

**Không cần tải file Excel nào.** App tự đọc điểm các đợt trước từ tab "Kết quả" trên Google Sheet.

### Điều kiện để có mũi tên
1. **Apps Script đã triển khai lại** với bản mới (có thao tác `history`).
2. **Đợt trước đã đồng bộ lên Sheet**: mở tab "Kết quả PET", phải thấy dòng của học sinh và đề cũ.
3. Các đợt cũ đã được chấm bằng chế độ **Mock** (có **Đợt Mock**), **cùng cấp độ**. Đợt trước là đợt có số lớn nhất nhỏ hơn đợt đang chấm. Các đợt cũ chưa có cột Đợt Mock (chấm bằng bản trước) được tính theo số cuối của mã đề, ví dụ `pet-test1` là đợt 1.
4. Học sinh có **cùng mã** ở cả hai đợt.

### Cách tính
| Phần | Quy tắc |
|---|---|
| Từng kỹ năng | Điểm thang đợt này trừ điểm thang đợt trước |
| Overall | Chỉ so khi hai đợt có **cùng bộ kỹ năng có điểm**. Ví dụ đợt 1 chưa có Writing, đợt 2 đủ 4 kỹ năng thì **không hiện** mũi tên Overall |
| Học sinh chưa có đợt trước | Phiếu ghi **Baseline** như đợt đầu (chọn Mock 1 thì luôn là Baseline) |
| Bỏ lỡ một đợt (có Mock 1 và 3, không có 2) | So với Mock 1; biểu đồ ghi đúng nhãn Mock 1 và Mock 3 |
| Không đọc được Sheet | Phiếu vẫn xuất bình thường, hiện như đợt đầu, màn Kết quả có thông báo |
| Bài Hằng ngày | Không tham gia so sánh |

### Lưu ý
- **Writing của các đợt cũ** chưa có trong Sheet (app cũ không ghi cột Writing), nên đợt đã chấm trước đây sẽ không có mũi tên Writing. Từ nay trở đi các đợt sau so được.
- Cột điểm trong Sheet tên là `Reading thang`, `Listening thang`, `Writing thang`, `Speaking thang` (FCE có `Use of English thang`). Không đổi tên các cột này, vì app đọc lịch sử theo đúng tên đó.
- **Bài luyện không bao giờ vào lịch sử**, kể cả khi dùng đề từng làm Mock, vì chỉ các dòng chấm ở chế độ Mock mới nằm trong tab "Kết quả".

---

## 6. Reading và Listening lấy từ hai đề khác nhau

Dùng khi giáo viên cho học sinh làm Reading Test 1 nhưng Listening Test 2.

1. Ở bước 1, chọn lớp và **đề dùng cho Reading** (FCE: Reading và Use of English).
2. Tick ô **"Reading và Listening lấy từ hai đề khác nhau"**.
3. Chọn **đề dùng cho Listening**.
4. Bấm *Bắt đầu chấm*.

- **Không cần tạo file đáp án mới.** App tự ghép đáp án Reading từ đề thứ nhất và Listening từ đề thứ hai.
- Phiếu giấy dùng chung, việc quét không đổi.
- Phiếu báo điểm ghi dạng **"PET Test 1 (R) + PET Test 2 (L)"**.
- Mỗi cặp ghép là **một phiên riêng**, không đè lên phiên nguyên bộ.
- Hai đề phải **cùng cấp độ với lớp**.
- **Ghép đề dùng được cho cả Mock.** Chọn chế độ Mock, chọn đợt Mock, tick ghép đề; mũi tên ▲▼ và lịch sử hoạt động bình thường vì đợt do giáo viên chọn, không phụ thuộc mã đề.

---

## 7. Xuất phiếu báo điểm

Ở bước **Kết quả**, bấm **Phiếu** ở dòng của học sinh (chỉ chế độ Mock).

- **Điều kiện xuất phiếu:** học sinh có điểm **ít nhất 1 kỹ năng**: Reading hoặc Listening đủ trang, hoặc Writing (JSON), hoặc Speaking (nhập hoặc quét). Chỉ có Writing hoặc chỉ có Speaking vẫn xuất được.
- **Chọn kỹ năng:** đầu cửa sổ phiếu có các ô tick từng kỹ năng, kèm **Tất cả** và **Chỉ kỹ năng có điểm**. Bỏ tick thì kỹ năng đó biến khỏi mọi trang của phiếu. Phải còn ít nhất 1 kỹ năng đã có điểm.
- **Overall khi chọn một phần:** tính trên các kỹ năng đang tick và ghi **"Provisional"**.
- **Nhận xét và 3 ưu tiên:** nếu chưa sửa tay, app tự viết lại theo kỹ năng đang chọn. Nếu đã sửa tay thì giữ nguyên.
- Lựa chọn được nhớ theo từng học sinh. Không còn phiếu cả lớp; xuất từng học sinh một.
- **Không có** phiếu báo điểm ở chế độ Bài hàng ngày.

---

## 8. Khi có sự cố

| Triệu chứng | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| Đề mới không hiện | Trình duyệt giữ bản cũ | Mở ẩn danh hoặc tải lại cứng (Ctrl+Shift+R); xoá dữ liệu trang trên điện thoại |
| Đề mới không hiện | Web chưa dựng xong | Vercel, mục Deployments, phải báo **Ready** |
| Đề mới không hiện | Sai cú pháp `manifest.json` (thiếu dấu phẩy, dấu ngoặc kép cong) | Dán file vào trình kiểm tra JSON |
| Đề mới không hiện | `level` không khớp cấp độ của lớp đang chọn | Chọn đúng lớp; kiểm tra `level` trong `manifest.json` |
| Đề mới không hiện | File để sai thư mục, hoặc `file` sai chữ hoa thường | Cả hai file phải nằm trong `de-thi/` |
| Không có mũi tên ▲▼ | Apps Script chưa triển khai lại | Triển khai lại, rồi mở lại phiên chấm |
| Không có mũi tên ▲▼ | Đợt trước chưa đồng bộ lên Sheet, hoặc học sinh khác mã | Kiểm tra tab "Kết quả PET" |
| Không có mũi tên ▲▼ | Đợt Mock đang chọn là 1, hoặc chọn nhầm đợt (ví dụ đợt trước cũng lưu là đợt 3) | Kiểm tra cột **Đợt Mock** trên tab "Kết quả PET" và đợt chọn ở bước 1 |
| Màn Kết quả báo "Chưa đọc được điểm các đợt Mock trước" | Mất mạng, sai mã giáo viên, hoặc Apps Script lỗi | Kiểm tra mạng, nhập lại mã giáo viên; phiếu vẫn xuất như đợt đầu |
| Nút Phiếu không hiện | Chế độ đang là Bài hàng ngày, hoặc học sinh chưa có điểm kỹ năng nào | Chuyển sang Mock; kiểm tra phiếu bị thiếu trang |

---

## 9. Việc cần làm một lần khi triển khai

- [ ] Merge PR #12 (hoặc dùng địa chỉ xem thử của nhánh để thử trước).
- [ ] **Triển khai lại Apps Script** (Deploy, Manage deployments, sửa bản hiện có, New version).
- [ ] Thử một đợt Mock với phiếu thật: R, L, Speaking cùng mã học sinh; xem phiếu báo điểm.
- [ ] Chấm đợt thứ hai và kiểm tra mũi tên ▲▼ trên phiếu.
- [ ] In thử phiếu Reading/Listening mới (ô nhỏ), chụp gửi để kiểm tra với ảnh thật.
